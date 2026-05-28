# Post Composer Draft Confirm Spec

## Summary

Add local draft protection to the article composer. When a user closes the
composer while writing a new article or editing an existing article, the app
must ask whether to save the unfinished content as a browser-local draft before
closing.

The feature prevents accidental content loss without changing Firestore schema,
storage rules, or server behavior.

## User Scenarios

- A signed-in user starts a new article, types a title or body, then presses X,
  Escape, or the backdrop. The app asks whether to save the draft before
  closing.
- A signed-in user edits article A and article B in separate sessions. Each
  article's unfinished edit restores only its own saved draft when reopened.
- A signed-in user saves a draft, closes the composer, and later opens the same
  composer target. The saved draft restores automatically.
- A signed-in user submits a post successfully. The draft for that composer
  target is removed so stale content does not restore later.

## Requirements

- The article composer close request from X, Escape, and backdrop click MUST use
  one shared close guard.
- The close guard MUST open a custom centered confirmation dialog when the
  composer has unsaved content.
- The confirmation dialog MUST provide these actions in this order:
  `存草稿`, `繼續編輯`, `不儲存並關閉`.
- `存草稿` MUST save the current title, content, and update timestamp to
  localStorage, then close the composer.
- `繼續編輯` MUST close only the confirmation dialog and keep the composer open.
- `不儲存並關閉` MUST remove only the current composer target's draft, then close
  the composer.
- New-article drafts MUST use a key scoped by user id:
  `post-composer:draft:create:<uid>`.
- Existing-article edit drafts MUST use a key scoped by user id and post id:
  `post-composer:draft:edit:<uid>:<postId>`.
- Draft reads and writes MUST only touch the current composer target's key.
  Editing article A must not read, overwrite, or remove article B's draft.
- Draft payloads MUST include `title`, `content`, and `updatedAt`.
- Opening a composer target MUST automatically restore an unexpired matching
  draft from localStorage and show a toast: `已恢復草稿`.
- Drafts older than 30 days MUST be removed and not restored.
- Successful publish or update MUST remove only the current composer target's
  draft.
- Failed publish or update MUST keep the composer open and MUST NOT remove the
  draft.
- Invalid or unparsable draft payloads MUST be ignored and removed.

## Visual Design

- Use the selected centered confirmation dialog style.
- The dialog title is `要儲存這篇草稿嗎？`.
- The body copy is `下次開啟文章編輯器時，可以繼續編輯目前內容。`.
- The primary action is `存草稿` and uses the existing article composer purple
  button treatment.
- `繼續編輯` uses a neutral secondary button treatment.
- `不儲存並關閉` uses a danger treatment.
- The dialog should feel like part of the existing composer modal: white
  surface, compact spacing, 8-12px radius, and a restrained shadow.

## Success Criteria

- Pressing X, Escape, or backdrop while a new article has unsaved content opens
  the confirmation dialog instead of closing immediately.
- Pressing X, Escape, or backdrop while an existing article edit has unsaved
  changes opens the confirmation dialog instead of closing immediately.
- Saving a new-article draft and reopening the new article composer restores
  that draft automatically.
- Saving article A and article B edit drafts restores A's draft only when
  editing A and B's draft only when editing B.
- Choosing `不儲存並關閉` removes only the active composer target draft.
- A draft older than 30 days is removed and is not restored.
- A successful publish or update removes only the active composer target draft.
- A failed publish or update leaves the composer open and preserves the draft.

## Out Of Scope

- Firestore-backed drafts.
- Cross-device draft sync.
- Multi-draft management UI.
- Draft indicators in article cards, detail pages, or navigation.
- Changing post schema, Firestore rules, or storage rules.
- Autosave while typing.

## User Authorization

- Spec approved by: user / 2026-05-28
- One-time automated execution authorization: spec doc edit and commit / 2026-05-28
- Authorization boundary:
  - edit: spec doc only
  - commit: yes
  - push: no
  - pullRequest: no
  - ciWatch: no
  - merge: no
  - localMainSync: no
  - deployFirestoreRules: no

## Release Notes

- Firestore/storage rules deploy required: not applicable
- Final summaries must not imply deployed product behavior until the
  implementation is completed, reviewed, verified, and released through the
  normal branch and PR flow.
