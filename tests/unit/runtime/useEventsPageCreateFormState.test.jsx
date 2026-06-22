// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useEventsPageCreateFormState from '@/runtime/hooks/useEventsPageCreateFormState';

const DEADLINE_ERROR = '報名截止時間必須在活動開始時間之前';

/**
 * Renders create form state with a stable toast spy.
 * @returns {ReturnType<typeof renderHook> & { showToast: import('vitest').Mock }}
 * Rendered hook utilities.
 */
function renderCreateFormState() {
  const showToast = vi.fn();
  const view = renderHook(() => useEventsPageCreateFormState({ showToast }));

  return { ...view, showToast };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useEventsPageCreateFormState deadline validation', () => {
  it('initializes create time fields from draft form data and derives the deadline error', () => {
    const { result } = renderCreateFormState();

    act(() => {
      result.current.handleToggleCreateRunForm({
        userUid: 'runner-1',
        draftFormData: {
          time: '2026-07-01T10:00',
          registrationDeadline: '2026-07-01T10:00',
        },
      });
    });

    expect(result.current.eventTimeValue).toBe('2026-07-01T10:00');
    expect(result.current.registrationDeadlineValue).toBe('2026-07-01T10:00');
    expect(result.current.registrationDeadlineError).toBe(DEADLINE_ERROR);
  });

  it('clears the deadline error immediately when deadline or event time becomes valid', () => {
    const { result } = renderCreateFormState();

    act(() => {
      result.current.handleToggleCreateRunForm({
        userUid: 'runner-1',
        draftFormData: {
          time: '2026-07-01T10:00',
          registrationDeadline: '2026-07-01T10:30',
        },
      });
    });
    expect(result.current.registrationDeadlineError).toBe(DEADLINE_ERROR);

    act(() => {
      result.current.setRegistrationDeadlineValue('2026-07-01T09:59');
    });
    expect(result.current.registrationDeadlineError).toBe('');

    act(() => {
      result.current.setRegistrationDeadlineValue('2026-07-01T10:30');
    });
    expect(result.current.registrationDeadlineError).toBe(DEADLINE_ERROR);

    act(() => {
      result.current.setEventTimeValue('2026-07-01T11:00');
    });
    expect(result.current.registrationDeadlineError).toBe('');
  });

  it('does not create a custom deadline error for blank values', () => {
    const { result } = renderCreateFormState();

    act(() => {
      result.current.handleToggleCreateRunForm({
        userUid: 'runner-1',
        draftFormData: {
          time: '',
          registrationDeadline: '2026-07-01T10:30',
        },
      });
    });

    expect(result.current.registrationDeadlineError).toBe('');
  });
});
