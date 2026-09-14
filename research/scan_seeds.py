#!/usr/bin/env python3
"""Shallow breadth scan: base suggestions only, many seeds."""
import json, subprocess, sys, time, os
from urllib.parse import quote

def suggest(q):
    url = "https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=" + quote(q)
    try:
        r = subprocess.run(["curl","-s","--max-time","20","-H","User-Agent: Mozilla/5.0",url],
                           capture_output=True, text=True, check=True)
        return json.loads(r.stdout)[1]
    except Exception:
        return []

seeds = [l.strip() for l in sys.stdin if l.strip()]
out = {}
for s in seeds:
    r = suggest(s)
    out[s] = r
    print(f"\n## {s}")
    for x in r: print("  -", x)
    time.sleep(0.15)
os.makedirs("research/data", exist_ok=True)
tag = sys.argv[1] if len(sys.argv)>1 else "scan"
json.dump(out, open(f"research/data/scan_{tag}.json","w"), indent=1)
