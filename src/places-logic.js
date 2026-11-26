// 카카오 장소 결과 변환, 종류 필터, 정렬, 지도 링크 (DOM·SDK 없는 순수 로직)
import { CITY, AREAS } from './categories.js';

const NAVER_SEARCH = 'https://map.naver.com/p/search/';

// '경기 남양주시 별내동 123' → '별내동'
export function areaOf(address) {
  return String(address ?? '').split(' ')[2] ?? '';
}

// '경기 남양주시 화도읍 경춘로 1234' → '경춘로' (읍·면·동을 건너뛰고 도로명만)
export function roadOf(roadAddress) {
  const parts = String(roadAddress ?? '').split(' ').slice(2);
  return parts.find((p) => /(로|길)(\d+(번)?길)?$/.test(p) && !/[읍면동]$/.test(p)) ?? '';
}

// 법정동(주소상 동 이름)을 우리 목록의 행정동으로: 일패·이패·삼패동 → 양정동, 수석동 → 다산동
const LEGAL_TO_AREA = Object.fromEntries(AREAS.flatMap((a) => (a.legal ?? []).map((l) => [l, a.label])));
export const adminArea = (legal) => LEGAL_TO_AREA[legal] ?? legal;

// 네이버 지도 검색어: 가게 이름 + 남양주 + 도로명 (도로명이 없으면 동 이름). 같은 이름 다른 지점을 줄인다.
export function naverSearchUrl(name, { road = '', area = '' } = {}) {
  return NAVER_SEARCH + encodeURIComponent([name, CITY, road || area].filter(Boolean).join(' '));
}

// 시민이 찾는 건 동네 맛집이라, 종류 탭에서는 흔한 프랜차이즈를 뺀다(이름 검색에서는 그대로 찾을 수 있다).
// 2026-11-26 남양주 결과에 자주 나온 체인 위주의 목록이다.
const CHAIN_RE = new RegExp([
  '피자스쿨', '엽기떡볶이', '김밥나라', '땅스떡볶이', '김밥천국', '탕화쿵푸', '춘리마라탕', '도미노피자', '우리할매떡볶이',
  '신전떡볶이', '피자헛', '두끼', '청년다방', '파파존스', '미스터피자', '피자마루', '반올림피자', '7번가피자', '59쌀피자',
  '고피자', '죠스떡볶이', '국대떡볶이', '응급실떡볶이', '맘스터치', '롯데리아', '버거킹', '맥도날드', 'KFC', '한솥', '본죽',
  '본도시락', '이삭토스트', '서브웨이', '홍콩반점', '역전우동', '새마을식당', '빽다방',
].join('|'));
export const isChain = (name) => CHAIN_RE.test(String(name ?? ''));

// 점심 맛집이 목적이라 술집(호프·요리주점·이자카야 등)은 목록과 검색 모두에서 뺀다. 공개 서비스라 사철탕·영양탕도 뺀다.
const LUNCH_EXCLUDE = ['술집'];
const PATH_EXCLUDE = ['한식 > 사철탕,영양탕'];
const pathOf = (categoryName) => String(categoryName ?? '').split(' > ').slice(1).join(' > '); // '음식점' 뒤
const startsPath = (path, p) => (p.endsWith('=') ? path === p.slice(0, -1) : path === p || path.startsWith(`${p} > `));
export function isLunchPlace(categoryName) {
  const path = pathOf(categoryName);
  const second = path.split(' > ')[0] ?? '';
  return !LUNCH_EXCLUDE.some((x) => second.includes(x)) && !PATH_EXCLUDE.some((p) => startsPath(path, p));
}

export function matchesCategory(categoryName, category) {
  const path = pathOf(categoryName);
  if (!path || !isLunchPlace(categoryName)) return false;
  const second = path.split(' > ')[0] ?? '';
  if (category.exclude?.some((x) => second.includes(x))) return false;
  if (category.notPaths?.some((p) => startsPath(path, p))) return false;
  if (category.paths == null) return true;
  return category.paths.some((p) => startsPath(path, p));
}

export function toRestaurant(doc) {
  const parts = String(doc.category_name ?? '').split(' > ');
  const area = adminArea(areaOf(doc.address_name));
  const road = roadOf(doc.road_address_name);
  return {
    id: String(doc.id),
    name: doc.place_name,
    subCategory: parts[parts.length - 1] ?? '',
    area,
    phone: doc.phone ?? '',
    kakaoUrl: String(doc.place_url ?? '').replace(/^http:/, 'https:'),
    naverUrl: naverSearchUrl(doc.place_name, { road, area }),
  };
}

export function sortRestaurants(list, sortBy) {
  const copy = [...list];
  if (sortBy === 'name') copy.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  else copy.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  return copy;
}

export function dedupeById(list) {
  const seen = new Set();
  return list.filter((x) => (seen.has(x.id) ? false : seen.add(x.id)));
}
