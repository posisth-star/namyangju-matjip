import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTabs, renderList, renderLoading, renderError, renderAreaOptions } from '../src/ui.js';
import { CATEGORIES, AREAS } from '../src/categories.js';

const r = (o) => ({ id: '1', name: '목향원', subCategory: '한정식', area: '별내동', phone: '031-123-4567', rank: 1,
  kakaoUrl: 'http://place.map.kakao.com/1', naverUrl: 'https://map.naver.com/p/search/x', ...o });

test('card fields and links', () => {
  const html = renderList([r()], { areaLabel: '남양주 전체' });
  for (const s of ['목향원', '한정식', '별내동', '031-123-4567', '추천 1위', '네이버에서 보기', '카카오맵에서 보기']) assert.ok(html.includes(s), s);
  assert.equal(html.match(/target="_blank" rel="noopener"/g).length, 2);
  assert.ok(!html.includes('도보'));
});
test('summary', () => assert.ok(renderList([r(), r({ id: '2' })], { areaLabel: '별내동' }).includes('2곳 · 별내동 · 카카오 추천순')));
test('escapes name', () => assert.ok(renderList([r({ name: '<b>&</b>' })], {}).includes('&lt;b&gt;&amp;&lt;/b&gt;')));
test('empty', () => assert.ok(renderList([], { areaLabel: '수동면' }).includes('수동면에는 이 종류의 맛집 정보가 없어요.')));
test('error has retry', () => assert.ok(renderError().includes('id="retry"')));
test('loading', () => assert.ok(renderLoading().includes('불러오는 중')));
test('tabs active', () => assert.equal(renderTabs(CATEGORIES, 'korean').match(/aria-selected="true"/g).length, 1));
test('area options', () => {
  const html = renderAreaOptions(AREAS, 'all');
  assert.equal(html.match(/<option/g).length, AREAS.length);
  assert.ok(html.includes('남양주 전체'));
});

test('area options hide areas with 5 or fewer results and show counts', () => {
  const counts = { all: 45, '조안면': 0, '수동면': 5, '와부읍': 6, '별내동': 38 };
  const html = renderAreaOptions(AREAS, 'all', counts);
  assert.ok(!html.includes('조안면'));
  assert.ok(html.includes('별내동 (38)'));
  assert.ok(html.includes('남양주 전체 (45)'));
  assert.ok(!html.includes('수동면'));
  assert.ok(html.includes('와부읍 (6)'));
  assert.ok(html.includes('진접읍')); // 아직 모르는 지역은 숫자 없이 표시
});

test('tabs hide categories with 5 or fewer results; 전체 and unknown stay', () => {
  const html = renderTabs(CATEGORIES, 'all', { all: 3, korean: 45, chinese: 5, japanese: 6 });
  assert.ok(html.includes('data-key="all"'));
  assert.ok(html.includes('data-key="korean"'));
  assert.ok(!html.includes('data-key="chinese"'));
  assert.ok(html.includes('data-key="japanese"'));
  assert.ok(html.includes('data-key="cafe"'));
});
