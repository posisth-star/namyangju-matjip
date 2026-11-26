import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, AREAS, CITY } from '../src/categories.js';

test('category order and codes', () => {
  assert.deepEqual(CATEGORIES.map(c => c.label), ['전체', '한식', '중식', '일식', '양식', '분식', '아시아음식']);
  for (const c of CATEGORIES) {
    if (c.key === 'all') { assert.equal(c.groupCode, 'FD6'); assert.equal(c.match, null); assert.deepEqual(c.queries, ['맛집', '']); }
    else { assert.equal(c.groupCode, 'FD6'); assert.equal(c.match, c.label); assert.deepEqual(c.queries, [c.label]); }
  }
});

test('areas: 남양주 전체 + 16 읍면동, unique keys', () => {
  assert.equal(CITY, '남양주');
  assert.equal(AREAS[0].key, 'all');
  assert.deepEqual(AREAS[0].queries, ['남양주']);
  assert.equal(AREAS[0].legal, null);
  assert.equal(AREAS.length, 16);
  assert.equal(new Set(AREAS.map(a => a.key)).size, AREAS.length);
  for (const name of ['와부읍', '진접읍', '화도읍', '진건읍', '오남읍', '퇴계원읍', '별내면', '수동면', '조안면', '호평동', '평내동', '금곡동', '양정동', '별내동', '다산동'])
    assert.ok(AREAS.some(a => a.label === name), name);
});

test('areas search with 남양주 prefix and list legal dong names', () => {
  const by = (l) => AREAS.find(a => a.label === l);
  assert.deepEqual(by('금곡동').queries, ['남양주 금곡동']);
  assert.deepEqual(by('금곡동').legal, ['금곡동']);
  assert.deepEqual(by('양정동').legal, ['일패동', '이패동', '삼패동']);
  assert.deepEqual(by('양정동').queries, ['남양주 일패동', '남양주 이패동', '남양주 삼패동']);
  assert.deepEqual(by('다산동').legal, ['다산동', '수석동']);
  for (const a of AREAS.slice(1)) for (const q of a.queries) assert.ok(q.startsWith('남양주 '), q);
});
