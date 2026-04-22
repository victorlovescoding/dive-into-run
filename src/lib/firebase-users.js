// 這個檔案專門處理 Firestore 中使用者資料的讀寫與監聽
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/client/firebase-client';

/**
 * 登入時檢查使用者資料，若 Firestore 無資料則自動建立。
 * @param {import('firebase/auth').User} fbUser - Firebase Auth 使用者物件。
 * @returns {Promise<void>}
 */
export async function loginCheckUserData(fbUser) {
  try {
    const docRef = doc(db, 'users', fbUser.uid);
    const docSnap = await getDoc(docRef);
    // 預計把有資料的狀況刪除，拿資料的工作交給watchUserProfile
    if (!docSnap.exists()) {
      // docSnap.data() will be undefined in this case
      console.warn('No such document!');
      // 資料庫沒有使用者資料就要新增一個document
      const newUser = {
        name: fbUser.displayName,
        email: fbUser.email,
        uid: fbUser.uid,
        photoURL: fbUser.photoURL,
        createdAt: serverTimestamp(),
      };
      await setDoc(docRef, newUser, { merge: true });
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * 更新使用者顯示名稱。
 * @param {string} uid - 使用者 UID。
 * @param {string} newUserName - 新的顯示名稱。
 * @returns {Promise<void>}
 */
export async function updateUserName(uid, newUserName) {
  const safeName = (newUserName ?? '').trim();
  if (!uid) {
    throw new Error('沒有uid');
  }
  if (!safeName) {
    throw new Error('沒有名字');
  }
  // 更新資料庫
  await setDoc(
    doc(db, 'users', uid),
    { name: safeName, nameChangedAt: serverTimestamp() },
    { merge: true },
  ); // setDoc第一個參數是整份文件而不是name
}

// 這裡要再一個監聽的function
/**
 * 即時監聽使用者個人資料變更。
 * @param {string} uid - 使用者 UID。
 * @param {(data: object | null) => void} onData - 資料變更時的回呼。
 * @param {(err: Error) => void} onError - 監聽錯誤時的回呼。
 * @returns {() => void} 取消監聽的函式。
 */
export function watchUserProfile(uid, onData, onError) {
  // onData是發現資料更改時要做的事情
  if (!uid) throw new Error('uid required');
  // onSnapshot要在登出/離開/刷新/關分頁時做清理
  const docRef = doc(db, 'users', uid);
  const unSubProfile = onSnapshot(
    docRef,
    (snap) => {
      onData?.(snap.data() ?? null);
    },
    (err) => {
      onError?.(err);
    },
  );
  return unSubProfile;
}

// 拿著新的url更新firestore的網址
/**
 * 更新 Firestore 中使用者的大頭貼網址。
 * @param {string} url - 新的大頭貼網址。
 * @param {string} uid - 使用者 UID。
 * @returns {Promise<void>}
 */
export async function updateUserPhotoURL(url, uid) {
  if (!url) {
    throw new Error('沒有url');
  }
  if (!uid) {
    throw new Error('沒有uid');
  }
  await setDoc(
    doc(db, 'users', uid),
    { photoURL: url, photoUpdatedAt: serverTimestamp() },
    { merge: true },
  );
}
// onSnapshot 少了「拿資料的回呼」，這樣不會把任何資料丟回來。
