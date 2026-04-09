import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, provider } from '@/lib/firebase-client';

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
