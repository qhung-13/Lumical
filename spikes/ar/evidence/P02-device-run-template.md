# I03-P02 device run record (copy one block per device/browser)

Synthetic data only. Failures and "nothing revealed" are valid results; do not omit them.

- Date / tester:
- Device model / OS version:
- Browser + exact version:
- HTTPS host used (no tokens in this file):
- mind-ar / three versions installed (`npm ls`):
- Artifact ids used (A / B / combined) and manifest commit:

| # | Session | Artifact | Target shown | Light | Distance | Orientation | Expected | Observed | Repeats (n found / n tries) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | A | per-version | version-a | | | | A card | | | |
| 2 | A | per-version | version-b | | | | nothing | | | |
| 3 | B | per-version | version-b | | | | B card | | | |
| 4 | B | per-version | version-a | | | | nothing | | | |
| 5 | A | combined (test-only) | version-b | | | | recognized, server refuses | | | |
| 6 | A | per-version | unknown | | | | nothing | | | |
| 7 | B | combined (test-only) | version-a | | | | recognized, server refuses | | | |

Camera / lifecycle
- Permission prompt shown: yes / no. Deny result (message, fallback shows same content):
- After Stop: tracks created / live (page summary), OS camera indicator off: yes / no
- Off-origin requests or CSP violations in the evidence log:
- DevTools / inspector network capture done: yes / no (attach redacted summary: any request carrying frame-like payloads?)

Unsupported-device / runtime-failure case
- Device/browser, outcome, fallback content identical: yes / no

Preparation
- Re-compile of version A byte-identical (`npm run compile:verify`, or `--check-reproducible` for a browser-tool compile): MATCH / DIFFER
- Artifact unavailable (`npm run fault -- corrupt --version A`, then `missing`): page message, "View without camera" shows the same content: yes / no
- Fault restored (`npm run fault -- restore --version A`): yes / no

Overall honest verdict for this device: works / partial / fails, with reason:
