/**
 * @file Integration tests for `BioEditor` — member-page bio editing widget.
 * @description
 * TDD RED phase — target component does NOT exist yet:
 *   `src/app/member/BioEditor.jsx`
 *
 * Covers US3 Acceptance Scenarios + related FRs from
 * `specs/012-public-profile/spec.md`:
 *   - AS3-1: 會員頁面可輸入或修改簡介文字
 *   - AS3-2: 儲存後簡介內容可被讀出 (service 層行為)
 *   - AS3-4: 超過 150 字無法儲存並顯示提示
 *   - FR-006: 簡介字數上限為 150 字（由 `updateUserBio` 強制）
 *
 * Design note:
 *   BioEditor 被刻意抽成接收 `uid` + `initialBio` 的受控元件，這樣
 *   integration test 就不需要 mock `AuthContext`，只需要 mock service
 *   layer (`@/lib/firebase-profile`) 即可驗證所有行為。
 *
 * Rules:
 * 1. Use `@testing-library/react` + `userEvent.setup()` — NEVER `fireEvent`.
 * 2. Query by `getByRole` / `getByLabelText` / `findByText`, never
 *    `container.querySelector`.
 * 3. AAA Pattern (Arrange, Act, Assert).
 * 4. Strict JSDoc; no `any`.
 * 5. Mock ONLY `@/lib/firebase-profile` — do not mock `AuthContext`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { updateUserBio } from '@/lib/firebase-profile';

/* ==========================================================================
   Module mocks — only the service layer.
   ========================================================================== */

vi.mock('@/lib/firebase-profile', () => ({
  updateUserBio: vi.fn(),
}));

/** @type {import('vitest').Mock} */
const mockedUpdateUserBio = /** @type {import('vitest').Mock} */ (
  /** @type {unknown} */ (updateUserBio)
);

/* ==========================================================================
   Helpers
   ========================================================================== */

/**
 * @typedef {object} BioEditorProps
 * @property {string} uid - 使用者 UID。
 * @property {string} [initialBio] - 目前的 bio（可能為 undefined 或空字串）。
 */

/**
 * 動態載入 BioEditor 元件，讓 vi.mock 能在 import 前生效。
 * @returns {Promise<(props: BioEditorProps) => import('react').ReactElement>}
 *   BioEditor 元件。
 */
async function importBioEditor() {
  const mod = await import('@/app/member/BioEditor');
  return /** @type {(props: BioEditorProps) => import('react').ReactElement} */ (mod.default);
}

/**
 * 取得 bio textarea（透過 accessible role，不依賴 container.querySelector）。
 * @returns {HTMLTextAreaElement} textarea 元素。
 */
function getBioTextarea() {
  return /** @type {HTMLTextAreaElement} */ (screen.getByRole('textbox', { name: /簡介|bio/i }));
}

/**
 * 取得儲存按鈕。
 * @returns {HTMLButtonElement} 儲存按鈕。
 */
function getSaveButton() {
  return /** @type {HTMLButtonElement} */ (screen.getByRole('button', { name: /儲存|save/i }));
}

/* ==========================================================================
   Tests
   ========================================================================== */

describe('Integration: BioEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- AS3-1: 初始值渲染 ---
  it('renders textarea with the provided initialBio', async () => {
    // Arrange
    const BioEditor = await importBioEditor();

    // Act
    render(<BioEditor uid="user-1" initialBio="目前簡介" />);

    // Assert
    expect(getBioTextarea()).toHaveValue('目前簡介');
  });

  // --- initialBio undefined → textarea 為空 ---
  it('renders empty textarea when initialBio is undefined', async () => {
    // Arrange
    const BioEditor = await importBioEditor();

    // Act
    render(<BioEditor uid="user-1" />);

    // Assert
    expect(getBioTextarea()).toHaveValue('');
  });

  // --- 字數計數器（初始） ---
  it('shows initial character count based on initialBio length', async () => {
    // Arrange
    const BioEditor = await importBioEditor();

    // Act
    render(<BioEditor uid="user-1" initialBio="hello" />);

    // Assert
    expect(screen.getByText('5/150')).toBeInTheDocument();
  });

  // --- 字數計數器（輸入後即時更新） ---
  it('updates character count as the user types', async () => {
    // Arrange
    const user = userEvent.setup();
    const BioEditor = await importBioEditor();
    render(<BioEditor uid="user-1" />);

    // 初始為空 → 0/150
    expect(screen.getByText('0/150')).toBeInTheDocument();

    // Act
    await user.type(getBioTextarea(), 'hello');

    // Assert
    expect(screen.getByText('5/150')).toBeInTheDocument();
  });

  // --- AS3-2 (service contract): 儲存成功呼叫 service 並顯示成功訊息 ---
  it('calls updateUserBio and shows a success message when save succeeds', async () => {
    // Arrange
    const user = userEvent.setup();
    mockedUpdateUserBio.mockResolvedValueOnce(undefined);
    const BioEditor = await importBioEditor();
    render(<BioEditor uid="user-1" initialBio="" />);

    // Act — 輸入新簡介並按儲存
    await user.type(getBioTextarea(), '熱愛跑步');
    await user.click(getSaveButton());

    // Assert — service 被呼叫
    await waitFor(() => {
      expect(mockedUpdateUserBio).toHaveBeenCalledTimes(1);
    });
    expect(mockedUpdateUserBio).toHaveBeenCalledWith('user-1', '熱愛跑步');

    // 成功訊息
    expect(await screen.findByText(/已儲存|儲存成功/)).toBeInTheDocument();
  });

  // --- 儲存失敗 → 顯示錯誤訊息 ---
  it('shows an error message when updateUserBio rejects', async () => {
    // Arrange
    const user = userEvent.setup();
    mockedUpdateUserBio.mockRejectedValueOnce(new Error('network error'));
    const BioEditor = await importBioEditor();
    render(<BioEditor uid="user-1" initialBio="" />);

    // Act
    await user.type(getBioTextarea(), '新的簡介');
    await user.click(getSaveButton());

    // Assert
    expect(await screen.findByText(/儲存失敗|無法儲存|錯誤/)).toBeInTheDocument();

    // 仍呼叫過 service
    expect(mockedUpdateUserBio).toHaveBeenCalledTimes(1);
  });

  // --- AS3-4: 超過 150 字禁止儲存 ---
  it('prevents saving when bio exceeds 150 characters', async () => {
    // Arrange
    const user = userEvent.setup();
    const BioEditor = await importBioEditor();
    render(<BioEditor uid="user-1" initialBio={'A'.repeat(151)} />);

    // Assert — 字數計數顯示超標
    expect(screen.getByText('151/150')).toBeInTheDocument();

    const saveButton = getSaveButton();

    // 嘗試點擊（可能被 disabled 擋住，也可能透過 UI error 擋住）
    await user.click(saveButton);

    // Assert — service 絕不應被呼叫
    expect(mockedUpdateUserBio).not.toHaveBeenCalled();
  });

  // --- 剛好 150 字 → 可以儲存 ---
  it('allows saving when bio is exactly 150 characters', async () => {
    // Arrange
    const user = userEvent.setup();
    mockedUpdateUserBio.mockResolvedValueOnce(undefined);
    const exactly150 = 'A'.repeat(150);
    const BioEditor = await importBioEditor();
    render(<BioEditor uid="user-1" initialBio={exactly150} />);

    // Sanity check
    expect(screen.getByText('150/150')).toBeInTheDocument();

    // Act
    await user.click(getSaveButton());

    // Assert
    await waitFor(() => {
      expect(mockedUpdateUserBio).toHaveBeenCalledTimes(1);
    });
    expect(mockedUpdateUserBio).toHaveBeenCalledWith('user-1', exactly150);
  });

  // --- 空字串 bio 可儲存（用來清除既有簡介，對應 service 層 AS） ---
  it('allows saving an empty bio (clear existing bio)', async () => {
    // Arrange
    const user = userEvent.setup();
    mockedUpdateUserBio.mockResolvedValueOnce(undefined);
    const BioEditor = await importBioEditor();
    render(<BioEditor uid="user-1" initialBio="原本的簡介" />);

    // Act — 先清空再儲存
    await user.clear(getBioTextarea());
    expect(getBioTextarea()).toHaveValue('');
    expect(screen.getByText('0/150')).toBeInTheDocument();

    await user.click(getSaveButton());

    // Assert
    await waitFor(() => {
      expect(mockedUpdateUserBio).toHaveBeenCalledTimes(1);
    });
    expect(mockedUpdateUserBio).toHaveBeenCalledWith('user-1', '');
  });

  // --- 儲存中 loading 狀態 ---
  it('disables the save button while the save request is pending', async () => {
    // Arrange — hang forever to inspect in-flight state
    const user = userEvent.setup();
    /** @type {(value?: void) => void} */
    let resolveSave = () => {};
    mockedUpdateUserBio.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    const BioEditor = await importBioEditor();
    render(<BioEditor uid="user-1" initialBio="" />);

    // Act
    await user.type(getBioTextarea(), '新的簡介');
    await user.click(getSaveButton());

    // Assert — 按鈕停用，或顯示載入中文字
    await waitFor(() => {
      const button = getSaveButton();
      const hasLoadingText = /儲存中|載入中/.test(button.textContent ?? '');
      expect(button.disabled || hasLoadingText).toBe(true);
    });

    // Cleanup — 讓 pending promise 完成，避免 test runner 掛起
    resolveSave();
  });
});
