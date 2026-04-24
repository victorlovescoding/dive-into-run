export {
  ensureUserProfileDocument,
  subscribeToAuthChanges,
  watchUserProfileDocument,
} from '@/repo/client/firebase-auth-repo';

/**
 * @typedef {object} AuthProfileData
 * @property {string | null} [name] 顯示名稱。
 * @property {string | null} [email] 電子郵件。
 * @property {string | null} [photoURL] 頭像網址。
 * @property {string | null} [bio] 個人簡介。
 */

/**
 * 將 Firebase Auth 使用者與 Firestore profile 整合成 provider 使用的 user 物件。
 * @param {import('firebase/auth').User} fbUser - Firebase Auth 使用者物件。
 * @param {AuthProfileData | null} profileData - Firestore profile data。
 * @returns {{ uid: string, name: string | null, email: string | null, photoURL: string | null, bio: string | null, getIdToken: () => Promise<string> }} 使用者物件。
 */
export function createAuthUser(fbUser, profileData) {
  return {
    uid: fbUser.uid,
    name: profileData?.name ?? null,
    email: profileData?.email ?? null,
    photoURL: profileData?.photoURL ?? null,
    bio: profileData?.bio ?? null,
    getIdToken: () => fbUser.getIdToken(),
  };
}
