#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.log(`Usage:
  node browser_pdf_downloader.mjs --url <pdf-url> --out <file.pdf> [--proxy http://127.0.0.1:3456] [--close] [--allow-non-pdf]
  node browser_pdf_downloader.mjs --target <targetId> --out <file.pdf> [--proxy http://127.0.0.1:3456]

Downloads a PDF through an already-authenticated Chrome page controlled by the web-access CDP proxy.
It does not bypass logins, CAPTCHA, Cloudflare, paywalls, or publisher restrictions.`);
}

function parseArgs(argv) {
  const args = {
    proxy: "http://127.0.0.1:3456",
    close: false,
    allowNonPdf: false,
    chunkSize: 262144,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      args.help = true;
    } else if (a === "--url") {
      args.url = argv[++i];
    } else if (a === "--target") {
      args.target = argv[++i];
    } else if (a === "--out") {
      args.out = argv[++i];
    } else if (a === "--proxy") {
      args.proxy = argv[++i].replace(/\/$/, "");
    } else if (a === "--close") {
      args.close = true;
    } else if (a === "--allow-non-pdf") {
      args.allowNonPdf = true;
    } else if (a === "--chunk-size") {
      args.chunkSize = Number(argv[++i]);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

async function httpJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(options.timeoutMs || 60000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

async function proxyGet(proxy, endpoint, params = {}, timeoutMs = 60000) {
  const u = new URL(endpoint, proxy);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return httpJson(u.toString(), { timeoutMs });
}

async function proxyEval(proxy, target, js, timeoutMs = 60000) {
  const u = new URL("/eval", proxy);
  u.searchParams.set("target", target);
  return httpJson(u.toString(), {
    method: "POST",
    body: js,
    timeoutMs,
  });
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForComplete(proxy, target, maxMs = 45000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < maxMs) {
    try {
      last = await proxyGet(proxy, "/info", { target }, 10000);
      if (last.ready === "complete") return last;
    } catch (_) {}
    await sleep(1000);
  }
  return last;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  if (!args.out) throw new Error("--out is required");
  if (!args.url && !args.target) throw new Error("Provide --url or --target");

  let target = args.target;
  let openedByScript = false;

  if (!target) {
    const created = await proxyGet(args.proxy, "/new", { url: args.url }, 60000);
    target = created.targetId;
    openedByScript = true;
    await waitForComplete(args.proxy, target);
  } else if (args.url) {
    await proxyGet(args.proxy, "/navigate", { target, url: args.url }, 60000);
    await waitForComplete(args.proxy, target);
  }

  const initJs = `(
    async () => {
      const r = await fetch(location.href, { credentials: "include" });
      const ct = r.headers.get("content-type") || "";
      const ab = await r.arrayBuffer();
      window.__zjuLiteratureDownloaderBytes = new Uint8Array(ab);
      return {
        ok: r.ok,
        status: r.status,
        contentType: ct,
        size: window.__zjuLiteratureDownloaderBytes.length,
        url: location.href,
        head: Array.from(window.__zjuLiteratureDownloaderBytes.slice(0, 8))
      };
    }
  )()`;

  const init = await proxyEval(args.proxy, target, initJs, 120000);
  const meta = init.value;
  if (!meta || !meta.ok) {
    throw new Error(`Browser fetch failed: ${JSON.stringify(meta)}`);
  }

  const headAscii = Buffer.from(meta.head || []).toString("ascii");
  if (!args.allowNonPdf && !headAscii.startsWith("%PDF")) {
    throw new Error(
      `Downloaded content is not a PDF. content-type=${meta.contentType}, head=${JSON.stringify(meta.head)}. ` +
      `If this is expected, rerun with --allow-non-pdf.`
    );
  }

  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  const stream = fs.createWriteStream(args.out);
  const size = Number(meta.size);
  for (let start = 0; start < size; start += args.chunkSize) {
    const end = Math.min(start + args.chunkSize, size);
    const chunkJs = `(
      () => {
        const bytes = window.__zjuLiteratureDownloaderBytes.slice(${start}, ${end});
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return btoa(bin);
      }
    )()`;
    const chunk = await proxyEval(args.proxy, target, chunkJs, 120000);
    stream.write(Buffer.from(chunk.value, "base64"));
  }
  await new Promise((resolve, reject) => {
    stream.end(resolve);
    stream.on("error", reject);
  });

  const saved = fs.readFileSync(args.out);
  const savedHead = saved.subarray(0, 8).toString("ascii");
  const result = {
    out: path.resolve(args.out),
    bytes: saved.length,
    contentType: meta.contentType,
    sourceUrl: meta.url,
    signature: savedHead,
    pdf: savedHead.startsWith("%PDF"),
  };
  console.log(JSON.stringify(result, null, 2));

  if (args.close && openedByScript) {
    try { await proxyGet(args.proxy, "/close", { target }, 10000); } catch (_) {}
  }
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
