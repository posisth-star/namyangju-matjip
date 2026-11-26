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



test('search summary and empty message', () => {
  assert.ok(renderList([r()], { areaLabel: '다산동', term: '칼국수' }).includes("1곳 · 다산동 · '칼국수' 검색"));
  assert.ok(renderList([], { areaLabel: '다산동', term: '칼국수' }).includes("다산동에서 '칼국수' 검색 결과가 없어요."));
  assert.ok(renderList([], { areaLabel: 'x', term: '<b>' }).includes('&lt;b&gt;'));
});
test('tabs: no active tab during search', () => {
  assert.equal((renderTabs(CATEGORIES, null).match(/aria-selected="true"/g) || []).length, 0);
});
