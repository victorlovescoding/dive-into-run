# Homepage Landing Spec

## Summary

Build the `/` homepage as a production landing page that follows the Open
Design artifact `Dive Into Run Website UI / index.html`. The page should make
the running community value clear immediately, route users to event discovery
and event creation, and avoid changing existing app behavior outside the
homepage.

## User Scenarios

- A visitor lands on `/` and immediately understands that Dive Into Run helps
  runners find suitable running groups by time, location, route, pace, capacity,
  organizer context, and participant signals.
- A runner looking for a group can use the primary CTA or the activity cards to
  reach `/events`.
- A runner who wants to organize a run can use the creation CTA to reach the
  existing events entry point without introducing a new creation workflow.
- A returning user can still use the global Navbar normally; the homepage must
  not duplicate or replace global navigation.

## Requirements

- Implement a render-only homepage based on the Open Design visual structure,
  excluding only the Open Design `topnav`.
- Required visible sections: hero, available run groups strip, trust/system
  section, runner profile context section, CTA panel, and page-specific footer
  content.
- Required visual fidelity signals: warm morning-run tone, OKLCH-compatible
  color tokens, hero left-side copy with right-side running scene, floating
  weather/event/map cards on larger viewports, three join cards, trust items,
  runner profile panel, and CTA strip.
- Keep `src/app/page.jsx` thin and move the render-only screen into `src/ui/`.
- Preserve the global `Navbar` mounted by `src/app/layout.jsx`; do not port the
  Open Design `topnav` as a second navigation bar.
- The homepage UI must not render a `nav` element, navigation header, fixed
  hero chrome, or sticky page chrome that competes with the global Navbar. It
  must not modify the Navbar link set or `src/app/layout.jsx`.
- Use existing Next.js, React, Tailwind/CSS capabilities; do not add new
  dependencies for icons, fonts, animations, or styling.
- Do not import Open Design fonts. Use the existing project font setup through
  Tailwind/Geist tokens or the current global fallback.
- Keep the homepage static for this slice. Activity cards, profile values,
  weather chips, and route map values are presentation content, not live
  Firestore, Strava, or weather API data.
- Use semantic landmarks, accessible headings, meaningful link text, and stable
  responsive layout for desktop, tablet, and phone viewports.
- Responsive acceptance viewports are 375px, 768px, and 1280px wide. The page
  must avoid horizontal scrolling; desktop hero is two-column; mobile hero is
  single-column; floating cards must become non-overlapping stacked or inline
  content on phone viewports.
- Accessibility requirements: WCAG AA color contrast for text, visible focus
  states for CTA links, distinguishable link text, decorative scene graphics
  marked `aria-hidden`, meaningful weather/event/map/profile information
  present as text, and reduced or disabled motion under
  `prefers-reduced-motion`.
- CTA destinations must stay inside existing routes. Until Planner verifies and
  records a more specific existing route, both view and create CTAs use
  `/events`; implementation tests must assert the Planner-recorded exact href.
- Maintain existing hydration and accessibility smoke coverage for `/`.

## Success Criteria

- `/` renders the required Open Design sections without a duplicate navigation
  bar.
- The main heading includes `Dive Into Run` and the hero copy communicates
  finding suitable running groups.
- Primary CTAs and activity section links route to existing application paths.
- Integration tests cover the homepage entry, main heading, CTA links, hero,
  available run groups, trust/system, runner profile context, CTA panel, and
  footer content.
- Visual QA confirms 375px, 768px, and 1280px layouts have no horizontal
  scrolling, no content overlap, a single global Navbar, and homepage content
  that starts below the Navbar.
- Focus order starts with the global Navbar and then proceeds into homepage
  content in document order.
- Existing Navbar, root layout, hydration smoke, and axe smoke checks remain
  green.

## Out Of Scope

- Reworking global Navbar behavior or its link set.
- Adding live event, Strava, weather, map, or Firebase data to the homepage.
- Adding new npm dependencies.
- Changing authentication, notification, toast, event creation, posts, runs, or
  weather product behavior.
- Deploying Firestore or Storage rules.
- Commit, push, PR creation, CI watch, merge, or local `main` sync until each
  boundary is explicitly authorized later.

## User Authorization

- Spec approved by: user, 2026-05-21.
- One-time automated execution authorization: yes, 2026-05-21, for creating the
  isolated worktree and draft P4 workflow artifacts only.
- Authorization boundary:
  - edit: authorized for Planner and Engineer production-code work,
    2026-05-21.
  - commit: not authorized.
  - push: not authorized.
  - pullRequest: not authorized.
  - ciWatch: not authorized.
  - merge: not authorized.
  - localMainSync: not authorized.
  - deployFirestoreRules: not authorized.

## Release Notes

- Firestore/storage rules deploy required: not applicable.
- Final summaries must not imply deployed rules or deployed product behavior
  unless `rulesDeployStatus.state` is `deployed` with deploy evidence.
