import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, AREAS, CITY } from '../src/categories.js';

import { matchesCategory } from '../src/places-logic.js';
const cat = (k) => CATEGORIES.find(c => c.key === k);
const path = (p) => `음식점 > ${p}`;

test('menu tabs in order (남양주 맞춤)', () => {
  assert.deepEqual(CATEGORIES.map(c => c.label),
    ['전체', '고기·구이', '닭갈비·오리·백숙', '회·장어·해물', '막국수·면', '국밥·탕', '한식·한정식', '중식', '일식·돈까스', '양식·피자', '분식', '아시안']);
  for (const c of CATEGORIES) {
    assert.equal(c.groupCode, 'FD6', c.key);
    assert.ok(c.queries.length >= 1, c.key);
    if (c.key === 'all') { assert.equal(c.paths, null); assert.deepEqual(c.queries, ['맛집', '']); }
    else assert.ok(c.paths.length >= 1, c.key);
  }
});
test('tabs match the right Kakao categories', () => {
  const yes = [['meat', '한식 > 육류,고기 > 갈비'], ['meat', '한식 > 육류,고기 > 족발,보쌈'], ['meat', '한식 > 육류,고기'],
    ['chicken', '한식 > 육류,고기 > 닭요리'], ['chicken', '한식 > 육류,고기 > 오리'], ['seafood', '한식 > 해물,생선 > 장어'], ['seafood', '한식 > 해물,생선 > 회'],
    ['noodle', '한식 > 국수 > 칼국수'], ['noodle', '한식 > 냉면'], ['soup', '한식 > 감자탕'], ['soup', '한식 > 순대'],
    ['hansik', '한식 > 한정식'], ['hansik', '한식 > 두부전문점'], ['hansik', '뷔페 > 한식뷔페'], ['hansik', '한식'],
    ['chinese', '중식 > 양꼬치'], ['japanese', '일식 > 돈까스,우동'], ['western', '양식 > 피자'], ['snack', '분식 > 떡볶이'], ['asian', '아시아음식 > 동남아음식']];
  for (const [k, p] of yes) assert.equal(matchesCategory(path(p), cat(k)), true, `${k} <- ${p}`);
  const no = [['meat', '한식 > 육류,고기 > 닭요리'], ['meat', '한식 > 육류,고기 > 오리'], ['chicken', '한식 > 육류,고기 > 갈비'],
    ['hansik', '한식 > 국밥'], ['soup', '한식 > 해물,생선'], ['noodle', '일식 > 초밥,롤']];
  for (const [k, p] of no) assert.equal(matchesCategory(path(p), cat(k)), false, `${k} x ${p}`);
});
test('사철탕·영양탕 and bars are excluded everywhere', () => {
  for (const c of CATEGORIES) {
    assert.equal(matchesCategory(path('한식 > 사철탕,영양탕'), c), false, c.key);
    assert.equal(matchesCategory(path('술집 > 호프,요리주점'), c), false, c.key);
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

test('low-yield search words dropped (B): 짬뽕, 쌀국수, 스테이크', () => {
  assert.deepEqual(cat('chinese').queries, ['중식']);
  assert.deepEqual(cat('asian').queries, ['아시아음식']);
  assert.deepEqual(cat('western').queries, ['파스타', '피자']);
});
test('multi-legal areas carry a search box (C); single-legal areas do not', () => {
  for (const label of ['다산동', '양정동']) {
    const b = AREAS.find(a => a.label === label).bounds;
    assert.ok(b && b.sw.lat < b.ne.lat && b.sw.lng < b.ne.lng, label);
  }
  assert.equal(AREAS.find(a => a.label === '별내동').bounds, undefined);
});
