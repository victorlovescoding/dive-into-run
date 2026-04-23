'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthContext } from '@/runtime/providers/AuthProvider';

const MISSING_CODE_MESSAGE = '授權失敗：未取得授權碼。';
const LOGIN_REQUIRED_MESSAGE = '連結失敗：請先登入。';
const SERVER_ERROR_MESSAGE = '連結失敗：伺服器回應錯誤，請稍後再試。';
const NETWORK_ERROR_MESSAGE = '連結失敗：網路錯誤，請稍後再試。';

/**
 * 判斷 callback search params 狀態。
 * @param {URLSearchParams} searchParams - URL search params。
 * @returns {{ hasError: boolean, code: string | null }} 解析結果。
 */
function parseSearchParams(searchParams) {
  const error = searchParams.get('error');
  const code = searchParams.get('code');
  return { hasError: Boolean(error) || !code, code };
}

/**
 * 送出 OAuth code 至 callback API。
 * @param {string} code - Strava OAuth authorization code。
 * @param {string} idToken - Firebase ID token。
 * @returns {Promise<boolean>} 是否交換成功。
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
  await response.json();
  return response.ok;
}

/**
 * strava callback runtime orchestration。
 * @returns {{ status: 'loading' | 'error', errorMessage?: string, message: string }} callback 畫面狀態。
 */
export default function useStravaCallbackRuntime() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useContext(AuthContext);
  const { hasError, code } = parseSearchParams(searchParams);
  const [asyncFailure, setAsyncFailure] = useState({ key: '', message: '' });
  const calledRef = useRef('');
  const requestKey = user?.uid && code ? `${user.uid}:${code}` : '';
  const blockingErrorMessage = hasError
    ? MISSING_CODE_MESSAGE
    : !authLoading && !user
      ? LOGIN_REQUIRED_MESSAGE
      : '';
  const asyncErrorMessage = asyncFailure.key === requestKey ? asyncFailure.message : '';
  const errorMessage = blockingErrorMessage || asyncErrorMessage;

  useEffect(() => {
    if (hasError || authLoading || !user || !code || !requestKey) {
      return undefined;
    }
    if (calledRef.current === requestKey) {
      return undefined;
    }
    calledRef.current = requestKey;

    let cancelled = false;

    /** 送出 code exchange 並處理 redirect / failure。 */
    async function run() {
      try {
        const idToken = await user.getIdToken();
        const ok = await exchangeCode(/** @type {string} */ (code), idToken);

        if (ok) {
          router.replace('/runs');
          return;
        }

        if (!cancelled) {
          setAsyncFailure({ key: requestKey, message: SERVER_ERROR_MESSAGE });
        }
      } catch {
        if (!cancelled) {
          setAsyncFailure({ key: requestKey, message: NETWORK_ERROR_MESSAGE });
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [authLoading, code, hasError, requestKey, router, user]);

  return {
    status: errorMessage ? 'error' : 'loading',
    errorMessage,
    message: '正在連結 Strava 帳號...',
  };
}
