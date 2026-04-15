import Image from 'next/image';
import styles from './ComposePrompt.module.css';

const DEFAULT_AVATAR = '/default-avatar.png';
const AVATAR_SIZE = 36;

/**
 * Feed 頂部發文假輸入框。
 * @param {object} props - 元件屬性。
 * @param {string} [props.userPhotoURL] - 使用者頭像 URL。
 * @param {() => void} props.onClick - 點擊後的回呼（開啟 Modal）。
 * @returns {import('react').ReactElement} 假輸入框元件。
 */
export default function ComposePrompt({ userPhotoURL, onClick }) {
  const src = userPhotoURL || DEFAULT_AVATAR;

  return (
    <button type="button" className={styles.prompt} onClick={onClick}>
      <Image
        className={styles.avatar}
        src={src}
        alt="使用者頭像"
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
      />
      <span className={styles.placeholder}>分享你的跑步故事...</span>
    </button>
  );
}
