// 남양주 지역(읍면동)과 음식 종류 정의
export const CITY = '남양주';

// 남양주시 6읍 3면 + 동 지역. 다산1·2동은 카카오 주소에 '다산동'으로 나와 하나로 묶는다.
const area = (label) => ({ key: label, label, query: label });
export const AREAS = [
  { key: 'all', label: '남양주 전체', query: CITY },
  area('와부읍'), area('진접읍'), area('화도읍'), area('진건읍'), area('오남읍'), area('퇴계원읍'),
  area('별내면'), area('수동면'), area('조안면'),
  area('호평동'), area('평내동'), area('금곡동'), area('양정동'), area('별내동'), area('다산동'),
];

const food = (key, label) => ({ key, label, query: label, groupCode: 'FD6', match: label });

export const CATEGORIES = [
  // 전체: 음식점(FD6) 전체를 카카오 추천순으로. 키워드가 필수라 '맛집'을 쓰고, 종류 필터는 하지 않는다.
  { key: 'all', label: '전체', query: '맛집', groupCode: 'FD6', match: null },
  food('korean', '한식'),
  food('chinese', '중식'),
  food('japanese', '일식'),
  food('western', '양식'),
  food('snack', '분식'),
  food('asian', '아시아음식'),
  { key: 'cafe', label: '카페', query: '카페', groupCode: 'CE7', match: null },
];
