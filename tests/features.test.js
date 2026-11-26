import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, AREAS, HIDDEN, isVisible, visibleCategories, visibleAreas } from '../src/categories.js';
import { matchesCategory } from '../src/places-logic.js';
import { parseUrlState, buildUrlQuery } from '../src/url-state.js';
import { areaFromRegion } from '../src/nearby.js';

// ---- 1. 고정 숨김 목록 ----
test('HIDDEN only uses known areas and categories, never 전체', () => {
  for (const [areaKey, cats] of Object.entries(HIDDEN)) {
    assert.ok(AREAS.some(a => a.key === areaKey), areaKey);
    for (const c of cats) { assert.ok(CATEGORIES.some(x => x.key === c), c); assert.notEqual(c, 'all'); }
  }
});
test('isVisible follows HIDDEN; 전체 tab and 남양주 전체 always visible', () => {
  assert.equal(isVisible('조안면', 'chinese'), false);
  assert.equal(isVisible('조안면', 'korean'), true);
  assert.equal(isVisible('조안면', 'all'), true);
  assert.equal(isVisible('all', 'asian'), true);
  assert.equal(isVisible('다산동', 'asian'), true);
});
test('visibleCategories / visibleAreas', () => {
  assert.deepEqual(visibleCategories('조안면').map(c => c.key), ['all', 'korean']);
  const asianAreas = visibleAreas('asian').map(a => a.key);
  assert.ok(asianAreas.includes('all') && asianAreas.includes('다산동'));
  assert.ok(!asianAreas.includes('조안면') && !asianAreas.includes('양정동'));
});

// ---- 2. 전체 탭 제외 분류 ----
test('전체 category excludes fast food, bakery/snacks and food shops', () => {
  const all = CATEGORIES.find(c => c.key === 'all');
  assert.equal(matchesCategory('음식점 > 패스트푸드 > 버거킹', all), false);
  assert.equal(matchesCategory('음식점 > 간식 > 제과,베이커리', all), false);
  assert.equal(matchesCategory('음식점 > 식품판매', all), false);
  assert.equal(matchesCategory('음식점 > 한식 > 국밥', all), true);
  assert.equal(matchesCategory('음식점 > 중식', all), true);
});

// ---- 4. 주소로 화면 공유 ----
test('parseUrlState reads valid values and ignores unknown ones', () => {
  assert.deepEqual(parseUrlState('?area=다산동&cat=korean&q=칼국수&sort=name'),
    { area: '다산동', active: 'korean', term: '칼국수', sortBy: 'name' });
  assert.deepEqual(parseUrlState('?area=부산&cat=pizza&sort=zzz'), { area: 'all', active: 'all', term: '', sortBy: 'rank' });
  assert.deepEqual(parseUrlState(''), { area: 'all', active: 'all', term: '', sortBy: 'rank' });
});
test('parseUrlState falls back when the combination is hidden', () => {
  assert.equal(parseUrlState('?area=조안면&cat=chinese').active, 'all');
});
test('parseUrlState trims and limits search term', () => {
  assert.equal(parseUrlState('?q=' + encodeURIComponent('  냉면  ')).term, '냉면');
  assert.equal(parseUrlState('?q=' + 'ㄱ'.repeat(50)).term.length, 30);
});
test('buildUrlQuery omits defaults and round-trips', () => {
  assert.equal(buildUrlQuery({ area: 'all', active: 'all', term: '', sortBy: 'rank' }), '');
  const qs = buildUrlQuery({ area: '다산동', active: 'korean', term: '', sortBy: 'rank' });
  assert.deepEqual(parseUrlState(qs), { area: '다산동', active: 'korean', term: '', sortBy: 'rank' });
  const qs2 = buildUrlQuery({ area: 'all', active: 'all', term: '순대 국밥', sortBy: 'name' });
  assert.deepEqual(parseUrlState(qs2), { area: 'all', active: 'all', term: '순대 국밥', sortBy: 'name' });
});

// ---- 5. 내 주변 ----
test('areaFromRegion maps 카카오 행정동 to our areas', () => {
  assert.equal(areaFromRegion('경기도', '남양주시', '다산1동'), '다산동');
  assert.equal(areaFromRegion('경기도', '남양주시', '다산2동'), '다산동');
  assert.equal(areaFromRegion('경기도', '남양주시', '양정동'), '양정동');
  assert.equal(areaFromRegion('경기도', '남양주시', '화도읍'), '화도읍');
  assert.equal(areaFromRegion('경기도', '남양주시', '별내동'), '별내동');
  assert.equal(areaFromRegion('경기도', '남양주시', '없는동'), 'all');
  assert.equal(areaFromRegion('서울특별시', '종로구', '종로1.2.3.4가동'), null);
});

import { locateArea } from '../src/nearby.js';
const geo = (lng, lat) => ({ getCurrentPosition: (ok) => setTimeout(() => ok({ coords: { longitude: lng, latitude: lat } }), 0) });
const geocoder = (r2, r3) => ({ coord2RegionCode: (x, y, cb) => setTimeout(() => cb([{ region_type: 'B', region_2depth_name: r2, region_3depth_name: 'x' }, { region_type: 'H', region_1depth_name: '경기도', region_2depth_name: r2, region_3depth_name: r3 }], 'OK'), 0) });
test('locateArea resolves our area from position', async () => {
  assert.equal(await locateArea(geo(127.15, 37.62), geocoder('남양주시', '다산2동'), 'OK'), '다산동');
});
test('locateArea rejects outside 남양주 and on denied permission', async () => {
  await assert.rejects(locateArea(geo(126.98, 37.57), geocoder('종로구', '종로1.2.3.4가동'), 'OK'), /남양주 밖/);
  const denied = { getCurrentPosition: (ok, fail) => setTimeout(() => fail({ code: 1 }), 0) };
  await assert.rejects(locateArea(denied, geocoder('남양주시', '다산1동'), 'OK'), /권한/);
  await assert.rejects(locateArea(undefined, geocoder('남양주시', '다산1동'), 'OK'), /지원하지/);
});
