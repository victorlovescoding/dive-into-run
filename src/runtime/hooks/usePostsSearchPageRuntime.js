/* eslint-disable max-lines -- Posts search runtime owns search, pagination, and result interactions. */
'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  deletePost,
  fetchPostHistory,
  hasUserLikedPosts,
  searchPublicActivePosts,
  toggleLikePost,
  updatePost,
  validatePostInput,
} from '@/runtime/client/use-cases/post-use-cases';
import {
  FAVORITE_CONTENT_TYPES,
  addContentFavorite,
  getFavoritedTargetIds,
  removeContentFavorite,
} from '@/runtime/client/use-cases/content-favorite-use-cases';
import {
  applyPostSearchMatchFavoriteState,
  applyPostSearchMatchLikeState,
  createComposerDraft,
  hydratePostSearchMatches,
  mergeUniquePostSearchMatches,
  removePostSearchMatchByPostId,
} from '@/runtime/hooks/usePostsPageRuntimeHelpers';
import {
  loadPostComposerDraft,
  removePostComposerDraft,
  savePostComposerDraft,
} from '@/repo/client/post-composer-draft-storage-repo';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
import useEditHistoryModal from '@/runtime/hooks/useEditHistoryModal';

const PAGE_SIZE = 10;
const EMPTY_RESULTS = [];
const OBSERVER_MARGIN = '300px 0px';
const SEARCH_ERROR_MESSAGE = '搜尋失敗，請稍後再試';

/**
 * 更新搜尋結果中的 nested post，同時保留 match metadata。
 * @param {Array<{ post: { id: string } }>} previousMatches - 既有搜尋結果。
 * @param {string} postId - 編輯中的文章 ID。
 * @param {string} title - 新標題。
 * @param {string} content - 新內文。
 * @returns {Array<{ post: { id: string } }>} 更新後搜尋結果。
 */
function replaceEditedSearchMatchPost(previousMatches, postId, title, content) {
  return previousMatches.map((match) =>
    match.post.id === postId
      ? {
          ...match,
          post: {
            ...match.post,
            title: title.trim(),
            content: content.trim(),
            isEdited: true,
          },
        }
      : match,
  );
}

/**
 * @typedef {'idle' | 'loading' | 'success' | 'empty' | 'loadingMore' | 'error'} SearchStatus
 */

/**
 * @typedef {object} SearchState
 * @property {string} keyword - 這批搜尋 state 對應的 URL keyword。
 * @property {Array<object>} results - 搜尋結果 matches。
 * @property {SearchStatus} status - 目前搜尋載入狀態。
 * @property {unknown} error - 搜尋失敗原因。
 * @property {unknown} nextCursor - 下一頁搜尋 cursor。
 * @property {boolean} hasMore - 是否還有下一頁。
 * @property {number} scannedCount - use-case 掃描過的候選數量。
 */

/**
 * posts search 頁 runtime orchestration，負責 URL q 驗證、初始搜尋與搜尋表單導頁。
 * @returns {object} 搜尋頁 state 與 handlers。
 */
export default function usePostsSearchPageRuntime() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const keyword = searchParams.get('q')?.trim() ?? '';
  const [searchDraft, setSearchDraft] = useState(() => ({
    keyword,
    value: keyword,
  }));
  const [searchState, setSearchState] = useState(
    /** @returns {SearchState} 初始搜尋狀態。 */
    () => ({
      keyword,
      results: [],
      status: keyword ? 'loading' : 'idle',
      error: null,
      nextCursor: null,
      hasMore: false,
      scannedCount: 0,
    }),
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [editingPostId, setEditingPostId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openMenuPostId, setOpenMenuPostId] = useState('');
  const [isDraftConfirmOpen, setIsDraftConfirmOpen] = useState(false);
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const bottomRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const isLoadingNextRef = useRef(false);

  const userUid = user?.uid ?? null;
  const loadArticleHistory = useCallback((targetPost) => fetchPostHistory(targetPost.id), []);
  const {
    historyTarget: articleHistoryPost,
    historyEntries: articleHistoryEntries,
    historyError: articleHistoryError,
    isHistoryOpen: isArticleHistoryOpen,
    handleViewHistory: handleViewArticleHistory,
    handleCloseHistory: handleCloseArticleHistory,
  } = useEditHistoryModal({
    loadHistory: loadArticleHistory,
    loadErrorMessage: '載入編輯記錄失敗',
  });
  const isCurrentSearchState = searchState.keyword === keyword;
  const searchInput = searchDraft.keyword === keyword ? searchDraft.value : keyword;
  const results = isCurrentSearchState ? searchState.results : EMPTY_RESULTS;
  const status = isCurrentSearchState ? searchState.status : keyword ? 'loading' : 'idle';
  const error = isCurrentSearchState ? searchState.error : null;
  const nextCursor = isCurrentSearchState ? searchState.nextCursor : null;
  const hasMore = isCurrentSearchState ? searchState.hasMore : false;
  const scannedCount = isCurrentSearchState ? searchState.scannedCount : 0;
  const isLoadingNext = status === 'loadingMore';
  const errorMessage = status === 'error' ? SEARCH_ERROR_MESSAGE : null;

  /**
   * 套用文章編輯表單 draft。
   * @param {{ title: string, content: string, originalTitle: string, originalContent: string, editingPostId: string | null }} draft - 表單 draft。
   * @returns {void}
   */
  const applyComposerDraft = useCallback((draft) => {
    setTitle(draft.title);
    setContent(draft.content);
    setOriginalTitle(draft.originalTitle);
    setOriginalContent(draft.originalContent);
    setEditingPostId(draft.editingPostId);
  }, []);

  /** 關閉搜尋頁編輯 modal 並清空表單狀態。 */
  const closeAndResetComposer = useCallback(() => {
    applyComposerDraft(createComposerDraft(null));
    setIsDraftConfirmOpen(false);
    dialogRef.current?.close();
  }, [applyComposerDraft]);

  /**
   * 取得目前編輯 draft target。
   * @returns {{ uid: string | null, postId: string | null }} Draft target。
   */
  const getCurrentComposerDraftTarget = useCallback(
    () => ({
      uid: userUid,
      postId: editingPostId ?? null,
    }),
    [editingPostId, userUid],
  );

  /**
   * 執行搜尋 use-case 並補齊當前使用者視角的互動狀態。
   * @param {object} params - 搜尋參數。
   * @param {string} params.targetKeyword - 搜尋關鍵字。
   * @param {unknown} params.cursor - 搜尋分頁 cursor。
   * @returns {Promise<{ items: Array<object>, nextCursor: unknown, hasMore: boolean, scannedCount: number }>}
   *   已補齊互動狀態的搜尋頁。
   */
  const loadSearchPage = useCallback(
    async ({ targetKeyword, cursor }) => {
      const searchPage = await searchPublicActivePosts({
        keyword: targetKeyword,
        userUid,
        pageSize: PAGE_SIZE,
        cursor,
      });
      const searchPosts = searchPage.items.map((match) => match.post);
      const searchPostIds = searchPosts.map((post) => post.id);
      const [likedPostIds, favoritePostIds] = userUid
        ? await Promise.all([
            hasUserLikedPosts(userUid, searchPostIds),
            getFavoritedTargetIds({
              uid: userUid,
              type: FAVORITE_CONTENT_TYPES.POST,
              targetIds: searchPostIds,
            }),
          ])
        : [new Set(), new Set()];

      return {
        items: hydratePostSearchMatches(searchPage.items, userUid, likedPostIds, favoritePostIds),
        nextCursor: searchPage.nextCursor,
        hasMore: searchPage.hasMore,
        scannedCount: searchPage.scannedCount,
      };
    },
    [userUid],
  );

  useEffect(() => {
    if (!keyword) {
      router.replace('/posts');
      return undefined;
    }

    let cancelled = false;

    /** 載入 URL q 對應的第一頁搜尋結果。 */
    async function loadInitialSearchPage() {
      setSearchState({
        keyword,
        results: [],
        status: 'loading',
        error: null,
        nextCursor: null,
        hasMore: false,
        scannedCount: 0,
      });

      try {
        const searchPage = await loadSearchPage({ targetKeyword: keyword, cursor: null });

        if (cancelled) return;
        setSearchState({
          keyword,
          results: searchPage.items,
          status: searchPage.items.length === 0 && !searchPage.hasMore ? 'empty' : 'success',
          error: null,
          nextCursor: searchPage.nextCursor,
          hasMore: searchPage.hasMore,
          scannedCount: searchPage.scannedCount,
        });
      } catch (searchError) {
        if (cancelled) return;
        console.error('搜尋文章失敗:', searchError);
        setSearchState({
          keyword,
          results: [],
          status: 'error',
          error: searchError,
          nextCursor: null,
          hasMore: false,
          scannedCount: 0,
        });
      }
    }

    loadInitialSearchPage();
    return () => {
      cancelled = true;
    };
  }, [keyword, loadSearchPage, router]);

  /**
   * 重新執行目前 URL q 的第一頁搜尋。
   * @returns {Promise<void>} Retry 完成。
   */
  const handleRetrySearch = useCallback(async () => {
    if (!keyword) return;

    setSearchState({
      keyword,
      results: [],
      status: 'loading',
      error: null,
      nextCursor: null,
      hasMore: false,
      scannedCount: 0,
    });

    try {
      const searchPage = await loadSearchPage({ targetKeyword: keyword, cursor: null });
      setSearchState({
        keyword,
        results: searchPage.items,
        status: searchPage.items.length === 0 && !searchPage.hasMore ? 'empty' : 'success',
        error: null,
        nextCursor: searchPage.nextCursor,
        hasMore: searchPage.hasMore,
        scannedCount: searchPage.scannedCount,
      });
    } catch (searchError) {
      console.error('搜尋文章失敗:', searchError);
      setSearchState({
        keyword,
        results: [],
        status: 'error',
        error: searchError,
        nextCursor: null,
        hasMore: false,
        scannedCount: 0,
      });
    }
  }, [keyword, loadSearchPage]);

  /**
   * 載入下一頁搜尋結果，失敗時保留既有結果與 cursor。
   * @returns {Promise<void>} 載入完成。
   */
  const loadMoreSearchResults = useCallback(async () => {
    if (!keyword || !nextCursor || !hasMore || isLoadingNextRef.current) return;

    isLoadingNextRef.current = true;
    setSearchState((previousState) =>
      previousState.keyword === keyword
        ? { ...previousState, status: 'loadingMore', error: null }
        : previousState,
    );

    try {
      const searchPage = await loadSearchPage({ targetKeyword: keyword, cursor: nextCursor });
      setSearchState((previousState) => {
        if (previousState.keyword !== keyword) return previousState;

        const nextResults = mergeUniquePostSearchMatches(previousState.results, searchPage.items);
        return {
          keyword,
          results: nextResults,
          status: nextResults.length === 0 && !searchPage.hasMore ? 'empty' : 'success',
          error: null,
          nextCursor: searchPage.nextCursor,
          hasMore: searchPage.hasMore,
          scannedCount: searchPage.scannedCount,
        };
      });
    } catch (searchError) {
      console.error('搜尋文章失敗:', searchError);
      setSearchState((previousState) =>
        previousState.keyword === keyword
          ? {
              ...previousState,
              status: 'error',
              error: searchError,
            }
          : previousState,
      );
    } finally {
      isLoadingNextRef.current = false;
    }
  }, [hasMore, keyword, loadSearchPage, nextCursor]);

  useEffect(() => {
    const bottomElement = bottomRef.current;

    if (
      !bottomElement ||
      results.length === 0 ||
      !nextCursor ||
      !hasMore ||
      status !== 'success' ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || isLoadingNextRef.current) return;

        observer.unobserve(entry.target);
        loadMoreSearchResults();
      },
      { root: null, threshold: 0, rootMargin: OBSERVER_MARGIN },
    );

    observer.observe(bottomElement);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMoreSearchResults, nextCursor, results.length, status]);

  /**
   * 更新使用者正在編輯的搜尋關鍵字。
   * @param {string} value - 搜尋輸入值。
   * @returns {void}
   */
  const setSearchInput = useCallback(
    (value) => {
      setSearchDraft({ keyword, value });
    },
    [keyword],
  );

  /**
   * 送出搜尋表單並依關鍵字導頁。
   * @param {{ preventDefault?: () => void }} [event] - 表單 submit event。
   * @returns {void}
   */
  const handleSubmitSearch = useCallback(
    (event) => {
      event?.preventDefault?.();
      const nextKeyword = searchInput.trim();
      if (!nextKeyword) {
        router.push('/posts');
        return;
      }

      router.push(`/posts/search?q=${encodeURIComponent(nextKeyword)}`);
    },
    [router, searchInput],
  );

  /**
   * 切換搜尋結果文章按讚，失敗時 rollback。
   * @param {string} postId - 文章 ID。
   */
  const handlePressLike = useCallback(
    async (postId) => {
      const targetMatch = results.find((match) => match.post.id === postId);
      if (!targetMatch) return;

      if (!userUid) {
        showToast('請先登入才能按讚', 'info');
        return;
      }

      const targetPost = targetMatch.post;
      const previousLiked = !!targetPost.liked;
      const previousCount = Number(targetPost.likesCount ?? 0);
      const nextCount = Math.max(0, previousCount + (previousLiked ? -1 : 1));

      setSearchState((previousState) => ({
        ...previousState,
        results: applyPostSearchMatchLikeState(
          previousState.results,
          postId,
          !previousLiked,
          nextCount,
        ),
      }));

      const result = await toggleLikePost(postId, userUid);
      if (result !== 'fail') return;

      setSearchState((previousState) => ({
        ...previousState,
        results: applyPostSearchMatchLikeState(
          previousState.results,
          postId,
          previousLiked,
          previousCount,
        ),
      }));
    },
    [results, showToast, userUid],
  );

  /**
   * 切換搜尋結果文章收藏，失敗時 rollback。
   * @param {string} postId - 文章 ID。
   */
  const handleToggleFavoritePost = useCallback(
    async (postId) => {
      if (!userUid) {
        showToast('請先登入才能收藏', 'info');
        return;
      }

      const targetMatch = results.find((match) => match.post.id === postId);
      if (!targetMatch) return;

      const wasFavorited = !!targetMatch.post.isFavorited;
      setSearchState((previousState) => ({
        ...previousState,
        results: applyPostSearchMatchFavoriteState(
          previousState.results,
          postId,
          !wasFavorited,
        ),
      }));

      try {
        if (wasFavorited) {
          await removeContentFavorite({
            uid: userUid,
            type: FAVORITE_CONTENT_TYPES.POST,
            targetId: postId,
          });
          showToast('已取消收藏', 'success');
          return;
        }

        await addContentFavorite({
          uid: userUid,
          type: FAVORITE_CONTENT_TYPES.POST,
          targetId: postId,
        });
        showToast('已加入收藏', 'success');
      } catch (favoriteError) {
        console.error('Toggle favorite post error:', favoriteError);
        setSearchState((previousState) => ({
          ...previousState,
          results: applyPostSearchMatchFavoriteState(
            previousState.results,
            postId,
            wasFavorited,
          ),
        }));
        showToast(
          wasFavorited ? '取消收藏失敗，請稍後再試' : '收藏失敗，請稍後再試',
          'error',
        );
      }
    },
    [results, showToast, userUid],
  );

  /**
   * 切換搜尋結果作者操作選單。
   * @param {string} postId - 文章 ID。
   * @param {{ stopPropagation?: () => void }} [event] - click event。
   */
  const handleToggleOwnerMenu = useCallback((postId, event) => {
    event?.stopPropagation?.();
    setOpenMenuPostId((currentPostId) => (currentPostId === postId ? '' : postId));
  }, []);

  /** 關閉目前展開的作者操作選單。 */
  const handleCloseOwnerMenu = useCallback(() => {
    setOpenMenuPostId('');
  }, []);

  /**
   * 開啟搜尋結果文章編輯 modal。
   * @param {string} postId - 編輯目標文章 ID。
   * @returns {void}
   */
  const handleEditPost = useCallback(
    (postId) => {
      const targetMatch = results.find((match) => match.post.id === postId);
      const targetPost = targetMatch?.post ?? null;
      if (!targetPost) {
        showToast('文章不存在，無法編輯', 'error');
        return;
      }

      const baseDraft = createComposerDraft(targetPost);
      const savedDraft = userUid
        ? loadPostComposerDraft({ uid: userUid, postId: targetPost.id })
        : null;
      const nextDraft = savedDraft
        ? {
            ...baseDraft,
            title: savedDraft.title,
            content: savedDraft.content,
          }
        : baseDraft;

      applyComposerDraft(nextDraft);
      if (savedDraft) {
        showToast('已恢復草稿');
      }
      setIsDraftConfirmOpen(false);
      setOpenMenuPostId('');
      dialogRef.current?.showModal();
    },
    [applyComposerDraft, results, showToast, userUid],
  );

  /** 使用者要求關閉編輯 modal 時，依 dirty 狀態決定關閉或顯示草稿確認。 */
  const handleRequestComposerClose = useCallback(() => {
    const hasUnsavedEditContent =
      !!editingPostId &&
      (title.trim() !== originalTitle.trim() || content.trim() !== originalContent.trim());

    if (!hasUnsavedEditContent) {
      closeAndResetComposer();
      return;
    }

    setIsDraftConfirmOpen(true);
  }, [
    closeAndResetComposer,
    content,
    editingPostId,
    originalContent,
    originalTitle,
    title,
  ]);

  /** 儲存目前編輯內容為 local draft，並關閉 modal。 */
  const handleSaveComposerDraft = useCallback(() => {
    savePostComposerDraft({
      ...getCurrentComposerDraftTarget(),
      title,
      content,
    });
    closeAndResetComposer();
  }, [closeAndResetComposer, content, getCurrentComposerDraftTarget, title]);

  /** 關閉草稿確認並回到編輯 modal。 */
  const handleContinueEditingDraft = useCallback(() => {
    setIsDraftConfirmOpen(false);
  }, []);

  /** 移除目前文章編輯草稿，並關閉 modal。 */
  const handleDiscardComposerDraft = useCallback(() => {
    removePostComposerDraft(getCurrentComposerDraftTarget());
    closeAndResetComposer();
  }, [closeAndResetComposer, getCurrentComposerDraftTarget]);

  /**
   * 送出搜尋結果文章編輯。
   * @param {{ preventDefault?: () => void }} event - form submit event。
   * @returns {Promise<void>} Submit completion。
   */
  const handleSubmitPost = useCallback(
    async (event) => {
      event.preventDefault?.();

      const validationError = validatePostInput({ title, content });
      if (validationError) {
        showToast(validationError, 'error');
        return;
      }

      if (!editingPostId) return;

      const draftTarget = getCurrentComposerDraftTarget();

      try {
        setIsSubmitting(true);
        await updatePost(editingPostId, { title, content });
        removePostComposerDraft(draftTarget);
        setSearchState((previousState) => ({
          ...previousState,
          results: replaceEditedSearchMatchPost(
            previousState.results,
            editingPostId,
            title,
            content,
          ),
        }));
        showToast('更新文章成功');
        closeAndResetComposer();
      } catch (submitError) {
        console.error('Post submit error:', submitError);
        showToast('更新文章失敗，請稍後再試', 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      closeAndResetComposer,
      content,
      editingPostId,
      getCurrentComposerDraftTarget,
      showToast,
      title,
    ],
  );

  /**
   * 刪除搜尋結果文章。
   * @param {string} postId - 文章 ID。
   */
  const handleDeletePost = useCallback(
    async (postId) => {
      // eslint-disable-next-line no-alert -- 保留既有原生刪除確認流程
      if (!window.confirm('確定要刪除文章？')) return;

      try {
        await deletePost(postId);
        setSearchState((previousState) => ({
          ...previousState,
          results: removePostSearchMatchByPostId(previousState.results, postId),
        }));
        if (openMenuPostId === postId) {
          setOpenMenuPostId('');
        }
        showToast('文章已刪除');
      } catch (deleteError) {
        console.error('Delete post error:', deleteError);
        showToast('刪除文章失敗，請稍後再試', 'error');
      }
    },
    [openMenuPostId, showToast],
  );

  return {
    keyword,
    searchInput,
    setSearchInput,
    results,
    title,
    content,
    originalTitle,
    originalContent,
    editingPostId,
    isSubmitting,
    status,
    error,
    nextCursor,
    hasMore,
    scannedCount,
    openMenuPostId,
    isDraftConfirmOpen,
    errorMessage,
    isLoadingNext,
    articleHistoryPost,
    articleHistoryEntries,
    articleHistoryError,
    isArticleHistoryOpen,
    pageSize: PAGE_SIZE,
    isLoading: status === 'loading',
    dialogRef,
    bottomRef,
    setTitle,
    setContent,
    handleSubmitSearch,
    handleRetrySearch,
    handlePressLike,
    handleToggleFavoritePost,
    handleToggleOwnerMenu,
    handleCloseOwnerMenu,
    handleEditPost,
    handleDeletePost,
    handleSubmitPost,
    handleViewArticleHistory,
    handleCloseArticleHistory,
    handleRequestComposerClose,
    handleSaveComposerDraft,
    handleContinueEditingDraft,
    handleDiscardComposerDraft,
  };
}
