/* ===== ORBIX 2.0 — bilingual (ar/en) offline study & life planner ===== */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,'0');
const dkey=(d=new Date())=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const uid=()=>Math.random().toString(36).slice(2,10);
const m2t=m=>{m=((Math.round(m)%1440)+1440)%1440;return pad(Math.floor(m/60))+':'+pad(m%60)};
const t2m=t=>{const[a,b]=(t||'0:0').split(':').map(Number);return (a||0)*60+(b||0)};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const daysTo=d=>d?Math.ceil((new Date(d+'T23:59:59')-Date.now())/864e5):999;
const N=v=>'<span class="num">'+v+'</span>';

/* ---------- storage ---------- */
const LS={
  get(k,f){try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(e){return f}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){toast(L('Storage is full — export a backup.','مساحة التخزين امتلأت — اعمل نسخة احتياطية.'));return false}}
};
const blank=name=>({
  settings:{name:name||'',wake:'07:00',sleep:'23:30',studyGoal:240,gamingGoal:120,sessionLen:45,
    ratio:45,gamingMode:'reward',breakShort:10,breakLong:25,lang:'ar',theme:'dark',accent:'amber',
    warnings:true,sound:true,noise:false,vacation:false,vacationMins:60,examMode:false,
    prayers:true,lat:30.013,lng:31.209,tz:2,
    blockEnabled:false,blockFrom:'18:00',blockTo:'20:00',blocked:['youtube.com','tiktok.com','facebook.com','instagram.com'],
    onboarded:false,widgets:{study:1,next:1,exam:1,game:1},freezes:2,lastBackup:0,
    timerStyle:'ring',alarmTone:'chime',prayerAuto:true,idleLockMin:0,density:'comfortable'},
  subjects:[],exams:[],tasks:[],events:[],sessions:[],notes:[],cards:[],questions:[],quizRuns:[],
  goals:[],journal:[],plans:{},inbox:[],distractions:[],grades:[],attendance:[],revisions:[],
  moods:{},xp:0,badges:[],freezeDays:[]
});
let P=null,PID=null,DB=null;
const profiles=()=>LS.get('sf:profiles',[]);
function loadProfile(id){
  PID=id;LS.set('sf:active',id);
  const raw=LS.get('sf:p:'+id,{});
  DB=Object.assign(blank(),raw);
  DB.settings=Object.assign(blank().settings,raw.settings||{});
  P=DB.settings;applyChrome();
}
const save=()=>{if(PID)LS.set('sf:p:'+PID,DB)};
function applyChrome(){
  const h=document.documentElement;
  h.dataset.theme=P.theme==='light'?'light':'dark';
  h.dataset.accent=P.accent||'amber';
  h.lang=P.lang;h.dir=P.lang==='ar'?'rtl':'ltr';
  document.body.classList.toggle('densec',P.density==='compact');
}
/* ---------- language ---------- */
const L=(en,ar)=>(P&&P.lang==='ar')?ar:en;
const AR=()=>P&&P.lang==='ar';
const DAYS=()=>AR()?['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_S=()=>AR()?['أحد','إثن','ثلا','أرب','خمي','جمع','سبت']:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function hm(m){m=Math.max(0,Math.round(m));const h=Math.floor(m/60),r=m%60;
  if(AR())return (h?h+'س ':'')+(r||!h?r+'د':'');
  return (h?h+'h ':'')+(r||!h?r+'m':'')}
function dayN(n){if(!AR())return n+(n===1?' day':' days');
  return n===1?'يوم':n===2?'يومين':(n<11?n+' أيام':n+' يوم')}

/* ---------- toast + sound ---------- */
function toast(msg,ms=2800){const d=document.createElement('div');d.textContent=msg;$('#toast').appendChild(d);
  setTimeout(()=>{d.style.opacity='0';d.style.transition='opacity .3s';setTimeout(()=>d.remove(),320)},ms)}
let AC=null,noiseNode=null;
const actx=()=>{try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();return AC}catch(e){return null}};
document.addEventListener('pointerdown',()=>{actx()},{once:true});
function tone(freq,t0,dur,type,vol){
  const c=actx();if(!c)return;const o=c.createOscillator(),g=c.createGain();
  o.type=type||'sine';o.frequency.value=freq;o.connect(g);g.connect(c.destination);
  g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(vol||.15,t0+.02);
  g.gain.exponentialRampToValueAtTime(.0001,t0+dur);o.start(t0);o.stop(t0+dur+.02);
}
const ALARM_TONES={
  chime:c=>{const t=c.currentTime;[880,660,990].forEach((f,i)=>tone(f,t+i*.16,.5,'sine',.14))},
  bell:c=>{const t=c.currentTime;[523,659,784].forEach((f,i)=>tone(f,t+i*.12,.9,'triangle',.13))},
  retro:c=>{const t=c.currentTime;[440,440,660,880].forEach((f,i)=>tone(f,t+i*.11,.14,'square',.09))},
  soft:c=>{const t=c.currentTime;[392,494].forEach((f,i)=>tone(f,t+i*.3,.9,'sine',.1))}
};
function beep(times=2){
  if(!P.sound)return;const c=actx();if(!c)return;
  const fn=ALARM_TONES[P.alarmTone]||ALARM_TONES.chime;
  if(times<=1){tone(700,c.currentTime,.3,'sine',.14)}else fn(c);
}
function noise(on){
  const c=actx();if(!c)return;
  if(!on){if(noiseNode){try{noiseNode.stop()}catch(e){}noiseNode=null}return}
  if(noiseNode)return;
  const len=c.sampleRate*2,buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);
  let last=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;last=(last+.02*w)/1.02;d[i]=last*3.2}
  const src=c.createBufferSource();src.buffer=buf;src.loop=true;
  const g=c.createGain();g.gain.value=.12;src.connect(g);g.connect(c.destination);src.start();noiseNode=src;
}

/* ---------- prayer times (Egyptian General Authority) ---------- */
function prayerTimes(date,lat,lng,tz){
  const rad=Math.PI/180,sin=x=>Math.sin(x*rad),cos=x=>Math.cos(x*rad),tan=x=>Math.tan(x*rad);
  const asin=x=>Math.asin(x)/rad,acos=x=>Math.acos(clamp(x,-1,1))/rad,atan2=(y,x)=>Math.atan2(y,x)/rad;
  const D=Math.floor((date-new Date(Date.UTC(2000,0,1,12)))/864e5)-0.5;
  const g=(357.529+0.98560028*D)%360, q=(280.459+0.98564736*D)%360;
  const Ls=(q+1.915*sin(g)+0.020*sin(2*g))%360;
  const e=23.439-0.00000036*D;
  const RA=((atan2(cos(e)*sin(Ls),cos(Ls))+360)%360)/15;
  const decl=asin(sin(e)*sin(Ls));
  const EqT=q/15-RA;
  const dhuhr=12+tz-lng/15-EqT;
  const Tt=a=>acos((-sin(a)-sin(decl)*sin(lat))/(cos(decl)*cos(lat)))/15;
  const asrT=()=>{const a=Math.atan(1/(1+tan(Math.abs(lat-decl))))/rad;
    return acos((sin(a)-sin(decl)*sin(lat))/(cos(decl)*cos(lat)))/15};
  const f=h=>m2t(Math.round(((h%24)+24)%24*60));
  return {fajr:f(dhuhr-Tt(19.5)),sunrise:f(dhuhr-Tt(0.833)),dhuhr:f(dhuhr+2/60),
    asr:f(dhuhr+asrT()),maghrib:f(dhuhr+Tt(0.833)),isha:f(dhuhr+Tt(17.5))};
}
const PRAYER_NAMES={fajr:['Fajr','الفجر'],dhuhr:['Dhuhr','الظهر'],asr:['Asr','العصر'],maghrib:['Maghrib','المغرب'],isha:['Isha','العشاء']};
function prayerBlocks(date){
  if(!P.prayers)return [];
  const cached=DB.prayerCache&&DB.prayerCache[date];
  const t=cached||prayerTimes(new Date(date+'T12:00'),P.lat,P.lng,P.tz);
  return ['fajr','dhuhr','asr','maghrib','isha'].map(k=>({id:'pr-'+k,type:'prayer',fixed:true,
    title:L(PRAYER_NAMES[k][0],PRAYER_NAMES[k][1]),start:t2m(t[k]),end:t2m(t[k])+20}));
}
/* Optional online lookup (Aladhan API) — used only when the device is online; falls back to the
   offline calculation above automatically, so prayer times always work even with no internet. */
async function fetchOnlinePrayerTimes(date){
  if(!navigator.onLine)return null;
  try{
    const d=new Date(date+'T12:00');
    const url='https://api.aladhan.com/v1/timings/'+Math.floor(d.getTime()/1000)+
      '?latitude='+P.lat+'&longitude='+P.lng+'&method=5'; // method 5 = Egyptian General Authority
    const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),4000);
    const res=await fetch(url,{signal:ctrl.signal});clearTimeout(t);
    if(!res.ok)return null;
    const j=await res.json();const tm=j&&j.data&&j.data.timings;if(!tm)return null;
    const clean=s=>(s||'').split(' ')[0];
    return {fajr:clean(tm.Fajr),dhuhr:clean(tm.Dhuhr),asr:clean(tm.Asr),maghrib:clean(tm.Maghrib),isha:clean(tm.Isha)};
  }catch(e){return null}
}
async function refreshOnlinePrayerTimes(){
  if(!P.prayers||!P.prayerAuto)return;
  const days=[dkey(),dkey(new Date(Date.now()+864e5))];
  DB.prayerCache=DB.prayerCache||{};
  for(const d of days){
    const t=await fetchOnlinePrayerTimes(d);
    if(t){DB.prayerCache[d]=t}
  }
  save();
}

/* ---------- modal helpers ---------- */
function modal(title,body,buttons,opts={}){
  return new Promise(res=>{
    const s=document.createElement('div');s.className='scrim';
    s.innerHTML='<div class="modal'+(opts.wide?' wide':'')+'" role="dialog" aria-modal="true"><h2>'+esc(title)+'</h2><div class="mbody">'+body+'</div><div class="mfoot"></div></div>';
    const f=$('.mfoot',s);
    (buttons||[{k:null,label:L('Cancel','إلغاء')},{k:'ok',label:L('Save','حفظ'),pri:1}]).forEach(b=>{
      const el=document.createElement('button');el.className='btn'+(b.pri?' pri':'');el.textContent=b.label;
      el.onclick=()=>{const v=b.k===null?null:(opts.collect?opts.collect(s,b.k):b.k);s.remove();res(v)};f.appendChild(el)});
    s.addEventListener('click',e=>{if(e.target===s){s.remove();res(null)}});
    $('#modals').appendChild(s);const fi=s.querySelector('input,select,textarea');if(fi)fi.focus();
  });
}
const fld=(k,label,type='text',val='',extra='')=>'<label class="f"><span>'+esc(label)+'</span><input data-k="'+k+'" type="'+type+'" value="'+esc(val)+'" '+extra+'></label>';
const tarea=(k,label,val='')=>'<label class="f"><span>'+esc(label)+'</span><textarea data-k="'+k+'">'+esc(val)+'</textarea></label>';
const sel=(k,label,opts,val)=>'<label class="f"><span>'+esc(label)+'</span><select data-k="'+k+'">'+opts.map(o=>'<option value="'+esc(o[0])+'"'+(String(o[0])===String(val)?' selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select></label>';
const grab=r=>{const o={};$$('[data-k]',r).forEach(e=>{o[e.dataset.k]=e.type==='checkbox'?e.checked:e.value});return o};
const collectAll=(s,k)=>Object.assign({_:k},grab(s));
const BTN={cancel:()=>({k:null,label:L('Cancel','إلغاء')}),save:()=>({k:'ok',label:L('Save','حفظ'),pri:1}),
  add:()=>({k:'ok',label:L('Add','إضافة'),pri:1}),close:()=>({k:'ok',label:L('Close','إغلاق'),pri:1})};

/* =========================================================
   ENGINE
   ========================================================= */
const TYPE={
 study:{c:'var(--study)',i:'📚',n:['Study','مذاكرة']}, revision:{c:'#F5C95B',i:'🔁',n:['Revision','مراجعة']},
 gaming:{c:'var(--play)',i:'🎮',n:['Gaming','ألعاب']}, break:{c:'var(--rest)',i:'☕',n:['Break','استراحة']},
 class:{c:'#8FA1C7',i:'🏫',n:['Class','محاضرة']}, work:{c:'#C78FB4',i:'💼',n:['Work','شغل']},
 meal:{c:'#E0A96D',i:'🍽',n:['Meal','وجبة']}, exercise:{c:'#6FD3C0',i:'🏃',n:['Exercise','رياضة']},
 prayer:{c:'#9DD37A',i:'🕌',n:['Prayer','صلاة']}, personal:{c:'#9AA6C4',i:'📌',n:['Personal','شخصي']},
 sleep:{c:'#4E5B7E',i:'😴',n:['Sleep','نوم']}
};
const tname=t=>L((TYPE[t]||TYPE.personal).n[0],(TYPE[t]||TYPE.personal).n[1]);
const nowMin=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()};

function dayEvents(k){
  const dow=new Date(k+'T12:00').getDay();
  const ev=DB.events.filter(e=>e.repeat==='weekly'?(e.days||[]).includes(dow):e.date===k)
    .map(e=>({id:e.id,start:t2m(e.start),end:t2m(e.end),title:e.title,type:e.type||'personal',fixed:true}));
  return ev.concat(prayerBlocks(k)).sort((a,b)=>a.start-b.start);
}
function priority(s){
  const ex=DB.exams.filter(e=>!e.done&&e.subjectId===s.id&&daysTo(e.date)>=0).sort((a,b)=>daysTo(a.date)-daysTo(b.date))[0];
  const d=ex?clamp(daysTo(ex.date),0,60):60;
  const remain=Math.max(0,(s.pages||0)-(s.pagesDone||0));
  const score=(100/(d+2))*1.8 + Math.min(40,remain/Math.max(1,s.pages||1)*40)
    + (s.difficulty||3)*4 + (6-(s.confidence||3))*5 + (100-(s.avgScore==null?70:s.avgScore))/6;
  return {score,days:d,exam:ex,remain};
}
const rankedSubjects=()=>DB.subjects.map(s=>Object.assign({},s,priority(s))).sort((a,b)=>b.score-a.score);
function pacing(s){
  const ex=DB.exams.filter(e=>!e.done&&e.subjectId===s.id&&daysTo(e.date)>=0).sort((a,b)=>daysTo(a.date)-daysTo(b.date))[0];
  const days=Math.max(1,ex?daysTo(ex.date):14);
  const remain=Math.max(0,(s.pages||0)-(s.pagesDone||0));
  const startDays=Math.max(days,s.planDays||days);
  const expected=(s.pages||0)*(1-days/startDays);
  return {days,remain,perDay:remain/days,behind:Math.max(0,Math.round(expected-(s.pagesDone||0)))};
}
/* when am I actually good at focusing? */
function bestHours(){
  const buck={};
  DB.sessions.filter(s=>s.type==='study'&&s.hour!=null).forEach(s=>{
    const b=buck[s.hour]=buck[s.hour]||{n:0,f:0};b.n++;b.f+=(s.focus||75)});
  return Object.entries(buck).filter(([h,b])=>b.n>=2).map(([h,b])=>[+h,b.f/b.n]).sort((a,b)=>b[1]-a[1]).slice(0,5);
}
const isPeak=h=>bestHours().some(b=>b[0]===h);

function freeSlots(k){
  const wake=t2m(P.wake),slp=t2m(P.sleep);const end=slp<=wake?slp+1440:slp;
  let slots=[[wake,end]];
  dayEvents(k).forEach(ev=>{const out=[];
    slots.forEach(([a,b])=>{
      if(ev.end<=a||ev.start>=b){out.push([a,b]);return}
      if(ev.start>a)out.push([a,ev.start]);if(ev.end<b)out.push([ev.end,b])});
    slots=out});
  return slots.filter(s=>s[1]-s[0]>=20);
}
function generatePlan(k,opts={}){
  const energy=opts.energy||3, wants=opts.wants||['study','gaming','tasks'];
  const factor=[0,.5,.7,1,1.12,1.25][energy]||1;
  const sessLen=Math.round(clamp((P.sessionLen||45)*(energy<=2?.65:energy>=5?1.12:1),20,90)/5)*5;
  let budget=Math.round((P.vacation?P.vacationMins:P.studyGoal)*factor);
  if(P.examMode)budget=Math.round(budget*1.2);
  if(!wants.includes('study'))budget=0;
  const blocks=dayEvents(k).map(e=>Object.assign({},e));
  const slots=freeSlots(k);
  const rank=rankedSubjects();
  const revs=dueRevisions(k);
  const tasks=DB.tasks.filter(t=>!t.done).sort((a,b)=>daysTo(a.due)-daysTo(b.due));
  const total=rank.reduce((a,s)=>a+s.score,0)||1;
  const quota={};rank.forEach(s=>quota[s.id]=Math.round(budget*s.score/total));
  const why=[];let placed=0,turn=0,since=0,ti=0,ri=0;
  for(const [a,b] of slots){
    let cur=a;
    while(b-cur>=25&&placed<budget){
      const avail=rank.filter(s=>quota[s.id]>=20);if(!avail.length)break;
      // in a peak hour, take the hardest subject; otherwise rotate
      const peak=isPeak(Math.floor(cur/60));
      const s=peak?avail[0]:avail[turn++%avail.length];
      const len=Math.min(sessLen,quota[s.id],b-cur,budget-placed);
      if(len<20)break;
      let type='study',title=L('Study ','مذاكرة ')+s.name;
      if(revs[ri]&&(P.examMode||since%2===1)){type='revision';title=L('Revise ','مراجعة ')+(DB.subjects.find(x=>x.id===revs[ri].subjectId)||{name:''}).name;ri++}
      blocks.push({id:uid(),start:cur,end:cur+len,type,subjectId:s.id,title,peak});
      quota[s.id]-=len;placed+=len;cur+=len;since++;
      if(why.length<4&&s.exam&&!why.some(w=>w.s===s.name))why.push({s:s.name,d:s.days,r:pacing(s).remain});
      if(peak&&!why.some(w=>w.peak))why.push({peak:Math.floor(cur/60)});
      const br=since%3===0?P.breakLong:P.breakShort;
      if(b-cur>=br+20){blocks.push({id:uid(),start:cur,end:cur+br,type:'break',
        title:br>15?L('Long break','استراحة طويلة'):L('Short break','استراحة قصيرة')});cur+=br}
    }
    if(wants.includes('tasks')&&tasks[ti]&&b-cur>=30){
      const t=tasks[ti++],len=Math.min(t.est||30,b-cur);
      blocks.push({id:uid(),start:cur,end:cur+len,type:'personal',title:L('Task: ','مهمة: ')+t.title,taskId:t.id});cur+=len}
  }
  if(wants.includes('gaming')){
    const allow=gamingAllowance(k),last=slots[slots.length-1];
    if(last&&allow>=20){const st=Math.max(last[0],last[1]-allow);
      if(!blocks.some(x=>x.start<last[1]&&x.end>st&&x.type!=='break'))
        blocks.push({id:uid(),start:st,end:st+Math.min(allow,last[1]-st),type:'gaming',title:L('Gaming','وقت اللعب')})}
  }
  blocks.sort((a,b)=>a.start-b.start);
  for(let i=1;i<blocks.length;i++)
    if(!blocks[i].fixed&&!blocks[i-1].fixed&&blocks[i].start<blocks[i-1].end)blocks[i].start=blocks[i-1].end;
  return {date:k,energy,wants,created:Date.now(),studyPlanned:placed,why,
    blocks:blocks.filter(b=>b.end>b.start)};
}
function explainPlan(p){
  const out=p.why.map(w=>w.peak!=null
    ? L('Your hardest subject sits at '+pad(w.peak)+':00 — that is when your focus scores are highest.',
        'أصعب مادة اتحطت الساعة '+pad(w.peak)+':00 لأن ده وقت أعلى تركيز عندك حسب جلساتك السابقة.')
    : L(w.s+': exam in '+w.d+' days and '+w.r+' pages left, so it got more time today.',
        w.s+': الامتحان بعد '+dayN(w.d)+' وفاضل '+w.r+' صفحة، فأخدت وقت أكبر النهاردة.'));
  if(P.prayers)out.push(L('Prayer times are reserved and study never crosses them.','مواقيت الصلاة محجوزة والمذاكرة مبتتعداش عليها.'));
  if(!out.length)out.push(L('No exam is close, so the load is spread evenly.','مفيش امتحان قريب، فالحمل موزّع بالتساوي.'));
  return out;
}
const planFor=k=>DB.plans[k]||null;
function realism(p){
  const study=p.blocks.filter(b=>b.type==='study'||b.type==='revision').reduce((a,b)=>a+(b.end-b.start),0);
  const wake=t2m(P.wake),slp=t2m(P.sleep),awake=(slp<=wake?slp+1440:slp)-wake;
  return {study,sleep:1440-awake,risky:study>600||1440-awake<330};
}
/* revision cycles: 1, 3, 7, 14, 30 days after finishing a chunk */
const REV=[1,3,7,14,30];
function scheduleRevision(subjectId,label){
  REV.forEach((d,i)=>DB.revisions.push({id:uid(),subjectId,label,due:dkey(new Date(Date.now()+d*864e5)),step:i,done:false}));
}
const dueRevisions=k=>DB.revisions.filter(r=>!r.done&&r.due<=k);

/* ---------- metrics ---------- */
const mins=(k,t)=>DB.sessions.filter(s=>s.date===k&&(t==='study'?(s.type==='study'||s.type==='revision'):s.type===t)).reduce((a,s)=>a+s.mins,0);
const studyMinutes=k=>mins(k,'study'), gamingMinutes=k=>mins(k,'gaming'), sleepMins=k=>mins(k,'sleep');
function focusAvg(k){const f=DB.sessions.filter(s=>s.date===k&&s.focus);return f.length?Math.round(f.reduce((a,s)=>a+s.focus,0)/f.length):0}
function gamingAllowance(k){
  if(P.gamingMode==='fixed')return P.gamingGoal||0;
  return Math.round(studyMinutes(k)/60*(P.ratio||45))+(DB.bonusGaming&&DB.bonusGaming[k]||0);
}
function sleepDebt(){let d=0;for(let i=1;i<=7;i++){const k=dkey(new Date(Date.now()-i*864e5));const s=sleepMins(k);if(s)d+=480-s}return d}
function logSession(o){
  DB.sessions.push(Object.assign({id:uid(),date:dkey(),ts:Date.now(),hour:new Date().getHours()},o));
  DB.xp=(DB.xp||0)+(o.type==='gaming'?2:Math.round(o.mins/5));checkBadges();save();
}
const studyTotal=()=>DB.sessions.filter(s=>s.type==='study'||s.type==='revision').reduce((a,s)=>a+s.mins,0);
function streak(){let n=0;for(let i=0;i<400;i++){const k=dkey(new Date(Date.now()-i*864e5));
  if(DB.sessions.some(s=>s.date===k&&(s.type==='study'||s.type==='revision'))||DB.freezeDays.includes(k))n++;
  else if(i>0)break;else continue}return n}
const BADGES=[
 ['b5',['First 5 focus sessions','أول ٥ جلسات تركيز'],()=>DB.sessions.filter(s=>s.type==='study').length>=5],
 ['b10h',['10 hours focused','١٠ ساعات تركيز'],()=>studyTotal()>=600],
 ['b25h',['25 hours studied','٢٥ ساعة مذاكرة'],()=>studyTotal()>=1500],
 ['b50h',['50 hours studied','٥٠ ساعة مذاكرة'],()=>studyTotal()>=3000],
 ['b100h',['100 hours studied','١٠٠ ساعة مذاكرة'],()=>studyTotal()>=6000],
 ['bq',['First perfect quiz','أول اختبار كامل الدرجة'],()=>DB.quizRuns.some(q=>q.score===100)],
 ['s7',['7 day consistency','٧ أيام متواصلة'],()=>streak()>=7],
 ['s14',['14 day consistency','١٤ يوم متواصل'],()=>streak()>=14],
 ['s30',['30 day consistency','٣٠ يوم متواصل'],()=>streak()>=30],
 ['sub1',['First subject completed','أول مادة خلصت'],()=>DB.subjects.some(s=>s.pages&&s.pagesDone>=s.pages)],
 ['ex1',['First exam completed','أول امتحان اتعدّى'],()=>DB.exams.some(e=>e.done)],
 ['dawn',['Studied before 8 AM','مذاكرة قبل ٨ الصبح'],()=>DB.sessions.some(s=>s.type==='study'&&s.hour<8)],
 ['bal',['A balanced week','أسبوع متوازن'],()=>{const w=[...Array(7)].map((_,i)=>dkey(new Date(Date.now()-i*864e5)));
   return w.every(k=>studyMinutes(k)>0)&&w.reduce((a,k)=>a+gamingMinutes(k),0)>0}]
];
function checkBadges(){BADGES.forEach(b=>{if(!DB.badges.includes(b[0])&&b[2]()){DB.badges.push(b[0]);DB.xp+=50;
  toast('🏆 '+L(b[1][0],b[1][1]))}})}

/* =========================================================
   SHELL
   ========================================================= */
const APP_NAME='ORBIX';
const APP_VERSION='1.1.0';
const CHANGELOG=[
 ['1.1.0',['Owner dashboard, coins economy, cooldown spin wheel, two new mini-games, online prayer-time lookup, optional AI chat, account security tools.',
           'لوحة المالك، عملة الجواهر، عجلة حظ بفترة انتظار، لعبتين جداد، مواقيت صلاة أونلاين، محادثة ذكاء اصطناعي اختيارية، أدوات أمان للحساب.']],
 ['1.0.0',['First release: bilingual planner, scheduler, focus timer, gaming balance, achievements.',
           'الإصدار الأول: مخطط بلغتين، مجدول ذكي، مؤقت تركيز، توازن مذاكرة/لعب، إنجازات.']]
];
/* global, device-wide settings the owner controls for everyone on this device */
const GLOBAL_DEFAULTS={dailySpinCap:3,spinCooldownHours:7,spinBuyCost:8};
function globalCfg(){return Object.assign({},GLOBAL_DEFAULTS,LS.get('sf:global',{}))}
function setGlobalCfg(o){LS.set('sf:global',Object.assign(globalCfg(),o))}
const NAV=[['dashboard','🏠',['Dashboard','الرئيسية']],['owner','🛡',['Owner','لوحة المالك']],['schedule','📅',['Schedule','الجدول']],
 ['subjects','📚',['Subjects','المواد']],['tasks','✅',['Tasks','المهام']],['focus','🎯',['Focus','التركيز']],
 ['gaming','🎮',['Gaming','الألعاب']],['sleep','😴',['النوم','النوم']],['notes','📝',['Notes','الملاحظات']],
 ['cards','🧠',['Flashcards','البطاقات']],['quiz','❓',['Quizzes','الاختبارات']],['exams','📖',['Exams','الامتحانات']],
 ['goals','🥅',['Goals','الأهداف']],['grades','🎓',['Grades','الدرجات']],['journal','📓',['Journal','المذكرات']],
 ['ai','🤖',['AI assistant','المساعد الذكي']],['stats','📊',['Analytics','التحليلات']],
 ['badges','🏆',['Achievements','الإنجازات']],['settings','⚙',['Settings','الإعدادات']]];
const navName=r=>{const n=NAV.find(x=>x[0]===r);return n?L(n[2][0],n[2][1]):r};
NAV[6][2]=['Sleep','النوم'];
const TABS=['dashboard','schedule','focus','gaming','stats'];
let route='dashboard',schedDate=dkey(),hmMetric='study';
const go=r=>{route=r;render();const v=$('#view');if(v)v.scrollTop=0};

function shell(){
  $('#shell').innerHTML=
  '<aside id="side"><div class="brand"><div class="mark"></div><div><b>ORBIX</b><small>'+
    L('Study smart. Play better.','ذاكر بذكاء. العب براحتك.')+'</small></div></div>'+
  '<nav id="nav">'+NAV.filter(n=>n[0]!=='owner'||(SESSION&&SESSION.isOwner)).map(n=>'<button class="navb" data-r="'+n[0]+'"><i>'+n[1]+'</i><span>'+L(n[2][0],n[2][1])+(n[0]==='owner'?' <span class="badge-owner">OWNER</span>':'')+'</span></button>').join('')+'</nav>'+
  '<div class="sidefoot"><button class="btn sm ghost" id="profBtn" style="flex:1;text-align:start"></button>'+
  '<button class="btn sm ghost" id="langBtn" title="AR/EN">'+(AR()?'EN':'ع')+'</button>'+
  '<button class="btn sm ghost" id="themeBtn" title="theme">◐</button>'+
  '<button class="btn sm ghost" id="logoutBtn" title="logout">⏻</button></div></aside>'+
  '<div id="main"><header id="top">'+
   '<div id="searchbox"><span class="dim">⌕</span><input id="q" placeholder="'+L('Search subjects, tasks, notes…','ابحث في المواد والمهام والملاحظات…')+'"><kbd>Ctrl K</kbd></div>'+
   '<div class="spacer"></div><span class="pill" id="xpPill"></span>'+
   '<button class="btn sm" id="quickFocus">⏱ '+L('Focus','تركيز')+'</button></header>'+
  '<main id="view"></main></div>'+
  '<nav id="tabs">'+TABS.map(t=>'<button data-r="'+t+'"><i>'+NAV.find(n=>n[0]===t)[1]+'</i>'+navName(t)+'</button>').join('')+
   '<button data-r="__more"><i>☰</i>'+L('More','المزيد')+'</button></nav>';
  $$('#nav .navb,#tabs button').forEach(b=>b.onclick=()=>b.dataset.r==='__more'?moreMenu():go(b.dataset.r));
  $('#q').onfocus=()=>openPalette('');
  $('#quickFocus').onclick=()=>startFocus();
  $('#themeBtn').onclick=()=>{P.theme=P.theme==='light'?'dark':'light';save();applyChrome()};
  $('#langBtn').onclick=()=>{P.lang=AR()?'en':'ar';save();applyChrome();shell();render()};
  $('#profBtn').onclick=accountMenu;
  $('#logoutBtn').onclick=async()=>{
    if(await modal(L('Sign out','تسجيل الخروج'),'<p class="mut">'+L('Your data stays saved on this device.','بياناتك هتفضل محفوظة على جهازك.')+'</p>',
      [BTN.cancel(),{k:'ok',label:L('Sign out','خروج'),pri:1}]))logout();
  };
  $('#fab').onclick=quickCapture;
  $('#fab').title=L('Quick capture','التقاط سريع');
}
function moreMenu(){
  const rest=NAV.filter(n=>!TABS.includes(n[0])&&(n[0]!=='owner'||(SESSION&&SESSION.isOwner)));
  modal(L('All sections','كل الأقسام'),'<div class="grid g2">'+rest.map(n=>'<button class="btn wide" data-go="'+n[0]+'">'+n[1]+' '+L(n[2][0],n[2][1])+'</button>').join('')+'</div>',[BTN.cancel()]);
  setTimeout(()=>$$('#modals [data-go]').forEach(b=>b.onclick=()=>{$('.scrim').remove();go(b.dataset.go)}),0);
}
function accountMenu(){
  modal(L('Account','الحساب'),
   '<div class="row" style="margin-bottom:14px"><span class="avatar sm">'+esc((P.name||SESSION.username)[0].toUpperCase())+'</span><span class="tag">@'+esc(SESSION.username)+'</span>'+
   (SESSION.isOwner?'<span class="badge-owner">OWNER</span>':'')+'</div>'+
   '<button class="btn wide" data-act2="rename" style="margin-bottom:8px">'+L('Change display name','غيّر اسم العرض')+'</button>'+
   '<button class="btn wide" data-act2="pw" style="margin-bottom:8px">'+L('Change password','غيّر كلمة السر')+'</button>'+
   '<button class="btn wide" data-act2="log" style="margin-bottom:8px">'+L('Security log','سجل الأمان')+'</button>'+
   '<button class="btn wide" data-act2="backup" style="margin-bottom:8px">'+L('Protected backup (with passphrase)','نسخة محمية بكلمة سر')+'</button>'+
   '<button class="btn wide ghost" data-act2="signout" style="margin-bottom:8px">'+L('Sign out','تسجيل الخروج')+'</button>'+
   '<button class="btn wide ghost" data-act2="delacc" style="color:var(--warn)">'+L('Delete my account','احذف حسابي نهائيًا')+'</button>',
   [BTN.close()]);
  setTimeout(()=>{
    const sc=$('.scrim');
    const b=k=>$('[data-act2="'+k+'"]',sc);
    if(b('rename'))b('rename').onclick=async()=>{sc.remove();
      const r=await modal(L('Display name','اسم العرض'),fld('n',L('Name','الاسم'),'text',P.name),[BTN.cancel(),BTN.save()],{collect:collectAll});
      if(r&&r.n){P.name=r.n;const us=users().map(u=>u.id===SESSION.id?Object.assign(u,{name:r.n}):u);saveUsers(us);SESSION.name=r.n;LS.set('sf:session',SESSION);refresh();shell();render()}};
    if(b('pw'))b('pw').onclick=async()=>{sc.remove();
      const r=await modal(L('Change password','غيّر كلمة السر'),
        fld('cur',L('Current password','كلمة السر الحالية'),'password')+fld('n1',L('New password','كلمة سر جديدة'),'password')+fld('n2',L('Confirm','تأكيد'),'password'),
        [BTN.cancel(),BTN.save()],{collect:collectAll});
      if(!r)return;
      const u=users().find(x=>x.id===SESSION.id);
      const curHash=await sha256hex(u.salt+(r.cur||''));
      if(curHash!==u.hash)return toast(L('Current password is wrong','كلمة السر الحالية غلط'));
      if((r.n1||'').length<6)return toast(L('New password must be at least 6 characters','كلمة السر الجديدة لازم ٦ حروف على الأقل'));
      if(r.n1!==r.n2)return toast(L('Passwords do not match','كلمتا السر مش متطابقتين'));
      const salt=randSalt(),hash=await sha256hex(salt+r.n1);
      saveUsers(users().map(x=>x.id===SESSION.id?Object.assign(x,{salt,hash}):x));
      toast(L('Password updated','كلمة السر اتحدثت'))};
    if(b('signout'))b('signout').onclick=()=>{sc.remove();logout()};
    if(b('log'))b('log').onclick=()=>{sc.remove();showSecurityLog()};
    if(b('backup'))b('backup').onclick=()=>{sc.remove();ACT.protectedExport()};
    if(b('delacc'))b('delacc').onclick=async()=>{
      sc.remove();
      const c1=await modal(L('Delete your account?','تحذف حسابك؟'),
        '<p class="mut">'+L('This permanently removes your login and every subject, session, note and journal entry. This cannot be undone.','ده هيمسح حسابك نهائيًا وكل موادك وجلساتك وملاحظاتك ومذكراتك. مفيش رجوع بعد كده.')+'</p>',
        [BTN.cancel(),{k:'ok',label:L('Continue','كمّل')}]);
      if(!c1)return;
      const r=await modal(L('Confirm with your password','أكّد بكلمة السر'),fld('pw',L('Password','كلمة السر'),'password'),
        [BTN.cancel(),{k:'ok',label:L('Delete forever','امسح نهائيًا'),pri:1}],{collect:collectAll});
      if(!r)return;
      const u=users().find(x=>x.id===SESSION.id);
      const hash=await sha256hex(u.salt+(r.pw||''));
      if(hash!==u.hash)return toast(L('Wrong password — account not deleted.','كلمة السر غلط — الحساب متمسحش.'));
      save();saveUsers(users().filter(x=>x.id!==SESSION.id));
      localStorage.removeItem('sf:p:'+SESSION.id);
      SESSION=null;LS.set('sf:session',null);
      document.getElementById('shell').innerHTML='';document.title=APP_NAME;
      toast(L('Account deleted','الحساب اتمسح'));renderAuth();
    };
  },0);
}
function showSecurityLog(){
  const log=DB.securityLog||[];
  modal(L('Security log','سجل الأمان'),
   (log.length?'<div class="list" style="max-height:50vh;overflow:auto">'+log.map(e=>{
     const d=new Date(e.ts);
     return '<div class="item"><span>'+(e.ok?'✅':'⚠️')+'</span><div class="grow"><div class="t">'+
       (e.kind==='login'?L('Sign-in ','تسجيل دخول '):e.kind)+(e.ok?L('succeeded','نجح'):L('failed','فشل'))+'</div>'+
       '<div class="s">'+d.toLocaleString()+'</div></div></div>'}).join('')+'</div>'
    :'<div class="empty">'+L('No events yet.','مفيش أحداث لسه.')+'</div>')+
   '<p class="xs dim" style="margin-top:10px">'+L('Kept only on this device, visible only to you.','متخزنة على جهازك بس، وتشوفها إنت لوحدك.')+'</p>',
   [BTN.close()]);
}
async function quickCapture(){
  const r=await modal(L('Quick capture','التقاط سريع'),
   '<p class="sm mut">'+L('Write it down now, sort it later.','اكتبها دلوقتي ورتبها بعدين.')+'</p>'+
   fld('t',L('Anything on your mind','أي حاجة في دماغك'))+
   sel('kind',L('Send it to','ابعتها لـ'),[['inbox',L('Inbox','الوارد')],['task',L('Tasks','المهام')],['note',L('Notes','ملاحظة')],['journal',L('Journal','المذكرات')]],'inbox'),
   [BTN.cancel(),BTN.add()],{collect:collectAll});
  if(!r||!r.t)return;
  if(r.kind==='task')DB.tasks.push({id:uid(),title:r.t,est:30,done:false});
  else if(r.kind==='note')DB.notes.push({id:uid(),title:r.t.slice(0,40),body:r.t,tags:[],date:dkey()});
  else if(r.kind==='journal')DB.journal.push({id:uid(),date:dkey(),section:L('Thoughts','خواطر'),text:r.t,tags:[]});
  else DB.inbox.push({id:uid(),t:r.t,date:dkey()});
  save();toast(L('Captured','اتسجلت'));render();
}

/* =========================================================
   RENDER
   ========================================================= */
const V={};
function render(){
  $$('#nav .navb').forEach(b=>b.classList.toggle('on',b.dataset.r===route));
  $$('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.r===route));
  $('#xpPill').innerHTML='✦ '+N(DB.xp||0)+' XP · 🔥'+N(streak());
  $('#profBtn').textContent='👤 '+(P.name||L('Student','طالب'));
  $('#view').innerHTML='<div class="wrap">'+(V[route]?V[route]():'')+'</div>';
  $$('#view [data-act]').forEach(el=>el.onclick=()=>ACT[el.dataset.act]&&ACT[el.dataset.act](el.dataset,el));
  $$('#view [data-go]').forEach(el=>el.onclick=()=>go(el.dataset.go));
  const sd=$('#sd');if(sd)sd.onchange=()=>{schedDate=sd.value;render()};
  const jq=$('#jq');if(jq)jq.oninput=()=>{DB._jq=jq.value;const v=jq.value;render();const n=$('#jq');if(n){n.focus();n.value=v;n.setSelectionRange(v.length,v.length)}};
}
const bar=(pct,c)=>'<div class="bar"><i style="width:'+clamp(pct,0,100)+'%;background:'+(c||'var(--study)')+'"></i></div>';
function blockRow(b){
  const now=nowMin(),live=now>=b.start&&now<b.end,t=TYPE[b.type]||TYPE.personal;
  return '<div class="blkrow'+(b.done?' done':'')+(live?' now':'')+'">'+
   '<div class="time">'+m2t(b.start)+'<br><span class="dim">'+m2t(b.end)+'</span></div>'+
   '<div class="stripe" style="background:'+t.c+'"></div>'+
   '<div class="grow"><div class="t">'+t.i+' '+esc(b.title)+(b.peak?' <span class="tag">'+L('peak hour','وقت ذروتك')+'</span>':'')+'</div>'+
   '<div class="s">'+hm(b.end-b.start)+(b.done?' · '+L('done','تمت'):'')+'</div></div>'+
   (b.fixed?'':'<button class="btn sm" data-act="toggleBlock" data-id="'+b.id+'">'+(b.done?'↺':'✓')+'</button>'+
     (b.type==='study'||b.type==='revision'?'<button class="btn sm pri" data-act="startBlock" data-id="'+b.id+'">▶</button>':
      b.type==='gaming'?'<button class="btn sm play" data-act="startGame">▶</button>':'')+
     '<button class="btn sm ghost" data-act="delBlock" data-id="'+b.id+'">✕</button>')+'</div>';
}

/* ---------- DASHBOARD ---------- */
V.dashboard=()=>{
  const k=dkey(),plan=planFor(k),now=nowMin(),h=new Date().getHours();
  const st=studyMinutes(k),gm=gamingMinutes(k),goal=P.vacation?P.vacationMins:P.studyGoal;
  const allow=gamingAllowance(k);
  const slp=t2m(P.sleep),endDay=(slp<=t2m(P.wake)?slp+1440:slp);
  const doneT=DB.tasks.filter(t=>t.done).length;
  const hello=h<12?L('Good morning','صباح الخير'):h<18?L('Good afternoon','نهارك سعيد'):L('Good evening','مساء الخير');
  let hero;
  if(!plan)hero='<div class="empty"><b>'+hello+(P.name?'، '+esc(P.name):'')+'</b>'+
    L('No plan for today yet.','لسه مفيش خطة لليوم.')+'<div style="margin-top:12px"><button class="btn pri" data-act="checkin">'+L('Plan my day','اعملي خطة اليوم')+'</button></div></div>';
  else hero='<div id="ribbon">'+plan.blocks.map(b=>'<div class="blk" style="left:'+(b.start/1440*100)+'%;width:'+((b.end-b.start)/1440*100)+'%;background:'+(TYPE[b.type]||TYPE.personal).c+'"></div>').join('')+
    [0,6,12,18,24].map(x=>'<div class="hr" style="left:'+(x/24*100)+'%">'+pad(x)+':00</div>').join('')+
    '<div class="now" style="left:'+(now/1440*100)+'%"></div></div>';
  const nextB=plan?plan.blocks.find(b=>b.end>now&&!b.done):null;
  const exs=DB.exams.filter(e=>!e.done&&daysTo(e.date)>=0).sort((a,b)=>daysTo(a.date)-daysTo(b.date)).slice(0,5);
  const col=d=>d<=5?'🔴':d<=10?'🟠':d<=17?'🟡':'🟢';
  const pr=P.prayers?nextPrayer():null;
  return '<div class="head between"><div><h1>'+hello+(P.name?'، '+esc(P.name):'')+'</h1>'+
   '<p>'+(P.examMode?L('Exam mode on · ','وضع الامتحانات شغّال · '):'')+(P.vacation?L('Vacation mode on · ','وضع الإجازة شغّال · '):'')+
   L('Time left today: ','الوقت الباقي النهاردة: ')+'<b>'+N(hm(Math.max(0,endDay-now)))+'</b>'+
   (pr?' · '+L('Next prayer: ','الصلاة الجاية: ')+pr.name+' '+N(pr.time):'')+'</p></div>'+
   '<div class="row"><button class="btn" data-act="checkin">'+L('Daily check-in','تسجيل الصباح')+'</button>'+
   '<button class="btn" data-act="night">'+L('Night review','مراجعة الليل')+'</button></div></div>'+
  '<div class="card">'+hero+'<div class="row" style="margin-top:12px">'+
   ['study','gaming','break','class','prayer'].map(t=>'<span class="pill"><span class="dot" style="background:'+TYPE[t].c+'"></span>'+tname(t)+'</span>').join('')+'</div></div>'+
  '<button class="big" data-act="whatnow" style="margin-top:12px">⚡ '+L('What should I do now?','أعمل إيه دلوقتي؟')+'</button>'+
  '<div class="card" style="margin-top:12px;background:linear-gradient(120deg, var(--panel), var(--panel2))"><div class="between">'+
   '<p class="sm" style="margin:0;font-style:italic">"'+esc(todaysQuote())+'"</p>'+
   '<div class="row"><span class="pill">🪙 '+N(coins())+'</span>'+
   '<button class="btn sm'+(canSpinToday()?' pri':'')+'" data-act="openWheel">🎡 '+L('Spin','لف')+'</button></div></div></div>'+
  '<div class="grid g4" style="margin-top:12px">'+
   statCard(L('STUDY','مذاكرة'),st,goal,'var(--study)')+
   statCard(L('GAMING','ألعاب'),gm,Math.max(allow,P.gamingGoal||60),'var(--play)')+
   statCard(L('SLEEP','نوم'),sleepMins(k),480,'var(--rest)')+
   '<div class="card stat"><span>'+L('TASKS','مهام')+'</span><b>'+N(doneT+'/'+DB.tasks.length)+'</b>'+bar(doneT/Math.max(1,DB.tasks.length)*100,'var(--ok)')+'</div></div>'+
  '<div class="grid g2" style="margin-top:12px">'+
   '<div class="card"><div class="between head"><h2>'+L('Up next','الجاي دلوقتي')+'</h2><button class="btn sm" data-go="schedule">'+L('Full day','اليوم كامل')+'</button></div>'+
    (nextB?blockRow(nextB):'<div class="empty">'+L('Nothing scheduled.','مفيش حاجة في الجدول.')+
      '<div style="margin-top:10px"><button class="btn sm pri" data-act="checkin">'+L('Build today\'s plan','ابني خطة النهاردة')+'</button></div></div>')+
    (plan?'<div class="sm mut" style="margin-top:10px">'+esc(explainPlan(plan)[0])+'</div>':'')+'</div>'+
   '<div class="card"><h2 class="head">'+L('Deadline radar','رادار المواعيد')+'</h2>'+
    (exs.length?'<div class="list">'+exs.map(e=>{const d=daysTo(e.date),s=DB.subjects.find(x=>x.id===e.subjectId);
      return '<div class="item"><span>'+col(d)+'</span><div class="grow"><div class="t">'+esc(e.name||(s?s.name:''))+'</div>'+
       '<div class="s">'+N(e.date)+'</div></div><span class="tag">'+N(dayN(d))+'</span></div>'}).join('')+'</div>'
     :'<div class="empty"><b>'+L('No deadlines yet','مفيش مواعيد')+'</b>'+L('Add an exam to see the radar.','ضيف امتحان يظهر هنا.')+
      '<div style="margin-top:10px"><button class="btn sm" data-go="exams">'+L('Add exam','إضافة امتحان')+'</button></div></div>')+'</div></div>'+
  '<div class="card" style="margin-top:12px"><div class="between head"><h2>'+L('Today\'s priority','أولويات اليوم')+'</h2>'+
   '<span class="sm dim">'+L('calculated urgency, not a verdict on the subjects','ترتيب حسب الإلحاح المحسوب، مش حكم على المواد')+'</span></div>'+
   (DB.subjects.length?'<div class="list">'+rankedSubjects().slice(0,5).map((s,i)=>{const pc=pacing(s);
     return '<div class="item"><b class="dim">'+N(i+1)+'</b><div class="grow"><div class="t">'+esc(s.name)+'</div>'+
      '<div class="s">'+(s.exam?L('exam in ','الامتحان بعد ')+N(dayN(s.days))+' · ':'')+N(pc.remain)+' '+L('pages left','صفحة باقية')+' · '+
      N(Math.ceil(pc.perDay))+' '+L('pages/day','صفحة/يوم')+(pc.behind?' · <span style="color:var(--warn)">'+N(pc.behind)+' '+L('behind','متأخر')+'</span>':'')+'</div>'+
      bar((s.pagesDone||0)/Math.max(1,s.pages||1)*100)+'</div>'+
      '<button class="btn sm pri" data-act="studySub" data-id="'+s.id+'">'+L('Study','ذاكر')+'</button></div>'}).join('')+'</div>'
    :'<div class="empty"><b>'+L('No subjects yet','مفيش مواد')+'</b>'+L('Add what you are studying and ORBIX does the planning.','ضيف اللي بتذاكره وسيب الجدولة علينا.')+
     '<div style="margin-top:10px"><button class="btn sm pri" data-go="subjects">'+L('Add a subject','إضافة مادة')+'</button></div></div>')+'</div>'+
  (DB.inbox.length?'<div class="card" style="margin-top:12px"><div class="between head"><h2>'+L('Inbox','الوارد')+'</h2><span class="pill">'+N(DB.inbox.length)+'</span></div>'+
   '<div class="list">'+DB.inbox.slice(-5).reverse().map(x=>'<div class="item"><div class="grow"><div class="t">'+esc(x.t)+'</div></div>'+
    '<button class="btn sm" data-act="inbox2task" data-id="'+x.id+'">'+L('Make a task','خليها مهمة')+'</button>'+
    '<button class="btn sm ghost" data-act="delInbox" data-id="'+x.id+'">✕</button></div>').join('')+'</div></div>':'');
};
const statCard=(t,v,g,c)=>'<div class="card stat"><span>'+t+'</span><b>'+N(Math.round(g?v/g*100:0)+'%')+'</b>'+bar(g?v/g*100:0,c)+
  '<div class="xs dim" style="margin-top:6px">'+N(hm(v))+' / '+N(hm(g))+'</div></div>';
function nextPrayer(){
  const t=prayerTimes(new Date(),P.lat,P.lng,P.tz),now=nowMin();
  const list=['fajr','dhuhr','asr','maghrib','isha'].map(k=>({k,m:t2m(t[k]),time:t[k]}));
  const nx=list.find(x=>x.m>now)||list[0];
  return {name:L(PRAYER_NAMES[nx.k][0],PRAYER_NAMES[nx.k][1]),time:nx.time};
}

/* ---------- SCHEDULE ---------- */
V.schedule=()=>{
  const plan=planFor(schedDate),r=plan?realism(plan):null,beh=behindReport();
  const rev=dueRevisions(dkey());
  return '<div class="head between"><div><h1>'+L('Schedule','الجدول')+'</h1>'+
   '<p>'+L('Built around your fixed commitments — blocks never overlap.','متبني حوالين ارتباطاتك الثابتة — مفيش أي تداخل بين البلوكات.')+'</p></div>'+
   '<div class="row"><input type="date" id="sd" value="'+schedDate+'" style="width:auto"><button class="btn pri" data-act="regen">'+L('Build plan','ابني الخطة')+'</button></div></div>'+
   (beh.mins>15||beh.pages>0?'<div class="card" style="border-color:var(--warn)"><div class="between"><div><h3>'+L('You are behind','أنت متأخر شوية')+'</h3>'+
     '<p class="sm mut" style="margin:4px 0 0">'+(beh.pages?N(beh.pages)+' '+L('pages · ','صفحة · '):'')+N(hm(beh.mins))+' '+L('of planned study not done.','مذاكرة مخططة لسه متعملتش.')+'</p></div>'+
     '<button class="btn pri" data-act="catchup">'+L('Catch-up mode','وضع اللحاق')+'</button></div></div>':'')+
   (r&&r.risky?'<div class="card" style="border-color:var(--warn);margin-top:12px"><div class="between"><div><h3>'+L('This plan may be unrealistic','الخطة دي ممكن تكون غير واقعية')+'</h3>'+
     '<p class="sm mut" style="margin:4px 0 0">'+N(hm(r.study))+' '+L('of study against ','مذاكرة مقابل ')+N(hm(r.sleep))+' '+L('of sleep.','نوم.')+'</p></div>'+
     '<button class="btn" data-act="preset">'+L('Adjust it','عدّلها')+'</button></div></div>':'')+
   (rev.length?'<div class="card" style="margin-top:12px;border-color:var(--study)"><div class="between"><div><h3>'+L('Revision due today','مراجعة مستحقة النهاردة')+'</h3>'+
     '<p class="sm mut" style="margin:4px 0 0">'+rev.slice(0,3).map(x=>esc(x.label)).join(' · ')+'</p></div>'+
     '<button class="btn" data-act="doRev">'+L('Mark reviewed','تمت المراجعة')+'</button></div></div>':'')+
   '<div class="card" style="margin-top:12px">'+
   (plan?'<div class="between head"><h2>'+(schedDate===dkey()?L('Today','النهاردة'):N(schedDate))+'</h2>'+
     '<div class="row"><span class="pill">'+N(hm(plan.studyPlanned))+' '+L('study','مذاكرة')+'</span>'+
     '<button class="btn sm" data-act="addBlock">+ '+L('Block','بلوك')+'</button>'+
     '<button class="btn sm" data-act="exportDay">'+L('Export','تصدير')+'</button></div></div>'+
    '<div class="list">'+plan.blocks.map(blockRow).join('')+'</div>'+
    '<div class="card" style="margin-top:12px;background:var(--panel2)"><h3>'+L('Why this schedule?','ليه الجدول كده؟')+'</h3>'+
    '<ul class="sm mut" style="margin:8px 0 0;padding-inline-start:18px">'+explainPlan(plan).map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></div>'
    :'<div class="empty"><b>'+L('No plan for this day','مفيش خطة لليوم ده')+'</b>'+
     L('Pick your energy and what you want done, and ORBIX lays out the day.','قول طاقتك وعايز تخلّص إيه، وسيبه يرتب لك اليوم.')+
     '<div style="margin-top:12px"><button class="btn pri" data-act="regen">'+L('Build plan','ابني الخطة')+'</button></div></div>')+'</div>'+
   '<div class="card" style="margin-top:12px"><div class="between head"><h2>'+L('This week','الأسبوع ده')+'</h2>'+
     '<button class="btn sm" data-act="regenWeek">'+L('Rebuild week','ابني الأسبوع')+'</button></div>'+weekGrid()+'</div>'+
   '<div class="card" style="margin-top:12px"><div class="between head"><h2>'+L('Fixed commitments','الارتباطات الثابتة')+'</h2>'+
    '<button class="btn sm" data-act="addEvent">+ '+L('Add','إضافة')+'</button></div>'+
    (P.prayers?'<p class="xs dim" style="margin:-6px 0 10px">'+L('Prayer times are added automatically for your location and can be turned off in settings.','مواقيت الصلاة بتتحسب تلقائيًا حسب موقعك، وتقدر تقفلها من الإعدادات.')+'</p>':'')+
    (DB.events.length?'<div class="list">'+DB.events.map(e=>'<div class="item"><span>'+(TYPE[e.type]||TYPE.personal).i+'</span>'+
      '<div class="grow"><div class="t">'+esc(e.title)+'</div><div class="s">'+N(e.start)+'–'+N(e.end)+' · '+
      (e.repeat==='weekly'?(e.days||[]).map(d=>DAYS_S()[d]).join('، '):N(e.date))+'</div></div>'+
      '<button class="btn sm" data-act="attend" data-id="'+e.id+'">'+L('Attendance','الحضور')+'</button>'+
      '<button class="btn sm ghost" data-act="delEvent" data-id="'+e.id+'">✕</button></div>').join('')+'</div>'
     :'<div class="empty"><b>'+L('Nothing fixed yet','مفيش ارتباطات')+'</b>'+L('Classes, work, meals and gym go here — study is planned around them.','المحاضرات والشغل والوجبات والجيم هنا — والمذاكرة بتتبني حواليهم.')+'</div>')+'</div>'+
   '<div class="card" style="margin-top:12px"><h2 class="head">'+L('Import / export','استيراد وتصدير')+'</h2><div class="row">'+
    '<button class="btn" data-act="importFile">'+L('Import CSV / JSON / ICS','استيراد CSV / JSON / ICS')+'</button>'+
    '<button class="btn" data-act="exportWeek">'+L('Week as CSV','الأسبوع CSV')+'</button>'+
    '<button class="btn" data-act="exportJSON">'+L('Full backup (JSON)','نسخة احتياطية كاملة')+'</button>'+
    '<button class="btn" data-act="exportPDF">'+L('Printable PDF','PDF للطباعة')+'</button></div></div>';
};
function weekGrid(){
  const days=[...Array(7)].map((_,i)=>dkey(new Date(Date.now()+i*864e5)));
  return '<div class="wkgrid">'+days.map(d=>{const p=planFor(d),st=p?p.studyPlanned:0;
    const ex=DB.exams.filter(e=>e.date===d);
    return '<div class="d"><div class="xs dim">'+DAYS_S()[new Date(d+'T12:00').getDay()]+'</div>'+
     '<div class="sm" style="margin:4px 0">'+N(d.slice(8))+'</div>'+
     (p?'<div class="xs" style="color:var(--study)">'+N(hm(st))+'</div>':'<div class="xs dim">—</div>')+
     (ex.length?'<div class="xs" style="color:var(--warn);margin-top:4px">📖 '+esc(ex[0].name||'')+'</div>':'')+
     (mins(d,'study')?'<div class="xs" style="color:var(--ok);margin-top:4px">✓ '+N(hm(mins(d,'study')))+'</div>':'')+'</div>'}).join('')+'</div>';
}
function behindReport(){
  let m=0,pg=0;const k=dkey();
  Object.values(DB.plans).forEach(p=>{if(p.date>=k)return;
    p.blocks.filter(b=>(b.type==='study'||b.type==='revision')&&!b.done).forEach(b=>m+=b.end-b.start)});
  DB.subjects.forEach(s=>pg+=pacing(s).behind);
  return {mins:m,pages:pg};
}

/* ---------- SUBJECTS ---------- */
V.subjects=()=>{
  const list=rankedSubjects();
  const conf=c=>[L('Very low','ضعيفة جدًا'),L('Low','ضعيفة'),L('Medium','متوسطة'),L('High','عالية'),L('Very high','عالية جدًا')][(c||3)-1];
  return '<div class="head between"><div><h1>'+L('Subjects','المواد')+'</h1>'+
   '<p>'+L('Pages, difficulty and confidence feed the planner directly.','الصفحات والصعوبة والثقة بتغذّي المجدول مباشرة.')+'</p></div>'+
   '<button class="btn pri" data-act="addSub">+ '+L('Add','إضافة')+'</button></div>'+
  (list.length?'<div class="grid g2">'+list.map(s=>{const pc=pacing(s),pr=Math.round((s.pagesDone||0)/Math.max(1,s.pages||1)*100);
    return '<div class="card"><div class="between"><h2>'+esc(s.name)+'</h2>'+
     '<span class="pill">'+(s.exam?L('exam in ','الامتحان بعد ')+N(dayN(s.days)):L('no exam set','مفيش امتحان'))+'</span></div>'+
     '<div style="margin:10px 0">'+bar(pr)+'</div>'+
     '<div class="row sm mut"><span>'+N(s.pagesDone||0)+'/'+N(s.pages||0)+' '+L('pages','صفحة')+' ('+N(pr+'%')+')</span>'+
     '<span>·</span><span>'+N(Math.ceil(pc.perDay))+' '+L('pages/day to finish','صفحة/يوم علشان تخلّص')+'</span>'+
     (pc.behind?'<span style="color:var(--warn)">· '+N(pc.behind)+' '+L('pages behind','صفحة متأخرة')+'</span>':'')+'</div>'+
     '<div class="row" style="margin-top:10px"><span class="tag">'+L('difficulty ','الصعوبة ')+N((s.difficulty||3)+'/5')+'</span>'+
     '<span class="tag">'+L('confidence: ','الثقة: ')+conf(s.confidence)+'</span>'+
     (s.avgScore!=null?'<span class="tag">'+L('quiz avg ','متوسط الاختبارات ')+N(s.avgScore+'%')+'</span>':'')+'</div>'+
     '<div class="row" style="margin-top:12px"><button class="btn sm pri" data-act="studySub" data-id="'+s.id+'">'+L('Study now','ذاكر دلوقتي')+'</button>'+
     '<button class="btn sm" data-act="logPages" data-id="'+s.id+'">'+L('Log pages','سجّل صفحات')+'</button>'+
     '<button class="btn sm" data-act="confSub" data-id="'+s.id+'">'+L('Confidence','الثقة')+'</button>'+
     '<button class="btn sm" data-act="editSub" data-id="'+s.id+'">'+L('Edit','تعديل')+'</button>'+
     '<button class="btn sm ghost" data-act="delSub" data-id="'+s.id+'">✕</button></div></div>'}).join('')+'</div>'
   :'<div class="empty"><b>'+L('No subjects yet','مفيش مواد')+'</b>'+L('Add a subject with its page count and exam date.','ضيف مادة بعدد صفحاتها وتاريخ امتحانها.')+
    '<div style="margin-top:12px"><button class="btn pri" data-act="addSub">'+L('Add your first subject','ضيف أول مادة')+'</button></div></div>');
};

/* ---------- TASKS ---------- */
V.tasks=()=>{
  const open=DB.tasks.filter(t=>!t.done).sort((a,b)=>daysTo(a.due)-daysTo(b.due)),done=DB.tasks.filter(t=>t.done);
  const row=t=>{const s=DB.subjects.find(x=>x.id===t.subjectId),d=daysTo(t.due);
   return '<div class="item"><button class="btn sm" data-act="toggleTask" data-id="'+t.id+'">'+(t.done?'☑':'☐')+'</button>'+
    '<div class="grow"><div class="t '+(t.done?'strike':'')+'">'+esc(t.title)+'</div>'+
    '<div class="s">'+(s?esc(s.name)+' · ':'')+(t.due?(d<0?L('overdue','فات موعدها'):L('due in ','باقي ')+N(dayN(d))):L('no due date','بدون موعد'))+' · '+N(hm(t.est||30))+'</div></div>'+
    '<button class="btn sm ghost" data-act="delTask" data-id="'+t.id+'">✕</button></div>'};
  return '<div class="head between"><div><h1>'+L('Tasks','المهام')+'</h1>'+
   '<p>'+L('Assignments and errands. Estimates get slotted into your day.','التكاليف والمشاوير — والوقت المقدّر بيتحجز في يومك.')+'</p></div>'+
   '<button class="btn pri" data-act="addTask">+ '+L('Add','إضافة')+'</button></div>'+
   '<div class="card">'+(open.length?'<div class="list">'+open.map(row).join('')+'</div>'
     :'<div class="empty"><b>'+L('Nothing open','مفيش مهام مفتوحة')+'</b>'+L('Add an assignment and it shows up in your schedule.','ضيف تكليف وهيظهر في جدولك.')+'</div>')+'</div>'+
   (done.length?'<div class="sec">'+L('Completed','اللي خلص')+'</div><div class="card"><div class="list">'+done.slice(-12).reverse().map(row).join('')+'</div></div>':'');
};

/* ---------- FOCUS ---------- */
V.focus=()=>{
  const k=dkey(),st=studyMinutes(k),plan=planFor(k);
  const next=plan?plan.blocks.find(b=>(b.type==='study'||b.type==='revision')&&!b.done):null;
  const req=P.vacation?P.vacationMins:P.studyGoal, bh=bestHours();
  return '<div class="head"><h1>'+L('Focus','التركيز')+'</h1><p>'+L('One task, one timer, nothing else on screen.','مهمة واحدة، مؤقت واحد، ومفيش حاجة تانية على الشاشة.')+'</p></div>'+
  '<div class="card"><div class="grid g3">'+
   '<div class="stat"><span>'+L('Studied today','مذاكرة النهاردة')+'</span><b>'+N(hm(st))+'</b></div>'+
   '<div class="stat"><span>'+L('Remaining','الباقي')+'</span><b>'+N(hm(Math.max(0,req-st)))+'</b></div>'+
   '<div class="stat"><span>'+L('Session length','طول الجلسة')+'</span><b>'+N(hm(P.sessionLen))+'</b></div></div>'+
   '<div class="row" style="margin-top:14px">'+
   (next?'<button class="btn pri" data-act="startBlock" data-id="'+next.id+'">▶ '+esc(next.title)+'</button>':'')+
   '<button class="btn" data-act="startFocus">'+L('Start a free session','ابدأ جلسة حرة')+'</button>'+
   '<button class="btn" data-act="setSess">'+L('Change length','غيّر الطول')+'</button>'+
   '<label class="row sm dim"><input type="checkbox" data-act="toggleNoise" '+(P.noise?'checked':'')+'> '+L('Focus noise','ضوضاء تركيز')+'</label></div>'+
   '<div class="row" style="margin-top:12px"><span class="sm mut">'+L('Pomodoro preset: ','نمط بومودورو: ')+'</span>'+
    POMO_PRESETS.map((p,i)=>'<button class="chip" data-act="applyPomo" data-i="'+i+'">'+p.n+'</button>').join('')+'</div>'+
   '<div class="row" style="margin-top:8px"><span class="sm mut">'+L('Timer style: ','شكل المؤقت: ')+'</span>'+
    [['ring',L('Ring','دائرة')],['bars',L('Bars','أعمدة')],['dots',L('Dots','نقاط')],['flip',L('Flip','قلاّبة')]]
     .map(t=>'<button class="chip'+(P.timerStyle===t[0]?' on':'')+'" data-act="setTimerStyle" data-v="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>'+
   '<div class="row" style="margin-top:8px"><span class="sm mut">'+L('Alarm: ','التنبيه: ')+'</span>'+
    [['chime',L('Chime','رنة')],['bell',L('Bell','جرس')],['retro',L('Retro','رجعي')],['soft',L('Soft','هادئ')]]
     .map(t=>'<button class="chip'+(P.alarmTone===t[0]?' on':'')+'" data-act="setAlarm" data-v="'+t[0]+'">'+t[1]+'</button>').join('')+'</div></div>'+
  '<div class="card"><h2 class="head">'+L('Your peak hours','أوقات ذروتك')+'</h2>'+
   (bh.length?'<p class="sm mut">'+L('Based on your own sessions, you focus best around: ','حسب جلساتك أنت بتركز أحسن حوالي: ')+
     bh.map(b=>N(pad(b[0])+':00')+' ('+N(Math.round(b[1])+'%')+')').join('، ')+
     '<br>'+L('The planner puts your hardest subject in these hours.','المجدول بيحط أصعب مادة في الأوقات دي.')+'</p>'
    :'<p class="sm mut">'+L('Finish a few sessions and ORBIX will learn when you focus best.','خلّص كام جلسة والبرنامج هيتعلم إمتى تركيزك أعلى.')+'</p>')+'</div>'+
  '<div class="card"><h2 class="head">'+L('Breaks','الاستراحات')+'</h2>'+
   '<p class="sm mut">'+L('Breaks come after focus blocks, not at random: ','الاستراحات بعد الجلسات مش عشوائية: ')+
   N(hm(P.breakShort))+L(' between sessions and ',' بين الجلسات و')+N(hm(P.breakLong))+L(' every third one.',' كل تالت جلسة.')+'</p>'+
   '<div class="row" style="margin-top:10px">'+[[P.breakShort,'☕',L('Short','قصيرة')],[P.breakLong,'🍵',L('Long','طويلة')],[40,'🍽',L('Meal','أكل')],[15,'🚶',L('Walk','مشي')],[5,'🧘',L('Stretch','تمدد')]]
    .map(b=>'<button class="btn sm" data-act="breakNow" data-m="'+b[0]+'">'+b[1]+' '+b[2]+'</button>').join('')+'</div></div>'+
  '<div class="card"><h2 class="head">🕹 '+L('Arcade — for your breaks','الأركيد — لاستراحاتك')+'</h2>'+
   '<div class="row">'+
   '<button class="btn sm play" data-act="breakGame">🎯 '+L('60s tap game','لعبة دوس ٦٠ث')+'</button>'+
   '<button class="btn sm play" data-act="memoryGame">🧩 '+L('Memory match','لعبة الذاكرة')+'</button>'+
   '<button class="btn sm play" data-act="mathSprint">🔢 '+L('Quick math','رياضة سريعة')+'</button></div>'+
   '<p class="xs dim" style="margin-top:8px">'+L('A quick round earns a little XP or coins — a nicer break than the phone.','جولة سريعة بتكسبك XP أو عملات بسيطة — استراحة أحلى من الموبايل.')+'</p></div>'+
  '<div class="card"><div class="between head"><h2>'+L('Distraction log','سجل المشتتات')+'</h2>'+
   '<button class="btn sm" data-act="addDistraction">+ '+L('Log one','سجّل واحد')+'</button></div>'+
   (DB.distractions.length?'<div class="list">'+topDistractions().map(d=>'<div class="item"><div class="grow"><div class="t">'+esc(d[0])+'</div>'+
     '<div class="s">'+N(d[1])+' '+L('times this month','مرة الشهر ده')+'</div></div></div>').join('')+'</div>'+
     '<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="clearDistractions" style="color:var(--warn)">'+L('Clear log','امسح السجل')+'</button></div>'+
     '<p class="xs dim" style="margin-top:8px">'+L('Knowing what pulls you away is half the fix.','إنك تعرف اللي بيسحبك بره المذاكرة ده نص الحل.')+'</p>'
    :'<div class="empty">'+L('Whenever something pulls you out of a session, log it. Patterns show up fast.','كل ما حاجة تقطع عليك الجلسة سجّلها — الأنماط بتبان بسرعة.')+'</div>')+'</div>'+
  '<div class="card"><h2 class="head">'+L('Distraction blocker','حاجب المشتتات')+'</h2>'+
   '<p class="sm mut">'+L('Optional and always yours to switch off. ORBIX reminds you and hides the list; it never takes over your machine.','اختياري وتقدر تقفله في أي وقت. البرنامج بيفكّرك ويخفي القايمة، ومش بيتحكم في جهازك.')+'</p>'+
   '<div class="row" style="margin-top:10px"><label class="row sm"><input type="checkbox" data-act="toggleBlocker" '+(P.blockEnabled?'checked':'')+'> '+
    L('Active ','شغّال ')+N(P.blockFrom)+'–'+N(P.blockTo)+'</label>'+
   '<button class="btn sm" data-act="editBlocklist">'+L('Edit list','تعديل القايمة')+' ('+N(P.blocked.length)+')</button></div></div>'+
  '<div class="card"><h2 class="head">'+L('Recent sessions','آخر الجلسات')+'</h2>'+
   (DB.sessions.length?'<div class="list">'+DB.sessions.slice(-8).reverse().map(s=>{const sub=DB.subjects.find(x=>x.id===s.subjectId);
     return '<div class="item"><span>'+(TYPE[s.type]||TYPE.personal).i+'</span><div class="grow"><div class="t">'+esc(s.title||(sub?sub.name:tname(s.type)))+'</div>'+
      '<div class="s">'+N(s.date)+' · '+N(hm(s.mins))+(s.focus?' · '+L('focus ','تركيز ')+N(s.focus+'%'):'')+'</div></div>'+
      '<button class="btn sm ghost" data-act="delSession" data-id="'+s.id+'">✕</button></div>'}).join('')+'</div>'
    :'<div class="empty">'+L('No sessions yet.','مفيش جلسات لسه.')+'</div>')+'</div>';
};
function topDistractions(){
  const c={};DB.distractions.forEach(d=>c[d.what]=(c[d.what]||0)+1);
  return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,6);
}

/* ---------- GAMING ---------- */
V.gaming=()=>{
  const k=dkey(),used=gamingMinutes(k),st=studyMinutes(k);
  const req=P.vacation?P.vacationMins:P.studyGoal,rem=Math.max(0,req-st);
  const allow=gamingAllowance(k),left=Math.max(0,allow-used);
  return '<div class="head"><h1>'+L('Gaming','الألعاب')+'</h1><p>'+L('Earned time, not stolen time.','وقت مكسوب، مش وقت مسروق.')+'</p></div>'+
  '<div class="card"><h2 class="head">'+L('Study-to-Play calculator','حاسبة المذاكرة مقابل اللعب')+'</h2>'+
   '<div class="grid g4">'+
    '<div class="stat"><span>'+L('Required today','المطلوب النهاردة')+'</span><b>'+N(hm(req))+'</b></div>'+
    '<div class="stat"><span>'+L('Completed','اللي خلص')+'</span><b>'+N(hm(st))+'</b></div>'+
    '<div class="stat"><span>'+L('Remaining','الباقي')+'</span><b>'+N(hm(rem))+'</b></div>'+
    '<div class="stat"><span>'+L('Unlocked','المفتوح')+'</span><b style="color:var(--play)">'+N(hm(allow))+'</b></div></div>'+
   '<p style="margin:14px 0 0">'+(P.gamingMode==='fixed'?L('Fixed limit: ','حد ثابت: ')+N(hm(P.gamingGoal))+L(' a day.',' في اليوم.')
     :rem>0?L('Study ','ذاكر ')+N(hm(rem))+L(' more to unlock your full allowance of ',' كمان علشان تفتح كل رصيدك ')+N(hm(P.gamingGoal))+'.'
     :L('Full allowance unlocked. Enjoy it.','رصيدك كامل مفتوح. بالهنا.'))+'</p>'+
   '<div class="row" style="margin-top:12px">'+[30,45,60].map(r=>'<button class="chip'+(+P.ratio===r&&P.gamingMode==='reward'?' onp':'')+'" data-act="setRatio" data-v="'+r+'">'+
     L('1h = ','ساعة = ')+N(r+L('m','د'))+'</button>').join('')+
    '<button class="chip'+(P.gamingMode==='reward'&&![30,45,60].includes(+P.ratio)?' onp':'')+'" data-act="customRatio">'+L('Custom','مخصص')+'</button>'+
    '<button class="chip'+(P.gamingMode==='fixed'?' onp':'')+'" data-act="fixedMode">'+L('Fixed limit','حد ثابت')+'</button></div></div>'+
  '<div class="card"><div class="between head"><h2>'+L('Session','الجلسة')+'</h2><span class="pill">'+N(hm(left))+' '+L('left','باقي')+'</span></div>'+
   bar(allow?used/allow*100:0,'var(--play)')+
   '<div class="row" style="margin-top:14px"><button class="btn play" data-act="startGame" '+(left<1?'disabled':'')+'>▶ '+L('Start gaming session','ابدأ جلسة لعب')+'</button>'+
   '<button class="btn sm" data-act="addGame">'+L('Log played time','سجّل وقت لعب')+'</button>'+
   '<label class="row sm dim"><input type="checkbox" data-act="toggleWarn" '+(P.warnings?'checked':'')+'> '+L('Warnings at 30/10/5 min','تنبيهات عند ٣٠/١٠/٥ دقايق')+'</label></div></div>'+
  '<div class="card"><div class="between head"><h2>'+L('Reward shop','متجر المكافآت')+'</h2><span class="pill">✦ '+N(DB.xp||0)+' XP</span></div>'+
   '<p class="sm mut">'+L('Spend XP you earned on extra gaming minutes — your call, not a punishment.','اصرف الـ XP اللي كسبته على دقايق لعب زيادة — قرارك أنت، مش عقاب.')+'</p>'+
   '<div class="row" style="margin-top:10px">'+[[15,60],[30,110],[60,200]].map(o=>'<button class="btn" data-act="buyGame" data-m="'+o[0]+'" data-x="'+o[1]+'" '+((DB.xp||0)<o[1]?'disabled':'')+'>+'+
     N(hm(o[0]))+' · '+N(o[1])+' XP</button>').join('')+'</div></div>'+
  '<div class="card"><h2 class="head">'+L('This week','الأسبوع ده')+'</h2>'+week7('gaming','var(--play)')+'</div>';
};

/* ---------- SLEEP ---------- */
V.sleep=()=>{
  const k=dkey(),s=sleepMins(k),debt=sleepDebt();
  return '<div class="head"><h1>'+L('Sleep','النوم')+'</h1><p>'+L('Sleep is a scheduled block, not the leftovers.','النوم بلوك مجدول، مش اللي بيفضل من اليوم.')+'</p></div>'+
  '<div class="card"><div class="grid g4">'+
   '<div class="stat"><span>'+L('Last night','امبارح بالليل')+'</span><b>'+N(hm(s))+'</b></div>'+
   '<div class="stat"><span>'+L('Target','الهدف')+'</span><b>'+N(hm(480))+'</b></div>'+
   '<div class="stat"><span>'+L('Window','الفترة')+'</span><b>'+N(P.sleep+'→'+P.wake)+'</b></div>'+
   '<div class="stat"><span>'+L('Sleep debt (7d)','دين النوم (٧ أيام)')+'</span><b style="color:'+(debt>180?'var(--warn)':'var(--ink)')+'">'+N(hm(debt))+'</b></div></div>'+
   bar(s/480*100,'var(--rest)')+
   (debt>180?'<p class="sm mut" style="margin-top:10px">'+L('You are carrying real sleep debt. A shorter study day now beats a lost week later.','عندك دين نوم حقيقي. يوم مذاكرة أقصر دلوقتي أحسن من أسبوع ضايع بعدين.')+'</p>':'')+
   '<div class="row" style="margin-top:12px"><button class="btn" data-act="logSleep">'+L('Log last night','سجّل نوم امبارح')+'</button>'+
   '<button class="btn" data-act="setTimes">'+L('Change wake / sleep times','غيّر مواعيد النوم والصحيان')+'</button></div></div>'+
  '<div class="card"><h2 class="head">'+L('Last 7 nights','آخر ٧ ليالي')+'</h2>'+week7('sleep','var(--rest)')+'</div>';
};
function week7(type,c){
  const days=[...Array(7)].map((_,i)=>dkey(new Date(Date.now()-(6-i)*864e5)));
  const vals=days.map(d=>mins(d,type)),mx=Math.max(60,...vals);
  return '<div class="row" style="align-items:flex-end;gap:8px;height:120px;direction:ltr">'+vals.map((v,i)=>
   '<div style="flex:1;text-align:center"><div style="height:'+Math.round(v/mx*80)+'px;background:'+c+';border-radius:5px 5px 0 0;min-height:3px"></div>'+
   '<div class="xs dim" style="margin-top:6px">'+DAYS_S()[new Date(days[i]+'T12:00').getDay()]+'<br>'+N(hm(v))+'</div></div>').join('')+'</div>';
}

/* ---------- NOTES / CARDS / QUIZ ---------- */
V.notes=()=>'<div class="head between"><div><h1>'+L('Notes','الملاحظات')+'</h1><p>'+L('Stored on this device only.','محفوظة على جهازك بس.')+'</p></div>'+
  '<button class="btn pri" data-act="addNote">+ '+L('Add','إضافة')+'</button></div>'+
  (DB.notes.length?'<div class="grid g2">'+DB.notes.slice().reverse().map(n=>'<div class="card"><div class="between"><h3>'+esc(n.title)+'</h3>'+
   '<button class="btn sm ghost" data-act="delNote" data-id="'+n.id+'">✕</button></div>'+
   '<p class="sm mut" style="white-space:pre-wrap;margin:8px 0 0">'+esc(n.body).slice(0,600)+'</p>'+
   '<div class="row" style="margin-top:8px">'+(n.tags||[]).map(t=>'<span class="tag">#'+esc(t)+'</span>').join('')+'</div></div>').join('')+'</div>'
  :'<div class="empty"><b>'+L('No notes yet','مفيش ملاحظات')+'</b>'+L('Keep summaries here and search them with Ctrl K.','حط ملخصاتك هنا ودوّر عليها بـ Ctrl K.')+'</div>');
V.cards=()=>{
  const due=DB.cards.filter(c=>!c.due||c.due<=dkey());
  return '<div class="head between"><div><h1>'+L('Flashcards','البطاقات')+'</h1><p>'+L('Spaced repetition in five boxes.','تكرار متباعد على خمس صناديق.')+'</p></div>'+
   '<div class="row"><button class="btn" data-act="addCard">+ '+L('Card','بطاقة')+'</button>'+
   '<button class="btn pri" data-act="review" '+(due.length?'':'disabled')+'>'+L('Review ','مراجعة ')+N(due.length)+'</button></div></div>'+
   '<div class="card"><div class="grid g4">'+[1,2,3,4].map(b=>'<div class="stat"><span>'+L('Box ','صندوق ')+N(b)+'</span><b>'+N(DB.cards.filter(c=>(c.box||1)===b).length)+'</b></div>').join('')+'</div></div>'+
   (DB.cards.length?'<div class="card"><div class="list">'+DB.cards.slice(0,40).map(c=>'<div class="item"><span class="tag">'+N('B'+(c.box||1))+'</span>'+
     '<div class="grow"><div class="t">'+esc(c.front)+'</div><div class="s">'+esc(c.back)+'</div></div>'+
     '<button class="btn sm ghost" data-act="delCard" data-id="'+c.id+'">✕</button></div>').join('')+'</div></div>'
    :'<div class="empty"><b>'+L('No cards yet','مفيش بطاقات')+'</b>'+L('Add a question and its answer to start a deck.','ضيف سؤال وإجابته وابدأ.')+'</div>');
};
V.quiz=()=>{
  const runs=DB.quizRuns.slice(-8).reverse();
  return '<div class="head between"><div><h1>'+L('Quizzes & exam simulator','الاختبارات ومحاكي الامتحان')+'</h1>'+
   '<p>'+L('Timed practice that feeds your weak-topic list.','تدريب بمؤقت بيغذّي قايمة نقط ضعفك.')+'</p></div>'+
   '<div class="row"><button class="btn" data-act="addQ">+ '+L('Question','سؤال')+'</button>'+
   '<button class="btn pri" data-act="simExam" '+(DB.questions.length?'':'disabled')+'>'+L('Start simulation','ابدأ المحاكاة')+'</button></div></div>'+
   '<div class="card"><h2 class="head">'+L('Question bank','بنك الأسئلة')+'</h2>'+
    (DB.questions.length?'<div class="list">'+DB.questions.slice(0,30).map(q=>{const s=DB.subjects.find(x=>x.id===q.subjectId);
      return '<div class="item"><div class="grow"><div class="t">'+esc(q.q)+'</div>'+
       '<div class="s">'+(s?esc(s.name):L('general','عام'))+' · '+L('answer: ','الإجابة: ')+esc(q.options[q.answer])+'</div></div>'+
       '<button class="btn sm ghost" data-act="delQ" data-id="'+q.id+'">✕</button></div>'}).join('')+'</div>'
     :'<div class="empty"><b>'+L('The bank is empty','البنك فاضي')+'</b>'+L('Add questions with four options and mark the correct one.','ضيف أسئلة بأربع اختيارات وحدد الصح.')+'</div>')+'</div>'+
   (runs.length?'<div class="card"><h2 class="head">'+L('Results','النتايج')+'</h2><table><tr><th>'+L('Date','التاريخ')+'</th><th>'+L('Subject','المادة')+'</th>'+
     '<th>'+L('Score','الدرجة')+'</th><th>'+L('Time','الوقت')+'</th><th>'+L('Weak topics','نقط الضعف')+'</th><th></th></tr>'+
     runs.map((r,i)=>'<tr><td>'+N(r.date)+'</td><td>'+esc(r.subject)+'</td><td>'+N(r.score+'%')+'</td><td>'+N(hm(r.mins))+'</td>'+
     '<td class="sm mut">'+esc((r.weak||[]).join('، ')||'—')+'</td><td><button class="btn sm ghost" data-act="delQuizRun" data-i="'+(DB.quizRuns.length-1-i)+'">✕</button></td></tr>').join('')+'</table></div>':'');
};

/* ---------- EXAMS ---------- */
V.exams=()=>{
  const list=DB.exams.slice().sort((a,b)=>daysTo(a.date)-daysTo(b.date));
  return '<div class="head between"><div><h1>'+L('Exams','الامتحانات')+'</h1><p>'+L('Countdown, weak subjects and exam mode.','العد التنازلي والمواد الضعيفة ووضع الامتحانات.')+'</p></div>'+
   '<div class="row"><button class="btn '+(P.examMode?'pri':'')+'" data-act="toggleExamMode">'+L('Exam mode ','وضع الامتحانات ')+(P.examMode?L('on','شغّال'):L('off','مقفول'))+'</button>'+
   '<button class="btn pri" data-act="addExam">+ '+L('Add','إضافة')+'</button></div></div>'+
   (P.examMode?'<div class="card" style="border-color:var(--study)"><h3>'+L('Exam mode is on','وضع الامتحانات شغّال')+'</h3>'+
    '<p class="sm mut" style="margin:6px 0 0">'+L('Revision gets priority, optional tasks are trimmed, flashcards and practice get more room, and weak subjects move up. Switch it off any time.','المراجعة ليها الأولوية، المهام الاختيارية بتقل، البطاقات والتدريب بياخدوا مساحة أكبر، والمواد الضعيفة بتطلع فوق. تقدر تقفله في أي وقت.')+'</p></div>':'')+
   (list.length?'<div class="grid g2" style="margin-top:12px">'+list.map(e=>{const s=DB.subjects.find(x=>x.id===e.subjectId),d=daysTo(e.date),pc=s?pacing(s):null;
     return '<div class="card"><div class="between"><h2>'+esc(e.name||(s?s.name:''))+'</h2>'+
      '<span class="pill">'+(e.done?L('done','خلص'):d<0?L('passed','عدّى'):N(dayN(d)))+'</span></div>'+
      '<p class="sm mut">'+N(e.date)+(s?' · '+esc(s.name):'')+'</p>'+
      (pc?'<div style="margin-top:10px">'+bar((s.pagesDone||0)/Math.max(1,s.pages||1)*100)+
        '<div class="xs dim" style="margin-top:6px">'+N(pc.remain)+' '+L('pages left · ','صفحة باقية · ')+N(Math.ceil(pc.perDay))+L('/day needed','/يوم مطلوبة')+'</div></div>':'')+
      '<div class="row" style="margin-top:12px">'+(s?'<button class="btn sm pri" data-act="studySub" data-id="'+s.id+'">'+L('Study now','ذاكر دلوقتي')+'</button>':'')+
      '<button class="btn sm" data-act="examDone" data-id="'+e.id+'">'+L('Mark as taken','خلص/اتعدّى')+'</button>'+
      '<button class="btn sm ghost" data-act="delExam" data-id="'+e.id+'">✕</button></div></div>'}).join('')+'</div>'
    :'<div class="empty" style="margin-top:12px"><b>'+L('No exams yet','مفيش امتحانات')+'</b>'+L('Add one and every screen starts counting down.','ضيف امتحان وكل الشاشات هتبدأ تعد تنازلي.')+'</div>');
};
/* ---------- GOALS ---------- */
V.goals=()=>'<div class="head between"><div><h1>'+L('Goals','الأهداف')+'</h1><p>'+L('Each goal gets a daily target so it stays doable.','كل هدف بياخد نصيب يومي علشان يفضل ممكن.')+'</p></div>'+
  '<button class="btn pri" data-act="addGoal">+ '+L('Add','إضافة')+'</button></div>'+
  (DB.goals.length?'<div class="grid g2">'+DB.goals.map(g=>{const cur=goalProgress(g),pct=Math.round(cur/Math.max(1,g.target)*100),d=daysTo(g.deadline);
   return '<div class="card"><div class="between"><h2>'+esc(g.title)+'</h2>'+
    '<span class="pill">'+(pct>=100?L('done','تم'):N(dayN(Math.max(0,d)))+L(' left',' باقية'))+'</span></div>'+
    '<div style="margin:10px 0">'+bar(pct,pct>=100?'var(--ok)':'var(--study)')+'</div>'+
    '<div class="sm mut">'+N(cur)+' / '+N(g.target)+' '+esc(g.unit)+' · '+L('daily target ','النصيب اليومي ')+N(d>0?Math.ceil(Math.max(0,g.target-cur)/d):0)+'</div>'+
    '<div class="row" style="margin-top:10px"><button class="btn sm ghost" data-act="delGoal" data-id="'+g.id+'">✕</button></div></div>'}).join('')+'</div>'
  :'<div class="empty"><b>'+L('No goals set','مفيش أهداف')+'</b>'+L('Try “finish Civil Law before 10 October” or “keep gaming under 12 hours this week”.','جرّب «أخلّص المدني قبل ١٠ أكتوبر» أو «اللعب أقل من ١٢ ساعة الأسبوع ده».')+'</div>');
function goalProgress(g){
  const since=g.created||0;
  if(g.metric==='study')return Math.round(DB.sessions.filter(s=>s.ts>=since&&(s.type==='study'||s.type==='revision')).reduce((a,s)=>a+s.mins,0)/60);
  if(g.metric==='gaming')return Math.round(DB.sessions.filter(s=>s.ts>=since&&s.type==='gaming').reduce((a,s)=>a+s.mins,0)/60);
  if(g.metric==='pages'){const s=DB.subjects.find(x=>x.id===g.subjectId);return s?(s.pagesDone||0):0}
  if(g.metric==='cards')return DB.cards.reduce((a,c)=>a+(c.reviews||0),0);
  return DB.tasks.filter(t=>t.done).length;
}
/* ---------- GRADES ---------- */
V.grades=()=>{
  const g=DB.grades;
  const gpa=g.length?(g.reduce((a,x)=>a+pts(x.score)*(x.credits||3),0)/g.reduce((a,x)=>a+(x.credits||3),0)):0;
  return '<div class="head between"><div><h1>'+L('Grades','الدرجات')+'</h1><p>'+L('Your results feed the planner: a weak result raises that subject\'s priority.','نتايجك بتغذّي المجدول: الدرجة الضعيفة بترفع أولوية المادة.')+'</p></div>'+
   '<button class="btn pri" data-act="addGrade">+ '+L('Add','إضافة')+'</button></div>'+
   '<div class="card"><div class="grid g3">'+
    '<div class="stat"><span>'+L('GPA (4.0)','المعدل من ٤')+'</span><b>'+N(gpa.toFixed(2))+'</b></div>'+
    '<div class="stat"><span>'+L('Average','المتوسط')+'</span><b>'+N((g.length?Math.round(g.reduce((a,x)=>a+x.score,0)/g.length):0)+'%')+'</b></div>'+
    '<div class="stat"><span>'+L('Results logged','نتايج مسجلة')+'</span><b>'+N(g.length)+'</b></div></div></div>'+
   (g.length?'<div class="card"><table><tr><th>'+L('Subject','المادة')+'</th><th>'+L('Assessment','التقييم')+'</th><th>'+L('Score','الدرجة')+'</th><th>'+L('Credits','الساعات')+'</th><th></th></tr>'+
     g.map(x=>'<tr><td>'+esc((DB.subjects.find(s=>s.id===x.subjectId)||{name:'—'}).name)+'</td><td>'+esc(x.title)+'</td>'+
      '<td>'+N(x.score+'%')+'</td><td>'+N(x.credits||3)+'</td><td><button class="btn sm ghost" data-act="delGrade" data-id="'+x.id+'">✕</button></td></tr>').join('')+'</table></div>'
    :'<div class="empty"><b>'+L('No results yet','مفيش نتايج')+'</b>'+L('Add a midterm or quiz result and watch the GPA build up.','ضيف نتيجة ميدتيرم أو كويز وشوف المعدل بيتكوّن.')+'</div>');
};
const pts=s=>s>=93?4:s>=89?3.7:s>=85?3.3:s>=80?3:s>=76?2.7:s>=72?2.3:s>=68?2:s>=64?1.7:s>=60?1:0;
/* ---------- JOURNAL ---------- */
V.journal=()=>{
  const q=(DB._jq||'').toLowerCase();
  const list=DB.journal.filter(j=>!q||(j.text+' '+(j.tags||[]).join(' ')).toLowerCase().includes(q)).slice().reverse();
  return '<div class="head between"><div><h1>'+L('Journal','المذكرات')+'</h1><p>'+L('Private, on this device.','خاصة، على جهازك.')+'</p></div>'+
   '<button class="btn pri" data-act="addJ">+ '+L('Entry','تدوينة')+'</button></div>'+
   '<div class="card"><input type="text" id="jq" placeholder="'+L('Search entries and tags','ابحث في التدوينات والوسوم')+'" value="'+esc(DB._jq||'')+'"></div>'+
   (list.length?'<div class="list" style="margin-top:12px">'+list.map(j=>'<div class="card"><div class="between"><span class="tag">'+esc(j.section)+'</span>'+
     '<span class="xs dim">'+N(j.date)+'</span></div><p style="white-space:pre-wrap;margin:8px 0 0">'+esc(j.text)+'</p>'+
     '<div class="row" style="margin-top:8px">'+(j.tags||[]).map(t=>'<span class="tag">#'+esc(t)+'</span>').join('')+
     '<button class="btn sm ghost" data-act="delJ" data-id="'+j.id+'">✕</button></div></div>').join('')+'</div>'
    :'<div class="empty" style="margin-top:12px"><b>'+L('Nothing written yet','لسه مفيش كتابة')+'</b>'+L('The night review saves here automatically.','مراجعة الليل بتتحفظ هنا تلقائيًا.')+'</div>');
};
/* ---------- AI ---------- */
V.ai=()=>{
  const b=behindReport();
  const c=(t,d,act,btn)=>'<div class="card"><h2>'+t+'</h2><p class="sm mut" style="margin:8px 0 14px">'+d+'</p><button class="btn pri" data-act="'+act+'">'+btn+'</button></div>';
  return '<div class="head"><h1>'+L('AI assistant','المساعد الذكي')+'</h1>'+
   '<p>'+L('Every suggestion comes with Apply, Edit and Cancel. Nothing happens on its own.','كل اقتراح بيجي بـ «تطبيق» و«تعديل» و«إلغاء». مفيش حاجة بتحصل لوحدها.')+'</p></div>'+
  '<div class="card" style="border-color:var(--play)"><div class="between"><div><h2>💬 '+L('Ask AI','اسأل الذكاء الاصطناعي')+'</h2>'+
   '<p class="sm mut" style="margin:6px 0 0">'+(P.aiKey
     ?L('Connected — ask anything about your studies.','متصل — اسأل أي حاجة في مذاكرتك.')
     :L('Optional: connect your own Anthropic API key for real, free-form answers. This calls the provider directly from your browser — your key stays on this device and is never sent anywhere else.','اختياري: وصّل مفتاح Anthropic API بتاعك عشان تاخد إجابات حرة حقيقية. البرنامج بينادي الشركة مباشرة من متصفحك — مفتاحك بيفضل على جهازك بس ومبيتبعتش لحد.'))+'</p></div>'+
   '<button class="btn sm" data-act="setAiKey">'+(P.aiKey?L('Change key','غيّر المفتاح'):L('Connect','وصّل'))+'</button></div>'+
   (P.aiKey?'<button class="btn pri wide" data-act="openAiChat" style="margin-top:10px">'+L('Open chat','افتح المحادثة')+'</button>':'')+'</div>'+
  '<div class="grid g2">'+
   c(L('Plan my day','خطة يومي'),L('Reads your commitments, energy and exam distances, then lays out the day.','بيقرا ارتباطاتك وطاقتك وقرب الامتحانات ويرتب اليوم.'),'checkin',L('Build plan','ابني الخطة'))+
   c(L('What should I do now?','أعمل إيه دلوقتي؟'),L('Looks at the clock and your plan and names one next action.','بيبص للساعة وللخطة ويقول لك خطوة واحدة بس.'),'whatnow',L('Ask','اسأل'))+
   c(L('Catch-up plan','خطة اللحاق'),L('You are behind by ','أنت متأخر ')+hm(b.mins)+(b.pages?L(' and ',' و')+b.pages+L(' pages',' صفحة'):'')+L('. Three recovery shapes, you pick.','. تلات خطط تعافي، وأنت تختار.'),'catchup',L('Show options','اعرض الخيارات'))+
   c(L('Rebalance the week','وازن الأسبوع'),L('Spreads the remaining workload across the days that are actually free.','بيوزّع الشغل الباقي على الأيام الفاضية فعلًا.'),'regenWeek',L('Rebuild week','ابني الأسبوع'))+
   c(L('Weekly review','المراجعة الأسبوعية'),L('Totals, focus average and one neutral observation per subject.','الإجماليات ومتوسط التركيز وملاحظة محايدة لكل مادة.'),'weekly',L('Open review','افتح المراجعة'))+
   c(L('Explain this schedule','اشرح الجدول'),L('Why each block sits where it sits.','ليه كل بلوك في مكانه ده.'),'explain',L('Explain','اشرح'))+
  '</div>'+
  '<div class="card" style="margin-top:12px"><h2 class="head">'+L('What it will never do','حاجات مش هتحصل أبدًا')+'</h2>'+
   '<ul class="sm mut" style="margin:0;padding-inline-start:18px;line-height:2">'+
   [L('Delete your data','يمسح بياناتك'),L('Move an exam or deadline without your confirmation','يغيّر ميعاد امتحان من غير تأكيد منك'),
    L('Build a schedule that leaves you under 5.5 hours of sleep','يبني جدول يسيبك تنام أقل من ٥ ساعات ونص'),
    L('Lock you out of your computer','يقفل عليك جهازك'),L('Turn on blocking by itself','يشغّل الحجب من نفسه'),
    L('Control or close your games','يتحكم في ألعابك أو يقفلها')].map(x=>'<li>'+x+'</li>').join('')+'</ul></div>';
};
/* ---------- ANALYTICS ---------- */
V.stats=()=>{
  const days=[...Array(84)].map((_,i)=>dkey(new Date(Date.now()-(83-i)*864e5)));
  const val=d=>hmMetric==='tasks'?DB.tasks.filter(t=>t.done&&t.doneOn===d).length*30
    :hmMetric==='focus'?focusAvg(d)*1.2:mins(d,hmMetric);
  const mx=Math.max(60,...days.map(val));
  const wk=days.slice(-7),wS=wk.reduce((a,d)=>a+studyMinutes(d),0),wG=wk.reduce((a,d)=>a+gamingMinutes(d),0);
  const fo=wk.map(focusAvg).filter(Boolean);
  const mood=Object.entries(DB.moods).slice(-14);
  const names={study:L('Study','مذاكرة'),gaming:L('Gaming','ألعاب'),tasks:L('Tasks','مهام'),focus:L('Focus','تركيز')};
  return '<div class="head"><h1>'+L('Analytics','التحليلات')+'</h1><p>'+L('Twelve weeks of activity.','١٢ أسبوع من النشاط.')+'</p></div>'+
  '<div class="grid g4">'+
   '<div class="card stat"><span>'+L('Study this week','مذاكرة الأسبوع')+'</span><b>'+N(hm(wS))+'</b></div>'+
   '<div class="card stat"><span>'+L('Gaming this week','لعب الأسبوع')+'</span><b>'+N(hm(wG))+'</b></div>'+
   '<div class="card stat"><span>'+L('Average focus','متوسط التركيز')+'</span><b>'+N((fo.length?Math.round(fo.reduce((a,b)=>a+b,0)/fo.length):0)+'%')+'</b></div>'+
   '<div class="card stat"><span>'+L('Streak','السلسلة')+'</span><b>'+N(streak())+' 🔥</b></div></div>'+
  '<div class="card" style="margin-top:12px"><div class="between head"><h2>'+L('Heatmap','الخريطة الحرارية')+'</h2>'+
   '<div class="row">'+['study','gaming','tasks','focus'].map(m=>'<button class="chip'+(hmMetric===m?' on':'')+'" data-act="hmSet" data-v="'+m+'">'+names[m]+'</button>').join('')+'</div></div>'+
   '<div class="hm" style="grid-template-columns:repeat(12,1fr)">'+days.map(d=>{const v=val(d),o=v?clamp(.2+v/mx*.8,0,1):0;
     return '<div title="'+d+'" style="background:'+(v?'color-mix(in srgb,var(--study) '+Math.round(o*100)+'%, var(--panel2))':'var(--panel2)')+'"></div>'}).join('')+'</div>'+
   '<div class="xs dim" style="margin-top:8px">'+N(days[0])+' → '+L('today','النهاردة')+'</div></div>'+
  '<div class="card" style="margin-top:12px"><h2 class="head">'+L('This week by day','الأسبوع يوم بيوم')+'</h2>'+week7('study','var(--study)')+'</div>'+
  '<div class="card" style="margin-top:12px"><h2 class="head">'+L('This month','الشهر ده')+'</h2>'+streakCalendarHTML()+
   '<div class="row" style="margin-top:8px"><span class="pill"><span class="dot" style="background:var(--study)"></span>'+L('Studied that day','ذاكرت اليوم ده')+'</span></div></div>'+
  (mood.length?'<div class="card" style="margin-top:12px"><h2 class="head">'+L('Energy over time','الطاقة عبر الأيام')+'</h2>'+
   '<div class="row" style="align-items:flex-end;gap:6px;height:90px;direction:ltr">'+mood.map(([d,m])=>
     '<div style="flex:1;text-align:center"><div style="height:'+(m*14)+'px;background:var(--rest);border-radius:4px 4px 0 0"></div>'+
     '<div class="xs dim">'+['','🥱','😴','😐','🙂','😀'][m]+'</div></div>').join('')+'</div></div>':'')+
  '<div class="card" style="margin-top:12px"><h2 class="head">'+L('Time budget · today','ميزانية اليوم')+'</h2>'+budget24()+'</div>'+
  '<div class="card" style="margin-top:12px"><div class="between"><h2>'+L('Weekly review','المراجعة الأسبوعية')+'</h2>'+
   '<button class="btn pri" data-act="weekly">'+L('Open','افتح')+'</button></div></div>';
};
function budget24(){
  const k=dkey(),p=planFor(k),cats={};
  (p?p.blocks:[]).forEach(b=>cats[b.type]=(cats[b.type]||0)+(b.end-b.start));
  const wake=t2m(P.wake),slp=t2m(P.sleep);cats.sleep=1440-((slp<=wake?slp+1440:slp)-wake);
  const used=Object.values(cats).reduce((a,b)=>a+b,0);cats.free=Math.max(0,1440-used);
  const order=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  return '<div style="display:flex;height:26px;border-radius:8px;overflow:hidden;border:1px solid var(--line);direction:ltr">'+
   order.map(([t,m])=>'<div title="'+t+'" style="width:'+(m/1440*100)+'%;background:'+(t==='free'?'var(--panel2)':(TYPE[t]||TYPE.personal).c)+'"></div>').join('')+'</div>'+
   '<div class="row" style="margin-top:10px">'+order.map(([t,m])=>'<span class="pill"><span class="dot" style="background:'+(t==='free'?'var(--line)':(TYPE[t]||TYPE.personal).c)+'"></span>'+
    (t==='free'?L('Free','وقت حر'):tname(t))+' '+N(hm(m))+'</span>').join('')+'</div>';
}
/* ---------- ACHIEVEMENTS ---------- */
V.badges=()=>{
  const lvl=Math.floor((DB.xp||0)/500)+1,into=(DB.xp||0)%500;
  return '<div class="head between"><div><h1>'+L('Achievements','الإنجازات')+'</h1><p>'+L('Level ','المستوى ')+N(lvl)+' · '+N(DB.xp||0)+' XP</p></div>'+
   '<button class="btn" data-act="shareProgress">📤 '+L('Share progress','شارك تقدّمك')+'</button></div>'+
  '<div class="card">'+bar(into/5)+'<div class="xs dim" style="margin-top:6px">'+N(into)+' / 500 XP '+L('to level ','للمستوى ')+N(lvl+1)+'</div></div>'+
  '<div class="card"><div class="between"><div><h3>'+L('Rest day','يوم راحة')+'</h3>'+
   '<p class="sm mut" style="margin:4px 0 0">'+L('Use a rest day to keep your streak without studying. Life happens; the streak is not a debt.','استخدم يوم راحة تحافظ بيه على سلسلتك من غير مذاكرة. الحياة بتحصل، والسلسلة مش دَين عليك.')+'</p></div>'+
   '<button class="btn" data-act="freeze" '+(P.freezes>0?'':'disabled')+'>'+L('Use one','استخدم واحد')+' ('+N(P.freezes)+')</button></div></div>'+
  '<div class="grid g3" style="margin-top:12px">'+BADGES.map(b=>{const got=DB.badges.includes(b[0]);
   return '<div class="card" style="opacity:'+(got?1:.5)+'"><div style="font-size:26px">'+(got?'🏆':'🔒')+'</div>'+
    '<h3 style="margin-top:6px">'+L(b[1][0],b[1][1])+'</h3><p class="xs dim" style="margin:4px 0 0">'+(got?L('Unlocked','اتفتح'):L('Locked','مقفول'))+'</p></div>'}).join('')+'</div>';
};

/* ---------- OWNER DASHBOARD (summary-only, disclosed) ---------- */
function accountSummary(u){
  const raw=LS.get('sf:p:'+u.id,null);
  if(!raw)return{study:0,gaming:0,streak:0,tasks:'0/0',lastActive:null};
  const sess=raw.sessions||[];
  const study=sess.filter(s=>s.type==='study'||s.type==='revision').reduce((a,s)=>a+s.mins,0);
  const gaming=sess.filter(s=>s.type==='gaming').reduce((a,s)=>a+s.mins,0);
  const last=sess.length?Math.max(...sess.map(s=>s.ts||0)):(raw.plans&&Object.keys(raw.plans).length?0:null);
  const tasks=raw.tasks||[];
  return{study,gaming,streak:null,tasksDone:tasks.filter(t=>t.done).length,tasksTotal:tasks.length,lastActive:last};
}
V.owner=()=>{
  if(!SESSION||!SESSION.isOwner)return '<div class="empty"><b>'+L('Owner access only','دخول المالك فقط')+'</b></div>';
  const u=users(),cfg=globalCfg();
  return '<div class="head"><h1>🛡 '+L('Owner dashboard','لوحة المالك')+'</h1>'+
   '<p>'+L('Usage summaries only — private notes and journal entries of other accounts are never shown here.','ملخصات استخدام بس — مذاكرات وملاحظات الحسابات التانية الخاصة مش بتتعرض هنا خالص.')+'</p></div>'+
   '<div class="card"><h2 class="head">'+L('Accounts on this device','الحسابات على الجهاز ده')+'</h2>'+
   '<div class="list">'+u.map(x=>{const s=accountSummary(x);
     return '<div class="item"><span class="avatar sm">'+esc((x.name||x.username)[0].toUpperCase())+'</span>'+
      '<div class="grow"><div class="t">'+esc(x.name||x.username)+' <span class="dim">@'+esc(x.username)+'</span>'+(x.isOwner?' <span class="badge-owner">OWNER</span>':'')+'</div>'+
      '<div class="s">'+L('Study: ','مذاكرة: ')+N(hm(s.study))+' · '+L('Gaming: ','لعب: ')+N(hm(s.gaming))+' · '+L('Tasks: ','مهام: ')+N((s.tasksDone||0)+'/'+(s.tasksTotal||0))+'</div></div>'+
      (x.id!==SESSION.id?'<button class="btn sm ghost" data-act="ownerRemoveUser" data-id="'+x.id+'" style="color:var(--warn)">'+L('Remove','حذف')+'</button>':'')+
      '</div>'}).join('')+'</div></div>'+
   '<div class="card"><h2 class="head">'+L('Spin wheel — platform rules','عجلة الحظ — إعدادات عامة')+'</h2>'+
   '<p class="sm mut">'+L('These apply to every account on this device.','دي بتنطبق على كل الحسابات على الجهاز ده.')+'</p>'+
   '<div class="grid g3" style="margin-top:10px">'+
    fld('dailySpinCap',L('Max spins per day','أقصى عدد لفات في اليوم'),'number',cfg.dailySpinCap)+
    fld('spinCooldownHours',L('Hours between free spins','ساعات بين اللفات المجانية'),'number',cfg.spinCooldownHours)+
    fld('spinBuyCost',L('Coins to buy an extra spin','عملات لشراء لفة إضافية'),'number',cfg.spinBuyCost)+
   '</div><button class="btn pri" data-act="ownerSaveCfg" style="margin-top:8px">'+L('Save rules','حفظ الإعدادات')+'</button></div>'+
   '<div class="card"><h2 class="head">'+L('Version','الإصدار')+'</h2><p class="sm mut">'+APP_NAME+' v'+APP_VERSION+'</p></div>';
};
/* ---------- SETTINGS ---------- */
V.settings=()=>{
  const t=prayerTimes(new Date(),P.lat,P.lng,P.tz);
  const sc=[['Ctrl+Shift+S',L('Start study','ابدأ مذاكرة')],['Ctrl+Shift+G',L('Gaming timer','مؤقت اللعب')],
    ['Ctrl+Shift+F',L('Focus mode','وضع التركيز')],['Ctrl+Shift+T',L("Today's schedule",'جدول النهاردة')],
    ['Ctrl+K',L('Command palette','لوحة الأوامر')],['Ctrl+/',L('Quick capture','التقاط سريع')]];
  return '<div class="head"><h1>'+L('Settings','الإعدادات')+'</h1><p>'+L('Everything is stored on this device.','كل حاجة متخزنة على جهازك.')+'</p></div>'+
  '<div class="card"><h2 class="head">'+L('You','أنت')+'</h2><div class="grid g2">'+
   fld('name',L('Name','الاسم'),'text',P.name)+fld('wake',L('Wake time','ميعاد الصحيان'),'time',P.wake)+
   fld('sleep',L('Sleep time','ميعاد النوم'),'time',P.sleep)+
   fld('studyGoal',L('Daily study goal (minutes)','هدف المذاكرة اليومي (دقايق)'),'number',P.studyGoal)+
   fld('gamingGoal',L('Daily gaming goal (minutes)','هدف اللعب اليومي (دقايق)'),'number',P.gamingGoal)+
   fld('sessionLen',L('Focus session (minutes)','طول جلسة التركيز'),'number',P.sessionLen)+
   fld('breakShort',L('Short break','استراحة قصيرة'),'number',P.breakShort)+
   fld('breakLong',L('Long break','استراحة طويلة'),'number',P.breakLong)+
   sel('lang',L('Language','اللغة'),[['ar','العربية'],['en','English']],P.lang)+
   sel('theme',L('Theme','المظهر'),[['dark',L('Dark','غامق')],['light',L('Light','فاتح')]],P.theme)+
   sel('accent',L('Accent colour','اللون الأساسي'),[['amber',L('Amber','عنبري')],['teal',L('Teal','تركوازي')],['violet',L('Violet','بنفسجي')],['rose',L('Rose','وردي')]],P.accent)+
   sel('timerStyle',L('Timer style','شكل المؤقت'),[['ring',L('Ring','دائرة')],['bars',L('Bars','أعمدة')],['dots',L('Dots','نقاط')],['flip',L('Flip clock','ساعة قلاّبة')]],P.timerStyle)+
   sel('alarmTone',L('Alarm sound','صوت التنبيه')+' 🔊',[['chime',L('Chime','رنة')],['bell',L('Bell','جرس')],['retro',L('Retro','رجعي')],['soft',L('Soft','هادئ')]],P.alarmTone)+
   sel('density',L('Layout density','كثافة العرض'),[['comfortable',L('Comfortable','مريحة')],['compact',L('Compact','مضغوطة')]],P.density)+
   sel('idleLockMin',L('Auto-lock after inactivity','قفل تلقائي بعد عدم استخدام'),[[0,L('Never','أبدًا')],[3,L('3 minutes','٣ دقايق')],[10,L('10 minutes','١٠ دقايق')],[30,L('30 minutes','٣٠ دقيقة')]],P.idleLockMin)+
   '</div><button class="btn pri" data-act="saveSettings">'+L('Save','حفظ')+'</button></div>'+
  '<div class="card"><h2 class="head">'+L('Prayer times','مواقيت الصلاة')+'</h2>'+
   '<label class="row" style="margin-bottom:10px"><input type="checkbox" data-act="togglePrayers" '+(P.prayers?'checked':'')+'> '+
   L('Reserve prayer times in the schedule','احجز مواقيت الصلاة في الجدول')+'</label>'+
   '<label class="row" style="margin-bottom:10px"><input type="checkbox" data-act="togglePrayerAuto" '+(P.prayerAuto?'checked':'')+'> '+
   L('Auto-detect exact times online when connected (falls back to offline calculation otherwise)','اكتشاف المواقيت أونلاين تلقائيًا لما يكون في نت (وبيرجع للحساب الأوفلاين لو مفيش)')+'</label>'+
   '<button class="btn sm" data-act="refreshPrayers" style="margin-bottom:10px">'+L('Refresh now','حدّث دلوقتي')+'</button>'+
   '<div class="row">'+['fajr','dhuhr','asr','maghrib','isha'].map(x=>'<span class="pill">'+L(PRAYER_NAMES[x][0],PRAYER_NAMES[x][1])+' '+N(t[x])+'</span>').join('')+'</div>'+
   '<p class="xs dim" style="margin-top:8px">'+L('Calculated offline from your coordinates (Egyptian General Authority method). Accurate to a few minutes — adjust the coordinates if needed.','بتتحسب أوفلاين من إحداثياتك (طريقة الهيئة المصرية العامة للمساحة). الدقة في حدود دقايق قليلة، وتقدر تظبط الإحداثيات.')+'</p>'+
   '<div class="row" style="margin-top:10px"><button class="btn sm" data-act="setLoc">'+L('Set location','ظبط الموقع')+'</button>'+
   '<button class="btn sm" data-act="geo">'+L('Use my location','استخدم موقعي')+'</button></div></div>'+
  '<div class="card"><h2 class="head">'+L('Modes','الأوضاع')+'</h2>'+
   '<label class="row" style="margin-bottom:10px"><input type="checkbox" data-act="toggleVac" '+(P.vacation?'checked':'')+'> '+
   L('Vacation mode — target drops to ','وضع الإجازة — الهدف ينزل لـ ')+N(hm(P.vacationMins))+'</label>'+
   '<label class="row" style="margin-bottom:10px"><input type="checkbox" data-act="toggleExamMode" '+(P.examMode?'checked':'')+'> '+
   L('Exam mode — more revision, fewer optional tasks','وضع الامتحانات — مراجعة أكتر ومهام اختيارية أقل')+'</label>'+
   '<label class="row"><input type="checkbox" data-act="toggleSound" '+(P.sound?'checked':'')+'> '+L('Sound alerts','تنبيهات صوتية')+'</label></div>'+
  '<div class="card"><h2 class="head">'+L('Keyboard shortcuts','اختصارات الكيبورد')+'</h2><table>'+
   sc.map(s=>'<tr><td><kbd>'+s[0]+'</kbd></td><td class="mut">'+s[1]+'</td></tr>').join('')+'</table>'+
   '<p class="xs dim" style="margin-top:8px">'+L('On the Windows build these work even when ORBIX is in the tray.','في نسخة الويندوز دي بتشتغل حتى والبرنامج في شريط المهام.')+'</p></div>'+
  '<div class="card"><h2 class="head">'+L('Desktop widgets','ودجتس سطح المكتب')+'</h2><div class="row">'+
   Object.keys(P.widgets).map(w=>'<button class="chip'+(P.widgets[w]?' on':'')+'" data-act="tglWidget" data-v="'+w+'">'+
    ({study:L('Study','المذاكرة'),next:L('Next task','الجاي'),exam:L('Exam countdown','عد الامتحان'),game:L('Gaming time','وقت اللعب')})[w]+'</button>').join('')+'</div></div>'+
  '<div class="card"><h2 class="head">'+L('Data','البيانات')+'</h2><div class="row">'+
   '<button class="btn" data-act="exportJSON">'+L('Export backup','نسخة احتياطية')+'</button>'+
   '<button class="btn" data-act="importFile">'+L('Import data','استيراد')+'</button>'+
   '<button class="btn" data-act="protectedExport">🔒 '+L('Protected backup','نسخة محمية')+'</button>'+
   '<button class="btn" data-act="protectedImport">🔒 '+L('Restore protected','استرجاع محمي')+'</button>'+
   '<button class="btn" data-act="resetDay">'+L("Clear today's plan",'امسح خطة النهاردة')+'</button>'+
   '<button class="btn ghost" data-act="wipe" style="color:var(--warn)">'+L('Erase this profile','امسح الملف ده')+'</button></div>'+
   '<p class="xs dim" style="margin-top:8px">'+L('Nothing is deleted automatically. Erasing asks twice.','مفيش حاجة بتتمسح لوحدها. المسح بيسأل مرتين.')+'</p></div>'+
   '<div class="card"><h2 class="head">'+L('Version','الإصدار')+'</h2><p class="sm mut">'+APP_NAME+' v'+APP_VERSION+'</p>'+
   '<button class="btn sm" data-act="showChangelog">'+L("What's new","الجديد")+'</button></div>';
};

/* =========================================================
   ACTIONS
   ========================================================= */
const ACT={};
const refresh=()=>{save();render()};

ACT.ownerRemoveUser=async d=>{
  if(!await modal(L('Remove this account?','تحذف الحساب ده؟'),'<p class="mut">'+L('Their data on this device will be deleted permanently.','بياناتهم على الجهاز ده هتتمسح نهائيًا.')+'</p>',
    [BTN.cancel(),{k:'ok',label:L('Remove','حذف'),pri:1}]))return;
  saveUsers(users().filter(x=>x.id!==d.id));
  localStorage.removeItem('sf:p:'+d.id);
  refresh();
};
ACT.ownerSaveCfg=()=>{const o=grab($('#view'));
  setGlobalCfg({dailySpinCap:clamp(+o.dailySpinCap||3,1,24),spinCooldownHours:clamp(+o.spinCooldownHours||7,1,24),spinBuyCost:clamp(+o.spinBuyCost||8,1,999)});
  toast(L('Saved','اتحفظ'));render();
};

document.addEventListener('click',e=>{
  const en=e.target.closest('[data-en]');if(en){$$('[data-en]',en.parentNode).forEach(b=>b.classList.remove('on'));en.classList.add('on')}
  const wn=e.target.closest('[data-wn]');if(wn)wn.classList.toggle('on');
  const dw=e.target.closest('[data-dw]');if(dw)dw.classList.toggle('on');
  const pk=e.target.closest('[data-pick]');if(pk){$$('[data-pick]',pk.parentNode).forEach(b=>{b.classList.remove('on');b.style.borderColor='var(--line)'});
    pk.classList.add('on');pk.style.borderColor='var(--study)'}
});
const picked=(s,def)=>{const el=$('[data-pick].on',s);return el?el.dataset.pick:def};

ACT.checkin=async()=>{
  const r=await modal(L('Plan today','خطة النهاردة'),
   '<p class="sm mut">'+L('How is your energy?','طاقتك عاملة إيه؟')+'</p><div class="row" style="margin:8px 0 16px">'+
   [[5,'😀 '+L('High','عالية')],[4,'🙂 '+L('Good','كويسة')],[3,'😐 '+L('Normal','عادية')],[2,'😴 '+L('Low','قليلة')],[1,'🥱 '+L('Very low','ضعيفة جدًا')]]
     .map(e=>'<button class="chip'+(e[0]===3?' on':'')+'" data-en="'+e[0]+'">'+e[1]+'</button>').join('')+'</div>'+
   '<p class="sm mut">'+L('What do you want to get done?','عايز تخلّص إيه؟')+'</p><div class="row" style="margin-top:8px">'+
   [['study',L('Study','مذاكرة')],['tasks',L('Assignments','تكاليف')],['revision',L('Revision','مراجعة')],['gaming',L('Gaming','لعب')],
    ['exercise',L('Exercise','رياضة')],['personal',L('Personal','شخصي')],['rest',L('Rest','راحة')]]
     .map(w=>'<button class="chip'+(['study','tasks','gaming'].includes(w[0])?' on':'')+'" data-wn="'+w[0]+'">'+w[1]+'</button>').join('')+'</div>',
   [BTN.cancel(),{k:'ok',label:L('Preview schedule','اعرض الجدول'),pri:1}],
   {collect:s=>({en:+(($('[data-en].on',s)||{dataset:{en:3}}).dataset.en),wants:$$('[data-wn].on',s).map(b=>b.dataset.wn)})});
  if(!r)return;
  DB.moods[dkey()]=r.en;save();
  const wants=r.wants.includes('rest')?['study']:r.wants;
  previewPlan(generatePlan(dkey(),{energy:r.en,wants}));
};
async function previewPlan(plan){
  const r=realism(plan);
  const out=await modal(L('Preview schedule','معاينة الجدول'),
   '<div class="list" style="max-height:46vh;overflow:auto">'+plan.blocks.map(blockRow).join('')+'</div>'+
   '<div class="card" style="margin-top:12px;background:var(--panel2)"><h3>'+L('Why this schedule?','ليه الجدول كده؟')+'</h3>'+
   '<ul class="sm mut" style="margin:8px 0 0;padding-inline-start:18px">'+explainPlan(plan).map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></div>'+
   (r.risky?'<p class="sm" style="color:var(--warn);margin-top:10px">'+L('This may be unrealistic: ','ممكن تكون غير واقعية: ')+hm(r.study)+
     L(' of study against ',' مذاكرة مقابل ')+hm(r.sleep)+L(' of sleep.',' نوم.')+'</p>':''),
   [BTN.cancel(),{k:'light',label:L('Balanced','نسخة متوازنة')},{k:'ok',label:L('Apply','تطبيق'),pri:1}],{wide:true});
  if(!out)return;
  if(out==='light'){plan.blocks=plan.blocks.filter((b,i)=>!(b.type==='study'&&i%3===2));
    plan.why.push({s:L('Trimmed to a lighter load at your request.','اتخففت بناءً على طلبك.'),d:0,r:0})}
  DB.plans[plan.date]=plan;save();go('schedule');toast(L('Schedule applied','الجدول اتطبق'));
}
ACT.regen=()=>{const d=$('#sd');if(d)schedDate=d.value;previewPlan(generatePlan(schedDate,{energy:DB.moods[dkey()]||3}))};
ACT.regenWeek=()=>{for(let i=0;i<7;i++){const k=dkey(new Date(Date.now()+i*864e5));DB.plans[k]=generatePlan(k,{energy:3})}
  save();toast(L('Week rebuilt','الأسبوع اتبنى'));go('schedule')};
ACT.explain=()=>{const p=planFor(dkey());
  modal(L('Why this schedule?','ليه الجدول كده؟'),p?'<ul class="sm mut" style="padding-inline-start:18px;line-height:2">'+
   explainPlan(p).map(w=>'<li>'+esc(w)+'</li>').join('')+
   '<li>'+L('Sessions are ','الجلسات ')+hm(P.sessionLen)+L(' with a break after each, and a longer one every third.',' وبعد كل واحدة استراحة، وكل تالت واحدة استراحة أطول.')+'</li>'+
   '<li>'+L('Fixed commitments were placed first, so nothing overlaps.','الارتباطات الثابتة اتحطت الأول، فمفيش تداخل.')+'</li></ul>'
   :'<p class="mut">'+L('No plan for today yet.','مفيش خطة لليوم لسه.')+'</p>',[BTN.close()])};
ACT.catchup=async()=>{
  const b=behindReport();
  const r=await modal(L('Catch-up mode','وضع اللحاق'),
   '<div class="grid g3">'+
    '<div class="card stat"><span>'+L('Behind by','متأخر بـ')+'</span><b>'+N(hm(b.mins))+'</b></div>'+
    '<div class="card stat"><span>'+L('Pages','صفحات')+'</span><b>'+N(b.pages)+'</b></div>'+
    '<div class="card stat"><span>'+L('Streak','السلسلة')+'</span><b>'+N(streak())+'</b></div></div>'+
   '<div class="list" style="margin-top:12px">'+
   [['light',L('Light recovery','تعافي خفيف'),7],['normal',L('Normal recovery','تعافي عادي'),4],['hard',L('Intensive recovery','تعافي مكثّف'),2]]
    .map(o=>'<button class="item" data-pick="'+o[0]+'" style="width:100%;text-align:start"><div class="grow"><div class="t">'+o[1]+'</div>'+
     '<div class="s">'+L('over ','على ')+dayN(o[2])+' · +'+hm(b.mins/o[2])+L('/day',' يوميًا')+(b.pages?' · +'+Math.ceil(b.pages/o[2])+L(' pages',' صفحة'):'')+'</div></div></button>').join('')+'</div>'+
   '<p class="xs dim" style="margin-top:10px">'+L('Deadlines are never moved unless you say so.','المواعيد النهائية مش بتتغير غير لما تقول أنت.')+'</p>',
   [BTN.cancel(),{k:'ok',label:L('Apply','تطبيق'),pri:1}],{collect:s=>({m:picked(s,'normal')})});
  if(!r)return;
  const n=r.m==='light'?7:r.m==='normal'?4:2;
  P.studyGoal=Math.round(P.studyGoal+b.mins/n);save();
  toast(L('Daily target is now ','الهدف اليومي بقى ')+hm(P.studyGoal));
  previewPlan(generatePlan(dkey(),{energy:3}));
};
ACT.whatnow=()=>{
  const now=nowMin(),k=dkey(),plan=planFor(k);
  let b=plan&&plan.blocks.find(x=>!x.done&&x.end>now&&!x.fixed);
  if(!b){const s=rankedSubjects()[0];
    if(!s)return modal(L('Recommended now','المقترح دلوقتي'),'<p class="mut">'+L('Add a subject first and ORBIX will always have an answer.','ضيف مادة الأول وهيبقى عنده إجابة دايمًا.')+'</p>',[BTN.close()]);
    b={type:'study',title:L('Study ','مذاكرة ')+s.name,subjectId:s.id,start:now,end:now+P.sessionLen}}
  const s=DB.subjects.find(x=>x.id===b.subjectId),pr=s?priority(s):null;
  const after=plan?plan.blocks.filter(x=>x.start>=b.end&&!x.done).slice(0,2):[];
  modal(L('Recommended now','المقترح دلوقتي'),
   '<div class="card" style="background:var(--panel2)"><div style="font-size:15px">'+(TYPE[b.type]||TYPE.personal).i+' <b>'+esc(b.title)+'</b></div>'+
   '<div class="mut sm" style="margin-top:4px">'+N(hm(b.end-b.start))+' · '+L('starts ','يبدأ ')+N(m2t(Math.max(now,b.start)))+'</div>'+
   (pr?'<div class="sm mut" style="margin-top:10px">'+L('Why: ','ليه؟ ')+(pr.exam?L('exam in ','الامتحان بعد ')+dayN(pr.days)+'، ':'')+
     L('progress ','التقدم ')+Math.round((s.pagesDone||0)/Math.max(1,s.pages||1)*100)+'%، '+pr.remain+L(' pages left.',' صفحة باقية.')+'</div>':'')+'</div>'+
   (after.length?'<p class="sm mut" style="margin-top:12px">'+L('After this: ','بعد كده: ')+
     after.map(a=>(TYPE[a.type]||TYPE.personal).i+' '+esc(a.title)+' ('+hm(a.end-a.start)+')').join(' ← ')+'</p>':''),
   [{k:null,label:L('Not now','مش دلوقتي')},{k:'ok',label:L('Start now','ابدأ دلوقتي'),pri:1}])
   .then(r=>{if(r)b.type==='gaming'?startGaming():startFocus(b.subjectId,b.title,b.end-b.start,b.id)});
};
ACT.weekly=()=>{
  const wk=[...Array(7)].map((_,i)=>dkey(new Date(Date.now()-i*864e5)));
  const st=wk.reduce((a,d)=>a+studyMinutes(d),0),gm=wk.reduce((a,d)=>a+gamingMinutes(d),0);
  const fo=wk.map(focusAvg).filter(Boolean);
  const tasks=DB.tasks.length?Math.round(DB.tasks.filter(t=>t.done).length/DB.tasks.length*100):0;
  const per={};DB.sessions.filter(s=>wk.includes(s.date)&&s.subjectId).forEach(s=>per[s.subjectId]=(per[s.subjectId]||0)+s.mins);
  const arr=DB.subjects.map(s=>[s.name,per[s.id]||0]).sort((a,b)=>b[1]-a[1]);
  const best=arr[0],low=arr[arr.length-1];
  modal(L('Weekly review','المراجعة الأسبوعية'),
   '<div class="grid g2">'+
   '<div class="card stat"><span>'+L('Total study','إجمالي المذاكرة')+'</span><b>'+N(hm(st))+'</b></div>'+
   '<div class="card stat"><span>'+L('Gaming','اللعب')+'</span><b>'+N(hm(gm))+'</b></div>'+
   '<div class="card stat"><span>'+L('Average focus','متوسط التركيز')+'</span><b>'+N((fo.length?Math.round(fo.reduce((a,b)=>a+b,0)/fo.length):0)+'%')+'</b></div>'+
   '<div class="card stat"><span>'+L('Tasks completed','المهام المكتملة')+'</span><b>'+N(tasks+'%')+'</b></div></div>'+
   (arr.length?'<div class="card" style="margin-top:12px"><table>'+arr.map(a=>'<tr><td>'+esc(a[0])+'</td><td class="mut">'+N(hm(a[1]))+'</td></tr>').join('')+'</table></div>':'')+
   '<p class="sm mut" style="margin-top:12px">'+(best&&best[1]?L('Most time went to ','أكتر وقت راح لـ ')+esc(best[0])+'. ':'')+
    (low&&best&&low[1]<best[1]/2?L('You spent less time on ','وقتك على ')+esc(low[0])+L(' than planned — the planner will give it more room.',' كان أقل من المخطط، والمجدول هيديها مساحة أكبر.')
      :L('The split across subjects is fairly even.','التوزيع بين المواد متوازن تقريبًا.'))+'</p>',
   [BTN.close()],{wide:true});
};
ACT.night=async()=>{
  const k=dkey();
  const r=await modal(L('Daily review','مراجعة اليوم'),
   '<div class="grid g4">'+
    '<div class="card stat"><span>'+L('Study','مذاكرة')+'</span><b>'+N(hm(studyMinutes(k)))+'</b></div>'+
    '<div class="card stat"><span>'+L('Gaming','لعب')+'</span><b>'+N(hm(gamingMinutes(k)))+'</b></div>'+
    '<div class="card stat"><span>'+L('Tasks','مهام')+'</span><b>'+N(DB.tasks.filter(t=>t.done).length+'/'+DB.tasks.length)+'</b></div>'+
    '<div class="card stat"><span>'+L('Focus','تركيز')+'</span><b>'+N(focusAvg(k)+'%')+'</b></div></div>'+
   '<div style="margin-top:14px">'+tarea('good',L('What went well today?','إيه اللي مشي كويس النهاردة؟'))+
   tarea('bad',L('What should be better tomorrow?','إيه اللي يتحسن بكرة؟'))+'</div>',
   [BTN.cancel(),{k:'ok',label:L('Save to journal','احفظ في المذكرات'),pri:1}],{collect:collectAll,wide:true});
  if(!r)return;
  if(r.good)DB.journal.push({id:uid(),date:k,section:L('Daily reflection','تأمل يومي'),text:L('Went well: ','مشي كويس: ')+r.good,tags:['review']});
  if(r.bad)DB.journal.push({id:uid(),date:k,section:L('Daily reflection','تأمل يومي'),text:L('To improve: ','للتحسين: ')+r.bad,tags:['review']});
  DB.xp+=15;save();toast(L('Saved to your journal','اتحفظ في مذكراتك'));
};

/* --- CRUD --- */
const DIFF=()=>[[1,L('1 · easy','١ · سهلة')],[2,'2'],[3,L('3 · medium','٣ · متوسطة')],[4,'4'],[5,L('5 · hard','٥ · صعبة')]];
const CONF=()=>[[1,L('Very low','ضعيفة جدًا')],[2,L('Low','ضعيفة')],[3,L('Medium','متوسطة')],[4,L('High','عالية')],[5,L('Very high','عالية جدًا')]];
ACT.addSub=async()=>{
  const r=await modal(L('Add subject','إضافة مادة'),fld('name',L('Subject','اسم المادة'))+
   '<div class="grid g2">'+fld('pages',L('Total pages','إجمالي الصفحات'),'number','0')+fld('pagesDone',L('Pages already done','صفحات خلصت'),'number','0')+
   sel('difficulty',L('Difficulty','الصعوبة'),DIFF(),3)+sel('confidence',L('Confidence','ثقتك فيها'),CONF(),3)+'</div>'+
   fld('exam',L('Exam date (optional)','تاريخ الامتحان (اختياري)'),'date'),[BTN.cancel(),BTN.add()],{collect:collectAll});
  if(!r||!r.name)return;
  const s={id:uid(),name:r.name,pages:+r.pages||0,pagesDone:+r.pagesDone||0,difficulty:+r.difficulty,confidence:+r.confidence,
    planDays:r.exam?Math.max(1,daysTo(r.exam)):14};
  DB.subjects.push(s);
  if(r.exam)DB.exams.push({id:uid(),subjectId:s.id,name:r.name,date:r.exam});
  refresh()};
ACT.editSub=async d=>{const s=DB.subjects.find(x=>x.id===d.id);if(!s)return;
  const r=await modal(L('Edit subject','تعديل المادة'),fld('name',L('Subject','اسم المادة'),'text',s.name)+
   '<div class="grid g2">'+fld('pages',L('Total pages','إجمالي الصفحات'),'number',s.pages)+fld('pagesDone',L('Pages done','صفحات خلصت'),'number',s.pagesDone)+
   sel('difficulty',L('Difficulty','الصعوبة'),DIFF(),s.difficulty)+sel('confidence',L('Confidence','الثقة'),CONF(),s.confidence)+'</div>',
   [BTN.cancel(),BTN.save()],{collect:collectAll});
  if(!r)return;Object.assign(s,{name:r.name,pages:+r.pages,pagesDone:+r.pagesDone,difficulty:+r.difficulty,confidence:+r.confidence});refresh()};
ACT.delSub=async d=>{
  if(!await modal(L('Delete subject','حذف المادة'),'<p class="mut">'+L('This removes the subject and its exams. Logged sessions stay in your history.','ده هيشيل المادة وامتحاناتها. الجلسات المسجلة هتفضل في سجلك.')+'</p>',
   [BTN.cancel(),{k:'ok',label:L('Delete','حذف'),pri:1}]))return;
  DB.subjects=DB.subjects.filter(x=>x.id!==d.id);DB.exams=DB.exams.filter(e=>e.subjectId!==d.id);refresh()};
ACT.logPages=async d=>{const s=DB.subjects.find(x=>x.id===d.id);
  const r=await modal(L('Log pages · ','سجّل صفحات · ')+s.name,fld('n',L('Pages finished','عدد الصفحات'),'number','10')+
   fld('chapter',L('Chapter or topic (starts a revision cycle)','الفصل أو الموضوع (يبدأ دورة مراجعة)'))
   ,[BTN.cancel(),BTN.save()],{collect:collectAll});
  if(!r)return;
  s.pagesDone=clamp((s.pagesDone||0)+(+r.n||0),0,s.pages||1e6);DB.xp+=(+r.n||0);
  if(r.chapter){scheduleRevision(s.id,r.chapter);toast(L('Revision scheduled for 1, 3, 7, 14 and 30 days','اتجدولت مراجعة بعد ١ و٣ و٧ و١٤ و٣٠ يوم'))}
  checkBadges();refresh()};
ACT.confSub=async d=>{const s=DB.subjects.find(x=>x.id===d.id);
  const r=await modal(L('Confidence · ','الثقة · ')+s.name,sel('c',L('How confident are you?','ثقتك في المادة دي قد إيه؟'),CONF(),s.confidence),
   [BTN.cancel(),BTN.save()],{collect:collectAll});
  if(!r)return;s.confidence=+r.c;refresh();toast(L('The planner will add revision where confidence is low','المجدول هيزود مراجعة في اللي ثقتك فيه قليلة'))};
ACT.addTask=async()=>{const r=await modal(L('Add task','إضافة مهمة'),fld('title',L('Task','المهمة'))+
  '<div class="grid g2">'+sel('subjectId',L('Subject','المادة'),[['','—']].concat(DB.subjects.map(s=>[s.id,s.name])))+
  fld('due',L('Due date','التسليم'),'date')+fld('est',L('Estimated minutes','الوقت المقدر بالدقايق'),'number','30')+'</div>',
  [BTN.cancel(),BTN.add()],{collect:collectAll});
  if(!r||!r.title)return;DB.tasks.push({id:uid(),title:r.title,subjectId:r.subjectId,due:r.due,est:+r.est||30,done:false});refresh()};
ACT.toggleTask=d=>{const t=DB.tasks.find(x=>x.id===d.id);t.done=!t.done;t.doneOn=t.done?dkey():null;if(t.done){DB.xp+=10;addCoins(1)}checkBadges();refresh()};
ACT.delTask=d=>{DB.tasks=DB.tasks.filter(x=>x.id!==d.id);refresh()};
ACT.inbox2task=d=>{const x=DB.inbox.find(i=>i.id===d.id);DB.tasks.push({id:uid(),title:x.t,est:30,done:false});
  DB.inbox=DB.inbox.filter(i=>i.id!==d.id);refresh()};
ACT.delInbox=d=>{DB.inbox=DB.inbox.filter(i=>i.id!==d.id);refresh()};
ACT.addExam=async()=>{const r=await modal(L('Add exam','إضافة امتحان'),fld('name',L('Exam name','اسم الامتحان'))+
  '<div class="grid g2">'+sel('subjectId',L('Subject','المادة'),DB.subjects.map(s=>[s.id,s.name]))+fld('date',L('Date','التاريخ'),'date')+'</div>',
  [BTN.cancel(),BTN.add()],{collect:collectAll});
  if(!r||!r.date)return;DB.exams.push({id:uid(),name:r.name,subjectId:r.subjectId,date:r.date});
  const s=DB.subjects.find(x=>x.id===r.subjectId);if(s)s.planDays=Math.max(1,daysTo(r.date));refresh()};
ACT.delExam=d=>{DB.exams=DB.exams.filter(x=>x.id!==d.id);refresh()};
ACT.examDone=d=>{const e=DB.exams.find(x=>x.id===d.id);e.done=true;DB.xp+=40;checkBadges();refresh()};
ACT.toggleExamMode=()=>{P.examMode=!P.examMode;save();toast(L('Exam mode ','وضع الامتحانات ')+(P.examMode?L('on','شغّال'):L('off','مقفول')));render()};
ACT.addEvent=async()=>{const r=await modal(L('Fixed commitment','ارتباط ثابت'),fld('title',L('Name','الاسم'))+
  '<div class="grid g2">'+sel('type',L('Type','النوع'),['class','work','prayer','meal','exercise','personal'].map(t=>[t,tname(t)]),'class')+
  fld('start',L('Start','من'),'time','09:00')+fld('end',L('End','إلى'),'time','11:00')+
  sel('repeat',L('Repeats','التكرار'),[['weekly',L('Weekly','أسبوعي')],['once',L('One date','مرة واحدة')]],'weekly')+'</div>'+
  '<div class="row">'+DAYS_S().map((d,i)=>'<button class="chip" data-dw="'+i+'">'+d+'</button>').join('')+'</div>'+
  '<div style="margin-top:10px">'+fld('date',L('Date (if one-off)','التاريخ (لو مرة واحدة)'),'date')+'</div>',
  [BTN.cancel(),BTN.add()],{collect:(s,k)=>Object.assign(grab(s),{days:$$('[data-dw].on',s).map(b=>+b.dataset.dw)})});
  if(!r||!r.title)return;
  DB.events.push({id:uid(),title:r.title,type:r.type,start:r.start,end:r.end,repeat:r.repeat,days:r.days,date:r.date});refresh()};
ACT.delEvent=d=>{DB.events=DB.events.filter(x=>x.id!==d.id);refresh()};
ACT.attend=async d=>{const e=DB.events.find(x=>x.id===d.id);
  const got=DB.attendance.filter(a=>a.eventId===d.id);
  const r=await modal(L('Attendance · ','الحضور · ')+e.title,
   '<div class="grid g2"><div class="card stat"><span>'+L('Attended','حضور')+'</span><b>'+N(got.filter(a=>a.ok).length)+'</b></div>'+
   '<div class="card stat"><span>'+L('Missed','غياب')+'</span><b>'+N(got.filter(a=>!a.ok).length)+'</b></div></div>'+
   '<p class="sm mut" style="margin-top:12px">'+L('Log today:','سجّل النهاردة:')+'</p>',
   [BTN.cancel(),{k:'miss',label:L('Missed','غياب')},{k:'ok',label:L('Attended','حضرت'),pri:1}]);
  if(!r)return;DB.attendance.push({id:uid(),eventId:d.id,date:dkey(),ok:r==='ok'});refresh()};
ACT.addBlock=async()=>{
  const plan=planFor(schedDate)||{date:schedDate,blocks:[],why:[],studyPlanned:0};
  const r=await modal(L('Add block','إضافة بلوك'),fld('title',L('Title','العنوان'))+
   '<div class="grid g2">'+sel('type',L('Type','النوع'),Object.keys(TYPE).map(t=>[t,tname(t)]),'study')+
   fld('start',L('Start','من'),'time','18:00')+fld('end',L('End','إلى'),'time','19:00')+'</div>',[BTN.cancel(),BTN.add()],{collect:collectAll});
  if(!r||!r.title)return;
  plan.blocks.push({id:uid(),title:r.title,type:r.type,start:t2m(r.start),end:t2m(r.end)});
  plan.blocks.sort((a,b)=>a.start-b.start);DB.plans[schedDate]=plan;refresh()};
ACT.toggleBlock=d=>{const p=planFor(schedDate)||planFor(dkey());const b=p&&p.blocks.find(x=>x.id===d.id);if(!b)return;
  b.done=!b.done;
  if(b.done&&(b.type==='study'||b.type==='revision'))logSession({type:b.type,subjectId:b.subjectId,mins:b.end-b.start,title:b.title,focus:80});
  refresh()};
ACT.doRev=()=>{dueRevisions(dkey()).forEach(r=>r.done=true);DB.xp+=20;refresh();toast(L('Revision logged','المراجعة اتسجلت'))};
ACT.delBlock=d=>{const p=planFor(schedDate)||planFor(dkey());if(!p)return;
  p.blocks=p.blocks.filter(b=>b.id!==d.id);refresh()};
ACT.addNote=async()=>{const r=await modal(L('New note','ملاحظة جديدة'),fld('title',L('Title','العنوان'))+tarea('body',L('Text','النص'))+
  fld('tags',L('Tags, comma separated','وسوم مفصولة بفاصلة')),[BTN.cancel(),BTN.add()],{collect:collectAll});
  if(!r||!r.title)return;DB.notes.push({id:uid(),title:r.title,body:r.body,tags:(r.tags||'').split(',').map(s=>s.trim()).filter(Boolean),date:dkey()});refresh()};
ACT.delNote=d=>{DB.notes=DB.notes.filter(x=>x.id!==d.id);refresh()};
ACT.addCard=async()=>{const r=await modal(L('New flashcard','بطاقة جديدة'),fld('front',L('Front','الوجه'))+fld('back',L('Back','الظهر'))+
  sel('subjectId',L('Subject','المادة'),[['','—']].concat(DB.subjects.map(s=>[s.id,s.name]))),[BTN.cancel(),BTN.add()],{collect:collectAll});
  if(!r||!r.front)return;DB.cards.push({id:uid(),front:r.front,back:r.back,subjectId:r.subjectId,box:1,reviews:0});refresh()};
ACT.delCard=d=>{DB.cards=DB.cards.filter(x=>x.id!==d.id);refresh()};
ACT.review=()=>{
  const due=DB.cards.filter(c=>!c.due||c.due<=dkey());if(!due.length)return;
  let i=0,right=0,shown=false;
  const s=document.createElement('div');s.className='scrim';$('#modals').appendChild(s);
  const draw=()=>{
    if(i>=due.length){s.remove();DB.xp+=due.length*3;checkBadges();save();
      toast(L('Review done · ','خلصت المراجعة · ')+right+'/'+due.length);render();return}
    const c=due[i];
    s.innerHTML='<div class="modal"><div class="between"><h2>'+L('Card ','بطاقة ')+(i+1)+' / '+due.length+'</h2>'+
     '<span class="pill">'+L('Box ','صندوق ')+(c.box||1)+'</span></div>'+
     '<div class="card" style="background:var(--panel2);text-align:center;padding:30px;margin-top:12px"><div style="font-size:18px">'+esc(c.front)+'</div>'+
     (shown?'<div style="margin-top:16px;color:var(--play);font-size:17px">'+esc(c.back)+'</div>':'')+'</div>'+
     '<div class="mfoot">'+(shown?'<button class="btn" data-g="again">'+L('Again','كمان مرة')+'</button><button class="btn pri" data-g="good">'+L('Got it','عرفتها')+'</button>'
      :'<button class="btn pri" data-g="show">'+L('Show answer','اعرض الإجابة')+'</button>')+
     '<button class="btn ghost" data-g="quit">'+L('Close','إغلاق')+'</button></div></div>';
    $$('[data-g]',s).forEach(b=>b.onclick=()=>{const g=b.dataset.g;
      if(g==='quit'){s.remove();save();render();return}
      if(g==='show'){shown=true;draw();return}
      c.reviews=(c.reviews||0)+1;c.box=g==='good'?clamp((c.box||1)+1,1,5):1;
      c.due=dkey(new Date(Date.now()+[0,1,2,4,8,16][c.box]*864e5));
      if(g==='good')right++;i++;shown=false;draw()})};
  draw()};
ACT.addQ=async()=>{const r=await modal(L('New question','سؤال جديد'),fld('q',L('Question','السؤال'))+
  '<div class="grid g2">'+fld('a','A')+fld('b','B')+fld('c','C')+fld('d','D')+'</div>'+
  '<div class="grid g2">'+sel('answer',L('Correct option','الإجابة الصحيحة'),[[0,'A'],[1,'B'],[2,'C'],[3,'D']],0)+
  sel('subjectId',L('Subject','المادة'),[['','—']].concat(DB.subjects.map(s=>[s.id,s.name])))+'</div>'+
  fld('topic',L('Topic','الموضوع')),[BTN.cancel(),BTN.add()],{collect:collectAll});
  if(!r||!r.q)return;DB.questions.push({id:uid(),q:r.q,options:[r.a,r.b,r.c,r.d],answer:+r.answer,subjectId:r.subjectId,topic:r.topic});refresh()};
ACT.delQ=d=>{DB.questions=DB.questions.filter(x=>x.id!==d.id);refresh()};
ACT.simExam=async()=>{
  const cfg=await modal(L('Exam simulation','محاكاة امتحان'),'<div class="grid g2">'+
   sel('subjectId',L('Subject','المادة'),[['',L('All subjects','كل المواد')]].concat(DB.subjects.map(s=>[s.id,s.name])))+
   fld('n',L('Number of questions','عدد الأسئلة'),'number','10')+fld('mins',L('Time limit (minutes)','الوقت بالدقايق'),'number','15')+'</div>',
   [BTN.cancel(),{k:'ok',label:L('Start exam','ابدأ'),pri:1}],{collect:collectAll});
  if(!cfg)return;
  const pool=DB.questions.filter(q=>!cfg.subjectId||q.subjectId===cfg.subjectId).sort(()=>Math.random()-.5).slice(0,+cfg.n||10);
  if(!pool.length)return toast(L('No questions for that subject yet','مفيش أسئلة للمادة دي'));
  const limit=(+cfg.mins||15)*60,t0=Date.now();let i=0,correct=0,weak=[];
  const s=document.createElement('div');s.className='scrim';$('#modals').appendChild(s);
  const draw=()=>{
    const left=Math.max(0,limit-Math.floor((Date.now()-t0)/1000));
    if(i>=pool.length||left<=0)return finish();
    const q=pool[i];
    s.innerHTML='<div class="modal"><div class="between"><h2>'+L('Question ','سؤال ')+(i+1)+' / '+pool.length+'</h2>'+
     '<span class="pill num">'+pad(Math.floor(left/60))+':'+pad(left%60)+'</span></div>'+
     '<p style="font-size:16px;margin:14px 0">'+esc(q.q)+'</p><div class="list">'+
     q.options.map((o,ix)=>'<button class="btn wide" data-op="'+ix+'" style="text-align:start">'+'ABCD'[ix]+'. '+esc(o)+'</button>').join('')+'</div>'+
     '<div class="mfoot"><button class="btn ghost" data-op="-1">'+L('Skip','تخطي')+'</button></div></div>';
    $$('[data-op]',s).forEach(b=>b.onclick=()=>{const ix=+b.dataset.op;
      if(ix===q.answer)correct++;else if(q.topic)weak.push(q.topic);i++;draw()})};
  const tick=setInterval(()=>{const left=Math.max(0,limit-Math.floor((Date.now()-t0)/1000));
    const p=$('.pill',s);if(p)p.textContent=pad(Math.floor(left/60))+':'+pad(left%60);if(left<=0)draw()},1000);
  const finish=()=>{clearInterval(tick);s.remove();
    const m=Math.max(1,Math.round((Date.now()-t0)/6e4)),score=Math.round(correct/pool.length*100);
    DB.quizRuns.push({date:dkey(),subject:(DB.subjects.find(x=>x.id===cfg.subjectId)||{name:L('All subjects','كل المواد')}).name,score,mins:m,weak:[...new Set(weak)]});
    const sub=DB.subjects.find(x=>x.id===cfg.subjectId);if(sub)sub.avgScore=Math.round(((sub.avgScore==null?score:sub.avgScore)+score)/2);
    DB.xp+=score;checkBadges();save();beep(2);
    modal(L('Exam result','نتيجة الامتحان'),'<div class="grid g4">'+
     '<div class="card stat"><span>'+L('Score','الدرجة')+'</span><b>'+N(score+'%')+'</b></div>'+
     '<div class="card stat"><span>'+L('Correct','صح')+'</span><b>'+N(correct)+'</b></div>'+
     '<div class="card stat"><span>'+L('Incorrect','غلط')+'</span><b>'+N(pool.length-correct)+'</b></div>'+
     '<div class="card stat"><span>'+L('Time used','الوقت')+'</span><b>'+N(hm(m))+'</b></div></div>'+
     (weak.length?'<p class="sm mut" style="margin-top:12px">'+L('Topics to revisit: ','مواضيع محتاجة مراجعة: ')+esc([...new Set(weak)].join('، '))+'</p>'
      :'<p class="sm mut" style="margin-top:12px">'+L('No weak topics flagged.','مفيش نقط ضعف ظهرت.')+'</p>'),[BTN.close()],{wide:true}).then(render)};
  draw()};
ACT.addGoal=async()=>{const r=await modal(L('New goal','هدف جديد'),fld('title',L('Goal','الهدف'))+
  '<div class="grid g2">'+sel('metric',L('Measured in','مقياسه'),[['study',L('Study hours','ساعات مذاكرة')],['gaming',L('Gaming hours','ساعات لعب')],
   ['pages',L('Pages of a subject','صفحات مادة')],['cards',L('Flashcard reviews','مراجعات بطاقات')],['tasks',L('Tasks completed','مهام مكتملة')]],'study')+
  fld('target',L('Target','الرقم المستهدف'),'number','30')+fld('deadline',L('Deadline','الموعد النهائي'),'date')+
  sel('subjectId',L('Subject (for pages)','المادة (لو صفحات)'),[['','—']].concat(DB.subjects.map(s=>[s.id,s.name])))+'</div>',
  [BTN.cancel(),BTN.add()],{collect:collectAll});
  if(!r||!r.title)return;
  DB.goals.push({id:uid(),title:r.title,metric:r.metric,target:+r.target||1,deadline:r.deadline,subjectId:r.subjectId,created:Date.now(),
   unit:{study:L('h','س'),gaming:L('h','س'),pages:L('pages','صفحة'),cards:L('reviews','مراجعة'),tasks:L('tasks','مهمة')}[r.metric]});refresh()};
ACT.delGoal=d=>{DB.goals=DB.goals.filter(x=>x.id!==d.id);refresh()};
ACT.addGrade=async()=>{const r=await modal(L('Add result','إضافة نتيجة'),
  '<div class="grid g2">'+sel('subjectId',L('Subject','المادة'),DB.subjects.map(s=>[s.id,s.name]))+
  fld('title',L('Assessment','التقييم'),'text',L('Midterm','ميدتيرم'))+fld('score',L('Score %','الدرجة %'),'number','80')+
  fld('credits',L('Credit hours','الساعات المعتمدة'),'number','3')+'</div>',[BTN.cancel(),BTN.add()],{collect:collectAll});
  if(!r||!r.subjectId)return;
  DB.grades.push({id:uid(),subjectId:r.subjectId,title:r.title,score:clamp(+r.score||0,0,100),credits:+r.credits||3,date:dkey()});
  const s=DB.subjects.find(x=>x.id===r.subjectId);if(s)s.avgScore=Math.round(((s.avgScore==null?+r.score:s.avgScore)+ +r.score)/2);
  refresh()};
ACT.delGrade=d=>{DB.grades=DB.grades.filter(x=>x.id!==d.id);refresh()};
ACT.addJ=async()=>{const r=await modal(L('Journal entry','تدوينة'),
  sel('section',L('Section','القسم'),[[L('Daily reflection','تأمل يومي'),L('Daily reflection','تأمل يومي')],
   [L('Study notes','ملاحظات مذاكرة'),L('Study notes','ملاحظات مذاكرة')],[L('Goals','أهداف'),L('Goals','أهداف')],[L('Thoughts','خواطر'),L('Thoughts','خواطر')]])+
  tarea('text',L('Entry','النص'))+fld('tags',L('Tags','وسوم')),[BTN.cancel(),BTN.add()],{collect:collectAll});
  if(!r||!r.text)return;
  DB.journal.push({id:uid(),date:dkey(),section:r.section,text:r.text,tags:(r.tags||'').split(',').map(s=>s.trim()).filter(Boolean)});refresh()};
ACT.delJ=d=>{DB.journal=DB.journal.filter(x=>x.id!==d.id);refresh()};
ACT.addDistraction=async()=>{const r=await modal(L('What pulled you away?','إيه اللي شتتك؟'),
  fld('what',L('Phone, a person, YouTube…','الموبايل، حد، يوتيوب…'))+tarea('note',L('Anything to remember','حاجة تفتكرها')),
  [BTN.cancel(),BTN.add()],{collect:collectAll});
  if(!r||!r.what)return;DB.distractions.push({id:uid(),what:r.what,note:r.note,date:dkey()});refresh()};
ACT.clearDistractions=async()=>{
  if(!await modal(L('Clear the distraction log?','تمسح سجل المشتتات؟'),'',[BTN.cancel(),{k:'ok',label:L('Clear','امسح'),pri:1}]))return;
  DB.distractions=[];refresh()};
ACT.delSession=async d=>{
  if(!await modal(L('Delete this entry?','تمسح السجل ده؟'),'<p class="mut">'+L('This removes it from your history and stats.','ده هيشيله من سجلك وإحصائياتك.')+'</p>',
    [BTN.cancel(),{k:'ok',label:L('Delete','حذف'),pri:1}]))return;
  DB.sessions=DB.sessions.filter(s=>s.id!==d.id);refresh()};
ACT.delQuizRun=async d=>{
  if(!await modal(L('Delete this result?','تمسح النتيجة دي؟'),'',[BTN.cancel(),{k:'ok',label:L('Delete','حذف'),pri:1}]))return;
  DB.quizRuns.splice(+d.i,1);refresh()};

/* --- timers --- */
let TIMER=null;
const overlay=()=>{const z=document.createElement('div');z.id='zen';document.body.appendChild(z);return z};
/* renders the countdown face according to P.timerStyle; color is a CSS var string */
function timerFace(left,total,color){
  const pct=clamp(1-left/total,0,1);
  const mm=pad(Math.floor(left/60)),ss=pad(left%60);
  if(P.timerStyle==='bars'){
    const n=24,filled=Math.round(n*pct);
    return '<div style="display:flex;gap:3px;justify-content:center;max-width:280px;flex-wrap:wrap">'+
     [...Array(n)].map((_,i)=>'<div style="width:8px;height:'+(i<filled?'34px':'16px')+';border-radius:3px;background:'+(i<filled?color:'var(--panel2)')+';transition:height .25s"></div>').join('')+
     '</div><div class="clock" style="margin-top:14px">'+mm+':'+ss+'</div>';
  }
  if(P.timerStyle==='dots'){
    const n=60,filled=Math.round(n*pct);
    const pts=[...Array(n)].map((_,i)=>{const a=(i/n)*2*Math.PI-Math.PI/2,r=42,x=50+r*Math.cos(a),y=50+r*Math.sin(a);
      return '<circle cx="'+x+'" cy="'+y+'" r="'+(i<filled?2.6:1.6)+'" fill="'+(i<filled?color:'var(--panel2)')+'"/>'}).join('');
    return '<svg viewBox="0 0 100 100" style="width:min(60vw,220px)">'+pts+'</svg><div class="clock" style="margin-top:10px">'+mm+':'+ss+'</div>';
  }
  if(P.timerStyle==='flip'){
    return '<div style="display:flex;gap:8px;justify-content:center;direction:ltr">'+
     [mm[0],mm[1],':',ss[0],ss[1]].map(ch=>ch===':'?
       '<div style="font-size:44px;align-self:center;color:var(--dim)">:</div>':
       '<div style="background:var(--panel2);border:1px solid var(--line);border-radius:10px;width:52px;height:72px;display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:700;color:'+color+'">'+ch+'</div>').join('')+'</div>';
  }
  // default: ring
  return '<svg id="zenRing" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="var(--panel2)" stroke-width="6"/>'+
   '<circle cx="50" cy="50" r="45" fill="none" stroke="'+color+'" stroke-width="6" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="'+(283-283*pct)+'" transform="rotate(-90 50 50)"/></svg>'+
   '<div class="clock">'+mm+':'+ss+'</div>';
}
function startFocus(subjectId,title,minutes,blockId){
  if(TIMER)return toast(L('A session is already running','في جلسة شغالة بالفعل'));
  if(!subjectId&&!title){const s=rankedSubjects()[0];if(s){subjectId=s.id;title=L('Study ','مذاكرة ')+s.name}else title=L('Focus session','جلسة تركيز')}
  const total=(minutes||P.sessionLen||45)*60;let left=total,paused=false;
  if(P.noise)noise(true);
  const z=overlay();
  const draw=()=>{
    z.innerHTML='<div class="ttl">'+esc(title||'')+'</div>'+
     timerFace(left,total,'var(--study)')+
     '<div class="row" style="justify-content:center"><button class="btn" id="pz">'+(paused?L('Resume','كمّل'):L('Pause','إيقاف مؤقت'))+'</button>'+
     '<button class="btn" id="dz">'+L('Log a distraction','سجّل مشتت')+'</button>'+
     '<button class="btn ghost" id="cz">'+L('Give up (no reward)','استسلم (من غير مكافأة)')+'</button></div>'+
     '<p class="xs dim">'+L('The timer must run out on its own — no early finish, so the reward stays honest.','المؤقت لازم يخلص لوحده — مفيش إنهاء مبكر، عشان المكافأة تفضل صادقة.')+'</p>'+
     '<p class="xs dim">'+(P.blockEnabled?L('Blocking on: ','الحجب شغّال: ')+P.blocked.slice(0,3).join('، ')+'…':L('Distraction blocking is off','حاجب المشتتات مقفول'))+'</p>';
    $('#pz',z).onclick=()=>{paused=!paused;draw()};
    $('#dz',z).onclick=()=>ACT.addDistraction();
    $('#cz',z).onclick=async()=>{
      const ok=await modal(L('Give up this session?','تستسلم من الجلسة دي؟'),'<p class="mut">'+L('No XP, no coins, and it will not be logged.','مفيش XP ولا عملات، ومش هتتسجل.')+'</p>',
        [{k:null,label:L('Keep going','كمّل')},{k:'ok',label:L('Give up','استسلم'),pri:1}]);
      if(ok){clearInterval(TIMER);TIMER=null;noise(false);z.remove()}
    };
  };
  const done=async()=>{
    clearInterval(TIMER);TIMER=null;noise(false);beep(2);
    const spent=Math.max(1,Math.round(total/60));z.remove();
    const r=await modal(L('Session finished 🎉','خلصت الجلسة 🎉'),'<p class="mut">'+N(hm(spent))+L(' on ',' في ')+esc(title||'')+'</p>'+
      sel('focus',L('How focused were you?','كان تركيزك عامل إيه؟'),[[95,L('Completely','كامل')],[80,L('Mostly','معظمه')],[60,L('Half','نص نص')],[35,L('Barely','ضعيف')]],80),
      [BTN.close()],{collect:collectAll});
    logSession({type:'study',subjectId,mins:spent,title,focus:r?+r.focus:80});
    const coinGain=spent>=25?Math.floor(spent/25):0;
    if(coinGain)addCoins(coinGain);
    if(blockId){const p=planFor(dkey());const b=p&&p.blocks.find(x=>x.id===blockId);if(b)b.done=true}
    save();toast(L('Logged ','اتسجلت ')+hm(spent)+(coinGain?' · +'+coinGain+' 🪙':'')+L(' · unlocked ',' · فتحت ')+hm(Math.round(spent/60*(P.ratio||45)))+L(' of gaming',' لعب'));render()};
  draw();
  TIMER=setInterval(()=>{if(paused)return;left--;if(left<=0)return done();draw()},1000)}
ACT.startFocus=()=>startFocus();
ACT.studySub=d=>{const s=DB.subjects.find(x=>x.id===d.id);startFocus(s.id,L('Study ','مذاكرة ')+s.name)};
ACT.startBlock=d=>{const p=planFor(schedDate)||planFor(dkey());const b=p&&p.blocks.find(x=>x.id===d.id);
  if(b)startFocus(b.subjectId,b.title,b.end-b.start,b.id)};
ACT.setSess=async()=>{const r=await modal(L('Session length','طول الجلسة'),fld('n',L('Minutes','دقايق'),'number',P.sessionLen),
  [BTN.cancel(),BTN.save()],{collect:collectAll});if(r){P.sessionLen=clamp(+r.n||45,10,120);refresh()}};
ACT.toggleNoise=()=>{P.noise=!P.noise;save();noise(P.noise&&!!TIMER);toast(L('Focus noise ','ضوضاء التركيز ')+(P.noise?L('on','شغالة'):L('off','مقفولة')))};
ACT.setTimerStyle=d=>{P.timerStyle=d.v;refresh()};
ACT.setAlarm=d=>{P.alarmTone=d.v;save();beep(2);render()};
ACT.breakNow=d=>{const m=+d.m;const z=overlay();let left=m*60;
  const draw=()=>{z.innerHTML='<div class="ttl">'+L('Break','استراحة')+'</div><div class="clock">'+pad(Math.floor(left/60))+':'+pad(left%60)+'</div>'+
    '<button class="btn" id="bz">'+L('End break','خلصت الاستراحة')+'</button>';
    $('#bz',z).onclick=()=>{clearInterval(TIMER);TIMER=null;z.remove();logSession({type:'break',mins:m-Math.round(left/60),title:L('Break','استراحة')});render()}};
  draw();if(TIMER)clearInterval(TIMER);
  TIMER=setInterval(()=>{left--;
    if(left<=0){clearInterval(TIMER);TIMER=null;z.remove();beep(2);logSession({type:'break',mins:m,title:L('Break','استراحة')});
      toast(L('Break over','خلصت الاستراحة'));render();return}
    const c=$('.clock',z);if(c)c.textContent=pad(Math.floor(left/60))+':'+pad(left%60)},1000)};
function startGaming(){
  const k=dkey(),allow=gamingAllowance(k),left0=Math.max(0,allow-gamingMinutes(k));
  if(left0<1)return toast(L('No gaming time unlocked yet — study a little first','مفيش وقت لعب مفتوح لسه — ذاكر شوية الأول'));
  modal(L('Gaming session','جلسة لعب'),fld('game',L('Game','اللعبة'),'text','CrossFire')+
   '<p class="sm mut">'+L('Allowed right now: ','المسموح دلوقتي: ')+'<b>'+N(hm(left0))+'</b></p>',
   [BTN.cancel(),{k:'ok',label:L('Start','ابدأ'),pri:1}],{collect:collectAll}).then(r=>{
    if(!r)return;
    let left=left0*60;const z=overlay(),warned={};
    const draw=()=>{z.innerHTML='<div class="ttl">🎮 '+esc(r.game||'')+'</div>'+
      timerFace(left,left0*60,'var(--play)')+
      '<div class="sm mut">'+L('Used ','اتستخدم ')+N(hm(left0-Math.round(left/60)))+L(' of ',' من ')+N(hm(left0))+'</div>'+
      '<button class="btn play" id="gz">'+L('End session','إنهاء')+'</button>';
      $('#gz',z).onclick=end};
    const end=()=>{clearInterval(TIMER);TIMER=null;z.remove();
      const spent=Math.max(1,left0-Math.round(left/60));logSession({type:'gaming',mins:spent,title:r.game});
      toast(L('Logged ','اتسجل ')+hm(spent)+L(' of gaming',' لعب'));render()};
    draw();if(TIMER)clearInterval(TIMER);
    TIMER=setInterval(()=>{left--;const mLeft=Math.round(left/60);
      if(P.warnings)[30,10,5].forEach(w=>{if(mLeft===w&&!warned[w]){warned[w]=1;beep(1);toast(N(w)+L(' minutes remaining',' دقيقة باقية'))}});
      if(left<=0)return end();
      draw()},1000)})}
ACT.startGame=()=>startGaming();
ACT.addGame=async()=>{const r=await modal(L('Log gaming time','سجّل وقت لعب'),fld('n',L('Minutes','دقايق'),'number','30')+fld('game',L('Game','اللعبة'),'text','CrossFire'),
  [BTN.cancel(),BTN.save()],{collect:collectAll});if(r){logSession({type:'gaming',mins:+r.n||0,title:r.game});render()}};
ACT.setRatio=d=>{P.ratio=+d.v;P.gamingMode='reward';refresh()};
ACT.customRatio=async()=>{const r=await modal(L('Custom ratio','نسبة مخصصة'),fld('n',L('Gaming minutes per study hour','دقايق لعب لكل ساعة مذاكرة'),'number',P.ratio),
  [BTN.cancel(),BTN.save()],{collect:collectAll});if(r){P.ratio=clamp(+r.n||45,1,180);P.gamingMode='reward';refresh()}};
ACT.fixedMode=async()=>{const r=await modal(L('Fixed gaming limit','حد ثابت للعب'),fld('n',L('Minutes a day','دقايق في اليوم'),'number',P.gamingGoal),
  [BTN.cancel(),BTN.save()],{collect:collectAll});if(r){P.gamingMode='fixed';P.gamingGoal=clamp(+r.n||120,0,600);refresh()}};
ACT.toggleWarn=()=>{P.warnings=!P.warnings;save()};
ACT.buyGame=d=>{const m=+d.m,x=+d.x;if((DB.xp||0)<x)return;
  DB.xp-=x;DB.bonusGaming=DB.bonusGaming||{};DB.bonusGaming[dkey()]=(DB.bonusGaming[dkey()]||0)+m;
  refresh();toast('+'+hm(m)+L(' gaming added',' لعب اتضافت'))};
ACT.logSleep=async()=>{const r=await modal(L('Last night','امبارح بالليل'),fld('h',L('Hours slept','عدد ساعات النوم'),'number','8'),
  [BTN.cancel(),BTN.save()],{collect:collectAll});if(r){logSession({type:'sleep',mins:Math.round((+r.h||0)*60),title:L('Sleep','نوم')});render()}};
ACT.setTimes=async()=>{const r=await modal(L('Wake and sleep','النوم والصحيان'),fld('wake',L('Wake','الصحيان'),'time',P.wake)+fld('sleep',L('Sleep','النوم'),'time',P.sleep),
  [BTN.cancel(),BTN.save()],{collect:collectAll});if(r){P.wake=r.wake;P.sleep=r.sleep;refresh()}};
ACT.freeze=()=>{if(P.freezes<=0)return;P.freezes--;DB.freezeDays.push(dkey());refresh();
  toast(L('Rest day used — your streak is safe','استخدمت يوم راحة — سلسلتك في أمان'))};

/* --- settings actions --- */
ACT.saveSettings=()=>{const o=grab($('#view'));
  Object.assign(P,{name:o.name||P.name,wake:o.wake,sleep:o.sleep,studyGoal:+o.studyGoal||240,gamingGoal:+o.gamingGoal||120,
   sessionLen:+o.sessionLen||45,breakShort:+o.breakShort||10,breakLong:+o.breakLong||25,lang:o.lang,theme:o.theme,accent:o.accent,
   timerStyle:o.timerStyle||P.timerStyle,alarmTone:o.alarmTone||P.alarmTone,density:o.density||P.density,idleLockMin:+o.idleLockMin||0});
  const us=users().map(u=>u.id===SESSION.id?Object.assign(u,{name:P.name}):u);saveUsers(us);SESSION.name=P.name;LS.set('sf:session',SESSION);
  save();applyChrome();document.body.classList.toggle('densec',P.density==='compact');shell();render();resetIdle();
  toast(L('Settings saved','الإعدادات اتحفظت'))};
ACT.togglePrayers=()=>{P.prayers=!P.prayers;refresh()};
ACT.togglePrayerAuto=()=>{P.prayerAuto=!P.prayerAuto;save();if(P.prayerAuto)refreshOnlinePrayerTimes().then(()=>render());else render()};
ACT.refreshPrayers=async()=>{toast(L('Checking online…','بيتأكد أونلاين…'));await refreshOnlinePrayerTimes();refresh();
  toast(navigator.onLine?L('Prayer times updated','مواقيت الصلاة اتحدثت'):L('Offline — using calculated times','مفيش نت — استخدمنا الحساب اليدوي'))};
ACT.setLoc=async()=>{const r=await modal(L('Location','الموقع'),'<div class="grid g2">'+fld('lat',L('Latitude','خط العرض'),'number',P.lat)+
  fld('lng',L('Longitude','خط الطول'),'number',P.lng)+fld('tz',L('UTC offset','فرق التوقيت عن جرينتش'),'number',P.tz)+'</div>',
  [BTN.cancel(),BTN.save()],{collect:collectAll});
  if(!r)return;P.lat=+r.lat;P.lng=+r.lng;P.tz=+r.tz;refresh()};
ACT.geo=()=>{if(!navigator.geolocation)return toast(L('Geolocation is not available','تحديد الموقع مش متاح'));
  navigator.geolocation.getCurrentPosition(p=>{P.lat=+p.coords.latitude.toFixed(3);P.lng=+p.coords.longitude.toFixed(3);
    P.tz=-new Date().getTimezoneOffset()/60;refresh();toast(L('Location updated','الموقع اتحدث'))},
    ()=>toast(L('Permission denied','الإذن مترفض')))};
ACT.toggleVac=()=>{P.vacation=!P.vacation;save();toast(L('Vacation mode ','وضع الإجازة ')+(P.vacation?L('on','شغّال'):L('off','مقفول')));render()};
ACT.toggleSound=()=>{P.sound=!P.sound;save();if(P.sound)beep(1)};
ACT.tglWidget=d=>{P.widgets[d.v]=P.widgets[d.v]?0:1;refresh()};
ACT.toggleBlocker=()=>{P.blockEnabled=!P.blockEnabled;save();toast(L('Blocking ','الحجب ')+(P.blockEnabled?L('on','شغّال'):L('off','مقفول')))};
ACT.editBlocklist=async()=>{const r=await modal(L('Distraction list','قايمة المشتتات'),
  tarea('l',L('One site or app per line','موقع أو تطبيق في كل سطر'),P.blocked.join('\n'))+
  '<div class="grid g2">'+fld('from',L('Active from','من'),'time',P.blockFrom)+fld('to',L('Active until','إلى'),'time',P.blockTo)+'</div>',
  [BTN.cancel(),BTN.save()],{collect:collectAll});
  if(!r)return;P.blocked=r.l.split('\n').map(s=>s.trim()).filter(Boolean);P.blockFrom=r.from;P.blockTo=r.to;refresh()};
ACT.hmSet=d=>{hmMetric=d.v;render()};
ACT.resetDay=()=>{delete DB.plans[dkey()];refresh();toast(L("Today's plan cleared",'خطة النهاردة اتمسحت'))};
ACT.preset=async()=>{
  const r=await modal(L('Adjust the plan','تعديل الخطة'),'<div class="list">'+
   [['balanced',L('Balanced','متوازن'),L('Study fits around 8 hours of sleep','المذاكرة تترتب حوالين ٨ ساعات نوم')],
    ['intense',L('Intensive','مكثّف'),L('Longer sessions, shorter breaks','جلسات أطول واستراحات أقصر')],
    ['custom',L('Custom','مخصص'),L('Set your own daily target','حدد هدفك اليومي بنفسك')]]
   .map(o=>'<button class="item" data-pick="'+o[0]+'" style="width:100%;text-align:start"><div class="grow"><div class="t">'+o[1]+'</div><div class="s">'+o[2]+'</div></div></button>').join('')+'</div>',
   [BTN.cancel(),{k:'ok',label:L('Apply','تطبيق'),pri:1}],{collect:s=>({p:picked(s,'balanced')})});
  if(!r)return;
  if(r.p==='balanced'){P.studyGoal=Math.min(P.studyGoal,300);P.sessionLen=45;P.breakShort=10}
  if(r.p==='intense'){P.sessionLen=60;P.breakShort=7;P.breakLong=20}
  if(r.p==='custom'){const c=await modal(L('Custom','مخصص'),fld('n',L('Daily study minutes','دقايق المذاكرة اليومية'),'number',P.studyGoal),
    [BTN.cancel(),BTN.save()],{collect:collectAll});if(c)P.studyGoal=+c.n||P.studyGoal}
  save();previewPlan(generatePlan(schedDate,{energy:3}))};
ACT.showChangelog=()=>modal(L("What's new","الجديد"),
  '<div class="list">'+CHANGELOG.map(c=>'<div class="card" style="background:var(--panel2)"><b>v'+c[0]+'</b>'+
   '<p class="sm mut" style="margin:6px 0 0">'+esc(L(c[1][0],c[1][1]))+'</p></div>').join('')+'</div>',[BTN.close()],{wide:true});
ACT.wipe=async()=>{
  if(!await modal(L('Erase this profile','مسح الملف ده'),'<p class="mut">'+L('Every subject, session, note and journal entry on this profile will be removed. Export a backup first if you might want it back.','كل المواد والجلسات والملاحظات والمذكرات في الملف ده هتتمسح. اعمل نسخة احتياطية الأول لو ممكن تحتاجها.')+'</p>',
   [BTN.cancel(),{k:'ok',label:L('Continue','كمّل')}]))return;
  if(!await modal(L('Are you sure?','متأكد؟'),'<p class="mut">'+L('This cannot be undone.','مفيش رجوع بعد كده.')+'</p>',
   [{k:null,label:L('Keep my data','سيب بياناتي')},{k:'ok',label:L('Erase','امسح'),pri:1}]))return;
  const nm=P.name;DB=blank(nm);P=DB.settings;P.onboarded=true;save();applyChrome();shell();render();toast(L('Profile erased','الملف اتمسح'))};

/* =========================================================
   IMPORT / EXPORT
   ========================================================= */
function download(name,text,mime){
  try{
    const b=new Blob([text],{type:mime||'text/plain;charset=utf-8'}),u=URL.createObjectURL(b);
    const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),2000);toast(L('Saved ','اتحفظ ')+name);
  }catch(e){toast(L('Download blocked here — try the installed app.','التحميل متوقف هنا — جرّب النسخة المثبتة.'))}
}
ACT.exportJSON=()=>{P.lastBackup=Date.now();save();download('orbix-'+dkey()+'.json',JSON.stringify(DB,null,2),'application/json')};
async function deriveKey(pass,salt){
  const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
ACT.protectedExport=async()=>{
  const r=await modal(L('Protected backup','نسخة محمية'),
   '<p class="sm mut">'+L('Choose a passphrase. You will need the exact same one to restore this file.','اختار كلمة سر. هتحتاج نفسها بالظبط علشان ترجّع الملف ده.')+'</p>'+
   fld('pass',L('Passphrase','كلمة السر'),'password'),[BTN.cancel(),{k:'ok',label:L('Export','صدّر'),pri:1}],{collect:collectAll});
  if(!r||!r.pass)return;
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(r.pass,salt);
  const enc=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(DB)));
  const toB64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf)));
  const payload=JSON.stringify({orbixEncrypted:true,salt:toB64(salt),iv:toB64(iv),data:toB64(enc)});
  P.lastBackup=Date.now();save();
  download('orbix-protected-'+dkey()+'.json',payload,'application/json');
};
ACT.protectedImport=()=>{
  const inp=document.createElement('input');inp.type='file';inp.accept='.json';
  inp.onchange=()=>{const f=inp.files[0];if(!f)return;const rd=new FileReader();
    rd.onload=async()=>{
      try{
        const j=JSON.parse(String(rd.result));
        if(!j.orbixEncrypted)return toast(L('This is not a protected backup file.','الملف ده مش نسخة محمية.'));
        const r=await modal(L('Enter passphrase','ادخل كلمة السر'),fld('pass',L('Passphrase','كلمة السر'),'password'),
          [BTN.cancel(),{k:'ok',label:L('Restore','استرجاع'),pri:1}],{collect:collectAll});
        if(!r||!r.pass)return;
        const fromB64=b64=>Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
        const key=await deriveKey(r.pass,fromB64(j.salt));
        const dec=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(j.iv)},key,fromB64(j.data));
        const obj=JSON.parse(new TextDecoder().decode(dec));
        const ok=await modal(L('Replace your data?','تستبدل بياناتك؟'),'<p class="mut">'+L('This overwrites everything currently in this account.','ده هيستبدل كل حاجة موجودة في الحساب ده دلوقتي.')+'</p>',
          [BTN.cancel(),{k:'ok',label:L('Replace','استبدال'),pri:1}]);
        if(!ok)return;
        DB=Object.assign(blank(),obj);DB.settings=Object.assign(blank().settings,obj.settings);P=DB.settings;
        save();applyChrome();shell();render();toast(L('Restored','اترجعت البيانات'));
      }catch(e){toast(L('Wrong passphrase or corrupted file.','كلمة السر غلط أو الملف تالف.'))}
    };
    rd.readAsText(f)};
  inp.click();
};
ACT.exportDay=()=>{const p=planFor(schedDate);if(!p)return toast(L('Nothing to export','مفيش حاجة تتصدر'));
  download('schedule-'+schedDate+'.csv','\ufeffstart,end,type,title\n'+p.blocks.map(b=>[m2t(b.start),m2t(b.end),b.type,'"'+(b.title||'').replace(/"/g,'""')+'"'].join(',')).join('\n'),'text/csv')};
ACT.exportWeek=()=>{let rows='\ufeffdate,start,end,type,title\n';
  for(let i=0;i<7;i++){const k=dkey(new Date(Date.now()+i*864e5)),p=planFor(k);
    if(p)p.blocks.forEach(b=>rows+=[k,m2t(b.start),m2t(b.end),b.type,'"'+(b.title||'').replace(/"/g,'""')+'"'].join(',')+'\n')}
  download('studyflow-week.csv',rows,'text/csv')};
ACT.exportPDF=()=>{
  const p=planFor(schedDate),w=window.open('','_blank');
  if(!w)return toast(L('Allow pop-ups to print','اسمح بالنوافذ المنبثقة علشان الطباعة'));
  const rtl=AR()?'rtl':'ltr';
  w.document.write('<meta charset="utf-8"><title>ORBIX '+schedDate+'</title>'+
   '<style>body{font-family:system-ui,Tahoma,sans-serif;direction:'+rtl+';padding:32px;max-width:640px;margin:auto}'+
   'h1{margin:0 0 4px}td{padding:6px 10px;border-bottom:1px solid #ddd}</style>'+
   '<h1>ORBIX</h1><p>'+schedDate+' · '+esc(P.name)+'</p><table>'+
   (p?p.blocks.map(b=>'<tr><td dir="ltr">'+m2t(b.start)+'–'+m2t(b.end)+'</td><td>'+esc(b.title)+'</td><td>'+tname(b.type)+'</td></tr>').join('')
     :'<tr><td>'+L('No plan','مفيش خطة')+'</td></tr>')+'</table>'+
   '<p style="margin-top:24px;color:#777">'+L('Study smart. Play better. Live balanced.','ذاكر بذكاء. العب براحتك. عيش متوازن.')+'</p>');
  w.document.close();setTimeout(()=>w.print(),400)};
ACT.importFile=()=>{
  const inp=document.createElement('input');inp.type='file';inp.accept='.json,.csv,.ics,.txt';
  inp.onchange=()=>{const f=inp.files[0];if(!f)return;const rd=new FileReader();
    rd.onload=()=>{try{importText(f.name,String(rd.result))}catch(e){toast(L('Could not read that file','مش قادر أقرا الملف ده'))}};
    rd.readAsText(f)};
  inp.click()};
function importText(name,txt){
  const low=name.toLowerCase();
  if(low.endsWith('.json')){
    const o=JSON.parse(txt);
    if(o.settings&&o.subjects){
      modal(L('Import backup','استيراد نسخة احتياطية'),'<p class="mut">'+L('Replace this profile with the file contents?','أستبدل الملف ده بمحتوى الملف؟')+'</p>',
       [BTN.cancel(),{k:'ok',label:L('Replace','استبدال'),pri:1}]).then(r=>{if(!r)return;
        DB=Object.assign(blank(),o);DB.settings=Object.assign(blank().settings,o.settings);P=DB.settings;
        save();applyChrome();shell();render();toast(L('Imported','تم الاستيراد'))});return}
    if(Array.isArray(o)){o.forEach(e=>DB.events.push({id:uid(),title:e.title||e.name,type:e.type||'class',start:e.start,end:e.end,
      repeat:e.date?'once':'weekly',days:e.days,date:e.date}));save();render();toast(L('Imported events','اتستوردت المواعيد'));return}
  }
  if(low.endsWith('.ics')){
    const ev=txt.split('BEGIN:VEVENT').slice(1);let n=0;
    ev.forEach(b=>{const g=re=>((b.match(re)||[])[1]||'').trim();
      const s=g(/DTSTART[^:]*:([0-9TZ]+)/),e=g(/DTEND[^:]*:([0-9TZ]+)/),t=g(/SUMMARY:(.*)/);
      if(!s||!t)return;
      const dt=x=>x.slice(0,4)+'-'+x.slice(4,6)+'-'+x.slice(6,8), tm=x=>x.length>8?x.slice(9,11)+':'+x.slice(11,13):'09:00';
      DB.events.push({id:uid(),title:t,type:'class',start:tm(s),end:e?tm(e):tm(s),repeat:'once',date:dt(s)});n++});
    save();render();toast(L('Imported ','اتستورد ')+n);return}
  const lines=txt.replace(/^\ufeff/,'').trim().split(/\r?\n/);
  const head=lines[0].toLowerCase().split(',').map(s=>s.trim());const ix=k=>head.indexOf(k);let n=0;
  lines.slice(1).forEach(l=>{const c=l.split(',').map(s=>s.replace(/^"|"$/g,'').trim());if(c.length<3)return;
    const days=ix('days')>=0&&c[ix('days')]?c[ix('days')].split(/[ |;]/).map(Number).filter(x=>!isNaN(x)):null;
    DB.events.push({id:uid(),title:c[ix('title')>=0?ix('title'):0],type:ix('type')>=0?c[ix('type')]:'class',
      start:c[ix('start')>=0?ix('start'):1],end:c[ix('end')>=0?ix('end'):2],repeat:days?'weekly':'once',days,
      date:ix('date')>=0?c[ix('date')]:dkey()});n++});
  save();render();toast(L('Imported ','اتستورد ')+n);
}

/* =========================================================
   PALETTE + SEARCH + SHORTCUTS
   ========================================================= */
const CMDS=()=>[
 [L('Start focus session','ابدأ جلسة تركيز'),'🎯',()=>startFocus()],
 [L('Start gaming timer','ابدأ مؤقت اللعب'),'🎮',()=>startGaming()],
 [L('What should I do now?','أعمل إيه دلوقتي؟'),'⚡',()=>ACT.whatnow()],
 [L('Plan my day','خطة يومي'),'🧠',()=>ACT.checkin()],
 [L('Catch-up mode','وضع اللحاق'),'🔁',()=>ACT.catchup()],
 [L('Night review','مراجعة الليل'),'🌙',()=>ACT.night()],
 [L('Weekly review','المراجعة الأسبوعية'),'📊',()=>ACT.weekly()],
 [L('Quick capture','التقاط سريع'),'➕',()=>quickCapture()],
 [L('Add subject','إضافة مادة'),'📚',()=>ACT.addSub()],
 [L('Add exam','إضافة امتحان'),'📖',()=>ACT.addExam()],
 [L('Add task','إضافة مهمة'),'✅',()=>ACT.addTask()],
 [L('Add flashcard','إضافة بطاقة'),'🧠',()=>ACT.addCard()],
 [L('Start exam simulation','محاكاة امتحان'),'❓',()=>ACT.simExam()],
 [L('Export backup','نسخة احتياطية'),'💾',()=>ACT.exportJSON()],
 [L('Switch language','تبديل اللغة'),'🌐',()=>{P.lang=AR()?'en':'ar';save();applyChrome();shell();render()}],
 [L('Toggle exam mode','وضع الامتحانات'),'🚩',()=>ACT.toggleExamMode()]
].concat(NAV.map(n=>[L('Open ','افتح ')+L(n[2][0],n[2][1]),n[1],()=>go(n[0])]));
function searchAll(q){
  q=q.toLowerCase();const out=[];
  DB.subjects.filter(s=>s.name.toLowerCase().includes(q)).forEach(s=>out.push([L('Subject · ','مادة · ')+s.name,'📚',()=>go('subjects')]));
  DB.tasks.filter(t=>t.title.toLowerCase().includes(q)).forEach(t=>out.push([L('Task · ','مهمة · ')+t.title,'✅',()=>go('tasks')]));
  DB.exams.filter(e=>(e.name||'').toLowerCase().includes(q)).forEach(e=>out.push([L('Exam · ','امتحان · ')+e.name,'📖',()=>go('exams')]));
  DB.notes.filter(n=>(n.title+n.body).toLowerCase().includes(q)).forEach(n=>out.push([L('Note · ','ملاحظة · ')+n.title,'📝',()=>go('notes')]));
  DB.cards.filter(c=>(c.front+c.back).toLowerCase().includes(q)).forEach(c=>out.push([L('Card · ','بطاقة · ')+c.front,'🧠',()=>go('cards')]));
  DB.journal.filter(j=>j.text.toLowerCase().includes(q)).forEach(j=>out.push([L('Journal · ','مذكرة · ')+j.text.slice(0,40),'📓',()=>go('journal')]));
  return out;
}
let palIdx=0,palRows=[];
function openPalette(pref){
  if($('#pal'))return;
  const s=document.createElement('div');s.className='scrim';s.id='pal';
  s.innerHTML='<div class="modal"><input id="palIn" placeholder="'+L('Type a command, or search…','اكتب أمر أو ابحث…')+'" value="'+esc(pref||'')+'"><div id="palList"></div></div>';
  $('#modals').appendChild(s);
  const inp=$('#palIn',s);
  const fill=()=>{const q=inp.value.trim();
    palRows=(q?CMDS().filter(c=>c[0].toLowerCase().includes(q.toLowerCase())):CMDS()).slice(0,8).concat(q?searchAll(q).slice(0,8):[]);
    palIdx=0;
    $('#palList',s).innerHTML=palRows.length?palRows.map((r,i)=>'<button data-i="'+i+'" class="'+(i===palIdx?'on':'')+'"><span>'+r[1]+'</span>'+esc(r[0])+'</button>').join('')
     :'<div class="empty" style="border:0"><b>'+L('Nothing found','مفيش نتايج')+'</b>'+L('Try a subject name or a command.','جرّب اسم مادة أو أمر.')+'</div>';
    $$('#palList button',s).forEach(b=>b.onclick=()=>{const f=palRows[+b.dataset.i][2];s.remove();f()})};
  inp.oninput=fill;fill();inp.focus();
  s.addEventListener('click',e=>{if(e.target===s)s.remove()});
  inp.onkeydown=e=>{
    if(e.key==='Escape')s.remove();
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();palIdx=clamp(palIdx+(e.key==='ArrowDown'?1:-1),0,palRows.length-1);
      $$('#palList button',s).forEach((b,i)=>b.classList.toggle('on',i===palIdx))}
    if(e.key==='Enter'&&palRows[palIdx]){const f=palRows[palIdx][2];s.remove();f()}};
}
document.addEventListener('keydown',e=>{
  const k=(e.key||'').toLowerCase();
  if((e.ctrlKey||e.metaKey)&&k==='k'){e.preventDefault();openPalette('')}
  if((e.ctrlKey||e.metaKey)&&k==='/'){e.preventDefault();quickCapture()}
  if(e.ctrlKey&&e.shiftKey){
    if(k==='s'){e.preventDefault();startFocus()}
    if(k==='g'){e.preventDefault();startGaming()}
    if(k==='f'){e.preventDefault();go('focus')}
    if(k==='t'){e.preventDefault();go('schedule')}}
  if(k==='escape'&&$('#zen')&&!TIMER)$('#zen').remove();
});

/* =========================================================
   REMINDERS
   ========================================================= */
const remSeen={};
function reminderTick(){
  const k=dkey(),p=planFor(k);if(!p)return;const now=nowMin();
  p.blocks.forEach(b=>{
    if(b.done||b.fixed||remSeen[b.id])return;
    if(now>=b.start&&now<b.start+3){remSeen[b.id]=1;smartRemind(b,!!TIMER)}});
}
async function smartRemind(b,busy){
  beep(1);
  const r=await modal(L('Reminder','تذكير'),
   '<p>'+(busy?L('You planned to start ','كنت ناوي تبدأ ')+'<b>'+esc(b.title)+'</b>'+L(' now, but you are in the middle of something else.',' دلوقتي، بس أنت في نص حاجة تانية.')
    :L('It is ','الساعة ')+N(m2t(b.start))+L(' — time for ',' — وقت ')+'<b>'+esc(b.title)+'</b> ('+hm(b.end-b.start)+').')+'</p>',
   [{k:'skip',label:L('Skip','تخطي')},{k:'delay',label:L('Delay 15 min','أجّل ١٥ دقيقة')},
    {k:'resch',label:L('Reschedule','أعد الجدولة')},{k:'start',label:L('Start','ابدأ'),pri:1}]);
  if(r==='start')return b.type==='gaming'?startGaming():startFocus(b.subjectId,b.title,b.end-b.start,b.id);
  if(r==='delay'){b.start+=15;b.end+=15;delete remSeen[b.id];save();render();return}
  if(r==='resch')return previewPlan(generatePlan(dkey(),{energy:DB.moods[dkey()]||3}));
  if(r==='skip'){b.skipped=true;save();
    const q=await modal(L('Rebuild the rest of the day?','أعيد بناء باقي اليوم؟'),
      '<p class="mut">'+L('The missed time can be spread over what is left.','الوقت اللي فات ممكن يتوزع على الباقي.')+'</p>',
      [{k:null,label:L('Leave it','سيبه')},{k:'ok',label:L('Rebuild','أعد البناء'),pri:1}]);
    if(q)previewPlan(generatePlan(dkey(),{energy:DB.moods[dkey()]||3}))}
}
setInterval(reminderTick,60000);
setInterval(()=>{if(route==='dashboard'&&!$('#zen')&&!$('.scrim'))render()},60000);

/* =========================================================
   ONBOARDING
   ========================================================= */
async function onboarding(){
  const a=await modal(L('Welcome to ORBIX','أهلًا بك في ORBIX'),
   '<p class="mut" style="margin-top:-4px">'+L('Study smart. Play better. Live balanced.','ذاكر بذكاء. العب براحتك. عيش متوازن.')+'</p>'+
   sel('lang',L('Language','اللغة'),[['ar','العربية'],['en','English']],P.lang)+
   fld('name',L('What should we call you?','نناديك بإيه؟'),'text',P.name)+
   '<div class="grid g2">'+fld('wake',L('Wake time','ميعاد الصحيان'),'time',P.wake)+fld('sleep',L('Sleep time','ميعاد النوم'),'time',P.sleep)+
   fld('studyGoal',L('Study target a day (minutes)','هدف المذاكرة اليومي (دقايق)'),'number',P.studyGoal)+
   fld('gamingGoal',L('Gaming target a day (minutes)','هدف اللعب اليومي (دقايق)'),'number',P.gamingGoal)+'</div>',
   [{k:'skip',label:L('Skip setup','تخطي')},{k:'ok',label:L('Next','التالي'),pri:1}],{collect:collectAll});
  if(a&&a._!=='skip'){
    Object.assign(P,{name:a.name||P.name,wake:a.wake,sleep:a.sleep,studyGoal:+a.studyGoal||240,gamingGoal:+a.gamingGoal||120,lang:a.lang});
    LS.set('sf:profiles',profiles().map(p=>p.id===PID?{id:p.id,name:P.name}:p));applyChrome();shell()}
  const b=await modal(L('Your subjects','موادك'),
   '<p class="sm mut">'+L('Add one to start with — the rest can wait.','ضيف واحدة بس دلوقتي — الباقي يستنى.')+'</p>'+
   fld('s1',L('Subject','المادة'))+'<div class="grid g2">'+fld('p1',L('Total pages','إجمالي الصفحات'),'number','200')+
   fld('e1',L('Exam date','تاريخ الامتحان'),'date')+'</div>',
   [{k:'skip',label:L('Later','بعدين')},{k:'ok',label:L('Add','إضافة'),pri:1}],{collect:collectAll});
  if(b&&b._!=='skip'&&b.s1){
    const s={id:uid(),name:b.s1,pages:+b.p1||0,pagesDone:0,difficulty:3,confidence:3,planDays:b.e1?Math.max(1,daysTo(b.e1)):14};
    DB.subjects.push(s);if(b.e1)DB.exams.push({id:uid(),subjectId:s.id,name:b.s1,date:b.e1})}
  const c=await modal(L('Classes and fixed hours','المحاضرات والمواعيد الثابتة'),
   '<p class="sm mut">'+L('Anything that cannot move: lectures, work, meals.','أي حاجة مش بتتحرك: محاضرات، شغل، أكل.')+'</p>'+
   fld('t',L('Name','الاسم'),'text',L('Lectures','محاضرات'))+
   '<div class="grid g2">'+fld('st',L('Start','من'),'time','09:00')+fld('en',L('End','إلى'),'time','13:00')+'</div>'+
   '<div class="row">'+DAYS_S().map((d,i)=>'<button class="chip" data-dw="'+i+'">'+d+'</button>').join('')+'</div>',
   [{k:'skip',label:L('Later','بعدين')},{k:'ok',label:L('Add','إضافة'),pri:1}],
   {collect:(s,k)=>Object.assign({_:k},grab(s),{days:$$('[data-dw].on',s).map(x=>+x.dataset.dw)})});
  if(c&&c._!=='skip'&&c.t)DB.events.push({id:uid(),title:c.t,type:'class',start:c.st,end:c.en,repeat:'weekly',
    days:(c.days&&c.days.length)?c.days:[0,1,2,3,4]});
  P.onboarded=true;P.tz=-new Date().getTimezoneOffset()/60;save();shell();
  if(DB.subjects.length)previewPlan(generatePlan(dkey(),{energy:3}));else render();
}

/* =========================================================
   DESKTOP BRIDGE + WIDGETS
   ========================================================= */
function renderWidget(kind){
  const k=dkey(),p=planFor(k),now=nowMin();
  const goal=P.vacation?P.vacationMins:P.studyGoal;
  let title,main,sub,c='var(--study)';
  if(kind==='study'){title=L("Today's study",'مذاكرة النهاردة');main=hm(studyMinutes(k));sub=L('of ','من ')+hm(goal)}
  else if(kind==='next'){const b=p&&p.blocks.find(x=>!x.done&&x.end>now);
    title=L('Next','الجاي');main=b?(TYPE[b.type]||TYPE.personal).i+' '+b.title:L('Nothing queued','مفيش حاجة');
    sub=b?m2t(b.start)+' · '+hm(b.end-b.start):L('Open ORBIX to plan','افتح البرنامج واعمل خطة')}
  else if(kind==='exam'){const e=DB.exams.filter(x=>!x.done&&daysTo(x.date)>=0).sort((a,b)=>daysTo(a.date)-daysTo(b.date))[0];
    title=L('Exam countdown','عد تنازلي');main=e?dayN(daysTo(e.date)):'—';sub=e?(e.name||''):L('No exam set','مفيش امتحان');c='var(--warn)'}
  else{const a=gamingAllowance(k),u=gamingMinutes(k);title=L('Gaming left','باقي لعب');main=hm(Math.max(0,a-u));
    sub=hm(u)+L(' used of ',' من ')+hm(a);c='var(--play)'}
  document.body.innerHTML='<div style="-webkit-app-region:drag;height:100%;padding:14px;display:flex;flex-direction:column;justify-content:center;gap:4px">'+
   '<div style="font-size:11px;color:var(--dim)">'+esc(title)+'</div>'+
   '<div style="font-size:26px;font-weight:700;color:'+c+'">'+esc(main)+'</div>'+
   '<div style="font-size:11.5px;color:var(--mut)">'+esc(sub)+'</div></div>';
}
/* =========================================================
   BOOT
   ========================================================= */


/* =========================================================
   ACCOUNTS — local sign-up / login (device-only protection)
   ========================================================= */
function pwStrength(pw){
  let score=0;
  if(pw.length>=6)score++; if(pw.length>=10)score++;
  if(/[A-Z]/.test(pw))score++; if(/[0-9]/.test(pw))score++; if(/[^A-Za-z0-9]/.test(pw))score++;
  const levels=[
   {pct:15,color:'var(--warn)',label:AL('Very weak','ضعيفة جدًا')},
   {pct:35,color:'var(--warn)',label:AL('Weak','ضعيفة')},
   {pct:60,color:'#F0B429',label:AL('Okay','مقبولة')},
   {pct:80,color:'#5BD07E',label:AL('Good','كويسة')},
   {pct:100,color:'#5BD07E',label:AL('Strong','قوية')}
  ];
  return levels[clamp(score,0,4)];
}
/* login attempt lockout — brute-force guard, per username, this device only */
function attemptsKey(u){return 'sf:attempts:'+u.toLowerCase()}
function getAttempts(u){return LS.get(attemptsKey(u),{n:0,until:0})}
function registerFail(u){const a=getAttempts(u);a.n++;if(a.n>=5){a.until=Date.now()+30000;a.n=0}LS.set(attemptsKey(u),a)}
function clearAttempts(u){LS.set(attemptsKey(u),{n:0,until:0})}
function lockedOut(u){const a=getAttempts(u);return a.until>Date.now()?Math.ceil((a.until-Date.now())/1000):0}
/* security log — kept inside each user's own DB, own device only */
function logSecurity(kind,ok,extra){
  if(!DB)return;DB.securityLog=DB.securityLog||[];
  DB.securityLog.unshift({ts:Date.now(),kind,ok,extra:extra||''});
  DB.securityLog=DB.securityLog.slice(0,50);save();
}
function logSecurityFor(userId,kind,ok,extra){
  try{
    const raw=LS.get('sf:p:'+userId,null);if(!raw)return;
    raw.securityLog=raw.securityLog||[];
    raw.securityLog.unshift({ts:Date.now(),kind,ok,extra:extra||''});
    raw.securityLog=raw.securityLog.slice(0,50);
    LS.set('sf:p:'+userId,raw);
  }catch(e){}
}
async function sha256hex(text){
  const enc=new TextEncoder().encode(text);
  const buf=await crypto.subtle.digest('SHA-256',enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function randSalt(){return [...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('')}
const users=()=>LS.get('sf:users',[]);
const saveUsers=u=>LS.set('sf:users',u);
let SESSION=null; // {id, username, name}

function authLang(){ // language for the login screen itself, before a profile is loaded
  return LS.get('sf:authlang','ar');
}
function setAuthLang(l){LS.set('sf:authlang',l)}
function AL(en,ar){return authLang()==='ar'?ar:en}

async function renderAuth(){
  const lang=authLang();
  document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  const u=users();
  const shell=document.createElement('div');
  shell.id='authScreen';
  shell.innerHTML=`
  <style>
   #authScreen{position:fixed;inset:0;background:radial-gradient(circle at 30% 20%, #1c2a4a 0%, #0F1524 60%);
     display:flex;align-items:center;justify-content:center;padding:24px;z-index:200;overflow-y:auto}
   #authCard{width:100%;max-width:380px;background:var(--panel);border:1px solid var(--line);border-radius:20px;
     padding:28px 26px;box-shadow:0 30px 80px rgba(0,0,0,.5)}
   #authCard .logo{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:block;
     background:linear-gradient(135deg, var(--study), var(--play));position:relative;overflow:hidden}
   #authCard h1{text-align:center;font-size:22px;margin-bottom:2px}
   #authCard p.tag{text-align:center;color:var(--mut);font-size:12.5px;margin:0 0 20px}
   #authTabs{display:flex;background:var(--panel2);border-radius:10px;padding:3px;margin-bottom:18px}
   #authTabs button{flex:1;padding:8px;border-radius:8px;font-size:13px;color:var(--mut)}
   #authTabs button.on{background:var(--study);color:#191203;font-weight:700}
   #authForm .f{margin-bottom:12px}
   #authErr{color:var(--warn);font-size:12.5px;min-height:16px;margin-bottom:6px}
   #authLangRow{display:flex;justify-content:center;gap:6px;margin-top:16px}
   #authLangRow button{font-size:11.5px;padding:4px 10px;border-radius:999px;background:var(--panel2);color:var(--mut);border:1px solid var(--line)}
   #authLangRow button.on{background:var(--study);color:#191203;border-color:var(--study)}
   #userPick{display:flex;flex-direction:column;gap:8px;margin-bottom:14px;max-height:180px;overflow-y:auto}
   #userPick button{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;background:var(--panel2);border:1px solid var(--line);text-align:start}
   #userPick button .av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--study),var(--play));flex:none;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#191203}
  </style>
  <div id="authCard">
   <div class="logo"></div>
   <h1>${APP_NAME}</h1>
   <p class="tag">${esc(AL('Study smart. Play better. Live balanced.','ذاكر بذكاء. العب براحتك. عيش متوازن.'))}</p>
   <div id="authTabs">
     <button data-tab="login" class="on">${esc(AL('Sign in','دخول'))}</button>
     <button data-tab="signup">${esc(AL('Create account','حساب جديد'))}</button>
   </div>
   <div id="authBody"></div>
   <div id="authLangRow">
     <button data-al="ar" class="${lang==='ar'?'on':''}">العربية</button>
     <button data-al="en" class="${lang==='en'?'on':''}">English</button>
   </div>
  </div>`;
  document.body.appendChild(shell);
  drawLogoCanvas($('.logo',shell));

  let tab='login';
  const body=$('#authBody',shell);
  function drawLogin(){
    tab='login';
    $$('#authTabs button',shell).forEach(b=>b.classList.toggle('on',b.dataset.tab==='login'));
    body.innerHTML=(u.length?
      '<div id="userPick">'+u.map(x=>'<button data-pick="'+x.id+'"><span class="av">'+esc((x.name||x.username)[0].toUpperCase())+'</span>'+
        '<span>'+esc(x.name||x.username)+' <span class="dim" style="font-size:11px">@'+esc(x.username)+'</span></span></button>').join('')+'</div>'
      :'<p class="sm mut" style="text-align:center;margin-bottom:14px">'+esc(AL('No accounts yet — create one to get started.','مفيش حسابات لسه — اعمل واحد وابدأ.'))+'</p>')+
     (u.length?'<div id="loginForm" class="hide">'+
       '<div id="authErr"></div>'+
       fld('username',AL('Username','اسم المستخدم'))+
       fld('password',AL('Password','كلمة السر'),'password')+
       '<button class="btn pri wide" id="doLogin">'+esc(AL('Sign in','دخول'))+'</button>'+
       '<button class="btn ghost wide sm" id="backPick" style="margin-top:8px">'+esc(AL('← back','← رجوع'))+'</button></div>':'');
    if(!u.length){
      body.innerHTML='<div id="authErr"></div>'+fld('username',AL('Username','اسم المستخدم'))+
       fld('password',AL('Password','كلمة السر'),'password')+
       '<button class="btn pri wide" id="doLogin">'+esc(AL('Sign in','دخول'))+'</button>';
      wireLogin();return;
    }
    $$('[data-pick]',body).forEach(b=>b.onclick=()=>{
      body.innerHTML='<div id="authErr"></div>'+
       '<p class="sm mut" style="margin-bottom:10px">'+esc(AL('Signing in as ','دخول باسم '))+'<b>'+esc((u.find(x=>x.id===b.dataset.pick)||{}).name||'')+'</b></p>'+
       fld('password',AL('Password','كلمة السر'),'password')+
       '<button class="btn pri wide" id="doLogin" data-uid="'+b.dataset.pick+'">'+esc(AL('Sign in','دخول'))+'</button>'+
       '<button class="btn ghost wide sm" id="backPick" style="margin-top:8px">'+esc(AL('← back','← رجوع'))+'</button>';
      wireLogin(b.dataset.pick);
    });
  }
  function wireLogin(uid){
    const go=$('#doLogin',body),back=$('#backPick',body);
    const pw=$('[data-k=password]',body),un=$('[data-k=username]',body);
    if(back)back.onclick=drawLogin;
    if(un)un.focus();else if(pw)pw.focus();
    const submit=async()=>{
      const err=$('#authErr',body);err.textContent='';
      let user=uid?u.find(x=>x.id===uid):u.find(x=>x.username.toLowerCase()===(un.value||'').trim().toLowerCase());
      if(!user){err.textContent=AL('No such account.','الحساب ده مش موجود.');return}
      const wait=lockedOut(user.username);
      if(wait){err.textContent=AL('Too many attempts — try again in ','محاولات كتير — جرّب تاني بعد ')+wait+AL('s.',' ثانية.');return}
      const hash=await sha256hex(user.salt+(pw.value||''));
      if(hash!==user.hash){
        registerFail(user.username);
        logSecurityFor(user.id,'login',false);
        const w2=lockedOut(user.username);
        err.textContent=w2?AL('Too many attempts — locked for 30s.','محاولات كتير — اتقفل ٣٠ ثانية.'):AL('Wrong password.','كلمة السر غلط.');
        return;
      }
      clearAttempts(user.username);
      SESSION={id:user.id,username:user.username,name:user.name,isOwner:!!user.isOwner};
      LS.set('sf:session',SESSION);
      shell.remove();enterApp();
      logSecurity('login',true);
    };
    go.onclick=submit;
    if(pw)pw.onkeydown=e=>{if(e.key==='Enter')submit()};
    if(un)un.onkeydown=e=>{if(e.key==='Enter'){if(pw)pw.focus()}};
  }
  function drawSignup(){
    tab='signup';
    $$('#authTabs button',shell).forEach(b=>b.classList.toggle('on',b.dataset.tab==='signup'));
    body.innerHTML='<div id="authErr"></div>'+
     fld('name',AL('Your name','اسمك'))+
     fld('username',AL('Choose a username','اختار اسم مستخدم'))+
     fld('password',AL('Choose a password (6+ chars)','اختار كلمة سر (٦ حروف فأكتر)'),'password')+
     '<div class="pwmeter"><i id="pwbar" style="width:0%;background:var(--warn)"></i></div><div id="pwlabel" class="xs dim" style="margin-top:3px"></div>'+
     '<div style="margin-top:10px">'+fld('password2',AL('Confirm password','أكد كلمة السر'),'password')+'</div>'+
     '<button class="btn pri wide" id="doSignup">'+esc(AL('Create account','اعمل الحساب'))+'</button>'+
     '<p class="xs dim" style="margin-top:10px;text-align:center">'+esc(AL('Stored only on this device — there is no server.','متخزنة على جهازك بس — مفيش سيرفر.'))+'</p>';
    $('#doSignup',body).onclick=async()=>{
      const err=$('#authErr',body);err.textContent='';
      const name=($('[data-k=name]',body).value||'').trim();
      const uname=($('[data-k=username]',body).value||'').trim();
      const pw1=$('[data-k=password]',body).value||'',pw2=$('[data-k=password2]',body).value||'';
      if(!uname||uname.length<3)return err.textContent=AL('Username must be at least 3 characters.','اسم المستخدم لازم ٣ حروف على الأقل.');
      if(users().some(x=>x.username.toLowerCase()===uname.toLowerCase()))return err.textContent=AL('That username is taken.','اسم المستخدم ده مستخدم بالفعل.');
      if(pw1.length<6)return err.textContent=AL('Password must be at least 6 characters.','كلمة السر لازم ٦ حروف على الأقل.');
      if(pw1!==pw2)return err.textContent=AL('Passwords do not match.','كلمتا السر مش متطابقتين.');
      const salt=randSalt(),hash=await sha256hex(salt+pw1);
      const id=uid();
      const isOwner=users().length===0; // first account on this device is the owner
      const list=users().concat([{id,username:uname,name:name||uname,salt,hash,created:Date.now(),isOwner}]);
      saveUsers(list);
      LS.set('sf:p:'+id,blank(name||uname));
      SESSION={id,username:uname,name:name||uname,isOwner};LS.set('sf:session',SESSION);
      shell.remove();enterApp();
      if(isOwner)setTimeout(()=>toast(AL('You are the first account — you can see device-wide usage summaries in Owner.','أنت أول حساب — تقدر تشوف ملخص استخدام الأجهزة من صفحة المالك.'),6000),1200);
    };
    const pwEl=$('[data-k=password]',body);
    if(pwEl)pwEl.oninput=()=>{
      const sc=pwStrength(pwEl.value);
      const bar=$('#pwbar',body),lab=$('#pwlabel',body);
      if(bar){bar.style.width=(sc.pct)+'%';bar.style.background=sc.color}
      if(lab)lab.textContent=sc.label;
    };
    $('[data-k=name]',body).focus();
  }
  $$('#authTabs button',shell).forEach(b=>b.onclick=()=>b.dataset.tab==='login'?drawLogin():drawSignup());
  $$('#authLangRow button',shell).forEach(b=>b.onclick=()=>{setAuthLang(b.dataset.al);shell.remove();renderAuth()});
  drawLogin();
}
function drawLogoCanvas(el){
  el.style.position='relative';
  el.innerHTML='<svg viewBox="0 0 100 100" style="width:100%;height:100%;display:block">'+
   '<circle cx="50" cy="50" r="20" fill="#F0B429"/>'+
   '<ellipse cx="50" cy="50" rx="36" ry="15" fill="none" stroke="#3ECFB2" stroke-width="3.2" transform="rotate(-18 50 50)"/>'+
   '<circle cx="78" cy="34" r="4.5" fill="#fff"/></svg>';
}
function logout(){
  save();SESSION=null;LS.set('sf:session',null);
  document.getElementById('shell').innerHTML='';document.title=APP_NAME;
  renderAuth();
}
function enterApp(){
  loadProfile(SESSION.id);
  if(!P.name)P.name=SESSION.name;
  shell();render();
  if(!P.onboarded)setTimeout(onboarding,250);
  if(P.prayers&&P.prayerAuto)refreshOnlinePrayerTimes().then(()=>{if(route==='dashboard'||route==='schedule')render()});
  maybeShowChangelog();
  armIdleLock();
}

/* =========================================================
   ENTERTAINMENT: quotes, daily wheel, break mini-game
   ========================================================= */
const QUOTES=[
 ['A little progress each day adds up to big results.','تقدّم بسيط كل يوم بيجمع نتيجة كبيرة.'],
 ['Discipline is choosing what you want most over what you want now.','الانضباط إنك تختار اللي عايزه أكتر مش اللي عايزه دلوقتي.'],
 ['Rest is part of the plan, not a break from it.','الراحة جزء من الخطة، مش هروب منها.'],
 ['You do not need to be perfect, just consistent.','مش لازم تكون مثالي، يكفي تكون مواظب.'],
 ['Every session you finish is proof you can finish the next one.','كل جلسة تخلّصها دليل إنك تقدر تخلّص اللي بعدها.'],
 ['Balance is not 50/50 every day — it is showing up for both over time.','التوازن مش نص نص كل يوم، هو إنك تحضر للاتنين بمرور الوقت.'],
 ['Your focus today is a gift to yourself tomorrow.','تركيزك النهاردة هدية لنفسك بكرة.']
];
function todaysQuote(){const i=new Date().getDate()%QUOTES.length;return L(QUOTES[i][0],QUOTES[i][1])}

/* Spin wheel — cooldown-based (owner-configurable), coin economy, no empty prizes */
const WHEEL=[
 {label:['+10 XP','+١٠ XP'],type:'xp',v:10},
 {label:['+15 min gaming','+١٥ دقيقة لعب'],type:'game',v:15},
 {label:['+25 XP','+٢٥ XP'],type:'xp',v:25},
 {label:['Rest day token','رمز يوم راحة'],type:'freeze',v:1},
 {label:['+8 coins','+٨ عملات'],type:'coins',v:8},
 {label:['+40 XP','+٤٠ XP'],type:'xp',v:40},
 {label:['+5 min gaming','+٥ دقايق لعب'],type:'game',v:5},
 {label:['+20 XP','+٢٠ XP'],type:'xp',v:20}
];
function coins(){return DB.coins||0}
function addCoins(n){DB.coins=(DB.coins||0)+n;save()}
function spinState(){
  const cfg=globalCfg();
  DB.spinLog=DB.spinLog||[]; // timestamps of free spins used, rolling 24h window
  const dayAgo=Date.now()-24*3600*1000;
  DB.spinLog=DB.spinLog.filter(t=>t>dayAgo);
  const usedToday=DB.spinLog.length;
  const last=DB.spinLog.length?Math.max(...DB.spinLog):0;
  const cooldownMs=cfg.spinCooldownHours*3600*1000;
  const readyAt=last?last+cooldownMs:0;
  const onCooldown=Date.now()<readyAt;
  const capped=usedToday>=cfg.dailySpinCap;
  return {canFree:!onCooldown&&!capped, capped, secsLeft:onCooldown?Math.ceil((readyAt-Date.now())/1000):0, usedToday, cap:cfg.dailySpinCap, cost:cfg.spinBuyCost};
}
function canSpinToday(){const st=spinState();return st.canFree||coins()>=st.cost}
async function openWheel(){
  const st=spinState();
  let free=st.canFree;
  if(!free&&coins()<st.cost){
    const msg=st.capped
      ?L('You reached today\'s spin limit (','وصلت لأقصى عدد لفات اليوم (')+st.cap+L(').',').')
      :L('Next free spin in ','اللفة المجانية الجاية بعد ')+Math.ceil(st.secsLeft/3600)+L('h.',' ساعة.');
    return modal(L('No spins left','مفيش لفات فاضلة'),
      '<p class="mut">'+msg+' '+L('Or spend ','أو ادفع ')+st.cost+L(' coins for one now (you have ',' عملة تلف دلوقتي (عندك ')+coins()+L(').',').')+'</p>',
      [BTN.cancel(),{k:'ok',label:L('Not enough coins','مفيش عملات كفاية'),pri:1}]).then(()=>{});
  }
  if(!free){
    const ok=await modal(L('Buy a spin','اشتري لفة'),'<p class="mut">'+L('Spend ','ادفع ')+st.cost+L(' coins on one extra spin?',' عملة على لفة زيادة؟')+'</p>',
      [BTN.cancel(),{k:'ok',label:L('Spend','ادفع'),pri:1}]);
    if(!ok)return;
    if(coins()<st.cost)return toast(L('Not enough coins.','مفيش عملات كفاية.'));
    DB.coins-=st.cost;save();
  }
  const n=WHEEL.length,seg=360/n;
  const target=Math.floor(Math.random()*n);
  const spins=4;const finalDeg=360*spins+ (360 - (target*seg+seg/2));
  const s=document.createElement('div');s.className='scrim';document.body.appendChild(s);
  s.innerHTML='<div class="modal" style="text-align:center"><h2>'+L('Daily spin','لفة اليوم')+'</h2>'+
   '<div style="position:relative;width:220px;height:220px;margin:18px auto">'+
   '<div id="wheelPtr" style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);font-size:22px;z-index:2">▼</div>'+
   '<svg id="wheelSvg" viewBox="0 0 200 200" style="width:100%;height:100%;transition:transform 3.2s cubic-bezier(.17,.67,.32,1.1);transform:rotate(0deg)">'+
   WHEEL.map((w,i)=>{const a0=i*seg-90,a1=(i+1)*seg-90,r=95,cx=100,cy=100;
     const x0=cx+r*Math.cos(a0*Math.PI/180),y0=cy+r*Math.sin(a0*Math.PI/180);
     const x1=cx+r*Math.cos(a1*Math.PI/180),y1=cy+r*Math.sin(a1*Math.PI/180);
     const col=i%2?'#1C2740':'#26314C';
     const mid=(a0+a1)/2*Math.PI/180,tx=cx+62*Math.cos(mid),ty=cy+62*Math.sin(mid);
     return '<path d="M100,100 L'+x0+','+y0+' A95,95 0 0,1 '+x1+','+y1+' Z" fill="'+col+'" stroke="#0F1524" stroke-width="1"/>'+
      '<text x="'+tx+'" y="'+ty+'" fill="#E7ECF7" font-size="8" text-anchor="middle" transform="rotate('+(mid*180/Math.PI+90)+' '+tx+' '+ty+')">'+esc(L(w.label[0],w.label[1]).split(' ').slice(0,2).join(' '))+'</text>'})
   .join('')+'</svg></div>'+
   '<button class="btn pri wide" id="spinGo">'+L('Spin','لف')+'</button>'+
   '<div id="wheelResult" class="sm mut" style="margin-top:10px;min-height:18px"></div></div>';
  $('#spinGo',s).onclick=()=>{
    $('#spinGo',s).disabled=true;
    const svg=$('#wheelSvg',s);svg.style.transform='rotate('+finalDeg+'deg)';
    setTimeout(()=>{
      const w=WHEEL[target];
      if(free){DB.spinLog=DB.spinLog||[];DB.spinLog.push(Date.now())}
      if(w.type==='xp')DB.xp=(DB.xp||0)+w.v;
      if(w.type==='game'){DB.bonusGaming=DB.bonusGaming||{};DB.bonusGaming[dkey()]=(DB.bonusGaming[dkey()]||0)+w.v}
      if(w.type==='freeze')P.freezes=(P.freezes||0)+w.v;
      if(w.type==='coins')addCoins(w.v);
      save();beep(2);
      $('#wheelResult',s).innerHTML='🎉 '+esc(L(w.label[0],w.label[1]));
      setTimeout(()=>{s.remove();render()},1400);
    },3300);
  };
  s.addEventListener('click',e=>{if(e.target===s)return});
}
ACT.openWheel=openWheel;

/* Break mini-game: quick reaction taps, fits inside a short break */
function breakGame(seconds){
  const z=overlay();let left=seconds,score=0,active=false,tId=null,spawnT=null;
  const arenaW=280,arenaH=180;
  const render2=()=>{
    z.innerHTML='<div class="ttl">'+L('Tap the dots','دوس على النقط')+'</div>'+
     '<div class="sm mut">'+L('Score: ','النتيجة: ')+N(score)+' · '+N(left)+'s</div>'+
     '<div id="arena" style="position:relative;width:'+arenaW+'px;height:'+arenaH+'px;background:var(--panel2);border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-top:10px"></div>'+
     '<button class="btn ghost" id="skipGame" style="margin-top:14px">'+L('Skip to break','تخطي للاستراحة')+'</button>';
    $('#skipGame',z).onclick=endGame;
    spawnDot();
  };
  const spawnDot=()=>{
    const arena=$('#arena',z);if(!arena)return;
    arena.innerHTML='';
    const d=document.createElement('div');
    const size=30+Math.random()*14;
    d.style.cssText='position:absolute;width:'+size+'px;height:'+size+'px;border-radius:50%;background:var(--study);cursor:pointer;'+
      'left:'+Math.random()*(arenaW-size)+'px;top:'+Math.random()*(arenaH-size)+'px;transition:transform .1s';
    d.onclick=()=>{score++;d.remove();const s2=$('.sm.mut',z);if(s2)s2.textContent=L('Score: ','النتيجة: ')+score+' · '+left+'s';spawnDot()};
    arena.appendChild(d);
  };
  const endGame=()=>{clearInterval(tId);z.remove();if(score>0){DB.xp=(DB.xp||0)+Math.min(20,score);save()}render()};
  render2();
  tId=setInterval(()=>{left--;const s2=$('.sm.mut',z);if(s2)s2.textContent=L('Score: ','النتيجة: ')+score+' · '+left+'s';
    if(left<=0)endGame()},1000);
}
ACT.breakGame=()=>breakGame(60);



/* =========================================================
   IDLE AUTO-LOCK — re-ask for password after inactivity
   ========================================================= */
let idleTimer=null,locked=false;
function armIdleLock(){
  ['mousemove','keydown','touchstart','click'].forEach(ev=>document.addEventListener(ev,resetIdle,{passive:true}));
  resetIdle();
}
function resetIdle(){
  if(locked||!P||!P.idleLockMin)return;
  clearTimeout(idleTimer);
  idleTimer=setTimeout(showLock,P.idleLockMin*60000);
}
function showLock(){
  if(locked||!SESSION)return;locked=true;
  const z=document.createElement('div');z.id='lockScreen';document.body.appendChild(z);
  z.innerHTML='<div class="modal" style="text-align:center;max-width:340px">'+
   '<div class="avatar lg" style="margin:0 auto 14px">'+esc((P.name||SESSION.username)[0].toUpperCase())+'</div>'+
   '<h2>'+L('Locked','متقفل')+'</h2><p class="sm mut" style="margin:6px 0 16px">'+esc(P.name||SESSION.username)+'</p>'+
   '<div id="lockErr" class="xs" style="color:var(--warn);min-height:16px;margin-bottom:6px"></div>'+
   fld('lp',L('Password','كلمة السر'),'password')+
   '<button class="btn pri wide" id="unlockBtn">'+L('Unlock','افتح')+'</button>'+
   '<button class="btn ghost wide sm" id="lockSignOut" style="margin-top:8px">'+L('Sign out instead','سجّل خروج بدل كده')+'</button></div>';
  const pw=$('[data-k=lp]',z);pw.focus();
  const submit=async()=>{
    const u=users().find(x=>x.id===SESSION.id);
    const hash=await sha256hex(u.salt+(pw.value||''));
    if(hash===u.hash){locked=false;z.remove();resetIdle()}
    else{$('#lockErr',z).textContent=L('Wrong password.','كلمة السر غلط.');pw.value='';pw.focus()}
  };
  $('#unlockBtn',z).onclick=submit;
  pw.onkeydown=e=>{if(e.key==='Enter')submit()};
  $('#lockSignOut',z).onclick=()=>{locked=false;z.remove();logout()};
}
/* =========================================================
   CHANGELOG — shown once per version bump
   ========================================================= */
function maybeShowChangelog(){
  const seen=DB.seenVersion;
  if(seen===APP_VERSION)return;
  DB.seenVersion=APP_VERSION;save();
  if(!seen)return; // first run for this account — no need to announce "what's new"
  modal(L("What's new in ","الجديد في ")+'v'+APP_VERSION,
   '<div class="list">'+CHANGELOG.map(c=>'<div class="card" style="background:var(--panel2)"><b>v'+c[0]+'</b>'+
     '<p class="sm mut" style="margin:6px 0 0">'+esc(L(c[1][0],c[1][1]))+'</p></div>').join('')+'</div>',
   [BTN.close()],{wide:true});
}



/* =========================================================
   TWO MORE MINI-GAMES
   ========================================================= */
function memoryGame(){
  const icons=['🍎','🍋','🍇','🍓','🍒','🥝','🍑','🍉'];
  const deck=icons.concat(icons).map((ic,i)=>({ic,id:i})).sort(()=>Math.random()-.5);
  let flipped=[],matched=[],moves=0,busy=false;
  const z=overlay();
  const draw=()=>{
    z.innerHTML='<div class="ttl">'+L('Memory match','لعبة الذاكرة')+'</div>'+
     '<div class="sm mut">'+L('Moves: ','محاولات: ')+N(moves)+' · '+L('Matched: ','اتوصّل: ')+N(matched.length/2)+'/'+N(icons.length)+'</div>'+
     '<div style="display:grid;grid-template-columns:repeat(4,56px);gap:8px;margin-top:14px" id="mgGrid">'+
     deck.map((c,i)=>{const show=flipped.includes(i)||matched.includes(i);
       return '<button data-i="'+i+'" style="width:56px;height:56px;border-radius:10px;font-size:24px;background:'+(show?'var(--study)':'var(--panel2)')+';border:1px solid var(--line)">'+(show?c.ic:'')+'</button>'}).join('')+
     '</div><button class="btn ghost" id="mgQuit" style="margin-top:14px">'+L('Quit','خروج')+'</button>';
    $('#mgQuit',z).onclick=()=>{z.remove();render()};
    $$('#mgGrid button',z).forEach(b=>b.onclick=()=>{
      const i=+b.dataset.i;
      if(busy||flipped.includes(i)||matched.includes(i))return;
      flipped.push(i);draw();
      if(flipped.length===2){
        moves++;busy=true;
        const[a,b2]=flipped;
        if(deck[a].ic===deck[b2].ic){matched.push(a,b2);flipped=[];busy=false;draw();
          if(matched.length===deck.length){DB.xp+=15;addCoins(2);save();
            setTimeout(()=>modal(L('Nice!','برافو!'),'<p class="mut">'+L('Solved in ','خلصتها في ')+moves+L(' moves.',' محاولة.')+' +15 XP · +2 🪙</p>',[BTN.close()]).then(()=>{z.remove();render()}),300)}
        } else setTimeout(()=>{flipped=[];busy=false;draw()},700);
      }
    });
  };
  draw();
}
ACT.memoryGame=()=>memoryGame();

function mathSprint(seconds){
  let left=seconds,score=0,cur=null;
  const z=overlay();
  const nextQ=()=>{
    const a=1+Math.floor(Math.random()*12),b=1+Math.floor(Math.random()*12);
    const op=['+','-','×'][Math.floor(Math.random()*3)];
    const ans=op==='+'?a+b:op==='-'?a-b:a*b;
    const opts=new Set([ans]);
    while(opts.size<4)opts.add(ans+Math.floor(Math.random()*9)-4);
    cur={a,b,op,ans,opts:[...opts].sort(()=>Math.random()-.5)};
  };
  const draw=()=>{
    if(!cur)nextQ();
    z.innerHTML='<div class="ttl">'+L('Quick math','رياضة سريعة')+'</div>'+
     '<div class="sm mut">'+L('Score: ','النتيجة: ')+N(score)+' · '+N(left)+'s</div>'+
     '<div style="font-size:36px;margin:16px 0;direction:ltr">'+cur.a+' '+cur.op+' '+cur.b+' = ?</div>'+
     '<div class="grid g2" style="max-width:280px;margin:0 auto">'+cur.opts.map(o=>'<button class="btn" data-o="'+o+'" style="font-size:18px;padding:14px">'+o+'</button>').join('')+'</div>'+
     '<button class="btn ghost" id="msQuit" style="margin-top:14px">'+L('Quit','خروج')+'</button>';
    $('#msQuit',z).onclick=end;
    $$('[data-o]',z).forEach(b=>b.onclick=()=>{if(+b.dataset.o===cur.ans)score++;cur=null;draw()});
  };
  const end=()=>{clearInterval(tId);z.remove();if(score>0){DB.xp+=Math.min(25,score*2);addCoins(Math.min(5,Math.floor(score/2)));save()}render()};
  let tId=setInterval(()=>{left--;if(left<=0)return end();
    const s2=$('.sm.mut',z);if(s2)s2.textContent=L('Score: ','النتيجة: ')+score+' · '+left+'s'},1000);
  draw();
}
ACT.mathSprint=()=>mathSprint(45);



/* =========================================================
   OPTIONAL AI CHAT — user supplies their own API key.
   Runs entirely client-side; the key never leaves this device.
   Honest note: some providers block direct browser calls (CORS);
   if that happens here we say so plainly instead of pretending it worked.
   ========================================================= */
ACT.setAiKey=async()=>{
  const r=await modal(L('Connect AI','وصّل الذكاء الاصطناعي'),
   '<p class="sm mut">'+L('Paste an Anthropic API key (from console.anthropic.com). It is stored only in this browser.','الصق مفتاح Anthropic API (من console.anthropic.com). بيتخزن في المتصفح ده بس.')+'</p>'+
   fld('key',L('API key','مفتاح الـAPI'),'password',P.aiKey||''),
   [BTN.cancel(),{k:'ok',label:L('Save','حفظ'),pri:1},{k:'del',label:L('Remove key','امسح المفتاح')}],{collect:collectAll});
  if(r==='del'){P.aiKey='';save();toast(L('Removed','اتمسح'));render();return}
  if(!r||!r.key)return;
  P.aiKey=r.key.trim();save();toast(L('Saved — try Open chat.','اتحفظ — جرّب افتح المحادثة.'));render();
};
async function askAI(messages){
  const res=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':P.aiKey,'anthropic-version':'2023-06-01',
      'anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:600,
      system:AL('You are a friendly, concise study assistant inside a student planner app called ORBIX. Answer briefly and practically.',
                'انت مساعد مذاكرة ودود ومختصر جوه تطبيق تنظيم دراسي اسمه ORBIX. جاوب بإيجاز وبشكل عملي.'),
      messages})
  });
  if(!res.ok){const t=await res.text().catch(()=>'');throw new Error('HTTP '+res.status+' '+t.slice(0,150))}
  const data=await res.json();
  return (data.content||[]).map(c=>c.text||'').join('\\n').trim();
}
ACT.openAiChat=()=>{
  if(!P.aiKey)return ACT.setAiKey();
  DB.aiChat=DB.aiChat||[];
  const s=document.createElement('div');s.className='scrim';document.body.appendChild(s);
  const draw=()=>{
    s.innerHTML='<div class="modal wide"><div class="between"><h2>💬 '+L('Ask AI','اسأل الذكاء الاصطناعي')+'</h2>'+
      '<button class="btn sm ghost" id="aiClose">✕</button></div>'+
      '<div id="aiLog" style="max-height:42vh;overflow-y:auto;margin:12px 0;display:flex;flex-direction:column;gap:8px">'+
      (DB.aiChat.length?DB.aiChat.map(m=>'<div style="align-self:'+(m.role==='user'?'flex-end':'flex-start')+';max-width:82%;background:'+
        (m.role==='user'?'var(--study)':'var(--panel2)')+';color:'+(m.role==='user'?'#191203':'var(--ink)')+';padding:9px 12px;border-radius:12px;font-size:13.5px;white-space:pre-wrap">'+esc(m.content)+'</div>').join('')
       :'<p class="sm dim">'+L('Ask about a topic, request a study plan explanation, or get help understanding something.','اسأل عن موضوع، أو اطلب شرح خطة المذاكرة، أو مساعدة في فهم حاجة.')+'</p>')+'</div>'+
      '<div class="row"><input type="text" id="aiIn" placeholder="'+L('Type your question…','اكتب سؤالك…')+'" style="flex:1"><button class="btn pri" id="aiSend">'+L('Send','ابعت')+'</button></div>'+
      '<p class="xs dim" style="margin-top:8px">'+L('If this fails, the provider may be blocking direct browser access — that is a limitation of this offline app, not a bug you caused.','لو فشلت، يمكن الشركة بتمنع الاتصال المباشر من المتصفح — دي حدود التطبيق الأوفلاين مش خطأ منك.')+'</p></div>';
    $('#aiClose',s).onclick=()=>s.remove();
    const log=$('#aiLog',s);log.scrollTop=log.scrollHeight;
    const send=async()=>{
      const inp=$('#aiIn',s);const txt=(inp.value||'').trim();if(!txt)return;
      DB.aiChat.push({role:'user',content:txt});save();draw();
      const btn=$('#aiSend',s);btn.disabled=true;btn.textContent=L('Thinking…','بيفكر…');
      try{
        const reply=await askAI(DB.aiChat.slice(-10).map(m=>({role:m.role,content:m.content})));
        DB.aiChat.push({role:'assistant',content:reply||L('(no reply)','(مفيش رد)')});save();
      }catch(e){
        DB.aiChat.push({role:'assistant',content:L('Could not reach the AI provider: ','مقدرتش أوصل لمزوّد الذكاء الاصطناعي: ')+e.message});save();
      }
      draw();
    };
    $('#aiSend',s).onclick=send;
    $('#aiIn',s).onkeydown=e=>{if(e.key==='Enter')send()};
    $('#aiIn',s).focus();
  };
  draw();
};



/* =========================================================
   ONLINE: update checker (pings the hosted version.json)
   ========================================================= */
async function checkForUpdate(){
  if(!navigator.onLine)return;
  try{
    const url=new URL('version.json',location.href).toString();
    const res=await fetch(url,{cache:'no-store'});
    if(!res.ok)return;
    const j=await res.json();
    if(j&&j.version&&j.version!==APP_VERSION&&isNewer(j.version,APP_VERSION)){
      toast('⬆️ '+L('A newer version (','نسخة أحدث (')+j.version+L(') is live — refresh the page to get it.',') متاحة — حدّث الصفحة عشان تاخدها.'),6000);
    }
  }catch(e){/* silent — this is a best-effort convenience check */}
}
function isNewer(a,b){
  const pa=a.split('.').map(Number),pb=b.split('.').map(Number);
  for(let i=0;i<3;i++){if((pa[i]||0)>(pb[i]||0))return true;if((pa[i]||0)<(pb[i]||0))return false}
  return false;
}

/* =========================================================
   SHARE: progress card — generates an image, uses Web Share
   API when available (online-capable share sheet), otherwise
   downloads a PNG.
   ========================================================= */
function drawShareCard(){
  const c=document.createElement('canvas');c.width=900;c.height=560;
  const ctx=c.getContext('2d');
  const grd=ctx.createLinearGradient(0,0,900,560);grd.addColorStop(0,'#0F1524');grd.addColorStop(1,'#1c2a4a');
  ctx.fillStyle=grd;ctx.fillRect(0,0,900,560);
  // logo mark
  ctx.beginPath();ctx.arc(90,90,34,0,7);ctx.fillStyle='#F0B429';ctx.fill();
  ctx.strokeStyle='#3ECFB2';ctx.lineWidth=6;ctx.save();ctx.translate(90,90);ctx.rotate(-.3);
  ctx.beginPath();ctx.ellipse(0,0,62,26,0,0,7);ctx.stroke();ctx.restore();
  ctx.fillStyle='#E7ECF7';ctx.font='700 34px sans-serif';ctx.fillText(APP_NAME,140,80);
  ctx.fillStyle='#8C99B8';ctx.font='16px sans-serif';ctx.fillText(AR()?'ذاكر بذكاء. العب براحتك. عيش متوازن.':'Study smart. Play better. Live balanced.',140,108);
  ctx.fillStyle='#E7ECF7';ctx.font='700 30px sans-serif';
  ctx.fillText((P.name||SESSION.username),60,190);
  const k=dkey(),stats=[
    [L('Streak','السلسلة'),streak()+' 🔥'],
    [L('Total study','إجمالي المذاكرة'),hm(studyTotal())],
    [L('Achievements','الإنجازات'),(DB.badges||[]).length+' 🏆'],
    [L('Level','المستوى'),Math.floor((DB.xp||0)/500)+1]
  ];
  stats.forEach((s,i)=>{
    const x=60+(i%2)*420,y=250+Math.floor(i/2)*150;
    ctx.fillStyle='#1C2740';ctx.fillRect(x,y,380,120);
    ctx.fillStyle='#8C99B8';ctx.font='15px sans-serif';ctx.fillText(s[0],x+20,y+34);
    ctx.fillStyle='#F0B429';ctx.font='700 40px sans-serif';ctx.fillText(String(s[1]),x+20,y+82);
  });
  return c;
}
ACT.shareProgress=async()=>{
  const c=drawShareCard();
  c.toBlob(async blob=>{
    const file=new File([blob],'orbix-progress.png',{type:'image/png'});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      try{await navigator.share({files:[file],title:APP_NAME,text:L('My ORBIX progress','تقدّمي في ORBIX')});return}catch(e){}
    }
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='orbix-progress.png';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
    toast(L('Saved as an image','اتحفظت كصورة'));
  },'image/png');
};

/* =========================================================
   POMODORO PRESETS — quick-select session/break combos
   ========================================================= */
const POMO_PRESETS=[
 {n:'25/5',s:25,bs:5,bl:15},
 {n:'50/10',s:50,bs:10,bl:20},
 {n:'90/20',s:90,bs:20,bl:30}
];
ACT.applyPomo=d=>{const p=POMO_PRESETS[+d.i];P.sessionLen=p.s;P.breakShort=p.bs;P.breakLong=p.bl;refresh();
  toast(L('Applied ','اتطبق ')+p.n)};

/* =========================================================
   STREAK CALENDAR — small month grid for the stats page
   ========================================================= */
function streakCalendarHTML(){
  const now=new Date();const y=now.getFullYear(),m=now.getMonth();
  const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate();
  const lead=first.getDay();
  let cells='';
  for(let i=0;i<lead;i++)cells+='<div></div>';
  for(let d=1;d<=days;d++){
    const k=y+'-'+pad(m+1)+'-'+pad(d);
    const has=DB.sessions.some(s=>s.date===k&&(s.type==='study'||s.type==='revision'));
    const isToday=k===dkey();
    cells+='<div style="background:'+(has?'var(--study)':'var(--panel2)')+';color:'+(has?'#191203':'var(--dim)')+
      (isToday?';box-shadow:0 0 0 2px var(--play)':'')+'">'+d+'</div>';
  }
  return '<div class="mini-cal">'+cells+'</div>';
}

(function boot(){
  const w=new URLSearchParams(location.search).get('widget');
  if(w){
    const sess=LS.get('sf:session',null);
    if(sess){loadProfile(sess.id);renderWidget(w);setInterval(()=>renderWidget(w),30000)}
    return;
  }
  const sess=LS.get('sf:session',null);
  const known=sess&&users().some(u=>u.id===sess.id);
  if(known){SESSION=sess;enterApp();}
  else{renderAuth();}
  if(window.ORBIXDesktop)window.ORBIXDesktop.onCommand(c=>{
    if(!SESSION)return;
    if(c==='study')startFocus();else if(c==='gaming')startGaming();
    else if(c==='focus')go('focus');else if(c==='schedule')go('schedule');else if(c==='whatnow')ACT.whatnow()});
  window.addEventListener('beforeunload',()=>{if(SESSION)save()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&SESSION)save()});
  setInterval(()=>{
    if(!SESSION)return;
    if(Date.now()-(P.lastBackup||0)>14*864e5&&DB.sessions.length>20)
      toast(L('It has been a while since your last backup — Settings > Data.','بقى فترة من آخر نسخة احتياطية — الإعدادات < البيانات.'),5000);
  },1000*60*30);
})();
