// 화면 조각을 HTML 문자열로 만드는 순수 함수들
import { MIN_COUNT } from './categories.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const link = (href, text) =>
  `<a class="btn" href="${esc(href)}" target="_blank" rel="noopener">${text}</a>`;

// counts: { 종류키: 식당 수 }. 5곳 이하인 종류는 숨기되, 전체 탭과 아직 모르는 종류는 보여준다.
export function renderTabs(categories, activeKey, counts = {}) {
  return categories.filter((c) => c.key === 'all' || counts[c.key] == null || counts[c.key] >= MIN_COUNT).map((c) => {
    const on = c.key === activeKey;
    return `<button type="button" role="tab" class="tab${on ? ' active' : ''}" data-key="${esc(c.key)}" aria-selected="${on}">${esc(c.label)}</button>`;
  }).join('');
}

// counts: { 지역키: 식당 수 }. 5곳 이하인 지역은 숨기고(남양주 전체는 유지), 아직 모르는 지역은 숫자 없이 보여준다.
export function renderAreaOptions(areas, activeKey, counts = {}) {
  return areas
    .filter((a) => a.key === 'all' || counts[a.key] == null || counts[a.key] >= MIN_COUNT)
    .map((a) => {
      const n = counts[a.key];
      const label = n == null ? a.label : `${a.label} (${n})`;
      return `<option value="${esc(a.key)}"${a.key === activeKey ? ' selected' : ''}>${esc(label)}</option>`;
    }).join('');
}

function renderCard(x) {
  const phone = x.phone ? `<a class="phone" href="tel:${esc(x.phone)}">${esc(x.phone)}</a>` : '';
  return `<li class="card">
  <div class="card-head"><h3>${x.rank ? `<span class="rank">추천 ${x.rank}위</span> ` : ''}${esc(x.name)}</h3><span class="walk">${esc(x.area)}</span></div>
  <div class="meta">${x.subCategory ? `<span class="sub">${esc(x.subCategory)}</span>` : ''}${phone}</div>
  <div class="links">${link(x.naverUrl, '네이버에서 보기')}${link(x.kakaoUrl, '카카오맵에서 보기')}</div>
</li>`;
}

export function renderList(list, { areaLabel = '', term = '' } = {}) {
  if (!list.length) {
    return term
      ? `<p class="notice">${esc(areaLabel)}에서 '${esc(term)}' 검색 결과가 없어요.</p>`
      : `<p class="notice">${esc(areaLabel)}에는 이 종류의 맛집 정보가 없어요.</p>`;
  }
  const scope = term ? `'${esc(term)}' 검색` : '카카오 추천순';
  return `<p class="summary">${list.length}곳 · ${esc(areaLabel)} · ${scope}</p><ul class="cards">${list.map(renderCard).join('')}</ul>`;
}

export function renderLoading() {
  return '<p class="notice">맛집 정보를 불러오는 중이에요…</p>';
}

export function renderError() {
  return '<p class="notice error">식당 정보를 불러오지 못했어요. <button type="button" id="retry" class="btn">다시 시도</button></p>';
}
