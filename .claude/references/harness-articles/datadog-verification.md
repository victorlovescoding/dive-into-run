---
name: Datadog Harness-First Agents 文章精華
description: Datadog "Closing the verification loop" 文章精華 — Verification Pyramid、Contracts Before Code、BUGGIFY+DST、Scalability Inversion、Observability Loop，含 redis-rust 和 Helix 兩個案例
type: reference
originSessionId: 02e54c40-ce91-4f33-a531-47bbc2678b6f
---

## 背景

Datadog 文章 "Closing the verification loop: Observability-driven harnesses for building with agents"（2026-03-09，作者：Alp Keles, Jai Menon, Sesh Nalla, Vyom Shah）。

核心論點：AI agents 產出代碼速度已超過任何團隊能驗證的速度。解法是 **harness-first engineering**——自動化驗證機制取代傳統 code review 作為正確性閘門。

> "AI agents can now produce software faster than any team can verify it. The bottleneck has moved from writing code to trusting what was written."

> "A good harness makes iteration cheap. A weak harness cannot be compensated for by better models or more human review."

驗證迴路：agent generates → harness verifies → production telemetry validates → feedback updates harness → agent iterates。

文章引用的方法論先驅：FoundationDB、TigerBeetle（DST）、Antithesis、AWS（半正式方法）、GCC、AWS Cedar（差分測試）、Maelstrom、Knossos（分散式系統測試）。

---

## 文章結構

四大章節：**redis-rust**（學習方法論）→ **Helix**（在 harness 中改進）→ **Scalability Inversion**（可擴展性反轉）→ **Where This Goes**（未來方向）。

---

## 核心概念

### 1. Verification Pyramid（驗證金字塔）

分層驗證，以 DST 為 primary layer：

| Layer       | Tool                      | Time        | Confidence      |
| ----------- | ------------------------- | ----------- | --------------- |
| Symbolic    | TLA+ specs                | 2 min read  | Understanding   |
| **Primary** | **DST**                   | **~5 s**    | **High**        |
| Exhaustive  | Stateright model checking | 30–60 s     | Proof           |
| Bounded     | Kani                      | ~60 s       | Proof (bounded) |
| Empirical   | Telemetry + benchmarks    | seconds–min | Ground truth    |

DST 成為 primary 的原因：~5s 跑 10M seeds 的成本效益比最高，秒級發現系統性 bug。上層（TLA+/Kani）提供證明性信心但耗時；下層（遙測）提供終極驗證但延遲。

### 2. Contracts Before Code（契約先於代碼）

先定義 core invariants（系統不變式），agent 各自設計子系統，**不能發明系統語義**。強迫明確決策：什麼是 durable vs acknowledged？committed vs visible？crash 時每個邊界會怎樣？

> "once invariants were explicit and continuously checked, the agent could safely move faster than humans could review."

### 3. BUGGIFY + DST（故障注入 + 確定性模擬測試）

**BUGGIFY**：有控制的故障注入——在特定條件下人為誘發 race condition、磁盤故障、網路分區。刻意拉寬並發操作的時間窗口，暴露 timing-dependent bugs。

對 agent-generated code 特別有效的三個原因：

1. Agent 傾向樂觀假設（忽略邊界條件）
2. Agent 無法跨領域推理（「這段代碼在高並發下會失敗」）
3. BUGGIFY 自動化了這種推理——harness 插入故障，DST 找到 agent 沒想到的失敗模式

DST 目標：500 seeds/component → 10M seeds cross-component。技術包含 metamorphic properties、roundtrip properties（`decompress(compress(bytes)) == bytes`）、differential testing。

實際 bug 範例：WAL in-memory truncation before disk sync → injected disk fault → data loss → fix: copy-on-write。

### 4. ADR → TLA+ → 多層驗證 Pipeline（SSOT）

**單一真實來源**：Architecture Decision Records（ADR）定義系統決策 → TLA+ 形式化為不變量 → 不變量**共享** across DST、Stateright、Kani、staging telemetry。修改 ADR 時同步更新 TLA+，驗證層自動繼承。避免測試與實現漸進分裂。

> "We generate them from architecture decision records (ADRs), catching ambiguities early."

### 5. Scalability Inversion（可擴展性反轉）

**傳統**：code review 最 scalable（人人能做），formal methods 最不 scalable（需 PhD、專家稀缺）。

**有了 agents**：LLM 自動生成 TLA+ specs、DST harnesses、Kani proofs，formal methods **變成自動化 pipeline 階段**。成本低於人工 code review。

人類角色轉變：從「inspecting every rivet」→「designing the checks」。Code review 變成 bloom filter——快速 gate，非正確性來源。

> "What the reviewer reads is not the diff but the harness output: which invariants passed, which seeds were tested."

> "The harness compounds in a way that code review cannot."

### 6. Observability Loop（可觀測性閉環）

關鍵問題：不完整 invariants 可能產生 **automated confidence in incorrect behavior**。

解法：production telemetry（metrics, logs, traces, trajectories）feeds back into verification pipeline，surfacing model vs real-world mismatches，允許 harness 持續精進。

> "Without observability, the loop is not closed."

> "the observability platform becomes the control layer for agent-built software."

---

## 實戰案例

### Redis-Rust

- Agent（Claude Code Opus 4.5）數小時產出 working Redis-compatible server
- 逐層疊加 6 層驗證：shadow-state oracle → DST → TLA+ → Kani bounded proof → Maelstrom → Redis Tcl compatibility suite
- 結果：延遲與 Redis 8.4 相當，**memory 87% reduction**

### Helix（Kafka 替代方案）

- 多 coding agents（Claude Code + Codex）共建
- Contracts Before Code → Verification Pyramid → Hill-Climbing Optimization
- **Hill-Climbing 流程**："with correctness locked in, performance work became controlled hill-climbing. The agent proposes an optimization, the full DST suite runs; if tests pass, we measure throughput and keep the change."
  - 具體優化項：zero-copy handlers + contention elimination、Raft pipelining、buffered WAL、actor-based architecture redesign（需人類批准）
- 結果：**produce latency 81% reduction** vs Kafka（22.2ms vs 116ms），**~93% peak disk throughput**（via fio benchmarks），10M DST seeds
- 正在 staging 環境服務 APM profiling stream（~10,000 messages/second）
- 多個 project 超過 **300,000 LOC**，都維持 human-in-the-loop

### Human Role（人類角色）

- Define system idea + invariants
- Review + strengthen DST harness
- Set measurable targets
- Approve architectural changes
- 其他全部 agent-driven

---

## Where This Goes（未來方向）

核心概念：**verification frontier**——凡是能自動驗證的 property（測試、證明、模擬、量測），就能委派給 agent；無法自動驗證的，human stays in the loop。

> "The value of formal methods is not the tooling itself. It is the discipline of expressing constraints that are precise, machine-checkable, and unambiguous."

投資建議：**invest in the harness in proportion to the cost of failure**。

文章預告 Part 2（Unicron × BitsEvolve）：correctness oracle、performance benchmark、safety sandbox 全自動化，human 完全退出 loop。

---

**來源**: https://www.datadoghq.com/blog/ai/harness-first-agents/
