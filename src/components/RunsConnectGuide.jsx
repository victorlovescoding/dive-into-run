import styles from './RunsConnectGuide.module.css';

/**
 * 引導使用者連結 Strava 帳號的引導畫面。
 * 顯示標題、副標題和連結按鈕，點擊後跳轉至 Strava OAuth 授權頁。
 * @returns {import('react').ReactElement} Strava 連結引導元件。
 */
export default function RunsConnectGuide() {
  const handleConnect = () => {
    const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
    const redirectUri = `${window.location.origin}/runs/callback`;
    const url =
      `https://www.strava.com/oauth/authorize` +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&scope=activity:read_all`;

    window.location.assign(url);
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>連結你的 Strava 帳號</h2>
      <p className={styles.subtitle}>追蹤你的跑步紀錄</p>
      <button className={styles.connectButton} onClick={handleConnect} type="button">
        連結 Strava
      </button>
    </div>
  );
}
