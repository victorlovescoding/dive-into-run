'use client';

import { createContext, useEffect, useMemo, useState } from 'react';
import watchAuthUserSession from '@/runtime/client/use-cases/auth-use-cases';

/**
 * @typedef {object} AuthContextValue
 * @property {{ uid: string, name: string | null, email: string | null, photoURL: string | null, bio: string | null, getIdToken: () => Promise<string> } | null} user - 當前登入使用者。
 * @property {(user: AuthContextValue['user']) => void} setUser - 設定使用者。
 * @property {boolean} loading - 驗證狀態載入中。
 */

export const AuthContext = /** @type {import('react').Context<AuthContextValue>} */ (
  createContext({
    user: null,
    setUser: () => {},
    loading: true,
  })
);

/**
 * 提供使用者驗證狀態的 Context Provider。
 * @param {object} props - 元件 props。
 * @param {import('react').ReactNode} props.children - 子元件。
 * @returns {import('react').ReactElement} AuthContext Provider。
 */
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => watchAuthUserSession({ setUser, setLoading, onError: console.error }), []);

  const value = useMemo(() => ({ user, setUser, loading }), [user, setUser, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
