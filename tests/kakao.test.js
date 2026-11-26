import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchTop, createFetcher, buildQuery } from '../src/kakao.js';
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

test('buildQuery combines area and category', () => {
  assert.equal(buildQuery(AREAS[0], cat('korean')), '남양주 한식');
  assert.equal(buildQuery(AREAS.find(a => a.label === '별내동'), cat('all')), '별내동 맛집');
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
  assert.equal(s.calls[0].q, '별내동 카페');
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
