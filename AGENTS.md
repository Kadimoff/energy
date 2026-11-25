# Smart Industry Energy: working notes for every agent

- Full product spec: `/home/hermes/projects/smart-energy/SPEC.md` (Azerbaijani). Read it fully. It is the source of truth.
- The owner said "işə başla" and wants it live at https://energy.munsif.im. Plan approval (spec section 13) is waived: do not stop and ask, make reasonable decisions and record them in `DECISIONS.md` (append, one line each).
- App dir: `/home/hermes/projects/smart-energy/app` (Vite + React 18 + TS strict). Git repo at `/home/hermes/projects/smart-energy` (local only; never push anywhere, never touch Coolify/servers/other projects).
- Host: Linux, user `hermes`, no sudo, no docker. Node 26 + npm 12 on PATH. npm 12 skips package install scripts: if a package needs one (esbuild usually works via optionalDependencies), check it actually works.
- Pin exact versions (`--save-exact`), avoid releases younger than ~2 weeks (today is 25 Nov 2026; `npm view <pkg> time --json` to check).
- No external network at runtime: fonts self-hosted via @fontsource, no CDN, no LLM/weather/tariff APIs.
- Browser checks: puppeteer-core is installed at `/home/hermes/.hermes/tools/shotkit/node_modules/puppeteer-core`; Chrome binary `/home/hermes/.hermes/tools/chromium-1208/chrome-linux64/chrome` (a wrapper that sets LD_LIBRARY_PATH). Launch with `--no-sandbox`. Serve `vite preview` / `vite` on 127.0.0.1 only (ports 5170-5199), started with terminal background=true, and kill your own server afterwards (by PID, check `readlink /proc/PID/cwd`; never `pkill -f`).
- Screenshots go to `/home/hermes/projects/smart-energy/shots/<your-area>/`. Look at them yourself (vision) and fix what looks wrong before finishing.
- All UI text in Azerbaijani, in i18n JSON, no lorem ipsum, no "—" dashes in UI copy, sentence case, no ALL CAPS.
- Every number shown must come from mock data + `src/domain` pure functions. UI components never calculate.
- Quality gates before you report done: `npm run lint && npm run typecheck && npm test && npm run build` all green. Report the real output.
- Ownership: only edit files in your assigned area. Shared files (router, nav, i18n index, stores, domain, data source) belong to the foundation; if you need a change there, keep it additive and minimal and mention it in your report.
- Deploy (parent only): repo root `Dockerfile` builds `app/` on `node:22-alpine` with `npm ci && npm run typecheck && npm test && npm run build`, then serves `dist` via `deploy/serve.mjs` (SPA fallback, strict CSP: no inline scripts, no external origins). Keep `app/package-lock.json` committed and in sync, and keep the code working on Node 22 too. Pushes to GitHub `Kadimoff/energy` main auto-deploy to https://energy.munsif.im — subagents never push.
