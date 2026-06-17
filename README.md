# zju-literature-downloader

A Codex/Claude skill for legally downloading, retrying, and reading academic PDFs through the user's own logged-in Zhejiang University Library / WebVPN / Summon / publisher browser session.

中文简介：这是一个面向浙大图书馆/WebVPN 场景的文献下载、失败重试与全文读取 skill。它使用用户自己已经登录的 Chrome 会话，在授权范围内保存 PDF 和 supporting information，并对文件做页数、PDF 签名和文本可读性验证。适合“网页里能打开 PDF，但命令行下载 403/401/登录页”“CAS SSO 中断批量下载”“ScienceDirect/出版商人机验证后需要继续同一页下载”的情况。

中文快速使用教程：

1. 先在自己的 Chrome 里打开浙大图书馆或 WebVPN，并用自己的账号登录。
   - 常用入口：`https://libweb.zju.edu.cn/`
   - WebVPN：`https://webvpn.zju.edu.cn/`
   - 求是学术搜索 / Summon：`https://zju.summon.serialssolutions.com/`
2. 确认这个 Chrome 里能正常访问目标文献页面，最好能手动打开一次 PDF 或“在线全文”。
3. 在 Chrome 地址栏打开 `chrome://inspect/#remote-debugging`，勾选 `Allow remote debugging for this browser instance`。
4. 告诉 Codex/Claude 你的文献清单，例如 DOI、题目或 PMID，并说明输出文件夹。
5. agent 会通过你已经登录的 Chrome 会话检索、打开 PDF、保存主文和补充材料，并生成下载记录。
6. 如果网页要求验证码、Cloudflare、人机验证、扫码、短信/OTP 或二次认证，需要你本人在 Chrome 里完成；agent 不绕过这些验证，也不自动点击出版商的人机验证。
7. 推荐小批量使用：一次 5-10 篇比较稳，最多 15-20 篇，并保留 manifest 记录。不要用它批量扫关键词结果、整期杂志或大量连续下载。
8. 如果 Claude Code 没有自动识别这个 skill，把仓库安装到 `%USERPROFILE%\.claude\skills\zju-literature-downloader`，然后重启或刷新 Claude Code。
9. 如果遇到浙大统一身份认证 / CAS SSO，不要把账号密码发给 agent。若 Chrome 已经自动填好账号密码，你可以明确授权 agent 只点一次“登录/确认登录”；若出现扫码、短信/OTP、验证码、人机验证或安全提示，则需要你自己在 Chrome 里完成。
10. 如果遇到 ScienceDirect 的 `Are you a robot?` 或其它出版商验证，让 agent 停在当前 tab，自己手动完成验证后再让 agent 从同一个页面继续。不要让 agent 反复刷新、随机点击或并发打开很多页。

可以这样对 agent 说：

```text
请使用 zju-literature-downloader，通过我已经登录的浙大图书馆/WebVPN Chrome 会话，下载下面这些 DOI 的 PDF 和补充材料，并生成 manifest。
```

## What It Solves

- ZJU Library / WebVPN can open a paper, but direct `curl` or `Invoke-WebRequest` returns 403.
- A DOI/title list needs small-batch PDF and supporting information collection.
- CAS SSO interrupts a batch and the failed papers need to be retried after the user manually authenticates in Chrome.
- ScienceDirect or publisher verification interrupts a batch and needs manual browser handoff before retrying the same tab.
- The user wants a manifest recording DOI, source URL, download status, SI status, and local paths.
- PDFs need to be verified before an agent reads, summarizes, or cites them.
- Zotero can import metadata, but the user still wants local project-folder PDFs.

## Boundaries

This skill only uses user-authorized institutional access.

It does not bypass paywalls, CAPTCHA, Cloudflare, two-factor authentication, publisher bot checks, DRM, or account restrictions. If a page asks for CAPTCHA, QR login, SMS/OTP, Cloudflare, "Are you a robot?", or publisher bot verification, the user must complete it in Chrome.

Do not paste school account passwords, CAS passwords, SMS codes, OTP codes, QR login results, cookies, or session tokens into chat. The intended workflow is browser handoff: the agent opens the page, the user completes authentication in Chrome, and the agent resumes after the user confirms. If the ZJU CAS page is already filled by Chrome's password manager and you explicitly authorize it, the agent may click the visible login/confirm button once without reading or typing credentials.

Small batches are supported when the user provides a definite DOI/title/PMID list. Avoid broad keyword-result scraping, whole-issue downloads, large automated runs, repeated challenge retries, or parallel ScienceDirect tab bursts.

## Preconditions

Before using the skill:

1. Chrome is open.
2. The user has personally logged in to Zhejiang University Library / WebVPN / Summon in Chrome.
3. Chrome remote debugging is enabled at `chrome://inspect/#remote-debugging`.
4. The user has checked `Allow remote debugging for this browser instance`.
5. Node.js 22+ is available, or the Codex bundled Node runtime is available.
6. The `web-access-main` CDP proxy skill is installed.
7. The user has approved the target output folder.

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

1. verify Chrome/WebVPN/remote-debugging prerequisites;
2. search ZJU Summon by DOI or exact title;
3. open the authorized PDF link in Chrome;
4. download bytes from the authenticated browser page context;
5. check supporting information links;
6. verify each file as a readable PDF or document;
7. record all results in a manifest.

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

- Summon URLs often contain `#!`. If that nested URL is passed through another URL without encoding, the fragment can be stripped and Chrome may open `about:blank` or the wrong page. Prefer `scripts/cdp_open_url.mjs` for Summon and other fragment-heavy URLs.

## Helper Scripts

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
