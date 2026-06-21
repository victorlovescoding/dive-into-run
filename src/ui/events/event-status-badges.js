import { isDeadlinePassed } from '@/service/event-service';

export const EVENT_AVAILABILITY_BADGE_LABELS = {
  full: '額滿',
  closed: '已截止',
  open: '報名中',
};

export const EVENT_AVAILABILITY_BADGE_STYLE_KEYS = {
  full: 'eventStatusBadgeFull',
  closed: 'eventStatusBadgeClosed',
  open: 'eventStatusBadgeOpen',
};

/**
 * 取得活動列表卡的報名狀態 badge；額滿優先於截止。
 * @param {object} event - 活動資料。
 * @param {number} remainingSeats - 由既有剩餘名額 helper 算出的名額。
 * @returns {'full' | 'closed' | 'open'} 報名狀態 badge key。
 */
export function getEventAvailabilityBadgeState(event, remainingSeats) {
  if (remainingSeats <= 0) return 'full';
  if (isDeadlinePassed(event)) return 'closed';
  return 'open';
}

/**
 * 取得登入使用者在活動列表卡上的個人狀態 badge。
 * @param {object} params - 判斷個人狀態所需資料。
 * @param {object} params.event - 活動資料。
 * @param {string} params.eventId - 活動 ID。
 * @param {{ uid: string } | null | undefined} params.user - 目前登入使用者。
 * @param {'checking' | 'joined' | 'notJoined' | undefined} params.membershipStatus - 會員狀態。
 * @param {Set<string>} params.myJoinedEventIds - 使用者已加入的活動 ID 集合。
 * @returns {'' | '你是主揪' | '你已報名'} 個人狀態 badge 文字。
 */
export function getEventPersonalBadgeLabel({
  event,
  eventId,
  user,
  membershipStatus,
  myJoinedEventIds,
}) {
  if (!user?.uid) return '';
  if (user.uid === event.hostUid) return '你是主揪';
  if (membershipStatus === 'joined' || myJoinedEventIds.has(eventId)) return '你已報名';
  return '';
}
