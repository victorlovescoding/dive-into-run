import type { ReactElement, ReactNode, Context } from 'react';

export type ToastItem = {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  createdAt: number;
};

export type ToastAction = {
  type: 'ADD' | 'REMOVE' | 'CLEAR_ALL';
  payload?: ToastItem | string;
};

export type ToastContextValue = {
  toasts: ToastItem[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
};

export const ToastContext: Context<ToastContextValue | undefined>;
export function toastReducer(state: ToastItem[], action: ToastAction): ToastItem[];
export function useToast(): ToastContextValue;
export default function ToastProvider(props: { children: ReactNode }): ReactElement;
