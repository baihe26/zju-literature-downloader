---
name: zju-literature-downloader
description: Use this skill whenever the user wants to use their own logged-in Zhejiang University Library, WebVPN, 求是学术搜索, Summon, publisher, or Chrome session to legally search, download, organize, and read academic PDFs and supporting information. Trigger on requests like “用浙大图书馆下载文献”, “WebVPN 下载 PDF”, “自动下载补充材料”, “读取全文和 supporting information”, “批量整理文献到项目文件夹”, or “导入 Zotero 后帮我读全文”.
metadata:
  compatibility: Requires a local Chrome session logged in by the user, Chrome remote debugging permission, and a shell with Node.js 22+ or a bundled Node runtime. Uses only user-authorized access.
---

# ZJU Literature Downloader

This skill turns the verified workflow into a repeatable, legally scoped process for finding, downloading, and reading papers through the user's Zhejiang University Library / WebVPN access.

## Boundaries

Use only the user's legitimate institutional access. Do not bypass paywalls, DRM, CAPTCHA, Cloudflare, publisher bot checks, school authentication, or two-factor authentication. If a page asks for a login, verification, consent, CAPTCHA, or security check, stop and ask the user to complete it in Chrome.

Avoid mass downloading. Work in small batches, preferably after the user confirms the paper list. Leave a clear audit trail of what was downloaded, from where, and whether supporting information was found.

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
   - Typical path for Claude/Codex shared skills: `%USERPROFILE%\.agents\skills\web-access-main\scripts\check-deps.mjs`.
   - In Codex-only setups also check `%USERPROFILE%\.codex\skills\web-access-main\scripts\check-deps.mjs`.
6. The user has approved the target output folder.

## Batch Scope

Small batches are supported when the user provides a definite DOI/title/PMID list.

Recommended limits:

- normal batch: 5-10 papers
- upper practical batch: 15-20 papers, with pauses and a manifest
- stop immediately if publisher checks, CAPTCHA, WebVPN expiry, or unusual download prompts appear

Do not turn a broad keyword search into unlimited automatic downloading. Do not download whole journal issues, volumes, or large result sets.

## Start Chrome Control

Use the web-access CDP proxy when available.

On Windows PowerShell:

```powershell
$node = "node"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $node = "$env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe"
}
& $node "$env:USERPROFILE\.agents\skills\web-access-main\scripts\check-deps.mjs"
```

Then test:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3456/targets" -TimeoutSec 10
```

If this hangs or fails:

- Ask the user to confirm the remote debugging checkbox.
- Check `%TEMP%\cdp-proxy.log`.
- Do not attempt to read Chrome session files.

## Recommended Search Workflow

Prefer the library discovery route before direct publisher pages. It is more stable and less likely to trigger bot protection.

1. Search by DOI or exact title in ZJU Summon:
   - `https://zju.summon.serialssolutions.com/search?#!/search?pn=1&ho=t&include.ft.matches=f&l=en&q=<URL-encoded DOI or title>`
2. Read the result page with `/eval`.
3. Extract links whose visible text or `aria-label` is:
   - `PDF`
   - `在线全文`
   - `Full Text`
   - `View PDF`
   - publisher-specific full-text entries.
4. Prefer the result's `PDF` link when present.
5. Open the PDF link in a new background tab through the CDP proxy.
6. If the publisher shows a security challenge, ask the user to complete it manually.
7. Once the PDF is visible in Chrome, use `scripts/browser_pdf_downloader.mjs` to save it from the authenticated browser context.

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

## Verification and Reading

After downloading, verify every file.

For PDFs:

```powershell
python "$env:USERPROFILE\.agents\skills\zju-literature-downloader\scripts\extract_pdf_text.py" `
  --pdf "D:\path\paper.pdf" `
  --pages 3
```

This should report page count and extracted text. If extraction fails but the PDF is valid, try PyMuPDF, OCR, or the local `pdf` skill.

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

For project work, keep a folder like:

```text
文献自动下载/
  manifest.tsv
  PDFs/
  SupportingInformation/
  extracted_text/
```

## Failure Handling

If direct publisher navigation triggers Cloudflare or another bot challenge:

- Do not bypass it.
- Ask the user to solve it in Chrome.
- Then continue from the now-open page.

If shell `Invoke-WebRequest` or `curl` returns 403 but the PDF opens in Chrome:

- Use `browser_pdf_downloader.mjs`; this is the normal institutional-access case.

If Summon shows no PDF:

- Try `在线全文`.
- Try DOI on the publisher page.
- Check open-access copies only from legitimate sources.
- Record "no authorized PDF found" rather than seeking unauthorized mirrors.

If the session expires:

- Ask the user to log in again through WebVPN.

## Verified Test Case

This workflow was verified with:

- Title: `Innovative Use of an Injectable, Self-Healing Drug-Loaded Pectin-Based Hydrogel for Micro- and Supermicro-Vascular Anastomoses`
- DOI: `10.1021/acs.biomac.4c00102`
- Source route: ZJU Summon `PDF` link -> ACS PDF page
- Output: main PDF and ACS supporting information PDF
- Verification: main PDF 17 pages, SI PDF 31 pages, both text-readable.
