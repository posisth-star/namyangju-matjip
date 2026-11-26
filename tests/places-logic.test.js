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

test('toRestaurant maps fields (https Kakao link, road-name Naver link)', () => {
  const x = toRestaurant({ id: '1', place_name: '목향원', category_name: '음식점 > 한식 > 한정식', address_name: '경기 남양주시 별내동 1', road_address_name: '경기 남양주시 별내면 용암비선길 39', phone: '031-1', place_url: 'http://place.map.kakao.com/1' });
  assert.equal(x.subCategory, '한정식');
  assert.equal(x.area, '별내동');
  assert.equal(x.phone, '031-1');
  assert.equal(x.kakaoUrl, 'https://place.map.kakao.com/1');
  assert.equal(x.naverUrl, NAVER + encodeURIComponent('목향원 남양주 용암비선길'));
});

test('toRestaurant shows the 행정동 we list (일패동 → 양정동, 수석동 → 다산동)', () => {
  assert.equal(toRestaurant({ id: '1', place_name: 'A', category_name: '음식점 > 한식', address_name: '경기 남양주시 일패동 1' }).area, '양정동');
  assert.equal(toRestaurant({ id: '2', place_name: 'B', category_name: '음식점 > 한식', address_name: '경기 남양주시 수석동 1' }).area, '다산동');
  assert.equal(toRestaurant({ id: '3', place_name: 'C', category_name: '음식점 > 한식', address_name: '경기 남양주시 화도읍 마석우리 1' }).area, '화도읍');
});

test('naverSearchUrl uses road name, falls back to area', () => {
  assert.equal(naverSearchUrl('목향원', { road: '용암비선길', area: '별내동' }), NAVER + encodeURIComponent('목향원 남양주 용암비선길'));
  assert.equal(naverSearchUrl('목향원', { road: '', area: '별내동' }), NAVER + encodeURIComponent('목향원 남양주 별내동'));
});

test('naverSearchUrl encodes', () => {
  const path = naverSearchUrl('A&B <#1>', {}).slice(NAVER.length);
  for (const ch of ['&', '#', ' ', '<']) assert.ok(!path.includes(ch), ch);
});

test('matchesCategory', () => {
  assert.equal(matchesCategory('음식점 > 한식 > 국수', { match: '한식' }), true);
  assert.equal(matchesCategory('음식점 > 중식', { match: '한식' }), false);
  assert.equal(matchesCategory('음식점 > 분식', { match: null }), true);
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

import { isChain, roadOf } from '../src/places-logic.js';
test('roadOf picks the road name from 도로명 주소', () => {
  assert.equal(roadOf('경기 남양주시 다산중앙로 123'), '다산중앙로');
  assert.equal(roadOf('경기 남양주시 화도읍 경춘로 1234'), '경춘로');
  assert.equal(roadOf(''), '');
});
test('isChain recognises common franchises', () => {
  for (const n of ['피자스쿨 다산점', '동대문엽기떡볶이 별내점', '김밥천국', '김밥나라 호평점', '도미노피자 남양주점', '맘스터치 다산점', '탕화쿵푸마라탕 별내점', '청년다방 진접점'])
    assert.equal(isChain(n), true, n);
  for (const n of ['목향원', '황해칼국수', '북한강막국수닭갈비', '소리소시골밥상']) assert.equal(isChain(n), false, n);
});
