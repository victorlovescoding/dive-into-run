---
name: Anthropic 長任務 Harness 設計文章精華
description: Prithvi Rajasekaran (Anthropic) 文章 — GAN 啟發的 G-E 分離、三 Agent 架構、Sprint Contracts、Context Anxiety、Evaluator 調校、模型進步後簡化 Harness
type: reference
originSessionId: d25bdbb5-6490-473b-b666-f005244e0887
---

## 文章資訊

- **標題**: Harness Design for Long-Running Application Development
- **作者**: Prithvi Rajasekaran, Anthropic Labs
- **發佈**: 2026-03-24
- **來源**: https://www.anthropic.com/engineering/harness-design-long-running-apps

---

## 核心問題：Naive 實作為何失敗

### 1. Context 退化

兩種失敗模式：

- **Context Window 耗盡**：對話歷史填滿 context window 後，模型失去連貫性
- **Context Anxiety**：模型接近 context 極限時的 emergent behavior — 過早結束工作、走捷徑、品質下降。Sonnet 4.5 表現出強烈的 context anxiety

**Context Reset vs Compaction**：

- Compaction（原地摘要）不足以消除 context anxiety，因為：摘要本身燒 tokens、長期記憶喪失、累積誤差
- Context Reset（完整清空 + 結構化 handoff 帶前次狀態）才有效，但增加編排複雜度、token 開銷和延遲

### 2. 自我評估偏差

Agent 被要求評估自己的工作時，即使品質平庸，也會系統性地給高分。對主觀任務（如設計）尤其嚴重，因為沒有二元驗證存在。

**關鍵洞見**：分離 Generator 和 Evaluator 是可行的。雖然 Evaluator 仍有 LLM 偏差，但調校獨立的 Evaluator 使其保持懷疑態度，比讓 Generator 自我批評更容易實現。一旦有外部反饋，Generator 就有具體的迭代目標。

---

## 實驗一：Frontend Design（主觀品質可評分化）

### 四個評分標準

1. **Design Quality**：色彩、字體、佈局、圖像的連貫性，創造獨特氛圍/識別度
2. **Originality**：自定義決策的證據 vs 模板佈局、函式庫預設、AI 生成模式。明確懲罰「AI slop」（白卡片上的紫色漸層）
3. **Craft**：技術執行 — 字體層級、間距、色彩和諧、對比度
4. **Functionality**：獨立於美學的可用性；使用者理解介面目的、找到主要操作、完成任務

**權重策略**：Design Quality 和 Originality 權重較高。Claude 在 Craft 和 Functionality 天生得分高，需要推動美學冒險。

### 實作細節

- 基於 **Claude Agent SDK** 構建
- Generator 從 prompt 生成 HTML/CSS/JS 前端
- Evaluator 透過 **Playwright MCP** 與 live page 互動 — 導航、截圖、研究實作後才評分
- 每次生成 5-15 次迭代，每輪推向更獨特的方向
- 完整 run 長達 4 小時
- Generator 策略性調整：分數提升時精煉方向，停滯時轉換美學

**Evaluator 校準**：用 few-shot 範例加上詳細分數拆解，確保與作者偏好對齊，減少跨迭代的分數漂移。

### 關鍵發現

- Evaluator 評估隨迭代改善後進入高原期，仍有改善空間
- 部分生成漸進精煉；其他則急轉彎
- **措辭影響方向**：「best designs are museum quality」這句話推動了視覺趨同
- 分數大致改善但非線性 — 後期迭代不一定比中期好
- 實作複雜度隨輪次增加
- 即使第一次迭代也優於無提示基線 — 評分標準的語言本身就能推動輸出脫離 generic 預設

**荷蘭博物館案例**：到第 9 次迭代，產出符合預期的深色主題 landing page。第 10 次迭代**完全推翻方法**，重新構想為 3D 空間體驗 — CSS-perspective 房間、自由形式作品定位、門口導航。作者稱這是「我以前從未在 single-pass 生成中見過的創意跳躍」。

---

## 實驗二：Full-Stack Coding（三 Agent 系統）

### Planner Agent

- 將 1-4 句使用者 prompt 擴展為完整產品規格
- 指示要有野心但聚焦高層產品脈絡和技術設計（非細粒度實作）
- 原因：前期規格錯誤會 cascade 到實作；與其過度指定，不如約束交付物讓 agent 決定執行路徑
- 也辨識在規格中織入 AI 功能的機會

### Generator Agent

- **一次一功能的 sprint 方式**管理範圍
- Tech stack: React, Vite, FastAPI, SQLite（後改 PostgreSQL）
- Sprint 結束時先自我評估再交給 QA
- 整合 Git 版控

### Evaluator/QA Agent

- 透過 **Playwright MCP** 像使用者一樣點擊操作執行中的應用
- 測試 UI 功能、API endpoints、資料庫狀態
- 依 bugs + 覆蓋產品深度、功能、視覺設計、程式碼品質的標準評分
- **每個標準設硬門檻**；任一不通過即 sprint 失敗

### Sprint Contracts

Sprint 開始前，Generator 和 Evaluator **協商**具體的實作和可測試成功標準：

- Generator 提議要建什麼 + 驗證方法
- Evaluator 審查確保 Generator 建對東西
- 來回迭代直到達成共識

### 通訊方式：File-based Handoffs

Agent 寫檔案讓其他 agent 讀取並在同一檔案或新檔案中回應。維持對規格的忠實遵守而不過度指定。

### Evaluator 調校的困難

**Claude 原生 QA 能力差**。作者觀察到：

- 辨識出合法問題後，又 rationalize 說它們不重要
- 測試表面化，遺漏隱微 bug
- 調校需要反覆閱讀 evaluator logs、找到判斷分歧範例、更新 QA prompts
- 經過多輪開發循環才讓 evaluator 合理評分
- 即使調校後仍有限制：小型佈局問題、不直覺的互動、深層巢狀功能中的未發現 bug

### 具體 Evaluator 發現範例

1. Rectangle fill tool 只在拖曳起點/終點放置 tiles 而非填滿區域；`fillRectangle` 函數存在但未正確觸發
2. Delete key handler 要求同時設定 `selection` 和 `selectedEntityId`，但點擊 entity 只設後者
3. `PUT /frames/reorder` route 定義在 `/{frame_id}` routes 之後，導致 FastAPI 將 'reorder' 匹配為 frame_id 整數

---

## 模型進步後的 Harness 簡化

### 核心原則

> "Every component encodes assumptions about what models can't do solo; stress-test those assumptions."

每個 harness 元件都編碼了對模型限制的假設。這些假設值得隨能力提升定期重新檢驗。

### Opus 4.5 結果

| Harness      | 時間   | 成本 |
| ------------ | ------ | ---- |
| Solo run     | 20 min | $9   |
| Full harness | 6 hr   | $200 |

Solo 版初看不錯但有嚴重問題：僵硬的工作流、壞掉的遊戲物理、entity 不回應輸入。Full harness 版展現立即的打磨優勢：充分利用 viewport、合理的面板尺寸、一致的視覺識別、更豐富的 sprite editor。關鍵是**遊戲真的能玩**。

Evaluator 每個 sprint 有精細的測試標準（例：Sprint 3 對 level editor 有 27 個覆蓋標準）。Evaluator 發現足夠具體，可直接行動而不需調查。

### Opus 4.6 簡化（V2 Harness）

**具體變更**：

1. **完全移除 sprint 結構** — Opus 4.6 改進（更好的規劃、更長的 agentic task 持續力、更大 codebase 處理能力、改善的 code review/debugging、更好的 long-context retrieval）讓 sprint 結構不再必要

2. **Evaluator 改為 end-of-run 單次通過** — 當任務在 Generator 能獨立處理的範圍內，evaluator 是額外開銷；當任務推動 Generator 能力邊界時，evaluator 提供真正的提升。有用性取決於任務邊界相對於模型能力的位置

3. **改善 AI 功能整合** — 增加 prompt 讓生成的應用內部建構 agent，透過 tools 驅動功能

### DAW 測試案例（V2 Harness，Opus 4.6）

Prompt: "Build a fully featured DAW in the browser using the Web Audio API."

| 階段          | 時間            | 成本        |
| ------------- | --------------- | ----------- |
| Planner       | 4.7 min         | $0.46       |
| Build Round 1 | 2 hr 7 min      | $71.08      |
| QA Round 1    | 8.8 min         | $3.24       |
| Build Round 2 | 1 hr 2 min      | $36.89      |
| QA Round 2    | 6.8 min         | $3.09       |
| Build Round 3 | 10.9 min        | $5.88       |
| QA Round 3    | 9.6 min         | $4.06       |
| **Total**     | **3 hr 50 min** | **$124.70** |

QA 仍抓到有意義的缺口：

- Round 1: 「主要失敗點是 Feature Completeness... clips 無法在 timeline 上拖曳/移動，沒有 instrument UI panels，沒有視覺效果編輯器」
- Round 2: 「Audio recording 仍是 stub-only，clip resize/split 未實作，effect visualizations 是數字 sliders 不是圖形化」

**產出能力**：核心 DAW 元件可運作（arrangement view、mixer、transport 在瀏覽器中運行）。Agent 可透過 tools 自主作曲 — 設定 tempo/key、鋪旋律、建鼓組、調音量、加 reverb。音樂品質有限（Claude 聽不到），但核心基元都在。

---

## 作者結論

> "The space of interesting harness combinations doesn't shrink as models improve—it moves."

有效 harness 維護的要點：

- 在部署模型上實驗、閱讀 execution traces、在真實問題上調校效能
- 複雜任務中，分解 + 每個面向的專門化 agent 能帶來效能提升空間
- 新模型發佈時，重新檢視 harness — 剝除不再承重的元件，同時加入先前不可能的新能力

---

## 技術工具

- **Claude Agent SDK**: 主要編排工具
- **Playwright MCP**: 讓 agent 與 live web app 互動
- **Tech stack**: React, Vite, FastAPI, SQLite/PostgreSQL, Git
- **測試模型**: Opus 4.5, Opus 4.6, Sonnet 4.5
