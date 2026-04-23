import { NextResponse } from 'next/server';
import getWeatherForecast, {
  getWeatherForecastErrorStatus,
} from '@/service/weather-forecast-service';

const CACHE_HEADERS = { 'Cache-Control': 's-maxage=600, stale-while-revalidate=300' };

/**
 * Handle weather API GET requests by delegating query parsing and error mapping to the forecast service.
 * @param {Request} request Incoming Next.js route request.
 * @returns {Promise<Response>} JSON weather response with cache headers or mapped error status.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  try {
    const data = await getWeatherForecast({
      county: searchParams.get('county'),
      township: searchParams.get('township'),
    });

    return NextResponse.json({ ok: true, data }, { headers: CACHE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch weather data' },
      { status: getWeatherForecastErrorStatus(error) },
    );
  }
}
