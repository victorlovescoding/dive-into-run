---
name: OpenAI Codex 團隊 Harness 實戰經驗
description: OpenAI 用 Codex 零手寫碼開發產品的實戰文章精華 — 工程師角色轉變、應用可讀性、知識體系、架構強制、自主性階梯、熵管理
type: reference
originSessionId: 369045f7-6f3f-46a0-8ad5-051be6b3cd4f
---

## 背景與規模

作者：Ryan Lopopolo, Member of the Technical Staff

OpenAI Codex 團隊 5 個月內（2025 年 8 月底起），以**零手寫碼**約束建構內部產品。核心哲學：**Humans steer. Agents execute.**

- 初始 3 人工程團隊，後擴展至 7 人
- ~100 萬行程式碼（應用邏輯、測試、CI、文件、觀察性、內部工具）
- ~1,500 PR，平均吞吐量 **3.5 PR/工程師/天**
- 吞吐量隨團隊成長而**增加**（非下降）
- 估計開發時間約為手寫的 **1/10**
- 產品有內部每日使用者與外部 alpha 測試者
- 初始 scaffold（repo 結構、CI、AGENTS.md）也是 Codex 生成的

---

## 1. 重新定義工程師角色

早期進展比預期慢，原因不是 Codex 能力不足，而是**環境欠缺規格**（underspecified）：agent 缺乏工具、抽象和內部結構來達成高階目標。

工程師的首要工作變成：**讓 agent 能做有用的工作**。

實踐方式：

- **深度優先**拆解大目標為小積木（設計、程式碼、review、測試），用積木解鎖更複雜任務
- 失敗時的修正從來不是「更努力」，而是問：**「缺少什麼能力？如何讓它對 agent 可讀且可強制？」**
- 人類幾乎完全透過 **prompt** 與系統互動
- **Ralph Wiggum Loop**：指示 Codex 自我 review → 請求額外 agent review（本地＋雲端）→ 回應人類/agent feedback → 迭代直到所有 agent reviewer 滿意
- Agent 使用標準開發工具（`gh`、local scripts、repo-embedded skills）直接取得 context
- Review 努力逐步推向 **agent-to-agent**，人類不是必須的

---

## 2. 提升應用可讀性

隨著 code throughput 增加，瓶頸轉移到 **human QA capacity**。因為固定約束是人類時間與注意力，團隊持續為 agent 增加能力，使 UI、logs、metrics 直接對 Codex 可讀。

### Chrome DevTools MCP 驗證流程

App 設計為 **per git worktree 可啟動**，Codex 可為每個變更啟動獨立實例。透過 Chrome DevTools Protocol 接入 agent runtime：

```
Select target + clear console
→ Snapshot BEFORE
→ Trigger UI path
→ (Runtime events during interaction)
→ Snapshot AFTER
→ Apply fix + restart
→ LOOP UNTIL CLEAN: Re-run validation
```

使 Codex 能重現 bug、驗證修正、推理 UI 行為。

### Observability 架構

每個 worktree 有**短暫的（ephemeral）本地 observability stack**，任務完成後拆除：

```
APP → Logs(HTTP) / OTLP Metrics / OTLP Traces
  → VECTOR (local fan-out)
    → Victoria Logs  → LogQL API  ─┐
    → Victoria Metrics → PromQL API ─┤→ CODEX: Query, Correlate, Reason
    → Victoria Traces → TraceQL API ─┘
      → UI Journey + Test
      → Implement change (PR), Restart app
      → Feedback loop → Re-run workload (CODEBASE)
```

使以下 prompt 變得可行：

- "ensure service startup completes in under 800ms"
- "no span in these four critical user journeys exceeds two seconds"

單次 Codex 運行可持續 **6+ 小時**（經常在人類睡覺時進行）。

---

## 3. 知識體系作為唯一真相來源

Context 管理是讓 agent 有效執行大型複雜任務的最大挑戰之一。核心教訓：**給 Codex 一張地圖，不是一本千頁手冊。**

### 「大型 AGENTS.md」的失敗

- Context 是稀缺資源 — 巨大指令檔排擠任務、程式碼和相關文件
- 什麼都「重要」= 沒有重要 — agent 就地 pattern-matching 而非有意導航
- **即時腐爛** — 巨型手冊變成過時規則的墳場，agent 無法判斷什麼仍然有效
- **難以驗證** — 單一大檔不利於機械式檢查（覆蓋率、新鮮度、所有權、交叉連結）

### 解法：AGENTS.md 是目錄，docs/ 是真相

短小的 AGENTS.md（~100 行）作為地圖，指向深層來源：

```
AGENTS.md
ARCHITECTURE.md
docs/
├── design-docs/
│   ├── index.md
│   ├── core-beliefs.md
│   └── ...
├── exec-plans/
│   ├── active/
│   ├── completed/
│   └── tech-debt-tracker.md
├── generated/
│   └── db-schema.md
├── product-specs/
│   ├── index.md
│   ├── new-user-onboarding.md
│   └── ...
├── references/
│   ├── design-system-reference-llms.txt
│   ├── nixpacks-llms.txt
│   ├── uv-llms.txt
│   └── ...
├── DESIGN.md
├── FRONTEND.md
├── PLANS.md
├── PRODUCT_SENSE.md
├── QUALITY_SCORE.md
├── RELIABILITY.md
└── SECURITY.md
```

- 設計文件有索引，含**驗證狀態**和定義 agent-first 運作原則的**核心信念**
- 架構文件提供 domain 和 package 分層的頂層地圖
- **品質文件**為每個 domain 和架構層評分，追蹤 gap
- 計畫是**一級工件**：輕量計畫用於小變更，複雜工作用**執行計畫**（附進度和決策記錄），checked into repo
- Active plans、completed plans、tech debt 都版本化且共置

### 漸進式揭露 + 機械式強制

- Agent 從小而穩定的入口開始，被教導**下一步去哪裡看**
- 專用 linter 和 CI job 驗證知識庫是最新的、有交叉連結、結構正確
- 定期 **doc-gardening agent** 掃描過時文件 → 開修正 PR

---

## 4. Agent 可讀性是目標

代碼庫完全由 agent 生成，因此優先為 **Codex 的可讀性**優化（如同團隊為新人提升程式碼導航性）。

### Agent 看不到的 = 不存在

從 agent 觀點，運行時 context 內無法存取的東西**等同不存在**：

- Google Doc → 不可見
- Slack 訊息 → 不可見
- 人腦中的默會知識 → 不可見
- 只有 repo 內的版本化工件（code、markdown、schema、executable plans）是 agent 可見的

需要持續將更多 context **推入 repo**。那個對齊團隊架構模式的 Slack 討論？如果 agent 發現不了，就像新人三個月後加入也不會知道。

### 「無聊」技術偏好

給 Codex 更多 context = 組織和暴露正確資訊讓 agent 推理，而非用臨時指令淹沒它。

- 偏好 composable、API 穩定、訓練集覆蓋好的技術（「無聊」= 易被 agent 建模）
- 有時**自建子集功能** > 引入不透明的第三方套件
- 具體例子：自建 `map-with-concurrency` helper 取代 `p-limit`，因為自建版本與 OpenTelemetry instrumentation 緊密整合、100% 測試覆蓋、行為完全符合 runtime 期望
- 拉更多系統進入 agent 可檢查/驗證/修改的形式 → 增加所有 agent 的槓桿（含 Codex 和 Aardvark）

---

## 5. 架構強制與品味

文件本身無法讓完全 agent 生成的代碼庫保持一致。核心原則：**強制不變量（invariants），不微管理實作**。

例如：要求 Codex 在邊界解析資料形狀（parse data shapes at the boundary），但不指定用什麼（model 似乎偏好 Zod，但團隊沒指定）。

### 剛性分層架構

Agent 在**嚴格邊界和可預測結構**的環境中最有效。每個業務 domain 劃分為固定層級，依賴方向嚴格驗證：

```
Types ↔ Config ↔ Repo → Service ↔ Runtime ↔ UI

橫切關注點（auth、connectors、telemetry、feature flags）
  → 透過單一明確介面進入：Providers

Utils（頂層共用）
```

層級圖中 Providers 與 App wiring + UI 雙向連接，Service/Runtime/UI 之間互通，但都建立在 Types/Config/Repo 基礎上。

這是**通常到百人規模才做的架構**，但在 agent 環境中是**早期前提**：約束是速度不衰退的條件。

### 品味不變量

用自訂 linter + 結構測試機械式強制：

- 結構化 logging
- Schema 和 type 的命名規範
- 檔案大小限制
- 平台特定可靠性要求

因為 lint 是自訂的，**錯誤訊息設計成注入 agent context 的修復指引**。

### 管理哲學

- **中央強制邊界，局部允許自主**（如同帶領大型工程平台組織）
- 深度關注邊界、正確性、可重現性；邊界內允許 agent 自由表達
- 產出的 code 不一定符合人類風格偏好 — **只要正確、可維護、對未來 agent 可讀就過關**
- 人類品味持續反饋進系統：review comments、重構 PR、user-facing bugs 被捕捉為文件更新或直接編碼進工具
- **文件不夠時，將規則提升為 code**

---

## 6. 吞吐量改變合併哲學

- 最少阻擋式合併閘門，PR 生命週期短
- 測試不穩定通常靠後續重跑，非無限期阻擋
- **修正便宜，等待昂貴**
- 在低吞吐量環境中不負責任，但在 agent 高吞吐量下是正確取捨

---

## 7. Agent 生成的真正意義

「agent-generated」意味著**所有東西**：

- Product code 和 tests
- CI configuration 和 release tooling
- Internal developer tools
- Documentation 和 design history
- Evaluation harnesses
- Review comments 和 responses
- 管理 repo 本身的 scripts
- Production dashboard definition files

人類始終在 loop 中，但在**不同的抽象層**工作：排定優先順序、將 user feedback 轉譯為 acceptance criteria、驗證結果。

當 agent 掙扎時，視為**信號**：識別缺少什麼（工具、護欄、文件）→ 反饋回 repo，**始終讓 Codex 自己寫修正**。

Agent 直接使用標準開發工具：pull review feedback、inline 回應、push 更新、squash and merge 自己的 PR。

---

## 8. 逐步提升自主性

當更多開發循環被編碼進系統後，repo 跨越了一個有意義的門檻：Codex 可以 **end-to-end 驅動新功能**。

單一 prompt 即可完成：

1. 驗證代碼庫當前狀態
2. 重現報告的 bug
3. **錄製影片展示失敗**
4. 實作修正
5. 驗證修正
6. **錄製第二支影片展示解決**
7. 開 PR
8. 回應 agent 和人類 feedback
9. 偵測並修復 build failures
10. **僅在需要判斷時升級給人類**
11. Merge 變更

**Caveat**：此行為嚴重依賴此 repo 的特定結構和工具，不應假設可在無類似投資的情況下泛化。

---

## 9. 熵與垃圾回收

完全 agent 自主性引入新問題：Codex 複製 repo 中已存在的 pattern — 包括不均勻或次優的。隨時間不可避免地 drift。

### 起源

團隊最初手動處理：**每週五花 20% 的時間清理「AI slop」**。不意外地，無法 scale。

### 黃金原則 + 自動化 GC

改為將**黃金原則（golden principles）** 編碼進 repo — 帶立場的機械式規則：

1. 共用 utility packages > 各自手寫 helpers（集中不變量）
2. 不 YOLO 探測資料 — 驗證邊界或依賴 typed SDK

定期背景 Codex 任務：

- 掃描偏差
- 更新品質評級
- 開針對性重構 PR
- 大部分**一分鐘內可 review 並 automerge**

技術債 = 高利率貸款，小幅持續償還 > 累積後痛苦處理。

**「Human taste is captured once, then enforced continuously on every line of code.」**

壞 pattern 每天捕捉並解決，而非讓它們在 codebase 中蔓延數天或數週。

---

## 10. 仍在學習中

- 架構一致性在完全 agent 生成的系統中**多年後如何演化** — 未知
- 人類判斷力在哪裡增加最多槓桿 — 仍在學習
- 如何編碼判斷力使其**複利** — 仍在探索
- 模型能力持續進步後系統如何演化 — 未知

> **"Building software still demands discipline, but the discipline shows up more in the scaffolding rather than the code."**

最困難的挑戰：設計**環境、反饋循環和控制系統**，幫助 agent 建構和維護複雜、可靠的大規模軟體。
