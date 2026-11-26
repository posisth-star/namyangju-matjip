// 지금 보는 화면(지역·종류·정렬)을 주소(?area=…&cat=…&sort=…)로 주고받는다.
import { AREAS, CATEGORIES, isVisible } from './categories.js';

const DEFAULTS = { area: 'all', active: 'all', sortBy: 'rank' };
const SORTS = ['rank', 'name'];

export function parseUrlState(search) {
  const p = new URLSearchParams(search ?? '');
  const area = AREAS.some((a) => a.key === p.get('area')) ? p.get('area') : DEFAULTS.area;
  let active = CATEGORIES.some((c) => c.key === p.get('cat')) ? p.get('cat') : DEFAULTS.active;
  if (!isVisible(area, active)) active = DEFAULTS.active; // 숨겨진 조합이면 전체로
  const sortBy = SORTS.includes(p.get('sort')) ? p.get('sort') : DEFAULTS.sortBy;
  return { area, active, sortBy };
}

export function buildUrlQuery({ area, active, sortBy }) {
  const p = new URLSearchParams();
  if (area && area !== DEFAULTS.area) p.set('area', area);
  if (active && active !== DEFAULTS.active) p.set('cat', active);
  if (sortBy && sortBy !== DEFAULTS.sortBy) p.set('sort', sortBy);
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}
