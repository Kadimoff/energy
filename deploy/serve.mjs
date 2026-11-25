// Static SPA server for energy.munsif.im (zero dependencies)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

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

async function send(res, file, cache, status = 200) {
  const body = await readFile(file);
  res.writeHead(status, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": cache, ...SEC });
  res.end(body);
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
        return send(res, file, immutable ? "public, max-age=31536000, immutable" : "no-cache");
      }
    }
    if (p.startsWith("/assets/")) { res.writeHead(404, SEC); return res.end("not found"); }
    return send(res, join(ROOT, "index.html"), "no-cache");
  } catch {
    res.writeHead(500); res.end("error");
  }
}).listen(PORT, "0.0.0.0", () => console.log("smart-energy on", PORT));
