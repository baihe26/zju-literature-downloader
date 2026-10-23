# Browser Download Recovery

Use for continuation, slow PDF loading, article/PDF redirect loops, or control/save failures. These rules capture successful file handling and failed diagnostics without presenting an unresolved browser workaround as a repair.

## Separate Four Capabilities

Check these independently on the user-selected browser surface:

1. **Open:** a launcher can send a URL to a window.
2. **Inspect/control:** the actual page is listed, readable, and accepts an ordinary permitted action through the supported tool.
3. **Access/render:** the intended article/PDF is accessible and finishes rendering.
4. **Save/verify:** bytes are saved to the approved location, parse correctly, and match the intended article.

Success at an earlier stage proves no later stage. A visible PDF may be unsaved. A listening local debugging port is not proof of control. A synthetic download tests the destination/transport, not publisher access. Use fresh page objects/tab identifiers after restart; do not reuse stale IDs.

Before asking the user to finish a challenge, ensure the page is genuinely open on the agreed surface and identify its current state. If only an opening request can be confirmed, report that limitation. Preserve a loaded unsaved PDF rather than requesting a restart to pursue an unverified plan.

## Diagnose The Failing Layer

| Observation | Safe conclusion | Next step |
| --- | --- | --- |
| Tool execution rejected before helper launch | The operation did not run; browser/account cause is unknown | Preserve exact redacted error and action; inspect existing logs/state read-only. Do not switch tools, wrappers, encodings, or launch methods to evade a denial. |
| Empty helper logs | No diagnostic output was recorded | Do not infer successful startup or a Chrome fault; check process/ready/connection evidence separately. |
| Cannot list/read the selected browser | Control transport is unavailable | Diagnose that connection; do not ask for institutional re-login without an observed login page. |
| Article says institutional subscription/full text | HTML access is authorized in that session | Verify PDF separately; HTML access does not guarantee PDF transfer. |
| View PDF opens another article page; response is 200 text/html | No PDF was received | Check that the link belongs to the main article PII, not a cited reference. If the same article has challenge/redirect markers, record the publisher check, not a bad DOI or saved PDF. |
| Blank PDF viewer with progress/loading | PDF not yet confirmed loaded | Allow a bounded, progress-aware wait in the same tab; avoid repeated refresh/new tabs. |
| PDF renders but fetch/save fails | Viewer/control/transfer issue; not proof of lost access | Use a supported normal download/save action where permitted. Do not relaunch or discard the loaded page without a concrete need and preserved continuation state. |
| User also gets an immediate challenge/redirect loop | The issue is not limited to agent click selection | Stop automation on that route; retain the page and consider library/publisher support or a lawful OA alternative. |

On a generic host denial, distinguish the observed boundary from the unknown trigger. Do not invent a policy rule or describe a local missing port as the root cause of an earlier denial. Report the blocker once with a concrete permitted next step; repeated apologies, identical explanations, and repeat permission requests are not diagnostics.

## ScienceDirect: Content, Network And Human Checks

The [Elsevier technical requirements](https://www.elsevier.support/b2b-ecom/answer/what-are-the-technical-requirements-for-sciencedirect) identify separate PDF delivery (`pdf.sciencedirectassets.com`) and security-check (`challenges.cloudflare.com`) domains. Rewriting challenge responses through a proxy can break PDF access. Publisher automation restrictions still apply; use approved APIs/workflows, not automated challenge solving.

- Select the visible top-toolbar main-paper PDF link and confirm its PII against the article. Do not mistake a reference's View PDF link for the main paper.
- HTTP 200 or a `.pdf` URL can still return HTML; `cra_js_challenge`/`RR-16` redirects are observed challenge/redirect signals, not proof of an expired institution login or an incorrect DOI. Stop automatic retries on an active check.
- A root-domain HTTP status or successful TLS handshake does not validate an individual signed PDF request. Do not weaken certificate/revocation checks to force access.
- Observe the actual PDF tab URL through a supported tool; do not reconstruct a signed URL from a screenshot, strip its query as a download fix, or log its tokens. Reports should use the canonical article URL.
- Treat slow loading as pending, not immediate failure. Once genuine pages are rendered, prioritize saving and validating that file before a restart or further experimentation.
- Do not infer a particular proxy rule, exit IP, or browser flag is responsible from one successful manual test. Proxy state, launch environment and timing may differ together. Record the comparison and confounders; keep the cause unconfirmed.

Network/browser configuration changes require scoped authorization and a lawful troubleshooting purpose, not a route around an active access/security denial. Do not change global proxy settings, disable TLS/sandbox protections, spoof browser identity, remove automation markers to defeat checks, clear sessions, or export cookies/passwords. A previous one-window direct-network comparison is not standing authorization for another browser, global changes, or arbitrary direct downloads.

If a supported external browser is genuinely needed and authorized, reuse an installed runtime/browser where appropriate. Choose approved paths for profile, cache, temporary files and downloads before launch. Review an installer before running it; do not blindly execute an attachment or install a redundant browser. With Playwright launches, explicitly preserve Chromium sandboxing (`chromium_sandbox=True`); see the [official BrowserType documentation](https://playwright.dev/python/docs/api/class-browsertype). Native attachment can have different limitations and is not a proven fix for publisher access. If a debugging endpoint is explicitly authorized and permitted, bind/check loopback only; a host-denied attachment must not be retried by another method.

## Continue A Batch Without Losing Work

- Reconcile files, expected DOI/title, and known SI before opening pages. Keep old extracted text and per-paper notes; metadata-only records do not satisfy full-text requests.
- Maintain one active tab per pending asset where practical. Open a user-requested modest article batch sequentially, avoid concurrent SSO flows and request bursts, and leave actual challenges for the user. Keep processing unrelated permitted papers.
- After user confirmation, inspect the same tab once rather than recreating login. If the challenge immediately returns, mark it for manual/support follow-up; do not loop.
- Use an existing download event, normal PDF download action, or supported browser save path. Native-viewer fetch failures alone do not require a new login or prove an expired signed URL. If the save dialog is not controllable, state the limitation accurately; do not promise automatic saving.
- Respect custom-drive rules and available space before saving. Watch the approved intake for completed files; do not treat partial files, an old identically named file, or user-reported rendering as a new download.
- Verify format/pages/identity, copy into the intended project/batch, and verify byte-identical copying when claimed. Preserve originals and avoid silent overwrites. Only then update completion and close unneeded task-owned tabs.
- Enumerate SI from article pages even when the main PDF is present. Validate Office/ZIP/media with suitable tools; label limited signature checks honestly. Data-availability XML is not experimental SI. Unknown inventory stays unknown.
- Persist current verified paths, incomplete assets, attempt evidence, human-action pages and next steps. Retain old attempts as history, not current failure status; do not overwrite prior consolidation records with a zero-record rerun.
- Report unique-paper totals, verified main PDFs, verified SI files, local copies, genuinely new downloads and outstanding items separately. Do not call the whole batch complete because one publisher or one supplement worked.

## Boundaries Of The October 2026 Lessons

Some publisher mains and SI were successfully saved and validated through the external browser. A normal manual browser also rendered an Elsevier PDF after slow loading, but that observation did not establish saving. A subsequent automated attachment was rejected before launch. These are different outcomes: neither a working universal ScienceDirect downloader nor a confirmed proxy/root-cause repair was demonstrated. Recheck the live state on continuation rather than adopting the old diagnosis as fact.
