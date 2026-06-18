---
name: zju-literature-downloader
description: Use this skill whenever the user wants to use their own logged-in Zhejiang University Library, WebVPN, CAS SSO, 求是学术搜索, Summon, ScienceDirect, publisher, or Chrome session to legally search, download, organize, retry, and read academic PDFs and supporting information. Trigger on requests like “用浙大图书馆下载文献”, “WebVPN 下载 PDF”, “CAS 认证失败后重试下载”, “ScienceDirect 人机验证后继续”, “自动下载补充材料”, “读取全文和 supporting information”, “批量整理文献到项目文件夹”, or “导入 Zotero 后帮我读全文”.
metadata:
  compatibility: Requires a local Chrome session logged in by the user, Chrome remote debugging permission, and a shell with Node.js 22+ or a bundled Node runtime. Uses only user-authorized access. Claude Code may need installation under .claude/skills.
---

# ZJU Literature Downloader

This skill turns the verified workflow into a repeatable, legally scoped process for finding, downloading, and reading papers through the user's Zhejiang University Library / WebVPN access.

## Boundaries

Use only the user's legitimate institutional access. Do not bypass paywalls, DRM, CAPTCHA, Cloudflare, publisher bot checks, or two-factor authentication. If a page asks for CAPTCHA, QR login, SMS/OTP, Cloudflare, publisher bot checks, or a security challenge, stop and ask the user to complete it in Chrome.

Avoid mass downloading. Work in small batches, preferably after the user confirms the paper list. Leave a clear audit trail of what was downloaded, from where, and whether supporting information was found.

Do not ask the user to paste institutional passwords, CAS credentials, OTP codes, recovery codes, or session tokens into chat or terminal. If the user offers a password, decline and use the handoff-login workflow instead.

Exception for ZJU CAS saved-login pages: if the user explicitly says that Chrome has already filled the ZJU CAS credentials and authorizes clicking the login/confirm button, the agent may click that button once on the ZJU CAS/WebVPN/institutional SSO page without reading, copying, or typing any credential. This exception does not apply to CAPTCHA, QR login, SMS/OTP, publisher bot checks, or any page outside the expected institutional login flow.

Do not inspect or export cookies, passwords, local storage, browser profiles, or session files. Use the browser's already-authenticated page context only.

## Preconditions

Before attempting downloads, confirm these conditions:

1. Chrome is open on the user's machine.
2. The user has personally logged in to Zhejiang University Library / WebVPN in Chrome.
   - Common pages: `https://libweb.zju.edu.cn/`, `https://webvpn.zju.edu.cn/`, `https://zju.summon.serialssolutions.com/`.
3. Chrome remote debugging is allowed for the current browser instance.
   - Ask the user to open `chrome://inspect/#remote-debugging`.
   - They must enable `Allow remote debugging for this browser instance`.
4. The environment can run Node.js 22+.
   - Try `node --version`.
   - If `node` is not on PATH in Codex Desktop, try `%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe`.
5. The web-access CDP proxy is available or can be started.
   - Typical Claude Code path: `%USERPROFILE%\.claude\skills\web-access-main\scripts\check-deps.mjs`.
   - Typical shared agent path: `%USERPROFILE%\.agents\skills\web-access-main\scripts\check-deps.mjs`.
   - In Codex-only setups also check `%USERPROFILE%\.codex\skills\web-access-main\scripts\check-deps.mjs`.
6. The user has approved the target output folder.

If Claude Code says this skill is not installed, install or copy it to:

```powershell
$env:USERPROFILE\.claude\skills\zju-literature-downloader
```

Codex and other agent setups may instead use `.codex\skills` or `.agents\skills`; treat the three locations as install targets, not as different skill versions.

## Batch Scope

Small batches are supported when the user provides a definite DOI/title/PMID list.

Recommended limits:

- normal batch: 5-10 papers
- upper practical batch: 15-20 papers, with pauses and a manifest
- stop immediately if publisher checks, CAPTCHA, WebVPN expiry, or unusual download prompts appear

Do not turn a broad keyword search into unlimited automatic downloading. Do not download whole journal issues, volumes, or large result sets.

## Status Categories

Classify every paper into one of these statuses, and keep the status in the manifest:

```text
downloaded
downloaded_with_si
cas_waiting_user
cas_resolved_retry_needed
publisher_verification_waiting_user
sciencedirect_robot_check
retry_after_user_verification
do_not_auto_retry
url_needs_repair
summon_no_link
publisher_blocked_waiting_user
no_authorized_pdf_found
failed_after_retry
ip_not_authorized
purchase_required
```

Use `cas_waiting_user` only when the browser is visibly at Zhejiang University CAS / unified identity authentication or an equivalent institutional SSO step. Do not treat this as a final failure.

Use `publisher_verification_waiting_user` or `sciencedirect_robot_check` when a publisher page shows "Are you a robot?", CAPTCHA, Cloudflare, bot verification, or another anti-automation challenge. Do not treat this as a final failure, but do not try to solve it automatically.

## Start Chrome Control

Use the web-access CDP proxy when available.

On Windows PowerShell:

```powershell
$node = "node"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $node = "$env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe"
}
$checkDepsCandidates = @(
  "$env:USERPROFILE\.claude\skills\web-access-main\scripts\check-deps.mjs",
  "$env:USERPROFILE\.agents\skills\web-access-main\scripts\check-deps.mjs",
  "$env:USERPROFILE\.codex\skills\web-access-main\scripts\check-deps.mjs"
)
$checkDeps = $checkDepsCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $checkDeps) { throw "web-access-main/scripts/check-deps.mjs not found" }
& $node $checkDeps
```

Then test:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3456/targets" -TimeoutSec 10
```

If this hangs or fails:

- Ask the user to confirm the remote debugging checkbox.
- Check `%TEMP%\cdp-proxy.log`.
- Do not attempt to read Chrome session files.

## Core CDP Proxy API

The usual web-access proxy is `http://127.0.0.1:3456`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Proxy health and Chrome connection status |
| `/targets` | GET | List open Chrome tabs |
| `/new?url=...` | GET | Create a new background tab |
| `/navigate?target=...&url=...` | GET | Navigate an existing tab |
| `/close?target=...` | GET | Close a tab |
| `/info?target=...` | GET | Get page title, URL, and readyState |
| `/eval?target=...` | POST body=JS | Execute JavaScript in a tab and return `{ value: ... }` |
| `/clickAt?target=...` | POST body=CSS selector | Click the center of a visible element |

Use `/navigate` rather than `/new` for Summon URLs containing `#!` fragments. If a `#!` fragment is stripped, Chrome may open `about:blank` or a wrong page. If `curl` is unavailable, use PowerShell `Invoke-WebRequest` for simple checks or Node.js `fetch()` for proxy calls.

## Recommended Search Workflow

Prefer the library discovery route before direct publisher pages. It is more stable and less likely to trigger bot protection.

1. Search by DOI or exact title in ZJU Summon:
   - `https://zju.summon.serialssolutions.com/search?#!/search?pn=1&ho=t&include.ft.matches=f&l=en&q=<URL-encoded DOI or title>`
2. Open Summon URLs through `scripts/cdp_open_url.mjs` or otherwise fully URL-encode the nested URL when calling the CDP proxy. Summon uses `#!`; if the `#` fragment is stripped, Chrome may open `about:blank` or the wrong page.
3. Read the result page with `/eval`.
4. Extract links whose visible text or `aria-label` is:
   - `PDF`
   - `在线全文`
   - `Full Text`
   - `View PDF`
   - publisher-specific full-text entries.
5. Prefer the result's `PDF` link when present.
6. Open the PDF link in a new background tab through the CDP proxy.
7. If the publisher shows a security challenge, ask the user to complete it manually.
8. Once the PDF is visible in Chrome, use `scripts/browser_pdf_downloader.mjs` to save it from the authenticated browser context.

### Summon Field Notes

When extracting `PDF`, online full text, or publisher links from Summon:

1. Skip empty `href` values. The first online-full-text match can be a facet toggle rather than a real link.
2. Treat Summon as a slow SPA: wait about 6 seconds after navigation, then retry link extraction up to 3 times with short pauses.
3. If Summon redirects to `login.serialssolutions.com/sso/login` and says the IP is outside the authorized range, record `ip_not_authorized`. In that case the user may need the ZJU RVPN/SSLVPN client, not only WebVPN in a browser page, because CDP-controlled Chrome tabs may still use the local network IP.
4. If Summon has no PDF but has an online-full-text link, follow that route before constructing a publisher URL manually.

## Publisher-Specific Patterns

Use these as DOI-based repair hints only after confirming the paper identity. Do not claim access if the page or PDF is not actually verified.

### ACS Publications

For DOI prefix `10.1021/...`:

```text
https://pubs.acs.org/doi/pdf/<doi>
```

ACS supporting information often follows:

```text
https://pubs.acs.org/doi/suppl/<doi>/suppl_file/<journal-code>_si_001.pdf
```

The verified example `10.1021/acs.biomac.4c00102` used `bm4c00102_si_001.pdf`.

### Wiley

For DOI prefixes such as `10.1002/...` or `10.1111/...`, first navigate to the authenticated Wiley article page, then fetch from that page's own origin:

```text
<location.origin>/doi/pdfdirect/<doi>?download=true
```

Do not hardcode `onlinelibrary.wiley.com`: Summon may authenticate through a subdomain such as `advanced.onlinelibrary.wiley.com`, and cross-origin fetches can fail. Also avoid navigating the tab directly to `pdfdirect`, because the browser may start a download and leave the page context unusable. Prefer page-context `fetch()`.

### Springer Nature

For DOI prefixes such as `10.1007/...` and `10.1186/...`:

```text
https://link.springer.com/content/pdf/<doi>.pdf
```

This usually works after the institutional login is resolved. Use browser-context fetch if direct shell download returns `401`, `403`, or an HTML login page.

### Nature Communications

For OA DOI patterns such as `10.1038/s41467-...`, try:

```text
https://www.nature.com/articles/<article-id>.pdf
```

Extract `<article-id>` from the DOI suffix and still verify the PDF header and text.

### bioRxiv

For DOI prefix `10.1101/...`, try:

```text
https://www.biorxiv.org/content/<doi>v1.full.pdf
```

If version 1 returns 404, try the article page or a later version. Verify that the title matches.

### Frontiers

For DOI prefix `10.3389/...`, try:

```text
https://www.frontiersin.org/articles/<doi>/pdf
```

If it fails, open the article page first and use its visible PDF link.

### RSC Publishing

For DOI prefix `10.1039/...`, do not assume ZJU has authorized full-text access. If PDF links return 404 or purchase pages, inspect the article page and record `no_authorized_pdf_found` or `purchase_required` rather than retrying aggressively.

## Publisher Verification and ScienceDirect

ScienceDirect and some publisher platforms may show "Are you a robot?", CAPTCHA, Cloudflare, bot verification, or similar checks after repeated direct DOI navigation or automated tab opening. These pages are security and anti-automation challenges, not ordinary login confirmations.

Reduce the chance of triggering them by using a conservative access pattern:

1. Prefer ZJU Summon / WebVPN / library `在线全文` links before direct `doi.org -> publisher` navigation.
2. Process ScienceDirect and other sensitive publishers one article at a time.
3. Keep a visible audit trail in the manifest; do not open many publisher tabs in parallel.
4. Wait for each page to settle before looking for `Download PDF`, `View PDF`, or `PDF`.
5. Reuse the same tab after the user completes a verification step instead of opening repeated new tabs.
6. Avoid retry loops. One failed automatic attempt is enough before handing the page to the user.

When a publisher verification page appears:

1. Stop automated actions on that tab.
2. Record the paper in `publisher_verification.tsv` or the main manifest with status `publisher_verification_waiting_user`; use `sciencedirect_robot_check` for ScienceDirect's "Are you a robot?" page.
3. Tell the user which paper and tab need manual attention.
4. Do not click CAPTCHA, Cloudflare, "Are you a robot?", bot-check, or similar challenge controls automatically.
5. After the user says the verification is complete, continue from the same tab and try the visible article/PDF route once.
6. If verification immediately reappears, mark `do_not_auto_retry` and move on.

### ScienceDirect / Elsevier Field-Tested Workflow

ScienceDirect can show a "please wait" interstitial after CDP navigation. That page is not always a CAPTCHA. First wait briefly and inspect visible text: only treat it as `sciencedirect_robot_check` when it actually shows "Are you a robot?", CAPTCHA, Cloudflare, or another verification challenge.

For Elsevier papers, a practical workflow is:

1. Resolve institutional access once per browser session. From an article page, use "Access through Zhejiang University" or the Shibboleth handoff to ZJU CAS if needed.
2. After successful access, authenticated article pages often show `Brought to you by: Zhejiang University Library`.
3. For a modest manual-attention batch, open the remaining Elsevier DOI/article tabs, then notify the user that those tabs need manual clicks. The user handles interstitials, CAPTCHA, CAS, or "Access through Zhejiang University" buttons.
4. After the user confirms, scan tabs for article pages containing both `Brought to you by` and `Zhejiang`.
5. Find the main article `View PDF` link carefully. ScienceDirect pages may contain reference-section `View PDF` links far down the page. Normalize whitespace with `a.textContent.replace(/\s/g, " ").trim() === "View PDF"`, then prefer the link nearest the top toolbar or matching the article PII.
6. When the user clicks `View PDF`, Chrome may open a new `pdf.sciencedirectassets.com` tab with a time-limited signed PDF URL. Download from that PDF tab with `fetch(location.href, { credentials: "include" })` and close the PDF tab after success.
7. If the PDF tab returns `Failed to fetch`, the signed URL may have expired. Ask the user to re-click `View PDF` on the article tab.

This is still a human-in-the-loop workflow. Do not automate CAPTCHA, bot checks, or security prompts, and do not open very large ScienceDirect batches.

Create or update `publisher_verification.tsv` when publisher checks interrupt a batch. Use this header:

```text
id	project	title	doi	year	venue	publisher	status	source_url	current_url	next_action	notes
```

Suggested `next_action` values:

```text
user_complete_publisher_verification
retry_same_tab_after_user_confirms
try_summon_route
try_authorized_oa_route
mark_do_not_auto_retry
```

PowerShell example for opening a Summon URL safely:

```powershell
$node = "$env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe"
& $node "$env:USERPROFILE\.claude\skills\zju-literature-downloader\scripts\cdp_open_url.mjs" `
  --url "https://zju.summon.serialssolutions.com/search?#!/search?pn=1&ho=t&include.ft.matches=f&l=en&q=10.1021%2Facs.biomac.4c00102" `
  --wait
```

## CAS SSO Handoff and Retry

Some publishers, especially Elsevier/ScienceDirect, Springer Nature, Nature Portfolio, Wiley, Taylor & Francis, Cell Press, and society platforms routed through Shibboleth/OpenAthens, may redirect to Zhejiang University CAS even when WebVPN is open. This is not a reason to ask for the user's password.

When a paper reaches a CAS or institutional SSO page:

1. Stop automated actions on that tab.
2. Record the paper in `cas_retry.tsv` with status `cas_waiting_user`.
3. Tell the user exactly which tab/page needs attention, for example: "This paper is at ZJU CAS. If Chrome has already filled the account and password, I can click the login/confirm button once with your authorization; otherwise please complete it in Chrome."
4. Do not read, store, or request the password, QR result, OTP, SMS code, CAPTCHA, cookie, or local/session storage.
5. If the user explicitly authorizes clicking because the CAS credentials are already filled in Chrome, click only the visible ZJU CAS/WebVPN/institutional SSO login/confirm button once. Do not type into fields or inspect hidden credential values.
6. If QR login, SMS/OTP, CAPTCHA, Cloudflare, or publisher bot verification appears, stop and let the user complete it manually.
7. After the login/confirm step completes, refresh or continue from the same tab.
8. Re-detect whether the page is now a publisher article page, a PDF viewer, or another institutional handoff.
9. If resolved, download and verify the PDF/SI, then update the manifest status to `downloaded` or `downloaded_with_si`.
10. If it loops back to CAS after a completed user login, record `failed_after_retry` with the observed reason and move on.

Known ZJU CAS details observed during use:

- The CAS page may be on `zjuam.zju.edu.cn`.
- Common fields include `id="username"`, `id="password"`, and sometimes `id="authcode"`.
- The `authcode` field is a manual verification step; do not attempt to solve or fill it.
- Chrome does not reliably expose or autofill ZJU CAS credentials in a way the agent can depend on. If the login button click does not advance within about 15 seconds, stop and let the user finish the login manually.

### Safe CAS Auto-Confirm

The agent may click a ZJU CAS saved-login confirmation button only when all conditions are true:

```text
1. The page is on an expected institutional domain such as zjuam.zju.edu.cn, webvpn.zju.edu.cn, libweb.zju.edu.cn, or an institution-redirect page reached from Summon/publisher access.
2. The user has explicitly authorized this action in the current conversation, for example: "可以点浙大 CAS 登录按钮".
3. The visible action is clearly a login/confirm/continue button, such as 登录, 登 录, 确认登录, 继续登录, Continue, Proceed, or Sign in.
4. There is no visible CAPTCHA, Cloudflare challenge, QR-only login, SMS/OTP field, push-approval prompt, password reset prompt, consent-to-share-new-data prompt, or account/security warning.
5. The agent does not read, reveal, copy, store, type, or modify credentials.
```

If any condition is unclear, pause and ask the user to handle that tab. Do not repeatedly click login; one click is enough to test whether the saved-login state works.

Create or update `cas_retry.tsv` whenever CAS blocks a batch. Use this header:

```text
id	project	title	doi	year	venue	publisher	failure_stage	status	source_url	current_url	next_action	notes
```

Suggested `next_action` values:

```text
user_complete_cas_in_chrome
retry_same_tab_after_user_confirms
repair_url_by_doi
inspect_summon_alternative_links
mark_no_authorized_pdf
```

For a CAS retry batch, process one or a few tabs at a time. Do not open many CAS/login tabs in parallel; it can confuse the user's session and increase publisher or SSO risk.

## User Notification

When the user needs to intervene for CAS login, CAPTCHA, publisher verification, or expired ScienceDirect PDF links, give a clear chat update and, when a local notification helper exists, use it to get the user's attention.

Known local helper used during testing:

```powershell
powershell -ExecutionPolicy Bypass -File "D:\claude+codexwork\notify.ps1" "Title" "Message text"
```

If the helper is absent, continue with normal chat updates. Do not make notifications a hard dependency of the skill.

## Download PDF From Browser Context

Use the bundled script when a PDF URL opens in Chrome but direct shell download returns `403`, `401`, Cloudflare HTML, or a login page.

```powershell
$node = "$env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe"
& $node "$env:USERPROFILE\.agents\skills\zju-literature-downloader\scripts\browser_pdf_downloader.mjs" `
  --url "https://pubs.acs.org/doi/pdf/10.1021/acs.biomac.4c00102" `
  --out "D:\path\paper.pdf"
```

The script:

- Opens the URL in the user's controlled Chrome session unless `--target` is provided.
- Runs `fetch(location.href, { credentials: "include" })` inside the page.
- Transfers bytes in chunks through the local CDP proxy.
- Writes the binary file to disk.
- Verifies the `%PDF` signature by default.

Useful options:

```text
--url <url>          PDF URL to open and save
--target <targetId>  Existing Chrome target/tab id to use
--out <path>         Output PDF path
--proxy <url>        CDP proxy URL, default http://127.0.0.1:3456
--close              Close the tab after download if the script opened it
--allow-non-pdf      Save even when content does not start with %PDF
```

### Page-Context Fetch Pattern

For cases where the bundled script is not flexible enough, use the same idea directly in the authenticated tab:

```javascript
const init = await proxyEval(targetId, `(async()=>{
  const r = await fetch("${pdfUrl}", { credentials: "include" });
  const ab = await r.arrayBuffer();
  window.__zjuPdfBytes = new Uint8Array(ab);
  return {
    ok: r.ok,
    ct: r.headers.get("content-type"),
    n: window.__zjuPdfBytes.length,
    head: Array.from(window.__zjuPdfBytes.slice(0, 8))
  };
})()`);

const head = Buffer.from(init.value.head).toString("ascii");
if (!head.startsWith("%PDF")) throw new Error("Not a PDF response");
```

Then transfer `window.__zjuPdfBytes` in chunks through `/eval`. This pattern is useful for Wiley same-origin `pdfdirect` links and ScienceDirect signed PDF tabs.

## Supporting Information

Always try to download supporting information when the user wants complete reading.

Preferred method:

1. Open the article landing page, not only the PDF page.
2. Extract all links with text or href matching:
   - `Supporting Information`
   - `Supplementary`
   - `Supplemental`
   - `/doi/suppl/`
   - `/suppl_file/`
   - `_si_`
   - `_mmc`
   - `appendix`
3. Download every PDF/DOCX/XLSX/video/data file that is clearly a legitimate supplement, using the browser context if needed.

ACS fallback pattern, only after verifying the DOI and article page:

```text
https://pubs.acs.org/doi/suppl/<DOI>/suppl_file/<journal-code>_si_001.pdf
```

For example, the verified test case used:

```text
https://pubs.acs.org/doi/suppl/10.1021/acs.biomac.4c00102/suppl_file/bm4c00102_si_001.pdf
```

Do not invent supplement URLs as facts. If a guessed URL returns 404, record "not found" and inspect the article page.

For Elsevier/ScienceDirect, supporting files may use `_mmc` naming or appear as multimedia components on the article page. For RSC, supporting links often contain `suppdata`, but the main PDF may still be unavailable through institutional access.

## Verification and Reading

After downloading, verify every file.

For PDFs:

```powershell
$env:PYTHONUTF8='1'
python -X utf8 "$env:USERPROFILE\.claude\skills\zju-literature-downloader\scripts\extract_pdf_text.py" `
  --pdf "D:\path\paper.pdf" `
  --pages 3
```

This should report page count and extracted text. The script also reconfigures stdout/stderr to UTF-8 internally to reduce Windows GBK failures. If extraction fails but the PDF is valid, try PyMuPDF, OCR, or the local `pdf` skill.

On Windows, always set `PYTHONUTF8=1` and use `python -X utf8` when extracting text. If console text still displays poorly, check the JSON or metadata output first; the PDF may be valid even when terminal rendering is not.

Minimum verification checklist:

- File exists and size is plausible.
- First bytes are `%PDF` for PDF files.
- Page count is nonzero.
- Extracted text includes the article title, abstract, or supporting information title.
- Save a small manifest with DOI, title, source URL, download date, and supplement status when doing more than one paper.

## Zotero

Zotero import is useful for metadata, DOI, citation keys, and library organization, but it does not replace local PDF verification. If Zotero imports a paper, still check whether the PDF attachment is present and readable. If the user wants a project folder with full text, save PDFs explicitly to that folder.

## Naming Convention

Use readable filenames:

```text
FirstAuthor_Year_Journal_short-title.pdf
FirstAuthor_Year_Journal_short-title_SI.pdf
```

If filenames are Chinese-friendly, prefix supplements with `补充_` or otherwise make SI files visually distinct from main papers.

For project work, keep a folder like:

```text
文献自动下载/
  manifest.tsv
  PDFs/
  SupportingInformation/
  extracted_text/
```

## Failure Handling

If direct publisher navigation triggers ScienceDirect "Are you a robot?", Cloudflare, CAPTCHA, or another bot challenge:

- Do not bypass it.
- Do not auto-click the challenge.
- Record `publisher_verification_waiting_user` or `sciencedirect_robot_check`.
- Ask the user to solve it in Chrome.
- Then continue once from the same now-open page.
- If the same challenge immediately reappears, mark `do_not_auto_retry` and move on.

If shell `Invoke-WebRequest` or `curl` returns 403 but the PDF opens in Chrome:

- Use `browser_pdf_downloader.mjs`; this is the normal institutional-access case.

If a page shows publisher bot verification, CAPTCHA, Cloudflare, QR login, SMS/OTP, or another security challenge:

- Do not ask for or accept credentials in chat.
- Pause and ask the user to complete the verification in Chrome.
- Record `publisher_verification_waiting_user` in `publisher_verification.tsv`, or `sciencedirect_robot_check` for ScienceDirect.
- Continue only after the user says the browser step is complete.

If a page shows Zhejiang University CAS, unified identity authentication, Shibboleth, OpenAthens, SAML, or institutional sign-in:

- Do not ask for or accept credentials in chat.
- If the user has explicitly authorized it and Chrome has already filled the ZJU CAS fields, click the visible login/confirm button once.
- Otherwise pause and ask the user to complete the login in Chrome.
- Record `cas_waiting_user` or `cas_resolved_retry_needed` in `cas_retry.tsv` as appropriate.

If Summon shows no PDF:

- Try `在线全文`.
- Try DOI on the publisher page.
- Check open-access copies only from legitimate sources.
- Record "no authorized PDF found" rather than seeking unauthorized mirrors.

If Summon or another site opens as `about:blank`:

- Treat it as a URL-fragment/encoding problem first, especially when the original URL contains `#!`.
- Reopen through `scripts/cdp_open_url.mjs --url "<full URL>" --wait`.
- Do not paste fragment-heavy URLs unquoted into shell commands or manually concatenate them into `/new?url=...` without URL encoding.

If `curl` is unavailable:

- Use PowerShell `Invoke-WebRequest` for simple proxy checks.
- Prefer the bundled Node.js helper scripts for CDP proxy actions because Node's `URLSearchParams` preserves nested URL fragments correctly.

If the session expires:

- Ask the user to log in again through WebVPN.

Common pitfalls:

| Problem | Likely cause | Practical fix |
|---------|--------------|---------------|
| Summon opens `about:blank` | `#!` fragment stripped | Use `scripts/cdp_open_url.mjs` or `/navigate` with a fully encoded URL |
| First Summon online-full-text link does nothing | Empty `href` facet toggle | Skip empty links and retry after SPA rendering |
| Serials Solutions says IP is outside authorized range | CDP Chrome traffic is off-campus | Ask user to use RVPN/SSLVPN or another authorized network route |
| CAS auto-click does not work | Credentials not filled, authcode present, or login loop | Stop after one authorized click and ask the user to finish manually |
| Wiley fetch returns an empty object or CORS error | Wrong Wiley origin | Fetch `location.origin + "/doi/pdfdirect/<doi>?download=true"` from the authenticated article page |
| ScienceDirect `View PDF` opens the wrong article | Reference-section PDF link selected | Normalize whitespace and choose the top toolbar/main-article link |
| `pdf.sciencedirectassets.com` fetch fails | Signed S3 URL expired | Ask user to re-click `View PDF` |
| RSC PDF URL returns 404 or purchase page | No authorized access | Record `no_authorized_pdf_found` or `purchase_required` |
| Node `require()` fails inside `.mjs` | ES module context | Use `import` syntax |
| Python text extraction prints garbled Chinese | Windows console encoding | Use `PYTHONUTF8=1` and `python -X utf8` |

## Verified Test Case

This workflow was verified with:

- Title: `Innovative Use of an Injectable, Self-Healing Drug-Loaded Pectin-Based Hydrogel for Micro- and Supermicro-Vascular Anastomoses`
- DOI: `10.1021/acs.biomac.4c00102`
- Source route: ZJU Summon `PDF` link -> ACS PDF page
- Output: main PDF and ACS supporting information PDF
- Verification: main PDF 17 pages, SI PDF 31 pages, both text-readable.

Additional field-tested cases recorded from later use:

- Wiley same-origin PDF fetch: DOI `10.1002/adhm.202405260`.
- Nature Communications OA direct PDF: DOI pattern `10.1038/s41467-...`.
- Springer direct PDF after CAS/institutional access: DOI pattern `10.1007/...`.
- ScienceDirect / Elsevier: Shibboleth plus user-handled verification, then download from `pdf.sciencedirectassets.com` tabs.
