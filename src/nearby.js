// '내 주변': 휴대폰 위치 → 카카오 좌표→행정구역 변환 → 우리 지역 목록의 지역으로 바꾼다.
import { AREAS, CITY } from './categories.js';

// 카카오 행정동 이름(region_3depth_name)을 지역 키로. 남양주 밖이면 null, 남양주인데 목록에 없으면 'all'.
export function areaFromRegion(region1, region2, region3) {
  if (!String(region2 ?? '').startsWith(`${CITY}시`)) return null;
  const name = String(region3 ?? '');
  if (/^다산\d동$/.test(name)) return '다산동';
  return AREAS.some((a) => a.key === name) ? name : 'all';
}

// 브라우저 위치를 받아 지역 키를 돌려준다. 실패 사유는 Error.message로 알려준다.
export function locateArea(geolocation, geocoder, okStatus, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (!geolocation) { reject(new Error('이 브라우저는 위치 기능을 지원하지 않아요.')); return; }
    geolocation.getCurrentPosition(
      ({ coords }) => {
        geocoder.coord2RegionCode(coords.longitude, coords.latitude, (result, status) => {
          if (status !== okStatus) { reject(new Error('위치를 지역으로 바꾸지 못했어요.')); return; }
          const h = result.find((r) => r.region_type === 'H') ?? result[0];
          const area = areaFromRegion(h?.region_1depth_name, h?.region_2depth_name, h?.region_3depth_name);
          if (area == null) reject(new Error('지금 위치는 남양주 밖이에요.'));
          else resolve(area);
        });
      },
      (err) => reject(new Error(err?.code === 1 ? '위치 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요.' : '위치를 가져오지 못했어요.')),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300000 },
    );
  });
}
