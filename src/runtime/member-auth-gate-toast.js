export const MEMBER_AUTH_GATE_TOAST_MESSAGE = '請先登入才能進入會員中心';
export const MEMBER_AUTH_GATE_TOAST_STORAGE_KEY = 'dive.memberAuthGateToastPending';

/**
 * Safely returns tab-scoped sessionStorage for client-side redirect state.
 * @returns {Storage | null} Session storage when available.
 */
function getSessionStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Marks that the next completed home navigation should show the member auth toast.
 * @returns {void}
 */
export function markMemberAuthGateToastPending() {
  const storage = getSessionStorage();

  try {
    storage?.setItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY, '1');
  } catch {
    // Ignore unavailable storage operations during redirect setup.
  }
}

/**
 * Consumes one pending member auth toast marker.
 * @returns {boolean} True when a pending toast marker was consumed.
 */
export function consumeMemberAuthGateToastPending() {
  const storage = getSessionStorage();

  try {
    if (storage?.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY) !== '1') return false;

    storage.removeItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
