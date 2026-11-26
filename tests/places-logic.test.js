import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRestaurant, naverSearchUrl, matchesCategory, sortRestaurants, dedupeById, areaOf } from '../src/places-logic.js';

const NAVER = 'https://map.naver.com/p/search/';
const r = (o) => ({ id: '1', name: 'A', subCategory: '', area: '', phone: '', kakaoUrl: '', naverUrl: '', ...o });

test('areaOf picks 읍면동 from address', () => {
  assert.equal(areaOf('경기 남양주시 별내동 123-4'), '별내동');
  assert.equal(areaOf('경기 남양주시 화도읍 마석우리 1'), '화도읍');
  assert.equal(areaOf(''), '');
});

test('toRestaurant maps fields', () => {
  const x = toRestaurant({ id: '1', place_name: '목향원', category_name: '음식점 > 한식 > 한정식', address_name: '경기 남양주시 별내동 1', phone: '031-1', place_url: 'http://place.map.kakao.com/1' });
  assert.equal(x.subCategory, '한정식');
  assert.equal(x.area, '별내동');
  assert.equal(x.phone, '031-1');
  assert.equal(x.kakaoUrl, 'http://place.map.kakao.com/1');
  assert.equal(x.naverUrl, naverSearchUrl('목향원', '별내동'));
});

test('naverSearchUrl adds 남양주 and area', () =>
  assert.equal(naverSearchUrl('목향원', '별내동'), NAVER + encodeURIComponent('목향원 남양주 별내동')));

test('naverSearchUrl encodes', () => {
  const path = naverSearchUrl('A&B <#1>', '').slice(NAVER.length);
  for (const ch of ['&', '#', ' ', '<']) assert.ok(!path.includes(ch), ch);
});

test('matchesCategory', () => {
  assert.equal(matchesCategory('음식점 > 한식 > 국수', { match: '한식' }), true);
  assert.equal(matchesCategory('음식점 > 중식', { match: '한식' }), false);
  assert.equal(matchesCategory('음식점 > 카페', { match: null }), true);
});

test('sort rank and name', () => {
  const list = [r({ id: 'a', name: '다', rank: 2 }), r({ id: 'b', name: '가', rank: 3 }), r({ id: 'c', name: '나', rank: 1 })];
  assert.deepEqual(sortRestaurants(list, 'rank').map(x => x.id), ['c', 'a', 'b']);
  assert.deepEqual(sortRestaurants(list, 'name').map(x => x.id), ['b', 'c', 'a']);
  assert.deepEqual(list.map(x => x.id), ['a', 'b', 'c']);
});

test('dedupeById keeps first', () => {
  assert.deepEqual(dedupeById([r({ id: 'x', name: '첫' }), r({ id: 'x' }), r({ id: 'y' })]).map(x => x.name), ['첫', 'A']);
});
