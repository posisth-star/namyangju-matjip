import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTabs, renderList, renderLoading, renderError, renderAreaOptions, renderQuotaNotice } from '../src/ui.js';
import { CATEGORIES, AREAS } from '../src/categories.js';

const r = (o) => ({ id: '1', name: '목향원', subCategory: '한정식', area: '별내동', phone: '031-123-4567', rank: 1,
  kakaoUrl: 'http://place.map.kakao.com/1', naverUrl: 'https://map.naver.com/p/search/x', ...o });

test('card fields and links', () => {
  const html = renderList([r()], { areaLabel: '남양주 전체' });
  for (const s of ['목향원', '한정식', '별내동', '031-123-4567', '<span class="rank">1</span>', '네이버에서 보기', '카카오맵에서 보기']) assert.ok(html.includes(s), s);
  assert.equal(html.match(/target="_blank" rel="noopener"/g).length, 2);
  assert.ok(!html.includes('도보'));
});
test('summary', () => assert.ok(renderList([r(), r({ id: '2' })], { areaLabel: '별내동' }).includes('2곳 · 별내동 · 카카오 추천순')));
test('summary follows the chosen sort (이름순)', () => {
  const html = renderList([r(), r({ id: '2' })], { areaLabel: '별내동', sortBy: 'name' });
  assert.ok(html.includes('2곳 · 별내동 · 이름순'), html);
  assert.ok(!html.includes('카카오 추천순'));
  assert.ok(renderList([r()], { areaLabel: '별내동', sortBy: 'rank' }).includes('카카오 추천순'));
});
test('escapes name', () => assert.ok(renderList([r({ name: '<b>&</b>' })], {}).includes('&lt;b&gt;&amp;&lt;/b&gt;')));
test('empty', () => assert.ok(renderList([], { areaLabel: '수동면' }).includes('수동면에는 이 종류의 맛집 정보가 없어요.')));
test('error has retry', () => assert.ok(renderError().includes('id="retry"')));
test('loading', () => assert.ok(renderLoading().includes('불러오는 중')));
test('tabs active', () => assert.equal(renderTabs(CATEGORIES, 'soup').match(/aria-selected="true"/g).length, 1));
test('area options', () => {
  const html = renderAreaOptions(AREAS, 'all');
  assert.equal(html.match(/<option/g).length, AREAS.length);
  assert.ok(html.includes('남양주 전체'));
});
test('area options: 전체 first, the rest in Korean alphabetical order', () => {
  const labels = [...renderAreaOptions(AREAS, 'all').matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map((m) => m[1]);
  assert.equal(labels[0], '남양주 전체');
  const named = labels.slice(1);
  assert.deepEqual(named, [...named].sort((a, b) => a.localeCompare(b, 'ko')));
  assert.equal(named[0], '금곡동');
  assert.ok(named.includes('화도읍'));
});




test('card shows the road name next to the area', () => {
  const html = renderList([r({ road: '다산중앙로' })], { areaLabel: '다산동' });
  assert.ok(html.includes('📍 다산중앙로'));
  assert.ok(!renderList([r({ road: '' })], {}).includes('📍'));
});

test('error message mentions heavy usage and retry', () => {
  const html = renderError();
  assert.ok(html.includes('이용자가 많') && html.includes('id="retry"'));
});
test('list shows a 더 보기 button only when more results exist', () => {
  const list = [r()]; list.hasMore = true;
  assert.ok(renderList(list, { areaLabel: '다산동' }).includes('id="more"'));
  assert.ok(!renderList([r()], { areaLabel: '다산동' }).includes('id="more"'));
});

test('search UI is gone from the list text', () => {
  assert.ok(!renderList([], { areaLabel: '다산동' }).includes('검색'));
});

test('quota notice tells the visitor to come back tomorrow, with no retry button', () => {
  const html = renderQuotaNotice(100);
  assert.ok(html.includes('하루 100회'));
  assert.ok(html.includes('내일'));
  assert.ok(!html.includes('id="retry"'));
});

test('rank badge is a plain number, not "추천 N위" (Kakao order is not a popularity ranking)', () => {
  const html = renderList([r({ rank: 7 })], { areaLabel: '별내동' });
  assert.ok(html.includes('<span class="rank">7</span>'));
  assert.ok(!html.includes('위</span>'));
});

test('shows how many lookups are left only when 20 or fewer remain', () => {
  assert.ok(renderList([r()], { areaLabel: '별내동', remaining: 15 }).includes('오늘 이 브라우저에서 15회 더 조회할 수 있어요'));
  assert.ok(!renderList([r()], { areaLabel: '별내동', remaining: 21 }).includes('더 조회할 수 있어요'));
  assert.ok(!renderList([r()], { areaLabel: '별내동' }).includes('더 조회할 수 있어요'));
});
