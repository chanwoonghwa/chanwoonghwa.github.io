/* Sudo Table map and team visit records.
 * Map: Leaflet + OSM. Visit history: Firestore ONLY after explicit shared Firebase setup.
 * No visit records or dates are stored in localStorage.
 */
(function(){
"use strict";
const api=window.SudoFoodApi;
if(!api)return;
const $=s=>document.querySelector(s);
const todayKST=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const mapEl=$("#sudoMap");
const statusEl=$("#visitDbStatus");
const origin={lat:37.4856143,lon:127.0635654};
const state={
 map:null,layer:null,originMarker:null,pointMarkers:new Map(),visibleSig:"",
 lastVisits:new Map(),visitCount:new Map(),phase:"unconfigured",auth:null,firestore:null,user:null,config:null,unsub:null,
 lastRenderSummary:""
};
function textVisit(r){
 const iso=state.lastVisits.get(Number(r.id));
 if(state.phase==="unconfigured")return "공유 방문 DB 미연결";
 if(state.phase==="auth")return "공유 방문 DB 로그인 필요";
 if(state.phase==="connecting")return "방문 기록 불러오는 중";
 if(state.phase==="error")return "공유 DB 확인 필요";
 return iso?("마지막 방문 "+iso.replaceAll("-",".")+" · 총 "+(state.visitCount.get(Number(r.id))||0)+"회"):"공유 방문 이력 없음";
}
function setStatus(txt){if(statusEl)statusEl.textContent=txt}
function visitDateOnly(data){
 const x=data?.visited_at;
 if(typeof x!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(x))return null;
 const t=Date.parse(x+"T00:00:00Z");
 if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==x)return null;
 return x;
}
function popupHtml(r){
 const dist=api.straightOf(r);
 const go=api.safeURL(r.naver_url);
 const linked=go==="#"?"":'<a href="'+go+'" target="_blank" rel="noopener noreferrer">네이버지도 ↗</a>';
 return '<div class="sudo-map-popup"><b>'+api.esc(r.name)+'</b>'+
 '<span>'+api.esc(r.cuisine_detail)+' · '+(dist==null?"거리 미측정":dist.toFixed(1)+"km")+'</span>'+
 '<span class="visit-stamp">'+api.esc(textVisit(r))+'</span>'+
 '<div class="sudo-map-actions">'+linked+' <button type="button" data-map-card="'+r.id+'">카드 보기 ↓</button></div></div>';
}
function pinColor(r){
 if(r.parking_status?.startsWith("가능"))return "#26845c";
 if(r.parking_status==="불가 안내")return "#ba6550";
 return "#e2a150";
}
function initMap(){
 if(!mapEl)return;
 if(!window.L){
   mapEl.textContent="지도를 불러오지 못했습니다. 아래 식당 목록에서 네이버지도 링크를 이용해 주세요.";
   return;
 }
 const L=window.L;
 const map=L.map(mapEl,{scrollWheelZoom:false,zoomControl:true,preferCanvas:true}).setView([origin.lat,origin.lon],13);
 state.map=map;
 L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
  maxZoom:19,minZoom:10,
  // Never prefetch map tiles and respect standard tile response caching.
  updateWhenIdle:true,keepBuffer:1
 }).addTo(map);
 state.layer=L.layerGroup().addTo(map);
 const schoolIcon=L.divIcon({className:"sudo-school-marker",html:'<span>★</span>',iconSize:[34,34],iconAnchor:[17,17]});
 state.originMarker=L.marker([origin.lat,origin.lon],{icon:schoolIcon,zIndexOffset:1000}).addTo(map).bindPopup("<strong>출발지 · 수도전기공업고등학교</strong><br>서울 강남구 개포로 410");
 map.on("zoomend",()=>{});
 mapEl.addEventListener("click",event=>{
  const id=event.target.closest("[data-map-card]")?.dataset.mapCard;
  if(!id)return;
  showCard(Number(id));
 });
 setTimeout(()=>map.invalidateSize(),70);
 refreshMap(true);
}
function showCard(id){
 const r=api.all.find(x=>x.id===id);if(!r)return;
 // Cards reflect active filters; only seek cards that are actually present.
 const card=document.querySelector('[data-food-id="'+id+'"]');
 if(!card){$("#filterSection")?.scrollIntoView({behavior:"smooth",block:"start"});return}
 const rr=api.filteredRows();
 const i=rr.findIndex(x=>x.id===id);
 if(i>=0&&typeof api.gotoDeck==="function")api.gotoDeck(i,"auto");
 $("#deckSection")?.scrollIntoView({behavior:"smooth",block:"start"});
}
function mapFocus(id){
 const marker=state.pointMarkers.get(id);
 if(!marker||!state.map)return;
 const ll=marker.getLatLng();
 state.map.setView(ll,Math.max(state.map.getZoom(),15),{animate:true});
 marker.openPopup();
}
function refreshMap(force=false){
 if(!state.map||!state.layer)return;
 const rows=api.filteredRows().filter(r=>{
  const p=api.coordinates[r.id];
  return p&&Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude));
 });
 const sig=rows.map(r=>r.id).join(",");
 const changed=force||sig!==state.visibleSig;
 state.visibleSig=sig;
 const totalCoords=api.all.filter(r=>api.coordinates[r.id]?.latitude!=null).length;
 $("#mapPinCount").textContent=rows.length+"개 핀 / "+totalCoords+"곳 좌표 확인";
 $("#mapMissingCount").textContent=(api.all.length-totalCoords)+"곳은 좌표 미확인";
 if(changed){
   state.layer.clearLayers();state.pointMarkers.clear();
   const L=window.L;
   for(const r of rows){
     const p=api.coordinates[r.id],lat=Number(p.latitude),lon=Number(p.longitude);
     if(!(lat>=37.4&&lat<=37.65&&lon>=126.9&&lon<=127.2))continue;
     const marker=L.circleMarker([lat,lon],{radius:9,color:"#fff",weight:2,fillColor:pinColor(r),fillOpacity:0.97,interactive:true});
     marker.bindTooltip(r.name,{direction:"top",opacity:0.95});
     marker.bindPopup(()=>popupHtml(r),{maxWidth:300,minWidth:190});
     marker.addTo(state.layer);state.pointMarkers.set(Number(r.id),marker);
   }
   const names=rows.slice(0,6);
   $("#mapQuickNames").innerHTML=names.map(r=>'<button type="button" data-map-focus="'+r.id+'">'+api.esc(r.name)+'</button>').join("");
 }else{
   // Live visit updates refresh popup body without reinitializing map tiles.
   for(const r of rows){const m=state.pointMarkers.get(r.id);if(m?.isPopupOpen())m.setPopupContent(popupHtml(r));}
 }
}
function refreshVisited(){
 const dateLabels=document.querySelectorAll("[data-visit-label]");
 for(const label of dateLabels){
  const r=api.all.find(x=>x.id===Number(label.dataset.visitLabel));
  if(r)label.textContent=textVisit(r);
 }
 refreshMap(false);
}
function refresh(){
 refreshMap();
 refreshVisited();
}
$("#mapQuickNames")?.addEventListener("click",e=>{const id=e.target.closest("[data-map-focus]")?.dataset.mapFocus;if(id)mapFocus(Number(id))});
$("#mapReset")?.addEventListener("click",()=>{
 if(state.map)state.map.setView([origin.lat,origin.lon],13,{animate:true})
});
$("#mapLocateList")?.addEventListener("click",()=>$("#allResults")?.scrollIntoView({behavior:"smooth",block:"start"}));
$("#visitLogin")?.addEventListener("click",async ()=>{
 if(!state.auth)return;
 try{setStatus("Google 로그인 중…");await state.auth.signInWithPopup(state.auth.auth,state.auth.provider);}
 catch(e){setStatus("로그인 실패: "+String(e?.code||e?.message||"확인 필요"))}
});
$("#visitLogout")?.addEventListener("click",async ()=>{if(state.auth)await state.auth.signOut(state.auth.auth)});
$("#visitManage")?.addEventListener("click",()=>{
 if(state.phase!=="ready"||!state.user){setStatus("방문 기록을 쓰려면 Firebase 로그인이 필요합니다.");return}
 const dialog=$("#visitDialog");
 const select=$("#visitRestaurant");
 select.innerHTML=api.all.map(r=>'<option value="'+r.id+'">'+api.esc(r.name)+'</option>').join("");
 const card=document.querySelector(".food-card");
 if(card)select.value=card.dataset.foodId;
 const date=$("#visitDate");date.value=todayKST();date.max=todayKST();
 $("#visitFormStatus").textContent="선택한 모임의 공유 기록으로 저장됩니다.";
 dialog.showModal();
});
$("#visitDialogClose")?.addEventListener("click",()=>$("#visitDialog").close());
$("#visitForm")?.addEventListener("submit",async (e)=>{
 e.preventDefault();
 if(!state.user||!state.firestore||state.phase!=="ready")return;
 const id=Number($("#visitRestaurant").value),date=$("#visitDate").value;
 if(!Number.isInteger(id)||id<1||id>api.all.length||!visitDateOnly({visited_at:date})||date>todayKST()){
  $("#visitFormStatus").textContent="식당과 방문 날짜를 확인해 주세요.";return;
 }
 const btn=$("#visitSave");btn.disabled=true;$("#visitFormStatus").textContent="공유 DB에 저장 중…";
 try{
  const {db,fn,groupId}=state.firestore;
  await fn.addDoc(fn.collection(db,"groups",groupId,"visits"),{
    restaurant_id:id,visited_at:date,created_by:state.user.uid,created_at:fn.serverTimestamp()
  });
  $("#visitDialog").close();
  setStatus("방문 기록이 저장됐습니다. 실시간 갱신을 확인하세요.");
 }catch(err){
  $("#visitFormStatus").textContent="저장 실패: "+String(err?.code||err?.message||"권한 확인 필요");
 }finally{btn.disabled=false}
});
async function startSharedVisits(){
 setStatus("공유 방문 DB 설정 확인 중…");
 let config;
 try{
  const response=await fetch("./shared-visits-config.json",{cache:"no-store"});
  if(!response.ok)throw new Error("config missing");
  config=await response.json();
 }catch{
  state.phase="unconfigured";setStatus("공유 방문 DB 미연결 · Firebase 설정 필요");return;
 }
 if(!config?.enabled||!config.firebaseConfig?.projectId||!config.firebaseConfig?.apiKey){
  state.phase="unconfigured";setStatus("공유 방문 DB 미연결 · Firebase 설정 필요");return;
 }
 try{
  state.phase="connecting";setStatus("Firebase 연결 중…");
  const version="12.19.0";
  const [app,auth,fn]=await Promise.all([
    import("https://www.gstatic.com/firebasejs/"+version+"/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/"+version+"/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/"+version+"/firebase-firestore.js")
  ]);
  const fb=app.initializeApp(config.firebaseConfig,"sudo-table-visits");
  const authentication=auth.getAuth(fb),db=fn.getFirestore(fb),groupId=config.groupId||"sudo-table";
  state.auth={auth:authentication,signInWithPopup:auth.signInWithPopup,provider:new auth.GoogleAuthProvider(),signOut:auth.signOut};
  state.firestore={db,fn,groupId};
  $("#visitLogin").hidden=false;
  auth.onAuthStateChanged(authentication,user=>{
    state.user=user||null;
    $("#visitLogin").hidden=Boolean(user);
    $("#visitLogout").hidden=!user;
    $("#visitManage").hidden=!user;
    if(state.unsub){state.unsub();state.unsub=null}
    state.lastVisits.clear();state.visitCount.clear();
    if(!user){state.phase="auth";setStatus("공유 방문 이력 · Google 로그인 필요");refreshVisited();return}
    state.phase="connecting";setStatus("공유 방문 이력 동기화 중…");refreshVisited();
    const visits=fn.collection(db,"groups",groupId,"visits");
    state.unsub=fn.onSnapshot(visits,snapshot=>{
      state.lastVisits.clear();state.visitCount.clear();
      snapshot.forEach(doc=>{
        const row=doc.data(),date=visitDateOnly(row),id=Number(row.restaurant_id);
        if(!date||!Number.isInteger(id)||id<1||id>api.all.length)return;
        const old=state.lastVisits.get(id);
        if(!old||date>old)state.lastVisits.set(id,date);
        state.visitCount.set(id,(state.visitCount.get(id)||0)+1);
      });
      state.phase="ready";
      setStatus("공유 방문 기록 연결됨 · "+snapshot.size+"건 · "+user.email);
      refreshVisited();
    },err=>{state.phase="error";setStatus("Firestore 읽기 권한 또는 네트워크 확인: "+String(err?.code||"error"));refreshVisited()});
  },err=>{state.phase="error";setStatus("Firebase 인증 상태 확인 필요: "+String(err?.code||"error"))});
 }catch(err){state.phase="error";setStatus("Firebase 초기화 실패: "+String(err?.message||err))}
}
window.SudoMapVisits={refresh,mapFocus,lastVisitLabel:textVisit};
document.addEventListener("sudo:render",refresh);
initMap();
startSharedVisits();
})();
