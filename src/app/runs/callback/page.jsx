'use client';

import { Suspense, useState, useEffect, useRef, useContext } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import styles from './callback.module.css';

/**
 * 判斷 search params 是否包含錯誤或缺少 code。
 * @param {URLSearchParams} searchParams - URL search params。
 * @returns {{ hasError: boolean, code: string | null }} 解析結果。
 */
function parseSearchParams(searchParams) {
  const error = searchParams.get('error');
  const code = searchParams.get('code');
  const hasError = Boolean(error) || !code;
  return { hasError, code };
}

/**
 * 送出 OAuth code 至後端 callback API 交換 token。
 * @param {string} code - Strava OAuth authorization code。
 * @param {string} idToken - Firebase ID token。
 * @returns {Promise<{ ok: boolean, data: Record<string, unknown> }>} API 回應。
 */
async function exchangeCode(code, idToken) {
  const response = await fetch('/api/strava/callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ code }),
  });
  const data = await response.json();
  return { ok: response.ok, data };
}

/**
 * Strava OAuth callback 頁面內層 — 使用 useSearchParams 需在 Suspense 內。
 * @returns {import('react').ReactElement} Callback 內容。
 */
function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useContext(AuthContext);

  const { hasError, code } = parseSearchParams(searchParams);
  const [status, setStatus] = useState(hasError ? 'error' : 'loading');
  const [errorMsg, setErrorMsg] = useState(hasError ? '授權失敗：未取得授權碼。' : '');
  const calledRef = useRef(false);

  useEffect(() => {
    if (hasError || authLoading || !user) return;
    if (calledRef.current) return;
    calledRef.current = true;

    const run = async () => {
      try {
        const idToken = await user.getIdToken();
        const { ok } = await exchangeCode(/** @type {string} */ (code), idToken);

        if (ok) {
          router.replace('/runs');
        } else {
          setStatus('error');
          setErrorMsg('連結失敗：伺服器回應錯誤，請稍後再試。');
        }
      } catch {
        setStatus('error');
        setErrorMsg('連結失敗：網路錯誤，請稍後再試。');
      }
    };

    run();
  }, [hasError, authLoading, user, code, router]);

  // Auth 載入完成但無使用者 — 直接在 render 判斷
  if (!authLoading && !user && !hasError) {
    return (
      <div className={styles.container}>
        <p className={styles.errorMessage} role="alert">
          連結失敗：請先登入。
        </p>
        <Link href="/runs" className={styles.link}>
          返回跑步頁面
        </Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.container}>
        <p className={styles.errorMessage} role="alert">
          {errorMsg}
        </p>
        <Link href="/runs" className={styles.link}>
          返回跑步頁面
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.spinner} role="status" aria-label="載入中" />
      <p className={styles.message}>正在連結 Strava 帳號...</p>
    </div>
  );
}

/**
 * Strava OAuth callback 頁面。
 * 以 Suspense 包裝 CallbackContent 以支援 useSearchParams 的 static generation。
 * @returns {import('react').ReactElement} Callback page。
 */
export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.spinner} role="status" aria-label="載入中" />
          <p className={styles.message}>載入中...</p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
