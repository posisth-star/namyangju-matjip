// 페이지 진입점: SDK 로드 → 지역·종류 선택 → 정렬 → 렌더
import { CATEGORIES, AREAS, MIN_COUNT } from './categories.js';
import { sortRestaurants } from './places-logic.js';
import { createFetcher, withTimeout } from './kakao.js';
import { renderTabs, renderList, renderLoading, renderError, renderAreaOptions } from './ui.js';

const $ = (id) => document.getElementById(id);
const state = { area: AREAS[0].key, active: CATEGORIES[0].key, sortBy: 'rank', data: null, fetchFor: null, tabCounts: {} };
const areaLabel = () => AREAS.find((a) => a.key === state.area)?.label ?? '';

export function loadKakaoSdk(appKey) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&libraries=services&autoload=false`;
    s.onload = () => (window.kakao?.maps ? window.kakao.maps.load(resolve) : reject(new Error('카카오 SDK가 비어 있어요')));
    s.onerror = () => reject(new Error('카카오 SDK를 불러오지 못했어요'));
    document.head.appendChild(s);
  });
}

function paint() {
  $('tabs').innerHTML = renderTabs(CATEGORIES, state.active, state.tabCounts);
  if (state.data) $('list').innerHTML = renderList(sortRestaurants(state.data, state.sortBy), { areaLabel: areaLabel() });
}

// 현재 종류에서 지역별 식당 수를 조회해 지역 목록을 갱신한다. 0곳인 지역은 목록에서 빠진다.
// 결과는 fetcher 캐시에 남으므로, 나중에 그 지역을 고르면 다시 호출하지 않는다.
async function refreshAreaCounts(categoryKey) {
  const counts = {};
  const paintAreas = () => { if ($('area')) $('area').innerHTML = renderAreaOptions(AREAS, state.area, counts); };
  await Promise.all(AREAS.map((a) => state.fetchFor(a.key, categoryKey)
    .then((list) => { counts[a.key] = list.length; })
    .catch(() => { /* 실패한 지역은 숫자 없이 둔다 */ })));
  if (state.active !== categoryKey) return; // 그 사이 종류가 바뀌었으면 무시
  // 지금 고른 지역이 5곳 이하면 남양주 전체로 돌린다
  if (state.area !== AREAS[0].key && counts[state.area] != null && counts[state.area] < MIN_COUNT) {
    state.area = AREAS[0].key; paintAreas(); show(); refreshTabCounts(state.area); return;
  }
  paintAreas();
}

// 현재 지역에서 종류별 식당 수를 조회해 종류 탭을 갱신한다. 5곳 이하인 종류 탭은 빠진다.
async function refreshTabCounts(areaKey) {
  const counts = {};
  state.tabCounts = counts;
  await Promise.all(CATEGORIES.map((c) => state.fetchFor(areaKey, c.key)
    .then((list) => { counts[c.key] = list.length; })
    .catch(() => { /* 실패한 종류는 탭을 그대로 둔다 */ })));
  if (state.area !== areaKey || state.tabCounts !== counts) return; // 그 사이 지역이 바뀌었으면 무시
  // 지금 고른 종류가 5곳 이하면 전체 탭으로 돌린다
  if (state.active !== 'all' && counts[state.active] != null && counts[state.active] < MIN_COUNT) {
    state.active = 'all'; show(); refreshAreaCounts(state.active); return;
  }
  paint();
}

async function show() {
  const { area, active } = state;
  state.data = null;
  paint();
  $('list').innerHTML = renderLoading();
  try {
    const data = await state.fetchFor(area, active);
    if (state.area !== area || state.active !== active) return; // 그 사이 선택이 바뀌었으면 무시
    state.data = data;
    paint();
  } catch (e) {
    console.error(e);
    if (state.area === area && state.active === active) $('list').innerHTML = renderError();
  }
}

// 다시 시도: SDK가 준비됐으면 현재 선택만 재호출, 아니면 새로고침
document.addEventListener('click', (ev) => {
  if (ev.target.id !== 'retry') return;
  if (state.fetchFor) show();
  else location.reload();
});

async function main() {
  $('tabs').innerHTML = renderTabs(CATEGORIES, state.active);
  if ($('area')) $('area').innerHTML = renderAreaOptions(AREAS, state.area);
  $('list').innerHTML = renderLoading();
  let key;
  try {
    ({ KAKAO_JS_KEY: key } = await import('../config.js'));
    await withTimeout(loadKakaoSdk(key), 10000, '카카오 SDK 로드 시간 초과');
  } catch (e) {
    console.error(e);
    $('list').innerHTML = renderError();
    return;
  }
  const { services } = window.kakao.maps;
  const places = new services.Places();
  const sdk = { sortAccuracy: services.SortBy.ACCURACY, Status: services.Status };
  state.fetchFor = createFetcher(places.keywordSearch.bind(places), sdk);

  $('tabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-key]');
    if (btn && (btn.dataset.key !== state.active || !state.data)) {
      state.active = btn.dataset.key;
      show();
      refreshAreaCounts(state.active);
    }
  });
  $('area')?.addEventListener('change', (ev) => { state.area = ev.target.value; show(); refreshTabCounts(state.area); });
  $('sortBy')?.addEventListener('change', (ev) => { state.sortBy = ev.target.value; paint(); });
  show();
  refreshAreaCounts(state.active);
  refreshTabCounts(state.area);
}

main();
