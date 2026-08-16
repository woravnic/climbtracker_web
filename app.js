const app=document.querySelector('#app'), title=document.querySelector('#pageTitle'), action=document.querySelector('#pageAction'), modal=document.querySelector('#modal'), csvInput=document.querySelector('#csvInput');
const STORE='climbtracker.pwa.v1';
const GOOGLE_CLIENT_ID='1069011973327-6dkngvo8od1aoold8msd9kvu4la4soi4.apps.googleusercontent.com';
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const DRIVE_BACKUP_NAME='Climbtracker_Backup.csv';
let googleTokenClient=null,googleRestoreTokenClient=null;
const defaults={climbs:[],logs:[],gyms:[],calorieGoal:0};
let state=load(),tab='log',logType='Boulder',statsType='Boulder',statsGrade=null,statsGym=null,statsIncline=null,statsHold=null,statsMove=null,calorieEntryDate=dayStart(),bodyChartRange=7;
const inclines=['Slab','Vertical','Overhang','Roof','Chimney'];
const holds=['Jug','Crimp','Sloper','Pinch','Pocket','Volume','Crack','Arete'];
const moves=['Cross','Gaston','Campus','Throw','Lockoff','Heel Hook','Toe Hook','Drop Knee','High Foot','Kneebar','Bat-Hang','Dyno','Paddle','Step-Up','Lache','Coordo','Press','Mantle','Balance','Fist Jam','Hand Jam'];
const boulder=Array.from({length:18},(_,i)=>String(i));
const sport=[];for(let n=5;n<=9;n++) sport.push(String(n));for(let n=10;n<=15;n++) for(const l of ['a','b','c','d']) sport.push(`${n}${l}`);
function load(){try{return {...defaults,...JSON.parse(localStorage.getItem(STORE)||'{}')}}catch{return structuredClone(defaults)}}
function save(){localStorage.setItem(STORE,JSON.stringify(state));render()}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function uid(){return Date.now()*1000+Math.floor(Math.random()*1000)}
function dayStart(d=new Date()){return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()}
function ymd(ts){return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}
function displayGrade(c){return c.type==='Boulder'?`V${c.grade}`:`5.${c.grade}`}
function gradeScore(g){const n=parseInt(String(g).match(/\d+/)?.[0]||0),last=String(g).slice(-1);return n*10+({a:1,b:2,c:3,d:4}[last]||0)}
function getHardest(arr){return arr.length?[...arr].sort((a,b)=>gradeScore(b.grade)-gradeScore(a.grade))[0]:null}
function closeModal(){modal.close();modal.innerHTML=''}
function openModal(name,body,onReady){modal.innerHTML=`<div class="modal-head"><h3>${esc(name)}</h3><button class="icon-btn" style="position:static" onclick="closeModal()">×</button></div><div class="modal-body">${body}</div>`;modal.showModal();onReady?.()}
function setTab(next){tab=next;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));render()}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
const MAIN_TABS=['log','projects','stats','body'];
let swipeStart=null,tabAnimating=false,swipeSurface=null;
function swipeBlockedTarget(target){return !!target.closest('dialog,input,select,textarea,button,a,.grade-wheel,.attempt-stepper,.swipe-delete-row,.chart-point-group')}
function getSwipeSurface(){return app.querySelector(':scope > .stack')||app.firstElementChild}
function clearSurfaceMotion(surface=swipeSurface){if(surface){surface.style.transition='';surface.style.transform='';surface.style.willChange='';surface.style.pointerEvents=''}swipeSurface=null}
function springSurfaceHome(surface){if(!surface)return;surface.style.transition='transform 180ms cubic-bezier(.22,.8,.32,1)';surface.style.transform='translate3d(0,0,0)';setTimeout(()=>clearSurfaceMotion(surface),190)}
function slideToTab(next,direction,surface){if(tabAnimating||!surface)return;tabAnimating=true;surface.style.pointerEvents='none';surface.style.transition='transform 170ms cubic-bezier(.4,0,.8,.6)';surface.style.transform=`translate3d(${direction<0?'-105vw':'105vw'},0,0)`;setTimeout(()=>{clearSurfaceMotion(surface);setTab(next);const incoming=getSwipeSurface();if(!incoming){tabAnimating=false;return}incoming.style.transition='none';incoming.style.willChange='transform';incoming.style.transform=`translate3d(${direction<0?'105vw':'-105vw'},0,0)`;requestAnimationFrame(()=>requestAnimationFrame(()=>{incoming.style.transition='transform 210ms cubic-bezier(.18,.82,.24,1)';incoming.style.transform='translate3d(0,0,0)';setTimeout(()=>{clearSurfaceMotion(incoming);tabAnimating=false},220)}))},175)}
document.addEventListener('pointerdown',e=>{if(tabAnimating||e.pointerType!=='touch'||modal.open||swipeBlockedTarget(e.target))return;if(e.clientX<20||e.clientX>window.innerWidth-20)return;const surface=getSwipeSurface();if(!surface)return;swipeSurface=surface;swipeStart={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),mode:null,surface}},{passive:true});
document.addEventListener('pointermove',e=>{if(!swipeStart||e.pointerId!==swipeStart.id)return;const s=swipeStart,dx=e.clientX-s.x,dy=e.clientY-s.y;if(!s.mode&&Math.max(Math.abs(dx),Math.abs(dy))>6)s.mode=Math.abs(dx)>Math.abs(dy)*1.1?'horizontal':'vertical';if(s.mode==='vertical'){clearSurfaceMotion(s.surface);swipeStart=null;return}if(s.mode!=='horizontal')return;e.preventDefault();const i=MAIN_TABS.indexOf(tab),blocked=(dx>0&&i===0)||(dx<0&&i===MAIN_TABS.length-1),drag=blocked?dx*.22:dx;s.surface.style.transition='none';s.surface.style.willChange='transform';s.surface.style.transform=`translate3d(${drag}px,0,0)`},{passive:false});
document.addEventListener('pointerup',e=>{if(!swipeStart||e.pointerId!==swipeStart.id)return;const s=swipeStart;swipeStart=null;if(s.mode!=='horizontal'){clearSurfaceMotion(s.surface);return}const dx=e.clientX-s.x,dt=Math.max(1,performance.now()-s.time),velocity=Math.abs(dx)/dt,i=MAIN_TABS.indexOf(tab),direction=dx<0?-1:1,nextIndex=i+(direction<0?1:-1),canMove=nextIndex>=0&&nextIndex<MAIN_TABS.length,commit=canMove&&(Math.abs(dx)>window.innerWidth*.14||velocity>.45);if(commit)slideToTab(MAIN_TABS[nextIndex],direction,s.surface);else springSurfaceHome(s.surface)},{passive:true});
document.addEventListener('pointercancel',e=>{if(!swipeStart||e.pointerId!==swipeStart.id)return;const s=swipeStart;swipeStart=null;springSurfaceHome(s.surface)},{passive:true});

function makeStatBarChart(items, options = {}) {
  if (!items || !items.length) return '<div class="chart-empty">No data yet</div>';

  const max = Math.max(...items.map(x => x.value), 1);
  return `
    <div class="stat-bar-chart" role="img" aria-label="${esc(options.ariaLabel || 'Bar chart')}">
      ${items.map(item => `
        <div class="stat-bar-row">
          <div class="stat-bar-label">${esc(item.label)}</div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill" style="width:${Math.max(4, (item.value / max) * 100)}%"></div>
          </div>
          <div class="stat-bar-value">${item.value}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function pieColor(index) {
  const colors = [
    '#f59e0b', '#fb923c', '#facc15', '#84cc16',
    '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
    '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
    '#f43f5e', '#a3a3a3'
  ];
  return colors[index % colors.length];
}

function makeStatPieChart(items, options = {}) {
  if (!items || !items.length) return '<div class="chart-empty">No data yet</div>';

  const total = items.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const stops = items.map((item, i) => {
    const start = (acc / total) * 100;
    acc += item.value;
    const end = (acc / total) * 100;
    return `${pieColor(i)} ${start}% ${end}%`;
  }).join(', ');

  return `
    <div class="stat-pie-layout">
      <div class="stat-pie" style="background:conic-gradient(${stops})" role="img" aria-label="${esc(options.ariaLabel || 'Pie chart')}">
        <div class="stat-pie-hole">
          <strong>${total}</strong>
          <span>${esc(options.centerLabel || 'Total')}</span>
        </div>
      </div>
      <div class="stat-pie-legend">
        ${items.map((item, i) => `
          <div class="stat-pie-legend-row">
            <span class="stat-pie-dot" style="background:${pieColor(i)}"></span>
            <span class="stat-pie-name">${esc(item.label)}</span>
            <span class="stat-pie-count">${item.value}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function countSingleField(climbs, field) {
  const map = new Map();
  climbs.forEach(c => {
    const v = (c[field] || '').trim();
    if (!v) return;
    map.set(v, (map.get(v) || 0) + 1);
  });
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a,b) => b.value - a.value || a.label.localeCompare(b.label));
}

function countMultiField(climbs, field) {
  const map = new Map();
  climbs.forEach(c => {
    let vals = c[field];
    if (!vals) return;
    if (!Array.isArray(vals)) {
      vals = String(vals).split(/[|,;]/).map(s => s.trim()).filter(Boolean);
    }
    vals.forEach(v => map.set(v, (map.get(v) || 0) + 1));
  });
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a,b) => b.value - a.value || a.label.localeCompare(b.label));
}


function render(){action.classList.add('hidden');action.onclick=null;if(tab==='log'){title.textContent='Climb Tracker';renderLog()}if(tab==='projects'){title.textContent='Active Projects';renderProjects()}if(tab==='stats'){title.textContent='Climbing Stats';action.classList.remove('hidden');action.onclick=showDataMenu;renderStats()}if(tab==='body'){title.textContent='Body';action.classList.remove('hidden');action.onclick=showBodySettings;renderBody();requestAnimationFrame(bindBodyChartPoints)}}
function sessionGroups(type=logType){const completed=state.climbs.filter(c=>!c.isProject&&c.type===type).sort((a,b)=>b.date-a.date),map=new Map();completed.forEach(c=>{const d=dayStart(new Date(c.date)),gym=(c.gym||'No Gym').trim()||'No Gym',k=`${d}|||${gym.toLowerCase()}`;if(!map.has(k))map.set(k,{date:d,gym,climbs:[]});map.get(k).climbs.push(c)});return [...map.values()].sort((a,b)=>b.date-a.date||a.gym.localeCompare(b.gym))}
function logSummaryBanner(){const completed=state.climbs.filter(c=>!c.isProject&&c.type===logType),hard=getHardest(completed),today=dayStart(),todayClimbs=completed.filter(c=>dayStart(new Date(c.date))===today),todayHard=getHardest(todayClimbs);return `<div class="log-summary card"><div class="log-summary-title">${logType} Summary</div><div class="log-summary-grid"><div><small>Total Climbs</small><strong>${completed.length}</strong></div><div><small>Hardest Grade</small><strong class="accent">${hard?displayGrade(hard):'—'}</strong></div></div>${todayClimbs.length?`<div class="log-today"><div class="log-today-label">Today</div><div><strong>${todayClimbs.length}</strong><small> climb${todayClimbs.length===1?'':'s'}</small></div><div><small>Hardest </small><strong class="accent">${todayHard?displayGrade(todayHard):'—'}</strong></div></div>`:''}</div>`}
function renderLog(){const groups=sessionGroups();app.innerHTML=`<div class="stack"><div class="segmented log-type-tabs"><button onclick="logType='Boulder';renderLog()" class="${logType==='Boulder'?'active':''}">Boulder</button><button onclick="logType='Sport';renderLog()" class="${logType==='Sport'?'active':''}">Sport</button></div>${logSummaryBanner()}${groups.length?groups.map(sessionCard).join(''):`<div class="empty">No ${logType.toLowerCase()} climbs yet. Tap + to log your first climb.</div>`}</div><button class="fab" onclick="showClimbForm(null,false,'${logType}')">+</button>`;setupClimbSwipeDelete()}
function sessionCard(session){const {date,gym,climbs:cs}=session,hard=getHardest(cs);return `<details class="card session-card"><summary class="session-summary"><div><strong>${esc(gym)}</strong><div class="muted">${ymd(date)} · ${cs.length} climb${cs.length===1?'':'s'}</div></div><div class="session-summary-right"><div><small class="muted">Hardest</small><div class="accent">${hard?displayGrade(hard):'—'}</div></div><span class="session-chevron">⌄</span></div></summary><div class="session-climbs">${cs.map(c=>climbRow(c)).join('')}</div></details>`}
function climbRow(c){return `<div class="swipe-delete-row" data-climb-id="${c.id}"><button class="swipe-delete-action" type="button" aria-label="Delete ${displayGrade(c)} climb">Delete</button><div class="climb-row clickable swipe-delete-content"><div class="row"><div class="grade">${displayGrade(c)}</div><div style="flex:1"><strong>${esc(c.gym||c.type)}</strong><div class="muted">${c.incline?esc(c.incline)+' · ':''}${c.isFlash?'<span class="flash">Flash! ✨</span>':`${c.attempts} attempt${c.attempts===1?'':'s'}`}</div></div><span>›</span></div></div></div>`}
function setupClimbSwipeDelete(){let openRow=null;const closeRow=(row,animate=true)=>{if(!row)return;const content=row.querySelector('.swipe-delete-content');content.style.transition=animate?'transform 180ms cubic-bezier(.22,.8,.32,1)':'none';content.style.transform='translate3d(0,0,0)';row.classList.remove('delete-open');if(openRow===row)openRow=null};document.querySelectorAll('.swipe-delete-row').forEach(row=>{const content=row.querySelector('.swipe-delete-content'),del=row.querySelector('.swipe-delete-action');let start=null;content.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;if(openRow&&openRow!==row)closeRow(openRow);start={id:e.pointerId,x:e.clientX,y:e.clientY,base:row.classList.contains('delete-open')?-86:0,mode:null};content.style.transition='none';try{content.setPointerCapture(e.pointerId)}catch(_){}});content.addEventListener('pointermove',e=>{if(!start||e.pointerId!==start.id)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(!start.mode&&Math.max(Math.abs(dx),Math.abs(dy))>8)start.mode=Math.abs(dx)>Math.abs(dy)*1.15?'horizontal':'vertical';if(start.mode==='vertical'){content.style.transition='';start=null;return}if(start.mode!=='horizontal')return;e.preventDefault();const x=Math.max(-100,Math.min(0,start.base+dx));content.style.transform=`translate3d(${x}px,0,0)`});const finish=e=>{if(!start||e.pointerId!==start.id)return;const dx=e.clientX-start.x,dy=e.clientY-start.y,mode=start.mode,wasOpen=start.base<0;start=null;if(mode==='horizontal'){const shouldOpen=wasOpen?dx<34:dx<-42;content.style.transition='transform 180ms cubic-bezier(.22,.8,.32,1)';content.style.transform=shouldOpen?'translate3d(-86px,0,0)':'translate3d(0,0,0)';row.classList.toggle('delete-open',shouldOpen);openRow=shouldOpen?row:null;return}content.style.transition='';const tapDistance=Math.hypot(dx,dy);if(tapDistance>8)return;if(wasOpen){closeRow(row);return}showClimbForm(Number(row.dataset.climbId))};content.addEventListener('pointerup',finish);content.addEventListener('pointercancel',e=>{if(start&&e.pointerId===start.id){start=null;closeRow(row)}});del.addEventListener('pointerdown',e=>{e.stopPropagation();const id=Number(row.dataset.climbId);state.climbs=state.climbs.filter(c=>c.id!==id);save()})});document.addEventListener('pointerdown',e=>{if(openRow&&!e.target.closest('.swipe-delete-row'))closeRow(openRow)},{once:true})}
function gradeLabel(type,grade){return type==='Boulder'?`V${grade}`:`5.${grade}`}
function rememberedGrade(type){const key=`climbtracker.lastGrade.${type}`;const saved=localStorage.getItem(key),grades=type==='Boulder'?boulder:sport;if(saved&&grades.includes(saved))return saved;const recent=[...state.climbs].filter(c=>c.type===type).sort((a,b)=>b.date-a.date)[0];return recent&&grades.includes(recent.grade)?recent.grade:grades[0]}
function rememberGrade(type,grade){localStorage.setItem(`climbtracker.lastGrade.${type}`,grade)}
function gradeWheelMarkup(type,selected){const grades=type==='Boulder'?boulder:sport;return `<div class="grade-wheel-wrap"><div class="grade-wheel-selection" aria-hidden="true"></div><div id="gradeWheel" class="grade-wheel" role="listbox" aria-label="Grade">${grades.map(g=>`<button type="button" class="grade-wheel-item" data-grade="${g}" role="option" aria-selected="${g===selected?'true':'false'}">${gradeLabel(type,g)}</button>`).join('')}</div></div><input id="grade" type="hidden" value="${selected}">`}
function setupGradeWheel(type,selected){const wheel=document.querySelector('#gradeWheel'),input=document.querySelector('#grade');if(!wheel||!input)return;const items=[...wheel.querySelectorAll('.grade-wheel-item')],itemHeight=48;let ticking=false;function select(index,scroll=false){index=Math.max(0,Math.min(items.length-1,index));const item=items[index];input.value=item.dataset.grade;items.forEach((el,i)=>{const on=i===index;el.classList.toggle('selected',on);el.setAttribute('aria-selected',on?'true':'false')});if(scroll)wheel.scrollTo({top:index*itemHeight,behavior:'smooth'})}const initial=Math.max(0,items.findIndex(x=>x.dataset.grade===selected));requestAnimationFrame(()=>{wheel.scrollTop=initial*itemHeight;select(initial)});wheel.addEventListener('scroll',()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{select(Math.round(wheel.scrollTop/itemHeight));ticking=false})},{passive:true});items.forEach((item,index)=>item.onclick=()=>select(index,true))}
function todayDefaultGym(){const start=dayStart(new Date()),end=start+86400000;return state.climbs.filter(x=>x.date>=start&&x.date<end&&x.gym).sort((a,b)=>b.date-a.date)[0]?.gym||''}
function showClimbForm(id=null,forceProject=false,preferredType=null){const c=id?state.climbs.find(x=>x.id===id):null;const type=c?.type||preferredType||'Boulder';const selectedGrade=c?.grade||rememberedGrade(type);const defaultGym=c?.gym||todayDefaultGym();const savedGyms=[...new Set(state.gyms.filter(Boolean))].sort((a,b)=>a.localeCompare(b));const gymIsSaved=defaultGym&&savedGyms.some(g=>g.toLowerCase()===defaultGym.toLowerCase());openModal(c?'Edit Climb':forceProject?'Add Project':'Log Climb',`<form id="climbForm" class="form-grid"><div class="segmented"><button type="button" data-type="Boulder" class="${type==='Boulder'?'active':''}">Boulder</button><button type="button" data-type="Sport" class="${type==='Sport'?'active':''}">Sport</button></div><div><label>Grade</label><div id="gradePicker">${gradeWheelMarkup(type,selectedGrade)}</div></div><div><label>Attempts</label><div class="attempt-stepper"><button type="button" id="attemptMinus" aria-label="Decrease attempts">−</button><output id="attempts">${c?.attempts||1}</output><button type="button" id="attemptPlus" aria-label="Increase attempts">+</button></div></div><label>Gym<select id="gymSelect"><option value="">Select gym</option>${savedGyms.map(g=>`<option value="${esc(g)}" ${gymIsSaved&&g.toLowerCase()===defaultGym.toLowerCase()?'selected':''}>${esc(g)}</option>`).join('')}<option value="__new__" ${defaultGym&&!gymIsSaved?'selected':''}>Add new gym…</option></select></label><label id="newGymWrap" class="${defaultGym&&!gymIsSaved?'':'hidden'}">New Gym<input id="newGym" value="${defaultGym&&!gymIsSaved?esc(defaultGym):''}" autocomplete="off"></label><div><label>Incline</label><div id="inclines" class="chips">${inclines.map(x=>`<button type="button" class="chip incline-chip ${c?.incline===x?'on':''}" data-incline="${esc(x)}">${esc(x)}</button>`).join('')}</div><input id="incline" type="hidden" value="${esc(c?.incline||'')}"></div><div><label>Hold Types</label><div id="holds" class="chips">${chipSet(holds,c?.holdTypes)}</div></div><div><label>Key Moves</label><div id="moves" class="chips">${chipSet(moves,c?.keyMoves)}</div></div>${forceProject?'':`<label class="checkbox-row"><input id="project" type="checkbox" ${c?.isProject?'checked':''}> Mark as Project</label>`}<label>Description / Notes<textarea id="description">${esc(c?.description||'')}</textarea></label><div class="modal-actions climb-form-actions">${c?'<button type="button" id="deleteClimb" class="btn danger">Delete</button>':''}<button type="button" class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn">Save</button></div></form>`,()=>{
 const form=document.querySelector('#climbForm');let currentType=type,attemptCount=Math.max(1,c?.attempts||1);const attemptOut=document.querySelector('#attempts');const setAttempts=n=>{attemptCount=Math.max(1,n);attemptOut.textContent=attemptCount};const bindAttemptButton=(button,delta)=>{let holdTimer=null,repeatTimer=null,held=false;const stop=()=>{held=false;clearTimeout(holdTimer);clearInterval(repeatTimer);holdTimer=repeatTimer=null};button.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();held=true;setAttempts(attemptCount+delta);try{button.setPointerCapture(e.pointerId)}catch(_){};holdTimer=setTimeout(()=>{if(!held)return;repeatTimer=setInterval(()=>setAttempts(attemptCount+delta),120)},350)});button.addEventListener('pointerup',stop);button.addEventListener('pointercancel',stop);button.addEventListener('lostpointercapture',stop);button.addEventListener('contextmenu',e=>e.preventDefault());button.addEventListener('dblclick',e=>e.preventDefault())};bindAttemptButton(document.querySelector('#attemptMinus'),-1);bindAttemptButton(document.querySelector('#attemptPlus'),1);const gymSelect=document.querySelector('#gymSelect'),newGymWrap=document.querySelector('#newGymWrap'),newGym=document.querySelector('#newGym');gymSelect.onchange=()=>{const adding=gymSelect.value==='__new__';newGymWrap.classList.toggle('hidden',!adding);if(adding)setTimeout(()=>newGym.focus(),0)};setupGradeWheel(currentType,selectedGrade);form.querySelectorAll('[data-type]').forEach(btn=>btn.onclick=()=>{currentType=btn.dataset.type;form.querySelectorAll('[data-type]').forEach(x=>x.classList.toggle('active',x===btn));const picked=c&&c.type===currentType?c.grade:rememberedGrade(currentType);document.querySelector('#gradePicker').innerHTML=gradeWheelMarkup(currentType,picked);setupGradeWheel(currentType,picked)});const inclineInput=document.querySelector('#incline');form.querySelectorAll('.incline-chip').forEach(ch=>ch.onclick=()=>{inclineInput.value=ch.dataset.incline;form.querySelectorAll('.incline-chip').forEach(x=>x.classList.toggle('on',x===ch))});form.querySelectorAll('#holds .chip,#moves .chip').forEach(ch=>ch.onclick=()=>ch.classList.toggle('on'));form.onsubmit=e=>{e.preventDefault();const gym=(gymSelect.value==='__new__'?newGym.value:gymSelect.value).trim()||null;const val={id:c?.id||uid(),grade:document.querySelector('#grade').value,type:currentType,date:c?.date||Date.now(),gym,incline:document.querySelector('#incline').value||null,holdTypes:selectedChips('#holds'),keyMoves:selectedChips('#moves'),description:document.querySelector('#description').value.trim()||null,attempts:attemptCount,isProject:forceProject?true:document.querySelector('#project')?.checked||false};val.isFlash=val.attempts===1&&!val.isProject;rememberGrade(val.type,val.grade);if(c)state.climbs=state.climbs.map(x=>x.id===c.id?val:x);else state.climbs.push(val);if(val.gym&&!state.gyms.some(g=>g.toLowerCase()===val.gym.toLowerCase()))state.gyms.push(val.gym);closeModal();save()};if(c)document.querySelector('#deleteClimb').onclick=()=>{if(confirm('Delete this climb?')){state.climbs=state.climbs.filter(x=>x.id!==c.id);closeModal();save()}}})}
function chipSet(options,current){const cur=(current||'').split(',').map(x=>x.trim());return options.map(x=>`<button type="button" class="chip ${cur.includes(x)?'on':''}" data-value="${esc(x)}">${esc(x)}</button>`).join('')}
function selectedChips(sel){const xs=[...document.querySelector(sel).querySelectorAll('.chip.on')].map(x=>x.dataset.value);return xs.length?xs.join(','):null}
function projectGroups(){const projects=state.climbs.filter(c=>c.isProject).sort((a,b)=>b.date-a.date),map=new Map();projects.forEach(c=>{const gym=(c.gym||'No Gym').trim()||'No Gym',key=gym.toLowerCase();if(!map.has(key))map.set(key,{gym,climbs:[]});map.get(key).climbs.push(c)});return [...map.values()].sort((a,b)=>a.gym.localeCompare(b.gym))}
function renderProjects(){const groups=projectGroups();app.innerHTML=`<div class="stack">${groups.length?groups.map(projectGymCard).join(''):`<div class="empty">No active projects.</div>`}</div><button class="fab" onclick="showClimbForm(null,true)">+</button>`}
function projectGymCard(group){const {gym,climbs:items}=group,hard=getHardest(items);return `<details class="card session-card project-gym-card"><summary class="session-summary"><div><strong>${esc(gym)}</strong><div class="muted">${items.length} active project${items.length===1?'':'s'}</div></div><div class="session-summary-right"><div><small class="muted">Hardest</small><div class="accent">${hard?displayGrade(hard):'—'}</div></div><span class="session-chevron">⌄</span></div></summary><div class="project-gym-climbs">${items.map(projectCard).join('')}</div></details>`}
function projectCard(c){return `<div class="card project-card clickable" role="button" tabindex="0" aria-label="Edit ${displayGrade(c)} project" onclick="if(!event.target.closest('button'))showClimbForm(${c.id})" onkeydown="if((event.key==='Enter'||event.key===' ')&&!event.target.closest('button')){event.preventDefault();showClimbForm(${c.id})}"><div class="row between"><div><div class="grade">${displayGrade(c)}</div><div class="muted">${esc(c.incline||c.type)}</div></div><strong>${c.attempts} attempts</strong></div>${c.description?`<div>${esc(c.description)}</div>`:''}<div class="toolbar"><button class="btn secondary" onclick="projectAttempt(${c.id})">+1 Attempt</button><button class="btn" onclick="sendProject(${c.id})">Sent ✓</button></div></div>`}
function projectAttempt(id){const c=state.climbs.find(x=>x.id===id);c.attempts++;save()}
function sendProject(id){const c=state.climbs.find(x=>x.id===id);c.attempts++;c.isProject=false;c.isFlash=false;c.date=Date.now();save()}
function filteredStats(){return state.climbs.filter(c=>{
  if(c.isProject||c.type!==statsType)return false;
  if(statsGrade&&c.grade!==statsGrade)return false;
  if(statsGym&&(c.gym||'')!==statsGym)return false;
  if(statsIncline&&(c.incline||'')!==statsIncline)return false;
  const holds=(c.holdTypes||'').split(',').map(x=>x.trim()).filter(Boolean);
  const moves=(c.keyMoves||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(statsHold&&!holds.includes(statsHold))return false;
  if(statsMove&&!moves.includes(statsMove))return false;
  return true;
})}
function __original_renderStats(){const all=state.climbs.filter(c=>!c.isProject&&c.type===statsType),grades=[...new Set(all.map(c=>c.grade))].sort((a,b)=>gradeScore(a)-gradeScore(b)),cs=filteredStats(),sessions=new Set(cs.map(c=>dayStart(new Date(c.date)))),hard=getHardest(cs),flashes=Object.entries(cs.filter(c=>c.isFlash).reduce((m,c)=>((m[c.grade]=(m[c.grade]||0)+1),m),{})).filter(([,n])=>n>=5).map(([g])=>g).sort((a,b)=>gradeScore(b)-gradeScore(a))[0];const counts=cs.reduce((m,c)=>((m[c.grade]=(m[c.grade]||0)+1),m),{}),max=Math.max(1,...Object.values(counts));app.innerHTML=`<div class="stack"><div class="segmented"><button onclick="statsType='Boulder';statsGrade=null;renderStats()" class="${statsType==='Boulder'?'active':''}">Boulder</button><button onclick="statsType='Sport';statsGrade=null;renderStats()" class="${statsType==='Sport'?'active':''}">Sport</button></div>${grades.length?`<div class="chips"><button class="chip ${statsGrade===null?'on':''}" onclick="statsGrade=null;renderStats()"></button>${grades.map(g=>`<button class="chip ${statsGrade===g?'on':''}" onclick="statsGrade='${g}';renderStats()">${statsType==='Boulder'?'V':'5.'}${g}</button>`).join('')}</div>`:''}<div class="metric-grid"><div class="metric"><small>Total</small><strong>${cs.length}</strong></div><div class="metric"><small>Avg. Climbs / Session</small><strong>${sessions.size?(cs.length/sessions.size).toFixed(1):'—'}</strong></div><div class="metric"><small>Hardest</small><strong>${hard?displayGrade(hard):'—'}</strong></div><div class="metric"><small>Flash Grade</small><strong>${flashes?(statsType==='Boulder'?'V':'5.')+flashes:'—'}</strong></div><div class="metric"><small>Avg. Attempts</small><strong>${cs.length?(cs.reduce((n,c)=>n+c.attempts,0)/cs.length).toFixed(1):'—'}</strong></div><div class="metric"><small>Flash Rate</small><strong>${cs.length?Math.round(cs.filter(c=>c.isFlash).length/cs.length*100)+'%':'—'}</strong></div></div><div class="card"><h3>Grade Distribution</h3><div class="bar-wrap" style="margin-top:14px">${Object.keys(counts).sort((a,b)=>gradeScore(a)-gradeScore(b)).map(g=>`<div class="bar-row"><span>${statsType==='Boulder'?'V':'5.'}${g}</span><div class="bar"><i style="width:${counts[g]/max*100}%"></i></div><b>${counts[g]}</b></div>`).join('')||'<div class="empty">No data</div>'}</div></div></div>`}


function toggleStatsFilter(key,value){
  const map={grade:'statsGrade',gym:'statsGym',incline:'statsIncline',hold:'statsHold',move:'statsMove'};
  const current={grade:statsGrade,gym:statsGym,incline:statsIncline,hold:statsHold,move:statsMove}[key];
  const next=current===value?null:value;
  if(key==='grade')statsGrade=next;
  else if(key==='gym')statsGym=next;
  else if(key==='incline')statsIncline=next;
  else if(key==='hold')statsHold=next;
  else if(key==='move')statsMove=next;
  renderStats();
}
function statsFilterChip(label,value,current,key){
  const on=current===value;
  return `<button type="button" class="chip stats-filter-chip ${on?'on':''}" data-filter-key="${esc(key)}" onclick='toggleStatsFilter(${JSON.stringify(key)},${JSON.stringify(value)})'>${esc(label)}</button>`;
}
function statsValues(climbs,field,multi=false){
  const s=new Set();climbs.forEach(c=>{if(multi){String(c[field]||'').split(',').map(x=>x.trim()).filter(Boolean).forEach(x=>s.add(x))}else{const v=String(c[field]||'').trim();if(v)s.add(v)}});return [...s].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}
function makeVerticalGradeChart(items){
  if(!items||!items.length)return '<div class="chart-empty">No data yet</div>';
  const max=Math.max(1,...items.map(x=>x.value));
  return `<div class="vertical-grade-chart" role="img" aria-label="Grade distribution"><div class="vertical-grade-bars">${items.map(item=>`<div class="vertical-grade-col"><div class="vertical-grade-value">${item.value}</div><div class="vertical-grade-track"><div class="vertical-grade-fill" style="height:${Math.max(5,item.value/max*100)}%"></div></div><div class="vertical-grade-label">${esc(item.label)}</div></div>`).join('')}</div></div>`;
}
function renderStats(){
  const base=state.climbs.filter(c=>!c.isProject&&c.type===statsType);
  const grades=[...new Set(base.map(c=>c.grade).filter(Boolean))].sort((a,b)=>gradeScore(a)-gradeScore(b));
  const gyms=statsValues(base,'gym'),incs=statsValues(base,'incline'),holds=statsValues(base,'holdTypes',true),moves=statsValues(base,'keyMoves',true);
  const cs=filteredStats(),sessions=new Set(cs.map(c=>dayStart(new Date(c.date)))),hard=getHardest(cs);
  const flashes=Object.entries(cs.filter(c=>c.isFlash).reduce((m,c)=>((m[c.grade]=(m[c.grade]||0)+1),m),{})).filter(([,n])=>n>=5).map(([g])=>g).sort((a,b)=>gradeScore(b)-gradeScore(a))[0];
  const counts=cs.reduce((m,c)=>((m[c.grade]=(m[c.grade]||0)+1),m),{});
  const gradeItems=Object.keys(counts).sort((a,b)=>gradeScore(a)-gradeScore(b)).map(g=>({label:(statsType==='Boulder'?'V':'5.')+g,value:counts[g]}));
  const inclineItems=countSingleField(cs,'incline'),holdItems=countMultiField(cs,'holdTypes'),moveItems=countMultiField(cs,'keyMoves');
  const filterGroup=(title,values,current,key,format=x=>x)=>values.length?`<div class="stats-filter-group"><div class="stats-filter-label">${esc(title)}</div><div class="stats-filter-chips">${values.map(v=>statsFilterChip(format(v),v,current,key)).join('')}</div></div>`:'';
  app.innerHTML=`<div class="stack stats-page"><div class="segmented"><button onclick="statsType='Boulder';statsGrade=statsGym=statsIncline=statsHold=statsMove=null;renderStats()" class="${statsType==='Boulder'?'active':''}">Boulder</button><button onclick="statsType='Sport';statsGrade=statsGym=statsIncline=statsHold=statsMove=null;renderStats()" class="${statsType==='Sport'?'active':''}">Sport</button></div>
  <div class="card stats-filter-panel"><div class="row between stats-filter-header"><h3>Filters</h3><button class="btn secondary stats-clear-btn" onclick="statsGrade=statsGym=statsIncline=statsHold=statsMove=null;renderStats()">Clear</button></div>
    ${filterGroup('Grade',grades,statsGrade,'grade',g=>(statsType==='Boulder'?'V':'5.')+g)}
    ${filterGroup('Gym',gyms,statsGym,'gym')}
    ${filterGroup('Incline',incs,statsIncline,'incline')}
    ${filterGroup('Hold Type',holds,statsHold,'hold')}
    ${filterGroup('Key Move',moves,statsMove,'move')}
  </div>
  <div class="metric-grid"><div class="metric"><small>Total</small><strong>${cs.length}</strong></div><div class="metric"><small>Avg. Climbs / Session</small><strong>${sessions.size?(cs.length/sessions.size).toFixed(1):'—'}</strong></div><div class="metric"><small>Hardest</small><strong>${hard?displayGrade(hard):'—'}</strong></div><div class="metric"><small>Flash Grade</small><strong>${flashes?(statsType==='Boulder'?'V':'5.')+flashes:'—'}</strong></div><div class="metric"><small>Avg. Attempts</small><strong>${cs.length?(cs.reduce((n,c)=>n+c.attempts,0)/cs.length).toFixed(1):'—'}</strong></div><div class="metric"><small>Flash Rate</small><strong>${cs.length?Math.round(cs.filter(c=>c.isFlash).length/cs.length*100)+'%':'—'}</strong></div></div>
  <div class="stats-chart-card"><div class="stats-chart-title">Grade Distribution</div>${makeVerticalGradeChart(gradeItems)}</div>
  <div class="stats-chart-card"><div class="stats-chart-title">Inclines</div>${makeStatPieChart(inclineItems,{ariaLabel:'Incline distribution',centerLabel:'Climbs'})}</div>
  <div class="stats-chart-card"><div class="stats-chart-title">Hold Types</div>${makeStatPieChart(holdItems,{ariaLabel:'Hold type distribution',centerLabel:'Uses'})}</div>
  <div class="stats-chart-card"><div class="stats-chart-title">Key Moves</div>${makeStatPieChart(moveItems,{ariaLabel:'Key move distribution',centerLabel:'Uses'})}</div></div>`;
}

function todayLog(){return state.logs.find(l=>l.date===dayStart())}
function upsertLog(date,patch){let l=state.logs.find(x=>x.date===date);if(!l){l={id:uid(),date,calories:null,weight:null,calorieHistory:null};state.logs.push(l)}Object.assign(l,patch)}
function dateInputValue(ts){const d=new Date(ts),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
function dateInputToDay(value){const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(+m[1],+m[2]-1,+m[3]).getTime():dayStart()}
function selectedCalorieLog(){return state.logs.find(l=>dayStart(new Date(l.date))===calorieEntryDate)}
function setBodyChartRange(days){bodyChartRange=days;renderBody()}

function installPersistentChartTooltipDismissal(container, hideTooltip) {
  if (!container) return;
  if (container._tooltipDismissHandler) {
    document.removeEventListener('pointerdown', container._tooltipDismissHandler, true);
  }
  const handler = (e) => {
    if (!container.contains(e.target)) hideTooltip();
  };
  container._tooltipDismissHandler = handler;
  document.addEventListener('pointerdown', handler, true);
}

function bodyScatterPlot(field,unit){
  const days=bodyChartRange,end=dayStart(),start=end-(days-1)*86400000;
  const points=state.logs.filter(l=>{const d=dayStart(new Date(l.date)),v=l[field];return d>=start&&d<=end&&v!=null&&Number.isFinite(Number(v))}).map(l=>({date:dayStart(new Date(l.date)),value:Number(l[field])})).sort((a,b)=>a.date-b.date);
  if(!points.length)return `<div class="chart-empty">No ${field==='calories'?'calorie':'weight'} data in this period.</div>`;
  const W=360,H=210,pad={l:48,r:14,t:14,b:34},plotW=W-pad.l-pad.r,plotH=H-pad.t-pad.b; let min=Math.min(...points.map(p=>p.value)),max=Math.max(...points.map(p=>p.value));
  if(min===max){const bump=field==='weight'?2:Math.max(100,min*.08);min-=bump;max+=bump}else{const margin=(max-min)*.12;min-=margin;max+=margin} if(field==='calories')min=Math.max(0,min);
  const x=d=>pad.l+((d-start)/Math.max(1,end-start))*plotW,y=v=>pad.t+(1-(v-min)/Math.max(1,max-min))*plotH;
  const grid=[];for(let i=0;i<4;i++){const yy=pad.t+i*(plotH/3),val=max-i*((max-min)/3);grid.push(`<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W-pad.r}" y2="${yy.toFixed(1)}" class="chart-grid"/><text x="${pad.l-7}" y="${(yy+4).toFixed(1)}" text-anchor="end" class="chart-axis-label">${field==='weight'?val.toFixed(1):Math.round(val)}</text>`)}
  const labelCount=days===7?4:5,xLabels=[];for(let i=0;i<labelCount;i++){const d=start+i*((end-start)/(labelCount-1)),xx=x(d),dt=new Date(d);xLabels.push(`<text x="${xx.toFixed(1)}" y="${H-10}" text-anchor="middle" class="chart-axis-label">${dt.toLocaleDateString(undefined,{month:'numeric',day:'numeric'})}</text>`)}
  const line=points.length>1?`<polyline points="${points.map(p=>`${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}" class="chart-series-line"/>`:'';
  const dots=points.map((p,i)=>{const cx=x(p.date).toFixed(1),cy=y(p.value).toFixed(1);return `<g class="chart-point-group" data-date="${p.date}" data-value="${p.value}" data-field="${field}" data-unit="${unit}"><circle cx="${cx}" cy="${cy}" r="19" class="chart-point-hit"/><circle cx="${cx}" cy="${cy}" r="6" class="chart-point"/></g>`}).join('');
  return `<div class="interactive-chart"><svg class="scatter-chart" viewBox="0 0 ${W} ${H}" role="img">${grid.join('')}<line x1="${pad.l}" y1="${pad.t+plotH}" x2="${W-pad.r}" y2="${pad.t+plotH}" class="chart-axis"/>${xLabels.join('')}${line}${dots}</svg><div class="chart-tooltip" hidden></div></div>`;
}
function hideBodyChartTooltips(){
  document.querySelectorAll('.interactive-chart .chart-tooltip').forEach(t=>t.hidden=true);
  document.querySelectorAll('.interactive-chart .chart-point.active').forEach(x=>x.classList.remove('active'));
}
function showBodyChartPoint(group){
  const wrap=group.closest('.interactive-chart'),tip=wrap?.querySelector('.chart-tooltip');
  if(!wrap||!tip)return;
  hideBodyChartTooltips();
  group.querySelector('.chart-point')?.classList.add('active');
  const date=ymd(Number(group.dataset.date)),value=Number(group.dataset.value),field=group.dataset.field,unit=group.dataset.unit;
  tip.innerHTML=`<strong>${esc(date)}</strong><span>${field==='weight'?value.toFixed(1):Math.round(value)} ${esc(unit)}</span>`;
  tip.hidden=false;
  const point=group.querySelector('.chart-point'),pr=point.getBoundingClientRect(),wr=wrap.getBoundingClientRect();
  requestAnimationFrame(()=>{
    const tr=tip.getBoundingClientRect();
    let left=pr.left-wr.left+pr.width/2-tr.width/2;
    left=Math.max(6,Math.min(wrap.clientWidth-tr.width-6,left));
    tip.style.left=`${left}px`;
    tip.style.top=`${Math.max(4,pr.top-wr.top-tr.height-8)}px`;
  });
}
function bindBodyChartPoints(){
  document.querySelectorAll('.chart-point-group').forEach(group=>{
    group.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      e.preventDefault();
      e.stopPropagation();
      showBodyChartPoint(group);
    });
    group.addEventListener('touchstart',e=>{
      e.stopPropagation();
      showBodyChartPoint(group);
    },{passive:true});
  });
}

function renderBody(){const t=todayLog(),selected=selectedCalorieLog(),hist=(selected?.calorieHistory||'').split(',').filter(Boolean),past=[...state.logs].filter(l=>l.date<dayStart()).sort((a,b)=>b.date-a.date),weights=past.map(l=>l.weight).filter(x=>x!=null).slice(0,7),cals=past.map(l=>l.calories).filter(x=>x!=null).slice(0,7),aw=weights.length?weights.reduce((a,b)=>a+b,0)/weights.length:null,ac=cals.length?cals.reduce((a,b)=>a+b,0)/cals.length:null,goal=state.calorieGoal||0,isToday=calorieEntryDate===dayStart(),selectedLabel=isToday?'Today':ymd(calorieEntryDate);app.innerHTML=`<div class="stack"><div class="card"><div class="row between"><h3 class="accent">Today's Total: ${t?.calories||0} Cals</h3>${goal?`<span class="muted">Goal ${goal}</span>`:''}</div>${goal?`<div class="progress" style="margin-top:10px"><i style="width:${Math.min(100,(t?.calories||0)/goal*100)}%"></i></div>`:''}<div class="muted" style="margin-top:14px">Adding calories to <strong>${esc(selectedLabel)}</strong></div><div class="row" style="margin-top:10px"><input id="calInput" type="number" min="0" inputmode="numeric" placeholder="Add Calories"><button class="btn" onclick="addCalories()">Add</button></div><div class="muted" style="margin-top:8px">${esc(selectedLabel)} total: ${selected?.calories||0} Cals</div>${hist.length?`<div style="margin-top:12px">${hist.map((x,i)=>`<div class="cal-history row between"><span>Entry ${i+1}: ${x} Calories</span><button class="btn secondary" onclick="deleteCal(${i})">Delete</button></div>`).join('')}</div>`:''}</div><div class="card">${t?.weight!=null?`<div class="row between"><div><small class="muted">Today's Weight</small><div class="big">${t.weight} lbs</div></div><button class="btn secondary" onclick="showWeightForm()">Edit</button></div>`:`<div class="row"><input id="weightInput" type="number" step="0.1" inputmode="decimal" placeholder="Today's Weight (lbs)"><button class="btn" onclick="saveWeight()">Save</button></div>`}</div><div class="metric-grid"><div class="metric"><small>7-Day Avg Weight</small><strong>${aw!=null?aw.toFixed(1)+' lbs':'—'}</strong></div><div class="metric"><small>7-Day Avg Cals</small><strong>${ac!=null?Math.round(ac):'—'}</strong></div></div><div class="card body-chart-panel"><div class="row between chart-toolbar"><h3>History</h3><div class="segmented chart-range"><button onclick="setBodyChartRange(7)" class="${bodyChartRange===7?'active':''}">7 Days</button><button onclick="setBodyChartRange(30)" class="${bodyChartRange===30?'active':''}">1 Month</button></div></div><div class="body-chart-block"><div class="row between"><strong>Calories</strong><span class="muted">cal/day</span></div>${bodyScatterPlot('calories','cal')}</div><div class="body-chart-block"><div class="row between"><strong>Weight</strong><span class="muted">lbs</span></div>${bodyScatterPlot('weight','lb')}</div></div><div class="card"><h3>Recent Logs</h3>${state.logs.length?[...state.logs].sort((a,b)=>b.date-a.date).slice(0,10).map(l=>{const d=dayStart(new Date(l.date)),active=d===calorieEntryDate;return `<button type="button" class="climb-row row between body-log-row${active?' selected':''}" onclick="selectCalorieLog(${d})"><span>${ymd(l.date)}</span><span class="muted">${l.calories??'—'} cal · ${l.weight??'—'} lb</span></button>`}).join(''):'<div class="empty">No logs yet.</div>'}</div></div>`}
function selectCalorieLog(date){calorieEntryDate=dayStart(new Date(date));renderBody()}
function addCalories(){const n=parseInt(document.querySelector('#calInput').value);if(!Number.isFinite(n))return;const d=calorieEntryDate,l=state.logs.find(x=>dayStart(new Date(x.date))===d),arr=(l?.calorieHistory||'').split(',').filter(Boolean);arr.push(String(n));upsertLog(d,{calories:(l?.calories||0)+n,calorieHistory:arr.join(',')});save()}
function deleteCal(i){const l=selectedCalorieLog();if(!l)return;const arr=(l.calorieHistory||'').split(',').filter(Boolean),n=parseInt(arr[i])||0;arr.splice(i,1);l.calories=Math.max(0,(l.calories||0)-n);l.calorieHistory=arr.length?arr.join(','):null;save()}
function saveWeight(){const n=parseFloat(document.querySelector('#weightInput').value);if(!Number.isFinite(n))return;upsertLog(dayStart(),{weight:n});save()}
function showWeightForm(){const l=todayLog();openModal('Update Weight',`<form id="weightForm" class="form-grid"><label>Weight (lbs)<input id="modalWeight" type="number" step="0.1" value="${l?.weight||''}"></label><div class="modal-actions"><button type="button" class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn">Save</button></div></form>`,()=>document.querySelector('#weightForm').onsubmit=e=>{e.preventDefault();const n=parseFloat(document.querySelector('#modalWeight').value);if(Number.isFinite(n)){upsertLog(dayStart(),{weight:n});closeModal();save()}})}
function showBodySettings(){openModal('Body Settings',`<form id="bodySettings" class="form-grid"><label>Daily Calorie Goal<input id="goal" type="number" min="0" value="${state.calorieGoal||''}"></label><div class="modal-actions"><button type="button" class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn">Save</button></div></form>`,()=>document.querySelector('#bodySettings').onsubmit=e=>{e.preventDefault();state.calorieGoal=parseInt(document.querySelector('#goal').value)||0;closeModal();save()})}
function showDataMenu(){const last=localStorage.getItem('climbtracker.drive.lastBackup');openModal('Data',`<div class="stack"><button class="btn" onclick="backupToGoogleDrive()">Back Up to Google Drive</button><button class="btn secondary" onclick="restoreFromGoogleDrive()">Restore From Google Drive</button>${last?`<div class="muted">Last Drive backup: ${esc(new Date(last).toLocaleString())}</div>`:''}<button class="btn secondary" onclick="exportCsv()">Download CSV Backup</button><button class="btn secondary" onclick="document.querySelector('#csvInput').click();closeModal()">Import CSV Backup</button></div>`) }
function csvEscape(v){v=v==null?'':String(v);return /[,"\n]/.test(v)?`"${v.replaceAll('"','""')}"`:v}
function formatCsvDate(ts){const d=new Date(ts),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`}
function buildCsv(){let s='[CLIMBS]\ngrade,type,date,gym,incline,holdTypes,keyMoves,description,attempts,isFlash,isProject\n';state.climbs.forEach(c=>s+=[c.grade,c.type,formatCsvDate(c.date),c.gym,c.incline,c.holdTypes,c.keyMoves,c.description,c.attempts,c.isFlash,c.isProject].map(csvEscape).join(',')+'\n');if(state.logs.length){s+='\n[LOGS]\ndate,calories,weight,calorieHistory\n';state.logs.forEach(l=>s+=[formatCsvDate(l.date),l.calories,l.weight,l.calorieHistory].map(csvEscape).join(',')+'\n')}return s}
function exportCsv(){const blob=new Blob([buildCsv()],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='climbing_data.csv';a.click();URL.revokeObjectURL(a.href);closeModal()}
function loadGoogleIdentity(){return new Promise((resolve,reject)=>{if(window.google?.accounts?.oauth2)return resolve();const existing=document.querySelector('script[data-google-identity]');if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error('Could not load Google sign-in.')),{once:true});return}const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.dataset.googleIdentity='true';script.onload=resolve;script.onerror=()=>reject(new Error('Could not load Google sign-in.'));document.head.appendChild(script)})}
async function backupToGoogleDrive(){if(GOOGLE_CLIENT_ID.startsWith('PASTE_')){alert('Google Drive backup is not configured yet. Add your Google OAuth Client ID to app.js first.');return}try{await loadGoogleIdentity()}catch(e){alert(e.message);return}if(!googleTokenClient){googleTokenClient=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:DRIVE_SCOPE,callback:async response=>{if(response.error){alert(`Google authorization failed: ${response.error}`);return}try{await uploadDriveBackup(response.access_token)}catch(e){console.error(e);alert(`Drive backup failed: ${e.message}`)}}})}googleTokenClient.requestAccessToken({prompt:''})}
async function driveFetch(url,token,options={}){const headers=new Headers(options.headers||{});headers.set('Authorization',`Bearer ${token}`);const response=await fetch(url,{...options,headers});if(!response.ok){let detail='';try{detail=(await response.json()).error?.message||''}catch{}throw new Error(detail||`Google Drive returned ${response.status}`)}return response}
async function findDriveBackup(token){const q=encodeURIComponent(`name='${DRIVE_BACKUP_NAME.replaceAll("'","\\'")}' and trashed=false`);const fields=encodeURIComponent('files(id,name,modifiedTime)');const response=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&orderBy=modifiedTime%20desc&pageSize=10&fields=${fields}`,token);const data=await response.json();return data.files?.[0]||null}
async function uploadDriveBackup(token){const csv=buildCsv();let file=await findDriveBackup(token);if(file){const response=await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(file.id)}?uploadType=media&fields=id,name,modifiedTime`,token,{method:'PATCH',headers:{'Content-Type':'text/csv;charset=utf-8'},body:csv});file=await response.json()}else{const boundary='climbtracker_'+Math.random().toString(36).slice(2);const metadata=JSON.stringify({name:DRIVE_BACKUP_NAME,mimeType:'text/csv'});const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: text/csv; charset=UTF-8\r\n\r\n${csv}\r\n--${boundary}--`;const response=await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime',token,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});file=await response.json()}localStorage.setItem('climbtracker.drive.lastBackup',new Date().toISOString());closeModal();alert(`Backup complete: ${file.name||DRIVE_BACKUP_NAME}`)}
async function restoreFromGoogleDrive(){if(GOOGLE_CLIENT_ID.startsWith('PASTE_')){alert('Google Drive backup is not configured yet. Add your Google OAuth Client ID to app.js first.');return}try{await loadGoogleIdentity()}catch(e){alert(e.message);return}if(!googleRestoreTokenClient){googleRestoreTokenClient=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:DRIVE_SCOPE,callback:async response=>{if(response.error){alert(`Google authorization failed: ${response.error}`);return}try{await downloadDriveBackup(response.access_token)}catch(e){console.error(e);alert(`Drive restore failed: ${e.message}`)}}})}googleRestoreTokenClient.requestAccessToken({prompt:''})}
async function downloadDriveBackup(token){const file=await findDriveBackup(token);if(!file){alert(`${DRIVE_BACKUP_NAME} was not found in Google Drive.`);return}const response=await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,token);const text=await response.text();const parsed=parseBackupCsv(text);if(!parsed.climbs.length&&!parsed.logs.length){throw new Error('The Drive backup does not contain any valid Climb Tracker data.')}const ok=confirm(`Restore ${parsed.climbs.length} climbs and ${parsed.logs.length} daily logs from Google Drive?\n\nThis will replace the climbs and daily logs currently stored on this device.`);if(!ok)return;applyParsedBackup(parsed,true);closeModal();save();alert(`Restore complete: ${parsed.climbs.length} climbs and ${parsed.logs.length} daily logs.`)}
function parseLine(line){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===','&&!q){out.push(cur);cur=''}else cur+=c}out.push(cur);return out}
function parseDate(s){const m=s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);if(m)return new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]).getTime();const n=Number(s);return Number.isFinite(n)?n:Date.parse(s)}
function parseBackupCsv(text){const lines=text.split(/\r?\n/);let sec='';const climbs=[],logs=[];for(const raw of lines){const line=raw.trimEnd();if(!line)continue;if(line==='[CLIMBS]'){sec='c';continue}if(line==='[LOGS]'){sec='l';continue}if(line.startsWith('grade,type')||line.startsWith('date,calories'))continue;if(!sec&&line.includes(','))sec='c';const p=parseLine(line);if(sec==='c'&&p.length>=11){const date=parseDate(p[2]);if(!Number.isFinite(date))continue;climbs.push({id:uid()+climbs.length,grade:p[0],type:p[1],date,gym:p[3]||null,incline:p[4]||null,holdTypes:p[5]||null,keyMoves:p[6]||null,description:p[7]||null,attempts:parseInt(p[8])||1,isFlash:p[9].trim().toLowerCase()==='true',isProject:p[10].trim().toLowerCase()==='true'})}else if(sec==='l'&&p.length>=3){const date=parseDate(p[0]);if(!Number.isFinite(date))continue;logs.push({id:uid()+logs.length,date,calories:p[1]?parseInt(p[1]):null,weight:p[2]?parseFloat(p[2]):null,calorieHistory:p[3]||null})}}return {climbs,logs}}
function applyParsedBackup(parsed,replace=false){if(replace){state.climbs=parsed.climbs;state.logs=parsed.logs;state.gyms=[]}else{state.climbs.push(...parsed.climbs);state.logs.push(...parsed.logs)}for(const c of state.climbs)if(c.gym&&!state.gyms.some(g=>g.toLowerCase()===c.gym.toLowerCase()))state.gyms.push(c.gym)}
csvInput.onchange=async()=>{const f=csvInput.files[0];if(!f)return;const parsed=parseBackupCsv(await f.text());applyParsedBackup(parsed,false);csvInput.value='';save();alert(`Imported ${parsed.climbs.length} climbs and ${parsed.logs.length} daily logs.`)};
if('serviceWorker' in navigator)window.addEventListener('load',async()=>{try{const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});await reg.update()}catch(e){console.warn('Service worker update failed',e)}});
render();

// bodyChartOutsideDismissV27
document.addEventListener('pointerdown',e=>{
  if(e.target.closest('.interactive-chart'))return;
  hideBodyChartTooltips();
});
