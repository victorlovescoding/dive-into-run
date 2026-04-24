/**
 * @typedef {import('@/service/post-service').Post} Post
 * @typedef {import('@/service/post-service').Comment} Comment
 */

export {
  POST_TITLE_MAX_LENGTH,
  POST_CONTENT_MAX_LENGTH,
  POST_NOT_FOUND_MESSAGE,
  validatePostInput,
  createPost,
  updatePost,
  getLatestPosts,
  getMorePosts,
  getPostsBySearch,
  getMorePostsBySearch,
  getPostDetail,
  getLatestComments,
  getMoreComments,
  getCommentById,
  toggleLikePost,
  addComment,
  updateComment,
  deleteComment,
  hasUserLikedPosts,
  hasUserLikedPost,
  deletePost,
} from '@/runtime/client/use-cases/post-use-cases';
