// 카카오 장소 검색: '남양주 + 지역 + 종류' 키워드로 카카오 추천(정확도) 순 상위 45곳을 받는다.
// 장소 정보는 저장하지 않고 페이지가 열려 있는 동안 메모리에만 둔다.
import { CATEGORIES, AREAS, CITY } from './categories.js';
import { toRestaurant, matchesCategory, dedupeById, areaOf } from './places-logic.js';

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

export function searchTop(keywordSearch, query, groupCode, sdk, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const search = new Promise((resolve, reject) => {
    const docs = [];
    const fetchPage = (page) => {
      try {
        const options = { category_group_code: groupCode, sort: sdk.sortAccuracy, size: PAGE_SIZE, page };
        keywordSearch(query, (result, status, pagination) => {
          if (status === sdk.Status.OK) {
            docs.push(...result);
            if (pagination?.hasNextPage && page * PAGE_SIZE < MAX_VISIBLE) fetchPage(page + 1);
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

export function createFetcher(keywordSearch, sdk, options = {}) {
  const cache = new Map();
  return (areaKey, categoryKey) => {
    const cacheKey = `${areaKey}:${categoryKey}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const area = AREAS.find((a) => a.key === areaKey);
    const category = CATEGORIES.find((c) => c.key === categoryKey);
    if (!area || !category) return Promise.reject(new Error(`알 수 없는 지역/종류: ${areaKey}/${categoryKey}`));
    const inArea = (d) => {
      const addr = String(d.address_name ?? '');
      if (!addr.includes(`${CITY}시`)) return false;
      return area.legal == null || area.legal.includes(areaOf(addr));
    };
    const queries = area.queries.flatMap((a) => category.queries.map((c) => `${a} ${c}`.trim()));
    const p = Promise.all(queries.map((q) =>
      searchTop(keywordSearch, q, category.groupCode, sdk, options.timeoutMs)
        .then((docs) => docs.filter((d) => inArea(d) && matchesCategory(d.category_name, category)))))
      .then((lists) => dedupeById(mergeRanked(lists).map((d) => toRestaurant(d)))
        .slice(0, MAX_VISIBLE)
        .map((r, i) => ({ ...r, rank: i + 1 })));
    cache.set(cacheKey, p);
    p.catch(() => cache.delete(cacheKey));
    return p;
  };
}
