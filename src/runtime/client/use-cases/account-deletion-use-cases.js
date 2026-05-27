import {
  reauthenticateCurrentUserWithGoogle,
  signOutUser,
} from '@/service/auth-service';

/**
 * Reads a JSON body without failing on empty responses.
 * @param {Response} response - Fetch response.
 * @returns {Promise<Record<string, unknown>>} Parsed JSON object.
 */
async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

/**
 * Reads a fresh Firebase ID token from an authenticated user.
 * @param {{ getIdToken?: (forceRefresh?: boolean) => Promise<string> } | null} user - Auth user.
 * @returns {Promise<string>} Fresh ID token.
 */
async function getFreshIdToken(user) {
  if (!user?.getIdToken) {
    throw new Error('No authenticated user');
  }

  return user.getIdToken(true);
}

/**
 * Calls the account deletion API with a bearer token.
 * @param {{ getIdToken?: (forceRefresh?: boolean) => Promise<string> }} user - Auth user.
 * @param {'GET' | 'POST' | 'DELETE'} method - HTTP method.
 * @returns {Promise<Record<string, unknown>>} API response body.
 */
async function requestAccountDeletionApi(user, method) {
  const token = await getFreshIdToken(user);
  const response = await fetch('/api/account/deletion', {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(String(body.error || 'Account deletion request failed'));
  }

  return body;
}

/**
 * Fetches the current account deletion status.
 * @param {{ getIdToken?: (forceRefresh?: boolean) => Promise<string> }} user - Auth user.
 * @returns {Promise<Record<string, unknown>>} API response body.
 */
export async function fetchAccountDeletionStatus(user) {
  return requestAccountDeletionApi(user, 'GET');
}

/**
 * Confirms Google sign-in and requests account deletion.
 * @param {{ getIdToken?: (forceRefresh?: boolean) => Promise<string> }} user - Auth user.
 * @returns {Promise<Record<string, unknown>>} API response body.
 */
export async function requestAccountDeletion(user) {
  await reauthenticateCurrentUserWithGoogle();
  return requestAccountDeletionApi(user, 'POST');
}

/**
 * Cancels a pending account deletion request.
 * @param {{ getIdToken?: (forceRefresh?: boolean) => Promise<string> }} user - Auth user.
 * @returns {Promise<Record<string, unknown>>} API response body.
 */
export async function cancelAccountDeletion(user) {
  return requestAccountDeletionApi(user, 'DELETE');
}

export { signOutUser };
