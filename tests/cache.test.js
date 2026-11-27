import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachedSearch, CACHE_TTL_MS } from '../src/cache.js';

const Status = { OK: 'OK', ZERO_RESULT: 'ZERO', ERROR: 'ERR' };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const doc = { id: '1', place_name: 'P', category_name: '음식점 > 한식', address_name: '경기 남양주시 별내동 1', road_address_name: '경기 남양주시 별내로 1', phone: '031', place_url: 'u', x: '127', y: '37', distance: '' };
const call = (search, q, o) => new Promise((res) => search(q, (r, st, pg) => res({ r, st, pg }), o));

function fakeKakao(status = 'OK') {
  const calls = [];
  const fn = (q, cb, o) => { calls.push({ q, o }); setTimeout(() => cb(status === 'OK' ? [doc] : [], status, { hasNextPage: true }), 0); };
  fn.calls = calls;
  return fn;
}

test('cache keeps results for 1 hour', () => assert.equal(CACHE_TTL_MS, 60 * 60 * 1000));

test('same query+options within the TTL is answered from the cache without calling Kakao', async () => {
  const k = fakeKakao(), storage = memStorage();
  let t = 0;
  const s = cachedSearch(k, { storage, Status, now: () => t });
  const o = { category_group_code: 'FD6', page: 1, size: 15 };
  const a = await call(s, '남양주 맛집', o);
  t = CACHE_TTL_MS - 1;
  const b = await call(cachedSearch(k, { storage, Status, now: () => t }), '남양주 맛집', o); // 새로고침해도(같은 탭 저장소) 재사용
  assert.equal(k.calls.length, 1);
  assert.equal(b.st, 'OK');
  assert.deepEqual(b.r.map((d) => d.place_name), ['P']);
  assert.equal(b.pg.hasNextPage, true);
  assert.equal(a.r[0].id, '1');
});

test('different page or options, or an expired entry, calls Kakao again', async () => {
  const k = fakeKakao(), storage = memStorage();
  let t = 0;
  const s = cachedSearch(k, { storage, Status, now: () => t });
  await call(s, 'q', { page: 1 });
  await call(s, 'q', { page: 2 });
  await call(s, 'q', { page: 1, bounds: { sw: 1 } });
  t = CACHE_TTL_MS + 1;
  await call(s, 'q', { page: 1 });
  assert.equal(k.calls.length, 4);
});

test('errors are not cached; ZERO_RESULT is', async () => {
  const err = fakeKakao('ERR'), storage = memStorage();
  const s = cachedSearch(err, { storage, Status, now: () => 0 });
  await call(s, 'q', { page: 1 }); await call(s, 'q', { page: 1 });
  assert.equal(err.calls.length, 2);
  const zero = fakeKakao('ZERO');
  const z = cachedSearch(zero, { storage: memStorage(), Status, now: () => 0 });
  await call(z, 'q', { page: 1 }); const again = await call(z, 'q', { page: 1 });
  assert.equal(zero.calls.length, 1);
  assert.equal(again.st, 'ZERO');
});

test('only the fields the app uses are stored, and a blocked/full storage just skips caching', async () => {
  const storage = memStorage();
  await call(cachedSearch(fakeKakao(), { storage, Status, now: () => 0 }), 'q', { page: 1 });
  const saved = [...storage.m.values()].join('');
  assert.ok(!saved.includes('"x"') && !saved.includes('"y"'));
  const blocked = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('full'); } };
  const k = fakeKakao();
  const r = await call(cachedSearch(k, { storage: blocked, Status, now: () => 0 }), 'q', { page: 1 });
  assert.equal(r.st, 'OK');
  assert.equal(k.calls.length, 1);
});

test('a throwing search (e.g. daily limit) still throws through the cache wrapper', () => {
  const s = cachedSearch(() => { throw new Error('limit'); }, { storage: memStorage(), Status, now: () => 0 });
  assert.throws(() => s('q', () => {}, { page: 1 }), /limit/);
});
