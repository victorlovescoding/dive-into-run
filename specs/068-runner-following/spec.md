# Runner Following Spec

## Summary

Add Instagram-like one-way runner following. In v1 all accounts are public:
people can inspect follower/following counts and lists, while authenticated
users can follow or unfollow runners from supported profile and organizer
surfaces. Signed-in users also get a member-area management surface for their
own following list.

The feature must preserve naming and data shape that can later support private
accounts and follow requests without repainting the public-follow foundation.

## User Scenarios

- As a signed-out visitor, I can open a runner profile and view public follower
  and following counts and lists, but I do not see follow controls and cannot
  mutate follow state.
- As a signed-in runner, I can follow another runner from that runner's profile
  page and see the UI update optimistically while the request is pending.
- As a signed-in runner, I can unfollow a runner from that runner's profile page
  and see the UI update optimistically while the request is pending.
- As a signed-in runner browsing events, I can follow or unfollow the organizer
  or host from the event list organizer/host surface when that host is not me.
- As a signed-in runner viewing event details, I can follow or unfollow the
  organizer or host from the event detail organizer/host surface when that host
  is not me.
- As a signed-in runner, I can open a member/dashboard surface labeled
  `我的追蹤跑友` to inspect runners I follow.
- As any visitor, I can click profile follower and following counts to open
  modal lists. Rows in those lists link to runner profiles; they do not contain
  inline follow buttons.
- As a followed runner, I receive a notification when someone newly follows me.
  The notification opens the follower's profile.

## Requirements

- Accounts are public in v1.
- Public accounts expose follower and following counts and lists. In v1,
  `users/{uid}.followersCount` may remain a denormalized public user field, but
  following count is derived from `users/{uid}/following` and must not be stored
  as a client-writable `users/{uid}.followingCount` field.
- Public accounts expose follower and following lists to anyone, including
  unauthenticated visitors.
- Unauthenticated visitors must not see follow buttons.
- Unauthenticated visitors must not be able to create or delete follow
  relationships.
- Logged-in users can follow and unfollow from user profile pages.
- Event list organizer/host surfaces can show follow and unfollow controls for
  the host.
- Event detail organizer/host surfaces can show follow and unfollow controls
  for the host.
- Signed-in users can access a member/dashboard following management surface
  labeled `我的追蹤跑友`.
- The member/dashboard following list shows followed runner rows with avatar
  and name linking to each runner profile.
- The member/dashboard following list may provide an unfollow action per row
  when implemented consistently with existing member list management patterns.
- Signed-out users must not access the member/dashboard following management
  surface.
- Event comments must not show follow buttons.
- Event participants lists must not show follow buttons. Participant avatar and
  name links go to the participant profile, where follow controls exist.
- Followers and following modal rows must not show follow buttons. Avatar and
  name links go to the runner profile, where follow controls exist.
- Posts list poster and post detail poster surfaces must not show follow
  buttons in v1.
- Self follow is forbidden.
- Self-hosted event organizer/host surfaces must not show a follow button for
  the signed-in host.
- Follow data is stored in both directions:
  `users/{viewerUid}/following/{targetUid}` and
  `users/{targetUid}/followers/{viewerUid}`.
- Document, collection, and rule naming should avoid blocking a future private
  account or follow-request model.
- Follow and unfollow update the mirrored follow documents and only the target
  user's public `users/{targetUid}.followersCount` denormalized count. The
  viewer's following count is derived from `users/{viewerUid}/following` and is
  not client-written on `users/{viewerUid}` in v1.
- Profile counts are clickable and open followers or following modal lists.
- Follow and unfollow use optimistic UI with an explicit pending state.
- Follow and unfollow failures roll back the optimistic UI state and show a
  toast.
- A successful follow creates a notification for the target user with this exact
  message pattern: `X 已開始追蹤你。`
- A follow notification is created only when state changes from not-following
  to following.
- Repeating follow while already following is idempotent and must not create a
  duplicate notification.
- Unfollow then refollow creates a new notification.
- Notification v1 opens the follower profile.
- Notification inline follow-back buttons are deferred.

## Success Criteria

- Signed-out visitors can view profile follow counts and modal lists without
  seeing follow buttons.
- Signed-in users can follow and unfollow non-self runners from the supported
  profile and event organizer/host surfaces.
- Signed-in users can open `我的追蹤跑友` from the member area and see their own
  following list with profile links, while signed-out users cannot access it.
- Self follow is blocked at the data boundary and absent from self-facing UI
  surfaces.
- Follow/unfollow optimistic updates settle to the server result; failures roll
  back and produce a toast.
- Public follower counts, derived following counts, and both directional
  subcollections stay consistent after follow and unfollow operations.
- Public list reads work for unauthenticated visitors while write operations
  require authentication.
- Follow notification behavior matches the duplicate rule and exact message
  pattern.
- Event comments, event participant lists, follower/following modal rows, posts
  list posters, and post detail posters remain free of v1 follow controls.
- Future private accounts and follow requests remain viable because the data
  and rules naming do not encode a public-only dead end.

## Out Of Scope

- Private accounts.
- Follow requests.
- Approve or reject request flows.
- Blocking users.
- Following feed.
- Recommendation or discovery page.
- Notification inline follow-back controls.
- Follow buttons on event comments.
- Follow buttons on event participants lists.
- Follow buttons on followers or following modal rows.
- Follow buttons on posts list poster or post detail poster surfaces.
- Data migrations, package changes, dependency additions, deployment, commits,
  pushes, pull requests, CI watching, merges, local `main` sync, or
  Firestore/storage rules deployment under the current authorization boundary.

## User Authorization

- Long-term repo workflow docs requested by user on: 2026-05-21.
- Spec approved by: user on 2026-05-21 with message `spec approved，開始實作`.
- One-time automated execution authorization: yes, edit=true only for
  implementation work inside task-owned files dispatched from
  `specs/068-runner-following/tasks.md`.
- Authorization boundary:
  - edit: true.
  - commit: false.
  - push: false.
  - pullRequest: false.
  - ciWatch: false.
  - merge: false.
  - localMainSync: false.
  - deployFirestoreRules: false.

## Release Notes

- Firestore/storage rules deploy required: yes, later. Implementation is
  expected to touch Firestore rules, but this spec-stage artifact seed does not
  change rules.
- Current rules deploy state: required, changed, no deploy evidence, no
  deployed commit.
- Final summaries must not imply deployed rules or deployed product behavior
  unless `rulesDeployStatus.state` is `deployed` with deploy evidence.
