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
  const [areaKey, cats] = Object.entries(HIDDEN)[0];
  assert.equal(isVisible(areaKey, cats[0]), false);
  assert.equal(isVisible(areaKey, 'all'), true);
  assert.equal(isVisible('all', cats[0]), true);
});
test('visibleCategories / visibleAreas', () => {
  const [areaKey, cats] = Object.entries(HIDDEN)[0];
  assert.ok(!visibleCategories(areaKey).some(c => cats.includes(c.key)));
  assert.ok(visibleCategories(areaKey).some(c => c.key === 'all'));
  assert.ok(!visibleAreas(cats[0]).some(a => a.key === areaKey));
  assert.ok(visibleAreas(cats[0]).some(a => a.key === 'all'));
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
  assert.deepEqual(parseUrlState('?area=다산동&cat=soup&sort=name'), { area: '다산동', active: 'soup', sortBy: 'name' });
  assert.deepEqual(parseUrlState('?area=부산&cat=pizza&sort=zzz'), { area: 'all', active: 'all', sortBy: 'rank' });
  assert.deepEqual(parseUrlState(''), { area: 'all', active: 'all', sortBy: 'rank' });
  assert.deepEqual(parseUrlState('?q=칼국수&cat=soup'), { area: 'all', active: 'soup', sortBy: 'rank' }); // 예전 검색 링크는 검색어를 무시
});
test('parseUrlState falls back when the combination is hidden', () => {
  const [areaKey, cats] = Object.entries(HIDDEN)[0];
  assert.equal(parseUrlState(`?area=${encodeURIComponent(areaKey)}&cat=${cats[0]}`).active, 'all');
});
test('buildUrlQuery omits defaults and round-trips', () => {
  assert.equal(buildUrlQuery({ area: 'all', active: 'all', sortBy: 'rank' }), '');
  const qs = buildUrlQuery({ area: '다산동', active: 'soup', sortBy: 'rank' });
  assert.deepEqual(parseUrlState(qs), { area: '다산동', active: 'soup', sortBy: 'rank' });
  const qs2 = buildUrlQuery({ area: 'all', active: 'all', sortBy: 'name' });
  assert.deepEqual(parseUrlState(qs2), { area: 'all', active: 'all', sortBy: 'name' });
  assert.ok(!buildUrlQuery({ area: 'all', active: 'soup', sortBy: 'rank', term: 'x' }).includes('q='));
});


// ---- 점심 기준: 술집 제외 ----
test('bars are excluded from every category', () => {
  for (const c of CATEGORIES) assert.equal(matchesCategory('음식점 > 술집 > 호프,요리주점', c), false, c.key);
});
