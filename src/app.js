// 페이지 진입점: SDK 로드 → 지역·종류·검색 → 정렬 → 렌더
import { AREAS, isVisible, visibleCategories, visibleAreas } from './categories.js';
import { sortRestaurants } from './places-logic.js';
import { createFetcher, createSearcher, withTimeout } from './kakao.js';
import { renderTabs, renderList, renderLoading, renderError, renderAreaOptions } from './ui.js';
import { parseUrlState, buildUrlQuery } from './url-state.js';

const $ = (id) => document.getElementById(id);
// 주소(?area=…&cat=…&q=…&sort=…)에 담긴 화면으로 시작한다
const state = { ...parseUrlState(location.search), data: null, fetchFor: null, searchFor: null };
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

// 지금 화면을 주소에 반영해 그대로 공유할 수 있게 한다
function syncUrl() {
  const qs = buildUrlQuery(state);
  if (qs !== location.search) history.replaceState(null, '', `${location.pathname}${qs}`);
}

// 탭은 지금 지역에서 보이는 종류만, 지역 목록은 지금 종류에서 보이는 지역만 (검색 중엔 모든 지역)
function paintControls() {
  $('tabs').innerHTML = renderTabs(visibleCategories(state.area), state.term ? null : state.active);
  if ($('area')) $('area').innerHTML = renderAreaOptions(state.term ? AREAS : visibleAreas(state.active), state.area);
  if ($('clearSearch')) $('clearSearch').hidden = !state.term;
  if ($('q') && $('q').value.trim() !== state.term) $('q').value = state.term;
  if ($('sortBy')) $('sortBy').value = state.sortBy;
}

function paint() {
  paintControls();
  if (state.data) $('list').innerHTML = renderList(sortRestaurants(state.data, state.sortBy), { areaLabel: areaLabel(), term: state.term });
}

async function show() {
  const { area, active, term } = state;
  state.data = null;
  syncUrl();
  paintControls();
  $('list').innerHTML = renderLoading();
  try {
    const data = term ? await state.searchFor(area, term) : await state.fetchFor(area, active);
    if (state.area !== area || state.active !== active || state.term !== term) return; // 그 사이 선택이 바뀌었으면 무시
    state.data = data;
    paint();
  } catch (e) {
    console.error(e);
    if (state.area === area && state.active === active && state.term === term) $('list').innerHTML = renderError();
  }
}

function setArea(areaKey) {
  state.area = areaKey;
  if (!isVisible(state.area, state.active)) state.active = 'all'; // 이 지역에 없는 종류면 전체로
  show();
}


// 다시 시도: SDK가 준비됐으면 현재 선택만 재호출, 아니면 새로고침
document.addEventListener('click', (ev) => {
  if (ev.target.id !== 'retry') return;
  if (state.fetchFor) show();
  else location.reload();
});

async function main() {
  paintControls();
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
  state.searchFor = createSearcher(places.keywordSearch.bind(places), sdk);

  $('tabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-key]');
    if (btn && (btn.dataset.key !== state.active || !state.data || state.term)) {
      state.active = btn.dataset.key;
      state.term = '';
      show();
    }
  });
  $('area')?.addEventListener('change', (ev) => setArea(ev.target.value));
  $('sortBy')?.addEventListener('change', (ev) => { state.sortBy = ev.target.value; syncUrl(); paint(); });
  $('searchForm')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const term = $('q').value.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!term) return;
    state.term = term;
    show();
  });
  $('clearSearch')?.addEventListener('click', () => { state.term = ''; show(); });
  show();
}

main();
