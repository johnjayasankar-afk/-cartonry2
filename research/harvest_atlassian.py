#!/usr/bin/env python3
"""Harvest Atlassian Marketplace paid cloud apps (public REST API) -> JSON."""
import json, time, subprocess, sys, os

BASE = "https://marketplace.atlassian.com"
UA = {"Accept": "application/json", "User-Agent": "market-research/1.0"}

def get(path, tries=3):
    """Use curl: system Python lacks CA bundle on this machine."""
    for i in range(tries):
        try:
            r = subprocess.run(
                ["curl", "-s", "--max-time", "45", "-H", "Accept: application/json",
                 "-H", "User-Agent: market-research/1.0", BASE + path],
                capture_output=True, text=True, check=True)
            return json.loads(r.stdout)
        except Exception as e:
            if i == tries - 1:
                print(f"  FAIL {path}: {e}", file=sys.stderr); return None
            time.sleep(2 * (i + 1))

def harvest(app, limit=50, maxpages=40):
    out, offset = [], 0
    for _ in range(maxpages):
        d = get(f"/rest/2/addons?hosting=cloud&application={app}&cost=paid"
                f"&withPricingInfo=true&limit={limit}&offset={offset}")
        if not d: break
        addons = d.get("_embedded", {}).get("addons", [])
        if not addons: break
        for a in addons:
            emb = a.get("_embedded", {})
            dist = emb.get("distribution", {}) or {}
            rev = emb.get("reviews", {}) or {}
            vend = emb.get("vendor", {}) or {}
            out.append({
                "app": app,
                "name": a.get("name"),
                "key": a.get("key"),
                "tagLine": a.get("tagLine"),
                "summary": (a.get("summary") or "")[:400],
                "installs": dist.get("totalInstalls"),
                "downloads": dist.get("downloads"),
                "reviewCount": rev.get("count"),
                "stars": rev.get("averageStars"),
                "categories": [c.get("name") for c in emb.get("categories", [])],
                "vendorHref": (vend.get("_links", {}).get("alternate", {}) or {}).get("href"),
                "listing": (a.get("_links", {}).get("alternate", {}) or {}).get("href"),
            })
        offset += limit
        nxt = d.get("_links", {}).get("next")
        if not nxt: break
        time.sleep(0.4)
    return out

if __name__ == "__main__":
    all_apps = []
    for app in ("jira", "confluence"):
        rows = harvest(app)
        print(f"{app}: {len(rows)} paid cloud apps", file=sys.stderr)
        all_apps += rows
    os.makedirs("research/data", exist_ok=True)
    with open("research/data/atlassian_paid_cloud.json", "w") as f:
        json.dump(all_apps, f, indent=1)
    print(f"TOTAL {len(all_apps)} -> research/data/atlassian_paid_cloud.json", file=sys.stderr)
