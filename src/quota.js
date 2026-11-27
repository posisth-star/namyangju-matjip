// 과다 사용 방지: 브라우저 하나당 하루 카카오 장소 검색 횟수를 제한한다.
// 서버·로그인이 없는 정적 사이트라 '사람'이 아니라 '브라우저' 단위이고, 저장소를 지우거나 다른 브라우저·시크릿 창을 쓰면 다시 센다.
export const DAILY_LIMIT = 100;
const KEY = 'namyangju-matjip-quota';

export class QuotaError extends Error {
  constructor() { super('오늘 조회 한도를 다 썼어요'); this.name = 'QuotaError'; }
}

// 한국 시간 기준 날짜(YYYY-MM-DD) — 자정이 지나면 다시 센다
const kstDate = (d) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export function createQuota({ storage = globalThis.localStorage, limit = DAILY_LIMIT, now = () => new Date() } = {}) {
  let mem = null; // 저장소를 못 쓰면 이 페이지 안에서만 센다
  const read = (today) => {
    try {
      const v = JSON.parse(storage.getItem(KEY) ?? 'null');
      if (v && v.date === today && Number.isFinite(v.count)) return v.count;
      return 0;
    } catch {
      return mem && mem.date === today ? mem.count : 0;
    }
  };
  const write = (today, count) => {
    mem = { date: today, count };
    try { storage.setItem(KEY, JSON.stringify(mem)); } catch { /* 저장소 차단: 메모리로만 센다 */ }
  };
  const usedToday = () => {
    const today = kstDate(now());
    return { today, used: Math.max(read(today), mem && mem.date === today ? mem.count : 0) };
  };
  return {
    remaining() { return Math.max(0, limit - usedToday().used); },
    take() {
      const { today, used } = usedToday();
      if (used >= limit) return false;
      write(today, used + 1);
      return true;
    },
  };
}

// keywordSearch를 감싸 호출마다 한 번씩 센다. 한도를 넘으면 카카오를 부르지 않고 QuotaError를 던진다.
export function guardSearch(keywordSearch, quota) {
  return (...args) => {
    if (!quota.take()) throw new QuotaError();
    return keywordSearch(...args);
  };
}
