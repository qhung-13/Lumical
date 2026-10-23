# I03-P06 reproduction record (fill from a live, independent run; leave blank what was not run)

Do not pre-fill. Failures and "nothing revealed" are valid results. Replace every token and tunnel hostname with `<redacted>`.
The reproducer must not be the author of the harness (MEMBER_3). A recording of someone else's run is not acceptance.

## Run header

| Field | Value |
| --- | --- |
| Date |  |
| Reproducer (name, role) |  |
| Commit hash under test |  |
| OS, CPU architecture |  |
| `node -v`, `npm -v` |  |
| Phone: model, Android version, browser and exact version |  |
| HTTPS path used (tunnel or host) |  |
| P05 status at run time (PROVISIONAL / FINAL, commit) |  |

## Clean install and artifacts

| Step | Result |
| --- | --- |
| `npm ci --ignore-scripts` | |
| `npm audit` (count, no `audit fix`) | |
| `npm test` (pass / fail / skipped) | |
| Scratch recompile with `npm run compile -- --force`: A | MATCH / DIFFER (ids) |
| Scratch recompile: B | MATCH / DIFFER (ids) |
| Scratch recompile: combined (test-only) | MATCH / DIFFER (ids) |
| Provenance in `fixtures/manifest.json` for A, B, combined | |

## Phone cases

| # | Case | Expected | Observed | Attempts / successes | Light | Distance | Orientation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Session A, per-version, `version-a.png`, lose and re-find | Card A; hidden on loss | | | | | | |
| 2a | Session B, per-version, `version-b.png` | Card B | | | | | | |
| 2b | Session B, per-version, `version-a.png` | Nothing | | | | | | |
| 3 | Session A, combined (chosen before Start), `version-b.png` | Recognized, "nothing to show" | | | | | | |
| 4 | `unknown.png` | Nothing | | | | | | |
| 5 | Stop | `0 live`, OS camera indicator off | | | | | | |
| 6 | Deny camera permission, then Start | Clear denial message, Start usable, fallback works | | | | | | |
| 7 | `fault corrupt` on A, reload session A, then restore | Fallback shows the same title, image and message | | | | | | |

## Source-version binding

| Version | Artifact id in the `ar:started` log | Artifact id in the manifest | Reveal belongs to the session's own version |
| --- | --- | --- | --- |
| A | | | |
| B | | | |

## Attachments

- Evidence JSON per case group (tokens redacted), screenshots of failures and surprises.
- One network and storage trace, recorded as in `P04-observations-template.md`.

## Honest verdict (reproducer)

- What reproduced, what did not, and what was not run:
- Anything that contradicts `I03-P06-handoff.md`, the P03 matrix or the P05 record:

## Sign-off

| Role | Name | Date | Statement |
| --- | --- | --- | --- |
| Reproducer |  |  | I ran these steps live and the results above are mine. |
| Reviewer (LEAD) |  |  | |
