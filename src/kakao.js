// 카카오 장소 검색: '남양주 + 지역 + 종류' 키워드로 카카오 추천(정확도) 순 상위 45곳을 받는다.
// 장소 정보는 저장하지 않고 페이지가 열려 있는 동안 메모리에만 둔다.
import { CATEGORIES, AREAS, CITY } from './categories.js';
import { toRestaurant, matchesCategory, dedupeById, areaOf, isChain } from './places-logic.js';

const PAGE_SIZE = 15;
const MAX_VISIBLE = 45; // 카카오가 한 검색에 노출하는 최대 건수
const DEFAULT_TIMEOUT_MS = 10000;

export function withTimeout(promise, ms, message = '시간 초과') {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// 여러 순위 목록을 1위끼리, 2위끼리… 번갈아 합친다
export function mergeRanked(lists) {
  const out = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

export function searchTop(keywordSearch, query, groupCode, sdk, timeoutMs = DEFAULT_TIMEOUT_MS, maxPages = 3) {
  const search = new Promise((resolve, reject) => {
    const docs = [];
    const fetchPage = (page) => {
      try {
        const options = { category_group_code: groupCode, sort: sdk.sortAccuracy, size: PAGE_SIZE, page };
        keywordSearch(query, (result, status, pagination) => {
          if (status === sdk.Status.OK) {
            docs.push(...result);
            if (pagination?.hasNextPage && page < maxPages && page * PAGE_SIZE < MAX_VISIBLE) fetchPage(page + 1);
            else resolve(docs);
          } else if (status === sdk.Status.ZERO_RESULT) resolve(docs);
          else reject(new Error(`카카오 장소 검색 실패: ${status}`));
        }, options);
      } catch (e) {
        reject(e);
      }
    };
    fetchPage(1);
  });
  return withTimeout(search, timeoutMs, '카카오 장소 검색 시간 초과');
}

// 검색어 하나의 한 페이지를 받는다
export function searchPage(keywordSearch, query, groupCode, sdk, page, extra = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const call = new Promise((resolve, reject) => {
    try {
      const options = { ...extra, category_group_code: groupCode, sort: sdk.sortAccuracy, size: PAGE_SIZE, page };
      keywordSearch(query, (result, status, pagination) => {
        if (status === sdk.Status.OK) resolve({ docs: result, hasNext: !!pagination?.hasNextPage && page * PAGE_SIZE < MAX_VISIBLE });
        else if (status === sdk.Status.ZERO_RESULT) resolve({ docs: [], hasNext: false });
        else reject(new Error(`카카오 장소 검색 실패: ${status}`));
      }, options);
    } catch (e) {
      reject(e);
    }
  });
  return withTimeout(call, timeoutMs, '카카오 장소 검색 시간 초과');
}

// 탭 목록: 처음엔 검색어마다 1페이지만 받고(카카오 호출 절약), '더 보기'를 누르면 다음 페이지를 이어 받는다.
// 결과는 배열이고 hasMore(더 받을 페이지가 있는지)를 함께 단다. 같은 지역·탭은 받은 페이지를 기억해 다시 부르지 않는다.
export function createFetcher(keywordSearch, sdk, options = {}) {
  const states = new Map();
  return (areaKey, categoryKey, { pages = 1 } = {}) => {
    const area = AREAS.find((a) => a.key === areaKey);
    const category = CATEGORIES.find((c) => c.key === categoryKey);
    if (!area || !category) return Promise.reject(new Error(`알 수 없는 지역/종류: ${areaKey}/${categoryKey}`));
    const cacheKey = `${areaKey}:${categoryKey}`;
    let st = states.get(cacheKey);
    if (!st) {
      // 사각형이 있는 지역의 메뉴 탭은 검색어만(지역 이름 없이) 사각형 안에서 한 번씩 검색한다.
      // 추천 탭('맛집'·지역명)은 사각형 검색 결과가 크게 줄어서 지금처럼 '지역 이름 + 검색어'로 검색한다.
      const useBox = area.bounds && category.key !== 'all';
      const extra = useBox ? { bounds: sdk.toBounds ? sdk.toBounds(area.bounds) : area.bounds } : {};
      const words = useBox
        ? category.queries
        : area.queries.flatMap((a) => category.queries.map((w) => `${a} ${w}`.trim()));
      st = { extra, items: words.map((q) => ({ q, pages: [], hasNext: true })), pending: null };
      states.set(cacheKey, st);
    }
    const inArea = (d) => {
      const addr = String(d.address_name ?? '');
      if (!addr.includes(`${CITY}시`)) return false;
      return area.legal == null || area.legal.includes(areaOf(addr));
    };
    const maxPages = Math.ceil(MAX_VISIBLE / PAGE_SIZE);
    const loadTo = async (want) => {
      if (st.pending) await st.pending.catch(() => {});
      const load = Promise.all(st.items.map(async (it) => {
        while (it.hasNext && it.pages.length < want) {
          const { docs, hasNext } = await searchPage(keywordSearch, it.q, category.groupCode, sdk, it.pages.length + 1, st.extra, options.timeoutMs);
          it.pages.push(docs);
          it.hasNext = hasNext;
        }
      }));
      st.pending = load;
      await load;
    };
    const build = () => {
      const lists = st.items.map((it) => it.pages.flat().filter((d) => inArea(d) && matchesCategory(d.category_name, category) && !isChain(d.place_name)));
      return dedupeById(mergeRanked(lists).map((d) => toRestaurant(d))).map((r, i) => ({ ...r, rank: i + 1 }));
    };
    const run = async () => {
      let want = Math.min(Math.max(1, pages), maxPages);
      await loadTo(want);
      let out = build();
      // 첫 화면: 추천 탭은 firstCount(45)곳, 메뉴 탭은 fill(30)곳이 찰 때까지 다음 페이지를 받는다.
      // 추천 탭만 딱 45곳으로 자르고 나머지는 '더 보기'로 보여준다.
      const target = pages <= 1 ? (category.firstCount ?? category.fill ?? 0) : 0;
      const first = pages <= 1 && category.firstCount;
      while (out.length < target && want < maxPages && st.items.some((it) => it.hasNext)) {
        want += 1;
        await loadTo(want);
        out = build();
      }
      const hasNext = st.items.some((it) => it.hasNext);
      const loaded = Math.max(1, ...st.items.map((it) => it.pages.length));
      if (first && out.length > category.firstCount) {
        const cut = out.slice(0, category.firstCount);
        cut.hasMore = true;
        cut.pages = loaded;
        return cut;
      }
      out.hasMore = hasNext;
      out.pages = loaded;
      return out;
    };
    return run();
  };
}
