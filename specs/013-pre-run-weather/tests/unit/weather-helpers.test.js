import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getForecastIds,
  ISLAND_MARKERS,
  countyShort,
  townshipShort,
  formatLocationName,
  formatLocationNameShort,
  encodeLocationParams,
  decodeLocationParams,
  saveLastLocation,
  loadLastLocation,
} from '@/lib/weather-helpers';

describe('getForecastIds', () => {
  it('returns threeHour and twelveHour IDs for a valid county', () => {
    const result = getForecastIds('臺北市');

    expect(result).toEqual({
      threeHour: 'F-D0047-061',
      twelveHour: 'F-D0047-063',
    });
  });

  it('returns null for an unknown county', () => {
    const result = getForecastIds('火星市');

    expect(result).toBeNull();
  });

  it('covers all 22 counties', () => {
    const counties = [
      '宜蘭縣',
      '桃園市',
      '新竹縣',
      '苗栗縣',
      '彰化縣',
      '南投縣',
      '雲林縣',
      '嘉義縣',
      '屏東縣',
      '臺東縣',
      '花蓮縣',
      '澎湖縣',
      '基隆市',
      '新竹市',
      '嘉義市',
      '臺北市',
      '高雄市',
      '新北市',
      '臺中市',
      '臺南市',
      '連江縣',
      '金門縣',
    ];

    counties.forEach((county) => {
      const ids = getForecastIds(county);
      expect(ids).not.toBeNull();
      expect(ids).toHaveProperty('threeHour');
      expect(ids).toHaveProperty('twelveHour');
    });
    expect(counties).toHaveLength(22);
  });
});

describe('ISLAND_MARKERS', () => {
  it('has exactly 4 items', () => {
    expect(ISLAND_MARKERS).toHaveLength(4);
  });

  it('each item has all required fields', () => {
    ISLAND_MARKERS.forEach((marker) => {
      expect(marker).toHaveProperty('id');
      expect(marker).toHaveProperty('displayName');
      expect(marker).toHaveProperty('lat');
      expect(marker).toHaveProperty('lng');
      expect(marker).toHaveProperty('targetCounty');
      expect(marker).toHaveProperty('targetTownship');
      expect(marker).toHaveProperty('displaySuffix');
      expect(marker).toHaveProperty('polygonIndex');
    });
  });

  it('only guishandao has a numeric polygonIndex', () => {
    const guishan = ISLAND_MARKERS.find((m) => m.id === 'guishandao');
    const others = ISLAND_MARKERS.filter((m) => m.id !== 'guishandao');

    expect(guishan?.polygonIndex).toBe(0);
    others.forEach((m) => expect(m.polygonIndex).toBeNull());
  });

  it('routes 蘭嶼 to 臺東縣/蘭嶼鄉', () => {
    const lanyu = ISLAND_MARKERS.find((m) => m.id === 'lanyu');

    expect(lanyu).toBeDefined();
    expect(lanyu?.targetCounty).toBe('臺東縣');
    expect(lanyu?.targetTownship).toBe('蘭嶼鄉');
  });

  it('龜山島 has displaySuffix, others are null', () => {
    const guishandao = ISLAND_MARKERS.find((m) => m.id === 'guishandao');
    const others = ISLAND_MARKERS.filter((m) => m.id !== 'guishandao');

    expect(guishandao?.displaySuffix).toBe('（含龜山島）');
    others.forEach((marker) => {
      expect(marker.displaySuffix).toBeNull();
    });
  });
});

describe('countyShort', () => {
  it.each([
    ['臺北市', '臺北'],
    ['新北市', '新北'],
    ['嘉義縣', '嘉義'],
    ['連江縣', '連江'],
  ])('%s → %s', (input, expected) => {
    expect(countyShort(input)).toBe(expected);
  });
});

describe('townshipShort', () => {
  it.each([
    ['大安區', '大安'],
    ['蘭嶼鄉', '蘭嶼'],
    ['頭城鎮', '頭城'],
    ['板橋區', '板橋'],
    ['琉球鄉', '琉球'],
  ])('%s → %s', (input, expected) => {
    expect(townshipShort(input)).toBe(expected);
  });
});

describe('formatLocationName', () => {
  it('returns county name when township is null', () => {
    expect(formatLocationName('臺北市', null, null)).toBe('臺北市');
  });

  it('joins county and township with middle dot', () => {
    expect(formatLocationName('臺東縣', '蘭嶼鄉', null)).toBe('臺東縣 · 蘭嶼鄉');
  });

  it('appends displaySuffix when provided', () => {
    expect(formatLocationName('宜蘭縣', '頭城鎮', '（含龜山島）')).toBe(
      '宜蘭縣 · 頭城鎮（含龜山島）',
    );
  });
});

describe('formatLocationNameShort', () => {
  it('returns short county when township is null', () => {
    expect(formatLocationNameShort('臺北市', null)).toBe('臺北');
  });

  it('joins short county and short township', () => {
    expect(formatLocationNameShort('新北市', '板橋區')).toBe('新北 · 板橋');
  });
});

describe('encodeLocationParams / decodeLocationParams', () => {
  it('encodes county only', () => {
    expect(encodeLocationParams('63000', null)).toBe('county=63000');
  });

  it('encodes county + township', () => {
    expect(encodeLocationParams('63000', '63000060')).toBe('county=63000&township=63000060');
  });

  it('decodes county only', () => {
    const params = new URLSearchParams('county=63000');

    expect(decodeLocationParams(params)).toEqual({
      countyCode: '63000',
      townshipCode: null,
    });
  });

  it('decodes county + township', () => {
    const params = new URLSearchParams('county=63000&township=63000060');

    expect(decodeLocationParams(params)).toEqual({
      countyCode: '63000',
      townshipCode: '63000060',
    });
  });

  it('returns null when no county param', () => {
    const params = new URLSearchParams('');

    expect(decodeLocationParams(params)).toBeNull();
  });
});

describe('saveLastLocation / loadLastLocation', () => {
  /** @type {Record<string, string>} */
  let store;

  beforeEach(() => {
    store = {};
    const mockStorage = {
      getItem: (/** @type {string} */ key) => store[key] ?? null,
      setItem: (/** @type {string} */ key, /** @type {string} */ value) => {
        store[key] = value;
      },
      removeItem: (/** @type {string} */ key) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (/** @type {number} */ index) => Object.keys(store)[index] ?? null,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('save then load returns same data', () => {
    const location = {
      countyCode: '63000',
      countyName: '臺北市',
      townshipCode: '63000060',
      townshipName: '大安區',
    };

    saveLastLocation(location);
    const loaded = loadLastLocation();

    expect(loaded).toEqual(location);
  });

  it('load with no saved data returns null', () => {
    expect(loadLastLocation()).toBeNull();
  });

  it('load with corrupted JSON returns null', () => {
    store['dive-weather-last-location'] = '{invalid json';

    expect(loadLastLocation()).toBeNull();
  });
});
