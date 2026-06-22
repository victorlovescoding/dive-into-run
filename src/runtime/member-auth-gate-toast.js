export const MEMBER_AUTH_GATE_TOAST_MESSAGE = '請先登入才能進入會員中心';
export const MEMBER_AUTH_GATE_TOAST_STORAGE_KEY = 'dive.memberAuthGateToastPending';
export const MEMBER_AUTH_GATE_RETURN_TO_STORAGE_KEY = 'dive.memberAuthGateReturnTo';

const MEMBER_AUTH_GATE_RETURN_TO_MAX_LENGTH = 1024;
const MEMBER_AUTH_GATE_RETURN_TO_BASE_URL = 'https://dive-into-run.invalid';

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
 * Checks for ASCII control characters without using a control-char regexp.
 * @param {string} value - Candidate path.
 * @returns {boolean} True when a control character is present.
 */
function hasControlCharacter(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }

  return false;
}

/**
 * Checks whether a canonical pathname stays inside the member area.
 * @param {string} pathname - Canonical pathname.
 * @returns {boolean} True when the path targets a member page.
 */
function isMemberPath(pathname) {
  return pathname === '/member' || pathname.startsWith('/member/');
}

/**
 * Canonicalizes a pathname the same way browser URL parsing handles dot segments.
 * @param {string} value - Candidate path.
 * @returns {string | null} Canonical pathname, or null when parsing fails.
 */
function canonicalizePathname(value) {
  try {
    return new URL(value, MEMBER_AUTH_GATE_RETURN_TO_BASE_URL).pathname;
  } catch {
    return null;
  }
}

/**
 * Validates a protected member return path for same-origin redirects.
 * @param {unknown} value - Candidate return path.
 * @returns {string | null} Safe member path, or null when invalid.
 */
function normalizeMemberAuthGateReturnTo(value) {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > MEMBER_AUTH_GATE_RETURN_TO_MAX_LENGTH) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (hasControlCharacter(value)) return null;

  const pathname = canonicalizePathname(value);
  if (!pathname || !isMemberPath(pathname)) return null;

  return pathname;
}

/**
 * Reads the current protected member pathname without query or hash state.
 * @returns {string | null} Safe current return path when available.
 */
function getCurrentMemberAuthGateReturnTo() {
  if (typeof window === 'undefined') return null;

  return normalizeMemberAuthGateReturnTo(window.location.pathname);
}

/**
 * Marks that the next completed home navigation should show the member auth toast.
 * @returns {void}
 */
export function markMemberAuthGateToastPending() {
  const storage = getSessionStorage();
  const returnTo = getCurrentMemberAuthGateReturnTo();

  try {
    storage?.setItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY, '1');
    if (returnTo) {
      storage?.setItem(MEMBER_AUTH_GATE_RETURN_TO_STORAGE_KEY, returnTo);
    } else {
      storage?.removeItem(MEMBER_AUTH_GATE_RETURN_TO_STORAGE_KEY);
    }
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

/**
 * Consumes one pending member auth return path after auth succeeds.
 * @returns {string | null} Safe member return path when available.
 */
export function consumeMemberAuthGateReturnTo() {
  const storage = getSessionStorage();

  try {
    const returnTo = normalizeMemberAuthGateReturnTo(
      storage?.getItem(MEMBER_AUTH_GATE_RETURN_TO_STORAGE_KEY),
    );

    storage?.removeItem(MEMBER_AUTH_GATE_RETURN_TO_STORAGE_KEY);
    return returnTo;
  } catch {
    return null;
  }
}
