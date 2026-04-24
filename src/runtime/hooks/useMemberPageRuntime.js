'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
import { updateUserName, updateUserPhotoURL } from '@/repo/client/firebase-users-repo';
import { uploadUserAvatar } from '@/runtime/client/use-cases/avatar-upload-use-cases';

const AVATAR_UPLOAD_ERROR_MESSAGE = '上傳大頭貼失敗，請稍後再試';
const NAME_UPDATE_ERROR_MESSAGE = '更新名稱失敗，請稍後再試';

/**
 * member page runtime orchestration。
 * @returns {object} member page state 與 handlers。
 */
export default function useMemberPageRuntime() {
  const { user, loading } = useContext(AuthContext);
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const inputFileRef = useRef(null);

  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  const onNameChange = useCallback(
    /**
     * @param {import('react').ChangeEvent<HTMLInputElement>} event - name input 變更事件。
     */
    (event) => {
      setName(event.target.value);
    },
    [],
  );

  const triggerFilePicker = useCallback(() => {
    if (user) {
      inputFileRef.current?.click();
    }
  }, [user]);

  const onAvatarFileChange = useCallback(
    /**
     * @param {import('react').ChangeEvent<HTMLInputElement>} event - file input 事件。
     */
    async (event) => {
      const file = event.target.files?.[0];
      if (!file || !user) return;
      const input = event.target;

      try {
        const url = await uploadUserAvatar(file, user.uid);
        await updateUserPhotoURL(url, user.uid);
      } catch (error) {
        console.error(error);
        showToast(AVATAR_UPLOAD_ERROR_MESSAGE, 'error');
      } finally {
        input.value = '';
      }
    },
    [showToast, user],
  );

  const onSubmitNewName = useCallback(
    /**
     * @param {import('react').FormEvent<HTMLFormElement>} event - form submit 事件。
     */
    async (event) => {
      event.preventDefault();
      if (!user || loading) return;

      const safeName = (name ?? '').trim();
      if (!safeName || safeName === (user.name ?? '')) return;

      try {
        await updateUserName(user.uid, safeName);
      } catch (error) {
        console.error(error);
        showToast(NAME_UPDATE_ERROR_MESSAGE, 'error');
      }
    },
    [loading, name, showToast, user],
  );

  return {
    user,
    loading,
    name,
    inputFileRef,
    onNameChange,
    triggerFilePicker,
    onAvatarFileChange,
    onSubmitNewName,
  };
}
