// 카카오 장소 결과 변환, 종류 필터, 정렬, 지도 링크 (DOM·SDK 없는 순수 로직)
import { CITY } from './categories.js';

const NAVER_SEARCH = 'https://map.naver.com/p/search/';

// '경기 남양주시 별내동 123' → '별내동'
export function areaOf(address) {
  return String(address ?? '').split(' ')[2] ?? '';
}

export function naverSearchUrl(name, area) {
  return NAVER_SEARCH + encodeURIComponent([name, CITY, area].filter(Boolean).join(' '));
}

export function matchesCategory(categoryName, category) {
  if (category.match == null) return true;
  const second = String(categoryName ?? '').split(' > ')[1] ?? '';
  return second.includes(category.match);
}

export function toRestaurant(doc) {
  const parts = String(doc.category_name ?? '').split(' > ');
  const area = areaOf(doc.address_name);
  return {
    id: String(doc.id),
    name: doc.place_name,
    subCategory: parts[parts.length - 1] ?? '',
    area,
    phone: doc.phone ?? '',
    kakaoUrl: doc.place_url,
    naverUrl: naverSearchUrl(doc.place_name, area),
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
