"""Pack app/dist + serve.mjs into Dockerfile.inline (no git repo needed)."""
import base64, io, os, tarfile

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "..", "app", "dist")
buf = io.BytesIO()
with tarfile.open(fileobj=buf, mode="w:gz", compresslevel=9) as t:
    t.add(os.path.join(HERE, "serve.mjs"), arcname="serve.mjs")
    t.add(DIST, arcname="dist")
b = base64.b64encode(buf.getvalue()).decode()
chunks = [b[i:i + 8000] for i in range(0, len(b), 8000)]
lines = ["FROM node:22-alpine", "WORKDIR /app"]
lines.append('RUN printf "%s" "' + chunks[0] + '" > /tmp/a.b64')
for c in chunks[1:]:
    lines.append('RUN printf "%s" "' + c + '" >> /tmp/a.b64')
lines += [
    "RUN base64 -d /tmp/a.b64 | tar -xz -C /app && rm /tmp/a.b64 && ls /app/dist",
    "ENV PORT=3000 NODE_ENV=production",
    "EXPOSE 3000",
    "HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1",
    'CMD ["node", "serve.mjs"]',
]
s = "\n".join(lines) + "\n"
open(os.path.join(HERE, "Dockerfile.inline"), "w").write(s)
print("tar.gz bytes", len(buf.getvalue()), "dockerfile bytes", len(s), "RUN chunks", len(chunks))
