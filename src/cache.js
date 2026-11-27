// 카카오 장소 검색 결과를 이 탭의 저장소(sessionStorage)에 1시간 동안 둔다 — 새로고침해도 다시 부르지 않게.
// 카카오 운영정책: 사용자 환경 개선 목적의 캐시만 허용, 최신 데이터 유지 → 짧은 유효시간(1시간), 탭을 닫으면 사라짐,
// 앱이 쓰는 필드만 저장하고 외부로 보내지 않는다.
export const CACHE_TTL_MS = 60 * 60 * 1000;
const PREFIX = 'nyj-cache:';
const FIELDS = ['id', 'place_name', 'category_name', 'address_name', 'road_address_name', 'phone', 'place_url'];

// 검색 옵션을 키로: 카카오 범위 객체(LatLngBounds)는 toString()으로 좌표 문자열이 된다
const keyOf = (query, options = {}) => PREFIX + JSON.stringify([query, Object.keys(options).sort().map((k) => {
  const v = options[k];
  return [k, v && typeof v === 'object' && v.toString !== Object.prototype.toString ? String(v) : v];
})]);

export function cachedSearch(keywordSearch, { storage = globalThis.sessionStorage, Status, now = () => Date.now(), ttlMs = CACHE_TTL_MS } = {}) {
  const read = (key) => {
    try {
      const v = JSON.parse(storage.getItem(key) ?? 'null');
      return v && now() - v.at < ttlMs ? v : null;
    } catch { return null; }
  };
  const write = (key, value) => {
    try { storage.setItem(key, JSON.stringify(value)); } catch { /* 저장소가 막혔거나 가득 참: 캐시 없이 동작 */ }
  };
  return (query, callback, options) => {
    const key = keyOf(query, options);
    const hit = read(key);
    if (hit) {
      setTimeout(() => callback(hit.docs, hit.status, { hasNextPage: hit.hasNext }), 0);
      return;
    }
    keywordSearch(query, (result, status, pagination) => {
      if (status === Status.OK || status === Status.ZERO_RESULT) {
        const docs = (result ?? []).map((d) => Object.fromEntries(FIELDS.map((f) => [f, d[f]])));
        write(key, { at: now(), status, docs, hasNext: !!pagination?.hasNextPage });
      }
      callback(result, status, pagination);
    }, options);
  };
}
