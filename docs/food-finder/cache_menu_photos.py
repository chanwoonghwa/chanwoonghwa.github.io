#!/usr/bin/env python3
"""One-time cache of *licensed* curated Commons food photos as ~840px JPEGs.

Not a scraper for Naver/Google/restaurant review content.
License author/source already validated and stored in menu-photos.json.
Downloads one image at a time, delays requests and never replaces source metadata.
"""
import json, os, time, urllib.parse, urllib.request
from pathlib import Path

HERE=Path(__file__).resolve().parent
MANIFEST=HERE/"menu-photos.json"
TARGET=HERE/"assets"/"menu"
TARGET.mkdir(parents=True,exist_ok=True)
data=json.loads(MANIFEST.read_text(encoding="utf-8"))
ua="SudoTableFoodGuide/1.0 (https://github.com/chanwoonghwa/chanwoonghwa.github.io; contact: chanwoonghwa@gmail.com)"
success=0
for i,(key,item) in enumerate(data["images"].items()):
    if i:time.sleep(1.4)
    file=str(item["file"])
    if not file.lower().endswith((".jpg",".jpeg")):
        print("SKIP not a JPEG",key,flush=True);continue
    output=TARGET/(key+".jpg")
    if output.exists() and output.stat().st_size>1000:
        item["src"]="./assets/menu/"+key+".jpg"
        success+=1
        continue
    url="https://commons.wikimedia.org/wiki/Special:FilePath/"+urllib.parse.quote(file.replace(" ","_"),safe="")+"?width=840"
    try:
        req=urllib.request.Request(url,headers={"User-Agent":ua,"Accept":"image/jpeg"})
        with urllib.request.urlopen(req, timeout=17) as response:
            contents=response.read(3_000_000)
            media=response.headers.get("Content-Type","")
        if not (contents.startswith(b"\xff\xd8\xff") and len(contents)>2000 and "image/" in media):
            print("REJECT",key,media,len(contents),flush=True);continue
        output.write_bytes(contents)
        item["src"]="./assets/menu/"+key+".jpg"
        success+=1
        print("OK",key,len(contents),flush=True)
    except Exception as e:
        print("FAILED",key,type(e).__name__,str(e)[:120],flush=True)
# Maintain hotlinked alternatives if a download fails; client handles failed photo load.
MANIFEST.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("CACHED",success,"of",len(data["images"]),flush=True)
