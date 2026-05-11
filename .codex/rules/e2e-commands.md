---
paths:
  - 'tests/e2e/**'
  - '**/*.spec.js'
  - 'scripts/run-all-e2e.sh'
---

# E2E Commands

```bash
npx playwright test                              # 所有 E2E（Chromium only, needs dev server）
npx playwright test tests/e2e/<file>.spec.js     # 單一 E2E 檔
bash scripts/run-all-e2e.sh                      # CI-like 全流程復現；debug flaky 時先跑
npm run test:e2e:branch                          # 只路由目前 diff/staged/unstaged changed E2E specs；沒有 changed spec 會 skip
E2E_FEATURE=004-event-edit-delete npm run test:e2e:emulator   # 已有 emulator/dev env 時，指定 seeded setup 跑 E2E
firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=004-event-edit-delete npm run test:e2e:emulator"
```

手動包 `firebase emulators:exec` 時必須對齊 `demo-test` project/env。一般 debug flaky 先跑 `bash scripts/run-all-e2e.sh`；只想跑目前 changed E2E specs 時用 `npm run test:e2e:branch`，但沒有 changed E2E spec 會直接 skip，unknown spec 則改跑 `bash scripts/run-all-e2e.sh`。

E2E specs live under `tests/e2e/`; shared helpers live under `tests/_helpers/`; Playwright results should be written under `tests/test-results/e2e/`.
