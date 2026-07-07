"""
Small-team session auth for the deal-pipeline server.

Design goals:
  * OPT-IN. If APP_USERS is unset/empty, auth is disabled and every request passes
    through — the local `npm run app` dev flow is unchanged (acceptance criterion).
  * When APP_USERS is set, a signed session cookie gates every route except the
    login page and health checks. HTTPS is terminated by the platform (Railway).

APP_USERS format (one entry per user, comma-separated):
    APP_USERS="viktor:$2b$12$abc...,colleague:$2b$12$def..."
Generate a hash for a user:
    python -m extractor.auth hash 'their-password'   ->  prints  user:hash  line to paste

SESSION_SECRET signs the cookie (set a long random value in prod). LOGIN_MAX_ATTEMPTS
per LOGIN_WINDOW_SECONDS rate-limits failed logins per client IP.
"""

import os
import sys
import time
import secrets
from typing import Dict, List, Optional

from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse, PlainTextResponse

# bcrypt + itsdangerous are imported lazily (inside the functions that need them) so
# that this module — and the server — load fine in dev when APP_USERS is unset and the
# deps aren't installed. They are required (and pinned in requirements.txt) for prod.

COOKIE_NAME = "sf_session"
SESSION_MAX_AGE = 7 * 24 * 3600  # 7 days

# Paths reachable without a session (prefix match for the first two).
_EXEMPT_PREFIXES = ("/static/", "/assets/")
_EXEMPT_EXACT = {"/login", "/logout", "/healthz", "/health", "/favicon.ico"}


def _load_users() -> Dict[str, str]:
    """Parse APP_USERS into {username: bcrypt_hash}. Empty dict => auth disabled."""
    raw = os.environ.get("APP_USERS", "").strip()
    users: Dict[str, str] = {}
    if not raw:
        return users
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry or ":" not in entry:
            continue
        name, _, pwd_hash = entry.partition(":")
        name, pwd_hash = name.strip(), pwd_hash.strip()
        if name and pwd_hash:
            users[name] = pwd_hash
    return users


def _serializer():
    from itsdangerous import URLSafeTimedSerializer
    secret = os.environ.get("SESSION_SECRET")
    if not secret:
        # Ephemeral secret: fine when auth is disabled; warn if it's actually in use.
        secret = secrets.token_urlsafe(32)
        if os.environ.get("APP_USERS", "").strip():
            print(
                "[auth] WARNING: SESSION_SECRET not set — using an ephemeral secret; "
                "sessions will not survive a restart. Set SESSION_SECRET in production.",
                file=sys.stderr,
            )
    return URLSafeTimedSerializer(secret, salt="sf-session")


def verify_password(password: str, pwd_hash: str) -> bool:
    import bcrypt
    try:
        return bcrypt.checkpw(password.encode("utf-8"), pwd_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def hash_password(password: str) -> str:
    import bcrypt
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


class _RateLimiter:
    """In-memory failed-login limiter, per client IP."""

    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window = window_seconds
        self._hits: Dict[str, List[float]] = {}

    def blocked(self, key: str) -> bool:
        now = time.monotonic()
        hits = [t for t in self._hits.get(key, []) if now - t < self.window]
        self._hits[key] = hits
        return len(hits) >= self.max_attempts

    def record_failure(self, key: str) -> None:
        self._hits.setdefault(key, []).append(time.monotonic())

    def reset(self, key: str) -> None:
        self._hits.pop(key, None)


_LOGIN_HTML = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in — Brunswick Screening Framework</title>
<style>
  :root {{ --brand:#7D5A7D; --brand-dark:#664766; --ink:#1F1F1F; --muted:#6B6B76;
           --bg:#F7F6F8; --line:#E6DCE6; --danger:#C53030; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:var(--bg); color:var(--ink);
         font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }}
  .card {{ width:360px; background:#fff; border:1px solid var(--line); border-radius:12px;
          box-shadow:0 1px 3px rgba(31,31,31,.08); padding:32px; }}
  .brand {{ font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:.08em;
           color:var(--brand); margin-bottom:4px; }}
  h1 {{ font-size:22px; font-weight:600; margin:0 0 20px; }}
  label {{ display:block; font-size:11px; font-weight:600; text-transform:uppercase;
          letter-spacing:.05em; color:var(--muted); margin:14px 0 6px; }}
  input {{ width:100%; padding:10px 12px; font-size:14px; border:1px solid var(--line);
          border-radius:8px; outline:none; }}
  input:focus {{ border-color:var(--brand); box-shadow:0 0 0 3px rgba(125,90,125,.15); }}
  button {{ width:100%; margin-top:22px; padding:11px; font-size:14px; font-weight:600;
           color:#fff; background:var(--brand); border:none; border-radius:8px; cursor:pointer; }}
  button:hover {{ background:var(--brand-dark); }}
  .err {{ margin-top:16px; padding:9px 12px; font-size:13px; color:var(--danger);
         background:#FDECEC; border:1px solid #F5C6C6; border-radius:8px; }}
</style></head>
<body>
  <form class="card" method="post" action="/login">
    <div class="brand">Brunswick</div>
    <h1>Screening Framework</h1>
    <input type="hidden" name="next" value="{next}">
    <label for="u">Username</label>
    <input id="u" name="username" autocomplete="username" autofocus required>
    <label for="p">Password</label>
    <input id="p" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">Sign in</button>
    {error}
  </form>
</body></html>"""


def _render_login(next_url: str, error: Optional[str] = None) -> HTMLResponse:
    # Minimal escaping for the reflected next param.
    safe_next = (next_url or "/").replace('"', "%22").replace("<", "").replace(">", "")
    err_html = f'<div class="err">{error}</div>' if error else ""
    return HTMLResponse(_LOGIN_HTML.format(next=safe_next, error=err_html))


def install_auth(app) -> None:
    """Attach login/logout routes and the gate middleware to a FastAPI app.

    No-op when APP_USERS is unset: returns early without importing the auth deps,
    so the dev server runs unchanged even if bcrypt/itsdangerous aren't installed.
    """
    users = _load_users()
    if not users:
        print("[auth] APP_USERS not set — authentication DISABLED (dev mode).", file=sys.stderr)
        return

    serializer = _serializer()
    limiter = _RateLimiter(
        max_attempts=int(os.environ.get("LOGIN_MAX_ATTEMPTS", "8")),
        window_seconds=int(os.environ.get("LOGIN_WINDOW_SECONDS", "300")),
    )
    secure_cookie = os.environ.get("COOKIE_SECURE", "1") != "0"

    from itsdangerous import BadSignature, SignatureExpired

    def _valid_session(request: Request) -> bool:
        token = request.cookies.get(COOKIE_NAME)
        if not token:
            return False
        try:
            serializer.loads(token, max_age=SESSION_MAX_AGE)
            return True
        except (BadSignature, SignatureExpired):
            return False

    @app.get("/login")
    def login_page(request: Request):
        if not users:
            return RedirectResponse("/", status_code=302)
        return _render_login(request.query_params.get("next", "/"))

    @app.post("/login")
    async def login_submit(request: Request):
        if not users:
            return RedirectResponse("/", status_code=302)
        client = request.client.host if request.client else "unknown"
        if limiter.blocked(client):
            return _render_login("/", "Too many attempts. Try again in a few minutes.")
        form = await request.form()
        username = (form.get("username") or "").strip()
        password = form.get("password") or ""
        next_url = form.get("next") or "/"
        pwd_hash = users.get(username)
        if pwd_hash and verify_password(password, pwd_hash):
            limiter.reset(client)
            token = serializer.dumps({"u": username})
            resp = RedirectResponse(next_url if next_url.startswith("/") else "/", status_code=302)
            resp.set_cookie(
                COOKIE_NAME, token, max_age=SESSION_MAX_AGE, httponly=True,
                samesite="lax", secure=secure_cookie,
            )
            return resp
        limiter.record_failure(client)
        return _render_login(next_url, "Invalid username or password.")

    @app.get("/logout")
    def logout():
        resp = RedirectResponse("/login", status_code=302)
        resp.delete_cookie(COOKIE_NAME)
        return resp

    @app.middleware("http")
    async def gate(request: Request, call_next):
        if not users or request.method == "OPTIONS":
            return await call_next(request)
        path = request.url.path
        if path in _EXEMPT_EXACT or any(path.startswith(p) for p in _EXEMPT_PREFIXES):
            return await call_next(request)
        if _valid_session(request):
            return await call_next(request)
        # Browsers navigating get redirected to login; API/XHR clients get 401.
        accept = request.headers.get("accept", "")
        if "text/html" in accept:
            nxt = request.url.path
            if request.url.query:
                nxt += "?" + request.url.query
            return RedirectResponse(f"/login?next={nxt}", status_code=302)
        return PlainTextResponse("Authentication required", status_code=401)


if __name__ == "__main__":
    # Helper: python -m extractor.auth hash 'password'  ->  prints  <hash>
    if len(sys.argv) == 3 and sys.argv[1] == "hash":
        print(hash_password(sys.argv[2]))
    else:
        print("usage: python -m extractor.auth hash '<password>'", file=sys.stderr)
        sys.exit(1)
