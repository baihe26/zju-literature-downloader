#!/usr/bin/env node
function usage() {
  console.log(`Usage:
  node cdp_open_url.mjs --url <url> [--proxy http://127.0.0.1:3456] [--wait]

Opens a URL in the already-authorized Chrome CDP proxy.
This helper URL-encodes nested URLs correctly, which matters for Summon URLs containing #!.
It does not read cookies, passwords, local storage, or browser profiles.`);
}

function parseArgs(argv) {
  const args = {
    proxy: "http://127.0.0.1:3456",
    wait: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--url") args.url = argv[++i];
    else if (a === "--proxy") args.proxy = argv[++i].replace(/\/$/, "");
    else if (a === "--wait") args.wait = true;
    else throw new Error(`Unknown argument: ${a}`);
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
  if (!args.url) throw new Error("--url is required");

  const created = await proxyGet(args.proxy, "/new", { url: args.url }, 60000);
  const target = created.targetId;
  const info = args.wait ? await waitForComplete(args.proxy, target) : await proxyGet(args.proxy, "/info", { target }, 10000);
  console.log(JSON.stringify({
    targetId: target,
    title: info?.title || null,
    url: info?.url || null,
    ready: info?.ready || null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
