/**
 * @file Integration tests for `ProfileHeader` — public profile header card.
 * @description
 * TDD RED phase — target component does NOT exist yet:
 *   `src/app/users/[uid]/ProfileHeader.jsx`
 *
 * Covers US1 Acceptance Scenario 1 & Edge Cases from `specs/012-public-profile/spec.md`:
 *   - AS1: 顯示頭像、名稱、簡介、加入日期
 *   - Edge: 無頭像 → fallback avatar
 *   - Edge: bio 空字串 / undefined → 簡介區塊隱藏 (Clarifications 2026-04-09)
 *   - Edge: bio 含 <script> → React 自動轉義 (FR-009)
 *   - Date format: 正體中文加入日期
 *
 * Rules:
 * 1. Use `@testing-library/react` + `user-event` — NEVER low-level event helpers.
 * 2. Query by `getByRole` / `getByText`, NEVER `container.querySelector`.
 * 3. AAA Pattern (Arrange, Act, Assert).
 * 4. Strict JSDoc; no `any`.
 * 5. Mock `next/image` and `next/link` so jsdom + server images don't break.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createPublicProfileTimestampFixture as createProfile } from '../../_helpers/profile-fixtures';

/* ==========================================================================
   Module mocks — next/image + next/link only. Do NOT mock React.
   ========================================================================== */

vi.mock('next/image', () => ({
  /**
   * Pass-through next/image mock. Returns a plain <img> so jsdom can render
   * without next.js runtime; alt is always provided by caller.
   * @param {object} props - Image props.
   * @param {string} props.src - Image src.
   * @param {string} props.alt - Image alt text.
   * @returns {import('react').ReactElement} Mocked img element.
   */
  default: ({ src, alt, ...rest }) => <img src={src} alt={alt} {...rest} />,
}));

vi.mock('next/link', () => ({
  /**
   * Pass-through next/link mock.
   * @param {object} props - Link props.
   * @param {import('react').ReactNode} props.children - Link children.
   * @param {string} props.href - Destination URL.
   * @returns {import('react').ReactElement} Anchor element.
   */
  default: ({ children, href, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/* ==========================================================================
   Test Data
   ========================================================================== */

/**
 * @typedef {object} MockPublicProfile
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 顯示名稱。
 * @property {string} photoURL - 頭像 URL（空字串代表無頭像）。
 * @property {string} [bio] - 個人簡介（未設定代表 undefined）。
 * @property {{ toDate: () => Date }} createdAt - 加入日期（類 Firestore Timestamp）。
 */

/**
 * 動態載入 ProfileHeader 元件，讓 vi.mock 生效並於元件新增/修改後立刻反映。
 * @returns {Promise<(props: { user: MockPublicProfile }) => import('react').ReactElement>}
 *   ProfileHeader 元件。
 */
async function importProfileHeader() {
  const mod = await import('@/app/users/[uid]/ProfileHeader');
  return /** @type {(props: { user: MockPublicProfile }) => import('react').ReactElement} */ (
    mod.default
  );
}

/* ==========================================================================
   Tests
   ========================================================================== */

describe('Integration: ProfileHeader', () => {
  // --- AS1-1: name + photo + bio + createdAt 全部渲染 ---
  it('renders name, photo, bio and join date when all fields exist', async () => {
    // Arrange
    const ProfileHeader = await importProfileHeader();
    const profile = createProfile();

    // Act
    render(<ProfileHeader user={profile} />);

    // Assert
    expect(screen.getByRole('heading', { name: 'Alice Runner' })).toBeInTheDocument();

    const avatar = screen.getByRole('img', { name: /alice runner/i });
    expect(avatar).toHaveAttribute('src', 'https://example.com/alice.jpg');

    expect(screen.getByText('每天晨跑 5 公里，週末登山路跑。')).toBeInTheDocument();

    // 加入日期應以正體中文或斜線格式顯示，至少包含 2024 與 3 與 15
    const joinText = screen.getByText(/2024/);
    expect(joinText).toBeInTheDocument();
    expect(joinText.textContent ?? '').toMatch(/3/);
    expect(joinText.textContent ?? '').toMatch(/15/);
  });

  // --- Edge: bio 為空字串 → 區塊完全隱藏 ---
  it('hides bio section when bio is empty string', async () => {
    // Arrange
    const ProfileHeader = await importProfileHeader();
    const profile = createProfile({ bio: '' });

    // Act
    render(<ProfileHeader user={profile} />);

    // Assert — name 仍在，但不會渲染任何 bio 段落內容
    expect(screen.getByRole('heading', { name: 'Alice Runner' })).toBeInTheDocument();
    expect(screen.queryByTestId('profile-bio')).not.toBeInTheDocument();
  });

  // --- Edge: bio 為 undefined → 區塊完全隱藏 ---
  it('hides bio section when bio is undefined', async () => {
    // Arrange
    const ProfileHeader = await importProfileHeader();
    const profile = createProfile({ bio: undefined });

    // Act
    render(<ProfileHeader user={profile} />);

    // Assert
    expect(screen.getByRole('heading', { name: 'Alice Runner' })).toBeInTheDocument();
    expect(screen.queryByTestId('profile-bio')).not.toBeInTheDocument();
  });

  // --- Edge: 無頭像 → fallback 頭像（不 render img） ---
  it('renders a fallback avatar when photoURL is empty', async () => {
    // Arrange
    const ProfileHeader = await importProfileHeader();
    const profile = createProfile({ photoURL: '' });

    // Act
    render(<ProfileHeader user={profile} />);

    // Assert — 不應該有真實的 <img> (fallback 通常是 div + 首字)
    expect(screen.queryByRole('img', { name: /alice runner/i })).not.toBeInTheDocument();

    // fallback 至少應顯示名稱第一個字作為 placeholder
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  // --- Edge: bio 含 <script> → React 自動轉義 (FR-009) ---
  it('escapes <script> in bio content to prevent XSS', async () => {
    // Arrange
    const ProfileHeader = await importProfileHeader();
    const maliciousBio = '<script>alert("xss")</script>Hi there';
    const profile = createProfile({ bio: maliciousBio });

    // Act
    render(<ProfileHeader user={profile} />);

    // Assert — 原始字串應該被當文字 render，而不是 script tag
    const bio = screen.getByText(maliciousBio);
    expect(bio).toHaveTextContent(maliciousBio);
    // 確認 React escape 後 bio 元素本身是 <p>，沒有真的產生 script element
    expect(bio.tagName).toBe('P');
  });

  // --- 加入日期格式正確性 ---
  it('formats join date in Traditional Chinese style', async () => {
    // Arrange
    const ProfileHeader = await importProfileHeader();
    const profile = createProfile({
      createdAt: { toDate: () => new Date(2024, 2, 15) }, // 2024-03-15
    });

    // Act
    render(<ProfileHeader user={profile} />);

    // Assert — 接受 `2024年3月15日` 或 `2024/03/15` 之類的格式
    const dateText = screen.getByText(/2024.*3.*15|2024.*03.*15/);
    expect(dateText).toBeInTheDocument();
  });
});
