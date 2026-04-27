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
npm run test:e2e:branch                          # 自動偵測 branch → feature，選擇正確 config（emulator 或一般）
E2E_FEATURE=004-event-edit-delete npm run test:e2e:emulator   # 指定 feature 跑 E2E + emulator
firebase emulators:exec --only auth,firestore,storage "E2E_FEATURE=004-event-edit-delete npm run test:e2e:emulator"
```

E2E specs live under `tests/e2e/`; shared helpers live under `tests/_helpers/`; Playwright results should be written under `tests/test-results/e2e/`.
