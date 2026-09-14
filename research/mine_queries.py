#!/usr/bin/env python3
"""Mine real query phrasings from Google's public suggest endpoint.
Evidence of what people actually type. NOT volume data - do not treat as volume."""
import json, subprocess, sys, time, string, os
from urllib.parse import quote

def suggest(q):
    url = ("https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=" + quote(q))
    try:
        r = subprocess.run(["curl","-s","--max-time","20","-H","User-Agent: Mozilla/5.0",url],
                           capture_output=True, text=True, check=True)
        return json.loads(r.stdout)[1]
    except Exception:
        return []

def expand(seed, depth_chars=True):
    found = set(suggest(seed))
    if depth_chars:
        for ch in string.ascii_lowercase:
            found |= set(suggest(f"{seed} {ch}"))
            time.sleep(0.12)
    return found

if __name__ == "__main__":
    seeds = sys.argv[1:]
    out = {}
    for s in seeds:
        res = sorted(expand(s))
        out[s] = res
        print(f"\n### {s!r}  ({len(res)} suggestions)", file=sys.stderr)
        for r in res: print("   ", r, file=sys.stderr)
        time.sleep(0.3)
    os.makedirs("research/data", exist_ok=True)
    fn = "research/data/queries_" + "_".join(s.replace(" ","-") for s in seeds)[:60] + ".json"
    json.dump(out, open(fn,"w"), indent=1)
    print(f"\nsaved {fn}", file=sys.stderr)
