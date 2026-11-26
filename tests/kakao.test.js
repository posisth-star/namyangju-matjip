import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchTop, createFetcher, mergeRanked } from '../src/kakao.js';
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
  const out = await createFetcher(s, sdk)('all', 'korean');
  assert.deepEqual(out.map(x => [x.id, x.rank, x.area]), [['a', 1, '별내동'], ['b', 2, '화도읍']]);
  assert.equal(s.calls[0].q, '남양주 한식');
});

test('fetcher uses area in query and CE7 for cafe', async () => {
  const s = fakeRanked([doc('c', '경기 남양주시 별내동 1', '음식점 > 카페')]);
  await createFetcher(s, sdk)(areaKey('별내동'), 'cafe');
  assert.equal(s.calls[0].q, '남양주 별내동 카페');
  assert.equal(s.calls[0].o.category_group_code, 'CE7');
});

test('caches per area+category', async () => {
  const s = fakeRanked(ranked(3));
  const f = createFetcher(s, sdk);
  await f('all', 'korean'); await f('all', 'korean');
  assert.equal(s.calls.length, 1);
  await f(areaKey('별내동'), 'korean');
  assert.equal(s.calls.length, 2);
});

test('rejects on ERROR and retries after failure', async () => {
  let fail = true;
  const ok = fakeRanked(ranked(3));
  const s = (q, cb, o) => (fail ? setTimeout(() => cb([], 'ERR', {}), 0) : ok(q, cb, o));
  const f = createFetcher(s, sdk);
  await assert.rejects(f('all', 'korean'));
  fail = false;
  assert.equal((await f('all', 'korean')).length, 3);
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
  const out = await createFetcher(fakeRanked(docs), sdk)(areaKey('퇴계원읍'), 'korean');
  assert.deepEqual(out.map(x => [x.id, x.rank]), [['a', 1], ['c', 2]]);
});

test('multi-legal area queries each legal dong and merges', async () => {
  const byQuery = {
    '남양주 일패동 한식': [doc('i1', '경기 남양주시 일패동 1')],
    '남양주 이패동 한식': [doc('e1', '경기 남양주시 이패동 1'), doc('x', '경기 남양주시 다산동 1')],
    '남양주 삼패동 한식': [doc('s1', '경기 남양주시 삼패동 1'), doc('s2', '경기 남양주시 삼패동 2')],
  };
  const calls = [];
  const s = (q, cb, o) => { calls.push(q); setTimeout(() => cb(byQuery[q] ?? [], (byQuery[q] ?? []).length ? 'OK' : 'ZERO', { hasNextPage: false }), 0); };
  const out = await createFetcher(s, sdk)(areaKey('양정동'), 'korean');
  assert.deepEqual(calls.sort(), Object.keys(byQuery).sort());
  assert.deepEqual(out.map(x => x.id), ['i1', 'e1', 's1', 's2']);
  assert.deepEqual(out.map(x => x.rank), [1, 2, 3, 4]);
});

test('caps merged results at 45', async () => {
  const many = (p) => Array.from({ length: 45 }, (_, i) => doc(p + i, '경기 남양주시 삼패동 1'));
  const s = (q, cb, o) => setTimeout(() => cb(o.page === 1 ? many(q).slice(0, 15) : [], o.page === 1 ? 'OK' : 'ZERO', { hasNextPage: false }), 0);
  const out = await createFetcher(s, sdk)(areaKey('양정동'), 'korean');
  assert.ok(out.length <= 45);
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
