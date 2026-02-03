// 這個檔案是用來管理Context和使用者狀態

'use client';

import { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase-client'; // 依你的路徑調整
import { loginCheckUserData, watchUserProfile } from '@/lib/firebase-users';

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  loading: true,
});

/**
 *
 * @param root0
 * @param root0.children
 */
export default function UserDataHandler({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let unSubProfile = null; // 保存 users/{uid} 監聽的退訂函式
    const unSubAuth = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (unSubProfile) { unSubProfile(); unSubProfile = null; }// 每次觸發onAuthStateChanged都會執行watchUserProfile，如果不先清空就會有多個watchUserProfile同時活著
        setLoading(true);
        if (!fbUser) { setUser(null); setLoading(false); return; }
        await loginCheckUserData(fbUser);// loginCheckUserData和watchUserProfile做的事情有點重複都是要拿資料回來，需要修改
        unSubProfile = watchUserProfile(
          fbUser.uid,
          (data) => {
            setUser({
              uid: fbUser.uid,
              name: data?.name ?? null,
              email: data?.email ?? null,
              photoURL: data?.photoURL ?? null,
            });
            setLoading(false);
          },
          (err) => {
            console.error(err);
            setLoading(false);
          },
        );
      } catch (e) {
        console.error(e);
        setUser(null); // 或保留前值
        setLoading(false);
      }
    });

    return () => {
      if (unSubProfile) {
        unSubProfile();
        unSubProfile = null;
      }
      unSubAuth();
    };
  }, []);
  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>{children}</AuthContext.Provider>
  );
}
