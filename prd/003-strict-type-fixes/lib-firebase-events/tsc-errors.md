# TSC Errors for src/lib/firebase-events.js

Found 16 errors in src/lib/firebase-events.js using `npx tsc src/lib/firebase-events.js --allowJs --checkJs --noEmit --target esnext --moduleResolution node --esModuleInterop`.

```text
src/lib/firebase-events.js:16:20 - error TS2307: Cannot find module '@/lib/firebase-client' or its corresponding type declarations.

16 import { db } from '@/lib/firebase-client';
                      ~~~~~~~~~~~~~~~~~~~~~~~

src/lib/firebase-events.js:187:22 - error TS2345: Argument of type 'QueryFieldFilterConstraint' is not assignable to parameter of type 'CollectionReference<DocumentData, DocumentData>'.
  Type 'QueryFieldFilterConstraint' is missing the following properties from type 'CollectionReference<DocumentData, DocumentData>': id, path, parent, withConverter, and 2 more.

187     constraints.push(where('time', '>=', Timestamp.fromDate(new Date(startTime))));
                         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/lib/firebase-events.js:190:22 - error TS2345: Argument of type 'QueryFieldFilterConstraint' is not assignable to parameter of type 'CollectionReference<DocumentData, DocumentData>'.
  Type 'QueryFieldFilterConstraint' is missing the following properties from type 'CollectionReference<DocumentData, DocumentData>': id, path, parent, withConverter, and 2 more.

190     constraints.push(where('time', '<=', Timestamp.fromDate(new Date(endTime))));
                         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/lib/firebase-events.js:194:20 - error TS2345: Argument of type 'QueryOrderByConstraint' is not assignable to parameter of type 'CollectionReference<DocumentData, DocumentData>'.
  Type 'QueryOrderByConstraint' is missing the following properties from type 'CollectionReference<DocumentData, DocumentData>': id, path, parent, withConverter, and 2 more.

194   constraints.push(orderBy('time', 'desc'));
                       ~~~~~~~~~~~~~~~~~~~~~~~

src/lib/firebase-events.js:195:20 - error TS2345: Argument of type 'QueryLimitConstraint' is not assignable to parameter of type 'CollectionReference<DocumentData, DocumentData>'.
  Type 'QueryLimitConstraint' is missing the following properties from type 'CollectionReference<DocumentData, DocumentData>': id, path, parent, withConverter, and 2 more.

195   constraints.push(limit(50));
                       ~~~~~~~~~

src/lib/firebase-events.js:197:19 - error TS2556: A spread argument must either have a tuple type or be passed to a rest parameter.

197   const q = query(...constraints);
                      ~~~~~~~~~~~~~~

src/lib/firebase-events.js:205:41 - error TS2339: Property 'city' does not exist on type '{ id: string; }'.

205     results = results.filter((ev) => ev.city === city);
                                            ~~~~

src/lib/firebase-events.js:208:41 - error TS2339: Property 'district' does not exist on type '{ id: string; }'.

208     results = results.filter((ev) => ev.district === district);
                                            ~~~~~~~~

src/lib/firebase-events.js:214:48 - error TS2339: Property 'distanceKm' does not exist on type '{ id: string; }'.

214     results = results.filter((ev) => Number(ev.distanceKm || 0) >= min);
                                                   ~~~~~~~~~~

src/lib/firebase-events.js:218:48 - error TS2339: Property 'distanceKm' does not exist on type '{ id: string; }'.

218     results = results.filter((ev) => Number(ev.distanceKm || 0) <= max);
                                                   ~~~~~~~~~~

src/lib/firebase-events.js:225:31 - error TS2339: Property 'remainingSeats' does not exist on type '{ id: string; }'.

225       const seats = typeof ev.remainingSeats === 'number'
                                  ~~~~~~~~~~~~~~

src/lib/firebase-events.js:226:14 - error TS2339: Property 'remainingSeats' does not exist on type '{ id: string; }'.

226         ? ev.remainingSeats
                 ~~~~~~~~~~~~~~

src/lib/firebase-events.js:227:21 - error TS2339: Property 'maxParticipants' does not exist on type '{ id: string; }'.

227         : Number(ev.maxParticipants || 0) - Number(ev.participantsCount || 0);
                        ~~~~~~~~~~~~~~~

src/lib/firebase-events.js:227:55 - error TS2339: Property 'participantsCount' does not exist on type '{ id: string; }'.

227         : Number(ev.maxParticipants || 0) - Number(ev.participantsCount || 0);
                                                          ~~~~~~~~~~~~~~~~~

src/lib/firebase-events.js:344:3 - error TS2322: Type '{ ok: boolean; status: string; }' is not assignable to type '{ ok: boolean; status: "full" | "already_joined" | "joined"; }'.
  Types of property 'status' are incompatible.
    Type 'string' is not assignable to type '"full" | "already_joined" | "joined"'.

344   return result;
      ~~~~~~

src/lib/firebase-events.js:399:3 - error TS2322: Type '{ ok: boolean; status: string; }' is not assignable to type '{ ok: boolean; status: "left" | "not_joined"; }'.
  Types of property 'status' are incompatible.
    Type 'string' is not assignable to type '"left" | "not_joined"'.

399   return result;
      ~~~~~~
```
