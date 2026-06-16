# zju-literature-downloader

A Codex/Claude skill for legally downloading and reading academic PDFs through the user's own logged-in Zhejiang University Library / WebVPN / Summon / publisher browser session.

中文简介：这是一个面向浙大图书馆/WebVPN 场景的文献下载与全文读取 skill。它使用用户自己已经登录的 Chrome 会话，在授权范围内保存 PDF 和 supporting information，并对文件做页数、PDF 签名和文本可读性验证。适合“网页里能打开 PDF，但命令行下载 403/401/登录页”的情况。

## What It Solves

- ZJU Library / WebVPN can open a paper, but direct `curl` or `Invoke-WebRequest` returns 403.
- A DOI/title list needs small-batch PDF and supporting information collection.
- The user wants a manifest recording DOI, source URL, download status, SI status, and local paths.
- PDFs need to be verified before an agent reads, summarizes, or cites them.
- Zotero can import metadata, but the user still wants local project-folder PDFs.

## Boundaries

This skill only uses user-authorized institutional access.

It does not bypass paywalls, CAPTCHA, Cloudflare, school login, two-factor authentication, publisher bot checks, DRM, or account restrictions. If a page asks for verification, the user must complete it in Chrome.

Small batches are supported when the user provides a definite DOI/title/PMID list. Avoid broad keyword-result scraping, whole-issue downloads, or large automated runs.

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

Manual Claude/Agents-style installation:

```powershell
git clone https://github.com/baihe26/zju-literature-downloader.git "$env:USERPROFILE\.agents\skills\zju-literature-downloader"
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

## Helper Scripts

Download a PDF that opens in Chrome but fails from shell:

```powershell
$node = "$env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe"
& $node "$env:USERPROFILE\.codex\skills\zju-literature-downloader\scripts\browser_pdf_downloader.mjs" `
  --url "https://pubs.acs.org/doi/pdf/10.1021/acs.biomac.4c00102" `
  --out "D:\papers\paper.pdf" `
  --close
```

Extract and verify PDF text:

```powershell
$env:PYTHONUTF8='1'
python -X utf8 "$env:USERPROFILE\.codex\skills\zju-literature-downloader\scripts\extract_pdf_text.py" `
  --pdf "D:\papers\paper.pdf" `
  --pages 3
```

## Batch Manifest

For multi-paper work, create a manifest with at least:

```text
id	title	doi	year	venue	status	pdf_path	si_status	si_paths	source_url	notes
```

Keep the batch small and auditable. Stop when login, CAPTCHA, WebVPN expiry, publisher security checks, or suspicious download prompts appear.

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
│   └── manifest-template.tsv
└── scripts/
    ├── browser_pdf_downloader.mjs
    └── extract_pdf_text.py
```

## Verified Test Case

The workflow has been verified with:

- Title: `Innovative Use of an Injectable, Self-Healing Drug-Loaded Pectin-Based Hydrogel for Micro- and Supermicro-Vascular Anastomoses`
- DOI: `10.1021/acs.biomac.4c00102`
- Route: ZJU Summon `PDF` link -> ACS PDF page
- Result: main PDF and ACS supporting information PDF
- Verification: main PDF 17 pages, SI PDF 31 pages, both text-readable

