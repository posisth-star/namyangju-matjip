// 카카오 장소 검색: '지역 + 종류' 키워드로 카카오 추천(정확도) 순 상위 45곳을 받는다.
// 장소 정보는 저장하지 않고 페이지가 열려 있는 동안 메모리에만 둔다.
import { CATEGORIES, AREAS, CITY } from './categories.js';
import { toRestaurant, matchesCategory, dedupeById } from './places-logic.js';

const PAGE_SIZE = 15;
const MAX_VISIBLE = 45; // 카카오가 한 검색에 노출하는 최대 건수
const DEFAULT_TIMEOUT_MS = 10000;

export function withTimeout(promise, ms, message = '시간 초과') {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function buildQuery(area, category) {
  return `${area.query} ${category.query}`;
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
    const p = searchTop(keywordSearch, buildQuery(area, category), category.groupCode, sdk, options.timeoutMs).then((docs) =>
      dedupeById(
        docs.filter((d) => String(d.address_name ?? '').includes(`${CITY}시`) && matchesCategory(d.category_name, category))
          .map((d) => toRestaurant(d)),
      ).map((r, i) => ({ ...r, rank: i + 1 })));
    cache.set(cacheKey, p);
    p.catch(() => cache.delete(cacheKey));
    return p;
  };
}
