// 페이지 진입점: SDK 로드 → 지역·종류 → 정렬 → 렌더
import { AREAS, isVisible, visibleCategories, visibleAreas } from './categories.js';
import { sortRestaurants } from './places-logic.js';
import { createFetcher, withTimeout } from './kakao.js';
import { renderTabs, renderList, renderLoading, renderError, renderAreaOptions } from './ui.js';
import { parseUrlState, buildUrlQuery } from './url-state.js';

const $ = (id) => document.getElementById(id);
// 주소(?area=…&cat=…&sort=…)에 담긴 화면으로 시작한다
const state = { ...parseUrlState(location.search), pages: 1, data: null, fetchFor: null };
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

// 탭은 지금 지역에서 보이는 종류만, 지역 목록은 지금 종류에서 보이는 지역만
// 탭이 오른쪽으로 더 있으면 끝을 흐리게 표시
function updateTabFade() {
  const t = $('tabs');
  t.parentElement?.classList.toggle('more', t.scrollLeft + t.clientWidth < t.scrollWidth - 4);
}

function paintControls() {
  // 탭을 다시 그려도 키보드 포커스가 사라지지 않게, 포커스가 있던 탭을 기억했다가 되돌린다
  const focusedKey = document.activeElement?.closest?.('#tabs [data-key]')?.dataset.key;
  $('tabs').innerHTML = renderTabs(visibleCategories(state.area), state.active);
  if (focusedKey) $('tabs').querySelector(`[data-key="${focusedKey}"]`)?.focus({ preventScroll: true });
  updateTabFade();
  if ($('area')) $('area').innerHTML = renderAreaOptions(visibleAreas(state.active), state.area);
  if ($('sortBy')) $('sortBy').value = state.sortBy;
}

function paint() {
  paintControls();
  if (state.data) $('list').innerHTML = renderList(sortRestaurants(state.data, state.sortBy), { areaLabel: areaLabel(), sortBy: state.sortBy });
}

async function show() {
  state.pages = 1;
  const { area, active } = state;
  state.data = null;
  syncUrl();
  paintControls();
  $('list').innerHTML = renderLoading();
  try {
    const data = await state.fetchFor(area, active, { pages: 1 });
    if (state.area !== area || state.active !== active) return; // 그 사이 선택이 바뀌었으면 무시
    state.pages = data.pages ?? 1; // 추천 탭은 45곳을 채우려고 첫 화면에 여러 페이지를 받을 수 있다
    state.data = data;
    paint();
  } catch (e) {
    console.error(e);
    if (state.area === area && state.active === active) $('list').innerHTML = renderError();
  }
}

function setArea(areaKey) {
  state.area = areaKey;
  if (!isVisible(state.area, state.active)) state.active = 'all'; // 이 지역에 없는 종류면 전체로
  show();
}


// 더 보기: 지금 탭의 다음 페이지를 이어 받는다(목록은 그대로 두고 아래에 붙음)
async function loadMore(btn) {
  const { area, active } = state;
  if (!state.data?.hasMore) return;
  btn.disabled = true;
  btn.textContent = '불러오는 중…';
  try {
    const data = await state.fetchFor(area, active, { pages: state.pages + 1 });
    if (state.area !== area || state.active !== active) return;
    state.pages = data.pages ?? state.pages + 1;
    state.data = data;
    paint();
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.textContent = '더 보기 (다시 시도)';
  }
}

// 다시 시도: SDK가 준비됐으면 현재 선택만 재호출, 아니면 새로고침
document.addEventListener('click', (ev) => {
  if (ev.target.id === 'more') { loadMore(ev.target); return; }
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
  const { services, LatLng, LatLngBounds } = window.kakao.maps;
  const places = new services.Places();
  const sdk = {
    sortAccuracy: services.SortBy.ACCURACY,
    Status: services.Status,
    toBounds: (r) => new LatLngBounds(new LatLng(r.sw.lat, r.sw.lng), new LatLng(r.ne.lat, r.ne.lng)),
  };
  state.fetchFor = createFetcher(places.keywordSearch.bind(places), sdk);

  $('tabs').addEventListener('scroll', updateTabFade, { passive: true });
  window.addEventListener('resize', updateTabFade);
  $('tabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-key]');
    if (btn && (btn.dataset.key !== state.active || !state.data)) {
      state.active = btn.dataset.key;
      show();
    }
  });
  $('area')?.addEventListener('change', (ev) => setArea(ev.target.value));
  $('sortBy')?.addEventListener('change', (ev) => { state.sortBy = ev.target.value; syncUrl(); paint(); });
  show();
}

main();
