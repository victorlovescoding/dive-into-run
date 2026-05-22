'use client';

import styles from './FollowButton.module.css';

/**
 * Shared render-only follow/unfollow control.
 * @param {object} props - Component props.
 * @param {boolean} props.isFollowing - Whether viewer currently follows the target.
 * @param {boolean} props.isPending - Whether a mutation is in flight.
 * @param {string} props.label - Visible button label.
 * @param {() => void | Promise<void>} props.onToggle - Toggle handler owned by runtime.
 * @returns {import('react').ReactElement} Follow button.
 */
export default function FollowButton({ isFollowing, isPending, label, onToggle }) {
  const className = isFollowing ? `${styles.button} ${styles.following}` : styles.button;

  return (
    <button type="button" className={className} disabled={isPending} onClick={onToggle}>
      {label}
    </button>
  );
}
