// Static SPA server for energy.munsif.im (zero dependencies)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { brotliCompressSync, gzipSync, constants as Z } from "node:zlib";

const ROOT = new URL("./dist/", import.meta.url).pathname;
const PORT = Number(process.env.PORT || 3000);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};
const SEC = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self'",
};

// Text assets are compressed once per file version (brotli, else gzip) and kept in memory.
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".svg", ".txt", ".webmanifest"]);
const packed = new Map();

function pickEncoding(req) {
  const ae = String(req.headers["accept-encoding"] || "");
  return /\bbr\b/.test(ae) ? "br" : /\bgzip\b/.test(ae) ? "gzip" : null;
}

async function send(req, res, file, cache, status = 200) {
  const ext = extname(file);
  const headers = { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": cache, ...SEC };
  const enc = COMPRESSIBLE.has(ext) ? pickEncoding(req) : null;
  let body;
  if (enc) {
    const { mtimeMs, size } = await stat(file);
    const key = `${enc}:${file}:${mtimeMs}:${size}`;
    body = packed.get(key);
    if (!body) {
      const raw = await readFile(file);
      body = enc === "br"
        ? brotliCompressSync(raw, { params: { [Z.BROTLI_PARAM_QUALITY]: 9, [Z.BROTLI_PARAM_SIZE_HINT]: raw.length } })
        : gzipSync(raw, { level: 9 });
      packed.set(key, body);
    }
    headers["Content-Encoding"] = enc;
    headers["Vary"] = "Accept-Encoding";
  } else body = await readFile(file);
  headers["Content-Length"] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === "HEAD" ? undefined : body);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/healthz") { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("ok"); }
    const p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const file = join(ROOT, p);
    if (file.startsWith(ROOT)) {
      const s = await stat(file).catch(() => null);
      if (s && s.isFile()) {
        const immutable = p.startsWith("/assets/");
        return send(req, res, file, immutable ? "public, max-age=31536000, immutable" : "no-cache");
      }
    }
    if (p.startsWith("/assets/")) { res.writeHead(404, SEC); return res.end("not found"); }
    return send(req, res, join(ROOT, "index.html"), "no-cache");
  } catch {
    res.writeHead(500); res.end("error");
  }
}).listen(PORT, "0.0.0.0", () => console.log("smart-energy on", PORT));
