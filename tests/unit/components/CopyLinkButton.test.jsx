// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CopyLinkButton from '@/components/CopyLinkButton';

const originalGlobalClipboardDescriptor = Object.getOwnPropertyDescriptor(
  globalThis.navigator,
  'clipboard',
);
const originalWindowClipboardDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard');
const originalExecCommandDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');

/**
 * Replace navigator.clipboard for the current test.
 * @param {{ writeText: ReturnType<typeof vi.fn> } | undefined} clipboard - Clipboard mock.
 * @returns {void}
 */
function setClipboard(clipboard) {
  const navigatorWithClipboard = Object.create(globalThis.navigator);
  Object.defineProperty(navigatorWithClipboard, 'clipboard', {
    configurable: true,
    value: clipboard,
  });
  vi.stubGlobal('navigator', navigatorWithClipboard);
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  });
}

/**
 * Replace document.execCommand for the current test.
 * @param {ReturnType<typeof vi.fn>} execCommand - execCommand mock.
 * @returns {void}
 */
function setExecCommand(execCommand) {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: execCommand,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  if (originalGlobalClipboardDescriptor) {
    Object.defineProperty(globalThis.navigator, 'clipboard', originalGlobalClipboardDescriptor);
  } else {
    Reflect.deleteProperty(globalThis.navigator, 'clipboard');
  }

  if (originalWindowClipboardDescriptor) {
    Object.defineProperty(window.navigator, 'clipboard', originalWindowClipboardDescriptor);
  } else {
    Reflect.deleteProperty(window.navigator, 'clipboard');
  }

  if (originalExecCommandDescriptor) {
    Object.defineProperty(document, 'execCommand', originalExecCommandDescriptor);
  } else {
    Reflect.deleteProperty(document, 'execCommand');
  }
});

describe('CopyLinkButton', () => {
  it('copies with Clipboard API, shows copied state, and resets after two seconds', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    render(<CopyLinkButton url="https://example.test/posts/post-1" />);

    const button = screen.getByRole('button', { name: '複製連結' });
    expect(button).toHaveAttribute('title', '複製連結');

    await user.click(button);

    expect(writeText).toHaveBeenCalledWith('https://example.test/posts/post-1');
    const copiedButton = screen.getByRole('button', { name: '已複製連結' });
    expect(copiedButton).toHaveAttribute('title', '已複製連結');
    expect(copiedButton.className).toEqual(expect.stringContaining('copyLinkButtonCopied'));

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: '複製連結' })).toHaveAttribute('title', '複製連結');
      },
      { timeout: 2500 },
    );
  });

  it('falls back to hidden textarea copy when Clipboard API rejects', async () => {
    const user = userEvent.setup();
    const copiedUrl = 'https://example.test/events/event-1';
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    let execCommandSnapshot = null;
    const execCommand = vi.fn((command) => {
      // eslint-disable-next-line testing-library/no-node-access -- verifies transient fallback textarea while execCommand runs
      const textarea = document.querySelector('textarea');
      execCommandSnapshot = {
        command,
        selectionEnd: textarea?.selectionEnd ?? null,
        selectionStart: textarea?.selectionStart ?? null,
        value: textarea?.value ?? null,
      };
      return true;
    });
    setClipboard({ writeText });
    setExecCommand(execCommand);

    render(<CopyLinkButton url={copiedUrl} />);

    await user.click(screen.getByRole('button', { name: '複製連結' }));

    expect(writeText).toHaveBeenCalledWith(copiedUrl);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(execCommandSnapshot).toEqual({
      command: 'copy',
      selectionEnd: copiedUrl.length,
      selectionStart: 0,
      value: copiedUrl,
    });
    expect(screen.queryByDisplayValue(copiedUrl)).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '已複製連結' })).toBeInTheDocument();
  });

  it('falls back to hidden textarea copy when Clipboard API is unavailable', async () => {
    const user = userEvent.setup();
    const copiedUrl = 'https://example.test/events/event-clipboard-unavailable';
    let execCommandSnapshot = null;
    const execCommand = vi.fn((command) => {
      // eslint-disable-next-line testing-library/no-node-access -- verifies transient fallback textarea while execCommand runs
      const textarea = document.querySelector('textarea');
      execCommandSnapshot = {
        command,
        selectionEnd: textarea?.selectionEnd ?? null,
        selectionStart: textarea?.selectionStart ?? null,
        value: textarea?.value ?? null,
      };
      return true;
    });
    setClipboard(undefined);
    setExecCommand(execCommand);

    render(<CopyLinkButton url={copiedUrl} />);

    await user.click(screen.getByRole('button', { name: '複製連結' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(execCommandSnapshot).toEqual({
      command: 'copy',
      selectionEnd: copiedUrl.length,
      selectionStart: 0,
      value: copiedUrl,
    });
    expect(screen.queryByDisplayValue(copiedUrl)).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '已複製連結' })).toBeInTheDocument();
  });

  it('does not set copied state or schedule reset when Clipboard API resolves after unmount', async () => {
    const user = userEvent.setup();
    let resolveWriteText;
    const writeText = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveWriteText = resolve;
        }),
    );
    setClipboard({ writeText });

    const { unmount } = render(<CopyLinkButton url="https://example.test/posts/slow-copy" />);

    await user.click(screen.getByRole('button', { name: '複製連結' }));
    expect(writeText).toHaveBeenCalledWith('https://example.test/posts/slow-copy');

    unmount();
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    await act(async () => {
      resolveWriteText();
      await Promise.resolve();
    });

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '已複製連結' })).not.toBeInTheDocument();
  });
});
