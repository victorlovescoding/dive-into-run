import {
  createAuthUser,
  ensureUserProfileDocument,
  subscribeToAuthChanges,
  watchUserProfileDocument,
} from '@/service/auth-service';

/**
 * 啟動 auth/profile 的 runtime orchestration。
 * @param {object} params - callbacks。
 * @param {(user: { uid: string, name: string | null, email: string | null, photoURL: string | null, bio: string | null, getIdToken: () => Promise<string> } | null) => void} params.setUser - 更新使用者。
 * @param {(loading: boolean) => void} params.setLoading - 更新 loading 狀態。
 * @param {(error: unknown) => void} [params.onError] - 錯誤回呼。
 * @returns {() => void} 退訂函式。
 */
export default function watchAuthUserSession({ setUser, setLoading, onError }) {
  /** @type {(() => void) | null} */
  let unsubscribeProfile = null;

  const unsubscribeAuth = subscribeToAuthChanges(async (fbUser) => {
    try {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setLoading(true);

      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      await ensureUserProfileDocument(fbUser);
      unsubscribeProfile = watchUserProfileDocument(
        fbUser.uid,
        (profileData) => {
          setUser(createAuthUser(fbUser, profileData));
          setLoading(false);
        },
        (error) => {
          onError?.(error);
          setLoading(false);
        },
      );
    } catch (error) {
      onError?.(error);
      setUser(null);
      setLoading(false);
    }
  });

  return () => {
    if (unsubscribeProfile) {
      unsubscribeProfile();
      unsubscribeProfile = null;
    }

    unsubscribeAuth();
  };
}
