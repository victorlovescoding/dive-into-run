/**
 * @file Shared test helper component for scroll-to-comment integration tests.
 * @description
 * Mirrors the scroll-to-comment useEffect logic from PostDetailClient so
 * integration tests can exercise the behaviour without rendering the full
 * post detail tree. The DOM lookup via document.getElementById is the core
 * of the mocked behaviour and is intentionally retained.
 */

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * 測試用元件，包含一個可被捲動到的留言目標。
 * 使用與 PostDetailClient 相同的 scroll-to-comment 邏輯模式。
 * @returns {import('react').JSX.Element} 測試元件。
 */
export default function ScrollTestComponent() {
  const searchParams = useSearchParams();
  const commentId = searchParams.get('commentId');

  useEffect(() => {
    if (!commentId) return undefined;

    const timer = setTimeout(() => {
      const el = document.getElementById(commentId);
      if (!el) return;

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('commentHighlight');

      /** 動畫結束後移除高亮 class。 */
      const handleAnimationEnd = () => {
        el.classList.remove('commentHighlight');
      };
      el.addEventListener('animationend', handleAnimationEnd);
    }, 300);

    return () => clearTimeout(timer);
  }, [commentId]);

  return (
    <div>
      <div id="cmt-123">Target Comment</div>
    </div>
  );
}
