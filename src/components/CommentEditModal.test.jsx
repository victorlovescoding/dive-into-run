import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import CommentEditModal from './CommentEditModal';

const STYLESHEET = readFileSync(
  `${process.cwd()}/src/components/CommentEditModal.module.css`,
  'utf8',
);

const comment = {
  id: 'comment-1',
  content: 'Original comment',
};

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal() {
    this.open = true;
  });
});

describe('CommentEditModal', () => {
  test('renders a generic edit dialog and saves edited content', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(
      <CommentEditModal
        comment={comment}
        isUpdating={false}
        updateError={null}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    const textbox = screen.getByRole('textbox');
    await user.clear(textbox);
    await user.type(textbox, 'Updated comment');
    await user.click(screen.getByRole('button', { name: '完成編輯' }));

    expect(onSave).toHaveBeenLastCalledWith('Updated comment');
    expect(onCancel).not.toHaveBeenCalled();
  });

  test('keeps dialog centering styles stable while animating opacity', () => {
    expect(STYLESHEET).toContain('position: fixed;');
    expect(STYLESHEET).toContain('inset: 50% auto auto 50%;');
    expect(STYLESHEET).toContain('margin: 0;');
    expect(STYLESHEET).toContain('transform: translate(-50%, -50%);');
    expect(STYLESHEET).toContain('width: 90vw;');
    expect(STYLESHEET).toContain('max-width: 480px;');
    expect(STYLESHEET).not.toMatch(/@keyframes\s+modalFadeIn[\s\S]*transform:/);
  });
});
