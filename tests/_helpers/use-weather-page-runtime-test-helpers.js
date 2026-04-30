export const GEO_LOOKUP = {
  countyCodeByName: {
    臺北市: '63000',
    新北市: '65000',
    臺東縣: '10014',
  },
  countyNameByCode: {
    '63000': '臺北市',
    '65000': '新北市',
    '10014': '臺東縣',
  },
  townshipByCode: {
    '65000010': {
      townshipName: '板橋區',
      countyCode: '65000',
      countyName: '新北市',
    },
  },
};

export const USER = {
  uid: 'user-1',
  name: 'Test User',
  email: 'user@example.com',
  photoURL: '',
  bio: null,
  getIdToken: async () => 'token',
};

export const COUNTY_LOCATION = {
  countyCode: '63000',
  countyName: '臺北市',
  townshipCode: null,
  townshipName: null,
  displaySuffix: null,
};

export const TOWNSHIP_LOCATION = {
  countyCode: '65000',
  countyName: '新北市',
  townshipCode: '65000010',
  townshipName: '板橋區',
  displaySuffix: null,
};

/**
 * @param {string} locationName - 顯示地點名。
 * @param {string} weatherCode - 天氣代碼。
 * @param {number} currentTemp - 當前溫度。
 * @returns {{ ok: true, data: import('@/types/weather-types').WeatherInfo }} weather payload。
 */
export function createWeatherPayload(locationName, weatherCode, currentTemp) {
  return {
    ok: true,
    data: {
      locationName,
      locationNameShort: locationName,
      today: {
        currentTemp,
        weatherDesc: '晴時多雲',
        weatherCode,
        morningTemp: currentTemp + 1,
        eveningTemp: currentTemp - 3,
        rainProb: 10,
        humidity: 72,
        uv: null,
        aqi: null,
      },
      tomorrow: {
        weatherDesc: '多雲',
        weatherCode: '04',
        morningTemp: currentTemp,
        eveningTemp: currentTemp - 2,
        rainProb: 20,
        humidity: 78,
        uv: null,
      },
    },
  };
}

/**
 * @param {string} id - favorite id。
 * @param {typeof COUNTY_LOCATION} location - favorite location。
 * @returns {{ id: string } & typeof COUNTY_LOCATION} favorite fixture。
 */
export function createFavorite(id, location) {
  return { id, ...location };
}

/**
 * @param {Array<{ id: string } & typeof COUNTY_LOCATION>} favorites - favorite docs。
 * @returns {{ empty: boolean, docs: Array<{ id: string, data: () => object }> }} snapshot。
 */
export function createSnapshot(favorites) {
  return {
    empty: favorites.length === 0,
    docs: favorites.map((favorite) => ({ id: favorite.id, data: () => favorite })),
  };
}
