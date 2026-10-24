/* MZB tournament enhancements. Uses the existing scoreboard state and Firebase write rules. */
const $=id=>document.getElementById(id);
const safe=t=>String(t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let latestMvp=[],latestResult=null,currentPoster=null,posterDataUrl="",posterBlob=null;
const MATCH_COUNT=12;

function getData(){
if(!window.MZB)return null;
const s=window.MZB.getSnapshot();
const results=s.schedule.map(m=>({match:m,result:window.MZB.result(m)}));
const regular=results.filter(x=>x.match.kind!=="special");
const finished=regular.filter(x=>x.result.played);
const live=results.filter(x=>x.result.phase==="live");
const queued=results.filter(x=>x.result.phase==="pending");
return{...s,results,regular,finished,live,queued};
}
function mvpLeaders(data){
if(!data)return [];
const people=Object.entries(data.stats.people).map(([name,p])=>({
name,team:p.team,wins:p.w,losses:p.l,diff:p.diff,played:p.w+p.l,
rate:p.w+p.l?p.w/(p.w+p.l):0
})).filter(p=>p.played>0);
people.sort((a,b)=>b.wins-a.wins||b.rate-a.rate||b.diff-a.diff||a.name.localeCompare(b.name,"ko"));
if(!people.length)return [];
const first=people[0];
return people.filter(p=>p.wins===first.wins&&p.rate===first.rate&&p.diff===first.diff);
}
function winnerInfo(data){
if(!data||data.finished.length!==MATCH_COUNT)return {ready:false,remaining:data?MATCH_COUNT-data.finished.length:MATCH_COUNT};
const a=data.stats.yg,b=data.stats.og;
return a===b?{ready:true,tied:true,winner:null,loser:null,a,b}:{ready:true,tied:false,winner:a>b?"YB":"OB",loser:a>b?"OB":"YB",a,b};
}
function matchLabel(x){const m=x.match;return m.id+"경기 · "+m.type;}
function sideLabel(x){return x.match.a.join(" / ")+" vs "+x.match.b.join(" / ");}
function commandCard(x,live){
if(!x)return '<div class="command-name">모든 경기가 종료됐어요 🎉</div><div class="command-players">정규 경기 결과를 확인하세요.</div>';
const r=x.result;
const pair=r.a!==undefined&&r.b!==undefined?'<div class="command-score"><span class="yb">'+r.a+'</span> : <span class="ob">'+r.b+'</span></div>':"";
return '<div class="command-name">'+safe(matchLabel(x))+'</div><div class="command-players">'+safe(sideLabel(x))+'</div>'+pair+'<button class="jump-match" data-jump="'+x.match.id+'">'+(live?"LIVE 경기 보기":"경기로 이동")+' ↗</button>';
}
function renderCommand(data){
const live=data.live.filter(x=>x.match.kind!=="special");
const running=live[0]||data.live[0]||null;
let upcoming;
if(running){
upcoming=data.results.find(x=>x.match.id>running.match.id&&x.result.phase==="pending")||data.queued[0];
}else upcoming=data.queued.find(x=>x.match.kind!=="special")||data.queued[0];
$("nowPlaying").innerHTML=running?commandCard(running,true):'<div class="command-name">진행 중인 경기가 없어요</div><div class="command-players">운영자가 LIVE 버튼을 누르면 여기에 표시됩니다.</div>';
$("nextMatch").innerHTML=upcoming?commandCard(upcoming,false):'<div class="command-name">예정된 경기가 없어요</div>';
const draws=data.finished.filter(x=>x.result.draw).length;$("matchPhaseSummary").textContent=data.finished.length+" / "+MATCH_COUNT+" 경기 종료"+(draws?" · 무승부 "+draws+"경기":"")+(live.length?" · LIVE "+live.length+"경기":"");
}
function renderDish(data){
const box=$("dishPanel"),title=$("dishTitle"),message=$("dishMessage"),mvp=$("mvpSummary");
const finale=winnerInfo(data);
const leaders=mvpLeaders(data);
latestMvp=leaders;latestResult=finale;
box.classList.toggle("winner-revealed",finale.ready&&!finale.tied);
box.classList.toggle("neutral-result",finale.ready&&finale.tied);
if(!finale.ready){
title.textContent="설거지 당첨자는 누구? 🧽";
message.textContent="정규 "+data.finished.length+"경기 완료 · 남은 "+finale.remaining+"경기 종료 후 최종 발표!";
}else if(finale.tied){
title.textContent="🤝 누적 게임 동점!";
message.textContent="YB "+finale.a+" : "+finale.b+" OB · 설거지 담당은 동점 결정전 또는 합의로 정해주세요.";
}else{
title.textContent="🎉 "+finale.loser+" TEAM 설거지 당첨!";
message.textContent="🏆 "+finale.winner+" TEAM 승리 · 누적 게임 "+finale.a+" : "+finale.b+" · 설거지는 "+finale.loser+" 팀이!";
}
if(leaders.length){
const names=leaders.map(x=>safe(x.name)).join(" · ");
const p=leaders[0];
mvp.innerHTML='<div class="mvp-highlight"><span class="mvp-icon">🏅</span><div><strong>'+(finale.ready?"오늘의 MVP":"현재 MVP 후보")+' · '+names+'</strong><span>'+p.wins+'승 '+p.losses+'패 · 게임 득실 '+(p.diff>0?"+":"")+p.diff+(leaders.length>1?" · 공동 "+leaders.length+"명":"")+'</span></div></div><p class="mvp-help">MVP 기준: 승리 경기 수 → 승률 → 게임 득실 (동률이면 공동 MVP)</p>';
}else{mvp.innerHTML='<p class="mvp-help">경기가 종료되면 MVP 후보를 자동으로 선정합니다.</p>';}
const confetti=$("dishConfetti");
if(finale.ready&&!finale.tied&&!confetti.childElementCount){
confetti.innerHTML=Array.from({length:14},(_,i)=>'<span class="confetti-spark" style="--left:'+((i*73)%96+2)+'%;--delay:-'+((i*17)%31/10)+'s;--c:'+(i%2?"#0d87ed":"#f32d8b")+'"></span>').join("");
}else if((!finale.ready||finale.tied)&&confetti.childElementCount)confetti.innerHTML="";
}
function renderControls(data){
const root=$("matches");
const canEdit=data.editable;
for(const row of root.querySelectorAll(".match[data-match-id]")){
const id=Number(row.dataset.matchId);
const info=data.results.find(x=>x.match.id===id);
if(!info)continue;
const r=info.result;
const existing=row.querySelector(".phase-controls");
if(existing)existing.remove();
if(!canEdit)continue;
const ctrl=document.createElement("div");
ctrl.className="phase-controls";
const phaseButtons=r.phase==="pending"
?'<button class="phase-btn live-btn" data-change-phase="live">▶ LIVE 시작</button>'
:r.phase==="live"
?'<button class="phase-btn finish-btn" data-change-phase="finished" '+(!r.complete||(r.tied&&!r.draw&&!(r.a===5&&r.b===5))?'disabled title="양 팀 점수를 입력하세요. 5:5는 무승부 종료 가능"':'')+'>✓ 경기 종료</button><button class="phase-btn" data-change-phase="pending">↶ 대기로</button>'
:'<button class="phase-btn live-btn" data-change-phase="live">↻ 경기 재개</button>';
const editScore=r.phase==="finished"?'':'<div class="one-tap"><div class="tap-side yb">YB <button class="tap-btn" data-score-side="a" data-delta="-1" aria-label="YB 게임 1 감소">−</button><button class="tap-btn" data-score-side="a" data-delta="1" aria-label="YB 게임 1 증가">+</button></div><div class="tap-side ob">OB <button class="tap-btn" data-score-side="b" data-delta="-1" aria-label="OB 게임 1 감소">−</button><button class="tap-btn" data-score-side="b" data-delta="1" aria-label="OB 게임 1 증가">+</button></div></div>';
ctrl.innerHTML='<div class="phase-actions">'+phaseButtons+'</div>'+editScore;
row.append(ctrl);
}
const liveRows=Array.from(root.querySelectorAll('.match[data-phase="live"]'));
for(const row of liveRows.reverse())root.prepend(row);
}
function renderAll(){
const d=getData();if(!d)return;
renderCommand(d);renderDish(d);renderControls(d);
}
window.addEventListener("mzb:render",renderAll);
renderAll();

$("matches").addEventListener("click",async event=>{
const button=event.target.closest("button[data-change-phase],button[data-score-side]");
if(!button)return;
const row=button.closest(".match[data-match-id]");
if(!row)return;
const id=Number(row.dataset.matchId);
if(button.dataset.changePhase){
button.disabled=true;
await window.MZB.updateStatus(id,button.dataset.changePhase);
}else{
button.disabled=true;
const side=button.dataset.scoreSide,delta=Number(button.dataset.delta);
await window.MZB.bumpScore(id,side,delta);
}
});
$("matchCommand").addEventListener("click",e=>{
const b=e.target.closest("[data-jump]");if(!b)return;
const row=$("matches").querySelector('[data-match-id="'+Number(b.dataset.jump)+'"]');
if(!row){const all=$("filters").querySelector('[data-filter="all"]');all?.click();requestAnimationFrame(()=>{$("matches").querySelector('[data-match-id="'+Number(b.dataset.jump)+'"]')?.scrollIntoView({behavior:"smooth",block:"center"});});}
else row.scrollIntoView({behavior:"smooth",block:"center"});
});

function round(ctx,x,y,w,h,r,color){
ctx.fillStyle=color;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);ctx.fill();
}
function centerText(ctx,s,x,y,size,color,weight="800"){
ctx.textAlign="center";ctx.font=weight+" "+size+"px system-ui,Apple SD Gothic Neo,sans-serif";ctx.fillStyle=color;ctx.fillText(s,x,y);
}
function drawText(ctx,s,x,y,size,color,weight="800"){
ctx.textAlign="left";ctx.font=weight+" "+size+"px system-ui,Apple SD Gothic Neo,sans-serif";ctx.fillStyle=color;ctx.fillText(s,x,y);
}
function clipped(ctx,s,maxWidth){
let str=String(s);while(str.length>2&&ctx.measureText(str).width>maxWidth)str=str.slice(0,-2)+"…";return str;
}
function createPosterCanvas(d){
const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1920;
const c=canvas.getContext("2d"),W=1080,H=1920;
const grad=c.createLinearGradient(0,0,W,H);grad.addColorStop(0,"#dcefff");grad.addColorStop(.48,"#fff7fb");grad.addColorStop(1,"#d5e9ff");
c.fillStyle=grad;c.fillRect(0,0,W,H);
c.save();c.globalAlpha=.15;c.strokeStyle="#0c82e8";c.lineWidth=7;
for(let i=-4;i<14;i++){c.beginPath();c.moveTo(i*200,0);c.lineTo(i*200+550,H);c.stroke();}
c.restore();
round(c,44,54,992,240,42,"#173e72");
const topGrad=c.createLinearGradient(60,50,1000,270);topGrad.addColorStop(0,"#fd348f");topGrad.addColorStop(1,"#168afa");
round(c,62,71,956,13,7,topGrad);
centerText(c,"MZB  ·  TENNIS DAY",540,134,36,"#c2e9ff","900");
centerText(c,"펜션 설거지빵",540,211,66,"#ffffff","900");
centerText(c,"FINAL SCOREBOARD",540,259,30,"#c0e8ff","800");
const finale=winnerInfo(d),leaders=mvpLeaders(d);
const status=finale.ready?(finale.tied?"FINAL · DRAW":"FINAL · "+finale.winner+" WIN"):"LIVE RESULTS · "+d.finished.length+"/12 FINISHED";
centerText(c,status,540,343,29,finale.ready?"#db3185":"#246594","900");
round(c,47,370,986,385,32,"#ffffff");
round(c,68,391,443,286,25,"#ffe5f0");round(c,569,391,443,286,25,"#dfefff");
centerText(c,"YB TEAM",289,451,38,"#dd2777","900");
centerText(c,"OB TEAM",791,451,38,"#0b72d9","900");
centerText(c,String(d.stats.yg),289,601,142,"#ee2d83","900");
centerText(c,String(d.stats.og),791,601,142,"#0c7bec","900");
centerText(c,"VS",540,537,40,"#6f8dad","900");
centerText(c,"누적 획득 게임",540,723,27,"#486b93","800");
const drawCount=d.finished.filter(x=>x.result.draw).length;const detail=d.finished.length+" / 12 종료      YB "+d.stats.y+"승 · OB "+d.stats.o+"승"+(drawCount?" · 무 "+drawCount:"");
centerText(c,detail,540,821,29,"#315c83","800");
round(c,47,856,986,153,30,"#fff2f8");
if(!finale.ready){centerText(c,"🧽 설거지 당첨자는 누구?",540,923,39,"#db2774","900");centerText(c,"모든 정규 경기 종료 후 공개!",540,970,24,"#7c718c","700");}
else if(finale.tied){centerText(c,"🤝 게임 수 동점!",540,923,44,"#235aa0","900");centerText(c,"설거지 담당은 추가 결정이 필요해요",540,970,23,"#617f9e","700");}
else{centerText(c,"🧽 "+finale.loser+" TEAM 설거지 당첨!",540,921,44,"#db2774","900");centerText(c,"🏆 "+finale.winner+" TEAM 승리",540,974,31,"#1e669d","850");}
round(c,47,1033,986,111,26,"#fff7e6");
drawText(c,"🏅 TODAY'S "+(finale.ready?"MVP":"MVP CANDIDATE"),78,1079,28,"#966528","900");
const mvpn=leaders.length?leaders.map(x=>x.name).join(" · "):"집계 대기";
c.font="900 32px system-ui, sans-serif";const clippedMvp=clipped(c,mvpn,585);
c.textAlign="right";c.fillStyle="#9b6123";c.fillText(clippedMvp,995,1093);
drawText(c,"MATCH RESULTS",64,1213,32,"#1b4775","900");
let rows=d.regular;
const yStart=1251,rowH=46;
for(let i=0;i<rows.length;i++){
const x=rows[i],m=x.match,r=x.result,y=yStart+i*rowH;
if(i%2===0)round(c,53,y-26,972,43,10,"#ffffffc7");
drawText(c,String(i+1).padStart(2,"0"),74,y,22,"#7b91a9","900");
c.font="800 21px system-ui,sans-serif";
const playerText=clipped(c,m.a.join("/"),306);
drawText(c,playerText,128,y,21,"#2a507d","800");
const score=r.a===undefined||r.b===undefined?"– : –":r.a+" : "+r.b;
centerText(c,score,632,y,25,r.played?"#d12f7b":"#8498ae","900");
c.textAlign="right";c.font="800 21px system-ui,sans-serif";c.fillStyle="#1d598f";
c.fillText(clipped(c,m.b.join("/"),300),992,y);
}
round(c,64,1856,952,3,2,"#bfd7ec");
centerText(c,new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"long",day:"numeric"}).format(new Date())+"  ·  MZB TENNIS COURT",540,1892,19,"#527fa6","800");
return canvas;
}
function canvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("이미지 생성 실패")),"image/png"));}
async function preparePoster(){
const d=getData();if(!d){window.MZB?.toast("스코어 데이터를 불러올 수 없습니다",true);return;}
try{
await document.fonts.ready;
const canvas=createPosterCanvas(d);
posterDataUrl=canvas.toDataURL("image/png");
posterBlob=await canvasBlob(canvas);
currentPoster="MZB_테니스_결과_"+new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())+".png";
$("resultPreview").src=posterDataUrl;
$("imageDialog").showModal();
}catch(e){window.MZB?.toast("포스터 생성 실패: "+e.message,true);}
}
$("exportImage").addEventListener("click",preparePoster);
$("closeImage").onclick=()=>$("imageDialog").close();
$("downloadImage").onclick=()=>{
if(!posterDataUrl)return;
const a=document.createElement("a");a.href=posterDataUrl;a.download=currentPoster||"MZB_scoreboard.png";
document.body.append(a);a.click();a.remove();
};
$("shareImage").onclick=async()=>{
if(!posterBlob)return;
try{
const file=new File([posterBlob],currentPoster||"MZB_scoreboard.png",{type:"image/png"});
if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:"MZB 테니스 경기 결과"});return;}
window.MZB?.toast("공유 기능을 지원하지 않는 브라우저입니다. 다운로드하거나 이미지 길게 누르기로 저장하세요.");
}catch(e){if(e.name!=="AbortError")window.MZB?.toast("공유 실패: "+e.message,true);}
};
