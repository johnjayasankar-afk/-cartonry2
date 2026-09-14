#!/usr/bin/env python3
"""Measure BREADTH of distinct commercial query phrasings (NOT volume).
Counts unique Google Suggest completions across a-z expansion, and how many
carry a 'free' price signal vs a buy/professional signal."""
import json, subprocess, sys, time, string
from urllib.parse import quote
def sug(q):
    u="https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q="+quote(q)
    try:
        r=subprocess.run(["curl","-s","--max-time","20","-H","User-Agent: Mozilla/5.0",u],
                         capture_output=True,text=True,check=True)
        return json.loads(r.stdout)[1]
    except Exception: return []
FREE=("free","gratis","download free","open source","crack","torrent")
BUY=("software","professional","pro ","service","price","cost","buy","best")
for seed in sys.argv[1:]:
    found=set(sug(seed))
    for ch in string.ascii_lowercase:
        found|=set(sug(f"{seed} {ch}")); time.sleep(0.1)
    f=sum(1 for x in found if any(k in x for k in FREE))
    b=sum(1 for x in found if any(k in x for k in BUY))
    print(f"{seed:<40} unique={len(found):>4}  free-signal={f:>3} ({100*f/max(len(found),1):>3.0f}%)  buy-signal={b:>3}")
    time.sleep(0.2)
