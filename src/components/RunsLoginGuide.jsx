import Link from 'next/link';
import styles from './RunsLoginGuide.module.css';

/**
 * 引導未登入使用者前往登入頁面的元件。
 * 顯示提示標題與登入連結。
 * @returns {import('react').JSX.Element} 登入引導畫面。
 */
export default function RunsLoginGuide() {
  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>請先登入以查看跑步紀錄</h2>
      <Link href="/login" className={styles.loginLink}>
        登入
      </Link>
    </div>
  );
}
