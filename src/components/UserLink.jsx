import Link from 'next/link';
import Image from 'next/image';
import styles from './UserLink.module.css';

const DEFAULT_AVATAR = '/default-avatar.png';
const DEFAULT_SIZE = 36;

/**
 * 解析頭像來源 URL，photoURL 為空字串或 undefined 時回傳預設頭像。
 * @param {string} [photoURL] - 使用者頭像 URL。
 * @returns {string} 實際使用的頭像 src。
 */
function resolveAvatarSrc(photoURL) {
  if (typeof photoURL !== 'string' || photoURL.trim() === '') {
    return DEFAULT_AVATAR;
  }
  return photoURL;
}

/**
 * 組合根元素 className，將外部傳入的 className 附加到預設樣式之後。
 * @param {string} [extraClassName] - 額外 CSS class。
 * @returns {string} 完整 className。
 */
function buildLinkClassName(extraClassName) {
  if (typeof extraClassName !== 'string' || extraClassName === '') {
    return styles.link;
  }
  return `${styles.link} ${extraClassName}`;
}

/**
 * UserLink — 全站共用的「使用者頭像 + 名稱」連結元件。
 * 用途：提供可點擊的使用者識別區塊，導向 `/users/{uid}` 公開檔案頁面。
 * 設計重點：
 *   1. 統一處理頭像 fallback（無 photoURL 時使用 `/default-avatar.png`）。
 *   2. 永遠暴露 `aria-label={name}` 作為 accessible name，確保 screen reader
 *      能正確讀出連結對應的使用者，即使頭像或名稱被隱藏。
 *   3. `className` 會 pass-through 到根 `<Link>`，方便在不同場景（卡片、詳情、
 *      留言區）覆蓋樣式而不需重複實作 avatar + link。
 * @param {object} props - 元件屬性。
 * @param {string} props.uid - 目標使用者的 UID，組成 `/users/{uid}` 連結。
 * @param {string} props.name - 使用者顯示名稱，同時作為 aria-label 與 alt text。
 * @param {string} [props.photoURL] - 頭像 URL；空字串或未提供時會 fallback 至預設頭像。
 * @param {number} [props.size] - 頭像大小（px），預設 36。
 * @param {boolean} [props.showAvatar] - 是否渲染頭像 `<Image>`，預設 true。
 * @param {boolean} [props.showName] - 是否渲染可見名稱文字，預設 true。
 * @param {string} [props.className] - 附加到根 `<Link>` 的額外 CSS class。
 * @returns {import('react').ReactElement} 使用者連結元件。
 */
export default function UserLink({
  uid,
  name,
  photoURL,
  size = DEFAULT_SIZE,
  showAvatar = true,
  showName = true,
  className,
}) {
  const avatarSrc = resolveAvatarSrc(photoURL);
  const linkClassName = buildLinkClassName(className);

  return (
    <Link href={`/users/${uid}`} className={linkClassName} aria-label={name}>
      {showAvatar && (
        <Image src={avatarSrc} alt={name} width={size} height={size} className={styles.avatar} />
      )}
      {showName && <span className={styles.name}>{name}</span>}
    </Link>
  );
}
