# Code Review — 012-public-profile

日期：2026-04-10
Reviewer: Linus 模式
Base: `main` (cfb1591) ↔ Working tree (含 uncommitted modifications + untracked)

---

## 變更規模

- **modified**: `firestore.rules`, `firestore.indexes.json`, `src/contexts/AuthContext.jsx`, `src/lib/event-helpers.js`, `src/components/CommentCard.jsx` (+CSS), `src/app/events/[id]/eventDetailClient.jsx`, `src/app/events/page.jsx` (+CSS), `src/app/member/page.jsx`, `src/app/posts/[id]/PostDetailClient.jsx`
- **untracked (新建)**:
  - Service: `src/lib/firebase-profile.js`, `src/lib/firebase-profile-server.js`
  - Page: `src/app/users/[uid]/{page,ProfileClient,ProfileHeader,ProfileStats,ProfileEventList}.jsx` + `PublicProfile.module.css`
  - Component: `src/components/UserLink.jsx` + CSS
  - Member: `src/app/member/BioEditor.jsx` + CSS
  - Tests: `specs/012-public-profile/tests/{unit,integration}/*` (8 個檔案)

## 自動驗證閘門

| 項目                                                   | 結果                                                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `npm run lint`                                         | ✅ No ESLint warnings or errors                                                                       |
| `npm run type-check`（012 觸碰檔案）                   | ✅ 0 新錯誤                                                                                           |
| `npm run type-check`（全 repo）                        | ⚠️ 既有 noise（specs/001-009 + main 既存的 events/page.jsx FormDataEntryValue 錯誤），**非 012 引入** |
| `npx vitest run specs/012-public-profile/tests`        | ✅ 8 files / 84 tests passed                                                                          |
| Firestore rules `users/{userId}` 對 FR-007 / FR-006    | ✅ 公開讀 + bio ≤ 150 + 本人寫                                                                        |
| Service Layer Discipline (UI 不直 import firebase SDK) | ✅ Pass — `users/[uid]`, `UserLink`, `BioEditor` 均無 Firebase SDK import                             |
| Server-only 隔離                                       | ✅ `firebase-profile-server.js` 只被 `app/users/[uid]/page.jsx`(Server Component) 引用                |
| `@ts-ignore`                                           | ✅ 0 處                                                                                               |
| Inline `cspell:disable`                                | ✅ 0 處                                                                                               |
| TaskCompleteness vs `tasks.md`                         | ✅ T000-T020 對應實作均存在；T014 標 `[~]` 已附理由                                                   |

---

## Taste Rating

🟡 **Acceptable** — 整體結構合理，service layer 乾淨、tests 覆蓋完整、constitution gates 全綠，但有若干 over-engineering、duplicate-link a11y 雜訊與 lifecycle race condition 該修。

---

## Linus-Style Analysis

### [CRITICAL ISSUES]

> 沒有違反 First Principle / Iron Law 的問題。資料結構正確、沒有 breaking change、沒有安全漏洞。

---

### [IMPROVEMENT OPPORTUNITIES] (P1)

#### P1-1. `ProfileEventList.jsx:98-118` — `loadMore` 缺乏 unmount cleanup（race condition）

```js
const loadMore = useCallback(async () => {
  if (isLoadingMoreRef.current) return;
  // ...
  try {
    const page = await getHostedEvents(uid, { lastDoc: lastDocRef.current });
    setItems((prev) => [...prev, ...page.items.map(toDashboardItem)]);
    lastDocRef.current = page.lastDoc;
    setHasMore(page.hasMore);
  } catch (err) {
    setLoadMoreError('載入更多失敗');
  } finally {
    isLoadingMoreRef.current = false;
    setIsLoadingMore(false);
  }
}, [uid, hasMore]);
```

**問題**: 第一次 load (`useEffect` line 66-95) 用了 `cancelled` flag pattern，但 `loadMore` 沒有。當使用者快速離開頁面、IntersectionObserver 觸發後 `getHostedEvents` 還在 in-flight 時 component unmount，回 promise 後仍會 `setItems / setHasMore / setLoadMoreError / setIsLoadingMore` — React 18 雖不再 throw，但會 warn 「state update on unmounted component」。

**Linus 論據**: 「Effect 1 你想到了 cancelled，loadMore 你忘了。一致性是 good taste 的一部分。要嘛兩個都做、要嘛都不做。」

**建議**: 把 cleanup pattern 抽到 `useRef(true)` 的 `mountedRef`，effect cleanup 設 false，loadMore 在 await 後檢查 `mountedRef.current` 才 setState。或更乾脆——把 loadMore 的 setState 全部包在 mounted 檢查內，與 effect 1 的 `cancelled` 統一語意。

---

#### P1-2. `ProfileEventList.jsx:156-160` — `<Fragment>` 包單一 child 是無功能的 wrapper

```jsx
{
  items.map((event) => (
    <Fragment key={String(event.id)}>
      <DashboardEventCard event={event} isHost />
    </Fragment>
  ));
}
```

**問題**: Fragment 只在「需要回傳多個 sibling 但不想加 wrapper element」時才有意義。這裡只有單一 child，把 `key` 直接放到 `DashboardEventCard` 上即可。多了一層 Fragment 就是純粹的視覺噪音 + 一次 reconciliation 成本。

**Linus 論據**: 「Why are you wrapping a single child in a Fragment? 這是 cargo cult code。」

**建議**:

```jsx
{
  items.map((event) => <DashboardEventCard key={String(event.id)} event={event} isHost />);
}
```

---

#### P1-3. `eventDetailClient.jsx:748-768`、`CommentCard.jsx:48-66` — 雙重 UserLink 製造重複的 anchor

```jsx
{participants.map((p) => (
  <div key={...} className={styles.participantItem}>
    <UserLink uid={...} name={...} photoURL={...} size={36}
              showName={false} className={styles.participantAvatarLink} />
    <div className={styles.participantInfo}>
      <UserLink uid={...} name={...} showAvatar={false}
                className={styles.participantNameLink} />
      <div className={styles.participantStatus}>已參加</div>
    </div>
  </div>
))}
```

**問題**: 同一個 participant 渲染了**兩個** `<a href="/users/{uid}">`，accessible name 都是 `name`。Screen reader 使用者會聽到「Alice Runner, link」「Alice Runner, link」連續兩次，只是為了讓 avatar 跟 name 在視覺上分行。CommentCard 也犯一樣的毛病。

**Linus 論據**: 「Good code 沒有 duplicate state。Good a11y 沒有 duplicate links。你重複了五次相同的目的。」

**建議**: 結構上重做成一個 `<UserLink>` 同時包 avatar + name，靠 CSS flex / grid 排版（avatar 在左、name + status 在右）。把 `participantInfo` 的 `已參加` 從 link 內挪出來成 sibling 即可：

```jsx
<div className={styles.participantItem}>
  <UserLink uid={...} name={...} photoURL={...} size={36}
            className={styles.participantLink} />
  <div className={styles.participantStatus}>已參加</div>
</div>
```

CSS 用 `display: flex` 把 link 內的 avatar/name 排好（UserLink 已經是 inline-flex，所以直接 work）。CommentCard 同理 — 把 avatar + name 合在一個 link 內，把 time/edited badge 留在外面。

**影響**: 拿掉每個 participant 一個 redundant `<a>`、簡化 CSS 三 class（`participantAvatarLink` / `participantNameLink` / `avatarLink` / `authorNameLink`）為一個 `participantLink` / `commentAuthorLink`。

---

#### P1-4. `firestore.rules:15-21` — `bio` 驗證對「現有 over-150 字 bio」會永久鎖死

```
allow update: if isSignedIn()
  && request.auth.uid == userId
  && (
    !('bio' in request.resource.data)
    || (request.resource.data.bio is string && request.resource.data.bio.size() <= 150)
  );
```

**問題**: `setDoc(merge: true)` 時 `request.resource.data` 是「合併後的完整文件」。如果一個 user 在 rules 上線前因為某種途徑寫進 200 字 bio，那麼這個 user 之後**任何** update（連改名字、改頭像）都會被擋下，因為 merged data 中的 bio 仍是 200 字。

**Linus 論據**: 「You broke userspace. 即使你說『誰會有 200 字 bio』，那不是 'never' 而是 'we don't know'。」

**現實風險**: 此 feature 是新功能，理論上 production 沒有歷史 200+ 字 bio。但 emulator 測試環境、開發時手動 import 的 fixtures、未來資料 migration 都可能命中。

**建議**: 改用 `request.resource.data.diff(resource.data).changedKeys().hasAny(['bio'])` 判斷「這次寫入有沒有動 bio」，只在動 bio 時才驗證長度：

```
allow update: if isSignedIn()
  && request.auth.uid == userId
  && (
    !request.resource.data.diff(resource.data).changedKeys().hasAny(['bio'])
    || (request.resource.data.bio is string && request.resource.data.bio.size() <= 150)
  );
```

---

### [STYLE / DESIGN NOTES] (P2)

#### P2-1. `ProfileClient.jsx:42-52` — `toCreatedAtAdapter` 第三個 fallback 分支是 dead code

```js
function toCreatedAtAdapter(createdAt) {
  if (createdAt && typeof createdAt.toDate === 'function') return createdAt;
  if (createdAt instanceof Date) return { toDate: () => createdAt };
  // Defensive fallback: 若 createdAt 以 ISO string / millis 形式傳入也能 work。
  const fallback = new Date(/** ... */ createdAt);
  return { toDate: () => fallback };
}
```

**問題**: 呼叫端只有兩種：(1) `page.jsx` 序列化後的 `Date` 實例、(2) 測試環境傳的 `{ toDate() }` stub。不存在任何路徑會傳 ISO string / millis。第三分支永遠不會跑，但會給後續 reader 一種「這個函式接受多型輸入」的錯覺，誤導他們在別的地方也餵 string 進來。

**Linus 論據**: 「If you have code that doesn't run, delete it. 不要為想像中的需求寫 defensive code。」

**建議**: 刪掉第三分支。或者第二分支不命中時直接 throw，讓 type 違規 fail-fast：

```js
function toCreatedAtAdapter(createdAt) {
  if (createdAt && typeof createdAt.toDate === 'function') return createdAt;
  if (createdAt instanceof Date) return { toDate: () => createdAt };
  throw new Error('toCreatedAtAdapter: unsupported createdAt shape');
}
```

---

#### P2-2. `ProfileEventList.jsx:24-35` — `toDashboardItem` 的 `?? ''` / `?? 0` 是 redundant defensive

```js
function toDashboardItem(event) {
  return {
    id: event.id ?? '',
    title: event.title ?? '（未命名活動）',
    time: event.time,
    location: event.location ?? '',
    city: event.city ?? '',
    participantsCount: event.participantsCount ?? 0,
    maxParticipants: event.maxParticipants ?? 0,
    hostUid: event.hostUid ?? '',
  };
}
```

**問題**:

1. `event.id` 來自 `getHostedEvents` line 197 的 `d.id`，那是 `QueryDocumentSnapshot.id`，**永遠**是 string，不會 null。
2. `hostUid` 是 Firestore rules 在 create 時強制要求的欄位，不可能不存在。
3. `title` fallback 「（未命名活動）」是業務邏輯的 fallback（合理），但其他 fallback 沒有業務意義，純粹是「以防萬一」。

**Linus 論據**: 「`?? ''` everywhere 是缺乏對自己資料模型的信心。要嘛在邊界 normalize，要嘛在使用點處理。中間散布 noise 沒有意義。」

**建議**: 把 `id` / `hostUid` 的 fallback 拿掉。`title` / `location` / `city` 若需要 fallback，理由要寫在 JSDoc 上（已經有 `（未命名活動）`，OK）。

---

#### P2-3. `ProfileClient.jsx:95-101` — `useMemo` 對 root client component 的 micro-optimization

```js
const headerUser = useMemo(
  () => ({
    ...user,
    createdAt: toCreatedAtAdapter(user.createdAt),
  }),
  [user],
);
```

**問題**: ProfileClient 是 root client component（被 server `page.jsx` 直接 render），不會被 parent re-render。`user` prop reference 在整個 lifetime 內穩定。`useMemo` 在這裡的唯一作用是讓 `headerUser` 的 reference 穩定 — 但 `ProfileHeader` 沒被 `React.memo` 包，這個穩定性也不會帶來任何 reconciliation 跳過。MVP 思維下這就是過度設計。

**Linus 論據**: 「If you can't measure the speed up, don't do it.」

**建議**: 拿掉 useMemo，直接 inline：

```js
const headerUser = { ...user, createdAt: toCreatedAtAdapter(user.createdAt) };
```

---

#### P2-4. `firebase-profile.js` 與 `firebase-profile-server.js` 重複的 `toPublicProfile`

兩個檔案各自實作了一份 `toPublicProfile`，邏輯完全相同（uid/name/photoURL/createdAt + optional bio）。雖然 server / client SDK 對 Timestamp 處理略有不同（server 端最終會被 `serializeProfile` 轉 Date），但 normalize 函式本身可以共用。

**Linus 論據**: 「Two implementations of the same logic = double the bug surface. 一份就好。」

**建議**: 把 `toPublicProfile(uid, data)` 抽到 `firebase-profile.js` 並 export，讓 server 版本 import 後重用。型別上純粹是 `Record<string, unknown> → PublicProfile`，無 SDK 依賴。

---

#### P2-5. Bio 字數計算：JS `.length` vs Firestore `String.size()` 不一致

- BioEditor (`BioEditor.jsx:44`): `charCount = bio.length` — JS UTF-16 code units，emoji surrogate pair 算 2。
- Firestore rules: `bio.size() <= 150` — Firestore string.size() 是「characters」(Unicode code points)，emoji 算 1。

**問題**: 使用者輸入 75 個 emoji（client 顯示 `150/150`），實際 Firestore size 是 75，rules 通過、寫入成功。看起來 OK，但反過來：使用者輸入 100 個中文 + 51 個 emoji，client 顯示 `202/150` (BMP 中文 1 + emoji surrogate 2 → 100+102=202)，client 擋下；但實際 Firestore size 是 151，rules 也會擋下。表面一致。實際 corner case：純粹 emoji 75 個下 client 顯示 `150/150`，rules size 75，pass。Pure ASCII / 中文都 1:1 對齊。

**結論**: 不會誤擋使用者，但 client 字數計算對 emoji 不友善（會誤顯示 `2/150` for 1 emoji）。屬於 polish-level UX issue。

**建議**: 改用 `Array.from(bio).length` 計 code points，讓 emoji 1:1 顯示。或保持現狀並在 textarea 旁註記「emoji 占 2 字」。

---

#### P2-6. `next.config.mjs` `remotePatterns` 未涵蓋所有歷史 photoURL 來源

`next.config.mjs` 只允許 `lh3.googleusercontent.com` 與 `firebasestorage.googleapis.com`。如果歷史 user `photoURL` 來自其他 CDN（例如 Strava webhook 同步的頭像），UserLink 用 `next/image` 渲染會 throw。

**現狀**: 不是 012 引入的問題，main 既存。但 012 大量擴散 `<UserLink>` 後，曝險面變大。

**建議**: 確認所有實際 user `photoURL` 來源後，把 hostnames 補進 `remotePatterns`，或在 UserLink 內 catch image error 改用 fallback。

---

#### P2-7. `firestore.rules` `users/{userId}` 沒有限制 `bio` 必須是當下唯一允許更新的 string 欄位

目前 rules 對 `bio` 只驗 `is string && size() <= 150`。但 update 沒有限制其他欄位 — 使用者可以設定 `users/{uid}.email = "fake@example.com"`、`users/{uid}.role = "admin"` 等任意欄位。

**Linus 論據**: 「Authorization 要 explicit allow，不是 implicit deny。」

**現狀**: 目前 client code 不會這樣寫，但 rules 沒擋。屬於 defense-in-depth 缺口。

**建議**: 用 `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['bio', 'name', 'photoURL', 'nameChangedAt', 'photoUpdatedAt'])` 限制可寫欄位白名單。這超出 012 spec 範圍，但既然這次動到 users rules，順手收一下。**標 P2 不擋 merge**。

---

#### P2-8. JSDoc 小瑕疵：`Object` vs `object`

```bash
$ rg "@param \{Object\}" src/components/UserLink.jsx src/app/users/\[uid\] src/app/member/BioEditor.jsx
```

未發現違規。但 `firebase-profile-server.js:51` 使用了 `// eslint-disable-next-line import/prefer-default-export -- 此檔案是 server-only namespace...`。雖然不是 `@ts-ignore`，但 constitution 對「ESLint disable 應修結構而非 disable」有原則。**現況可接受**：理由清楚（與 client 版本維持一致的 named export 風格），且非 a11y rule。

---

### [TESTING ASSESSMENT]

#### 正面

- **84 tests 全綠**，覆蓋 service layer 4 函式 + 5 個 UI 元件 + UserLink 全 props matrix。
- 整合測試使用 `userEvent.setup()` + `screen.getByRole`，符合 Kent C. Dodds Trophy 模式。
- `BioEditor.test.jsx` 把元件設計成「受控 + 不依賴 AuthContext」，使測試只需 mock service layer，乾淨。
- `ProfileEventList.test.jsx` 自製 `IntersectionObserver` mock 並用 `fireIntersection()` 手動觸發 — 比起 mock 整個 react-intersection-observer 套件更輕量、更精準。
- 測試對「null vs 0 vs empty」邊界情境 (Strava distance) 都有 explicit case。

#### 缺口 / 改善

- **`firebase-profile.test.js` Promise.all 呼叫順序假設**: `mockResolvedValueOnce` 兩次連續 call 來服務 `fetchHostedCount` + `fetchJoinedCount`。雖實作上同步 push call 順序對齊，但是 fragile — 若未來把 `Promise.all` 改成別的 orchestration 形式，測試會無聲飄移。建議改成 `mockResolvedValue(...)` 用 implementation 區分 collection name，更穩健。
- **缺少 `firestore.rules` emulator-level test**: T000 標記 `[x]` 但 polish-report 沒看到 emulator-driven 規則測試（只能靠 deploy 後觀察）。對 P1-4 的 over-150 既存 bio 場景特別缺乏防禦。建議補一個 `@firebase/rules-unit-testing` 的 unit test 驗證 (a) 公開讀 (b) 本人寫合法 bio (c) 別人寫被擋 (d) 本人寫超長被擋 (e) 本人寫 bio=null OK。
- **`ProfileClient.test.jsx` 對 `loadMore` race condition 沒覆蓋** — P1-1 提到的 unmount 後 setState warning 沒被測到。建議補 `unmount()` 後再 resolve mock promise 的 case，並斷言 `console.error/warn` 沒被叫。
- **沒有 e2e/playwright 測試**: tasks.md plan 寫了 `e2e/public-profile.spec.js` 但 untracked dir 內沒有此檔。Polish-report 表示「視覺 QA、Cross-browser 留待 user 手動」 — 屬於可接受的時程取捨，但 spec 寫的 e2e 沒實作要在 commit message / polish-report 明確說明。

---

### [TASK COMPLETENESS]

| Task                                      | 標記       | 實作狀態                                                    | 備註                                            |
| ----------------------------------------- | ---------- | ----------------------------------------------------------- | ----------------------------------------------- |
| T000 firestore.rules                      | `[x]`      | ✅ users/{uid} read=true, bio ≤ 150                         | 缺 emulator-test 佐證（見 testing 缺口）        |
| T001 firebase-profile.js + getUserProfile | `[x]`      | ✅                                                          |                                                 |
| T001a firebase-profile-server.js          | `[x]`      | ✅                                                          | server-only namespace 隔離乾淨                  |
| T002 getProfileStats                      | `[x]`      | ✅ Promise.all + Strava short-circuit                       |                                                 |
| T003 getHostedEvents + composite index    | `[x]`      | ✅ `(hostUid asc, time desc)` 已加入 firestore.indexes.json |                                                 |
| T004 ProfileHeader                        | `[x]`      | ✅                                                          |                                                 |
| T005 ProfileStats                         | `[x]`      | ✅ null/0 邏輯正確                                          |                                                 |
| T006 ProfileEventList                     | `[x]`      | ✅                                                          | P1-1, P1-2 issues                               |
| T007 ProfileClient                        | `[x]`      | ✅                                                          | P2-1, P2-3 issues                               |
| T008 page.jsx + generateMetadata          | `[x]`      | ✅ OG/notFound 正確                                         |                                                 |
| T009 UserLink                             | `[x]`      | ✅                                                          |                                                 |
| T010 CommentCard 替換                     | `[x]`      | ✅                                                          | P1-3 issue (重複 link)                          |
| T011 eventDetailClient.jsx 替換           | `[x]`      | ✅                                                          | P1-3 issue                                      |
| T012 PostDetailClient 替換                | `[x]`      | ✅                                                          |                                                 |
| T013 events/page.jsx host 替換            | `[x]`      | ✅                                                          |                                                 |
| T014 posts/page.jsx                       | `[~]` skip | N/A                                                         | tasks.md 已附理由 (posts 列表無 author 顯示)    |
| T015 updateUserBio                        | `[x]`      | ✅                                                          | P2-5 emoji 計數                                 |
| T016 BioEditor                            | `[x]`      | ✅                                                          |                                                 |
| T017 self banner                          | `[x]`      | ✅                                                          |                                                 |
| T018 「查看我的公開檔案」連結             | `[x]`      | ✅                                                          |                                                 |
| T019 lint + type-check                    | `[x]`      | ✅                                                          |                                                 |
| T020 quickstart 驗證                      | `[x]`      | ⚠️                                                          | 自動部分 ✓，LCP/視覺/cross-browser 留 user 手動 |

**Scope creep 檢查**: 沒有任何不在 tasks.md 內的 src 變更。

---

## KEY INSIGHT

> 這份 PR 在「資料結構」與「服務層紀律」上做得很好——`PublicProfile` / `ProfileStats` / `HostedEventsPage` 三個 typedef 清楚，service 與 server-only namespace 嚴格隔離，UI 完全沒漏出 firebase SDK；但在「UI 細節」與「lifecycle correctness」上累積了一堆小髒污：雙 UserLink 的 redundant anchor、loadMore 缺乏 unmount 防護、Fragment 包單一 child、`?? '' / ?? 0` 防禦性 noise、useMemo 對 root component 的 micro-opt、firestore rules 對既有 over-length bio 的 lock-out 風險。每一個都不致命，但加起來代表這份 code 還沒到「我會放心讓別人 maintain」的水位。

---

## VERDICT: BAD TASTE — NOT WORTH MERGE

> **要修的優先序**:
>
> 1. **必修 (P1)**: P1-1 (loadMore 沒 cleanup) → P1-3 (重複 anchor a11y) → P1-2 (Fragment) → P1-4 (rules lock-out)。
> 2. **建議修 (P2)**: P2-1 (dead fallback)、P2-2 (defensive `??`)、P2-3 (no-op useMemo)、P2-4 (重複 toPublicProfile)、P2-5 (emoji count)、P2-7 (rules 寫欄位白名單)。
> 3. P2-6 (remotePatterns) 與 P2-8 (eslint-disable comment) 屬於環境/慣例層級，可分開 issue 追蹤。
>
> P1 修完後，我會給綠燈。整體架構 sound，問題都是 surface-level cleanup，半天內可以收掉。
