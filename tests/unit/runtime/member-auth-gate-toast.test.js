// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import * as memberAuthGateToast from '../../../src/runtime/member-auth-gate-toast';

const MEMBER_AUTH_GATE_RETURN_TO_STORAGE_KEY = 'dive.memberAuthGateReturnTo';

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('member auth gate toast marker', () => {
  it('preserves existing toast marker behavior', () => {
    memberAuthGateToast.markMemberAuthGateToastPending();

    expect(
      window.sessionStorage.getItem(memberAuthGateToast.MEMBER_AUTH_GATE_TOAST_STORAGE_KEY),
    ).toBe('1');
    expect(memberAuthGateToast.consumeMemberAuthGateToastPending()).toBe(true);
    expect(memberAuthGateToast.consumeMemberAuthGateToastPending()).toBe(false);
  });
});

describe('member auth gate returnTo persistence', () => {
  it('stores the current member path when the auth gate redirects to home', () => {
    window.history.replaceState(null, '', '/member/favorites?tab=posts#saved');

    memberAuthGateToast.markMemberAuthGateToastPending();

    expect(
      window.sessionStorage.getItem(memberAuthGateToast.MEMBER_AUTH_GATE_TOAST_STORAGE_KEY),
    ).toBe('1');
    expect(memberAuthGateToast.consumeMemberAuthGateReturnTo?.()).toBe('/member/favorites');
    expect(memberAuthGateToast.consumeMemberAuthGateReturnTo?.()).toBe(null);
    expect(memberAuthGateToast.consumeMemberAuthGateToastPending()).toBe(true);
  });

  it('allows the member root path as a return target', () => {
    window.history.replaceState(null, '', '/member');

    memberAuthGateToast.markMemberAuthGateToastPending();

    expect(memberAuthGateToast.consumeMemberAuthGateReturnTo?.()).toBe('/member');
  });

  it('does not store a return target outside the member area', () => {
    window.history.replaceState(null, '', '/posts');

    memberAuthGateToast.markMemberAuthGateToastPending();

    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_RETURN_TO_STORAGE_KEY)).toBe(null);
  });

  it.each([
    ['protocol-relative URL', '//evil.test'],
    ['absolute URL', 'https://evil.test'],
    ['non-member path', '/posts'],
    ['control character', '/member/favorites\nnext'],
    ['overlong path', `/member/${'a'.repeat(2048)}`],
    ['dot-segment escape', '/member/../posts'],
    ['encoded dot-segment escape', '/member/%2e%2e/posts'],
  ])('rejects an invalid stored returnTo: %s', (_label, returnTo) => {
    window.sessionStorage.setItem(MEMBER_AUTH_GATE_RETURN_TO_STORAGE_KEY, returnTo);

    expect(memberAuthGateToast.consumeMemberAuthGateReturnTo?.()).toBe(null);
    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_RETURN_TO_STORAGE_KEY)).toBe(null);
  });
});
