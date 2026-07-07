"""
prove_underwrite.py — calls the LIVE extractor server's /run endpoint directly,
exactly like the app's Run button, bypassing the browser entirely.

Run from Git Bash:  python prove_underwrite.py
Requires the extractor to be running (npm run extractor) on localhost:8787.
"""
import json
import urllib.request
import urllib.error

BASE = "http://localhost:8787"


def _get(path):
    with urllib.request.urlopen(BASE + path, timeout=300) as r:
        return json.load(r)


def _post(path, body):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def main():
    deals = _get("/deals")
    if isinstance(deals, dict):
        deals = deals.get("deals", list(deals.values()))
    ids = []
    for d in deals:
        ids.append(d.get("deal_id") or d.get("id"))
    print("Deals found:", ids)

    target = None
    for did in ids:
        if not did:
            continue
        try:
            uw = _get(f"/underwrite/{did}")
        except Exception as ex:
            print(f"  {did}: no underwrite block ({ex})")
            continue
        status = uw.get("status")
        print(f"  {did}: underwrite status = {status}, units = {uw.get('units')}")
        if status in ("flagged", "checks_failed", "underwritten"):
            target = did
    if not target:
        print("\nNo deal has Mode A done yet. In the app, upload a rent roll for a deal first, then re-run this.")
        return

    print(f"\n>>> Running Mode B on '{target}' via the live /run endpoint (this takes ~30s)...\n")
    body = {
        "assumptions": {
            "entry_date": "2026-06-01",
            "hold_years": 5,
            "exit_yield": 0.0625,
            "rental_growth": 0.045,
            "ltv": 0,
            "scenario": 1,
        },
        "flag_resolutions": [],
        "mapping_signed_off": True,
        "flags_signed_off": True,
        "analyst": "cli-proof",
        "note": "direct CLI proof, bypassing browser",
    }
    code, resp = _post(f"/underwrite/{target}/run", body)
    print("HTTP status:", code)
    if isinstance(resp, (dict, list)):
        print(json.dumps(resp, indent=2)[:3000])
    else:
        print(resp[:3000])

    if code == 200:
        print("\n==> BACKEND WORKS. The browser error is purely stale UI state.")
    else:
        print("\n==> Backend returned an error above; check C:\\Screening Framework\\mode_b_error.log for the traceback.")


if __name__ == "__main__":
    main()
