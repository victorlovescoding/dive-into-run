/**
 * @typedef {import('@/service/event-service').EventData} EventData
 * @typedef {import('@/service/event-service').JoinResult} JoinResult
 * @typedef {import('@/service/event-service').LeaveResult} LeaveResult
 */

export { normalizeEventPayload, EVENT_NOT_FOUND_MESSAGE } from '@/service/event-service';
export {
  createEvent,
  fetchLatestEvents,
  queryEvents,
  fetchEventById,
  fetchNextEvents,
  joinEvent,
  leaveEvent,
  fetchParticipants,
  fetchMyJoinedEventsForIds,
  updateEvent,
  deleteEvent,
} from '@/runtime/client/use-cases/event-use-cases';
