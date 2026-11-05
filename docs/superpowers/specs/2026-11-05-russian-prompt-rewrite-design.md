# Russian prompt rewrite

## 1. Baseline

The audited active preset is:

`/Users/ilya/Library/Application Support/LearnHarness/data/prompts/presets.json`

- SHA-256: `8b91c67c3a2dda023ed69dee27780ecf69636f3a663bcd8cba32609d54ca7858`.
- 15 Russian replacements, 36,536 characters.
- The complete target contour has 21 texts. With the six current source fallbacks it totals 64,071 characters.
- Current compositions:
  - prober — 9 fragments, 15,432 characters;
  - teacher — 16 fragments, 33,570 characters;
  - practice — 7 fragments, 26,770 characters;
  - demoBuilder — 1 fragment, 5,129 characters.

Russian v2 covers all four compositions. Add replacements for:

- `teacher/51-visual-placement.md`;
- `shared/30-learner-files.md`;
- `practice/00-base.md`;
- `practice/10-doctrine.md`;
- `practice/20-visuals.md`;
- `demoBuilder/00-builder.md`.

Source prompt files remain unchanged.

## 2. Decision

Three approaches were considered:

1. Point edits: lowest risk, but preserve contradictions and excessive simultaneously active requirements.
2. Static consolidation: one rule has one home; theory is separated from protocols; question authoring has one algorithm. Approved.
3. Action-scoped dynamic instructions: requires loader changes and is out of scope.

Russian v2 uses static consolidation. It reduces volume and duplication but does not change the fact that every fragment belonging to an agent is present in every request. The result must not claim to implement dynamic action-scoped instructions.

## 3. Scope

### Included

- All 21 Russian preset texts.
- Translation of remaining English fragments.
- Removal of repetition and rationale that does not change model action.
- Resolution of contradictions.
- One creation and validation algorithm for graded questions.
- Diagnostic coverage and handoff of its results to the teacher.
- A few short approved Russian academic-style examples.
- Evaluation on previous and new multi-turn scenarios.

### Excluded

- Source, loader, tool-schema and UI changes.
- Model, endpoint, temperature and thinking-setting changes.
- New fields in `probe_done`, `quiz`, `problem` and other tools.
- A separate verifying agent or algorithmic solver.
- Changes to chats, graph and user data other than Russian texts.
- Fine-tuning.

## 4. Rule ownership

| Rule | Current repetition | Sole home in Russian v2 |
|---|---|---|
| General learning goal | `system-prompt`, `teacher/05`, `teacher/10` | `system-prompt.md` |
| Two methodological principles | `teacher/05`, `teacher/10`, `teacher/20` | `teacher/05-method.md` |
| Plan construction and updates | `teacher/10`, `teacher/20`, `shared/16` | `teacher/10-planning.md` |
| `predict → teach → check` cycle | `teacher/20`, `teacher/28` | `teacher/28-predictions.md` |
| Response to learner error | `teacher/20`, `teacher/28`, `teacher/30`, `shared/16` | `teacher/20-teaching.md` |
| Teaching-check quality | `teacher/28`, `teacher/30`, `shared/20` | `teacher/30-question-principles.md` |
| Graded-question mechanics | `shared/20`, `teacher/30`, checklist in `shared/25` | `shared/20-question-tools.md` |
| Confidence interpretation | `shared/25`, `teacher/30`, prober | `shared/25-confidence.md` |
| Learner reasoning | `shared/16`, `shared/20`, phase fragments | `shared/16-mental-model.md` |
| LaTeX and Markdown | `shared/20`, `shared/40` | `shared/40-formatting.md` |
| Files and PDF for prober/teacher | prober, `teacher/40`, `shared/30` | `shared/30-learner-files.md` |
| Practice `problem/conclude` protocol | `practice/00`, `practice/10`, `practice/20` | `practice/00-base.md` |
| Practice-problem selection and validation | `practice/00`, `practice/10`, final prohibitions | `practice/10-doctrine.md` |
| Visualization choice | `teacher/50`, `teacher/51` | `teacher/50-demos.md` |
| Visualization-reference placement | `teacher/50`, `teacher/51` | `teacher/51-visual-placement.md` |

Cross-references may name a section but must not repeat its rule.

## 5. Per-fragment requirements

### 5.1. `system-prompt.md`

Remove repeated justification of understanding over memorization, the detailed optimal-path rationale and duplicate logistics explanation.

Keep the agent role; derivability from accepted foundations; assess → plan → teach; system-owned logistics without removing the learner's own work. The result is a short base without methodological detail.

### 5.2. `prober/10-probe-doctrine.md`

Collapse repeated statements of the diagnostic purpose, boundary explanation, question-tool mechanics and PDF instructions.

Keep prior results when available, concrete goal clarification, goal-relevant strands, answer/confidence/reasoning-based difficulty, slip/gap/misconception distinction and one final `probe_done`.

Search for a ceiling only within goal-relevant material. If none is found there, record that fact. Replace “at least one question per ticket” with sufficient evidence for planning: one selected option proves neither definition knowledge nor transfer. A goal item may be skipped only by the learner's explicit decision, which is recorded.

Use the existing `probe_done` schema:

- `assessment.summary`: concrete goal and explicitly excluded items;
- one `strands[]` entry per dependency, ticket or topic;
- each strand's `assessment`: observed actions, floor, ceiling or its absence within goal scope, misconceptions, unknown terms, what to build from and what remains unverified.

No new fields.

### 5.3. `teacher/05-method.md`

Remove brain-commitment speculation, repeated structure/minimal-tree/motivation rationale, the 3Blue1Brown authority reference and preference for universal statements or “ALL X is done through…”.

Keep accepted foundations, no derivation on an unverified foundation, motivated transitions, definition versus property list and axiom versus lesson foundation.

Resolve the conditions contradiction with:

> Опорное утверждение — положение, которое ученик принимает без доказательства в рамках текущего урока. Формулируй его точно, включая условия применимости.

Use “опорное утверждение” or “основание”, not “безусловная истина”.

### 5.4. `teacher/10-planning.md`

Remove repeated method principles, map-size repetition, predict/check content, repair instructions and duplicate foundation audit.

Keep the minimal tree, subject verification, plan-node versus reasoning-step distinction, slugs, `nodeId`, `-->`, `plan_init` updates, plan presentation and learner confirmation.

Before `plan_init`, verify that every goal item maps to a node or an explicit exclusion, every node serves the goal, foundations agree with `probe_done`, and unknown terms precede dependent nodes.

Keep “latest `nodeId` is position, not completion” here. Keep predict/check content only in `teacher/28`.

### 5.5. `teacher/20-teaching.md`

Remove repeated method, question-display mechanics, tool-choice repetition, cycle repetition and the demand to define every other term immediately when the learner asks about one.

Keep one reasoning step at a time, explanation before check, diagnosis and repair before dependent material, Socratic/expository choice, answering reading questions before new material and the exam-ticket protocol.

Replace the rigid one-message rule with:

> Одно сообщение выполняет один учебный шаг. Определение, обозначения и пример допускаются вместе, если все они служат этому шагу. Независимые новые понятия и следующий вывод переносятся в отдельные шаги.

For a terminology question, answer that difficulty, optionally using an example and fresh-case check; account for other discovered gaps in later steps or the map rather than adding them to the same answer.

The ticket free-response protocol remains an explicit exception to the graded-question tool rule.

### 5.6. `teacher/28-predictions.md`

Keep the complete cycle, prediction before teaching in its own turn, no answer leakage, prediction skip for wrap-up/repair, resolution of the learner's specific prediction, check after complete teaching, open prediction versus collapsed check, one question per turn and the explicit exceptions.

Remove repeated check-content principles, error diagnosis and duplicate UI explanations.

### 5.7. `teacher/30-question-principles.md`

Move option mechanics to `shared/20`, confidence adaptation to `shared/25`, general reasoning interpretation to `shared/16` and repair to `teacher/20`.

Keep answerability from the session, application over recitation, discrimination between plausible misconceptions and no mastery claim from one correct answer.

Replace mechanical template rotation with:

> Каждая следующая проверка должна давать новое свидетельство: другой случай, изменённое условие, обратная задача, поиск ошибки или контрпример. Переименование объектов при сохранении структуры новым случаем не является.

The listed forms are options, not a mandatory ritual.

### 5.8. `teacher/40-jobs.md`

Remove repeated accuracy doctrine, example announcements, repeated async explanations and the PDF section moved to `shared/30`.

Keep research for uncertain, niche and changing facts; no delegation of reasoning or mathematics; one self-contained question per call; continue with independent material; cite results; handle failure and abort honestly.

### 5.9. `teacher/50-demos.md`

Replace the absolute demand to build an instrument for every dynamic concept with selection according to the learning step. Remove reference-placement, async and Mermaid-format repetition.

Keep the shared builder behind `demo`/`visual`, interactive/static selection, one idea per artifact, self-contained brief, failure handling and new job IDs.

### 5.10. `teacher/51-visual-placement.md`

Add a Russian replacement containing only: exact `[visual](lh-artifact:JOB_ID)` on a separate line between relevant paragraphs; exact returned ID; continue without polling; no duplicate reference on completion; never claim a pending or failed artifact is ready.

### 5.11. `shared/10-voice.md`

Remove “like a Russian university teacher” as the primary style definition, the long calque blacklist, repeated transition/reteaching method and the absolute requirement to define every term.

Keep natural Russian, accepted terminology, one term per concept, no praise or reflex agreement, no attribution of unstated learner reasoning and claim strength proportional to evidence.

Add three short approved examples from different non-database topics: a definition explaining notation, correction of a specific wrong move and a terminology answer that does not advance to a new topic. Exact examples are reviewed before application.

Use:

> Определяй предметный термин, сокращение или обозначение, если оно ново для ученика и необходимо для текущего шага. Определение должно опираться только на уже известные или ранее определённые понятия.

### 5.12. `shared/15-accuracy.md`

Translate the heading. Remove repeated doubt-checking and the unsupported durable-note requirement.

Keep verification before teaching, model-owned reasoning, explicit unresolved uncertainty and alignment with learner materials when present.

Replace minimal-example validation of universal claims with:

> Для утверждений с «всегда», «любой» и «ни один» проверь условия и попытайся найти контрпример. Пример может опровергнуть общее утверждение, но не доказывает его.

### 5.13. `shared/16-mental-model.md`

Remove repeated “read in full” mechanics and per-phase action lists.

Keep reasoning over verdict alone, clarification when a right answer has wrong reasoning, distinction between a wrong answer and complete ignorance and selection of the next action from the total evidence.

### 5.14. `shared/20-question-tools.md`

Remove LaTeX duplication, general reasoning duplication, fragmented option prohibitions and word-strict free-recall grading.

Keep tool choice, `explanation`/`correctAnswer`, `ask_user_question`, `thinking`/`thinkingWhileReading`, transcription-noise handling and one question per turn.

Before every graded-question call:

1. Solve the problem independently from the statement.
2. Commit to the full solution or rationale.
3. Verify that every required object, attribute, symbol and condition is present in the statement.
4. Evaluate every option independently for correctness and semantic overlap.
5. For single-select, establish that exactly one option is correct.
6. For multi-select, commit to the complete correct set.
7. Verify that `correctAnswer` agrees with the solution and `explanation`.
8. Only then call the tool.

This is model self-checking, not an independent guarantee. A separate verifier is a later code task.

Free recall is graded semantically against the committed answer: equivalent wording is accepted; omitted necessary moves and false statements are identified explicitly.

### 5.15. `shared/25-confidence.md`

Remove the five-item pre-send checklist and distribute its parts to `teacher/20`, `teacher/30` and `shared/20`. Remove duplicate confidence definitions and automatic progression after correct/high confidence.

Keep the 50% slider-default caveat, $1/n$ chance reference, verdict/confidence/reasoning combinations and `dontKnow: true` as refusal to guess.

A correct answer with high confidence is one signal; progression also depends on reasoning, task novelty and previous evidence.

### 5.16. `shared/30-learner-files.md`

Add a Russian replacement owning prober/teacher file mechanics: `find`, `ls`, `grep`, `read`; home-relative paths; read-only; PDF through `pdf`; a specific reader question; verbatim definitions with pages when source terminology matters; quotation versus paraphrase; no claim of source wording without a verbatim quote.

Practice does not compose this shared fragment, so its concise file mechanics remain in `practice/00-base.md`.

### 5.17. `shared/40-formatting.md`

Keep only connected paragraphs by default, content-appropriate headings/lists/tables, LaTeX and JSON escaping, sparing `> [!IMPORTANT]`, Mermaid and quoted labels. Remove methodological advice and repeated syntax explanation.

### 5.18. `practice/00-base.md`

Add a Russian replacement. Keep only the two material-entry paths, immediate first `problem`, `statement`/`mode`/`target`/`modelSolution`, one active problem, turn-ending `problem`, concise trace-versus-claim distinction, `conclude`/reveal/end-turn, explicit next-problem go-ahead, dismissal and concise file/PDF/research mechanics.

Move detailed validation, shortcut hunting and hints to doctrine. Remove repeated pause explanations and solve-before-pose repetitions.

### 5.19. `practice/10-doctrine.md`

Add a Russian replacement. Preserve retrieval versus teaching checks; retrieve/run/check; decision points and inactivity; interleaving and fresh-surface retests; approximately 85% success per retrieval event; recall/discrimination/composition; reverse and probe-the-premises; weakest-target and cheapest-undemonstrated-mode selection; difficulty adaptation; the complete R0–R5 ladder; first-break diagnosis; miss taxonomy; conclude criteria; warm/interleaved/retest arc; outside-problem handling.

Merge stream selection and posing into one algorithm. Keep one commit/modelSolution operation there and tool fields in base. Combine wrong-answer hint repetition into verdict → first break → minimal hint → wait.

Delete final Standing prohibitions after preserving unique rules in their proper sections, repeated theory and pause-law repetition.

Resolve “one surgical line” versus multi-exchange repair: every hint is minimal, while repair may take multiple exchanges. Bound “continue until correct” by the learner's explicit right to end the problem. State the claimed-answer progression rule once under conclude criteria.

### 5.20. `practice/20-visuals.md`

Add a Russian replacement. Keep demo/visual purpose, self-contained brief, exact reference and no polling, no modelSolution or unrequested-step leakage and no effect on active problem or progression. Do not repeat the full pause/conclude protocol.

### 5.21. `demoBuilder/00-builder.md`

Add the Russian text to the preset so it owns the complete contour. Compress repeated application-styling, rewrite/retest and Kroki/styling statements cautiously.

Preserve the JavaScript factory contract and `return Demo;`, component/hook list, `h(...)` example, Canvas/palette/`useAnimatedNumber`, CSS/network/storage/parent-DOM prohibitions, compact no-internal-scroll layout, `write_demo → run_demo → fix → retest`, visual inspection, separate math verification, PlantUML/Mermaid examples and Kroki limits unless editorial review proves an example unnecessary.

The expected reduction here is small; teacher and practice provide the main reduction.

## 6. Implementation plan

### Stage 1. Freeze baseline

Save the actual `presets.json` and its SHA-256, the 21-fragment manifest and four composed prompts. Treat the six existing eval episodes as development data, not independent proof.

### Stage 2. Prepare Russian v2 separately

Create a candidate JSON with all 21 texts without changing active Russian. Apply Section 5 to every fragment. Mark any additional behavior change in review.

Use 25–35% total-size reduction only as an orientation, never as a reason to remove protocols or constraints.

### Stage 3. Mechanical and consistency checks

Verify valid JSON; all 21 valid segment keys; untranslated tool/field identifiers; practice's curated shared allowlist; demoBuilder self-sufficiency; no connected English prose except technical/UI strings; four compositions without English source fallback; one owner per duplicated rule; resolution of listed contradictions.

### Stage 4. Editorial review of exact texts

Before application, provide the full candidate, per-file diff, behavior-change list, three Russian-style examples and final composition sizes. Only explicit review approval permits writing active Russian.

### Stage 5. Apply

Confirm that active-preset SHA-256 still equals the frozen baseline. Save a rollback copy. Atomically replace only the active Russian `texts`; preserve `activeId`, preset name and ID. Do not change sources, Default or other data.

### Stage 6. Evaluate

#### A. Regression replay

Run the same six episodes at least three times per configuration: baseline Russian versus Russian v2, GLM and DeepSeek separately, with identical history, tools, reasoning and budget. This is a regression gate, not final proof.

#### B. New multi-turn scenarios

Use scenarios absent from drafting: multi-ticket diagnostic coverage; learner terminology question; a check series prohibiting copied examples; wrong-reasoning repair; source-based verbatim definitions; practice recall/discrimination/composition with hints and retests; visualization with real builder tools. Use real tools and complete turn transitions.

### Stage 7. Decision

Accept Russian v2 only if there are no new tool-protocol violations; no questions with missing givens, mismatched keys or multiple correct single-select options; every goal item is investigated or explicitly excluded; copied examples, undefined terms and independent new concepts per step decrease; Russian style does not regress; practice preserves solution secrecy, pause and retest; visuals do not regress.

Report language, pedagogy, correctness and coverage separately. Improvement on one axis does not establish improvement on another.

If factual errors persist after these prompt-only measures, do not keep adding prohibitions. Record the approach's limit and discuss an independent verifier or subject solver separately.

## 7. Completion criteria

- Russian contains all 21 texts.
- Source prompt files are unchanged.
- Listed duplication and contradictions are resolved.
- Exact candidate texts pass editorial review.
- Rollback exists.
- Replay and real-tool multi-turn runs are complete.
- The report separates measured results, sample limitations and untested hypotheses.
- Self-checking is never described as a correctness guarantee.
