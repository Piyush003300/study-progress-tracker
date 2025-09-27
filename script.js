// ===== Helpers =====
const toKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const parseYMD = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};
const startOfWeek = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  const off = (dow === 0 ? -6 : 1 - dow);
  x.setDate(x.getDate() + off);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfWeek = (sow) => {
  const e = new Date(sow);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const formatRangeCapsule = (sow) => {
  const eow = endOfWeek(sow);
  const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(sow)} – ${fmt(eow)}`;
};
const shortDayTitle = (ds) => {
  const d = parseYMD(ds);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

// ===== Storage keys =====
const LS = {
  daySettings: (ds) => `tracker.settings.${ds}`,
  box: (ds, idx) => `tracker.${ds}.${idx}`,
  meta: (ds) => `tracker.meta.${ds}`,
  review: (wk) => `tracker.review.${wk}`,
  taskTitles: (ds) => `tracker.tasks.${ds}`,
  freeNote: (ds) => `tracker.freeNote.${ds}`,
  badge: 'tracker.plan.badge',
  legendPill: (i) => `tracker.legend.pill.${i}`,
};

// ===== Storage helpers =====
const HARD_DEFAULT = 1;
const loadDaySettings = (ds) => {
  const raw = localStorage.getItem(LS.daySettings(ds));
  if (!raw) return { lecturesPerDay: HARD_DEFAULT, rest: false };
  try {
    const o = JSON.parse(raw);
    const n = parseInt(o?.lecturesPerDay, 10);
    return { lecturesPerDay: Number.isFinite(n) && n >= 0 ? n : HARD_DEFAULT, rest: !!o.rest };
  } catch {
    return { lecturesPerDay: HARD_DEFAULT, rest: false };
  }
};
const saveDaySettings = (ds, s) => localStorage.setItem(LS.daySettings(ds), JSON.stringify(s));
const loadBox = (ds, i) => localStorage.getItem(LS.box(ds, i)) === '1';
const saveBox = (ds, i, v) => localStorage.setItem(LS.box(ds, i), v ? '1' : '0');
const loadMeta = (ds) => {
  const raw = localStorage.getItem(LS.meta(ds));
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
};
const saveMeta = (ds, m) => localStorage.setItem(LS.meta(ds), JSON.stringify(m));
const loadReview = (wk) => {
  const raw = localStorage.getItem(LS.review(wk));
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const saveReview = (wk, d) => localStorage.setItem(LS.review(wk), JSON.stringify(d));
const loadTaskTitles = (ds) => {
  const raw = localStorage.getItem(LS.taskTitles(ds));
  try { const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch { return []; }
};
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

// Notes modal
const notesBack = document.getElementById('notesBack');
const notesTitle = document.getElementById('notesTitle');
const notesText = document.getElementById('notesText');
const notesCancel = document.getElementById('notesCancel');
const notesSave = document.getElementById('notesSave');

// Deadline mini elements (compact variant only)
const deadlineDisplay = document.getElementById('deadlineDisplay');
const deadlineBack = document.getElementById('deadlineBack');
const deadlinePicker = document.getElementById('deadlinePicker');
const deadlineCancel = document.getElementById('deadlineCancel');
const deadlineSave = document.getElementById('deadlineSave');
const deadlineRemove = document.getElementById('deadlineRemove');
const deadlineCountdown = document.getElementById('deadlineCountdown');
const deadlineMsg = document.getElementById('deadlineMsg');
const deadlineNoteBox = document.getElementById('deadlineNoteBox');


// ===== State =====
let currentStart = startOfWeek(new Date());
const today = new Date(); today.setHours(0,0,0,0);
let selectedDate = toKey(new Date());

// Allow editing any day, but only allow marking progress for today/past
const canProgress = (date) => { const d0 = new Date(date); d0.setHours(0,0,0,0); return d0.getTime() <= today.getTime(); };
const pctClass = (v)=> v>=80 ? 'good' : (v>=50 ? 'ok' : 'bad');

// ===== Deadline mini display logic =====
function updateDeadlineBox() {
  // Guard: mini might not be present
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
  if (deadlineNoteBox) { deadlineNoteBox.value = getDeadlineNoteBox(); }
}

// ===== Task details render/save =====
function renderTaskDetails(ds) {
  const settings = loadDaySettings(ds);
  const planned = settings.rest ? 0 : settings.lecturesPerDay;
  const titles = loadTaskTitles(ds).slice(0, planned);
  
  while (titles.length < planned) titles.push('');
  
  if (tasksTitle) tasksTitle.textContent = `Tasks ${shortDayTitle(ds)}`;
  
  taskList.innerHTML = '';
  for (let i = 0; i < planned; i++) {
    const row = document.createElement('div');
    row.className = 'task-row';
    
    const indicator = document.createElement('div');
    indicator.className = 'box-indicator';
    indicator.style.cursor = 'pointer';
    indicator.title = `Toggle task ${i + 1} completion`;
    
    const isCompleted = loadBox(ds, i);
    if (isCompleted) {
      indicator.style.background = '#26a641';
      indicator.style.borderColor = 'transparent';
      indicator.classList.add('completed');
    } else {
      indicator.style.background = '#0f1826';
      indicator.style.borderColor = '#2a394e';
      indicator.classList.remove('completed');
    }
    
    // Make indicator functional - click to toggle
    const allowed = canProgress(parseYMD(ds));
    if (allowed) {
      indicator.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentState = loadBox(ds, i);
        saveBox(ds, i, !currentState);
        
        // Update visual state immediately
        if (!currentState) {
          indicator.style.background = '#26a641';
          indicator.style.borderColor = 'transparent';
          indicator.classList.add('completed');
        } else {
          indicator.style.background = '#0f1826';
          indicator.style.borderColor = '#2a394e';
          indicator.classList.remove('completed');
        }
        
        // Update the main grid to reflect changes
        renderWeek();
      });
    } else {
      indicator.style.opacity = '0.6';
      indicator.style.cursor = 'not-allowed';
      indicator.title = 'Cannot modify past/future dates';
    }
    
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'task-input';
    inp.placeholder = `Task ${i + 1} title`;
    inp.value = titles[i];
    
    inp.addEventListener('input', () => {
      const current = loadTaskTitles(ds);
      current[i] = inp.value;
      saveTaskTitles(ds, current);
    });
    
    row.appendChild(indicator);
    row.appendChild(inp);
    taskList.appendChild(row);
  }
  
  if (freeNote) freeNote.value = loadFreeNote(ds);
  if (freeNote) freeNote.addEventListener('input', () => saveFreeNote(selectedDate, freeNote.value));
}

if (freeNote) {
  freeNote.addEventListener('input', ()=>{ saveFreeNote(selectedDate, freeNote.value); });
}

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
  return {
    planned,
    done,
    completion: planned>0? Math.round((done/planned)*100):0,
    dailyAvg: daysActive>0? Math.round((done/daysActive)*10)/10:0
  };
}

function todayStats(){
  const ds=toKey(today);
  const p=getDayPlanned(ds), d=getDayDone(ds);
  return { planned:p, done:d, pct: p>0? Math.round((d/p)*100):0 };
}

function computeAndRenderAnalytics(){
  const week = computeWeekStats(currentStart);
  const t = todayStats();
  analyticsBar.innerHTML = `
    <div class="chip"><span class="label">Today</span><span class="value ${pctClass(t.pct)}">${t.done}/${t.planned} · ${t.pct}%</span></div>
    <div class="chip"><span class="label">Week</span><span class="value ${pctClass(week.completion)}">${week.completion}%</span></div>
    <div class="chip"><span class="label">Planned vs Done</span><span class="value">${week.done}/${week.planned}</span></div>
    <div class="chip"><span class="label">Daily avg</span><span class="value">${week.dailyAvg}</span></div>
  `;
  // Heatmap refresh here (single source of truth)
  renderTwoMonthHeatmap();
}

// ===== Month card (two-month compact heatmap) =====
function monthCellLevel(done) {
  if (done <= 0) return '';
  if (done === 1) return 'level1';
  if (done === 2) return 'level2';
  if (done === 3) return 'level3';
  if (done === 4) return 'level4';
  return 'level5'; // 5+ completed tasks
}

function startOfWeekSunday(d){
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay(); // 0=Sun
  x.setDate(x.getDate() - dow);
  x.setHours(0,0,0,0);
  return x;
}
function endOfWeekSaturday(d){
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay(); // 0=Sun
  const add = 6 - dow;
  x.setDate(x.getDate() + add);
  x.setHours(0,0,0,0);
  return x;
}
function renderTwoMonthHeatmap(){


  console.log('renderTwoMonthHeatmap called'); // Debug line
  const host = document.getElementById('monthHeatmap'); 
  if (!host) {
    console.log('monthHeatmap element not found!'); // Debug line
    return;
  }
  console.log('Host found, rendering...'); // Debug line



  // Span: previous month 1st to current month last, padded to Sun..Sat weeks
  const curFirst = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevFirst = new Date(today.getFullYear(), today.getMonth()-1, 1);
  const curLast = new Date(today.getFullYear(), today.getMonth()+1, 0);

  const spanStart = startOfWeekSunday(prevFirst);
  const spanEnd = endOfWeekSaturday(curLast);

  // One row per week
  const rows = [];
  let w = new Date(spanStart);
  while (w <= spanEnd){
    rows.push(new Date(w));
    w.setDate(w.getDate() + 7);
  }

  const parts = [];
  for (let ri=0; ri<rows.length; ri++){
    const weekStart = rows[ri];
    let rowHtml = `<div class="mh-row">`;
    for (let c=0; c<7; c++){
      const d = addDays(weekStart, c);
      const k = toKey(d);
      const dn = getDayDone(k);
      const level = monthCellLevel(dn);
      const cls = level ? `mh-cell ${level}` : `mh-cell`;
      const tt = `${d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}: done ${dn}`;
      rowHtml += `<div class="${cls}" title="${tt}" tabindex="0" aria-label="${tt}"><span class="date">${d.getDate()}</span></div>`;
    }
    rowHtml += `</div>`;
    parts.push(rowHtml);
  }

  host.innerHTML = parts.join('');
  console.log('Rendered', parts.length, 'rows'); // Debug line
}

// ===== Week render and interactions =====
function lastFilledIndex(ds, planned){
  for(let i=planned-1;i>=0;i--){ if(loadBox(ds,i)) return i; }
  return -1;
}
function setProgress(ds, planned, idx){
  for(let i=0;i<planned;i++){ saveBox(ds, i, i<=idx); }
}
function paintWrap(wrapEl, ds, planned){
  const cells = Array.from(wrapEl.querySelectorAll('.box'));
  for(let i=0;i<planned;i++){
    const label = cells[i];
    const checked = loadBox(ds,i);
    label.classList.toggle('checked', checked);
    label.classList.remove('level1','level2','level3','level4','level5');
    if (checked){ label.classList.add(`level${(i%5)+1}`); }
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
  // removed: renderMonthGraph(currentStart) legacy call
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
if (meta?.notes && meta.notes.trim().length > 0) {
  day.classList.add('has-note');
}

const isToday = (ds === toKey(today));
if (isToday) {
  day.classList.add('today');
}

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
    
    
    
// Create + button (add tasks box)
const addBtn = document.createElement('button');
addBtn.className = 'mini-btn';
addBtn.textContent = '+';
addBtn.title = 'Add task box';
addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const ns = loadDaySettings(ds);
    const maxBoxes = 15; // Set your desired maximum
    if (ns.lecturesPerDay < maxBoxes) {
        ns.lecturesPerDay += 1;
        ns.rest = false; // Ensure not in rest mode
        saveDaySettings(ds, ns);
        renderWeek();
    }
});

// Create - button (remove task box)
const removeBtn = document.createElement('button');
removeBtn.className = 'mini-btn';
removeBtn.textContent = '−'; // Using minus symbol (−) instead of hyphen
removeBtn.title = 'Remove task box';
removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const ns = loadDaySettings(ds);
    if (ns.lecturesPerDay > 0) {
        ns.lecturesPerDay -= 1;
        // Clear the data for the removed box
        localStorage.removeItem(LS.box(ds, ns.lecturesPerDay));
        // Set as rest if no boxes left
        ns.rest = ns.lecturesPerDay === 0;
        saveDaySettings(ds, ns);
        renderWeek();
    }
});

// Append both buttons
tools.appendChild(removeBtn);
tools.appendChild(addBtn);







    const allowed = canProgress(dayDate);
    const wrap = document.createElement('div'); wrap.className = 'lecture-wrap';
    for(let j=0;j<planned;j++){
      const label = document.createElement('label'); label.className = 'box';
      if(!allowed) label.style.pointerEvents='none';
      const inp = document.createElement('input'); inp.type='checkbox'; inp.disabled=!allowed;
      const checked = loadBox(ds, j); inp.checked = checked; if(checked){ label.classList.add('checked',`level${(j%5)+1}`); }
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
  if (freeNote) freeNote.value = loadFreeNote(selectedDate);

  computeAndRenderAnalytics();
  // removed: renderMonthGraph(currentStart) legacy call
  updateDeadlineBox();







// Ensure today (or selected) is visible and centered in the horizontal scroller
const grid = document.querySelector('.week-grid') || document.getElementById('weekGrid');
if (grid) {
  const target =
    grid.querySelector('.day.today') ||
    grid.querySelector('.day.selected');
  if (target && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
  }
}

}

// ===== Notes modal =====
function openNotesModal(ds){
  const settings = loadDaySettings(ds);
  notesTitle.textContent = `Day editor · ${ds}`;
  notesText.value = loadMeta(ds).notes || '';
  notesBack.dataset.date = ds;
  notesBack.style.display = 'flex';
}
function closeNotesModal(){ notesBack.style.display='none'; delete notesBack.dataset.date; }
if (notesCancel) notesCancel.addEventListener('click', closeNotesModal);
if (notesBack) notesBack.addEventListener('click', (e)=>{ if(e.target===notesBack) closeNotesModal(); });


if (notesSave) {
  notesSave.addEventListener('click', () => {
    const ds = notesBack.dataset.date; 
    if (!ds) return;
    
    const meta = loadMeta(ds); 
    meta.notes = notesText.value.trim(); 
    saveMeta(ds, meta);
    
    closeNotesModal();
    renderWeek();
  });
}


// ===== Deadline mini modal open/bindings (guarded) =====
if (deadlineDisplay) {
  deadlineDisplay.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.closest('[data-deadline-open]') && deadlineBack && deadlinePicker) {
      const val = getDeadline();
      deadlinePicker.value = val || '';
      deadlineBack.style.display = 'flex';
    }
  });
  deadlineDisplay.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    if (isTyping) return;
    if ((e.key === 'Enter' || e.key === ' ')) {
      const onOpenEl = active && active.hasAttribute && active.hasAttribute('data-deadline-open');
      if (onOpenEl && deadlineBack && deadlinePicker) {
        e.preventDefault();
        const val = getDeadline();
        deadlinePicker.value = val || '';
        deadlineBack.style.display = 'flex';
      }
    }
  });
}
if (deadlineCancel && deadlineBack) deadlineCancel.addEventListener('click', ()=>{ deadlineBack.style.display='none'; });
if (deadlineSave && deadlineBack && deadlinePicker) {
  deadlineSave.addEventListener('click', ()=>{
    const v = deadlinePicker.value;
    if (v) { setDeadline(v); }
    updateDeadlineBox();
    deadlineBack.style.display='none';
  });
}
if (deadlineRemove && deadlineBack) {
  deadlineRemove.addEventListener('click', ()=>{
    clearDeadline();
    updateDeadlineBox();
    deadlineBack.style.display='none';
  });
}
if (deadlineBack) {
  deadlineBack.addEventListener('click', (e)=>{
    if (e.target === deadlineBack) deadlineBack.style.display='none';
  });
}
if (deadlineNoteBox){
  const saveBoxNote = ()=> setDeadlineNoteBox(deadlineNoteBox.value.trim());
  deadlineNoteBox.addEventListener('input', saveBoxNote);
  deadlineNoteBox.addEventListener('blur', saveBoxNote);
}



// ===== Navigation and selection =====
const prevBtn = document.getElementById('prevWeek');
const nextBtn = document.getElementById('nextWeek');
if (prevBtn) prevBtn.addEventListener('click', ()=>{ currentStart = addDays(currentStart, -7); renderWeek(); });
if (nextBtn) nextBtn.addEventListener('click', ()=>{ currentStart = addDays(currentStart, 7); renderWeek(); });

if (datePicker){
  datePicker.addEventListener('change', ()=>{
    const val = datePicker.value; if(!val) return;
    selectedDate = val;
    currentStart = startOfWeek(parseYMD(val));
    renderWeek();
  });
}

if (weekGrid){
  weekGrid.addEventListener('click', (e)=>{
    const dayEl = e.target.closest('.day'); if(!dayEl) return;
    const ds = dayEl.dataset.date; if(!ds) return;
    selectedDate = ds;
    if (datePicker) datePicker.value = selectedDate;
    document.querySelectorAll('.day.selected').forEach(el=>el.classList.remove('selected'));
    dayEl.classList.add('selected');
    renderTaskDetails(selectedDate);
    if (freeNote) freeNote.value = loadFreeNote(selectedDate);
  });
}

// ===== Init =====
(function init(){
  selectedDate = toKey(new Date());
  if (datePicker) datePicker.value = selectedDate;
  currentStart = startOfWeek(parseYMD(selectedDate));
  renderWeek();
  updateDeadlineBox();

  // Inline-editable legend pills
  const legend = document.querySelector('.legend');
  if (legend){
    const pills = Array.from(legend.querySelectorAll('.pill'));
    pills.forEach((pill, idx)=>{
      const saved = localStorage.getItem(LS.legendPill(idx));
  if (saved) {
    pill.textContent = saved;
  } else {
    pill.textContent = 'Edit me'; // Add this line for default text
  }
  pill.setAttribute('contenteditable','true');
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
