import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, provider } from '@/config/client/firebase-client';

/**
 * 使用 Google 帳號登入。
 * @returns {Promise<import('firebase/auth').UserCredential>} 登入結果。
 * @throws {Error} 登入失敗時拋出錯誤。
 */
export async function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

/**
 * 登出目前使用者。
 * @returns {Promise<void>}
 * @throws {Error} 登出失敗時拋出錯誤。
 */
export async function signOutUser() {
  return signOut(auth);
}

/**
 * 訂閱 Firebase Auth 狀態變化。UI 整合層（Contexts/Hooks）以此取代直接呼叫 onAuthStateChanged。
 * @param {(user: import('firebase/auth').User | null) => void} callback - 狀態變化時呼叫；登出時傳入 null。
 * @returns {() => void} 退訂函式。呼叫以停止監聽，務必在 cleanup 時執行以避免 memory leak。
 */
export function subscribeToAuthChanges(callback) {
  return onAuthStateChanged(auth, callback);
}
