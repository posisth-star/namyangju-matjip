// 남양주 지역(읍면동)과 음식 종류 정의
export const CITY = '남양주';


// 남양주시 6읍 3면 + 행정동. legal은 카카오 주소에 나오는 법정동 이름(행정동↔법정동은 카카오 좌표→행정구역 변환으로 확인).
// 다른 도시의 같은 이름 동이 섞이지 않게 검색어 앞에 '남양주'를 붙인다. 법정동이 여러 개인 지역(다산동·양정동)은
// 카카오 호출을 아끼려고 지역을 감싼 사각형(bounds, 2026-11-26 장소 좌표로 산출 + 약 300m 여유)으로 한 번에 검색하고 주소로 거른다.
const area = (label, legal = [label]) => ({ key: label, label, legal, queries: legal.map((l) => `${CITY} ${l}`) });
export const AREAS = [
  { key: 'all', label: '남양주 전체', legal: null, queries: [CITY] },
  area('와부읍'), area('진접읍'), area('화도읍'), area('진건읍'), area('오남읍'), area('퇴계원읍'),
  area('별내면'), area('수동면'), area('조안면'),
  area('호평동'), area('평내동'), area('금곡동'),
  { ...area('양정동', ['일패동', '이패동', '삼패동']), bounds: { sw: { lat: 37.5881, lng: 127.1665 }, ne: { lat: 37.6343, lng: 127.2107 } } },
  area('별내동'),
  { ...area('다산동', ['다산동', '수석동']), bounds: { sw: { lat: 37.5823, lng: 127.1429 }, ne: { lat: 37.6331, lng: 127.1861 } } },
];

// 남양주 맞춤 메뉴 탭(배달앱처럼 메뉴 위주). queries: 지역 뒤에 붙일 검색어(검색어마다 추천 상위 최대 45곳, 결과를 합친다)
// paths: 카카오 분류('음식점 > ' 뒤)가 이 값으로 시작하면 이 탭에 넣는다. '한식='은 세부 분류 없는 '한식'만. notPaths: 빼는 분류.
// 2026-11-26 남양주 식당 3,145곳(체인·술집 제외)의 카카오 분류를 조사해서 정했다.
const tab = (key, label, queries, paths, notPaths = []) => ({ key, label, queries, groupCode: 'FD6', paths, notPaths });

export const CATEGORIES = [
  // 전체: 음식점 전체를 카카오 추천순으로. '맛집'을 붙인 검색은 지역에 따라 결과가 적어서
  // 지역 이름만으로 한 검색과 합친다. 패스트푸드·간식(베이커리)·식품판매는 맛집 목록에서 뺀다.
  // firstCount: 첫 화면에 이만큼 찰 때까지 페이지를 더 받는다(검색어당 최대 3페이지).
  { ...tab('all', '추천', ['맛집', ''], null), exclude: ['패스트푸드', '간식', '식품판매'], firstCount: 45 },
  tab('meat', '고기·구이', ['고기', '갈비', '삼겹살'], ['한식 > 육류,고기'], ['한식 > 육류,고기 > 닭요리', '한식 > 육류,고기 > 오리']),
  tab('chicken', '닭갈비·오리·백숙', ['닭갈비', '오리', '백숙'], ['한식 > 육류,고기 > 닭요리', '한식 > 육류,고기 > 오리']),
  tab('seafood', '회·장어·해물', ['회', '장어', '아구찜'], ['한식 > 해물,생선']),
  tab('noodle', '막국수·면', ['막국수', '칼국수', '냉면'], ['한식 > 국수', '한식 > 냉면', '한식 > 수제비']),
  tab('soup', '국밥·탕', ['국밥', '해장국', '감자탕'], ['한식 > 국밥', '한식 > 해장국', '한식 > 감자탕', '한식 > 순대', '한식 > 곰탕', '한식 > 설렁탕']),
  tab('hansik', '한식·한정식', ['한정식', '두부', '쌈밥'], ['한식 > 한정식', '한식 > 찌개,전골', '한식 > 두부전문점', '한식 > 쌈밥', '뷔페 > 한식뷔페', '한식=']),
  tab('chinese', '중식', ['중식'], ['중식']),
  tab('japanese', '일식·돈까스', ['돈까스', '초밥', '일식'], ['일식']),
  tab('western', '양식·피자', ['파스타', '피자'], ['양식']),
  tab('snack', '분식', ['분식', '떡볶이', '김밥'], ['분식']),
  tab('asian', '아시안', ['아시아음식'], ['아시아음식']),
];

// 맛집이 5곳 이하인 지역·종류 조합은 숨긴다.
// 2026-11-26 메뉴 탭 개편 후 전체 조합(지역 16 × 탭 12)을 카카오에서 조회한 결과로 정한 고정 목록이다(프랜차이즈·술집 제외 기준).
// 페이지가 열릴 때마다 세면 카카오 호출이 첫 화면에 120번 넘게 나가서 고정 목록으로 바꿨다.
// 식당이 늘거나 줄면 다시 점검해서 고친다.
export const HIDDEN = {
  '와부읍': ['asian'],
  '진건읍': ['chicken', 'hansik', 'japanese', 'western', 'snack', 'asian'],
  '오남읍': ['asian'],
  '퇴계원읍': ['chicken', 'seafood', 'japanese', 'western', 'asian'],
  '별내면': ['chicken', 'noodle', 'chinese', 'japanese', 'western', 'asian'],
  '수동면': ['meat', 'chicken', 'seafood', 'noodle', 'hansik', 'japanese', 'western', 'snack', 'asian'],
  '조안면': ['noodle', 'soup', 'chinese', 'japanese', 'western', 'snack', 'asian'],
  '호평동': ['hansik'],
  '평내동': ['chicken', 'hansik', 'asian'],
  '금곡동': ['chicken', 'hansik', 'japanese', 'western', 'asian'],
  '양정동': ['meat', 'chicken', 'seafood', 'noodle', 'soup', 'hansik', 'chinese', 'japanese', 'western', 'snack', 'asian'],
};

export function isVisible(areaKey, categoryKey) {
  if (categoryKey === 'all' || areaKey === 'all') return true;
  return !(HIDDEN[areaKey] ?? []).includes(categoryKey);
}
export const visibleCategories = (areaKey) => CATEGORIES.filter((c) => isVisible(areaKey, c.key));
export const visibleAreas = (categoryKey) => AREAS.filter((a) => isVisible(a.key, categoryKey));
