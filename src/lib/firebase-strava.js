/** @typedef {import('@/repo/client/firebase-strava-repo').StravaConnection} StravaConnection */
/** @typedef {import('@/repo/client/firebase-strava-repo').StravaActivity} StravaActivity */

export {
  listenStravaConnection,
  getStravaActivities,
  getStravaActivitiesByMonth,
} from '@/repo/client/firebase-strava-repo';
