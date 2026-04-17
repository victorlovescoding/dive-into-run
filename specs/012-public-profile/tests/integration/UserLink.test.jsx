/**
 * @file Integration tests for `UserLink` — site-wide clickable user link.
 * @description
 * TDD RED phase — target component does NOT exist yet:
 *   `src/components/UserLink.jsx`
 *
 * Covers US2 Acceptance Scenarios from `specs/012-public-profile/spec.md`:
 *   - AS2-1: 點擊主揪名稱/頭像 → 跳轉至 `/users/{uid}`
 *   - AS2-2: 點擊參與者名稱/頭像 → 跳轉至公開檔案
 *   - AS2-3: 點擊留言作者 → 跳轉至公開檔案
 *   - AS2-4: 點擊文章作者 → 跳轉至公開檔案
 *
 * 對應元件 contract（research.md R-005）:
 *   props: { uid, name, photoURL?, size?, showAvatar?, showName?, className? }
 *
 * Rules:
 * 1. Use `@testing-library/react` — query by `getByRole`, never `container.querySelector`.
 * 2. Do NOT mock `next/link` — let next.js render its real <a> in jsdom.
 * 3. Mock `next/image` to a pass-through <img> so jsdom can render without runtime.
 * 4. AAA Pattern (Arrange, Act, Assert).
 * 5. Strict JSDoc; no `any` outside tightly-scoped casts.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/* ==========================================================================
   Module mocks — only next/image. Real next/link is used.
   ========================================================================== */

vi.mock('next/image', () => ({
  /**
   * Pass-through next/image mock. Forwards width/height so size assertions
   * can verify them via DOM attributes.
   * @param {object} props - Image props.
   * @param {string} props.src - Image src URL.
   * @param {string} props.alt - Image alt text.
   * @param {number} [props.width] - Image width in px.
   * @param {number} [props.height] - Image height in px.
   * @returns {import('react').ReactElement} Mocked img element.
   */
  default: ({ src, alt, width, height, ...rest }) => (
    <img src={src} alt={alt} width={width} height={height} {...rest} />
  ),
}));

/* ==========================================================================
   Test data helpers
   ========================================================================== */

/**
 * @typedef {object} UserLinkProps
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 顯示名稱。
 * @property {string} [photoURL] - 頭像 URL。
 * @property {number} [size] - 頭像大小 (px)。
 * @property {boolean} [showAvatar] - 是否顯示頭像。
 * @property {boolean} [showName] - 是否顯示名稱。
 * @property {string} [className] - 額外 CSS class。
 */

/**
 * 動態載入 UserLink 元件，確保 vi.mock 已套用。
 * @returns {Promise<(props: UserLinkProps) => import('react').ReactElement>} UserLink 元件。
 */
async function importUserLink() {
  const mod = await import('@/components/UserLink');
  return /** @type {(props: UserLinkProps) => import('react').ReactElement} */ (mod.default);
}

/* ==========================================================================
   Tests
   ========================================================================== */

describe('Integration: UserLink', () => {
  // --- 1. 連結導向正確 URL ---
  it('renders an anchor pointing to /users/{uid}', async () => {
    // Arrange
    const UserLink = await importUserLink();

    // Act
    render(<UserLink uid="user-abc" name="Alice Runner" />);

    // Assert
    const link = screen.getByRole('link', { name: /alice runner/i });
    expect(link).toHaveAttribute('href', '/users/user-abc');
  });

  // --- 2. a11y: accessible name 必須包含使用者名稱 ---
  it('exposes the user name as accessible link name', async () => {
    // Arrange
    const UserLink = await importUserLink();

    // Act
    render(<UserLink uid="user-abc" name="Bob 跑者" />);

    // Assert — getByRole 必須能用名稱找到唯一連結
    const link = screen.getByRole('link', { name: /bob 跑者/i });
    expect(link).toBeInTheDocument();
  });

  // --- 3. 顯示名稱（預設行為） ---
  it('renders the user name text when showName is default (true)', async () => {
    // Arrange
    const UserLink = await importUserLink();

    // Act
    render(<UserLink uid="user-abc" name="Carol Chen" />);

    // Assert
    expect(screen.getByText('Carol Chen')).toBeInTheDocument();
  });

  // --- 4. 隱藏名稱：showName=false → 名稱不顯示，但連結仍可由 accessible name 取得 ---
  it('hides the visible name text when showName is false but keeps accessible name', async () => {
    // Arrange
    const UserLink = await importUserLink();

    // Act
    render(<UserLink uid="user-abc" name="Dave 王" showName={false} />);

    // Assert — 文字不應該渲染為可見內容
    expect(screen.queryByText('Dave 王')).not.toBeInTheDocument();

    // 但 link 仍應透過 accessible name (aria-label / sr-only) 找得到
    const link = screen.getByRole('link', { name: /dave 王/i });
    expect(link).toHaveAttribute('href', '/users/user-abc');
  });

  // --- 5. 顯示頭像（預設行為） ---
  it('renders an avatar image when photoURL is provided and showAvatar is default', async () => {
    // Arrange
    const UserLink = await importUserLink();

    // Act
    render(<UserLink uid="user-abc" name="Eve Liu" photoURL="https://example.com/eve.jpg" />);

    // Assert
    const avatar = screen.getByRole('img', { name: /eve liu/i });
    expect(avatar).toHaveAttribute('src', 'https://example.com/eve.jpg');
  });

  // --- 6. 隱藏頭像：showAvatar=false → 不渲染 img ---
  it('does not render avatar when showAvatar is false', async () => {
    // Arrange
    const UserLink = await importUserLink();

    // Act
    render(
      <UserLink
        uid="user-abc"
        name="Frank Lin"
        photoURL="https://example.com/frank.jpg"
        showAvatar={false}
      />,
    );

    // Assert
    expect(screen.queryByRole('img', { name: /frank lin/i })).not.toBeInTheDocument();
    // 但連結本身仍應存在
    expect(screen.getByRole('link', { name: /frank lin/i })).toBeInTheDocument();
  });

  // --- 7. 頭像 fallback：photoURL 為空字串 → 使用預設頭像 ---
  it('uses default avatar fallback when photoURL is empty string', async () => {
    // Arrange
    const UserLink = await importUserLink();

    // Act
    render(<UserLink uid="user-abc" name="Grace Wu" photoURL="" />);

    // Assert — 預設頭像來源為 /default-avatar.png
    const avatar = screen.getByRole('img', { name: /grace wu/i });
    expect(avatar).toHaveAttribute('src', '/default-avatar.png');
  });

  // --- 7b. 頭像 fallback：photoURL 為 undefined → 使用預設頭像 ---
  it('uses default avatar fallback when photoURL is undefined', async () => {
    // Arrange
    const UserLink = await importUserLink();

    // Act
    render(<UserLink uid="user-abc" name="Henry Kao" />);

    // Assert
    const avatar = screen.getByRole('img', { name: /henry kao/i });
    expect(avatar).toHaveAttribute('src', '/default-avatar.png');
  });

  // --- 8. size prop：48 → 頭像 width / height = 48 ---
  it('passes size prop to avatar width and height attributes', async () => {
    // Arrange
    const UserLink = await importUserLink();

    // Act
    render(
      <UserLink uid="user-abc" name="Ivy Chang" photoURL="https://example.com/ivy.jpg" size={48} />,
    );

    // Assert
    const avatar = screen.getByRole('img', { name: /ivy chang/i });
    expect(avatar).toHaveAttribute('width', '48');
    expect(avatar).toHaveAttribute('height', '48');
  });

  // --- 9. className pass-through：附加在連結根元素上 ---
  it('forwards className to the root link element', async () => {
    // Arrange
    const UserLink = await importUserLink();

    // Act
    render(<UserLink uid="user-abc" name="Jack Su" className="custom-class" />);

    // Assert
    const link = screen.getByRole('link', { name: /jack su/i });
    expect(link).toHaveClass('custom-class');
  });

  // --- 10. Edge：showAvatar=false && showName=false 仍須提供 accessible name ---
  it('still exposes an accessible link name when both avatar and name are hidden', async () => {
    // Arrange
    const UserLink = await importUserLink();

    // Act
    render(<UserLink uid="user-abc" name="Kate Hsu" showAvatar={false} showName={false} />);

    // Assert — 視覺上空白，但 a11y 仍然有名字
    expect(screen.queryByText('Kate Hsu')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    const link = screen.getByRole('link', { name: /kate hsu/i });
    expect(link).toHaveAttribute('href', '/users/user-abc');
  });
});
