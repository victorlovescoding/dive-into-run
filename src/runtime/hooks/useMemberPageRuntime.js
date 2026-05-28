'use client';

import { useCallback, useContext, useRef, useState } from 'react';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
import { updateUserName, updateUserPhotoURL } from '@/repo/client/firebase-users-repo';
import { uploadUserAvatar } from '@/runtime/client/use-cases/avatar-upload-use-cases';
import { requestAccountDeletion } from '@/runtime/client/use-cases/account-deletion-use-cases';

const AVATAR_UPLOAD_ERROR_MESSAGE = '上傳大頭貼失敗，請稍後再試';
const NAME_UPDATE_ERROR_MESSAGE = '更新名稱失敗，請稍後再試';
const ACCOUNT_DELETION_ERROR_MESSAGE = '刪除帳號申請失敗，請稍後再試';

/**
 * member page runtime orchestration。
 * @returns {object} member page state 與 handlers。
 */
export default function useMemberPageRuntime() {
  const { user, loading } = useContext(AuthContext);
  const { showToast } = useToast();
  const userName = user?.name ?? '';
  const [nameDraft, setNameDraft] = useState(() => ({
    sourceName: userName,
    value: userName,
  }));
  const name = nameDraft.sourceName === userName ? nameDraft.value : userName;
  const [accountDeletionModalOpen, setAccountDeletionModalOpen] = useState(false);
  const [accountDeletionSubmitting, setAccountDeletionSubmitting] = useState(false);
  const [accountDeletionError, setAccountDeletionError] = useState(null);
  const inputFileRef = useRef(null);

  const onNameChange = useCallback(
    /**
     * @param {import('react').ChangeEvent<HTMLInputElement>} event - name input 變更事件。
     */
    (event) => {
      setNameDraft({
        sourceName: userName,
        value: event.target.value,
      });
    },
    [userName],
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

  const openAccountDeletionModal = useCallback(() => {
    setAccountDeletionError(null);
    setAccountDeletionModalOpen(true);
  }, []);

  const closeAccountDeletionModal = useCallback(() => {
    if (accountDeletionSubmitting) return;
    setAccountDeletionModalOpen(false);
    setAccountDeletionError(null);
  }, [accountDeletionSubmitting]);

  const confirmAccountDeletion = useCallback(async () => {
    if (!user || accountDeletionSubmitting) return;

    setAccountDeletionSubmitting(true);
    setAccountDeletionError(null);

    try {
      await requestAccountDeletion(user);
      setAccountDeletionModalOpen(false);
      showToast('帳號已排程刪除，30 天內可以取消', 'success');
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : ACCOUNT_DELETION_ERROR_MESSAGE;
      setAccountDeletionError(message || ACCOUNT_DELETION_ERROR_MESSAGE);
      showToast(ACCOUNT_DELETION_ERROR_MESSAGE, 'error');
    } finally {
      setAccountDeletionSubmitting(false);
    }
  }, [accountDeletionSubmitting, showToast, user]);

  return {
    user,
    loading,
    name,
    inputFileRef,
    onNameChange,
    triggerFilePicker,
    onAvatarFileChange,
    onSubmitNewName,
    accountDeletion: {
      modalOpen: accountDeletionModalOpen,
      submitting: accountDeletionSubmitting,
      error: accountDeletionError,
      openModal: openAccountDeletionModal,
      closeModal: closeAccountDeletionModal,
      confirmDeletion: confirmAccountDeletion,
    },
  };
}
