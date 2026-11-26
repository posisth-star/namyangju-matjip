import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, AREAS, CITY } from '../src/categories.js';

test('category order and codes', () => {
  assert.deepEqual(CATEGORIES.map(c => c.label), ['전체', '한식', '중식', '일식', '양식', '분식', '아시아음식', '카페']);
  for (const c of CATEGORIES) {
    if (c.key === 'cafe') { assert.equal(c.groupCode, 'CE7'); assert.equal(c.match, null); }
    else if (c.key === 'all') { assert.equal(c.groupCode, 'FD6'); assert.equal(c.match, null); assert.equal(c.query, '맛집'); }
    else { assert.equal(c.groupCode, 'FD6'); assert.equal(c.match, c.label); }
  }
});

test('areas: 남양주 전체 + 16 읍면동, unique keys', () => {
  assert.equal(CITY, '남양주');
  assert.equal(AREAS[0].key, 'all');
  assert.equal(AREAS[0].query, '남양주');
  assert.equal(AREAS.length, 16);
  assert.equal(new Set(AREAS.map(a => a.key)).size, AREAS.length);
  for (const name of ['와부읍', '진접읍', '화도읍', '진건읍', '오남읍', '퇴계원읍', '별내면', '수동면', '조안면', '호평동', '평내동', '금곡동', '양정동', '별내동', '다산동'])
    assert.ok(AREAS.some(a => a.label === name), name);
});
