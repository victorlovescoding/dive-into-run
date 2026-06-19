// @vitest-environment jsdom

import { act as reactAct, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useCommentEditModal from '@/runtime/hooks/useCommentEditModal';

const editableComment = {
  id: 'comment-1',
  content: '編輯前留言',
};

let onWrapperUnmount = () => {};
let openEdit = () => {};
let saveEdit = async () => false;

/**
 * Creates a manually controlled promise for async race assertions.
 * @returns {{
 *   promise: Promise<unknown>,
 *   resolve: (value: unknown) => void,
 *   reject: (reason?: unknown) => void
 * }} Deferred promise controls.
 */
function createDeferred() {
  /** @type {(value: unknown) => void} */
  let resolve = () => {};
  /** @type {(reason?: unknown) => void} */
  let reject = () => {};
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

/**
 * Exposes the hook callbacks after each committed render.
 * @param {object} props - Harness props.
 * @param {(comment: typeof editableComment, newContent: string) => Promise<void | boolean>} props.saveComment - Edit save callback.
 * @returns {null} No rendered UI.
 */
function ModalHarness({ saveComment }) {
  const { handleEditOpen, handleEditSave } = useCommentEditModal({ saveComment });

  useLayoutEffect(() => {
    openEdit = handleEditOpen;
    saveEdit = handleEditSave;
  });

  return null;
}

/**
 * Supplies a parent layout cleanup around the rendered hook harness.
 * @param {object} props - Harness props.
 * @param {(comment: typeof editableComment, newContent: string) => Promise<void | boolean>} props.saveComment - Edit save callback.
 * @returns {import('react').ReactElement} Rendered harness.
 */
function UnmountResolvingParent({ saveComment }) {
  useLayoutEffect(() => () => {
    onWrapperUnmount();
  }, []);

  return <ModalHarness saveComment={saveComment} />;
}

afterEach(() => {
  onWrapperUnmount = () => {};
  openEdit = () => {};
  saveEdit = async () => false;
});

describe('useCommentEditModal unmount guards', () => {
  it('invalidates a pending edit save before parent layout cleanup can resolve it', async () => {
    const pendingSave = createDeferred();
    const saveComment = vi.fn(() => pendingSave.promise);
    onWrapperUnmount = () => {
      pendingSave.resolve(undefined);
    };
    const container = document.createElement('div');
    const root = createRoot(container);

    await reactAct(async () => {
      root.render(<UnmountResolvingParent saveComment={saveComment} />);
    });

    reactAct(() => {
      openEdit(editableComment);
    });

    /** @type {Promise<boolean>} */
    let saveResult;
    reactAct(() => {
      saveResult = saveEdit('編輯後留言');
    });

    expect(saveComment).toHaveBeenLastCalledWith(editableComment, '編輯後留言');

    root.render(null);
    await expect(saveResult).resolves.toBe(false);
    root.unmount();
  });
});
