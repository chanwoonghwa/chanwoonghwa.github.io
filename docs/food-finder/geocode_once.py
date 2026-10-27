#!/usr/bin/env python3
"""One-off, single-threaded address geocoding for a fixed list of 61 restaurants.

Nominatim public usage policy: max 1 req/s, identifying UA, persistent result cache.
https://operations.osmfoundation.org/policies/nominatim/
This script is NOT called from the website and is NOT a generic geocoding endpoint.
"""
import json, math, os, re, time, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent
INPUT=ROOT/"restaurants.json"
OUTPUT=ROOT/"distances.json"
ORIGIN={"name":"수도전기공업고등학교","address":"서울 강남구 개포로 410","lat":37.4856143,"lon":127.0635654,
        "source":"https://findby.co.kr/details/06324-116803122001-st-652b03a68c641f9e388127e9"}
VETTED={
  1:(37.4892391,127.0679694,"https://findby.co.kr/details/06329-116803122001-st-652b03a68c641f9e388127e1"),
  2:(37.474463,127.04964,"https://findby.co.kr/details/06312-116804166111-st-652b03c08c641f9e38816a58"),
  3:(37.4851832,127.0358917,"https://findby.co.kr/details/06267-116802000003-st-652b04618c641f9e38833b95"),
}
UA="SudoFoodFinderGeoOnce/1.0 (https://github.com/chanwoonghwa/chanwoonghwa.github.io)"
def haversine(lat,lon):
    p1,p2=math.radians(ORIGIN["lat"]),math.radians(lat)
    da=p2-p1;db=math.radians(lon-ORIGIN["lon"])
    h=math.sin(da/2)**2+math.cos(p1)*math.cos(p2)*math.sin(db/2)**2
    return round(12742*math.asin(min(1,math.sqrt(h))),2)
def normalized_address(address):
    match=re.search(r"(서울(?:특별시)?\s+)?(강남구|서초구)\s+([^\s]+)\s+(\d+(?:-\d+)?)",address)
    if not match:return None
    district,street,number=match.group(2,3,4)
    return f"서울특별시 {district} {street} {number}",street,number
def precise_enough(result,street,num,name):
    lat=float(result["lat"]);lon=float(result["lon"])
    if not (37.40<lat<37.64 and 126.93<lon<127.18):return False
    a=result.get("address") or {}
    hnum=str(a.get("house_number","")).strip()
    if hnum==num:return True
    display=str(result.get("display_name",""))
    # Accept only a named restaurant POI, never a road/street/neighbourhood centroid.
    if name and len(name)>=3 and name in display and result.get("type") not in ("road","street","suburb","administrative"):return True
    # Korean detailed road match with building number present.
    if street in display and re.search(r"(?<!\d)"+re.escape(num)+r"(?!\d)",display) and result.get("type") not in ("road","street","suburb","administrative"):return True
    return False
def geocode(addr,street,num,name):
    params=urllib.parse.urlencode({"q":addr,"format":"jsonv2","countrycodes":"kr","addressdetails":"1","limit":"4","accept-language":"ko"})
    req=urllib.request.Request("https://nominatim.openstreetmap.org/search?"+params,headers={"User-Agent":UA,"Accept":"application/json","Referer":"https://chanwoonghwa.github.io/food-finder/"})
    try:
        with urllib.request.urlopen(req,timeout=13) as resp:
            items=json.load(resp)
    except Exception as e:
        print("lookup error",repr(e),flush=True)
        return None
    for x in items:
        if precise_enough(x,street,num,name):
            return float(x["lat"]),float(x["lon"]),x.get("display_name","")
    return None
def main():
    data=json.loads(INPUT.read_text(encoding="utf-8"))["restaurants"]
    old={}
    if OUTPUT.exists():
        try:old={int(x["id"]):x for x in json.loads(OUTPUT.read_text(encoding="utf-8")).get("items",[])}
        except (ValueError,KeyError):pass
    cache={}
    entries=[]
    attempts=0
    for r in data:
        rid=int(r["id"])
        if rid in VETTED:
            lat,lon,src=VETTED[rid]
            entries.append({"id":rid,"latitude":lat,"longitude":lon,"straight_distance_km":haversine(lat,lon),"method":"verified_building","source":src})
            continue
        past=old.get(rid)
        if past and ("straight_distance_km" in past):
            entries.append(past);continue
        addr=normalized_address(r.get("address",""))
        if not addr:
            entries.append({"id":rid,"straight_distance_km":None,"method":"unresolved","source":None});continue
        exact,street,num=addr
        if exact not in cache:
            # A fixed one-time batch, one machine, >1 second between requests; responses cached to file.
            if attempts:time.sleep(1.2)
            match=geocode(exact,street,num,r["name"])
            attempts+=1
            cache[exact]=match
        else:match=cache[exact]
        if match:
            lat,lon,title=match
            entries.append({"id":rid,"latitude":lat,"longitude":lon,"straight_distance_km":haversine(lat,lon),"method":"osm_nominatim_exact_address","source":"https://www.openstreetmap.org/copyright","match":title})
        else:entries.append({"id":rid,"straight_distance_km":None,"method":"unresolved","source":None})
        # Checkpoint each row to make partial completion durable.
        payload={"origin":ORIGIN,"generated_at":datetime.now(timezone.utc).isoformat(),"items":entries}
        OUTPUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(f"processed {len(entries)}/{len(data)}, verified {sum(x['straight_distance_km'] is not None for x in entries)}",flush=True)
    payload={"origin":ORIGIN,"generated_at":datetime.now(timezone.utc).isoformat(),"items":entries}
    OUTPUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"FINAL verified={sum(x['straight_distance_km'] is not None for x in entries)}/{len(data)} requests={attempts}",flush=True)
if __name__=="__main__":main()
