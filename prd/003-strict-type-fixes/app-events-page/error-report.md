# Error Report for `src/app/events/page.js`

Generated on: 2026-02-10
Target File: `src/app/events/page.js`

## 1. Type Check Errors (`npm run type-check`)

Command: `tsc -p tsconfig.check.json`

```
src/app/events/[id]/eventDetailClient.jsx(10,20): error TS2307: Cannot find module '../events.module.css' or its corresponding type declarations.
src/app/events/[id]/eventDetailClient.jsx(52,11): error TS8032: Qualified name 'root0.time' is not allowed without a leading '@param {object} root0'.
src/app/events/[id]/eventDetailClient.jsx(53,11): error TS8032: Qualified name 'root0.registrationDeadline' is not allowed without a leading '@param {object} root0'.
src/app/events/[id]/eventDetailClient.jsx(118,11): error TS8032: Qualified name 'root0.id' is not allowed without a leading '@param {object} root0'.
src/app/events/[id]/eventDetailClient.jsx(359,45): error TS2304: Cannot find name 'buildUserPayload'.
src/app/events/[id]/eventDetailClient.jsx(457,43): error TS2304: Cannot find name 'buildUserPayload'.
src/app/events/[id]/page.js(7,11): error TS8032: Qualified name 'root0.params' is not allowed without a leading '@param {object} root0'.
src/app/events/page.js(10,20): error TS2307: Cannot find module './events.module.css' or its corresponding type declarations.
src/app/events/page.js(887,46): error TS2559: Type '{ hostUid: any; hostName: any; hostPhotoURL: any; route: { polyline: any; pointsCount: number; bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number; }; }; }' has no properties in common with type '{ pace?: unknown; paceText?: unknown; paceMinutes?: unknown; paceSeconds?: unknown; paceSec?: unknown; }'.
src/app/layout.js(28,11): error TS8032: Qualified name 'root0.children' is not allowed without a leading '@param {object} root0'.
src/app/posts/[id]/page.js(6,11): error TS8032: Qualified name 'root0.params' is not allowed without a leading '@param {object} root0'.
src/app/posts/[id]/PostDetailClient.jsx(21,20): error TS2307: Cannot find module '../postDetail.module.css' or its corresponding type declarations.
src/app/posts/[id]/PostDetailClient.jsx(27,11): error TS8032: Qualified name 'root0.postId' is not allowed without a leading '@param {object} root0'.
src/app/posts/[id]/PostDetailClient.jsx(62,26): error TS2339: Property 'authorUid' does not exist on type '{ id: string; }'.
src/app/posts/[id]/PostDetailClient.jsx(103,28): error TS2339: Property 'authorUid' does not exist on type '{ id: string; }'.
src/app/posts/page.js(7,20): error TS2307: Cannot find module './posts.module.css' or its corresponding type declarations.
src/app/posts/page.js(62,25): error TS2339: Property 'authorUid' does not exist on type '{ id: string; }'.
src/app/posts/page.js(115,25): error TS2339: Property 'authorUid' does not exist on type '{ id: string; }'.
src/app/posts/page.js(193,40): error TS2339: Property 'authorUid' does not exist on type '{ id: string; }'.
src/components/EventMap.jsx(13,33): error TS2339: Property '_getIconUrl' does not exist on type 'Default'.
src/components/EventMap.jsx(24,11): error TS8032: Qualified name 'root0.onRouteDrawn' is not allowed without a leading '@param {object} root0'.
src/components/EventMap.jsx(104,27): error TS2350: Only a void function can be called with the 'new' keyword.
src/components/EventMap.jsx(130,11): error TS8032: Qualified name 'root0.encodedPolyline' is not allowed without a leading '@param {object} root0'.
src/components/EventMap.jsx(131,11): error TS8032: Qualified name 'root0.bbox' is not allowed without a leading '@param {object} root0'.
src/components/EventMap.jsx(183,11): error TS8032: Qualified name 'root0.mode' is not allowed without a leading '@param {object} root0'.
src/components/EventMap.jsx(184,11): error TS8032: Qualified name 'root0.onRouteDrawn' is not allowed without a leading '@param {object} root0'.
src/components/EventMap.jsx(185,11): error TS8032: Qualified name 'root0.encodedPolyline' is not allowed without a leading '@param {object} root0'.
src/components/EventMap.jsx(186,11): error TS8032: Qualified name 'root0.bbox' is not allowed without a leading '@param {object} root0'.
src/components/EventMap.jsx(187,11): error TS8032: Qualified name 'root0.height' is not allowed without a leading '@param {object} root0'.
src/contexts/AuthContext.jsx(19,11): error TS8032: Qualified name 'root0.children' is not allowed without a leading '@param {object} root0'.
src/lib/firebase-posts.js(25,11): error TS8032: Qualified name 'root0.title' is not allowed without a leading '@param {object} root0'.
src/lib/firebase-posts.js(26,11): error TS8032: Qualified name 'root0.content' is not allowed without a leading '@param {object} root0'.
src/lib/firebase-posts.js(27,11): error TS8032: Qualified name 'root0.user' is not allowed without a leading '@param {object} root0'.
src/lib/firebase-posts.js(46,11): error TS8032: Qualified name 'root0.title' is not allowed without a leading '@param {object} root0'.
src/lib/firebase-posts.js(47,11): error TS8032: Qualified name 'root0.content' is not allowed without a leading '@param {object} root0'.
src/lib/firebase-posts.js(256,11): error TS8032: Qualified name 'root0.user' is not allowed without a leading '@param {object} root0'.
src/lib/firebase-posts.js(257,11): error TS8032: Qualified name 'root0.comment' is not allowed without a leading '@param {object} root0'.
src/lib/firebase-posts.js(299,11): error TS8032: Qualified name 'root0.comment' is not allowed without a leading '@param {object} root0'.
```

## 2. ESLint Errors (`npm run lint`)

Command: `npx next lint --file src/app/events/page.js`

```
./src/app/events/page.js
415:1  Warning: Missing JSDoc @returns declaration.  jsdoc/require-returns
417:1  Warning: Missing JSDoc @param "routeCoordinates" description.  jsdoc/require-param-description
417:1  Warning: Missing JSDoc @param "routeCoordinates" type.  jsdoc/require-param-type
432:3  Error: iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. Separately, loops should be avoided in favor of array iterations.  no-restricted-syntax
448:1  Warning: Missing JSDoc @returns declaration.  jsdoc/require-returns
450:1  Warning: Missing JSDoc @param "value" description.  jsdoc/require-param-description
450:1  Warning: Missing JSDoc @param "value" type.  jsdoc/require-param-type
470:1  Warning: Missing JSDoc @returns declaration.  jsdoc/require-returns
472:1  Warning: Missing JSDoc @param "paceSec" description.  jsdoc/require-param-description
472:1  Warning: Missing JSDoc @param "paceSec" type.  jsdoc/require-param-type
473:1  Warning: Missing JSDoc @param "fallbackText" description.  jsdoc/require-param-description
473:1  Warning: Missing JSDoc @param "fallbackText" type.  jsdoc/require-param-type
486:1  Warning: Missing JSDoc @returns declaration.  jsdoc/require-returns
488:1  Warning: Missing JSDoc @param "arr" description.  jsdoc/require-param-description
488:1  Warning: Missing JSDoc @param "arr" type.  jsdoc/require-param-type
489:1  Warning: Missing JSDoc @param "size" description.  jsdoc/require-param-description
489:1  Warning: Missing JSDoc @param "size" type.  jsdoc/require-param-type
497:1  Warning: Missing JSDoc @returns declaration.  jsdoc/require-returns
499:1  Warning: Missing JSDoc @param "v" description.  jsdoc/require-param-description
499:1  Warning: Missing JSDoc @param "v" type.  jsdoc/require-param-type
506:1  Warning: Missing JSDoc @returns declaration.  jsdoc/require-returns
508:1  Warning: Missing JSDoc @param "ev" description.  jsdoc/require-param-description
508:1  Warning: Missing JSDoc @param "ev" type.  jsdoc/require-param-type
517:1  Warning: Missing JSDoc @returns declaration.  jsdoc/require-returns
519:1  Warning: Missing JSDoc @param "user" description.  jsdoc/require-param-description
519:1  Warning: Missing JSDoc @param "user" type.  jsdoc/require-param-type
530:1  Warning: Missing JSDoc @returns declaration.  jsdoc/require-returns
538:10  Warning: 'filterHostText' is assigned a value but never used.  no-unused-vars
543:10  Warning: 'filterRegStart' is assigned a value but never used.  no-unused-vars
544:10  Warning: 'filterRegEnd' is assigned a value but never used.  no-unused-vars
549:10  Warning: 'filterPaceMinMin' is assigned a value but never used.  no-unused-vars
550:10  Warning: 'filterPaceMinSec' is assigned a value but never used.  no-unused-vars
551:10  Warning: 'filterPaceMaxMin' is assigned a value but never used.  no-unused-vars
552:10  Warning: 'filterPaceMaxSec' is assigned a value but never used.  no-unused-vars
559:10  Warning: 'filterMaxParticipantsMin' is assigned a value but never used.  no-unused-vars
560:10  Warning: 'filterMaxParticipantsMax' is assigned a value but never used.  no-unused-vars
562:10  Warning: 'filterRunType' is assigned a value but never used.  no-unused-vars
612:5  Error: Arrow function expected no return value.  consistent-return
622:5  Error: Arrow function expected no return value.  consistent-return
654:9  Warning: Unexpected console statement.  no-console
686:9  Error: iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. Separately, loops should be avoided in favor of array iterations.  no-restricted-syntax
687:23  Error: Unexpected `await` inside a loop.  no-await-in-loop
701:9  Warning: Unexpected console statement.  no-console
705:5  Error: Arrow function expected no return value.  consistent-return
731:7  Warning: Unexpected console statement.  no-console
752:5  Error: Arrow function expected no return value.  consistent-return
846:7  Warning: Unexpected console statement.  no-console
855:1  Warning: Missing JSDoc @param "e" description.  jsdoc/require-param-description
855:1  Warning: Missing JSDoc @param "e" type.  jsdoc/require-param-type
903:25  Error: 'e' is already declared in the upper scope on line 857 column 31.  no-shadow
915:7  Warning: Unexpected console statement.  no-console
929:1  Warning: Missing JSDoc @param "ev" description.  jsdoc/require-param-description
929:1  Warning: Missing JSDoc @param "ev" type.  jsdoc/require-param-type
930:1  Warning: Missing JSDoc @param "clickEvent" description.  jsdoc/require-param-description
930:1  Warning: Missing JSDoc @param "clickEvent" type.  jsdoc/require-param-type
981:1  Error: This line has a length of 119. Maximum allowed is 100.  max-len
987:7  Warning: Unexpected console statement.  no-console
1000:1  Warning: Missing JSDoc @param "ev" description.  jsdoc/require-param-description
1000:1  Warning: Missing JSDoc @param "ev" type.  jsdoc/require-param-type
1001:1  Warning: Missing JSDoc @param "clickEvent" description.  jsdoc/require-param-description
1001:1  Warning: Missing JSDoc @param "clickEvent" type.  jsdoc/require-param-type
1053:7  Warning: Unexpected console statement.  no-console
1213:24  Error: Do not nest ternary expressions.  no-nested-ternary
1224:22  Error: Do not nest ternary expressions.  no-nested-ternary
1350:9  Error: Non-interactive elements should not be assigned mouse or keyboard event listeners.  jsx-a11y/no-noninteractive-element-interactions
1360:11  Error: Avoid non-native interactive elements. If using native HTML is not possible, add an appropriate role and support for tabbing, mouse, keyboard, and touch inputs to an interactive content element.  jsx-a11y/no-static-element-interactions
1396:17  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1401:19  Error: A form label must have accessible text.  jsx-a11y/label-has-associated-control
1424:17  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1457:17  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1494:17  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1587:15  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1604:15  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1617:15  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1630:15  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1643:15  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1686:15  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1699:15  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1725:15  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1740:15  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1751:19  Error: A control must be associated with a text label.  jsx-a11y/control-has-associated-label
1753:34  Error: Do not use Array index in keys  react/no-array-index-key
1766:19  Error: A control must be associated with a text label.  jsx-a11y/control-has-associated-label
1785:15  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1787:17  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1799:17  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1820:17  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1835:15  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
1847:15  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
```

## 3. Grep @ts-ignore Check (`grep -r "@ts-ignore" src`)

Command: `grep -r "@ts-ignore" src`

```
(No results found)
```
