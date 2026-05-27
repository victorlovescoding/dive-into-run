import {
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { ACCOUNT_DELETION_STATUS_ACTIVE } from '@/config/account-deletion';
import { auth, db, provider } from '@/config/client/firebase-client';

/**
 * 使用 Google 帳號登入。
 * @returns {Promise<import('firebase/auth').UserCredential>} 登入結果。
 */
export async function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

/**
 * 以 Google popup 重新驗證目前使用者。
 * @returns {Promise<import('firebase/auth').UserCredential>} reauth 結果。
 */
export async function reauthenticateCurrentUserWithGoogle() {
  if (!auth.currentUser) {
    throw new Error('No current user');
  }

  return reauthenticateWithPopup(auth.currentUser, provider);
}

/**
 * 登出目前使用者。
 * @returns {Promise<void>}
 */
export async function signOutUser() {
  return signOut(auth);
}

/**
 * 訂閱 Firebase Auth 狀態變化。
 * @param {(user: import('firebase/auth').User | null) => void} callback - 狀態變化回呼。
 * @returns {() => void} 退訂函式。
 */
export function subscribeToAuthChanges(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * 登入時檢查使用者資料，若 Firestore 無資料則自動建立。
 * @param {import('firebase/auth').User} fbUser - Firebase Auth 使用者物件。
 * @returns {Promise<void>}
 */
export async function ensureUserProfileDocument(fbUser) {
  const docRef = doc(db, 'users', fbUser.uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    const newUser = {
      name: fbUser.displayName,
      email: fbUser.email,
      uid: fbUser.uid,
      photoURL: fbUser.photoURL,
      accountStatus: ACCOUNT_DELETION_STATUS_ACTIVE,
      createdAt: serverTimestamp(),
    };
    await setDoc(docRef, newUser, { merge: true });
  }
}

/**
 * 即時監聽使用者個人資料變更。
 * @param {string} uid - 使用者 UID。
 * @param {(data: { name?: string | null, email?: string | null, photoURL?: string | null, bio?: string | null, accountStatus?: string | null, deletionScheduledFor?: unknown } | null) => void} onData - 資料變更時的回呼。
 * @param {(err: Error) => void} onError - 監聽錯誤時的回呼。
 * @returns {() => void} 取消監聽的函式。
 */
export function watchUserProfileDocument(uid, onData, onError) {
  if (!uid) {
    throw new Error('uid required');
  }

  const docRef = doc(db, 'users', uid);
  return onSnapshot(
    docRef,
    (snap) => {
      onData?.(
        /** @type {{ name?: string | null, email?: string | null, photoURL?: string | null, bio?: string | null, accountStatus?: string | null, deletionScheduledFor?: unknown } | null} */ (
          snap.data() ?? null
        ),
      );
    },
    (err) => {
      onError?.(err);
    },
  );
}
