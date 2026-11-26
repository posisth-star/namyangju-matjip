import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchTop, createFetcher, mergeRanked } from '../src/kakao.js';
import * as kakao from '../src/kakao.js';
import { CATEGORIES, AREAS } from '../src/categories.js';

const sdk = { sortAccuracy: 'ACC', Status: { OK: 'OK', ZERO_RESULT: 'ZERO', ERROR: 'ERR' } };
const doc = (id, addr = '경기 남양주시 별내동 1', cat = '음식점 > 한식 > 국수') =>
  ({ id: String(id), place_name: 'P' + id, category_name: cat, address_name: addr, phone: '', place_url: 'u' + id });

// 카카오처럼 순서대로 최대 45건을 15건씩 돌려주는 가짜 keywordSearch
function fakeRanked(docs, { status } = {}) {
  const calls = [];
  const fn = (q, cb, o) => {
    calls.push({ q, o });
    setTimeout(() => {
      if (status) return cb([], status, {});
      const visible = docs.slice(0, 45), page = visible.slice((o.page - 1) * 15, o.page * 15);
      if (!page.length) return cb([], 'ZERO', { totalCount: 0, hasNextPage: false });
      cb(page, 'OK', { totalCount: visible.length, hasNextPage: o.page * 15 < visible.length });
    }, 0);
  };
  fn.calls = calls;
  return fn;
}
const ranked = (n) => Array.from({ length: n }, (_, i) => doc('r' + i));
const areaKey = (label) => AREAS.find(a => a.label === label).key;
const cat = (k) => CATEGORIES.find(c => c.key === k);

test('mergeRanked interleaves lists in rank order', () => {
  assert.deepEqual(mergeRanked([['a1', 'a2', 'a3'], ['b1'], ['c1', 'c2']]), ['a1', 'b1', 'c1', 'a2', 'c2', 'a3']);
});

test('searchTop: accuracy order, no location/bounds, 3 pages', async () => {
  const s = fakeRanked(ranked(60));
  const docs = await searchTop(s, '남양주 한식', 'FD6', sdk);
  assert.equal(docs.length, 45);
  assert.equal(s.calls.length, 3);
  assert.deepEqual(s.calls[0].o, { category_group_code: 'FD6', sort: 'ACC', size: 15, page: 1 });
  assert.equal(s.calls[0].q, '남양주 한식');
  assert.equal(docs[44].id, 'r44');
});

test('ZERO_RESULT → empty', async () => {
  assert.deepEqual(await searchTop(fakeRanked([]), 'q', 'FD6', sdk), []);
});

test('fetcher keeps only 남양주 addresses and category, ranks in order', async () => {
  const docs = [doc('a'), doc('x', '서울 노원구 상계동 1'), doc('y', '경기 남양주시 다산동 1', '음식점 > 중식'), doc('b', '경기 남양주시 화도읍 1'), doc('a')];
  const s = fakeRanked(docs);
  const out = await createFetcher(s, sdk)('all', 'noodle');
  assert.deepEqual(out.map(x => [x.id, x.rank, x.area]), [['a', 1, '별내동'], ['b', 2, '화도읍']]);
  assert.deepEqual(s.calls.filter(c => c.o.page === 1).map(c => c.q), ['남양주 막국수', '남양주 칼국수', '남양주 냉면']);
});

test('fetcher uses area in query', async () => {
  const s = fakeRanked([doc('c', '경기 남양주시 별내동 1', '음식점 > 중식')]);
  await createFetcher(s, sdk)(areaKey('별내동'), 'chinese');
  assert.equal(s.calls[0].q, '남양주 별내동 중식');
  assert.equal(s.calls[0].o.category_group_code, 'FD6');
});

test('caches per area+category', async () => {
  const s = fakeRanked(ranked(3));
  const f = createFetcher(s, sdk);
  await f('all', 'noodle'); const n = s.calls.length; await f('all', 'noodle');
  assert.equal(s.calls.length, n);
  await f(areaKey('별내동'), 'noodle');
  assert.equal(s.calls.length, n * 2);
});

test('rejects on ERROR and retries after failure', async () => {
  let fail = true;
  const ok = fakeRanked(ranked(3));
  const s = (q, cb, o) => (fail ? setTimeout(() => cb([], 'ERR', {}), 0) : ok(q, cb, o));
  const f = createFetcher(s, sdk);
  await assert.rejects(f('all', 'noodle'));
  fail = false;
  assert.equal((await f('all', 'noodle')).length, 3);
});

test('times out when callback never comes', async () => {
  await assert.rejects(searchTop(() => {}, 'q', 'FD6', sdk, 20), /시간 초과/);
});

test('rejects when keywordSearch throws on a later page', async () => {
  let n = 0;
  const s = (q, cb) => { if (++n === 2) throw new Error('boom'); setTimeout(() => cb(ranked(15), 'OK', { hasNextPage: true }), 0); };
  await assert.rejects(searchTop(s, 'q', 'FD6', sdk, 1000), /boom/);
});

test('area mode keeps only addresses in that area (drops neighbours)', async () => {
  const docs = [doc('a', '경기 남양주시 퇴계원읍 퇴계원리 1'), doc('b', '경기 남양주시 별내동 1'), doc('c', '경기 남양주시 퇴계원읍 2')];
  const out = await createFetcher(fakeRanked(docs), sdk)(areaKey('퇴계원읍'), 'noodle');
  assert.deepEqual(out.map(x => [x.id, x.rank]), [['a', 1], ['c', 2]]);
});

test('multi-legal area (양정동) searches its box once per word, then keeps only its 법정동', async () => {
  const calls = [];
  const s = (q, cb, o) => { calls.push({ q, o }); const d = q === '막국수' ? [doc('i1', '경기 남양주시 일패동 1'), doc('x', '경기 남양주시 금곡동 1'), doc('s1', '경기 남양주시 삼패동 1')] : []; setTimeout(() => cb(d, d.length ? 'OK' : 'ZERO', { hasNextPage: false }), 0); };
  const out = await createFetcher(s, sdk)(areaKey('양정동'), 'noodle');
  assert.deepEqual(calls.map(c => c.q), ['막국수', '칼국수', '냉면']);
  assert.ok(calls.every(c => c.o.bounds && c.o.bounds.sw && c.o.bounds.ne));
  assert.deepEqual(out.map(x => x.id), ['i1', 's1']);
});

test('menu tab first view fills to 30 places, then more() loads the next page and appends', async () => {
  // 검색어 3개가 같은 식당을 돌려줘서 1페이지는 15곳 → 30곳이 찰 때까지 2페이지까지 받는다
  const s = fakeRanked(ranked(40));
  const f = createFetcher(s, sdk);
  const first = await f(areaKey('별내동'), 'noodle');
  assert.equal(s.calls.length, 6);
  assert.equal(first.length, 30);
  assert.equal(first.hasMore, true);
  assert.equal(first.pages, 2);
  const again = await f(areaKey('별내동'), 'noodle', { pages: 2 });
  assert.equal(s.calls.length, 6); // 이미 받은 페이지는 다시 부르지 않는다
  assert.deepEqual(again.map(x => x.id), first.map(x => x.id));
  const last = await f(areaKey('별내동'), 'noodle', { pages: 3 });
  assert.equal(last.length, 40);
  assert.equal(last.hasMore, false);
});

test('전체 category searches both "맛집" and plain area name, merged', async () => {
  const byQuery = {
    '남양주 호평동 맛집': [doc('m1', '경기 남양주시 호평동 1')],
    '남양주 호평동': [doc('p1', '경기 남양주시 호평동 2'), doc('m1', '경기 남양주시 호평동 1')],
  };
  const calls = [];
  const s = (q, cb) => { calls.push(q); setTimeout(() => cb(byQuery[q] ?? [], (byQuery[q] ?? []).length ? 'OK' : 'ZERO', { hasNextPage: false }), 0); };
  const out = await createFetcher(s, sdk)(areaKey('호평동'), 'all');
  assert.deepEqual(calls.sort(), Object.keys(byQuery).sort());
  assert.deepEqual(out.map(x => x.id), ['m1', 'p1']);
});

// 검색어별 결과를 정해 두는 가짜 keywordSearch
function byQueryFake(byQuery) {
  const calls = [];
  const fn = (q, cb, o) => { calls.push({ q, o }); const d = byQuery[q] ?? []; setTimeout(() => cb(d, d.length ? 'OK' : 'ZERO', { hasNextPage: false }), 0); };
  fn.calls = calls;
  return fn;
}

test('category tabs hide franchises; the search feature no longer exists', async () => {
  const s = fakeRanked([{ ...doc('c'), place_name: '피자스쿨 별내점', category_name: '음식점 > 양식 > 피자' }, { ...doc('l'), place_name: '로컬피자', category_name: '음식점 > 양식 > 피자' }]);
  const out = await createFetcher(s, sdk)('all', 'western');
  assert.deepEqual(out.map(x => x.name), ['로컬피자']);
  assert.equal(kakao.createSearcher, undefined);
});

test('menu tab first view costs one call per search word when page 1 already has 30+ places', async () => {
  // 검색어 3개가 서로 다른 식당 15곳씩 → 1페이지에 45곳, 더 받지 않고 자르지도 않는다
  const byQ = { '남양주 막국수': distinct('a', 45), '남양주 칼국수': distinct('b', 45), '남양주 냉면': distinct('c', 45) };
  const calls = [];
  const s = (q, cb, o) => { calls.push(q); const all = byQ[q] ?? [], page = all.slice((o.page - 1) * 15, o.page * 15); setTimeout(() => cb(page, page.length ? 'OK' : 'ZERO', { hasNextPage: o.page * 15 < all.length }), 0); };
  const out = await createFetcher(s, sdk)('all', 'noodle');
  assert.equal(calls.length, 3);
  assert.equal(out.length, 45);
  assert.equal(out.hasMore, true);
});

test('추천 tab in a multi-legal area still searches by 법정동 names (box search is weak for generic words)', async () => {
  const calls = [];
  const s = (q, cb, o) => { calls.push({ q, o }); setTimeout(() => cb([], 'ZERO', { hasNextPage: false }), 0); };
  await createFetcher(s, sdk)(areaKey('양정동'), 'all');
  assert.ok(calls.every(c => !c.o.bounds));
  assert.deepEqual(calls.map(c => c.q).sort(), ['일패동', '이패동', '삼패동'].flatMap(l => [`남양주 ${l} 맛집`, `남양주 ${l}`]).sort());
});

// ---- 추천 탭: 첫 화면에 45곳이 차도록 페이지를 더 받는다 ----
const distinct = (prefix, n, area = '별내동') => Array.from({ length: n }, (_, i) => doc(prefix + i, `경기 남양주시 ${area} ${i}`));

test('추천 first view keeps loading pages until 45 places, then shows exactly 45', async () => {
  // 검색어 2개가 서로 다른 식당을 45곳씩: 1페이지 30곳 → 2페이지 60곳이면 멈추고 45곳만 보여준다
  const byQ = { '남양주 맛집': distinct('a', 45), '남양주': distinct('b', 45) };
  const calls = [];
  const s = (q, cb, o) => {
    calls.push({ q, page: o.page });
    const all = byQ[q] ?? [], page = all.slice((o.page - 1) * 15, o.page * 15);
    setTimeout(() => cb(page, page.length ? 'OK' : 'ZERO', { hasNextPage: o.page * 15 < all.length }), 0);
  };
  const f = createFetcher(s, sdk);
  const first = await f('all', 'all');
  assert.equal(calls.length, 4); // 2페이지까지만
  assert.equal(first.length, 45);
  assert.deepEqual(first.map(x => x.rank), Array.from({ length: 45 }, (_, i) => i + 1));
  assert.equal(first.hasMore, true);
  assert.equal(first.pages, 2);
  // 더 보기: 다음(3) 페이지를 받아 전부 보여준다
  const more = await f('all', 'all', { pages: first.pages + 1 });
  assert.equal(calls.length, 6);
  assert.equal(more.length, 90);
  assert.equal(more.hasMore, false);
});

test('추천 first view stops at the last page when an area has fewer than 45 places', async () => {
  const s = fakeRanked(distinct('x', 20));
  const out = await createFetcher(s, sdk)(areaKey('별내동'), 'all');
  assert.equal(out.length, 20);
  assert.equal(out.hasMore, false);
  assert.equal(s.calls.length, 4); // 검색어 2개 × 2페이지(2페이지에서 끝)
});

test('one-word menu tab (중식) fills to 30 with 2 pages', async () => {
  const s = fakeRanked(distinct('z', 45).map(d => ({ ...d, category_name: '음식점 > 중식 > 중국요리' })));
  const out = await createFetcher(s, sdk)('all', 'chinese');
  assert.equal(s.calls.length, 2);
  assert.equal(out.length, 30);
  assert.equal(out.hasMore, true);
});
