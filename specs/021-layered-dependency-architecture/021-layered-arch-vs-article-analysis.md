# 021 分層架構 vs OpenAI 文章模型：完整比對分析

> 比對基準：OpenAI「Harness engineering: leveraging Codex in an agent-first world」
> 判定日期：2026-04-24
> Branch：`021-layered-dependency-architecture`（S001-S029 全數完成）

## Context

**目的**：比對這個 worktree（S001-S029 全數完成）與文章中描述的分層架構模型，判斷符合度與差異。

**文章核心主張**：每個 business domain 切分為固定層級 `Types → Config → Repo → Service → Runtime → UI`，每層只能往前依賴（forward-only），違反就被自動攔住。cross-cutting concerns（auth, connectors, telemetry, feature flags）透過 Providers 單一介面注入。

---

## 1. 六層對照表

| 文章層級    | 文章職責                         | 本 repo 對應                                   | 檔案數 | 符合度      |
| ----------- | -------------------------------- | ---------------------------------------------- | ------ | ----------- |
| **Types**   | 型別宣告、shared constants       | `src/types/`                                   | 2      | ✅ 完全符合 |
| **Config**  | 基礎設施設定、env                | `src/config/{client,server,geo}/`              | 6      | ✅ 完全符合 |
| **Repo**    | 資料存取 adapter（DB/API）       | `src/repo/{client,server}/`                    | 19     | ✅ 完全符合 |
| **Service** | 業務邏輯、驗證、轉換             | `src/service/`                                 | 14     | ✅ 完全符合 |
| **Runtime** | React 狀態管理、hooks、use-cases | `src/runtime/{hooks,client,server,providers}/` | 32     | ✅ 完全符合 |
| **UI**      | 純呈現元件（render-only）        | `src/ui/`                                      | 12     | ✅ 完全符合 |

**結論**：六層名稱、職責、依賴方向**完全一致**。

---

## 2. Forward-only 依賴方向 — 機械式強制

### 文章做法

> "strictly validated dependency directions and a limited set of permissible edges... enforced mechanically via custom linters and structural tests"

### 本 repo 做法

- **dependency-cruiser v17.3.10**（`.dependency-cruiser.mjs`，255 行）
- **5 條 layer direction rules**（`createLayerDirectionRules()`）：
  - `types-no-higher-layer-imports`
  - `config-no-higher-layer-imports`
  - `repo-no-higher-layer-imports`
  - `service-no-higher-layer-imports`
  - `runtime-no-higher-layer-imports`
- 每條 rule 禁止該層 import 比自己更高的層
- JSDoc `@typedef` type-only import 豁免（`dependencyTypesNot` filter）
- **0 violations across 1361 modules**

### 對比判定

| 面向                  | 文章                                     | 本 repo                              | 符合？      |
| --------------------- | ---------------------------------------- | ------------------------------------ | ----------- |
| 依賴方向強制          | custom linters                           | dependency-cruiser forbidden rules   | ✅ 等效     |
| CI 整合               | CI jobs                                  | `npm run depcruise` + pre-commit     | ✅          |
| Type-only 豁免        | 未明確提及                               | `dependencyTypesNot` filter          | ✅ 更細緻   |
| 0 violations baseline | 「zero violations on first enforcement」 | 0 violations, no grandfathered files | ✅ 完全一致 |

---

## 3. Providers — Cross-cutting 隔離

### 文章做法

> "Cross-cutting concerns (auth, connectors, telemetry, feature flags) enter through a single explicit interface: Providers."

文章 Image #5 顯示 Providers 是**獨立於 Service→Runtime→UI 業務鏈之外的平行注入通道**。

### 本 repo 做法

- Providers 在 `src/runtime/providers/`（Runtime 的子目錄）
- **3 個 Provider**: AuthProvider, NotificationProvider, ToastProvider
- **2 條隔離規則**：
  - `provider-no-repo`：禁止 Provider 直接 import `src/repo/`
  - `provider-no-service`：禁止 Provider 直接 import `src/service/`（S028 新增）
- Provider 只注入 cross-cutting context，不含業務邏輯

### 對比判定

- **位置差異**：文章是獨立 cross-cutting 層，本 repo 是 runtime 子層
- **效果等同**：provider-no-repo + provider-no-service 規則確保 Provider 不碰業務邏輯
- **判定**：✅ 語義一致，物理位置不同但有等效機械保護

---

## 4. Agent-actionable Remediation Messages

### 文章做法

> "we write the error messages to inject remediation instructions into agent context"

### 本 repo 做法（S026）

所有 dep-cruise forbidden rule 的 `comment` 欄位從描述性改為 remediation 指引：

```
FROM: "config may not depend on canonical layers above it..."
TO:   "config layer imports a higher layer (repo/service/runtime/ui).
       Move the needed function down to src/config/ or src/types/,
       or accept the value as a parameter from a higher-layer caller.
       If this is a type-only reference, switch to a JSDoc @typedef import."
```

### 對比判定：✅ 完全符合文章要求

---

## 5. Server-only 邊界

### 文章未明確提及，但本 repo 額外實作：

- `server-only-no-client-import`：client code 不能 import `src/**/server/**`
- `server-deps-require-server-path`：import `firebase-admin` 必須在 server 路徑（S027）

### 判定：✅ 超越文章要求（文章是 Python 後端，不需 client/server 分離）

---

## 6. S018-S025 具體工作 vs 文章原則

| Task          | 做的事                                                              | 對應文章原則                                                   |
| ------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| **S018**      | repo-tier: strava/users/weather-favorites → `src/repo/client/`      | 「each domain divided into fixed set of layers」               |
| **S019**      | service-tier: profile/weather → `src/service/` + `src/repo/client/` | 同上                                                           |
| **S020**      | split event-helpers（業務規則 → service / 格式化 → lib）            | 「enforce boundaries centrally, allow autonomy locally」       |
| **S020a**     | utility canonical-readiness: notification/strava → service          | 「we prefer shared utility packages over hand-rolled helpers」 |
| **S021-S024** | thick entry → thin entry + runtime hook + UI screen                 | 文章圖示的 UI 層只做呈現，邏輯在 Runtime                       |
| **S025**      | `canonical-no-import-lib` 封住反向依賴                              | 「constraints enforced mechanically via custom linters」       |

### S026-S029（Phase 12 Harness Hardening）

| Task     | 做的事                      | 對應文章原則                                             |
| -------- | --------------------------- | -------------------------------------------------------- |
| **S026** | remediation comments        | 「error messages inject remediation into agent context」 |
| **S027** | server-only enforcement gap | server/client 邊界強制（文章未涵蓋但是正確延伸）         |
| **S028** | provider-no-service         | 文章 Image #5 Providers 獨立於 Service 鏈                |
| **S029** | ProfileEventList thin-entry | 最後一個 thick entry 消除                                |

---

## 7. 結構選擇差異（非缺失）

| 差異點                          | 文章做法                                            | 本 repo 做法                                   | 影響                                                                |
| ------------------------------- | --------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| **Layer-first vs Domain-first** | 按 business domain 分（e.g. `app-settings/types/`） | 按 layer 分（e.g. `src/types/`）               | 現有 ~10 domains，layer-first 足夠；規模擴大後可能需要 domain-first |
| **Utils 定位**                  | 頂層共用 utilities（圖示在 domain 之上）            | `src/lib/` 作為 permanent compatibility facade | 概念不同：文章是 shared utils，本 repo 是遷移過渡層                 |
| **Providers 物理位置**          | 獨立 cross-cutting 層                               | `src/runtime/providers/` 子目錄                | 有等效規則保護，語義一致                                            |
| **enforcement 工具**            | 自建 custom linters                                 | dependency-cruiser（第三方）                   | 效果等同，dep-cruise 更成熟                                         |
| **文件規模**                    | 百萬行級                                            | ~數萬行                                        | 複雜度不同，但架構原則可移植                                        |

---

## 8. 整體評估

### 符合度：高度符合（9/10）

**完全符合的面向（7 項）：**

1. 六層名稱與職責定義
2. Forward-only 依賴方向
3. 機械式強制（0 violations, no grandfathered files）
4. Agent-actionable remediation messages
5. Provider cross-cutting 隔離
6. Thin entry pages（UI 只做呈現）
7. CI + pre-commit gate 自動化

**超越文章的面向（2 項）：**

1. Server-only 邊界強制（firebase-admin 路徑限制）
2. Test bucket 四桶政策 + dep-cruise enforcement（文章未涉及測試層級隔離）

**結構選擇差異（非缺失，1 項）：**

1. Layer-first vs domain-first — 當前規模合理，但未來規模增長可能需要重新評估

---

## 9. 三個結構差異深入分析

### 差異 A：Layer-first vs Domain-first

**文章做法**：按 business domain 切（每個 domain 內部再有 types/config/repo/service/runtime/ui）

```
src/
├── app-settings/
│   ├── types/
│   ├── config/
│   ├── repo/
│   ├── service/
│   └── runtime/
├── user-profile/
│   ├── types/
│   ├── ...
```

**本 repo 做法**：按 layer 切（每個 layer 內部再按 domain 分檔案）

```
src/
├── types/
│   ├── weather-types.js
│   └── not-found-messages.js
├── repo/
│   ├── client/
│   │   ├── firebase-events-repo.js
│   │   ├── firebase-strava-repo.js
│   │   └── ...
```

**什麼時候該轉 domain-first？**

- 文章是百萬行級 codebase、數百工程師（or agents），domain-first 讓每個 domain 自治、減少跨目錄改動
- 本 repo ~數萬行、~10 domains，layer-first 的好處是：同一層的檔案一目了然，dep-cruise 規則用 path pattern 就能寫（`^src/repo(?:/|$)`）
- **轉換時機**：當一個 domain 改動經常需要同時碰 3+ 個 layer 目錄（types + repo + service + runtime），且 domain 數量 > 15-20 時
- **轉換成本**：所有 dep-cruise patterns 要改成 `^src/domains/<domain>/repo(?:/|$)`，但規則邏輯不變
- **結論**：目前 layer-first 是正確選擇。文章自己也說「enforce boundaries centrally, allow autonomy locally」— layer-first 就是 centralized boundaries 的極致表現

### 差異 B：Providers 獨立層 vs Runtime 子層

**文章做法**：Image #5 畫了 Providers 作為獨立 cross-cutting 層，和 Service → Runtime → UI 業務鏈平行

```
        ┌─────────────┐
        │  Providers   │──→ App Wiring + UI
        └──────┬──────┘
               │
    ┌──────┐  ┌──────────┐  ┌────┐
    │Service│→│  Runtime  │→│ UI │
    └──────┘  └──────────┘  └────┘
```

**本 repo 做法**：Providers 在 `src/runtime/providers/`，是 Runtime 的子目錄

```
src/runtime/
├── providers/
│   ├── AuthProvider.jsx
│   ├── NotificationProvider.jsx
│   └── ToastProvider.jsx
├── hooks/
├── client/use-cases/
└── server/use-cases/
```

**有實質影響嗎？**

- **無**。原因：
  1. `provider-no-repo` 規則禁止 Provider → Repo 直接依賴
  2. `provider-no-service` 規則（S028）禁止 Provider → Service 直接依賴
  3. Provider 只透過 `use-cases` 或同層 Provider 互相引用
  4. 這兩條規則的效果 = 文章的「Providers 是獨立注入通道」

- **如果要做到物理獨立**：把 `src/runtime/providers/` 搬到 `src/providers/`，dep-cruise 加一條 `providers-no-higher-than-runtime`。但目前 3 個 Provider 不值得多一層目錄。

- **結論**：語義正確 + 機械保護到位 > 物理目錄結構。目前做法完全 OK。

### 差異 C：Utils / src/lib 定位

**文章做法**：

- 頂層有 `Utils` 概念（Image #5 畫在 business domain 之上）
- 「we prefer shared utility packages over hand-rolled helpers to keep invariants centralized」
- 有時自己重新實作 subset（例如自建 map-with-concurrency helper 而非用 p-limit）

**本 repo 做法**：

- `src/lib/` 原本是 flat service layer（Phase 1-8 前的架構）
- 重構後 `src/lib/` 變成 **permanent compatibility facade**：20 個檔案都是 re-export
- `canonical-no-import-lib` 規則確保新的 canonical layers 不會 import `src/lib/`
- Pure utility functions（`formatPace()`, `formatDateTime()`, `chunkArray()`）留在 `src/lib/event-helpers.js`

**長期處理選項**：

| 選項            | 做法                                                          | 代價                        | 適合時機                                              |
| --------------- | ------------------------------------------------------------- | --------------------------- | ----------------------------------------------------- |
| **維持現狀**    | `src/lib/` 繼續當 facade + utils 混合層                       | 無                          | 現在 ✅                                               |
| **分離 utils**  | pure functions → `src/utils/`，facade re-exports → `src/lib/` | 搬檔 + 改 dep-cruise        | 當 utils 數量 > 20 個                                 |
| **消滅 facade** | 所有 caller 改用 canonical path，刪 `src/lib/`                | 大量 import 改動 + 測試更新 | 當非 canonical surfaces（components/hooks）也遷移完畢 |

**結論**：

- 文章的 Utils 概念 ≈ 本 repo `src/lib/` 中的 pure utility functions
- Facade 功能是文章沒有的（因為文章從零開始，不需要 backward compat）
- 目前混合策略合理，有 `canonical-no-import-lib` 規則防止新代碼走 facade path

---

## 10. 逆向依賴防線

三層防線確保任何逆向 import 在「寫完 → commit → push」全流程被攔住：

1. **開發時**：`npm run depcruise` 即時檢測，S026 的 remediation comment 告訴 agent/人類怎麼修
2. **Commit 時**：Husky pre-commit gate 自動跑 `lint → type-check → spellcheck → vitest`
3. **CI 時**：push 後 CI pipeline 再驗一次

### 完整規則清單（12 條 forbidden rules）

| 規則                                 | 攔什麼                           |
| ------------------------------------ | -------------------------------- |
| `types-no-higher-layer-imports`      | Types → 任何更高層               |
| `config-no-higher-layer-imports`     | Config → Repo/Service/Runtime/UI |
| `repo-no-higher-layer-imports`       | Repo → Service/Runtime/UI        |
| `service-no-higher-layer-imports`    | Service → Runtime/UI             |
| `runtime-no-higher-layer-imports`    | Runtime → UI                     |
| `canonical-no-import-lib`            | 六層 canonical → src/lib/        |
| `provider-no-repo`                   | Provider → Repo                  |
| `provider-no-service`                | Provider → Service               |
| `entry-no-config-repo-direct-import` | src/app/ → Config/Repo           |
| `server-only-no-client-import`       | Client code → server modules     |
| `server-deps-require-server-path`    | 非 server 路徑 → firebase-admin  |
| `production-no-specs-import`         | src/ → specs/                    |

### 豁免機制

JSDoc `@typedef` type-only import 不產生 runtime 依賴，所有 forbidden rules 透過 `dependencyTypesNot` filter 自動豁免：

```js
// ✅ 不被攔（type-only）
/** @typedef {import('@/service/event-service').EventPayload} EventPayload */

// ❌ 被攔（runtime import，逆向依賴）
import { createEvent } from '@/service/event-service';
```
