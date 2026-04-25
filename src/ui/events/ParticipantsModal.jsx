import UserLink from '@/components/UserLink';
import styles from './EventDetailScreen.module.css';

/**
 * @typedef {object} Participant
 * @property {string} [uid] - 參加者的使用者 ID。
 * @property {string} [id] - 備用 ID（uid 不存在時使用）。
 * @property {string} [name] - 參加者顯示名稱。
 * @property {string} [photoURL] - 參加者大頭貼網址。
 */

/**
 * @typedef {object} ParticipantsModalProps
 * @property {Participant[]} participants - 參加者清單。
 * @property {boolean} loading - 是否正在載入參加者資料。
 * @property {string | null} error - 載入錯誤訊息，無錯誤時為 null。
 * @property {boolean} isOpen - 是否顯示 modal。
 * @property {() => void} onClose - 關閉 modal 的 callback。
 * @property {() => void} onRetry - 載入失敗時重試的 callback。
 * @property {import('react').RefObject<HTMLDivElement>} overlayRef - overlay DOM ref，用於 focus 管理。
 * @property {string} hostUid - 活動主揪的 uid，用於標示「主揪」徽章。
 */

/**
 * 參加名單 modal，顯示活動的參加者清單。
 * @param {ParticipantsModalProps} props - modal 所需的 props。
 * @returns {import('react').ReactElement | null} modal 元素，未開啟時回傳 null。
 */
export default function ParticipantsModal({
  participants,
  loading,
  error,
  isOpen,
  onClose,
  onRetry,
  overlayRef,
  hostUid,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      className={styles.participantsOverlay}
      tabIndex={-1}
    >
      <div className={styles.participantsCard}>
        <div className={styles.participantsHeader}>
          <div className={styles.participantsTitle}>參加名單</div>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            關閉
          </button>
        </div>

        <div className={styles.participantsBody}>
          {loading && (
            <div
              className={`${styles.statusRow} ${styles.marginBottom12}`}
              role="status"
              aria-live="polite"
            >
              <div className={styles.spinner} aria-hidden="true" />
              <span>正在載入參加名單…</span>
            </div>
          )}

          {error && (
            <div className={styles.errorCard} role="alert">
              {error}
              <button
                type="button"
                className={`${styles.retryButton} ${styles.marginLeft10}`}
                onClick={onRetry}
              >
                重試
              </button>
            </div>
          )}

          {!loading && !error && participants.length === 0 ? (
            <div className={styles.emptyHint}>目前還沒有人報名</div>
          ) : (
            <div className={styles.participantsList}>
              {participants.map((participant) => (
                <div
                  key={String(participant.uid || participant.id)}
                  className={styles.participantItem}
                >
                  <UserLink
                    uid={String(participant.uid || participant.id)}
                    name={participant.name || '（未命名）'}
                    photoURL={participant.photoURL}
                    size={36}
                    className={styles.participantLink}
                  />
                  <div className={styles.participantStatus}>
                    {participant.uid === hostUid ? '主揪' : '已參加'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
