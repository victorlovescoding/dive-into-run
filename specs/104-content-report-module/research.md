# Research: 模組化內容檢舉系統

## Decision: Route and server use-case pattern

**Decision**: Implement `POST /api/reports` as a thin App Router route that delegates to a server use-case returning `{ status, body }`. The route owns request JSON parsing and a final generic 500 catch only; auth, validation, target resolution, duplicate handling, and response mapping live below the route.

**Rationale**: Existing route patterns keep `src/app/api/**/route.js` thin, for example `src/app/api/follows/[targetUid]/route.js:24-32` and `src/app/api/account/deletion/route.js:13-35`. Existing server use-cases return `{ status, body }`, with examples in `src/runtime/server/use-cases/follow-server-use-cases.js:62,84,88` and `src/runtime/server/use-cases/account-deletion-server-use-cases.js:57,69,73,80,85,108,112`.

**Alternatives considered**:

- Put all logic in `route.js`: rejected because it violates App Router thin-route practice and makes validation/target resolution harder to unit test.
- Add a shared server handler wrapper first: rejected because explorer evidence found no existing shared wrapper; adding one is wider infrastructure scope than Phase 1 needs.

## Decision: Authentication with bearer token and Firebase Admin Auth

**Decision**: The server use-case extracts `Authorization: Bearer <token>` and verifies it through the Admin Auth repo before creating any report.

**Rationale**: Existing server-side auth follows this pattern in `src/runtime/server/use-cases/follow-server-use-cases.js:18-42`, backed by Admin Auth in `src/repo/server/firebase-auth-admin-repo.js:1-9`. This keeps client report creation behind server authority and supports FR-037/FR-068.

**Alternatives considered**:

- Trust client auth context only: rejected because direct API calls must still be rejected when unauthenticated or token-invalid.
- Allow client Firestore writes guarded by security rules: rejected because FR-035/FR-036 require all report creation through `POST /api/reports`.

## Decision: Admin/server repo writes

**Decision**: Add a server report repo that uses `adminDb` and Admin SDK timestamps to create `reports/{reportId}`. The repo must use create/no-overwrite semantics so an existing deterministic doc id maps to duplicate 409.

**Rationale**: Admin SDK helpers are centralized in `src/config/server/firebase-admin-app.js:10-17`. Server repos already isolate Admin Firestore writes, for example `src/repo/server/firebase-follow-server-repo.js:57-71,90,97,104-105,151-158`, `src/repo/server/strava-server-repo.js:113-118,132-136,151-155,175-179`, and `src/repo/server/account-deletion-server-repo.js:61,72,83,90-95,486,506,521`.

**Alternatives considered**:

- Write reports from client code: rejected by FR-036 and rules privacy requirements.
- Use random report ids then query for duplicates: rejected because FR-043 requires deterministic hashed ids and FR-045 forbids prechecking/report-history style queries.

## Decision: Validation and target resolver split

**Decision**: Split the domain into `report-service` for request validation, normalization, sourcePath sanitization, targetKey/doc shape creation, and a server target resolver for Firestore target reads, visibility checks, self-report checks, and target snapshot mapping.

**Rationale**: The service layer is the repo's normalization boundary. Target resolution needs server-only reads of `posts`, `posts/{postId}/comments`, `events`, and `events/{eventId}/comments`, while validation of reason/details/sourcePath does not need Firestore. Keeping these separate makes unit tests focused and prevents route/UI code from touching low-level Firebase.

**Alternatives considered**:

- Put resolver logic in the repo: rejected because repos should fetch raw records, while visibility/self-report/snapshot decisions are business logic.
- Put validation in runtime hooks: rejected because direct API calls must receive the same validation and status mapping as UI submissions.

## Decision: Target identity and parent visibility

**Decision**: Support four target identities in the server contract: `post`, `postComment`, `event`, and `eventComment`. Comment targets must validate both the comment doc and the parent post/event public active state.

**Rationale**: Post docs live at `posts/{postId}` and comments at `posts/{postId}/comments/{commentId}` (`src/repo/client/firebase-posts-repo.js:86-87,187,200-201,244`). Event docs live at `events/{eventId}` and event comments at `events/{eventId}/comments/{commentId}` (`src/repo/client/firebase-events-repo.js:61,145`; `src/repo/client/firebase-event-comments-repo.js:50,72`). Existing public/active checks exclude `accountDeletionHidden` and `deletedAt` in post and event services (`src/service/post-service.js:86-87`; `src/service/event-service.js:241-242,252`). For comments, parent active validation is required so a visible orphan comment cannot create a report for hidden/deleted parent content.

**Alternatives considered**:

- Resolve only the leaf comment document: rejected because FR-039 applies to public visibility of the content target in context, including parent containers.
- Delay event/eventComment support until Phase 2: rejected because FR-002 requires Phase 1 API/schema support for all four target types.

## Decision: Deterministic report id and targetKey

**Decision**: Generate `targetKey` from the canonical content path, then generate the report doc id as a SHA-256 hex hash of `reporterUid`, `targetType`, and `targetKey`. Store both the doc id and human-readable `targetKey`; never expose report lists or precheck results to clients.

**Rationale**: FR-042/FR-043 require one report per reporter-target pair and deterministic hashed doc ids. A hash prevents raw reporter uid/target path leakage through the document id while preserving duplicate detection. The create operation is atomic enough for concurrent duplicate submissions without adding a composite index or report-history query.

**Alternatives considered**:

- Plain doc id such as `${reporterUid}_${targetKey}`: rejected because it leaks reporter and target identity through the id.
- Random doc id plus unique query: rejected because Firestore has no unique index for this shape and the required prequery would reveal/consume report history mechanics.

## Decision: sourcePath sanitization

**Decision**: Accept `sourcePath` only as a same-app relative path that starts with `/`, has no protocol/host/script payload, and is at most 1024 characters. Normalize missing, invalid, or over-limit values to the target's canonical `targetPath`; do not truncate client input.

**Rationale**: The spec treats `sourcePath` as untrusted context. The saved report must not preserve external URLs, `javascript:` URLs, markup payloads, or oversized strings. Falling back instead of truncating avoids storing partial routes with ambiguous query strings. Target path remains server-generated and authoritative.

**Alternatives considered**:

- Store the full browser URL: rejected because it can include hostnames, tracking parameters, or untrusted payloads.
- Drop `sourcePath`: rejected because FR-056 requires a sanitized source route.

## Decision: Firestore rules deny all client report access

**Decision**: Add `match /reports/{reportId}` with explicit denial for client get/list/create/update/delete. Only Admin SDK server code may write reports.

**Rationale**: FR-036, FR-044, and FR-045 require that clients cannot create reports, read their own history, or check whether a target was already reported. Existing server-only deny examples are `firestore.rules:569-571` for `stravaTokens` and `firestore.rules:724-725` for `accountDeletionRequests`.

**Alternatives considered**:

- Allow authenticated create only: rejected because report creation must run server validation and snapshot generation.
- Allow reporter get/list on their reports: rejected because the spec explicitly excludes reporter history and precheck.

## Decision: UI menu separation from owner-only menus

**Decision**: Add report menu actions as separate non-owner authenticated actions, not as children of existing owner-only edit/delete menus. Post and comment cards must be able to show a three-dot menu for authenticated non-authors when report is the only available action.

**Rationale**: Existing `PostCard` owner menu render gate is owner-only (`src/components/PostCard.jsx:376`), and `CommentCard` currently shows a menu only for owners (`src/components/CommentCard.jsx:74`; `src/components/CommentCardMenu.jsx:13,97`). If report actions are added inside owner-only menus, non-authors will never see them, violating FR-010/FR-011 and Phase 1 acceptance scenarios.

**Alternatives considered**:

- Add `檢舉` inside `OwnerMenu`: rejected because it hides reports from the only users allowed to report.
- Add a second visible button outside the three-dot menu: rejected because FR-005/FR-006 require the three-dot more menu interaction.

## Decision: Testing strategy

**Decision**: Use focused Vitest unit tests for services/runtime/API mapping, integration tests for React dialog/menu behavior, Firestore rules emulator tests for `reports` denial, and browser/Playwright verification for page-level entry points.

**Rationale**: The constitution requires tests before implementation and keeps executable tests under `tests/**`. Existing unit mock style uses `vi.hoisted` and `vi.mock`, for example `tests/unit/runtime/post-use-cases.test.js:10,28-29,68`. Firestore rules tests use `@firebase/rules-unit-testing`, for example `tests/server/firestore/post-soft-delete-rules.test.js:2-7,33-36,46,55,63,72` and `tests/server/firestore/notification-rules.test.js:12-21,31,40,94-133`.

**Alternatives considered**:

- Only E2E tests: rejected because validation, duplicate id generation, and snapshot mapping need fast deterministic coverage.
- Only service tests: rejected because menu visibility and rules denial are core acceptance criteria.

## Decision: Phase 2 event deep-link note

**Decision**: Keep event/eventComment API and resolver support in Phase 1, but do not add event or event-comment UI entry points. Before Phase 2 UI tasks, verify the event-comment notification/deep-link target render path instead of copying the post-comment assumptions.

**Rationale**: FR-003/FR-004 require Phase 1 UI to expose only post/postComment, and require Phase 2 planning to confirm event-comment deep-link behavior first. Explorer evidence shows event comments exist (`src/repo/client/firebase-event-comments-repo.js:50,72`; `src/ui/events/EventDetailScreen.jsx:272`) and a shared comment deep-link helper exists (`src/components/CommentSection.jsx:60,71`), but Phase 2 still needs explicit verification against the actual target-comment render behavior at that time.

**Alternatives considered**:

- Add event UI in Phase 1 because the schema supports it: rejected as direct scope creep.
- Omit eventComment from the server contract until Phase 2: rejected because Phase 1 API/schema must support all four target types.
