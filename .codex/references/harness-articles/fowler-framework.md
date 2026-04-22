---
name: Harness Engineering 核心框架
description: Martin Fowler 文章精華 — Guides/Sensors 模型、反模式、迭代方法，用於指導 harness 系統的持續改進
type: reference
originSessionId: 4f5fce59-42e3-49d0-acac-bfd1fb041c7d
---

## 核心模型：Agent = Model + Harness

Harness 分兩層控制：

- **Guides（前饋）**：行動前指導，增加首次成功率（AGENTS.md、Skills、Constitution）
- **Sensors（反饋）**：行動後檢查，驅動自我修正（lint、type-check、IDE diagnostics、pre-commit）

## 關鍵原則

1. **前饋+反饋必須平衡** — 只有 Guide 不知道是否有效；只有 Sensor 不斷重複錯誤
2. **按成本/速度分層** — 快速計算型（lint/test）→ 中速推理型（IDE diagnostics）→ 慢速人工（code review）
3. **品質左移** — 越早發現問題越便宜
4. **轉向循環** — 追蹤重複失敗 → 改進對應的 Guide 或 Sensor → 驗證改善
5. **Harness 一致性** — Guides 和 Sensors 不能矛盾
6. **可搭載性** — 強型別、清晰邊界、框架抽象 → 更好的 harness 效果

## 反模式速查

- ❌ 只有 Sensor 沒有 Guide → 代理重複犯錯
- ❌ 只有 Guide 沒有 Sensor → 不知道規則是否有效
- ❌ 過度依賴 AI 生成測試 → 行為正確性仍需人工驗證
- ❌ Guides/Sensors 矛盾 → 代理面臨衝突目標
- ❌ 一次性配置 → Harness 是持續工程實踐

## 黃金法則

> 好的 Harness 不是消除人類輸入，而是將人類專注力導向最重要的地方。

**How to apply:** 每次改 AGENTS.md/Skills/Hooks 時，問自己：這是 Guide 還是 Sensor？有對應的另一面嗎？是否跟現有系統矛盾？
