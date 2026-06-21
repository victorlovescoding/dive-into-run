import type { ReactElement, ReactNode, Context } from 'react';

export type ToastItem = {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  createdAt: number;
  action?: ToastItemAction;
  actions?: ToastItemAction[];
};

export type ToastItemAction = {
  label: string;
  callback: () => void;
};

export type ToastReducerAction = {
  type: 'ADD' | 'REMOVE' | 'CLEAR_ALL';
  payload?: ToastItem | string;
};

export type ToastAction = ToastReducerAction;

export type ToastContextValue = {
  toasts: ToastItem[];
  showToast: (
    message: string,
    type?: 'success' | 'error' | 'info',
    action?: ToastItemAction | ToastItemAction[],
  ) => void;
  removeToast: (id: string) => void;
};

export const ToastContext: Context<ToastContextValue | undefined>;
export function toastReducer(state: ToastItem[], action: ToastReducerAction): ToastItem[];
export function useToast(): ToastContextValue;
export default function ToastProvider(props: { children: ReactNode }): ReactElement;
