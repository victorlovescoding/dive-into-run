'use client';

import { useToast } from '@/contexts/ToastContext';
import Toast from '@/components/Toast';
import styles from './ToastContainer.module.css';

/**
 * Toast 列表容器，fixed 定位於畫面底部。
 * 從 ToastContext 取得 toasts 陣列並渲染。
 * @returns {import('react').ReactElement | null} Toast 容器元件。
 */
export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container} aria-live="polite" aria-relevant="additions removals">
      {toasts.map((toast) => (
        // @ts-expect-error — key 是 React 特殊 prop，不在 Toast JSDoc 型別中但為合法用法
        <Toast key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
}
