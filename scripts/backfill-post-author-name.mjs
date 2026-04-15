/**
 * 一次性 migration：回填 posts collection 的 authorName 欄位。
 * 用法：node scripts/backfill-post-author-name.mjs
 *
 * 流程：
 * 1. 讀取所有 posts documents
 * 2. 收集不重複的 authorUid
 * 3. 批次查詢 users collection 取得 uid → name 對應
 * 4. 用 writeBatch 回填 authorName（跳過已有值的文章）
 */

import 'dotenv/config';
import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../src/lib/firebase-client.js';

const FALLBACK_NAME = '匿名使用者';

/**
 * 根據 uid 清單批次查詢 users collection，回傳 uid → name 的 Map。
 * @param {string[]} uids - 不重複的使用者 uid 清單。
 * @returns {Promise<Map<string, string>>} uid 對應 name 的 Map。
 */
async function fetchUserNames(uids) {
  /** @type {Map<string, string>} */
  const nameMap = new Map();

  const results = await Promise.all(uids.map((uid) => getDoc(doc(db, 'users', uid))));

  results.forEach((snap, i) => {
    const name = snap.exists() ? snap.data().name : undefined;
    nameMap.set(uids[i], name || FALLBACK_NAME);
  });

  return nameMap;
}

/**
 * 主程式：讀取所有 posts，回填缺少的 authorName。
 * @returns {Promise<void>}
 */
async function main() {
  console.info('[backfill] 開始讀取 posts collection…');

  const postsSnap = await getDocs(collection(db, 'posts'));

  if (postsSnap.empty) {
    console.warn('[backfill] posts collection 為空，結束。');
    return;
  }

  console.info(`[backfill] 共 ${postsSnap.size} 篇文章。`);

  // 收集需要更新的 docs 與不重複 authorUid
  /** @type {{ ref: import('firebase/firestore').DocumentReference, authorUid: string }[]} */
  const needsUpdate = [];
  let skipped = 0;

  postsSnap.forEach((postDoc) => {
    const data = postDoc.data();

    if (data.authorName) {
      skipped += 1;
      return;
    }

    if (!data.authorUid) {
      console.warn(`[backfill] 文章 ${postDoc.id} 缺少 authorUid，跳過。`);
      skipped += 1;
      return;
    }

    needsUpdate.push({ ref: postDoc.ref, authorUid: data.authorUid });
  });

  if (needsUpdate.length === 0) {
    console.info(`[backfill] 全部已有 authorName，無需更新（跳過 ${skipped} 筆）。`);
    return;
  }

  // 取得不重複 uid 清單
  const uniqueUids = [...new Set(needsUpdate.map((item) => item.authorUid))];
  console.info(`[backfill] 需查詢 ${uniqueUids.length} 位使用者…`);

  const nameMap = await fetchUserNames(uniqueUids);

  // 批次更新（writeBatch 上限 500，20 筆遠低於此）
  const batch = writeBatch(db);
  let updated = 0;

  needsUpdate.forEach(({ ref, authorUid }) => {
    const authorName = nameMap.get(authorUid) || FALLBACK_NAME;
    batch.update(ref, { authorName });
    updated += 1;
  });

  await batch.commit();

  console.info(`[backfill] 完成！更新 ${updated} 筆，跳過 ${skipped} 筆。`);
}

main().catch((err) => {
  console.error('[backfill] 執行失敗：', err);
  process.exit(1);
});
