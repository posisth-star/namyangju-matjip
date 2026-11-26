// 남양주 지역(읍면동)과 음식 종류 정의
export const CITY = '남양주';


// 남양주시 6읍 3면 + 행정동. legal은 카카오 주소에 나오는 법정동 이름(행정동↔법정동은 카카오 좌표→행정구역 변환으로 확인).
// 다른 도시의 같은 이름 동이 섞이지 않게 검색어 앞에 '남양주'를 붙이고, 법정동마다 따로 검색해 합친다.
const area = (label, legal = [label]) => ({ key: label, label, legal, queries: legal.map((l) => `${CITY} ${l}`) });
export const AREAS = [
  { key: 'all', label: '남양주 전체', legal: null, queries: [CITY] },
  area('와부읍'), area('진접읍'), area('화도읍'), area('진건읍'), area('오남읍'), area('퇴계원읍'),
  area('별내면'), area('수동면'), area('조안면'),
  area('호평동'), area('평내동'), area('금곡동'),
  area('양정동', ['일패동', '이패동', '삼패동']),
  area('별내동'),
  area('다산동', ['다산동', '수석동']),
];

const food = (key, label) => ({ key, label, queries: [label], groupCode: 'FD6', match: label });

export const CATEGORIES = [
  // 전체: 음식점(FD6) 전체를 카카오 추천순으로. '맛집'을 붙인 검색은 지역에 따라 결과가 적어서
  // 지역 이름만으로 한 검색과 합친다. 패스트푸드·간식(베이커리)·식품판매는 맛집 목록에서 뺀다.
  { key: 'all', label: '전체', queries: ['맛집', ''], groupCode: 'FD6', match: null, exclude: ['패스트푸드', '간식', '식품판매'] },
  food('korean', '한식'),
  food('chinese', '중식'),
  food('japanese', '일식'),
  food('western', '양식'),
  food('snack', '분식'),
  food('asian', '아시아음식'),
];

// 맛집이 5곳 이하인 지역·종류 조합은 숨긴다.
// 2026-11-26 전체 조합(지역 16 × 종류 7)을 카카오에서 조회한 결과로 정한 고정 목록이다.
// 페이지가 열릴 때마다 세면 카카오 호출이 첫 화면에 120번 넘게 나가서 고정 목록으로 바꿨다.
// 식당이 늘거나 줄면 다시 점검해서 고친다.
export const HIDDEN = {
  '와부읍': ['asian'],
  '진건읍': ['japanese', 'western', 'asian'],
  '오남읍': ['asian'],
  '퇴계원읍': ['japanese', 'western', 'asian'],
  '별내면': ['chinese', 'japanese', 'western', 'asian'],
  '수동면': ['japanese', 'western', 'snack', 'asian'],
  '조안면': ['chinese', 'japanese', 'western', 'snack', 'asian'],
  '평내동': ['asian'],
  '금곡동': ['japanese', 'western', 'asian'],
  '양정동': ['chinese', 'japanese', 'western', 'snack', 'asian'],
};

export function isVisible(areaKey, categoryKey) {
  if (categoryKey === 'all' || areaKey === 'all') return true;
  return !(HIDDEN[areaKey] ?? []).includes(categoryKey);
}
export const visibleCategories = (areaKey) => CATEGORIES.filter((c) => isVisible(areaKey, c.key));
export const visibleAreas = (categoryKey) => AREAS.filter((a) => isVisible(a.key, categoryKey));
