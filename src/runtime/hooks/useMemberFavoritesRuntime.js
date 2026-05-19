'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
import {
  addContentFavorite,
  FAVORITE_CONTENT_TYPES,
  loadContentFavoritesWithTargets,
  removeContentFavorite,
} from '@/runtime/client/use-cases/content-favorite-use-cases';

const REMOVE_SUCCESS_MESSAGE = '已取消收藏';
const REMOVE_ERROR_MESSAGE = '取消收藏失敗，請稍後再試';
const RESTORE_ERROR_MESSAGE = '恢復收藏失敗，請稍後再試';

const FAVORITE_TABS = Object.freeze([
  Object.freeze({
    id: 'member-favorites-tab-posts',
    panelId: 'member-favorites-panel-posts',
    label: '收藏文章',
    type: FAVORITE_CONTENT_TYPES.POST,
    emptyText: '尚未收藏任何文章',
  }),
  Object.freeze({
    id: 'member-favorites-tab-events',
    panelId: 'member-favorites-panel-events',
    label: '收藏活動',
    type: FAVORITE_CONTENT_TYPES.EVENT,
    emptyText: '尚未收藏任何活動',
  }),
]);

/**
 * Creates the default runtime bucket for one favorite type.
 * @returns {{ items: object[], isLoading: boolean, error: string }} Empty bucket.
 */
function createBucket() {
  return { items: [], isLoading: false, error: '' };
}

/**
 * Creates the default favorite buckets by content type.
 * @returns {Record<string, { items: object[], isLoading: boolean, error: string }>} Empty state.
 */
function createFavoritesState() {
  return {
    [FAVORITE_CONTENT_TYPES.POST]: createBucket(),
    [FAVORITE_CONTENT_TYPES.EVENT]: createBucket(),
  };
}

/**
 * Member favorites page runtime orchestration.
 * @returns {object} Favorite tabs, active list state, and favorite mutation handlers.
 */
export default function useMemberFavoritesRuntime() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const { showToast } = useToast();
  const uid = user?.uid;
  const [activeIndex, setActiveIndex] = useState(0);
  const [favoritesByType, setFavoritesByType] = useState(() => createFavoritesState());
  const favoritesRef = useRef(favoritesByType);
  const requestIdsRef = useRef({
    [FAVORITE_CONTENT_TYPES.POST]: 0,
    [FAVORITE_CONTENT_TYPES.EVENT]: 0,
  });

  const activeTab = FAVORITE_TABS[activeIndex] ?? FAVORITE_TABS[0];
  const activeType = activeTab.type;
  const activeBucket = favoritesByType[activeType] ?? createBucket();

  const commitTypeBucket = useCallback((type, nextBucket) => {
    const nextState = {
      ...favoritesRef.current,
      [type]: nextBucket,
    };
    favoritesRef.current = nextState;
    setFavoritesByType(nextState);
  }, []);

  const loadType = useCallback(
    async (type) => {
      if (!uid || authLoading) {
        commitTypeBucket(type, createBucket());
        return;
      }

      const requestId = requestIdsRef.current[type] + 1;
      requestIdsRef.current = {
        ...requestIdsRef.current,
        [type]: requestId,
      };

      const previousBucket = favoritesRef.current[type] ?? createBucket();
      commitTypeBucket(type, {
        ...previousBucket,
        isLoading: true,
        error: '',
      });

      try {
        const items = await loadContentFavoritesWithTargets({
          uid,
          type,
        });
        if (requestIdsRef.current[type] !== requestId) return;
        commitTypeBucket(type, {
          items,
          isLoading: false,
          error: '',
        });
      } catch (error) {
        console.error(error);
        if (requestIdsRef.current[type] !== requestId) return;
        commitTypeBucket(type, {
          items: [],
          isLoading: false,
          error: '收藏內容載入失敗，請稍後再試',
        });
      }
    },
    [authLoading, commitTypeBucket, uid],
  );

  useEffect(() => {
    favoritesRef.current = favoritesByType;
  }, [favoritesByType]);

  useEffect(() => {
    loadType(activeType);
  }, [activeType, loadType]);

  const selectTab = useCallback((index) => {
    if (index < 0 || index >= FAVORITE_TABS.length) return;
    setActiveIndex(index);
  }, []);

  const handleTabKeyDown = useCallback(
    /**
     * @param {import('react').KeyboardEvent<HTMLButtonElement>} event - Tab keyboard event.
     */
    (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        selectTab((activeIndex + 1) % FAVORITE_TABS.length);
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        selectTab((activeIndex + FAVORITE_TABS.length - 1) % FAVORITE_TABS.length);
      }

      if (event.key === 'Home') {
        event.preventDefault();
        selectTab(0);
      }

      if (event.key === 'End') {
        event.preventDefault();
        selectTab(FAVORITE_TABS.length - 1);
      }
    },
    [activeIndex, selectTab],
  );

  const removeFavorite = useCallback(
    async (item) => {
      if (!uid || !item) return;

      const { type } = item;
      const previousBucket = favoritesRef.current[type] ?? createBucket();
      commitTypeBucket(type, {
        ...previousBucket,
        items: previousBucket.items.filter((favorite) => favorite.targetId !== item.targetId),
      });

      try {
        await removeContentFavorite({
          uid,
          type,
          targetId: item.targetId,
        });

        showToast(REMOVE_SUCCESS_MESSAGE, 'success', {
          label: '復原',
          callback: async () => {
            const beforeRestoreBucket = favoritesRef.current[type] ?? createBucket();
            commitTypeBucket(type, {
              ...beforeRestoreBucket,
              items: [item, ...beforeRestoreBucket.items],
            });

            try {
              await addContentFavorite({
                uid,
                type,
                targetId: item.targetId,
              });
              await loadType(type);
            } catch (error) {
              console.error(error);
              const rollbackBucket = favoritesRef.current[type] ?? createBucket();
              commitTypeBucket(type, {
                ...rollbackBucket,
                items: rollbackBucket.items.filter(
                  (favorite) => favorite.targetId !== item.targetId,
                ),
              });
              showToast(RESTORE_ERROR_MESSAGE, 'error');
            }
          },
        });
      } catch (error) {
        console.error(error);
        commitTypeBucket(type, previousBucket);
        showToast(REMOVE_ERROR_MESSAGE, 'error');
      }
    },
    [commitTypeBucket, loadType, showToast, uid],
  );

  return {
    activeIndex,
    activeType,
    activeTab,
    tabs: FAVORITE_TABS.map((tab, index) => ({
      ...tab,
      tabIndex: index,
      isActive: index === activeIndex,
      bucket: favoritesByType[tab.type] ?? createBucket(),
    })),
    items: activeBucket.items,
    isLoading: activeBucket.isLoading,
    error: activeBucket.error,
    selectTab,
    handleTabKeyDown,
    removeFavorite,
  };
}
