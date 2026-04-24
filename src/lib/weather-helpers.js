export {
  getForecastIds,
  countyShort,
  townshipShort,
  formatLocationName,
  formatLocationNameShort,
} from '@/service/weather-location-service';

export {
  ISLAND_MARKERS,
  getWeatherIconUrl,
  encodeLocationParams,
  decodeLocationParams,
  saveLastLocation,
  loadLastLocation,
} from '@/runtime/client/use-cases/weather-location-use-cases';

/** @typedef {import('@/service/weather-location-service').IslandMarker} IslandMarker */
/** @typedef {import('@/service/weather-location-service').StoredLocation} StoredLocation */
