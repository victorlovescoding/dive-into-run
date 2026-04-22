---
name: Harness 五篇文章跨文章共同 Pattern
description: 5 篇 harness 文章（Fowler/OpenAI/Anthropic/Datadog/Stripe）的交叉分析，識別出 8 個共同主題，幫助判斷哪些實踐是業界共識 vs 單一公司特有
type: reference
originSessionId: 4bd77982-72e1-415a-a253-c32d62dcc91c
---

## 8 個跨文章共同主題（業界共識）

1. **前饋+反饋必須平衡**（Fowler × Anthropic × Datadog）— Guides 無 Sensors = 不知是否有效；Sensors 無 Guides = 不斷重複錯誤
2. **規格/契約優先（Spec-First）**（OpenAI × Datadog × Stripe）— 模糊輸入 = 品質有限的輸出
3. **分層驗證/多輪迭代**（全部）— 不同層級有不同成本/速度/信心度
4. **可觀測性作為控制層**（OpenAI × Anthropic × Datadog）— 不只是 debug 工具，是 agent 的推理依據
5. **Human-in-the-loop 但角色不同**（全部）— 不是消除人類，而是重新定位（排優先順序、驗證結果、定義 invariants）
6. **自動化品質管制與 GC**（OpenAI × Datadog × Stripe）— 品味編碼一次、持續機械式強制
7. **Agent 無法全局思考**（OpenAI × Anthropic × Stripe）— 傾向複製已有 pattern（含次優的），narrow scope 是前提
8. **Context 管理是關鍵瓶頸**（OpenAI × Anthropic）— 大型 AGENTS.md 失敗、Context Anxiety 是 emergent behavior

## How to apply

- 優化 harness 時，優先做「業界共識」的實踐（上述 8 項），而非某家特有的做法
- 本 repo 已覆蓋 #1-#3 和 #5-#7，#4（可觀測性）和 #8（Context 管理/Index Pattern）仍有改善空間
- 詳見 `project-health/2026-04-19-harness-gap-analysis.md`
