import Link from 'next/link';
import styles from './HomePage.module.css';

const EVENTS_HREF = '/events';

const RUN_GROUPS = Object.freeze([
  { title: '大安森林公園 8K', time: '週六 06:30', tag: '晨跑', pace: '6:30/km', meetingPoint: '2 號出口', distance: '8K', participants: '7 人', trust: '可查看公開檔案', initials: ['文', '安', 'J'] },
  { title: '河濱輕鬆跑 5K', time: '今天 19:20', tag: '新手友善', pace: '7:00/km', meetingPoint: '古亭河濱', distance: '5K', participants: '5 人', trust: '主揪完成 12 場', initials: ['C', '郁', 'M'] },
  { title: '松山機場外圈 10K', time: '週日 07:00', tag: '穩定配速', pace: '5:50/km', meetingPoint: '民權公園', distance: '10K', participants: '9 人', trust: '已設定活動路線', initials: ['R', '哲', 'N'] },
]);

const TRUST_ITEMS = Object.freeze([
  { title: '跑者公開檔案', body: '顯示頭像、名稱、簡介、加入日期、開團數與參團數；連結 Strava 時可呈現累計距離。' },
  { title: 'Strava 跑步紀錄', body: '連結 Strava 後，在跑步頁同步個人活動、距離、配速、時間與路線圖。' },
  { title: '文章與活動留言', body: '文章河道可分享跑步故事；活動詳情支援留言、參加者列表、收藏與分享。' },
]);

/**
 * Static hero product scene with text facts mirrored outside decorative art.
 * @returns {import('react').JSX.Element} Hero scene.
 */
function HeroScene() {
  return (
    <div className={styles.sceneWrap}>
      <div className={styles.morningScene} aria-hidden="true">
        <div className={styles.pathLane} />
        <div className={styles.runnerGroup}>
          <span className={styles.runner} />
          <span className={`${styles.runner} ${styles.runnerTwo}`} />
          <span className={`${styles.runner} ${styles.runnerThree}`} />
          <span className={`${styles.runner} ${styles.runnerFour}`} />
        </div>
      </div>
      <div className={`${styles.floatingCard} ${styles.weatherChip}`}>
        <span className={styles.weatherDot} aria-hidden="true" />
        <span>22°C 微風，適合晨跑</span>
      </div>
      <article className={`${styles.floatingCard} ${styles.eventCard}`} aria-label="精選約跑活動">
        <div className={styles.cardTitleRow}>
          <div>
            <p className={styles.meta}>週六 06:30</p>
            <h3>大安森林公園 8K</h3>
          </div>
          <span className={styles.pill}>主揪可見</span>
        </div>
        <p>大安森林公園 · 06:18 集合中。從信義路側入口集合，繞公園兩圈後接和平東路緩跑。</p>
        <div className={styles.infoGrid}>
          <span><strong>6:30/km</strong>配速</span>
          <span><strong>7 人</strong>已加入</span>
          <span><strong>2 號出口</strong>集合地</span>
          <span><strong>路線</strong>已設定</span>
        </div>
      </article>
      <div className={`${styles.floatingCard} ${styles.mapCard}`}>
        <div className={styles.routeMap} aria-hidden="true">
          <svg viewBox="0 0 300 164">
            <path className={styles.routeShadow} d="M34 128 C54 86 86 96 102 58 C121 14 169 25 178 66 C188 112 244 85 264 38" />
            <path className={styles.routePath} d="M34 128 C54 86 86 96 102 58 C121 14 169 25 178 66 C188 112 244 85 264 38" />
          </svg>
          <span className={styles.pin} />
        </div>
        <div className={styles.mapMeta}>
          <span>集合 pin · 捷運大安森林公園 2 號出口</span>
          <span>8.0K</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Render one static run group card.
 * @param {object} props - Component props.
 * @param {(typeof RUN_GROUPS)[number]} props.group - Run group presentation data.
 * @returns {import('react').JSX.Element} Run group card.
 */
function RunGroupCard({ group }) {
  return (
    <article className={styles.joinCard}>
      <div className={styles.cardTitleRow}>
        <div>
          <p className={styles.meta}>{group.time}</p>
          <h3>{group.title}</h3>
        </div>
        <span className={styles.tag}>{group.tag}</span>
      </div>
      <dl className={styles.joinMeta}>
        <div><dt>配速</dt><dd>{group.pace}</dd></div>
        <div><dt>集合地</dt><dd>{group.meetingPoint}</dd></div>
        <div><dt>距離</dt><dd>{group.distance}</dd></div>
        <div><dt>參與</dt><dd>{group.participants}</dd></div>
      </dl>
      <div className={styles.miniAvatars}>
        {group.initials.map((initial) => (
          <span className={styles.avatar} aria-hidden="true" key={`${group.title}-${initial}`}>{initial}</span>
        ))}
        <span>{group.trust}</span>
      </div>
    </article>
  );
}

/**
 * Render one trust-system item.
 * @param {object} props - Component props.
 * @param {(typeof TRUST_ITEMS)[number]} props.item - Trust item presentation data.
 * @returns {import('react').JSX.Element} Trust item.
 */
function TrustItem({ item }) {
  return (
    <article className={styles.trustItem}>
      <span className={styles.trustIcon} aria-hidden="true" />
      <div>
        <h3>{item.title}</h3>
        <p>{item.body}</p>
      </div>
    </article>
  );
}

/**
 * Render-only homepage landing screen for the root route.
 * @returns {import('react').JSX.Element} Homepage screen.
 */
export default function HomePage() {
  return (
    <>
      <main className={styles.home} aria-labelledby="homepage-title">
        <section className={styles.hero} aria-label="首頁主視覺">
          <div className={styles.sectionInner}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>MORNING RUN CLUB · TAIPEI</p>
                <h1 id="homepage-title" className={styles.heroTitle}>
                  <span>Dive Into Run</span>
                  今天，一起出門跑。
                </h1>
                <p className={styles.lead}>
                  找到配速剛好、時間地點合適的跑步揪團。從活動時間、集合地、距離、
                  配速、名額到路線，一眼判斷今天適不適合加入。
                </p>
                <div className={styles.ctaRow}>
                  <Link className={`${styles.linkButton} ${styles.primaryButton}`} href={EVENTS_HREF}>
                    查看揪團活動
                  </Link>
                  <Link className={`${styles.linkButton} ${styles.secondaryButton}`} href={EVENTS_HREF}>
                    新增跑步揪團
                  </Link>
                </div>
                <div className={styles.heroProof}>
                  <span className={styles.avatarStack} aria-hidden="true">
                    <span className={styles.avatar}>文</span>
                    <span className={styles.avatar}>安</span>
                    <span className={styles.avatar}>J</span>
                    <span className={styles.avatar}>K</span>
                  </span>
                  <span>公開檔案、主揪資訊、參加者列表與活動留言，加入前先看得到脈絡。</span>
                </div>
              </div>
              <HeroScene />
            </div>
          </div>
        </section>

        <section className={styles.runGroups} aria-labelledby="run-groups-title">
          <div className={styles.sectionInner}>
            <div className={styles.runGroupsHead}>
              <div>
                <p className={styles.eyebrow}>RUN GROUPS</p>
                <h2 id="run-groups-title" className={styles.sectionTitle}>可以加入的揪團活動</h2>
              </div>
              <Link className={`${styles.linkButton} ${styles.ghostButton}`} href={EVENTS_HREF}>
                看全部活動
              </Link>
            </div>
            <div className={styles.runCards}>
              {RUN_GROUPS.map((group) => (
                <RunGroupCard group={group} key={group.title} />
              ))}
            </div>
          </div>
        </section>

        <section className={styles.trustSystem} aria-labelledby="trust-title">
          <div className={`${styles.sectionInner} ${styles.trustGrid}`}>
            <div>
              <p className={styles.eyebrow}>WHAT EXISTS NOW</p>
              <h2 id="trust-title" className={styles.sectionTitle}>加入活動前，先把必要資訊看清楚。</h2>
              <p className={styles.lead}>
                活動頁呈現時間、報名截止、地點、集合、距離、配速、人數上限、剩餘名額、
                主揪、路線與留言。你不用私訊猜，也不用加入後才發現速度不合。
              </p>
            </div>
            <div className={styles.trustList}>
              {TRUST_ITEMS.map((item) => (
                <TrustItem item={item} key={item.title} />
              ))}
            </div>
          </div>
        </section>

        <section className={styles.profileContext} aria-labelledby="profile-title">
          <div className={`${styles.sectionInner} ${styles.profileGrid}`}>
            <article className={styles.profilePanel}>
              <div>
                <div className={styles.profileIdentity}>
                  <span className={styles.profilePhoto} aria-hidden="true" />
                  <div>
                    <p className={styles.panelMeta}>RUNNER PROFILE</p>
                    <h3>陳以文 · 台北晨跑</h3>
                  </div>
                </div>
                <p>常跑大安、河濱與信義區。公開檔案整理個人簡介、開團與參團狀態。</p>
              </div>
              <dl className={styles.recordGrid}>
                <div>
                  <dt>開團數</dt>
                  <dd>18</dd>
                </div>
                <div>
                  <dt>參團數</dt>
                  <dd>42</dd>
                </div>
                <div>
                  <dt>累計距離</dt>
                  <dd>328.4 km</dd>
                </div>
              </dl>
            </article>
            <div className={styles.productContext}>
              <p className={styles.eyebrow}>PRODUCT CONTEXT</p>
              <h2 id="profile-title" className={styles.sectionTitle}>跑者公開檔案情境</h2>
              <p className={styles.lead}>
                從「想跑」到「加入」，只看必要資訊。首頁先回答時間合不合、配速合不合、
                路線有沒有設定、誰主揪，再把跑前天氣保留為獨立查詢入口。
              </p>
              <div className={styles.contextCards}>
                <article className={styles.contextCard}>
                  <p className={styles.panelMeta}>WEATHER</p>
                  <h3>跑前天氣</h3>
                  <p>天氣頁可查台灣縣市、鄉鎮預報，並收藏常用地點。</p>
                </article>
                <article className={styles.contextCard}>
                  <p className={styles.panelMeta}>ROUTE</p>
                  <h3>集合點清楚</h3>
                  <p>pin、捷運出口與路線段落同卡呈現。</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.ctaSection} aria-labelledby="cta-title">
          <div className={styles.sectionInner}>
            <div className={styles.ctaPanel}>
              <p className={styles.eyebrow}>READY FOR TOMORROW MORNING?</p>
              <h2 id="cta-title" className={styles.sectionTitle}>建立清楚的活動頁</h2>
              <p className={styles.lead}>
                把下一場跑步，從群組裡拉回清楚的活動頁。填好集合點、距離、配速、
                人數上限與路線，讓適合的跑者自己找到你。
              </p>
              <div className={styles.ctaRow}>
                <Link className={`${styles.linkButton} ${styles.primaryButton}`} href={EVENTS_HREF}>
                  新增跑步揪團
                </Link>
                <Link className={`${styles.linkButton} ${styles.secondaryButton}`} href={EVENTS_HREF}>
                  查看揪團活動
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>Dive Into Run · Taipei running community</span>
          <span>活動 · 文章 · 天氣 · 跑步紀錄</span>
        </div>
      </footer>
    </>
  );
}
