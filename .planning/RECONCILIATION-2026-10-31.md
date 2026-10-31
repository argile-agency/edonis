# Reconciliation: repo roadmap vs company roadmap (2026-10-31)

**Why this document exists.** Two roadmaps carried the word "V1" with different scopes. This repo's milestone v1.0 "Course Content Management" was 12 phases (1-3 debt, 4-12 content). The company roadmap (vault, authoritative: `01-STRATEGIE-ARGILE` §4 and design note 07 §10, decided 2026-10-10) defines milestones by date with a different content, and adds five governance lots that existed nowhere in this repo. This report maps one onto the other, lists the gaps and collisions, quantifies capacity, and names the decisions only the owner can take. It changes no application code.

**State of the repo at reconciliation:** phases 1, 2, 4 done; 3 and 5 planned (6 and 10 plans, verified); 6-12 unplanned; 13-17 created today as unplanned phases. 22 of 38 plans complete.

---

## 1. Vault milestone → repo coverage

| Vault milestone (date) | Vault content | Repo phases / requirements covering it | Gaps (nothing in the repo) | Collisions |
|---|---|---|---|---|
| **Course editor** (2026-11-30) | Drag-and-drop builder | Phase 5 Builder UI — BUILD-01..16 (10 plans, 6 waves, verified; bulk actions BUILD-11..16 added 2026-10-31, D-11/D-12) | — | Phase 5 alone is ~13-15 🟡 days (bulk actions 4.5-5 d of it, against the 2-3 d the vault expected); see §3 |
| **MVP V0.1** (2026-12-20) | A teacher creates a course (sections + pages), a learner follows it end to end; internal use | Phase 6 Page Content — PAGE-01..07; the existing learn view (`CourseContentsController.learn/outline`, hardened in phase 2); Phase 5 as prerequisite; Phases 1, 2, 4 already done | — | **C1 Editor:** ROADMAP Phase 6 and PAGE-01..05 say "WYSIWYG rich text editor" with plan 06-01 "TipTap editor integration"; the vault says a Markdown editor is enough for the MVP and puts Tiptap + typed blocks in V1.1 (10-20 d). Flagged, not decided. **C2 Phase 3:** evaluations module + contact form (EVAL-01..03, CONTACT-01..03) are not on the MVP critical path; placed in v0.1 after 5-6 as the first thing to drop |
| **V1 + first pilots** (2027-03-31) | Files, links, progress tracking **plus** governance lots B, C+D, E, F, H | Phase 7 File — FILE-01..06; Phase 8 URL — URL-01..04; Phase 10 Engagement — TRACK-01..04; Phase 12 Permissions — PERM-01..03 (12-01 already done by phase 2); Phase 9 Assignment integration — ASSIGN-01..03 "if cheap" | **Lot B** rubric + per-question marking + lock + audit → new **Phase 13, RUBRIC-01..07**; **Lot C+D** AI governance core + one OpenAI-compatible provider + Ollama in CI → new **Phase 14, AIGOV-01..12**; **Lot E** AI Act art. 5 + 50 → new **Phase 15, AIACT-01..03**; **Lot F** accommodation profile → new **Phase 16, ACCOM-01..03**; **Lot H** installability → new **Phase 17, INSTALL-01..03** | **C3 Quiz builder vs lot B** (§2); **C4 E1 PostgreSQL-only vs CI matrix** (§4); **C5 capacity:** ~7 available days against 22 🟡 days of governance lots + ~8 🟡 days of content phases (§3) |
| **Soft launch** (2027-05-31) | 50 early adopters | No repo artefact; follows v1.0 | — | — |
| **V1.1** (autumn 2027) | Tiptap + typed JSON blocks + revisions; Safe Exam Browser; track-1/track-2 labelling; course index + retrieve (grounded MCQ, teacher Q&A); theme tokens by prompt; accommodation profile by prompt; date shift; upstream links for shared blocks; course template × cohorts | Requirements only (no phase): EDITOR-V11-01, ASSESS-V11-01/02, AI-V11-01, THEME-V11-01, ACCOM-V11-01; BUILD-V2-07 and BUILD-V2-08 keep their IDs but the vault places them in V1.1 | — | **C6 Date shift:** the vault lists "date shift" in V1.1, while BUILD-13 (bulk date shift) entered Phase 5 on 2026-10-31 by the same vault decision (E5). Probably two different things (bulk offset vs instantiation offset); flagged, not decided |
| **V2** (undated, not committed) | Full paper workflow, OMR, LTI 1.3 platform role, partial QTI 3, **Moodle .mbz import**, student course Q&A, matrix deployment | **Phase 11 Moodle Import — IMPORT-01..11 moved to v2 (2026-10-31)**; BUILD-V2-06 matrix deployment; new PAPER-V2-01/02, LTI-V2-01, QTI-V2-01, QA-V2-01 | — | **C7 Core value:** PROJECT.md's core value was "Easy course creation with seamless Moodle migration". With Phase 11 in v2 the second half is no longer a v1 promise; PROJECT.md now names demonstrable AI governance instead (§5) |

Requirement IDs kept: every existing ID is unchanged. Moved: IMPORT-01..11 (v1 → v2, reason: company roadmap places Moodle import in V2, 2026-10-31). Added: RUBRIC-01..07, AIGOV-01..12, AIACT-01..03, ACCOM-01..03, INSTALL-01..03 (v1.0); EDITOR-V11-01, ASSESS-V11-01/02, AI-V11-01, THEME-V11-01, ACCOM-V11-01 (v1.1); PAPER-V2-01/02, LTI-V2-01, QTI-V2-01, QA-V2-01 (v2).

---

## 2. Collision C3 — Quiz builder (out of scope v1) vs lot B (rubric, per-question marking)

Lot B does **not** need a quiz builder. What it needs from the assessment model, and what the model has today:

| Lot B needs | Exists today | Gap |
|---|---|---|
| An assessment to attach a grid to (online, paper, oral, practical) | `assignments` (types essay / file_upload / online_text / offline), `submissions`, `grade_categories`, gradebook | "paper", "oral", "practical" map onto `offline` + a declared modality; no new assessment type is required for B |
| A `rubric` object independent of the assignment | `assignments.use_rubric` (bool) and `assignments.rubric_data` (free JSON, typed `any`), `submissions.rubric_scores` (free JSON) | New tables: `rubrics`, `rubric_versions` (criteria × levels × points), referenced by assignments; the free JSON becomes legacy read-only or is migrated (RUBRIC-07) |
| Marking per criterion / per question | A single `grade` / `points_earned` per submission, `rubric_scores` JSON | New `marks` rows: (submission, rubric_version, criterion, points, marker, at); total recomputed from the parts (RUBRIC-03) |
| Versioning, never edited in place once used | Nothing is versioned (no `lock_version`, no version tables anywhere) | RUBRIC-02; the same "immutable once used" convention the future quiz slots will need (`fixed_version`), so B sets the pattern |
| Retroactive recompute when the grid changes | Nothing | RUBRIC-04, a recompute job with a report to the marker |
| Edge-case resolution queue | Nothing | RUBRIC-05 |
| Lock + audit on finalised marks | `audit_logs` + `AuditService` exist (phase 2) | RUBRIC-06 adds the lock state and the audit event |

What B does **not** need: question banks, quiz items, item authoring, auto-scoring, quiz slots, `random_from_bank`. "Per-question" in B means the rows of the grid (a question of a paper exam is a criterion row), not quiz questions. The only coupling with the future quiz builder is the versioning convention (`latest_version | fixed_version | random_from_bank` for quiz slots, recorded in REQUIREMENTS.md Out of Scope): B's rubric versions should follow the same immutability rule so the quiz builder can reuse it.

---

## 3. Capacity view

Legend: 🟡 = day estimate carried from the vault (lots) or estimated here from plan counts (content phases, ~1 d per plan; marked "repo est."). The vault does not quantify "Nov-Dec evenings"; the owner must fix that figure.

### v0.1 MVP (2026-12-20, 7 weeks from today)

| Phase | Plans | 🟡 days | Note |
|---|---|---|---|
| 5 Builder UI | 10 | 13-15 (repo est.; bulk actions 4.5-5 of it) | verified, ready to execute |
| 6 Page Content | 3 placeholders | 3 (Markdown) **or** 10-20 (Tiptap + blocks, vault figure) | **editor choice pending (C1)** |
| 3 Complete Stubbed Features | 6 | 3-4 (repo est.) | optional for the MVP; first to drop |
| **Total** | 19 | **16-19 d (Markdown) · 23-29 d (Tiptap) · +3-4 d with Phase 3** | against "Nov-Dec evenings", unquantified |

At one effective day per week of evenings, 7 weeks give ~7 days: the MVP as scoped needs 2-4× that. Even the Markdown variant without Phase 3 (16-19 d) does not fit; what fits by 2026-12-20 at that pace is Phase 5 alone (the vault's own "Course editor" 2026-11-30 milestone, late). This is the first number to confront.

### v1.0 Governance baseline + first pilots (2027-03-31, ~14 weeks after the MVP date)

| Item | 🟡 days | Source |
|---|---|---|
| Lot B — Phase 13 Rubric | 5 | vault |
| Lot C — Phase 14 AI governance core | 8 | vault |
| Lot D — Phase 14 provider + Ollama in CI | 2 | vault |
| Lot E — Phase 15 AI Act | 2 | vault |
| Lot F — Phase 16 Accommodation | 2 | vault |
| Lot H — Phase 17 Installability | 3 | vault |
| **Governance subtotal** | **22** | the vault's own round figure is "~20" |
| Phase 7 File | 2.5 | repo est. (3 plans) |
| Phase 8 URL | 1 | repo est. (1 plan) |
| Phase 10 Engagement | 2 | repo est. (2 plans) |
| Phase 12 Permissions and polish | 1 | repo est. (12-01 done) |
| Phase 9 Assignment integration ("if cheap") | 1.5 | repo est. (2 plans) |
| **Content subtotal** | **8** | |
| **Total v1.0** | **~30 d** | **against ~7 available days** (vault) unless the 2027 budget (">= 20 days/year, figure still to fix") is raised |

The tension is explicit and accepted in the vault; it is not hidden here: **v1.0 as scoped is ~4× the available capacity.** Two engines of revenue (paid installation, subscriptions) depend on this date, and both depend on lot H.

### Two sequencing options for v1.0

**(a) Governance first, content phases 7/8/10 minimal**
- Order: 17 Installability (3) → 15 AI Act (2) → 16 Accommodation (2) = 7 d, exactly the available capacity; then 13 Rubric (5), 14 AI governance (10), then 7/8/10/12/9 minimal (8).
- What ships at 7 d: an installable, documented product with backup/restore (the revenue prerequisite), the AI Act notices and opt-out (compliance posture), accommodation profiles. No AI capability yet (lot E is cheap but only meaningful once lot C exists), no rubric, and **pilots run on pages only** (no files, no links, no progress views).
- Sacrifices: the pilots' pedagogical surface; the "demonstrable AI governance" differentiator is not demonstrable at 2027-03-31 unless the budget rises by ~10 d for lot C+D.

**(b) Content first, governance lots compressed**
- Order: 7 File (2.5) → 8 URL (1) → 10 Engagement (2) → 17 Installability (3) = 8.5 d; then 12, 9, and the governance lots B, C+D, E, F compressed or dropped.
- What ships at ~8 d: pilots have files, links and progress tracking; the product is installable. **No rubric, no AI governance, no AI Act lot, no accommodation profile** at the pilot date.
- Sacrifices: the whole governance story, i.e. the commercial differentiator and the compliance posture; lot E is moot without C anyway, but F (accommodation) is a pilot-facing feature pilots will ask for.

**Recommendation (for the owner to confirm, not decided here):** option **(a)**, because lot H is the only item both options need and the two revenue engines depend on it, and because E, F and H together fit the 7 days while leaving the content phases (cheap to plan, with verified patterns from phases 4 and 5) as the first beneficiaries of any budget raise. The trade-off is real: pilots at 2027-03-31 would see a page-only course surface, and lot C+D (the differentiator) still needs a budget decision of about +10 days — without it, neither option delivers "demonstrable AI governance" on time, and the honest alternative is a v1.0.5 between 2027-03-31 and the 2027-05-31 soft launch.

---

## 4. Collision C4 — Arbitrage E1 (PostgreSQL-only vs postgres + mysql + sqlite in CI)

The vault documents say PostgreSQL-only; the repo runs the three engines in CI (`.github/workflows/ci.yml`) and production is MariaDB (Infomaniak). **E1 was resolved by the owner on 2026-10-31: the three engines are mandatory** (§8). The table below lists the items whose design this constrains, with the cross-engine consequence now binding:

| Item | Dependency on E1 |
|---|---|
| AIGOV-06 budget reservation (`UPDATE … WHERE spent + estimate <= limit RETURNING`) | `UPDATE … RETURNING` exists on PostgreSQL and SQLite ≥ 3.35, **not on MySQL/MariaDB** (MariaDB has RETURNING for INSERT/DELETE only). Cross-engine needs `SELECT … FOR UPDATE` + conditional update inside a transaction instead |
| AIGOV-07 `ai_usage` append-only ledger and `ai_audit_log` | Designed with partitions and JSONB/GIN; the repo's `jsonColumn` helper gives JSONB on PostgreSQL and JSON elsewhere, but partitioning is PostgreSQL-specific |
| AI-V11-01 course index + retrieve | pgvector: PostgreSQL only |
| RUBRIC-01/02 rubric definitions as JSON | Cross-engine with `jsonColumn`; no E1 dependency unless GIN indexing is wanted |
| INSTALL-02 backup/restore | One procedure per engine (pg_dump / mysqldump / file copy); E1 open triples the surface of lot H |
| Phase 5 BUILD-14 `copied_from_id` migration | Already handled cross-engine in plan 05-09 (SQLite FK rebuild guard) — the recurring cost of the open arbitrage |

---

## 5. PROJECT.md and README.md

**PROJECT.md** (edited in this commit): the core value now names the governance differentiator — "Easy course creation with demonstrable AI governance" — instead of Moodle migration (moved to v2); a Milestones table (v0.1 / v1.0 / soft launch / v1.1 / v2) points here; the "Moodle Import" active block is marked v2.

**README.md — proposed corrected wording (NOT edited; owner to apply):**

| Today | Proposed |
|---|---|
| "native AI integration" (line 11) | "demonstrable AI governance: AI is off by default, every capability is routed through institution-controlled policies with an explainable resolution trace, data classes, budgets and an append-only usage ledger" |
| "Real-time: WebSocket + SSE for live collaboration" (line 31) | remove — no roadmap (repo or vault) contains live collaboration; real-time presence in the builder is a deferred idea (05-CONTEXT.md) |
| "Standards Compliant: SCORM 2004, xAPI, LTI 1.3, QTI 2.1 (planned)" (line 22) and "Full standards compliance (SCORM 2004, xAPI, LTI 1.3, QTI 2.1)" (line 423) | "Standards: LTI 1.3 as the only public boundary (platform role, v2); partial QTI 3 (v2). SCORM and xAPI are not planned." |
| "Automated assessment & essay scoring" (line 411) | remove — decisional automatic grading is a never-build rule in the company roadmap |

---

## 6. Hard rules carried into the roadmap (from the vault)

- No third-party plugin system; internal modules only (AIGOV-01 extension types are internal registries); LTI 1.3 is the only public boundary (v2).
- Never build: AI-text detection, proctoring (biometric/behavioural), decisional automatic grading, dropout prediction (AIGOV-12, AIACT-02).
- AI OFF by default, including after upgrades (AIGOV-08).
- Capacity is the constraint, not ambition (§3).

---

## 7. Decisions only the owner can take

1. **Phase 6 editor (C1):** Markdown for the MVP (vault) or WYSIWYG/Tiptap (ROADMAP, PAGE-01..05 wording)? Changes PAGE-02..05 wording and 3-17 days of effort.
2. **E1 PostgreSQL-only vs three engines (C4):** decides AIGOV-06/07, AI-V11-01, INSTALL-02 designs; the repo keeps the three-engine CI until decided.
3. **Phase 3 placement (C2):** placed in v0.1 after phases 5-6 as the first thing to drop to v1.0 if they slip. Confirm or move now.
4. **Phase 9 placement:** v1.0 as the cheapest content phase (1.5 d) after 7/8/10, or drop to v1.1.
5. **v1.0 sequencing:** option (a) governance first (recommended, see trade-off) or (b) content first; and whether the 2027 budget is raised (~+10 d for lot C+D, ~+23 d for the whole v1.0 scope).
6. **MVP capacity:** quantify "Nov-Dec evenings"; at ~1 d/week the MVP needs 2-4× the available time.
7. **Date shift (C6):** is the vault's V1.1 "date shift" the same as BUILD-13 (already in Phase 5) or the instantiation offset of BUILD-V2-07?
8. **Phase 5 open questions OQ-1..3** (`05-09-PLAN.md`): `assignments.due_date` in bulk date shift; copies as drafts; bulk delete of fully selected non-empty sections.

---

## 8. Owner decisions taken on 2026-10-31 (answers to §7)

| # | Question | Decision | Recorded in |
|---|---|---|---|
| 1 | Phase 6 editor | A WYSIWYG editor "better than TinyMCE" (Tiptap class) with a source mode to edit HTML and code blocks inside a sanitized field (allow-list on save and render, no script execution). Typed JSON blocks and revisions stay in v1.1 | ROADMAP Phase 6 (criterion 6), REQUIREMENTS PAGE-08, EDITOR-V11-01 narrowed |
| 2 | E1 | **Three engines mandatory** (PostgreSQL, MySQL/MariaDB, SQLite). AIGOV-06: `SELECT … FOR UPDATE` + conditional update, no `UPDATE … RETURNING`; AIGOV-07: `jsonColumn`, no partitions; INSTALL-02: one procedure per engine; AI-V11-01: pgvector excluded | ROADMAP Phases 14 and 17, REQUIREMENTS, §4 above |
| 3 | Phase 3 placement | Confirmed: v0.1 after Phases 5-6, first to drop to v1.0 | ROADMAP Phase 3 |
| 4 | Phase 9 placement | v1.0, confirmed (no longer "if cheap") | ROADMAP checklist and milestone table |
| 5 | v1.0 sequencing | **Option (a)** — governance first: 17 → 15 → 16 → 13 → 14, then 7 → 8 → 10 → 12 → 9. The 2027 budget raise (~+10 d for lots C+D) is still open | ROADMAP execution order and milestone table |
| 6 | MVP capacity | **~10 days** available for Nov-Dec | this section, ROADMAP milestone table |
| 7 | Date shift (C6) | Acknowledged, kept as is: BUILD-13 stays in Phase 5; the vault's V1.1 "date shift" is treated as the instantiation offset of BUILD-V2-07 until the vault says otherwise | — |
| 8 | Phase 5 OQ-1..3 | Defaults accepted: bulk date shift leaves the `assignments` table alone; copies start as drafts; a bulk delete may include a non-empty section only when its whole sub-tree is selected | `05-09-PLAN.md`, `05-CONTEXT.md` D-13 |

**Consequence to confront next (not decided here).** With decisions 1 and 6 the MVP needs **26-39 🟡 days** (Phase 5 13-15 + Phase 6 10-20 + Phase 3 3-4) against **~10 available**: 2026-12-20 does not hold as scoped. The three honest moves are (i) keep the date and cut: execute Phase 5 waves 1-4 and 05-08 first (drag-and-drop without the bulk plans 05-09/05-10, ~8-10 d), postpone the bulk plans, Phase 3 and most of Phase 6 past the date; (ii) move the MVP date to match 26-39 days at the real pace; (iii) raise the Nov-Dec capacity. Each one is the owner's call; the roadmap records the gap, not a choice.

---

*Written 2026-10-31. Source of the company roadmap figures: vault `01-STRATEGIE-ARGILE` §4, design notes 07 §10, 08 and 09 (not in this repo). Repo figures: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, phase directories 01-05.*
