import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));
vi.mock('next/image', () => ({
  default: (props) => <img {...props} />,
}));
vi.mock('@/components/UserLink', () => ({
  default: ({ name, uid }) => (
    <a href={`/users/${uid}`} data-testid="user-link">
      <span>{name}</span>
    </a>
  ),
}));

const { default: PostCard } = await import('@/components/PostCard');

const basePost = {
  id: 'post-1',
  title: '今天跑了 10K',
  content: '天氣很好，跑起來很舒服。',
  authorUid: 'user-1',
  authorName: '小明',
  authorImgURL: 'https://example.com/avatar.jpg',
  postAt: /** @type {any} */ ({ toDate: () => new Date('2026-04-15T10:00:00Z') }),
  likesCount: 5,
  commentsCount: 3,
  liked: false,
  isAuthor: false,
};

describe('PostCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-15T10:05:00Z').getTime());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('作者資訊', () => {
    it('顯示作者名稱', () => {
      render(<PostCard post={basePost} />);
      expect(screen.getByText('小明')).toBeInTheDocument();
    });

    it('以真實 helper 顯示相對時間', () => {
      render(<PostCard post={basePost} />);
      expect(screen.getByText('5 分鐘前')).toBeInTheDocument();
    });

    it('無 authorName 時 fallback 到「跑者」', () => {
      const post = { ...basePost, authorName: undefined };
      render(<PostCard post={post} />);
      expect(screen.getByText('跑者')).toBeInTheDocument();
    });
  });

  describe('標題', () => {
    it('顯示文章標題', () => {
      render(<PostCard post={basePost} />);
      expect(screen.getByText('今天跑了 10K')).toBeInTheDocument();
    });

    it('truncate=true 時標題是連結到 /posts/{post.id}', () => {
      render(<PostCard post={basePost} truncate />);
      const link = screen.getByRole('link', { name: '今天跑了 10K' });
      expect(link).toHaveAttribute('href', '/posts/post-1');
    });

    it('truncate=false 時標題不是連結', () => {
      render(<PostCard post={basePost} truncate={false} />);
      expect(screen.getByText('今天跑了 10K')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: '今天跑了 10K' })).not.toBeInTheDocument();
    });
  });

  describe('按讚與留言 meta', () => {
    it('顯示按讚數和留言數', () => {
      render(<PostCard post={basePost} />);
      const counts = screen.getAllByText(/^\d+$/);
      const countValues = counts.map((el) => el.textContent);
      expect(countValues).toContain('5');
      expect(countValues).toContain('3');
    });

    it('按讚按鈕點擊觸發 onLike', async () => {
      const user = userEvent.setup();
      const onLike = vi.fn();
      render(<PostCard post={basePost} onLike={onLike} />);
      const buttons = screen.getAllByRole('button');
      const likeButton = buttons[0];
      await user.click(likeButton);
      expect(onLike).toHaveBeenCalledWith('post-1');
    });
  });

  describe('作者操作選單', () => {
    it('isAuthor=true 時顯示選單按鈕', () => {
      const post = { ...basePost, isAuthor: true };
      render(<PostCard post={post} onToggleMenu={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByRole('button', { name: /更多選項/ })).toBeInTheDocument();
    });

    it('isAuthor=false 時不顯示選單按鈕', () => {
      render(<PostCard post={basePost} />);
      expect(screen.queryByRole('button', { name: /選單|更多|⋯/i })).not.toBeInTheDocument();
    });

    it('選單展開時顯示「編輯」「刪除」按鈕', () => {
      const post = { ...basePost, isAuthor: true };
      render(
        <PostCard
          post={post}
          openMenuPostId="post-1"
          onToggleMenu={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByRole('menuitem', { name: /編輯/ })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /刪除/ })).toBeInTheDocument();
    });

    it('點擊「編輯」觸發 onEdit', async () => {
      const user = userEvent.setup();
      const post = { ...basePost, isAuthor: true };
      const onEdit = vi.fn();
      render(
        <PostCard
          post={post}
          openMenuPostId="post-1"
          onToggleMenu={vi.fn()}
          onEdit={onEdit}
          onDelete={vi.fn()}
        />,
      );
      await user.click(screen.getByRole('menuitem', { name: /編輯/ }));
      expect(onEdit).toHaveBeenCalledWith('post-1');
    });

    it('點擊「刪除」觸發 onDelete', async () => {
      const user = userEvent.setup();
      const post = { ...basePost, isAuthor: true };
      const onDelete = vi.fn();
      render(
        <PostCard
          post={post}
          openMenuPostId="post-1"
          onToggleMenu={vi.fn()}
          onEdit={vi.fn()}
          onDelete={onDelete}
        />,
      );
      await user.click(screen.getByRole('menuitem', { name: /刪除/ }));
      expect(onDelete).toHaveBeenCalledWith('post-1');
    });
  });

  describe('內容截斷與展開', () => {
    const longContent =
      '我今天跑了一場馬拉松比賽感覺非常棒天氣很好風景優美路上遇到很多跑友大家互相加油打氣讓我充滿動力一路跑到終點雖然途中有幾個上坡路段很辛苦但是堅持下來之後覺得一切都值得了完賽時間比預期快了十分鐘真的很開心下次還要繼續挑戰更好的成績大家一起加油跑步讓生活更美好期待下一場比賽的到來讓我們一起享受跑步的樂趣吧奔跑不止';

    it('超過 150 字的內容顯示截斷文字和「查看更多」按鈕', () => {
      const post = { ...basePost, content: longContent };
      render(<PostCard post={post} truncate />);
      expect(screen.getByText(longContent)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /查看更多/ })).toBeInTheDocument();
    });

    it('150 字以內的內容完整顯示，不顯示「查看更多」', () => {
      const shortContent = '今天跑了五公里，感覺不錯。';
      const post = { ...basePost, content: shortContent };
      render(<PostCard post={post} truncate />);
      expect(screen.getByText(shortContent)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /查看更多/ })).not.toBeInTheDocument();
    });

    it('剛好 150 字不截斷', () => {
      const exactly150 = longContent.slice(0, 150);
      const post = { ...basePost, content: exactly150 };
      render(<PostCard post={post} truncate />);
      expect(screen.getByText(exactly150)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /查看更多/ })).not.toBeInTheDocument();
    });

    it('點擊「查看更多」後展示完整內容', async () => {
      const user = userEvent.setup();
      const post = { ...basePost, content: longContent };
      render(<PostCard post={post} truncate />);
      await user.click(screen.getByRole('button', { name: /查看更多/ }));
      expect(screen.getByText(longContent)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /查看更多/ })).not.toBeInTheDocument();
    });

    it('展開後不顯示「收起」按鈕', async () => {
      const user = userEvent.setup();
      const post = { ...basePost, content: longContent };
      render(<PostCard post={post} truncate />);
      await user.click(screen.getByRole('button', { name: /查看更多/ }));
      expect(screen.queryByRole('button', { name: /收起/ })).not.toBeInTheDocument();
    });

    it('truncate=false 時顯示完整內容不截斷', () => {
      const post = { ...basePost, content: longContent };
      render(<PostCard post={post} truncate={false} />);
      expect(screen.getByText(longContent)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /查看更多/ })).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('content 為空字串時不顯示內容區域', () => {
      const post = { ...basePost, content: '' };
      render(<PostCard post={post} />);
      expect(screen.queryByText('天氣很好，跑起來很舒服。')).not.toBeInTheDocument();
    });

    it('authorImgURL 為 undefined 時仍正常渲染', () => {
      const post = { ...basePost, authorImgURL: undefined };
      expect(() => render(<PostCard post={post} />)).not.toThrow();
    });
  });
});
