import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, AREAS, HIDDEN, isVisible, visibleCategories, visibleAreas } from '../src/categories.js';
import { matchesCategory } from '../src/places-logic.js';
import { parseUrlState, buildUrlQuery } from '../src/url-state.js';

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


// ---- 점심 기준: 술집 제외 ----
test('bars are excluded from every category', () => {
  for (const c of CATEGORIES) assert.equal(matchesCategory('음식점 > 술집 > 호프,요리주점', c), false, c.key);
});
