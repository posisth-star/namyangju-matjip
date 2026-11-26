// 지금 보는 화면(지역·종류·검색어·정렬)을 주소(?area=…&cat=…&q=…&sort=…)로 주고받는다.
import { AREAS, CATEGORIES, isVisible } from './categories.js';

const DEFAULTS = { area: 'all', active: 'all', term: '', sortBy: 'rank' };
const SORTS = ['rank', 'name'];
const MAX_TERM = 30;

export function parseUrlState(search) {
  const p = new URLSearchParams(search ?? '');
  const area = AREAS.some((a) => a.key === p.get('area')) ? p.get('area') : DEFAULTS.area;
  let active = CATEGORIES.some((c) => c.key === p.get('cat')) ? p.get('cat') : DEFAULTS.active;
  if (!isVisible(area, active)) active = DEFAULTS.active; // 숨겨진 조합이면 전체로
  const term = (p.get('q') ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_TERM);
  const sortBy = SORTS.includes(p.get('sort')) ? p.get('sort') : DEFAULTS.sortBy;
  return { area, active, term, sortBy };
}

export function buildUrlQuery({ area, active, term, sortBy }) {
  const p = new URLSearchParams();
  if (area && area !== DEFAULTS.area) p.set('area', area);
  if (term) p.set('q', term);
  else if (active && active !== DEFAULTS.active) p.set('cat', active);
  if (sortBy && sortBy !== DEFAULTS.sortBy) p.set('sort', sortBy);
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}
