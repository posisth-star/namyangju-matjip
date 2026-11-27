import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQuota, guardSearch, QuotaError, DAILY_LIMIT } from '../src/quota.js';

const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const at = (iso) => () => new Date(iso);

test('daily limit is 100 calls per browser', () => assert.equal(DAILY_LIMIT, 100));

test('allows up to the limit, then refuses', () => {
  const q = createQuota({ storage: memStorage(), limit: 3, now: at('2026-11-27T10:00:00+09:00') });
  assert.deepEqual([q.take(), q.take(), q.take(), q.take()], [true, true, true, false]);
});

test('count survives a reload (same storage) and resets the next day', () => {
  const storage = memStorage();
  createQuota({ storage, limit: 2, now: at('2026-11-27T10:00:00+09:00') }).take();
  createQuota({ storage, limit: 2, now: at('2026-11-27T11:00:00+09:00') }).take();
  assert.equal(createQuota({ storage, limit: 2, now: at('2026-11-27T23:00:00+09:00') }).take(), false);
  assert.equal(createQuota({ storage, limit: 2, now: at('2026-11-28T08:00:00+09:00') }).take(), true);
});

test('broken or blocked storage still limits within the page', () => {
  const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const q = createQuota({ storage, limit: 2, now: at('2026-11-27T10:00:00+09:00') });
  assert.deepEqual([q.take(), q.take(), q.take()], [true, true, false]);
  const junk = memStorage(); junk.setItem('namyangju-matjip-quota', '{not json');
  assert.equal(createQuota({ storage: junk, limit: 1, now: at('2026-11-27T10:00:00+09:00') }).take(), true);
});

test('guardSearch counts each Kakao call and throws QuotaError once the limit is used up', () => {
  const calls = [];
  const search = guardSearch((q) => calls.push(q), createQuota({ storage: memStorage(), limit: 2, now: at('2026-11-27T10:00:00+09:00') }));
  search('a'); search('b');
  assert.throws(() => search('c'), QuotaError);
  assert.deepEqual(calls, ['a', 'b']);
});

test('remaining() reports what is left today without using any', () => {
  const q = createQuota({ storage: memStorage(), limit: 3, now: at('2026-11-27T10:00:00+09:00') });
  assert.equal(q.remaining(), 3);
  q.take();
  assert.equal(q.remaining(), 2);
  assert.equal(q.remaining(), 2);
});
