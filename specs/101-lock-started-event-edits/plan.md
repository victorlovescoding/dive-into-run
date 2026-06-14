# 實作計畫：活動開始後鎖定編輯與刪除

**Branch**: `101-lock-started-event-edits` | **Date**: 2026-06-13 | **Spec**: `specs/101-lock-started-event-edits/spec.md`
**Input**: Feature specification from `specs/101-lock-started-event-edits/spec.md`

**Scope**: P4/spec planning artifact only。本計畫不授權 source implementation、tests、package/config、stage、commit、push、PR、merge 或 CI watch。

## Summary

當可信系統時間達到或晚於活動 `time` 時，主揪不可再編輯活動本體或刪除活動；主揪在 UI 仍看得到編輯/刪除入口，但入口 disabled 並顯示「活動已開始，無法編輯或刪除。」。非主揪與未登入使用者維持既有無權限優先行為；留言、分享、收藏、參加、退出與參加人數 counter 互動不因本功能被鎖。

技術方案以 Firestore rules 的 `request.time` 作為 update/delete 操作當下的權威時間，因為現有活動更新與刪除路徑走 client Firestore SDK transaction，不經 server API route。UI 只使用目前 client time 做提示與降低誤操作；最終可否寫入必須由 Firestore rules 拒絕或允許。

## Technical Context

**Language/Version**: JavaScript with JSDoc `checkJs: true`, Next.js 15, React 19 App Router
**Primary Dependencies**: Firebase v9+ client SDK, Firestore rules, CSS Modules, Vitest, Playwright, `@firebase/rules-unit-testing`
**Storage**: Firestore `events/{eventId}` documents 與既有 participants/comments/favorites 等互動資料
**Testing**: Vitest unit/component/runtime tests、Firestore emulator rules tests、repo lint/type/dependency/build gates
**Target Platform**: Next.js App Router web app，使用 Firebase-backed client writes
**Project Type**: Single web application plus Firestore security rules
**Performance Goals**: 不為 menu 狀態新增 server round trip 或 polling；lock helper 只做本地時間比較，Firestore rules 在既有寫入時評估
**Constraints**: 不新增時間欄位、取消狀態、公告、解鎖/admin override 或 version history；權威 guard 必須涵蓋 stale UI、direct SDK writes、replay、rapid clicks 與 multi-device races
**Scale/Scope**: 僅鎖活動本體 edit/delete 與 soft-delete；既有 non-body interactions 必須維持原規則

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Pre-Phase 0 Gate**

- Scope/risk: P4/spec planning artifact；本任務不包含 implementation。
- Authorization boundary: writes 只限本 spec artifacts 與 AGENTS Spec Kit marker。
- Repo workflow: ordinary repo work 仍由 `AGENTS.md`、Context Routing 與 repo role boundaries 管理；Spec Kit 維持 explicit-only。
- Architecture: 後續實作必須維持 `Types -> Config -> Repo -> Service -> Runtime -> UI`；Firebase client writes 仍經 repo/service/runtime layers。
- Security authority: Firestore rules 是 client update/delete 的 final authority；UI disabled state 只作提示。
- Product scope: 不新增時間欄位、取消狀態、公告、unlock/admin override 或 version history。

**Result**: Pass。No constitution violations.

**Post-Phase 1 Gate**

- `research.md` 記錄 `request.time` 為 authoritative operation-time strategy，並拒絕把 API route migration 納入 MVP。
- `data-model.md` 將 lock scope 限定在 EventBody 與 soft-delete，participant counters 與 child interactions 不在 lock 內。
- `contracts/event-start-lock.md` 定義 UI/runtime/backend behavior contract 與 Firestore rules pseudocode，不新增 HTTP/OpenAPI contract。
- `quickstart.md` 只列 validation commands，並誠實註明 disabled package scripts 不能當 evidence。

**Result**: Pass。No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/101-lock-started-event-edits/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    └── event-start-lock.md
```

### Source Code (repository root)

```text
src/
├── app/
│   └── events/[id]/eventDetailClient.jsx
├── components/
│   ├── EventCardMenu.jsx
│   ├── EventDeleteConfirm.jsx
│   └── EventEditForm.jsx
├── repo/
│   ├── client/firebase-events-repo.js
│   └── soft-delete-retention.js
├── runtime/
│   ├── client/use-cases/event-use-cases.js
│   ├── events/event-runtime-helpers.js
│   └── hooks/
│       ├── useEventDetailMutations.js
│       ├── useEventDetailRuntime.js
│       ├── useEventMutations.js
│       └── useEventEditForm.js
├── service/
│   └── event-service.js
└── ui/
    └── events/EventDetailScreen.jsx

firestore.rules

tests/
├── server/firestore/
│   ├── event-soft-delete-rules.test.js
│   └── event-start-lock-rules.test.js
└── unit/
    ├── components/EventCardMenu.test.jsx
    ├── runtime/
    │   ├── useEventDetailMutations.test.jsx
    │   └── useEventMutations.test.jsx
    ├── service/event-service.test.js
    └── ui/events/EventDetailScreen.test.jsx
```

**Structure Decision**: 使用既有 single Next.js app 與 Firestore rules 結構。MVP 不新增 event update/delete API route；目前 update/delete 已透過 client `runTransaction` 寫 Firestore，所以 authoritative lock 放在 `firestore.rules`，service/runtime/UI 只負責準備、驗證與呈現同一條產品規則。

## Phase 0 / Phase 1 Outputs

- `research.md`: server time、equality boundary、rules placement、UI behavior、permission priority、stale races、unaffected interactions 與 testing 的決策和替代方案。
- `data-model.md`: Event、EventBody、Actor、StartLockEvaluation、DeleteOperation/SoftDelete、Non-body Interactions。
- `contracts/event-start-lock.md`: edit/delete lock 的 UI/runtime/backend behavior contract 與 Firestore rules pseudocode。
- `quickstart.md`: validation scenarios 與 commands；不含 implementation code。

## Evidence Touchpoints

- Update path: `src/runtime/client/use-cases/event-use-cases.js:194`, `:203`; `src/repo/client/firebase-events-repo.js:270`, `:273-286`; `src/service/event-service.js:481`, `:509-515`, `:522-530`。
- Delete path: `src/runtime/client/use-cases/event-use-cases.js:220`; `src/repo/client/firebase-events-repo.js:296`, `:302-321`; `src/repo/soft-delete-retention.js:32-48`。
- Rules: `firestore.rules:494`, hard delete denied at `:507`, host update at `:510-519`, host soft-delete at `:520-523`, participant counter branch at `:524-534`。
- UI/runtime: detail owner menu at `src/ui/events/EventDetailScreen.jsx:100-105`; shared menu host-only behavior at `src/components/EventCardMenu.jsx:45`; edit/delete clicks at `:50`, `:58`; edit submit disabled currently only dirty/submitting at `src/components/EventEditForm.jsx:312`。
- Non-body interactions to preserve: favorite/share/comments/join/leave touchpoints in `EventDetailScreen.jsx`, `ShareButton.jsx`, `CommentSection.jsx`, and `useEventDetailParticipation.js` per research evidence。

## Risks / Clarifications

- `firestore.rules` 目前有較寬的 `remainingSeats` / `participantsCount` counter update branch；實作不能誤鎖 join/leave counter writes。
- Rules emulator 對 `request.time == event.time` 的精準控制可能不穩；需要 pure function unit test 覆蓋 equality，rules tests 則用可參數化的 future/past seed data。
- 既有 rules test seed time `2026-05-28T10:00:00.000Z` 到 2026-06-13 已是過去；新測試不應依賴固定過期日期。
- List page 與 detail page 共用 `EventCardMenu`，所以兩處 owner menu disabled behavior 都要驗證。
- Detail delete 目前會在 delete 前送 cancellation notifications；後續實作必須避免 started-lock rejection 造成誤導通知副作用。

## Complexity Tracking

No constitution violations。No complexity exception is required.
