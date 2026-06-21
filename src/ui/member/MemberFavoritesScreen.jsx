'use client';

import Link from 'next/link';
import styles from './MemberFavoritesScreen.module.css';

/**
 * Returns the detail route for a favorite item.
 * @param {object} item - Favorite row from the runtime.
 * @param {string} item.type - Favorite content type.
 * @param {string} item.targetId - Target content ID.
 * @returns {string} Detail route href.
 */
function getDetailHref(item) {
  return item.type === 'event' ? `/events/${item.targetId}` : `/posts/${item.targetId}`;
}

/**
 * Returns the primary title for a target document.
 * @param {object | null} target - Latest target document data.
 * @param {string} fallback - Fallback target ID.
 * @returns {string} Card title.
 */
function getTargetTitle(target, fallback) {
  if (!target) return fallback;
  return String(target.title || fallback);
}

/**
 * Returns secondary card text from the latest target document.
 * @param {object | null} target - Latest target document data.
 * @returns {string} Secondary card text.
 */
function getTargetDescription(target) {
  if (!target) return '';

  const postText = target.excerpt || target.content;
  if (postText) return String(postText);

  const eventPlace = [target.city, target.district, target.location, target.meetPlace]
    .filter(Boolean)
    .join(' ');
  return eventPlace;
}

/**
 * Single favorite card with missing-target handling.
 * @param {object} props - Component props.
 * @param {object} props.item - Favorite row from the runtime.
 * @param {(item: object) => void | Promise<void>} props.onRemove - Remove callback.
 * @returns {import('react').ReactElement} Favorite card.
 */
function FavoriteCard({ item, onRemove }) {
  const title = getTargetTitle(item.target, item.targetId);
  const description = getTargetDescription(item.target);
  const removeLabel = `移除收藏 ${item.targetId}`;

  return (
    <article className={styles.card} aria-label={`${item.targetId} 收藏項目`}>
      <div className={styles.cardBody}>
        {item.missing ? (
          <>
            <h2 className={styles.cardTitle}>{item.targetId}</h2>
            <p className={styles.missingText}>內容已不存在</p>
          </>
        ) : (
          <Link href={getDetailHref(item)} className={styles.cardLink}>
            <h2 className={styles.cardTitle}>{title}</h2>
            {description && <p className={styles.cardDescription}>{description}</p>}
          </Link>
        )}
      </div>

      <button
        type="button"
        className={styles.removeButton}
        aria-label={removeLabel}
        onClick={() => onRemove(item)}
      >
        移除
      </button>
    </article>
  );
}

/**
 * Renders the active favorites tab panel.
 * @param {object} props - Component props.
 * @param {object} props.tab - Tab runtime state.
 * @param {(item: object) => void | Promise<void>} props.onRemove - Remove callback.
 * @returns {import('react').ReactElement} Tab panel.
 */
function FavoritesPanel({ tab, onRemove }) {
  const { bucket } = tab;

  if (bucket.isLoading) {
    return <p className={styles.loading}>載入中…</p>;
  }

  if (bucket.error) {
    return (
      <div className={styles.error} role="alert">
        {bucket.error}
      </div>
    );
  }

  if (bucket.items.length === 0) {
    return <p className={styles.empty}>{tab.emptyText}</p>;
  }

  return (
    <div className={styles.cardList}>
      {bucket.items.map((item) => (
        <FavoriteCard key={`${item.type}-${item.targetId}`} item={item} onRemove={onRemove} />
      ))}
    </div>
  );
}

/**
 * Member favorites render-only screen.
 * @param {object} props - Component props.
 * @param {object} props.runtime - Member favorites runtime boundary.
 * @returns {import('react').ReactElement} Rendered screen.
 */
export default function MemberFavoritesScreen({ runtime }) {
  const { canRender = true, tabs, selectTab, handleTabKeyDown, removeFavorite } = runtime;

  if (!canRender) return null;

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>我的收藏</h1>

      <div className={styles.tabBar} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.isActive}
            aria-controls={tab.panelId}
            tabIndex={tab.isActive ? 0 : -1}
            className={tab.isActive ? styles.tabActive : styles.tab}
            onClick={() => selectTab(tab.tabIndex)}
            onKeyDown={handleTabKeyDown}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <section
          key={tab.panelId}
          id={tab.panelId}
          role="tabpanel"
          aria-labelledby={tab.id}
          hidden={!tab.isActive}
        >
          {tab.isActive && <FavoritesPanel tab={tab} onRemove={removeFavorite} />}
        </section>
      ))}
    </main>
  );
}
