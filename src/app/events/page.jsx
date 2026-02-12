'use client';

import {
  useEffect, useState, useContext, useRef, useCallback,
} from 'react';
import dynamic from 'next/dynamic'; // 導入 dynamic
import polyline from '@mapbox/polyline';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import styles from './events.module.css';
import {
  createEvent,
  fetchLatestEvents,
  fetchNextEvents,
  queryEvents,
  joinEvent,
  leaveEvent,
  fetchMyJoinedEventsForIds,
} from '@/lib/firebase-events';

// 動態載入 EventMap 元件，關閉 SSR
const EventMap = dynamic(() => import('@/components/EventMap'), { ssr: false });

// #region taiwanLocations
const taiwanLocations = {
  臺北市: [
    '中正區',
    '大同區',
    '中山區',
    '松山區',
    '大安區',
    '萬華區',
    '信義區',
    '士林區',
    '北投區',
    '內湖區',
    '南港區',
    '文山區',
  ],
  新北市: [
    '萬里區',
    '金山區',
    '板橋區',
    '汐止區',
    '深坑區',
    '石碇區',
    '瑞芳區',
    '平溪區',
    '雙溪區',
    '貢寮區',
    '新店區',
    '坪林區',
    '烏來區',
    '永和區',
    '中和區',
    '土城區',
    '三峽區',
    '樹林區',
    '鶯歌區',
    '三重區',
    '新莊區',
    '泰山區',
    '林口區',
    '蘆洲區',
    '五股區',
    '八里區',
    '淡水區',
    '三芝區',
    '石門區',
  ],
  基隆市: [
    '仁愛區',
    '信義區',
    '中正區',
    '中山區',
    '安樂區',
    '暖暖區',
    '七堵區',
  ],
  桃園市: [
    '中壢區',
    '平鎮區',
    '龍潭區',
    '楊梅區',
    '新屋區',
    '觀音區',
    '桃園區',
    '龜山區',
    '八德區',
    '大溪區',
    '復興區',
    '大園區',
    '蘆竹區',
  ],
  新竹市: ['東區', '北區', '香山區'],
  新竹縣: [
    '竹北市',
    '竹東鎮',
    '新埔鎮',
    '關西鎮',
    '湖口鄉',
    '新豐鄉',
    '芎林鄉',
    '橫山鄉',
    '北埔鄉',
    '寶山鄉',
    '峨眉鄉',
    '尖石鄉',
    '五峰鄉',
  ],
  苗栗縣: [
    '苗栗市',
    '頭份市',
    '竹南鎮',
    '後龍鎮',
    '通霄鎮',
    '苑裡鎮',
    '卓蘭鎮',
    '造橋鄉',
    '西湖鄉',
    '頭屋鄉',
    '公館鄉',
    '銅鑼鄉',
    '三義鄉',
    '大湖鄉',
    '獅潭鄉',
    '南庄鄉',
    '泰安鄉',
  ],
  臺中市: [
    '中區',
    '東區',
    '南區',
    '西區',
    '北區',
    '北屯區',
    '西屯區',
    '南屯區',
    '太平區',
    '大里區',
    '霧峰區',
    '烏日區',
    '豐原區',
    '后里區',
    '石岡區',
    '東勢區',
    '和平區',
    '新社區',
    '潭子區',
    '大雅區',
    '神岡區',
    '大肚區',
    '沙鹿區',
    '龍井區',
    '梧棲區',
    '清水區',
    '大甲區',
    '外埔區',
    '大安區',
  ],
  彰化縣: [
    '彰化市',
    '員林市',
    '和美鎮',
    '鹿港鎮',
    '溪湖鎮',
    '二林鎮',
    '田中鎮',
    '北斗鎮',
    '花壇鄉',
    '芬園鄉',
    '大村鄉',
    '埔心鄉',
    '永靖鄉',
    '社頭鄉',
    '二水鄉',
    '田尾鄉',
    '埤頭鄉',
    '芳苑鄉',
    '大城鄉',
    '竹塘鄉',
    '溪州鄉',
    '秀水鄉',
    '福興鄉',
    '線西鄉',
    '伸港鄉',
    '埔鹽鄉',
  ],
  南投縣: [
    '南投市',
    '埔里鎮',
    '草屯鎮',
    '竹山鎮',
    '集集鎮',
    '名間鄉',
    '鹿谷鄉',
    '中寮鄉',
    '魚池鄉',
    '國姓鄉',
    '水里鄉',
    '信義鄉',
    '仁愛鄉',
  ],
  雲林縣: [
    '斗六市',
    '斗南鎮',
    '虎尾鎮',
    '西螺鎮',
    '土庫鎮',
    '北港鎮',
    '古坑鄉',
    '大埤鄉',
    '莿桐鄉',
    '林內鄉',
    '二崙鄉',
    '崙背鄉',
    '麥寮鄉',
    '東勢鄉',
    '褒忠鄉',
    '臺西鄉',
    '元長鄉',
    '四湖鄉',
    '口湖鄉',
    '水林鄉',
  ],
  嘉義市: ['東區', '西區'],
  嘉義縣: [
    '太保市',
    '朴子市',
    '布袋鎮',
    '大林鎮',
    '民雄鄉',
    '溪口鄉',
    '新港鄉',
    '六腳鄉',
    '東石鄉',
    '義竹鄉',
    '鹿草鄉',
    '水上鄉',
    '中埔鄉',
    '竹崎鄉',
    '梅山鄉',
    '番路鄉',
    '大埔鄉',
    '阿里山鄉',
  ],
  臺南市: [
    '中西區',
    '東區',
    '南區',
    '北區',
    '安平區',
    '安南區',
    '永康區',
    '歸仁區',
    '新化區',
    '左鎮區',
    '玉井區',
    '楠西區',
    '南化區',
    '仁德區',
    '關廟區',
    '龍崎區',
    '官田區',
    '麻豆區',
    '佳里區',
    '西港區',
    '七股區',
    '將軍區',
    '學甲區',
    '北門區',
    '新營區',
    '後壁區',
    '白河區',
    '東山區',
    '六甲區',
    '下營區',
    '柳營區',
    '鹽水區',
    '善化區',
    '大內區',
    '山上區',
    '新市區',
    '安定區',
  ],
  高雄市: [
    '楠梓區',
    '左營區',
    '鼓山區',
    '三民區',
    '鹽埕區',
    '前金區',
    '新興區',
    '苓雅區',
    '前鎮區',
    '旗津區',
    '小港區',
    '鳳山區',
    '林園區',
    '大寮區',
    '大樹區',
    '大社區',
    '仁武區',
    '鳥松區',
    '岡山區',
    '橋頭區',
    '燕巢區',
    '田寮區',
    '阿蓮區',
    '路竹區',
    '湖內區',
    '茄萣區',
    '永安區',
    '彌陀區',
    '梓官區',
    '旗山區',
    '美濃區',
    '六龜區',
    '甲仙區',
    '杉林區',
    '內門區',
    '茂林區',
    '桃源區',
    '那瑪夏區',
  ],
  屏東縣: [
    '屏東市',
    '潮州鎮',
    '東港鎮',
    '恆春鎮',
    '萬丹鄉',
    '長治鄉',
    '麟洛鄉',
    '九如鄉',
    '里港鄉',
    '鹽埔鄉',
    '高樹鄉',
    '萬巒鄉',
    '內埔鄉',
    '竹田鄉',
    '新埤鄉',
    '枋寮鄉',
    '新園鄉',
    '崁頂鄉',
    '林邊鄉',
    '南州鄉',
    '佳冬鄉',
    '琉球鄉',
    '車城鄉',
    '滿州鄉',
    '枋山鄉',
    '三地門鄉',
    '霧臺鄉',
    '瑪家鄉',
    '泰武鄉',
    '來義鄉',
    '春日鄉',
    '獅子鄉',
    '牡丹鄉',
  ],
  宜蘭縣: [
    '宜蘭市',
    '羅東鎮',
    '蘇澳鎮',
    '頭城鎮',
    '礁溪鄉',
    '壯圍鄉',
    '員山鄉',
    '冬山鄉',
    '五結鄉',
    '三星鄉',
    '大同鄉',
    '南澳鄉',
  ],
  花蓮縣: [
    '花蓮市',
    '鳳林鎮',
    '玉里鎮',
    '新城鄉',
    '吉安鄉',
    '壽豐鄉',
    '光復鄉',
    '豐濱鄉',
    '瑞穗鄉',
    '富里鄉',
    '秀林鄉',
    '萬榮鄉',
    '卓溪鄉',
  ],
  臺東縣: [
    '臺東市',
    '成功鎮',
    '關山鎮',
    '卑南鄉',
    '大武鄉',
    '太麻里鄉',
    '東河鄉',
    '長濱鄉',
    '鹿野鄉',
    '池上鄉',
    '綠島鄉',
    '蘭嶼鄉',
    '延平鄉',
    '金峰鄉',
    '達仁鄉',
    '海端鄉',
  ],
  澎湖縣: ['馬公市', '湖西鄉', '白沙鄉', '西嶼鄉', '望安鄉', '七美鄉'],
  金門縣: ['金城鎮', '金湖鎮', '金沙鎮', '金寧鄉', '烈嶼鄉', '烏坵鄉'],
  連江縣: ['南竿鄉', '北竿鄉', '莒光鄉', '東引鄉'],
};
// #endregion taiwanLocations

// 將地圖繪製的座標點 [{lat,lng}, ...] 壓縮成 encoded polyline 字串
/**
 *
 * @param routeCoordinates
 */
function buildRoutePayload(routeCoordinates) {
  if (!Array.isArray(routeCoordinates) || routeCoordinates.length === 0) return null;

  const points = routeCoordinates.map((p) => [Number(p.lat), Number(p.lng)]);
  if (points.some(([lat, lng]) => Number.isNaN(lat) || Number.isNaN(lng))) return null;

  const encoded = polyline.encode(points);

  let minLat = points[0][0];
  let maxLat = points[0][0];
  let minLng = points[0][1];
  let maxLng = points[0][1];

  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return {
    polyline: encoded,
    pointsCount: points.length,
    bbox: {
      minLat, minLng, maxLat, maxLng,
    },
  };
}

/**
 *
 * @param value
 */
function formatDateTime(value) {
  if (!value) return '';

  if (typeof value === 'string') return value.replace('T', ' ');

  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }

  return String(value);
}

/**
 *
 * @param paceSec
 * @param fallbackText
 */
function formatPace(paceSec, fallbackText = '') {
  const n = typeof paceSec === 'number' ? paceSec : Number(paceSec);
  if (Number.isFinite(n) && n > 0) {
    const mm = Math.floor(n / 60);
    const ss = n % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
  }
  if (typeof fallbackText === 'string' && fallbackText.trim()) return fallbackText;
  return '';
}

/**
 *
 * @param arr
 * @param size
 */
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 *
 * @param v
 */
function toNumber(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 *
 * @param ev
 */
function getRemainingSeats(ev) {
  if (typeof ev?.remainingSeats === 'number') return ev.remainingSeats;
  const max = toNumber(ev?.maxParticipants);
  const count = toNumber(ev?.participantsCount);
  return Math.max(0, max - count);
}

/**
 *
 * @param user
 */
function buildUserPayload(user) {
  if (!user?.uid) return null;
  return {
    uid: String(user.uid),
    name: String(user.name || (user.email ? user.email.split('@')[0] : '')),
    photoURL: String(user.photoURL || ''),
  };
}

/**
 *
 */
export default function RunTogetherPage() {
  const [isFormOpen, setFormOpen] = useState(false);
  // ✅ 篩選浮層（先做空白 UI）
  const [isFilterOpen, setFilterOpen] = useState(false);
  // ✅ 篩選表單（先從「揪團人」開始）
  const [filterHostText, setFilterHostText] = useState('');
  // 2. 活動日期/時間
  const [filterTimeStart, setFilterTimeStart] = useState('');
  const [filterTimeEnd, setFilterTimeEnd] = useState('');
  // 3. 報名截止時間
  const [filterRegStart, setFilterRegStart] = useState('');
  const [filterRegEnd, setFilterRegEnd] = useState('');
  // 4. 跑步距離 (km)
  const [filterDistanceMin, setFilterDistanceMin] = useState('');
  const [filterDistanceMax, setFilterDistanceMax] = useState('');
  // 5. 配速 (分:秒) - 範圍
  const [filterPaceMinMin, setFilterPaceMinMin] = useState(''); // 最快配速 (分)
  const [filterPaceMinSec, setFilterPaceMinSec] = useState(''); // 最快配速 (秒)
  const [filterPaceMaxMin, setFilterPaceMaxMin] = useState(''); // 最慢配速 (分)
  const [filterPaceMaxSec, setFilterPaceMaxSec] = useState(''); // 最慢配速 (秒)
  // 6. 是否還有名額
  const [filterHasSeatsOnly, setFilterHasSeatsOnly] = useState(true);
  // 7. 縣市 + 區
  const [filterCity, setFilterCity] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  // 8. 限制人數
  const [filterMaxParticipantsMin, setFilterMaxParticipantsMin] = useState('');
  const [filterMaxParticipantsMax, setFilterMaxParticipantsMax] = useState('');
  // 9. 跑步類型
  const [filterRunType, setFilterRunType] = useState('');
  const { user } = useContext(AuthContext);

  // ✅ 表單相關 state
  const [showMap, setShowMap] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [minDateTime, setMinDateTime] = useState('');

  // ✅ 活動列表
  const [events, setEvents] = useState([]);
  const [isFilteredResults, setIsFilteredResults] = useState(false); // 是否為篩選後的結果

  // ✅ 初次載入（進頁面抓最新 10 筆）
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false); // 正在篩選中
  const [loadError, setLoadError] = useState(null);

  // ✅ 無限滾動（載入更多）
  const [cursor, setCursor] = useState(null); // DocumentSnapshot
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);

  // ✅ 建立活動狀態
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // ✅ 參加/退出：成功/失敗字卡（不使用 alert）
  const [actionMessage, setActionMessage] = useState(null);

  // ✅ 參加/退出：每張卡片的按鈕 loading 狀態
  const [pendingByEventId, setPendingByEventId] = useState({});

  // ✅ 我已參加哪些活動
  const [myJoinedEventIds, setMyJoinedEventIds] = useState(() => new Set());
  const membershipCheckedRef = useRef(new Set());

  // ✅ 上次建立失敗時保留的草稿
  const [draftFormData, setDraftFormData] = useState(null);

  const hostName = user?.name || (user?.email ? user.email.split('@')[0] : '');

  // 表單打開時鎖住 body 捲動
  useEffect(() => {
    if (!isFormOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFormOpen]);

  // 篩選浮層打開時鎖住 body 捲動
  useEffect(() => {
    if (!isFilterOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFilterOpen]);

  // 進入 events 頁面時，先載入最新 10 筆活動
  useEffect(() => {
    let cancelled = false;

    /**
     *
     */
    async function run() {
      setIsLoadingEvents(true);
      setLoadError(null);

      try {
        const { events: latest, lastDoc } = await fetchLatestEvents(10);

        if (!cancelled) {
          setEvents((prev) => {
            const map = new Map();
            [...prev, ...latest].forEach((ev) => {
              if (ev?.id && !map.has(ev.id)) map.set(ev.id, ev);
            });
            return Array.from(map.values());
          });

          setCursor(lastDoc);
          setHasMore(latest.length === 10 && !!lastDoc);
        }
      } catch (err) {
        console.error('載入活動失敗:', err);
        if (!cancelled) setLoadError('載入活動失敗，請稍後再試');
      } finally {
        if (!cancelled) setIsLoadingEvents(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // events 清單變動就補查「我是否已參加」
  useEffect(() => {
    if (!user?.uid) {
      setMyJoinedEventIds(new Set());
      membershipCheckedRef.current = new Set();
      return;
    }

    const ids = events.map((e) => e?.id).filter(Boolean);
    const newIds = ids.filter((id) => !membershipCheckedRef.current.has(id));
    if (newIds.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const batches = chunkArray(newIds, 30);
        const joined = new Set();

        for (const batch of batches) {
          const set = await fetchMyJoinedEventsForIds(user.uid, batch);
          set.forEach((id) => joined.add(id));
        }

        newIds.forEach((id) => membershipCheckedRef.current.add(id));

        if (!cancelled && joined.size > 0) {
          setMyJoinedEventIds((prev) => {
            const next = new Set(prev);
            joined.forEach((id) => next.add(id));
            return next;
          });
        }
      } catch (err) {
        console.error('查詢已參加活動失敗:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [events, user?.uid]);

  const loadMore = useCallback(async () => {
    if (isFormOpen || isCreating) return;
    if (!hasMore || !cursor || isLoadingEvents || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const { events: next, lastDoc } = await fetchNextEvents(cursor, 10);

      setEvents((prev) => {
        const map = new Map();
        [...prev, ...next].forEach((ev) => {
          if (ev?.id && !map.has(ev.id)) map.set(ev.id, ev);
        });
        return Array.from(map.values());
      });

      setCursor(lastDoc);
      if (next.length < 10 || !lastDoc) setHasMore(false);
      setLoadMoreError(null);
    } catch (err) {
      console.error('載入更多活動失敗:', err);
      setLoadMoreError('載入更多活動失敗，請稍後再試');
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, hasMore, isCreating, isFormOpen, isLoadingEvents, isLoadingMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: '0px 0px 300px 0px', threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  /**
   *
   */
  function handleToggleCreateRunForm() {
    if (!user?.uid) return;

    if (isFormOpen) {
      setFormOpen(false);
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setMinDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);

    if (draftFormData) {
      setSelectedCity(draftFormData.city || '');
      setSelectedDistrict(draftFormData.district || '');

      const { planRoute } = draftFormData;
      if (planRoute === 'yes') {
        setShowMap(true);
        setRouteCoordinates(draftFormData.routeCoordinates || null);
      } else {
        setShowMap(false);
        setRouteCoordinates(null);
      }
    } else {
      setSelectedCity('');
      setSelectedDistrict('');
      setShowMap(false);
      setRouteCoordinates(null);
    }

    setFormOpen(true);
  }

  /**
   *
   */
  function handleClearFilters() {
    setFilterHostText('');
    setFilterTimeStart('');
    setFilterTimeEnd('');
    setFilterRegStart('');
    setFilterRegEnd('');
    setFilterDistanceMin('');
    setFilterDistanceMax('');
    setFilterPaceMinMin('');
    setFilterPaceMinSec('');
    setFilterPaceMaxMin('');
    setFilterPaceMaxSec('');
    setFilterHasSeatsOnly(true);
    setFilterCity('');
    setFilterDistrict('');
    setFilterMaxParticipantsMin('');
    setFilterMaxParticipantsMax('');
    setFilterRunType('');

    // 重置搜尋結果狀態
    setIsFilteredResults(false);
  }

  /**
   *
   */
  async function handleSearchFilters() {
    setFilterOpen(false);
    setIsFiltering(true);
    setLoadError(null);

    const filters = {
      city: filterCity,
      district: filterDistrict,
      startTime: filterTimeStart,
      endTime: filterTimeEnd,
      minDistance: filterDistanceMin,
      maxDistance: filterDistanceMax,
      hasSeatsOnly: filterHasSeatsOnly,
    };

    try {
      const results = await queryEvents(filters);
      setEvents(results);
      setIsFilteredResults(true);
      setHasMore(false); // MVP 篩選結果暫不支援載入更多
    } catch (err) {
      console.error('篩選失敗:', err);
      setLoadError('搜尋失敗，請稍後再試');
    } finally {
      setIsFiltering(false);
    }
  }

  /**
   *
   * @param e
   */
  async function handleSubmit(e) {
    e.preventDefault();

    setCreateError(null);
    setIsCreating(true);

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    const routeCoordinatesSnapshot = Array.isArray(routeCoordinates)
      ? routeCoordinates.map((p) => ({ lat: p.lat, lng: p.lng }))
      : null;

    // ✅ UI 用下拉（分/秒），資料層與 Firestore 只存 paceSec（number）
    const paceMin = Number(data.paceMinutes);
    const paceSecPart = Number(data.paceSeconds);
    const paceSec = Number.isFinite(paceMin) && Number.isFinite(paceSecPart)
      ? paceMin * 60 + paceSecPart
      : 0;

    const route = buildRoutePayload(routeCoordinatesSnapshot);

    const extra = {
      hostUid: user?.uid || '',
      hostName: hostName || '',
      hostPhotoURL: user?.photoURL || '',
      route,
    };

    try {
      const docRef = await createEvent(data, extra);

      const newEventCard = {
        id: docRef.id,
        ...data,
        ...extra,
        paceSec,
        routeCoordinates: routeCoordinatesSnapshot,

        // 參加功能：UI 快取
        participantsCount: 0,
        remainingSeats: toNumber(data.maxParticipants),
      };

      setEvents((prev) => [
        newEventCard,
        ...prev.filter((e) => e.id !== newEventCard.id),
      ]);
      setDraftFormData(null);

      setFormOpen(false);
      setShowMap(false);
      setRouteCoordinates(null);
      setSelectedCity('');
      setSelectedDistrict('');

      setIsCreating(false);
    } catch (err) {
      console.error('建立活動失敗:', err);

      setDraftFormData({
        ...data,
        routeCoordinates: routeCoordinatesSnapshot,
      });

      setCreateError('建立活動失敗，請再建立一次');
      setIsCreating(false);
    }
  }

  /**
   *
   * @param ev
   * @param clickEvent
   */
  async function handleJoinClick(ev, clickEvent) {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();

    if (!user?.uid) {
      setActionMessage({ type: 'error', message: '加入活動前請先登入' });
      return;
    }
    if (ev.hostUid === user.uid) return;

    const eventId = String(ev.id);
    const payload = buildUserPayload(user);
    if (!payload) return;

    setActionMessage(null);
    setPendingByEventId((prev) => ({ ...prev, [eventId]: 'joining' }));

    try {
      const res = await joinEvent(eventId, payload);

      if (
        res?.ok
        && (res.status === 'joined' || res.status === 'already_joined')
      ) {
        setMyJoinedEventIds((prev) => {
          const next = new Set(prev);
          next.add(eventId);
          return next;
        });

        if (res.status === 'joined') {
          setEvents((prev) => prev.map((item) => {
            if (String(item.id) !== eventId) return item;
            const remaining = getRemainingSeats(item);
            const count = toNumber(item.participantsCount);
            return {
              ...item,
              remainingSeats: Math.max(0, remaining - 1),
              participantsCount: count + 1,
            };
          }));
        }

        setActionMessage({ type: 'success', message: '報名成功' });
        return;
      }

      if (res?.ok === false && res.status === 'full') {
        setActionMessage({ type: 'error', message: '本活動已額滿' });
        setEvents((prev) => prev.map((item) => (String(item.id) === eventId ? { ...item, remainingSeats: 0 } : item)));
        return;
      }

      setActionMessage({ type: 'error', message: '報名失敗，請再試一次' });
    } catch (err) {
      console.error('參加活動失敗:', err);
      setActionMessage({ type: 'error', message: '報名失敗，請再試一次' });
    } finally {
      setPendingByEventId((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
    }
  }

  /**
   *
   * @param ev
   * @param clickEvent
   */
  async function handleLeaveClick(ev, clickEvent) {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();

    if (!user?.uid) {
      setActionMessage({ type: 'error', message: '請先登入再操作' });
      return;
    }

    const eventId = String(ev.id);
    const payload = buildUserPayload(user);
    if (!payload) return;

    setActionMessage(null);
    setPendingByEventId((prev) => ({ ...prev, [eventId]: 'leaving' }));

    try {
      const res = await leaveEvent(eventId, payload);

      if (res?.ok && (res.status === 'left' || res.status === 'not_joined')) {
        setMyJoinedEventIds((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });

        if (res.status === 'left') {
          setEvents((prev) => prev.map((item) => {
            if (String(item.id) !== eventId) return item;

            const max = toNumber(item.maxParticipants);
            const remaining = getRemainingSeats(item);
            const count = toNumber(item.participantsCount);
            return {
              ...item,
              remainingSeats: Math.min(max, remaining + 1),
              participantsCount: Math.max(0, count - 1),
            };
          }));
        }

        setActionMessage({ type: 'success', message: '已成功取消報名' });
        return;
      }

      setActionMessage({
        type: 'error',
        message: '發生錯誤，請再重新取消報名',
      });
    } catch (err) {
      console.error('退出活動失敗:', err);
      setActionMessage({
        type: 'error',
        message: '發生錯誤，請再重新取消報名',
      });
    } finally {
      setPendingByEventId((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
    }
  }

  return (
    <div className={styles.pageContainer}>
      <h1>這是揪團跑步頁面</h1>

      <div className={styles.eventsSection}>
        <div className={styles.eventsHeaderRow}>
          <h2 className={styles.eventsTitle}>活動列表</h2>

          <button
            type="button"
            className={styles.filterButton}
            aria-label="篩選活動"
            onClick={() => {
              if (isFormOpen) return; // 先避免兩個浮層同時開
              setFilterOpen(true);
            }}
          >
            <svg
              className={styles.filterIcon}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M3 5h18l-7 8v5l-4 1v-6L3 5z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {isLoadingEvents && (
          <div className={styles.statusRow} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <span>正在載入活動…</span>
          </div>
        )}

        {isFiltering && (
          <div className={styles.statusRow} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <span>正在篩選活動…</span>
          </div>
        )}

        {isCreating && (
          <div className={styles.statusRow} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <span>正在建立活動…</span>
          </div>
        )}

        {loadError && (
          <div className={styles.errorCard} role="alert">
            {loadError}
          </div>
        )}

        {createError && (
          <div className={styles.errorCard} role="alert">
            {createError}
          </div>
        )}

        {actionMessage && (
          <div
            className={
              actionMessage.type === 'success'
                ? styles.successCard
                : styles.errorCard
            }
            role={actionMessage.type === 'error' ? 'alert' : 'status'}
          >
            {actionMessage.message}
          </div>
        )}

        <div className={styles.eventList}>
          {!isLoadingEvents && !isFiltering && events.length === 0 ? (
            <div className={styles.emptyHint}>
              {isFilteredResults ? '沒有符合條件的活動' : '目前還沒有活動（先建立一筆看看）'}
            </div>
          ) : (
            events.map((ev) => (
              <Link
                key={ev.id}
                href={`/events/${ev.id}`}
                className={styles.eventLink}
              >
                <div className={styles.eventCard}>
                  <div className={styles.eventTitle}>{ev.title}</div>

                  <div className={styles.eventMeta}>
                    <div>
                      時間：
                      {formatDateTime(ev.time)}
                    </div>
                    <div>
                      報名截止：
                      {formatDateTime(ev.registrationDeadline)}
                    </div>
                    <div>
                      地點：
                      {ev.city}
                      {' '}
                      {ev.district}
                    </div>
                    <div>
                      集合：
                      {ev.meetPlace}
                    </div>
                  </div>

                  <div className={styles.eventMeta}>
                    <div>
                      距離：
                      {ev.distanceKm}
                      {' '}
                      km
                    </div>
                    <div>
                      配速：
                      {formatPace(ev.paceSec, ev.pace)}
                      {' '}
                      /km
                    </div>
                    <div>
                      人數上限：
                      {ev.maxParticipants}
                    </div>
                    <div>
                      剩餘名額：
                      {getRemainingSeats(ev)}
                    </div>
                  </div>

                  <div className={styles.eventMeta}>
                    <div>
                      主揪：
                      {ev.hostName}
                    </div>
                    <div>
                      路線：
                      {Array.isArray(ev.routeCoordinates)
                      && ev.routeCoordinates.length > 0
                        ? `已設定（${ev.routeCoordinates.length} 點）`
                        : ev.route?.pointsCount
                          ? `已設定（${ev.route.pointsCount} 點）`
                          : '未設定'}
                    </div>
                  </div>

                  {/* ✅ 參加/退出活動（events 列表版） */}
                  <div className={styles.eventCardActions}>
                    {user?.uid
                    && ev.hostUid === user.uid ? null : !user?.uid ? (
                      <div className={styles.helperText}>
                        加入活動前請先登入
                      </div>
                      ) : (
                        (() => {
                          const eventId = String(ev.id);
                          const pending = pendingByEventId[eventId];
                          const joined = myJoinedEventIds.has(eventId);
                          const remaining = getRemainingSeats(ev);

                          if (joined) {
                            return (
                              <button
                                type="button"
                                className={`${styles.submitButton} ${styles.leaveButton}`}
                                onClick={(e) => handleLeaveClick(ev, e)}
                                disabled={
                                Boolean(pending) || isCreating || isFormOpen
                              }
                              >
                                {pending === 'leaving' ? (
                                  <span className={styles.spinnerLabel}>
                                    <div
                                      className={`${styles.spinner} ${styles.buttonSpinner}`}
                                    />
                                    取消中…
                                  </span>
                                ) : (
                                  '退出活動'
                                )}
                              </button>
                            );
                          }

                          if (remaining <= 0) {
                            return (
                              <button
                                type="button"
                                className={`${styles.submitButton} ${styles.soldOutButton}`}
                                disabled
                                aria-disabled="true"
                              >
                                已額滿
                              </button>
                            );
                          }

                          return (
                            <button
                              type="button"
                              className={styles.submitButton}
                              onClick={(e) => handleJoinClick(ev, e)}
                              disabled={
                              Boolean(pending) || isCreating || isFormOpen
                            }
                            >
                              {pending === 'joining' ? (
                                <span className={styles.spinnerLabel}>
                                  <div
                                    className={`${styles.spinner} ${styles.buttonSpinner}`}
                                  />
                                  報名中…
                                </span>
                              ) : (
                                '參加活動'
                              )}
                            </button>
                          );
                        })()
                      )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className={styles.loadMoreArea}>
          {isLoadingMore && (
            <div className={styles.statusRow} role="status" aria-live="polite">
              <div className={styles.spinner} aria-hidden="true" />
              <span>載入更多活動…</span>
            </div>
          )}

          {loadMoreError && (
            <div className={styles.errorCard} role="alert">
              {loadMoreError}
              <button
                type="button"
                className={styles.retryButton}
                onClick={loadMore}
                disabled={
                  isLoadingMore || isLoadingEvents || isCreating || isFormOpen
                }
              >
                重試
              </button>
            </div>
          )}

          {!hasMore && events.length > 0 && (
            <div className={styles.endHint}>已經到底了</div>
          )}

          <div
            ref={sentinelRef}
            className={styles.sentinel}
            aria-hidden="true"
          />
        </div>
      </div>

      {user?.uid && !isFormOpen && (
        <button
          type="button"
          onClick={handleToggleCreateRunForm}
          className={styles.mainButton}
        >
          ＋ 新增跑步揪團
        </button>
      )}

      {isFilterOpen && (
        <div
          className={styles.filterOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="篩選活動"
          onMouseDown={(e) => {
            // 點背景關閉
            if (e.target === e.currentTarget) setFilterOpen(false);
          }}
        >
          <div
            className={styles.filterCard}
            onMouseDown={(e) => {
              // 防止點卡片時觸發背景關閉
              e.stopPropagation();
            }}
          >
            <div className={styles.filterHeader}>
              <div className={styles.filterHeaderTitle}>篩選活動</div>
              <button
                type="button"
                className={styles.filterCloseButton}
                aria-label="關閉篩選"
                onClick={() => setFilterOpen(false)}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className={styles.filterBody}>
              {/* 1) 是否還有名額 (移至最前) */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>名額狀況</label>
                <div className={styles.filterToggleRow}>
                  <span className={styles.filterToggleLabel}>
                    只顯示還有名額的活動
                  </span>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={filterHasSeatsOnly}
                      onChange={(e) => setFilterHasSeatsOnly(e.target.checked)}
                    />
                    <span className={`${styles.slider} ${styles.round}`} />
                  </label>
                </div>
              </div>

              {/* 2) 揪團人 (MVP 隱藏) */}
              {/*
              <div className={styles.filterGroup}>
                <label htmlFor="filterHost" className={styles.filterLabel}>
                  揪團人
                </label>
                ...
              </div>
              */}

              {/* 2) 活動日期/時間 */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>活動時間</label>
                <div className={styles.filterRow}>
                  <div className={styles.filterRowItem}>
                    <input
                      type="datetime-local"
                      className={styles.filterTextField}
                      value={filterTimeStart}
                      onChange={(e) => setFilterTimeStart(e.target.value)}
                      aria-label="活動開始時間（起）"
                    />
                  </div>
                  <span className={styles.filterSeparator}>至</span>
                  <div className={styles.filterRowItem}>
                    <input
                      type="datetime-local"
                      className={styles.filterTextField}
                      value={filterTimeEnd}
                      onChange={(e) => setFilterTimeEnd(e.target.value)}
                      aria-label="活動開始時間（迄）"
                    />
                  </div>
                </div>
              </div>

              {/* 3) 報名截止時間 (MVP 隱藏) */}
              {/*
              <div className={styles.filterGroup}>
                ...
              </div>
              */}

              {/* 4) 跑步距離 (km) */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>跑步距離 (km)</label>
                <div className={styles.filterRow}>
                  <div className={styles.filterRowItem}>
                    <input
                      type="number"
                      className={styles.filterTextField}
                      placeholder="最小距離"
                      min="0"
                      step="0.1"
                      value={filterDistanceMin}
                      onChange={(e) => setFilterDistanceMin(e.target.value)}
                    />
                  </div>
                  <span className={styles.filterSeparator}>-</span>
                  <div className={styles.filterRowItem}>
                    <input
                      type="number"
                      className={styles.filterTextField}
                      placeholder="最大距離"
                      min="0"
                      step="0.1"
                      value={filterDistanceMax}
                      onChange={(e) => setFilterDistanceMax(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 5) 配速 (分:秒) (MVP 隱藏) */}
              {/*
              <div className={styles.filterGroup}>
                ...
              </div>
              */}

              {/* 7) 縣市 + 區 */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>活動區域</label>
                <div className={styles.filterRow}>
                  <select
                    className={`${styles.selectField} ${styles.flex1}`}
                    value={filterCity}
                    aria-label="選擇縣市"
                    onChange={(e) => {
                      setFilterCity(e.target.value);
                      setFilterDistrict('');
                    }}
                  >
                    <option value="">所有縣市</option>
                    {Object.keys(taiwanLocations).map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>

                  <select
                    className={`${styles.selectField} ${styles.flex1}`}
                    value={filterDistrict}
                    aria-label="選擇區域"
                    onChange={(e) => setFilterDistrict(e.target.value)}
                    disabled={!filterCity}
                  >
                    <option value="">所有區域</option>
                    {filterCity
                      && taiwanLocations[filterCity]?.map((dist) => (
                        <option key={dist} value={dist}>
                          {dist}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* 8) 限制人數 (MVP 隱藏) */}
              {/*
              <div className={styles.filterGroup}>
                ...
              </div>
              */}

              {/* 9) 跑步類型 (MVP 隱藏) */}
              {/*
              <div className={styles.filterGroup}>
                ...
              </div>
              */}

              {/* 底部按鈕區 */}
              <div className={styles.filterActions}>
                <button
                  type="button"
                  className={styles.filterClearButton}
                  onClick={handleClearFilters}
                >
                  清除
                </button>
                <button
                  type="button"
                  className={styles.filterCancelButton}
                  onClick={() => setFilterOpen(false)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={styles.filterSearchButton}
                  onClick={handleSearchFilters}
                >
                  搜尋
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.uid && isFormOpen && (
        <div className={styles.formOverlay}>
          <form className={styles.googleFormCard} onSubmit={handleSubmit}>
            <div className={styles.formHeaderAccent} />

            <div className={styles.formHeader}>
              <h2>揪團表單</h2>
              <p className={styles.formDescription}>
                請填寫詳細資訊讓跑友們加入
              </p>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="hostName">揪團人</label>
              <input
                id="hostName"
                type="text"
                name="hostName"
                value={hostName}
                readOnly
                aria-readonly="true"
                placeholder="將自動帶入您的會員名稱"
              />
              <div className={styles.focusBorder} />
              <small className={styles.helperText}>
                由登入帳號自動帶入，無法修改
              </small>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="title">活動名稱</label>
              <input
                id="title"
                type="text"
                name="title"
                required
                placeholder="例如：大安森林公園輕鬆跑"
                defaultValue={draftFormData?.title || ''}
              />
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="time">活動時間</label>
              <input
                id="time"
                type="datetime-local"
                name="time"
                min={minDateTime}
                required
                defaultValue={draftFormData?.time || ''}
              />
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="registrationDeadline">報名截止時間</label>
              <input
                id="registrationDeadline"
                type="datetime-local"
                name="registrationDeadline"
                min={minDateTime}
                required
                defaultValue={draftFormData?.registrationDeadline || ''}
              />
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label>活動區域</label>
              <div className={styles.flexRowGap10}>
                <select
                  name="city"
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    setSelectedDistrict('');
                  }}
                  required
                  className={`${styles.selectField} ${styles.flex1}`}
                >
                  <option value="" disabled>
                    請選擇縣市
                  </option>
                  {Object.keys(taiwanLocations).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>

                <select
                  name="district"
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  required
                  className={`${styles.selectField} ${styles.flex1}`}
                >
                  <option value="" disabled>
                    請選擇區域
                  </option>
                  {selectedCity
                    && taiwanLocations[selectedCity]?.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="meetPlace">集合地點</label>
              <input
                id="meetPlace"
                type="text"
                name="meetPlace"
                required
                placeholder="例如：大安森林公園 2號出口"
                defaultValue={draftFormData?.meetPlace || ''}
              />
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="runType">跑步類型</label>
              <select
                name="runType"
                id="runType"
                className={styles.selectField}
                required
                defaultValue={draftFormData?.runType || ''}
              >
                <option value="" disabled>
                  請選擇跑步類型
                </option>
                <option value="easy_run">輕鬆慢跑（Easy Run）</option>
                <option value="long_run">長距離慢跑（Long Run）</option>
                <option value="tempo_run">節奏跑（Tempo Run）</option>
                <option value="interval_training">
                  間歇訓練（Interval Training）
                </option>
                <option value="hill_training">坡度訓練（Hill Training）</option>
                <option value="fartlek">變速跑（Fartlek）</option>
                <option value="trail_run">越野跑（Trail Run）</option>
                <option value="social_run">休閒社交跑（Social Run）</option>
              </select>
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="distanceKm">距離（公里）</label>
              <input
                id="distanceKm"
                name="distanceKm"
                type="number"
                min="0.1"
                step="0.1"
                required
                placeholder="10"
                defaultValue={draftFormData?.distanceKm || ''}
              />
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label>目標配速（每公里）</label>
              <div
                className={`${styles.flexRowGap10} ${styles.flexAlignCenter}`}
              >
                <select
                  name="paceMinutes"
                  className={`${styles.selectField} ${styles.centerSelect}`}
                  required
                  defaultValue={draftFormData?.paceMinutes || ''}
                  aria-label="分鐘"
                >
                  <option value="" disabled hidden />
                  {[...Array(19)].map((_, i) => (
                    <option key={i} value={String(i + 2).padStart(2, '0')}>
                      {i + 2}
                    </option>
                  ))}
                </select>
                <span className={styles.paceUnit}>分</span>
                <select
                  name="paceSeconds"
                  className={`${styles.selectField} ${styles.centerSelect}`}
                  required
                  defaultValue={draftFormData?.paceSeconds || ''}
                  aria-label="秒"
                >
                  <option value="" disabled hidden />
                  {[...Array(60).keys()].map((s) => {
                    const label = String(s).padStart(2, '0');
                    return (
                      <option key={s} value={label}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <span className={styles.paceUnit}>秒</span>
              </div>
              <div className={styles.focusBorder} />
              <small className={styles.helperText}>
                請選擇每公里的配速時間
              </small>
            </div>

            <div className={styles.formGroup}>
              <label>是否需要繪製活動路線？</label>
              <div className={styles.radioGroup}>
                <label>
                  <input
                    type="radio"
                    name="planRoute"
                    value="yes"
                    required
                    defaultChecked={draftFormData?.planRoute === 'yes'}
                    onChange={() => setShowMap(true)}
                  />
                  {' '}
                  是
                </label>
                <label>
                  <input
                    type="radio"
                    name="planRoute"
                    value="no"
                    required
                    defaultChecked={draftFormData?.planRoute === 'no'}
                    onChange={() => {
                      setShowMap(false);
                      setRouteCoordinates(null);
                    }}
                  />
                  {' '}
                  否
                </label>
              </div>
              <div className={styles.focusBorder} />
            </div>

            {showMap && (
              <div className={styles.formGroup}>
                <label>繪製活動路線</label>
                <EventMap onRouteDrawn={setRouteCoordinates} />
                {routeCoordinates && (
                  <p className={styles.helperText}>
                    路線已繪製，包含
                    {' '}
                    {routeCoordinates.length}
                    {' '}
                    個點。
                  </p>
                )}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="maxParticipants">人數上限</label>
              <input
                id="maxParticipants"
                name="maxParticipants"
                type="number"
                min="2"
                defaultValue={draftFormData?.maxParticipants || '2'}
              />
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="description">活動說明</label>
              <textarea
                id="description"
                name="description"
                rows="4"
                placeholder="請說明活動內容、注意事項、集合細節等"
                className={styles.textareaField}
                defaultValue={draftFormData?.description || ''}
              />
              <div className={styles.focusBorder} />
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setFormOpen(false)}
                disabled={isCreating}
              >
                取消
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={isCreating}
              >
                {isCreating ? '建立中…' : '建立活動'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
