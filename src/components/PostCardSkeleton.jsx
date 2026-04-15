import styles from './PostCardSkeleton.module.css';

/**
 * 文章卡片骨架屏。
 * @param {object} [props] - 元件屬性。
 * @param {number} [props.count] - 顯示的骨架卡片數量，預設 3。
 * @returns {import('react').ReactElement} 骨架屏元件。
 */
export default function PostCardSkeleton({ count = 3 } = {}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.card} role="status" aria-busy="true" aria-label="載入中">
          <div className={styles.header}>
            <div className={`${styles.skeleton} ${styles.avatar}`} />
            <div className={styles.headerText}>
              <div className={`${styles.skeleton} ${styles.name}`} />
              <div className={`${styles.skeleton} ${styles.time}`} />
            </div>
          </div>
          <div className={`${styles.skeleton} ${styles.titleLine}`} />
          <div className={`${styles.skeleton} ${styles.contentLine}`} />
          <div className={`${styles.skeleton} ${styles.contentLineShort}`} />
          <div className={styles.metaBar}>
            <div className={`${styles.skeleton} ${styles.metaItem}`} />
            <div className={`${styles.skeleton} ${styles.metaItem}`} />
          </div>
        </div>
      ))}
    </>
  );
}
