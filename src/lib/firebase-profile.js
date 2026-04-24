/**
 * @typedef {import('@/service/profile-mapper').PublicProfile} PublicProfile
 * @typedef {import('@/service/profile-service').ProfileStats} ProfileStats
 * @typedef {import('@/service/profile-service').HostedEventsPage} HostedEventsPage
 */

export {
  getUserProfile,
  getProfileStats,
  getHostedEvents,
  updateUserBio,
} from '@/service/profile-service';
