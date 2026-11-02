# zju-literature-downloader

A Codex/Claude skill for legally downloading, retrying, and reading academic PDFs through the user's own logged-in Zhejiang University Library / WebVPN / Summon / publisher browser session.

中文简介：这是一个面向浙大图书馆/WebVPN 场景的文献下载、失败重试与全文读取 skill。它使用宿主支持、用户授权的已登录浏览器会话，在授权范围内保存 PDF 和 supporting information，并对文件做页数、PDF 签名和文本可读性验证。适合“网页里能打开 PDF，但命令行下载 403/401/登录页”“CAS SSO 中断批量下载”“ScienceDirect/出版商人机验证后需要继续同一页下载”的情况。

中文快速使用教程：

1. 安装本 skill，提供明确的 DOI、题目或 PMID 清单，以及已同意的输出文件夹。
2. 先让 agent 检查宿主实际支持的浏览器控制、下载与文件验证能力，确认它能使用你选择并授权的浏览器会话。需要机构访问时，由你在该浏览器中登录浙大图书馆或 WebVPN。
   - 图书馆：`https://libweb.zju.edu.cn/`；WebVPN：`https://webvpn.zju.edu.cn/`；Summon：`https://zju.summon.serialssolutions.com/`。
3. 如果现有能力可用，按宿主支持的方式检索并保存，不必额外配置 CDP。仅在选择下方 Chrome/CDP 方案时，才检查其专属依赖。
4. 页面要求 CAS、验证码、扫码、短信/OTP 或出版商验证时，在实际打开的页面由你本人完成；不要发送密码或验证码。仅当已满足安全边界，且你明确授权时，agent 可点击一次已自动填好凭据的浙大 CAS 登录/确认按钮。
5. agent 逐项验证保存文件并记录主文及补充材料状态。页面能打开或显示 PDF 并不等于文件已保存、验证成功。
6. 建议小批量处理确定的文献清单；遇到控制、保存或验证问题时，根据实际证据报告，参见 [浏览器下载恢复指南](references/browser-download-recovery.md)。不要批量扫整期杂志或反复重试验证页面。

可以这样对 agent 说：

```text
请使用 zju-literature-downloader，通过我授权的、已登录浙大图书馆/WebVPN 的浏览器会话，下载下面这些 DOI 的 PDF 和补充材料，并生成 manifest。
```

## What It Solves

- ZJU Library / WebVPN can open a paper, but direct `curl` or `Invoke-WebRequest` returns 403.
- A DOI/title list needs small-batch PDF and supporting information collection.
- CAS SSO interrupts a batch and the failed papers need to be retried after the user manually authenticates in Chrome.
- ScienceDirect or publisher verification interrupts a batch and needs manual browser handoff before retrying the same tab.
- A legitimate Chrome download works while a raw PDF URL returns 403, an HTML page, or a Windows certificate-revocation error.
- An ACS main article is restricted but its official supporting information is separately downloadable and must be tracked as SI-only rather than a completed paper.
- The user wants a manifest recording DOI, source URL, download status, SI status, and local paths.
- PDFs need to be verified before an agent reads, summarizes, or cites them.
- Zotero can import metadata, but the user still wants local project-folder PDFs.

## Boundaries

This skill only uses user-authorized institutional access.

It does not bypass paywalls, CAPTCHA, Cloudflare, two-factor authentication, publisher bot checks, DRM, or account restrictions. If a page asks for CAPTCHA, QR login, SMS/OTP, Cloudflare, "Are you a robot?", or publisher bot verification, the user must complete it in Chrome.

Do not paste school account passwords, CAS passwords, SMS codes, OTP codes, QR login results, cookies, or session tokens into chat. The intended workflow is browser handoff: the agent opens the page, the user completes authentication in Chrome, and the agent resumes after the user confirms. If the ZJU CAS page is already filled by Chrome's password manager and you explicitly authorize it, the agent may click the visible login/confirm button once without reading or typing credentials.

Small batches are supported when the user provides a definite DOI/title/PMID list. Avoid broad keyword-result scraping, whole-issue downloads, large automated runs, repeated challenge retries, or parallel ScienceDirect tab bursts.

## Preconditions

General requirements:

1. A specific paper list and a user-approved output destination.
2. Legitimate access to the requested content, with the user completing institutional or publisher authentication where required.
3. A host-supported, permitted way to inspect/control the selected authorized browser session and save files to the chosen destination; a way to verify file type, readability and identity is also needed. Check each capability independently before relying on it. An open URL, a visible PDF, or a listening port does not prove control or a verified download.
4. If control or saving is unavailable, report the observed limitation and use the supported human handoff where possible. Do not infer expired login or evade a host denial. See [browser download recovery](references/browser-download-recovery.md).

### Optional Chrome / CDP proxy route

Only when choosing the documented web-access CDP route, its requirements include a user-authorized Chrome session, Chrome remote debugging allowed for that instance (`chrome://inspect/#remote-debugging`), Node.js 22+ or a suitable bundled runtime, and an available `web-access-main` CDP proxy. Check them using [SKILL.md](SKILL.md#capability-check-before-downloads); do not install a proxy or expose a debugging endpoint merely because this route exists. The two bundled `.mjs` helpers use this proxy and are not generic browser tools. Host-native routes may have different requirements.

## Installation

With the Skills CLI:

```powershell
npx skills add baihe26/zju-literature-downloader -g
```

Manual Codex installation:

```powershell
git clone https://github.com/baihe26/zju-literature-downloader.git "$env:USERPROFILE\.codex\skills\zju-literature-downloader"
```

Manual Claude Code installation:

```powershell
git clone https://github.com/baihe26/zju-literature-downloader.git "$env:USERPROFILE\.claude\skills\zju-literature-downloader"
```

Manual Agents-style installation:

```powershell
git clone https://github.com/baihe26/zju-literature-downloader.git "$env:USERPROFILE\.agents\skills\zju-literature-downloader"
```

If the repository is already installed in `.codex\skills`, copy it into Claude's default skill directory:

```powershell
Copy-Item -Recurse -Force `
  "$env:USERPROFILE\.codex\skills\zju-literature-downloader" `
  "$env:USERPROFILE\.claude\skills\zju-literature-downloader"
```

Optional Python helpers:

```powershell
pip install -r "$env:USERPROFILE\.codex\skills\zju-literature-downloader\requirements.txt"
```

## Usage

Tell Codex/Claude something like:

```text
Use zju-literature-downloader to download these DOIs through my logged-in ZJU WebVPN session, including supporting information, and make a manifest.
```

The skill instructs the agent to:

1. Check the host's supported browser control, access, saving, and verification capabilities independently; use the selected authorized session and destination.
2. Search by DOI or exact title using the library or another legitimate source.
3. Follow an authorized article/PDF route, with human authentication when needed.
4. Save using a supported permitted route; page-context fetch is only an optional implementation.
5. Inventory requested supporting information and verify each saved file's format and identity.
6. Record separate main-PDF and SI states in the manifest; report control and transfer failures accurately.

For ScienceDirect or other sensitive publisher platforms, keep the workflow slower and more manual:

- Start from Summon / WebVPN / library `在线全文` links when possible.
- Process one publisher article at a time.
- Do not open many ScienceDirect tabs in parallel.
- Do not repeatedly refresh or retry a bot-check page.
- If verification appears, pause and ask the user to handle it in Chrome, then continue from the same tab.

## CAS / SSO Retry Workflow

Some publishers may still ask for Zhejiang University CAS / unified identity authentication after WebVPN is open. This is common with Elsevier/ScienceDirect, Springer Nature, Nature Portfolio, Wiley, Taylor & Francis, Cell Press, and other platforms that use institutional sign-in.

Recommended workflow:

1. Ask the agent to collect all CAS-blocked papers into `cas_retry.tsv`.
2. Keep these columns:

```text
id	project	title	doi	year	venue	publisher	failure_stage	status	source_url	current_url	next_action	notes
```

3. Use `cas_waiting_user` for papers currently stopped at CAS/SSO.
4. Let the agent open one or a few failed links in Chrome.
5. When the browser reaches CAS, the agent should pause.
6. If Chrome has already filled the ZJU CAS account/password and the page only needs a login/confirm click, you can explicitly authorize the agent to click that visible button once.
7. If the page asks for QR scan, SMS/OTP, CAPTCHA, Cloudflare, publisher bot verification, or a security warning, complete that step manually in Chrome.
8. Tell the agent to continue from the same tab.
9. The agent retries PDF / Full Text / Download PDF and updates the manifest.

A useful prompt:

```text
不要让我提供账号密码。请把 CAS 失败文献整理成 cas_retry.tsv，然后逐篇用已登录 Chrome 打开。遇到浙大 CAS 时，如果 Chrome 已经自动填好账号密码，可以在我授权后只点一次登录/确认登录；遇到验证码、人机验证、扫码、短信/OTP、WebVPN 重新登录或二次认证时暂停，让我手动完成认证；认证完成后继续下载 PDF 和 supporting information。URL 格式失败的文献请按 DOI 重新定位出版社页面和真实 PDF 链接。
```

Do not process many CAS tabs at once. Work in small groups so the user can clearly see which page needs authentication and so the institutional session does not get confused.

## ScienceDirect / Publisher Verification Workflow

ScienceDirect and some publisher platforms may show `Are you a robot?`, CAPTCHA, Cloudflare, or other bot-verification pages. This skill does not solve or click those challenges automatically.

Recommended workflow:

1. Ask the agent to record interrupted papers in `publisher_verification.tsv`.
2. Keep these columns:

```text
id	project	title	doi	year	venue	publisher	status	source_url	current_url	next_action	notes
```

3. Use `sciencedirect_robot_check` for ScienceDirect `Are you a robot?`.
4. Use `publisher_verification_waiting_user` for other publisher checks.
5. Let the user complete the verification in Chrome.
6. Tell the agent to continue from the same tab.
7. If the challenge immediately appears again, mark `do_not_auto_retry` and move on.

A useful prompt:

```text
请用 zju-literature-downloader 小批量下载这些 DOI。ScienceDirect 和其它出版商一次只处理一篇，优先从浙大 Summon / WebVPN / 在线全文进入。遇到 Are you a robot、Cloudflare、验证码或出版商人机验证时不要自动点击，也不要反复刷新；请记录到 publisher_verification.tsv，停在当前 tab 让我手动完成，然后从同一个页面继续下载。
```

This conservative pattern is meant to reduce unnecessary triggers and keep the user's institutional access auditable. It is not a way to bypass publisher verification.

## Claude Code / Windows Notes

Claude Code on Windows may differ from Codex in a few practical ways:

- Claude Code often discovers skills from `%USERPROFILE%\.claude\skills\`, while Codex uses `%USERPROFILE%\.codex\skills\` and some agent setups use `%USERPROFILE%\.agents\skills\`.
- If `curl` is unavailable or behaves differently, use PowerShell `Invoke-WebRequest` for simple HTTP checks, or the bundled Node.js helper scripts for CDP proxy calls.
- Keep Python output UTF-8. The helper script now reconfigures stdout/stderr to UTF-8 itself, but this command is still the safest form:

```powershell
$env:PYTHONUTF8='1'
python -X utf8 "$env:USERPROFILE\.claude\skills\zju-literature-downloader\scripts\extract_pdf_text.py" --pdf "D:\papers\paper.pdf" --pages 3
```

- Summon URLs often contain `#!`. Preserve the full URL; when using the CDP proxy, `scripts/cdp_open_url.mjs` encodes nested URLs correctly.

## Helper Scripts

The following Windows examples are **only for the optional Chrome/web-access CDP proxy route**, after its prerequisites are met. Adjust the Node and skill paths to your installation. Other supported browser tools do not require these helpers.

Open a Summon or publisher URL through the CDP proxy without losing `#!` fragments:

```powershell
$node = "$env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe"
& $node "$env:USERPROFILE\.claude\skills\zju-literature-downloader\scripts\cdp_open_url.mjs" `
  --url "https://zju.summon.serialssolutions.com/search?#!/search?pn=1&ho=t&include.ft.matches=f&l=en&q=10.1021%2Facs.biomac.4c00102" `
  --wait
```

Download a PDF that opens in Chrome but fails from shell:

```powershell
$node = "$env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe"
& $node "$env:USERPROFILE\.claude\skills\zju-literature-downloader\scripts\browser_pdf_downloader.mjs" `
  --url "https://pubs.acs.org/doi/pdf/10.1021/acs.biomac.4c00102" `
  --out "D:\papers\paper.pdf" `
  --close
```

## Field-Tested Fallbacks

### Chrome PDF viewer is readable, but the helper says `Browser fetch failed`

This is not automatically an access failure. Chrome's built-in PDF viewer can display a file while refusing page-context `fetch()` access to the viewer URL.

1. Return to the publisher article landing page.
2. Click its normal visible `Download PDF` or `View PDF` button once.
3. Configure the approved destination first and wait for the browser download to finish; do not silently use another folder or use a `.crdownload` file.
4. Verify the candidate by `%PDF` signature, nonzero page count, and extracted title/DOI before copying it to `PDFs/`.
5. Match recent downloads by modification time and content, not merely by filename: Chrome may add `(1)` to a duplicate filename.

If `curl`/`Invoke-WebRequest` returns `403`, HTML, or Windows `CRYPT_E_REVOCATION_OFFLINE`, switch to this browser path. Do not disable TLS revocation checking merely to make a shell transfer work.

### Summon does not load

Summon is a slow SPA and needs a short settle period. Retry the rendered page a few times after navigation. If a fresh navigation still yields `ERR_EMPTY_RESPONSE`, record `summon_unreachable` and try the DOI's publisher landing page or a confirmed open-access route once. A WebVPN tab does not guarantee that every new controlled tab receives the same library network route.

### ACS: distinguish article access from supporting information

An ACS abstract page may be readable while the main PDF remains `Available to Purchase` or asks for `Access through Institution`. A brief `请稍候...` page can resolve naturally; wait 5-10 seconds and inspect it once before treating it as a security challenge. For a genuine institution selector, CARSI/Shibboleth/OpenAthens, CAS, CAPTCHA, or publisher verification, stop on that page for the user.

Official ACS supporting-information links on the article page can lead to ACS Figshare / `ndownloader.figstatic.com`. Those files may be legally accessible even when the main PDF is not. Verify and save them, but classify the record as `si_only_downloaded` until the main PDF is also verified.

Extract and verify PDF text:

```powershell
$env:PYTHONUTF8='1'
python -X utf8 "$env:USERPROFILE\.claude\skills\zju-literature-downloader\scripts\extract_pdf_text.py" `
  --pdf "D:\papers\paper.pdf" `
  --pages 3
```

## Batch Manifest

For multi-paper work, create a manifest with at least:

```text
id	title	doi	year	venue	status	pdf_path	si_status	si_paths	source_url	notes
```

Keep the batch small and auditable. Stop when login, CAPTCHA, WebVPN expiry, publisher security checks, or suspicious download prompts appear.

`downloaded` means the main PDF was saved and verified. `downloaded_with_si` additionally requires all known requested SI; track unknown SI completeness separately. A displayed PDF is not a completed download, and a DOI found only in a bibliography does not prove article identity.

Useful statuses beyond `downloaded` and `downloaded_with_si`:

```text
si_only_downloaded
pdf_loading
pdf_visible_unsaved
saved_pending_verification
identity_mismatch
browser_control_unavailable
host_execution_denied
institutional_login_waiting_user
summon_unreachable
browser_pdf_viewer_fallback_needed
```

These are progress states, not generic failures. They preserve exactly what was obtained and the next lawful action.

For CAS retries, use the richer template in `examples/cas-retry-template.tsv`.

For publisher verification queues, use `examples/publisher-verification-template.tsv`.

## Repository Layout

```text
zju-literature-downloader/
├── LICENSE
├── README.md
├── requirements.txt
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   └── browser-download-recovery.md
├── examples/
│   ├── manifest-template.tsv
│   ├── cas-retry-template.tsv
│   └── publisher-verification-template.tsv
└── scripts/
    ├── browser_pdf_downloader.mjs
    ├── cdp_open_url.mjs
    └── extract_pdf_text.py
```

## Verified Test Case

The workflow has been verified with:

- Title: `Innovative Use of an Injectable, Self-Healing Drug-Loaded Pectin-Based Hydrogel for Micro- and Supermicro-Vascular Anastomoses`
- DOI: `10.1021/acs.biomac.4c00102`
- Route: ZJU Summon `PDF` link -> ACS PDF page
- Result: main PDF and ACS supporting information PDF
- Verification: main PDF 17 pages, SI PDF 31 pages, both text-readable

