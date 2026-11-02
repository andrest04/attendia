# i18n untranslated-text sweep

## Objective
Find user-visible text that bypasses i18n across the whole app and translate it (es/en).

## Problem and why
`localization-complete.md` closed its tasks but its log admits the audit was bounded and not file-by-file. Remaining hard-coded copy shows the wrong language after switching.

## Scope
- In: visible text and accessible names in `src/` production code, wrong-language locale values, server messages that reach the user unmapped.
- Out: `[Profesor]` protocol suffix, brand `Attendia`, tests, stories, mocks, logs, identifiers, user-authored data, `SecurityPage` claims (deliberate product copy).

## Constraints
- Audit is read-only: Haiku agents at low effort, one per module, reading every production file completely. Modules over 15 files are split. One Sonnet agent applies the fixes (user instruction, replaced the first 6-group search-based run, which was stopped before any edit).
- `es` and `en` keep the same keys. Delivery: work-unit commits on `fix/i18n-untranslated-sweep`; push and merge stay with the user.

## Tasks
- [x] T1 Full-read audit of 408 files in 64 modules (route: workflow, 78 read-only agents plus 0 retries reported as gaps; trigger: the files exceed the inline budget). 408/408 reported read, 116 unique findings.
- [x] T2 Verify findings, apply translations, add regression tests, commit (route: delegated, 1 Sonnet writer; trigger: 2+ non-trivial files). Commit `236415e`.
- [x] T3 Parent assessment, spot check and report.

## Acceptance criteria
- Every confirmed finding renders through `t()` in both languages, or is recorded as rejected with a reason.
- Checks pass: locale parity, focused tests, `CI=true npm run lint`, client `tsc`, `npm run typescript:server`, full Jest.

## Outcome
Applied:
- `phones not supported` client error key (es/en), with an `apiClient` test.
- `AboutDialog` N/A fallback through `about.notAvailable` (N/D in Spanish).
- `MediaMessage.formatFileSize` and `ResourcesTab.formatSizeLabel` format decimals by language.

Rejected by the writer, with reasons in its report:
- 67 literal server messages: parent script confirmed every one is in `server/errorCopy.ts`, applied by `server/http.ts`.
- 10 raw error-message findings: already localized by `ClientApiError` or sentinels, or deliberate stored-text fallback.
- Remaining: never rendered (`attentionLevelStyle`, proctoring labels, `MOCK_DISCLOSURE`), keys present in both locales, translated through `messages.ts`, or fixtures and technical labels.

## Verification evidence
- Writer: parity 5/5, lint clean, client `tsc` clean, `typescript:server` clean. Its full Jest run had one stale snapshot, which it updated without rerunning the full suite.
- Parent, on the final tree: full Jest 305 suites, 3036 tests, 33 snapshots passed.
- `gentle-ai review assess` (HEAD~1, committed only, untracked excluded): risk medium, `review_due: false`, reason `under_budget`. RDD is off, writer ran on Sonnet, so no separate verifier.

## Not verified
- `filesRead` is self-reported by each auditor, not independently confirmed.
- No browser or screen-reader check.
- RED observed only for the `formatFileSize` literals; `AboutDialog` and `apiClient` tests were written alongside the change. `ResourcesTab.formatSizeLabel` has no dedicated new test.
- Writer rejections other than the 67 server messages were not independently checked.

## Next step
Push and merge are the user's decision.
