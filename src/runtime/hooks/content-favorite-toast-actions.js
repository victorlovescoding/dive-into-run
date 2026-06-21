'use client';

import { removeContentFavorite } from '@/runtime/client/use-cases/content-favorite-use-cases';

const MEMBER_FAVORITES_PATH = '/member/favorites';
const UNDO_FAVORITE_ERROR_MESSAGE = '復原收藏失敗，請稍後再試';

/**
 * Builds the success toast actions for a newly added content favorite.
 * @param {object} params - Action collaborators.
 * @param {{ push: (href: string) => void }} params.router - App router used for navigation.
 * @param {string} params.uid - Favorite owner uid.
 * @param {string} params.type - Content favorite type.
 * @param {string} params.targetId - Favorited content id.
 * @param {() => void} params.onUndoSuccess - Local state sync after undo succeeds.
 * @param {(message: string, type?: 'success' | 'error' | 'info') => void} params.showToast - Toast dispatcher.
 * @returns {{ label: string, callback: () => void | Promise<void> }[]} Toast actions.
 */
export default function createContentFavoriteSuccessActions({
  router,
  uid,
  type,
  targetId,
  onUndoSuccess,
  showToast,
}) {
  return [
    {
      label: '查看收藏',
      callback: () => {
        router.push(MEMBER_FAVORITES_PATH);
      },
    },
    {
      label: '復原',
      callback: async () => {
        try {
          await removeContentFavorite({ uid, type, targetId });
          onUndoSuccess();
        } catch (error) {
          console.error('復原 content favorite 失敗:', error);
          showToast(UNDO_FAVORITE_ERROR_MESSAGE, 'error');
        }
      },
    },
  ];
}
