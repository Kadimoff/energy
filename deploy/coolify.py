"""Coolify helper for energy.munsif.im: create | update | deploy | get | status <deployment_uuid>."""
import base64, json, os, sys, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
T = open(os.path.expanduser("~/.hermes/secrets/coolify.env")).read().strip().split("=")[-1].strip()
API = "http://127.0.0.1:8000/api/v1"
SERVER = "uz8qmf3taz6yyuojrvkhm5x7"
UUID_FILE = os.path.join(HERE, ".app_uuid")


def call(p, m="GET", body=None):
    r = urllib.request.Request(API + p, method=m, headers={"Authorization": "Bearer " + T, "Content-Type": "application/json", "Accept": "application/json"},
                               data=json.dumps(body).encode() if body is not None else None)
    try:
        raw = urllib.request.urlopen(r).read().decode() or "{}"
        return json.JSONDecoder().raw_decode(raw)[0]
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:800]); sys.exit(1)


def dockerfile_b64():
    return base64.b64encode(open(os.path.join(HERE, "Dockerfile.inline")).read().encode()).decode()


cmd = sys.argv[1]
if cmd == "create":
    proj = call("/projects", "POST", {"name": "Smart Industry Energy", "description": "energy.munsif.im - sənaye enerji və karbon dashboard demo"})
    print("project", proj.get("uuid"))
    app = call("/applications/dockerfile", "POST", {"project_uuid": proj["uuid"], "server_uuid": SERVER, "environment_name": "production",
               "dockerfile": dockerfile_b64(), "name": "smart-energy", "ports_exposes": "3000", "domains": "https://energy.munsif.im", "instant_deploy": False})
    print("app", app.get("uuid")); open(UUID_FILE, "w").write(app["uuid"])
    print(call(f"/applications/{app['uuid']}", "PATCH", {"ports_exposes": "3000"}))
elif cmd == "create-github":
    proj = call("/projects", "POST", {"name": "Smart Industry Energy", "description": "energy.munsif.im - sənaye enerji və karbon dashboard demo"})
    print("project", proj.get("uuid"))
    app = call("/applications/private-github-app", "POST", {"project_uuid": proj["uuid"], "server_uuid": SERVER, "environment_name": "production",
               "github_app_uuid": "njcwsqxmdxnrcqvkljb3brxa", "git_repository": "Kadimoff/energy", "git_branch": "main",
               "build_pack": "dockerfile", "dockerfile_location": "/Dockerfile", "ports_exposes": "3000", "name": "energy",
               "domains": "https://energy.munsif.im", "instant_deploy": False})
    print("app", app.get("uuid")); open(UUID_FILE, "w").write(app["uuid"])
    print(call(f"/applications/{app['uuid']}", "PATCH", {"ports_exposes": "3000", "is_auto_deploy_enabled": True}))
elif cmd == "update":
    u = open(UUID_FILE).read().strip()
    print(call(f"/applications/{u}", "PATCH", {"dockerfile": dockerfile_b64()}))
elif cmd == "deploy":
    u = open(UUID_FILE).read().strip()
    print(call(f"/deploy?uuid={u}&force=false", "POST"))
elif cmd == "get":
    u = open(UUID_FILE).read().strip(); a = call(f"/applications/{u}")
    print({k: a.get(k) for k in ["uuid", "name", "status", "fqdn", "build_pack", "ports_exposes"]})
elif cmd == "status":
    d = call(f"/deployments/{sys.argv[2]}")
    print(d.get("status"))
