import { adminDb } from '@/config/server/firebase-admin-app';

/**
 * @typedef {{ id: string, path: string, data: Record<string, unknown> }} ReportTargetDocument
 * @typedef {{ target: ReportTargetDocument | null, parent: ReportTargetDocument | null }} ReportTargetDocuments
 */

/**
 * Converts an Admin SDK snapshot into resolver input.
 * @param {{ exists: boolean, id: string, ref: { path: string }, data: () => Record<string, unknown> | undefined }} snapshot - Firestore snapshot.
 * @returns {ReportTargetDocument | null} Normalized document or null.
 */
function snapshotToDocument(snapshot) {
  if (!snapshot.exists) return null;
  return {
    id: snapshot.id,
    path: snapshot.ref.path,
    data: snapshot.data() ?? {},
  };
}

/**
 * Reads target documents needed to resolve a report target.
 * @param {import('@/types/report-types').TargetIdentity} targetIdentity - Normalized identity.
 * @returns {Promise<ReportTargetDocuments>} Target and optional parent documents.
 */
export async function readReportTargetDocuments(targetIdentity) {
  if (targetIdentity.targetType === 'post') {
    const target = await adminDb.doc(`posts/${targetIdentity.postId}`).get();
    return { target: snapshotToDocument(target), parent: null };
  }

  if (targetIdentity.targetType === 'postComment') {
    const [parent, target] = await Promise.all([
      adminDb.doc(`posts/${targetIdentity.postId}`).get(),
      adminDb.doc(`posts/${targetIdentity.postId}/comments/${targetIdentity.commentId}`).get(),
    ]);
    return {
      parent: snapshotToDocument(parent),
      target: snapshotToDocument(target),
    };
  }

  if (targetIdentity.targetType === 'event') {
    const target = await adminDb.doc(`events/${targetIdentity.eventId}`).get();
    return { target: snapshotToDocument(target), parent: null };
  }

  if (targetIdentity.targetType === 'eventComment') {
    const [parent, target] = await Promise.all([
      adminDb.doc(`events/${targetIdentity.eventId}`).get(),
      adminDb.doc(`events/${targetIdentity.eventId}/comments/${targetIdentity.commentId}`).get(),
    ]);
    return {
      parent: snapshotToDocument(parent),
      target: snapshotToDocument(target),
    };
  }

  return { target: null, parent: null };
}

export default readReportTargetDocuments;
