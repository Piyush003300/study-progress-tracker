  // ===== Helpers =====
  const toKey = (d) => { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; };
  const parseYMD = (ymd) => { const [y,m,d]=ymd.split('-').map(Number); return new Date(y,m-1,d,0,0,0,0); };
  const startOfWeek = (d) => { const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); const dow=x.getDay(); const off=(dow===0?-6:1-dow); x.setDate(x.getDate()+off); x.setHours(0,0,0,0); return x; };
  const endOfWeek = (sow) => { const e=new Date(sow); e.setDate(e.getDate()+6); e.setHours(23,59,59,999); return e; };
  const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const formatRangeCapsule = (sow) => { const eow=endOfWeek(sow); const fmt=(d)=> d.toLocaleDateString(undefined,{month:'short', day:'numeric'}); return `${fmt(sow)} – ${fmt(eow)}`; };
  const shortDayTitle = (ds) => { const d = parseYMD(ds); return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }); };

  // ===== Storage keys =====
  const LS = {
    daySettings: (ds) => `tracker.settings.${ds}`,
    box: (ds, idx) => `tracker.${ds}.${idx}`,
    meta: (ds) => `tracker.meta.${ds}`,
    review: (wk) => `tracker.review.${wk}`,
    taskTitles: (ds) => `tracker.tasks.${ds}`,
    freeNote: (ds) => `tracker.freeNote.${ds}`,
    badge: 'tracker.plan.badge',
    legendPill: (i) => `tracker.legend.pill.${i}`
  };

  // ===== Storage helpers =====
  const HARD_DEFAULT = 1;
  const loadDaySettings = (ds) => {
    const raw=localStorage.getItem(LS.daySettings(ds));
    if(!raw) return { lecturesPerDay:HARD_DEFAULT, rest:false };
    try{ const o=JSON.parse(raw); const n=parseInt(o?.lecturesPerDay,10); return { lecturesPerDay: Number.isFinite(n)&&n>=0?n:HARD_DEFAULT, rest: !!o.rest }; }
    catch{ return { lecturesPerDay:HARD_DEFAULT, rest:false }; }
  };
  const saveDaySettings = (ds, s) => localStorage.setItem(LS.daySettings(ds), JSON.stringify(s));
  const loadBox = (ds, i) => localStorage.getItem(LS.box(ds, i)) === '1';
  const saveBox = (ds, i, v) => localStorage.setItem(LS.box(ds, i), v ? '1':'0');
  const loadMeta = (ds) => { const raw=localStorage.getItem(LS.meta(ds)); try{ return raw? JSON.parse(raw): {}; }catch{ return {}; } };
  const saveMeta = (ds, m) => localStorage.setItem(LS.meta(ds), JSON.stringify(m));
  const loadReview = (wk) => { const raw=localStorage.getItem(LS.review(wk)); try{ return raw? JSON.parse(raw): null; }catch{ return null; } };
  const saveReview = (wk, d) => localStorage.setItem(LS.review(wk), JSON.stringify(d));
  const loadTaskTitles = (ds) => { const raw=localStorage.getItem(LS.taskTitles(ds)); try{ const a=raw? JSON.parse(raw): []; return Array.isArray(a)? a:[]; }catch{ return []; } };
  const saveTaskTitles = (ds, arr) => localStorage.setItem(LS.taskTitles(ds), JSON.stringify(arr || []));
  const loadFreeNote = (ds) => localStorage.getItem(LS.freeNote(ds)) || '';
  const saveFreeNote = (ds, t) => localStorage.setItem(LS.freeNote(ds), t || '');

  // ===== Deadline storage =====
  const DEADLINE_KEY = 'tracker.deadline';
  const DEADLINE_NOTEBOX_KEY = 'tracker.deadline.notebox';
  const getDeadline = () => localStorage.getItem(DEADLINE_KEY);
  const setDeadline = (val) => val && localStorage.setItem(DEADLINE_KEY, val);
  const clearDeadline = () => localStorage.removeItem(DEADLINE_KEY);
  const getDeadlineNoteBox = () => localStorage.getItem(DEADLINE_NOTEBOX_KEY) || '';
  const setDeadlineNoteBox = (t) => localStorage.setItem(DEADLINE_NOTEBOX_KEY, t || '');

  // ===== DOM =====
  const weekGrid = document.getElementById('weekGrid');
  const weekRange = document.getElementById('weekRange');
  const analyticsBar = document.getElementById('analyticsBar');
  const datePicker = document.getElementById('datePicker');
  const planBadge = document.querySelector('.plan .badge');
  const taskList = document.getElementById('taskList');
  const freeNote = document.getElementById('freeNote');
  const tasksTitle = document.getElementById('tasksTitle');

  const notesBack = document.getElementById('notesBack');
  const notesTitle = document.getElementById('notesTitle');
  const notesText = document.getElementById('notesText');
  const modalTasks = document.getElementById('modalTasks');
  const notesCancel = document.getElementById('notesCancel');
  const notesSave = document.getElementById('notesSave');

  const deadlineDisplay = document.getElementById('deadlineDisplay');
  const deadlineBack = document.getElementById('deadlineBack');
  const deadlinePicker = document.getElementById('deadlinePicker');
  const deadlineCancel = document.getElementById('deadlineCancel');
  const deadlineSave = document.getElementById('deadlineSave');
  const deadlineRemove = document.getElementById('deadlineRemove');
  const deadlineCountdown = document.getElementById('deadlineCountdown');
  const deadlineMsg = document.getElementById('deadlineMsg');
  const deadlineNoteBox = document.getElementById('deadlineNoteBox');

  const reviewBack = document.getElementById('reviewBack');
  const revCancel = document.getElementById('revCancel');
  const revSave = document.getElementById('revSave');
  const revQ1 = document.getElementById('revQ1');
  const revQ2 = document.getElementById('revQ2');
  const revQ3 = document.getElementById('revQ3');

  const mgCanvas = document.getElementById('mgCanvas');
  const mgTitle = document.getElementById('mgTitle');

  // ===== State =====
  let currentStart = startOfWeek(new Date());
  const today = new Date(); today.setHours(0,0,0,0);
  let selectedDate = toKey(new Date());

  // Allow editing any day, but only allow marking progress for today/past
  const canProgress = (date) => { const d0=new Date(date); d0.setHours(0,0,0,0); return d0.getTime() <= today.getTime(); };
  const pctClass = (v)=> v>=80 ? 'good' : (v>=50 ? 'ok' : 'bad');

  // ===== Deadline display logic =====
  function updateDeadlineBox() {
    if (!deadlineCountdown || !deadlineMsg) return;
    const raw = getDeadline();
    if (!raw) {
      deadlineCountdown.textContent = 'No deadline set';
      deadlineMsg.textContent = 'Click to choose a date';
    } else {
      const now = new Date(); now.setHours(0,0,0,0);
      const end = new Date(raw); end.setHours(0,0,0,0);
      const msDiff = end - now;
      const days = Math.ceil(msDiff / 86400000);
      if (days > 0) {
        deadlineCountdown.textContent = `${days} days left`;
        deadlineMsg.textContent = 'Deadline: ' + end.toLocaleDateString(undefined, { day:'2-digit', month:'short', year:'numeric' });
      } else if (days === 0) {
        deadlineCountdown.textContent = 'Deadline is today!';
        deadlineMsg.textContent = end.toLocaleDateString(undefined, { day:'2-digit', month:'short', year:'numeric' });
      } else {
        deadlineCountdown.textContent = 'Deadline passed';
        deadlineMsg.textContent = end.toLocaleDateString(undefined, { day:'2-digit', month:'short', year:'numeric' });
      }
    }
    // Sync notes box from storage
    if (deadlineNoteBox){ deadlineNoteBox.value = getDeadlineNoteBox(); }
  }

  // ===== Task details render/save =====
  function renderTaskDetails(ds){
    const settings = loadDaySettings(ds);
    const planned = settings.rest ? 0 : settings.lecturesPerDay;
    const titles = loadTaskTitles(ds).slice(0, planned);
    while (titles.length < planned) titles.push('');

    if (tasksTitle) tasksTitle.textContent = `Tasks · ${shortDayTitle(ds)}`;

    taskList.innerHTML = '';
    for(let i=0;i<planned;i++){
      const row = document.createElement('div'); row.className='task-row';
      const indicator = document.createElement('div'); indicator.className='box-indicator';
      if (loadBox(ds, i)){ indicator.style.background = '#26a641'; indicator.style.borderColor = 'transparent'; }
      const inp = document.createElement('input'); inp.type='text'; inp.className='task-input'; inp.placeholder=`Task ${i+1} title`; inp.value = titles[i] || '';
      inp.addEventListener('input', ()=>{
        const current = loadTaskTitles(ds);
        current[i] = inp.value;
        saveTaskTitles(ds, current);
      });
      row.appendChild(indicator); row.appendChild(inp);
      taskList.appendChild(row);
    }
    freeNote.value = loadFreeNote(ds);
  }
  freeNote.addEventListener('input', ()=>{ saveFreeNote(selectedDate, freeNote.value); });

  // ===== Stats/render =====
  function getDayPlanned(ds){ const s=loadDaySettings(ds); return s.rest ? 0 : s.lecturesPerDay; }
  function getDayDone(ds){ const p=getDayPlanned(ds); let c=0; for(let i=0;i<p;i++){ if(loadBox(ds,i)) c++; } return c; }

  function computeWeekStats(sow){
    let planned=0, done=0, daysActive=0;
    for(let i=0;i<7;i++){
      const ds = toKey(addDays(sow, i));
      const p = getDayPlanned(ds);
      const d = getDayDone(ds);
      planned += p; done += d;
      if (p>0 || d>0) daysActive++;
    }
    return { planned, done, completion: planned>0? Math.round((done/planned)*100):0, dailyAvg: daysActive>0? Math.round((done/daysActive)*10)/10:0 };
  }

  function todayStats(){ const ds=toKey(today); const p=getDayPlanned(ds), d=getDayDone(ds); return { planned:p, done:d, pct: p>0? Math.round((d/p)*100):0 }; }

  function computeAndRenderAnalytics(){
    const week = computeWeekStats(currentStart);
    const t = todayStats();
    analyticsBar.innerHTML = `
      <div class="chip"><span class="label">Today</span><span class="value ${pctClass(t.pct)}">${t.done}/${t.planned} · ${t.pct}%</span></div>
      <div class="chip"><span class="label">Week</span><span class="value ${pctClass(week.completion)}">${week.completion}%</span></div>
      <div class="chip"><span class="label">Planned vs Done</span><span class="value">${week.done}/${week.planned}</span></div>
      <div class="chip"><span class="label">Daily avg</span><span class="value">${week.dailyAvg}</span></div>
    `;
  }

  function renderMonthGraph(anchorDate){
    const a = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const next = new Date(a.getFullYear(), a.getMonth()+1, 1);
    const days = Math.round((next - a)/86400000);
    const monthName = a.toLocaleDateString(undefined,{month:'long', year:'numeric'});

    let maxPlanned = 0;
    const plannedArr = [];
    const doneArr = [];
    for(let i=0;i<days;i++){
      const d = new Date(a.getFullYear(), a.getMonth(), i+1);
      const ds = toKey(d);
      const p = getDayPlanned(ds);
      let done=0; for(let k=0;k<p;k++){ if(loadBox(ds,k)) done++; }
      plannedArr.push(p);
      doneArr.push(done);
      if (p>maxPlanned) maxPlanned = p;
    }
    if (maxPlanned < 1) maxPlanned = 1;

    const dpi = window.devicePixelRatio || 1;
    const W = mgCanvas.clientWidth * dpi;
    const H = mgCanvas.clientHeight * dpi;
    mgCanvas.width = W; mgCanvas.height = H;
    const ctx = mgCanvas.getContext('2d');
    ctx.clearRect(0,0,W,H);

    const padL=44, padR=12, padT=18, padB=32;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const gap = Math.max(1, Math.floor(chartW/(days*6)));
    const barW = Math.max(3, Math.floor((chartW - (days-1)*gap)/days));

    ctx.strokeStyle = 'rgba(120,140,170,0.38)';
    ctx.lineWidth = 1*dpi;
    ctx.beginPath();
    ctx.moveTo(padL, H-padB); ctx.lineTo(W-padR, H-padB);
    ctx.moveTo(padL, padT); ctx.lineTo(padL, H-padB);
    ctx.stroke();

    const ticks = 5;
    ctx.fillStyle = 'rgba(210,220,238,0.92)';
    ctx.font = `${12*dpi}px system-ui`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(120,140,170,0.18)';
    for(let t=0;t<ticks;t++){
      const value = Math.round((maxPlanned * t)/(ticks-1));
      const y = H - padB - (value / maxPlanned) * chartH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillText(String(value), padL - 8*dpi, y);
    }

    const todayKey = toKey(new Date());
    for(let i=0;i<days;i++){
      const x = padL + i*(barW+gap);
      const p = plannedArr[i];
      const dDone = doneArr[i];
      const h = Math.round((dDone / maxPlanned) * chartH);
      const y = H - padB - h;

      if (p === 0){
        const hBase = Math.round(0.12 * chartH);
        const yBase = H - padB - hBase;
        ctx.fillStyle = 'rgba(38,50,68,0.9)';
        const r = 3*dpi;
        ctx.beginPath();
        ctx.moveTo(x, yBase+r);
        ctx.arcTo(x, yBase, x+r, yBase, r);
        ctx.lineTo(x+barW-r, yBase);
        ctx.arcTo(x+barW, yBase, x+barW, yBase+r, r);
        ctx.lineTo(x+barW, yBase+hBase-r);
        ctx.arcTo(x+barW, yBase+hBase, x+barW-r, yBase+hBase, r);
        ctx.lineTo(x+r, yBase+hBase);
        ctx.arcTo(x, yBase+hBase, x, yBase+hBase-r, r);
        ctx.closePath();
        ctx.fill();
      } else {
        const pct = p>0 ? (dDone/p) : 0;
        if (pct>=0.75) ctx.fillStyle = 'rgba(57,211,83,0.9)';
        else if (pct>=0.5) ctx.fillStyle = 'rgba(38,166,65,0.9)';
        else if (pct>=0.25) ctx.fillStyle = 'rgba(0,109,50,0.9)';
        else ctx.fillStyle = 'rgba(14,68,41,0.9)';

        const r = 3*dpi;
        ctx.beginPath();
        ctx.moveTo(x, y+r);
        ctx.arcTo(x, y, x+r, y, r);
        ctx.lineTo(x+barW-r, y);
        ctx.arcTo(x+barW, y, x+barW, y+r, r);
        ctx.lineTo(x+barW, y+h-r);
        ctx.arcTo(x+barW, y+h, x+barW-r, y+h, r);
        ctx.lineTo(x+r, y+h);
        ctx.arcTo(x, y+h, x, y+h-r, r);
        ctx.closePath();
        ctx.fill();
      }

      const ds = toKey(new Date(a.getFullYear(), a.getMonth(), i+1));
      if (ds === todayKey){
        const markH = (p===0) ? Math.round(0.12 * chartH) : h;
        const markY = (p===0) ? (H - padB - markH) : y;
        ctx.strokeStyle = 'rgba(94,234,212,0.85)';
        ctx.lineWidth = 2*dpi;
        ctx.strokeRect(x-1*dpi, markY-1*dpi, barW+2*dpi, markH+2*dpi);
      }

      if ((i+1)%5===0 || i===0 || i===days-1){
        ctx.fillStyle = 'rgba(210,220,238,0.85)';
        ctx.font = `${12*dpi}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(String(i+1), x + barW/2, H - padB + 6*dpi);
      }
    }

    mgTitle.textContent = `${monthName} · Lectures/day scale`;
  }

  // ===== Week render and interactions =====
  function lastFilledIndex(ds, planned){ for(let i=planned-1;i>=0;i--){ if(loadBox(ds,i)) return i; } return -1; }
  function setProgress(ds, planned, idx){ for(let i=0;i<planned;i++){ saveBox(ds, i, i<=idx); } }
  function paintWrap(wrapEl, ds, planned){
    const cells = Array.from(wrapEl.querySelectorAll('.box'));
    for(let i=0;i<planned;i++){
      const label = cells[i];
      const checked = loadBox(ds,i);
      label.classList.toggle('checked', checked);
      label.classList.remove('level1','level2','level3','level4');
      if (checked){ label.classList.add(`level${(i%4)+1}`); }
      const inp = label.querySelector('input'); inp.checked = checked;
    }
  }

  function handleBoxClick(wrapEl, ds, planned, j){
    if (!canProgress(parseYMD(ds))) return;
    const wasChecked = loadBox(ds, j);
    const last = lastFilledIndex(ds, planned);
    if (!wasChecked){ setProgress(ds, planned, j); }
    else { if (j===last) setProgress(ds, planned, -1); else setProgress(ds, planned, j); }
    paintWrap(wrapEl, ds, planned);
    computeAndRenderAnalytics();
    renderMonthGraph(currentStart);
    renderTaskDetails(ds);
  }

  function renderWeek(){
    weekRange.textContent = formatRangeCapsule(currentStart);
    datePicker.value = selectedDate;
    weekGrid.innerHTML = '';

    for(let i=0;i<7;i++){
      const dayDate = addDays(currentStart, i);
      const ds = toKey(dayDate);
      const s = loadDaySettings(ds);
      const planned = s.rest ? 0 : s.lecturesPerDay;

      const day = document.createElement('div');
      day.className = 'day';
      day.dataset.date = ds;

      let done=0; for(let k=0;k<planned;k++){ if(loadBox(ds,k)) done++; }
      const isPast = dayDate.getTime() < (new Date().setHours(0,0,0,0));
      if (planned===0){ day.classList.add('rest'); }
      else if (isPast && done===0){ day.classList.add('missed'); }

      const meta = loadMeta(ds);
      if (meta?.notes) day.classList.add('has-note');

      const head = document.createElement('div'); head.className = 'day-head';
      const headLeft = document.createElement('div'); headLeft.style.display='flex'; headLeft.style.alignItems='baseline'; headLeft.style.gap='8px';
      const dn = document.createElement('div'); dn.className = 'day-name'; dn.textContent = dayDate.toLocaleDateString(undefined,{weekday:'short'});
      const dd = document.createElement('div'); dd.className = 'day-date'; dd.textContent = dayDate.toLocaleDateString(undefined,{month:'short', day:'numeric'});
      headLeft.appendChild(dn); headLeft.appendChild(dd);

      const noteBtn = document.createElement('button'); noteBtn.className='note-btn'; noteBtn.title='Edit tasks/day and note';
      noteBtn.textContent = '✎';
      noteBtn.addEventListener('click', (e)=>{ e.stopPropagation(); openNotesModal(ds); });

      head.appendChild(headLeft); head.appendChild(noteBtn);

      const dot = document.createElement('div'); dot.className='note-dot'; day.appendChild(dot);

      const tools = document.createElement('div'); tools.className='day-tools';
      const restBtn = document.createElement('button'); restBtn.className='mini-btn'; restBtn.textContent = s.rest ? 'Unset Rest' : 'Mark Rest';
      restBtn.addEventListener('click', (e)=>{ e.stopPropagation(); const ns = loadDaySettings(ds); ns.rest = !ns.rest; if (ns.rest) { for(let z=0; z<48; z++){ localStorage.removeItem(LS.box(ds, z)); } } saveDaySettings(ds, ns); renderWeek(); });
      tools.appendChild(restBtn);

      const allowed = canProgress(dayDate);
      const wrap = document.createElement('div'); wrap.className = 'lecture-wrap';
      for(let j=0;j<planned;j++){
        const label = document.createElement('label'); label.className = 'box';
        if(!allowed) label.style.pointerEvents='none';
        const inp = document.createElement('input'); inp.type='checkbox'; inp.disabled=!allowed;
        const checked = loadBox(ds, j); inp.checked = checked; if(checked){ label.classList.add('checked',`level${(j%4)+1}`); }
        label.appendChild(inp);
        label.addEventListener('click', (ev)=>{ if(!allowed){ ev.preventDefault(); ev.stopPropagation(); return; } handleBoxClick(wrap, ds, planned, j); ev.preventDefault(); });
        wrap.appendChild(label);
      }

      day.appendChild(head);
      day.appendChild(tools);
      day.appendChild(wrap);
      weekGrid.appendChild(day);
    }

    renderTaskDetails(selectedDate);
    freeNote.value = loadFreeNote(selectedDate);
    computeAndRenderAnalytics();
    renderMonthGraph(currentStart);
    updateDeadlineBox();
  }

  // ===== Notes modal =====
  function openNotesModal(ds){
    const dayObj = parseYMD(ds);
    const settings = loadDaySettings(ds);
    notesTitle.textContent = `Day editor · ${ds}`;
    notesText.value = loadMeta(ds).notes || '';
    modalTasks.value = settings.lecturesPerDay;
    // Always allow editing tasks/day for any date
    modalTasks.disabled = false;
    notesBack.dataset.date = ds;
    notesBack.style.display = 'flex';
  }
  function closeNotesModal(){ notesBack.style.display='none'; delete notesBack.dataset.date; }
  notesCancel.addEventListener('click', closeNotesModal);
  notesBack.addEventListener('click', (e)=>{ if(e.target===notesBack) closeNotesModal(); });

  function applyModalTasks(ds){
    let n = parseInt(modalTasks.value,10);
    if(!Number.isFinite(n) || n<0 || n>48) n = loadDaySettings(ds).lecturesPerDay;
    const settings = loadDaySettings(ds);
    settings.lecturesPerDay = n;
    settings.rest = n===0;
    for(let z=n; z<48; z++){ localStorage.removeItem(LS.box(ds, z)); }
    saveDaySettings(ds, settings);
  }
  notesSave.addEventListener('click', ()=>{
    const ds = notesBack.dataset.date; if(!ds) return;
    applyModalTasks(ds);
    const meta = loadMeta(ds); meta.notes = notesText.value.trim(); saveMeta(ds, meta);
    closeNotesModal();
    renderWeek();
  });

  // ===== Deadline modal open: only on specific elements =====
  deadlineDisplay.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.closest('[data-deadline-open]')) {
      const val = getDeadline();
      deadlinePicker.value = val || '';
      deadlineBack.style.display = 'flex';
    }
  });
  deadlineDisplay.addEventListener('keydown', (e) => {
    // Allow keyboard open only when focus is on an opener element
    const active = document.activeElement;
    const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    if (isTyping) return;
    if ((e.key === 'Enter' || e.key === ' ')) {
      const onOpenEl = active && active.hasAttribute && active.hasAttribute('data-deadline-open');
      if (onOpenEl) {
        e.preventDefault();
        const val = getDeadline();
        deadlinePicker.value = val || '';
        deadlineBack.style.display = 'flex';
      }
    }
  });

  // Deadline modal buttons
  deadlineCancel.addEventListener('click', ()=>{ deadlineBack.style.display='none'; });
  deadlineSave.addEventListener('click', ()=>{
    const v = deadlinePicker.value;
    if (v) { setDeadline(v); }
    updateDeadlineBox();
    deadlineBack.style.display='none';
  });
  deadlineRemove.addEventListener('click', ()=>{
    clearDeadline();
    updateDeadlineBox();
    deadlineBack.style.display='none';
  });
  deadlineBack.addEventListener('click', (e)=>{
    if (e.target === deadlineBack) deadlineBack.style.display='none';
  });

  // Save the notes inside deadline card
  if (deadlineNoteBox){
    const saveBoxNote = ()=> setDeadlineNoteBox(deadlineNoteBox.value.trim());
    deadlineNoteBox.addEventListener('input', saveBoxNote);
    deadlineNoteBox.addEventListener('blur', saveBoxNote);
  }

  // ===== Weekly review modal =====
  function openReviewModal(weekId){
    const prev = loadReview(weekId);
    revQ1.value = prev?.q1 || ''; revQ2.value = prev?.q2 || ''; revQ3.value = prev?.q3 || '';
    reviewBack.dataset.week = weekId;
    reviewBack.style.display = 'flex';
  }
  function closeReviewModal(){ reviewBack.style.display='none'; delete reviewBack.dataset.week; }
  reviewBack.addEventListener('click', (e)=>{ if(e.target===reviewBack) closeReviewModal(); });
  revCancel.addEventListener('click', closeReviewModal);
  revSave.addEventListener('click', ()=>{
    const wid = reviewBack.dataset.week || `week:${toKey(currentStart)}`;
    saveReview(wid, { q1:revQ1.value.trim(), q2:revQ2.value.trim(), q3:revQ3.value.trim(), ts: Date.now() });
    closeReviewModal();
    computeAndRenderAnalytics();
  });

  // ===== Navigation and selection =====
  document.getElementById('prevWeek').addEventListener('click', ()=>{ currentStart = addDays(currentStart, -7); renderWeek(); });
  document.getElementById('nextWeek').addEventListener('click', ()=>{ currentStart = addDays(currentStart, 7); renderWeek(); });

  datePicker.addEventListener('change', ()=>{
    const val = datePicker.value; if(!val) return;
    selectedDate = val;
    currentStart = startOfWeek(parseYMD(val));
    renderWeek();
  });

  weekGrid.addEventListener('click', (e)=>{
    const dayEl = e.target.closest('.day'); if(!dayEl) return;
    const ds = dayEl.dataset.date; if(!ds) return;
    selectedDate = ds;
    datePicker.value = selectedDate;
    document.querySelectorAll('.day.selected').forEach(el=>el.classList.remove('selected'));
    dayEl.classList.add('selected');
    renderTaskDetails(selectedDate);
    freeNote.value = loadFreeNote(selectedDate);
  });

  // ===== Init =====
  (function init(){
    selectedDate = toKey(new Date());
    datePicker.value = selectedDate;
    currentStart = startOfWeek(parseYMD(selectedDate));
    renderWeek();
    updateDeadlineBox();
    // Inline-editable legend pills
    const legend = document.querySelector('.legend');
    if (legend){
      const pills = Array.from(legend.querySelectorAll('.pill'));
      pills.forEach((pill, idx)=>{
        const saved = localStorage.getItem(LS.legendPill(idx));
        if (saved) pill.textContent = saved;
        pill.setAttribute('contenteditable','true');
        pill.setAttribute('spellcheck','false');
        pill.setAttribute('role','textbox');
        pill.setAttribute('aria-label','Edit legend pill');
        const save = ()=>{
          const text = (pill.textContent || '').replace(/\s+/g,' ').trim();
          pill.textContent = text;
          localStorage.setItem(LS.legendPill(idx), text);
        };
        pill.addEventListener('blur', save);
        pill.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); pill.blur(); } });
        pill.addEventListener('input', ()=>{
          const normalized = (pill.textContent || '').replace(/\s+/g,' ').trim();
          if (pill.textContent !== normalized){
            pill.textContent = normalized;
            const sel = window.getSelection(); if (sel) sel.removeAllRanges();
          }
        });
      });
    }
    // Inline-editable plan badge
    if (planBadge){
      const saved = localStorage.getItem(LS.badge);
      if (saved) planBadge.textContent = saved;
      planBadge.setAttribute('contenteditable', 'true');
      planBadge.setAttribute('spellcheck', 'false');
      planBadge.setAttribute('role', 'textbox');
      planBadge.setAttribute('aria-label', 'Edit plan title');
      const saveBadge = ()=>{
        const text = (planBadge.textContent || '').replace(/\s+/g,' ').trim();
        planBadge.textContent = text;
        localStorage.setItem(LS.badge, text);
      };
      planBadge.addEventListener('blur', saveBadge);
      planBadge.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ e.preventDefault(); planBadge.blur(); } });
      planBadge.addEventListener('input', ()=>{
        // keep it single-line
        const normalized = (planBadge.textContent || '').replace(/\s+/g,' ').trim();
        if (planBadge.textContent !== normalized){
          planBadge.textContent = normalized;
          const sel = window.getSelection(); if (sel) sel.removeAllRanges();
        }
      });
    }
  })();
