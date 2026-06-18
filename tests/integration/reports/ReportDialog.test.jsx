// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ReportDialog from '@/components/reports/ReportDialog';
import ReportMenuItem, { getReportTargetMetadata } from '@/components/reports/ReportMenuItem';
import {
  createReportAuthMock,
  createReportPostCommentTarget,
  createReportPostTarget,
} from '../../_helpers/report-ui-mocks.jsx';

/**
 * 渲染 opened report dialog。
 * @param {object} [props] - 覆寫 props。
 * @returns {{ user: ReturnType<typeof userEvent.setup>, submitReportUseCase: import('vitest').Mock, onClose: import('vitest').Mock }}
 *   渲染結果與 collaborators。
 */
function renderReportDialog(props = {}) {
  const user = userEvent.setup();
  const authMock = createReportAuthMock();
  const target = createReportPostTarget();
  const submitReportUseCase = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    code: null,
    reportId: 'report-1',
    message: '已收到你的檢舉，我們會進行審查。',
  });
  const onClose = vi.fn();

  render(
    <ReportDialog
      isOpen
      onClose={onClose}
      submitReportUseCase={submitReportUseCase}
      {...authMock}
      {...target}
      {...props}
    />,
  );

  return { user, submitReportUseCase, onClose };
}

describe('ReportDialog', () => {
  it('renders the post title, preview, and stable reason labels', () => {
    renderReportDialog();

    expect(screen.getByRole('dialog', { name: '檢舉這篇文章' })).toBeInTheDocument();
    expect(screen.getByText('文章預覽')).toBeInTheDocument();
    expect(screen.getByText('這是一篇需要被檢舉流程確認的文章預覽。')).toBeInTheDocument();
    [
      '垃圾訊息',
      '騷擾或霸凌',
      '仇恨或歧視',
      '色情內容',
      '暴力或危險行為',
      '違法內容',
      '不實或誤導',
      '其他',
    ].forEach((label) => {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    });
  });

  it('shows validation messages for missing reason and other details', async () => {
    const { user, submitReportUseCase } = renderReportDialog();

    await user.click(screen.getByRole('button', { name: '送出檢舉' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('請選擇檢舉原因。');

    await user.click(screen.getByRole('radio', { name: '其他' }));
    await user.click(screen.getByRole('button', { name: '送出檢舉' }));

    expect(screen.getByRole('alert')).toHaveTextContent('請填寫補充說明。');
    expect(submitReportUseCase).not.toHaveBeenCalled();
  });

  it('disables only submit while pending and keeps the modal closable', async () => {
    let resolveSubmit = /** @type {(value: unknown) => void} */ (() => {});
    const submitReportUseCase = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    const { user, onClose } = renderReportDialog({ submitReportUseCase });

    await user.click(screen.getByRole('radio', { name: '垃圾訊息' }));
    await user.click(screen.getByRole('button', { name: '送出檢舉' }));

    expect(screen.getByRole('button', { name: '送出中...' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '關閉檢舉視窗' }));
    expect(onClose).toHaveBeenCalledWith();

    resolveSubmit({
      ok: true,
      status: 201,
      code: null,
      reportId: 'report-1',
      message: '已收到你的檢舉，我們會進行審查。',
    });
  });

  it('renders post comment metadata through the reusable adapter', () => {
    renderReportDialog(createReportPostCommentTarget());

    expect(screen.getByRole('dialog', { name: '檢舉這則留言' })).toBeInTheDocument();
    expect(screen.getByText('留言預覽')).toBeInTheDocument();
  });
});

describe('ReportMenuItem', () => {
  it('adapts Phase 1 target metadata and renders an accessible menu item', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <div role="menu">
        <ReportMenuItem targetType="post" onSelect={onSelect} />
      </div>,
    );

    const menu = screen.getByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: '檢舉文章' }));
    expect(onSelect).toHaveBeenCalledWith();
    expect(getReportTargetMetadata('post')).toMatchObject({
      menuLabel: '檢舉文章',
      dialogTitle: '檢舉這篇文章',
      previewLabel: '文章預覽',
    });
    expect(getReportTargetMetadata('postComment')).toMatchObject({
      menuLabel: '檢舉留言',
      dialogTitle: '檢舉這則留言',
      previewLabel: '留言預覽',
    });
    expect(getReportTargetMetadata('event')).toBeNull();
  });
});
