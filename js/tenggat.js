/* ── Helpers ── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const KEY = 'tenggat.v1';
const THEME = 'tenggat.tema';

/* ── State ── */
const S = {
  tasks: [],
  view: 'ringkasan',
  lay: 'tabel',
  cat: '',
  q: '',
  sort: 'tenggat',
  edit: null,
  first: true,
  asked: false
};

/* ── Constants ── */
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MON  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

/* ── Date utils ── */
const pad     = n => String(n).padStart(2, '0');
const ymd     = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const parse   = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const wStart  = d => { const x = addDays(d, -((d.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; };
const hm      = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/* ── String utils ── */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic  = (n, c = '') => `<svg class="i ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;


/* ── Persistence ── */
function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && Array.isArray(v.tasks)) S.tasks = v.tasks;
  } catch (e) { /* storage bisa diblokir; aplikasi tetap jalan tanpa simpanan */ }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ tasks: S.tasks }));
  } catch (e) { /* lihat load */ }
}


/* ── Task logic ── */
function group(t, now = new Date()) {
  if (t.done) return 'selesai';
  if (!t.due) return 'nanti';
  const td = ymd(now);
  if (t.due < td || (t.due === td && t.time && t.time < hm(now))) return 'terlambat';
  if (t.due === td) return 'hari';
  if (t.due === ymd(addDays(now, 1))) return 'besok';
  return 'nanti';
}

const GL = { terlambat: 'Terlambat', hari: 'Hari ini', besok: 'Besok', nanti: 'Nanti', selesai: 'Selesai' };

function dueText(t) {
  if (!t.due) return 'Tanpa tenggat';
  const now = new Date(), d = parse(t.due);
  const base = t.due === ymd(now)
    ? 'Hari ini'
    : t.due === ymd(addDays(now, 1))
      ? 'Besok'
      : `${DAYS[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MON[d.getMonth()].slice(0, 3)}`;
  return t.time ? `${base}, ${t.time}` : base;
}

const cmp = (a, b) =>
  S.sort === 'judul'   ? a.title.localeCompare(b.title, 'id') :
  S.sort === 'terbaru' ? b.id - a.id :
  ((a.due || '9') + (a.time || '99:99')).localeCompare((b.due || '9') + (b.time || '99:99'));

function visible() {
  const now = new Date(), td = ymd(now),
        ws  = ymd(wStart(now)), we = ymd(addDays(wStart(now), 6));
  return S.tasks.filter(t => {
    const g = group(t, now);
    if (S.view === 'hari'      && !(t.due === td && !t.done))          return false;
    if (S.view === 'terlambat' && g !== 'terlambat')                   return false;
    if (S.view === 'selesai'   && !t.done)                             return false;
    if (S.view === 'minggu'    && !(!t.done && t.due >= ws && t.due <= we)) return false;
    if (S.cat && t.cat !== S.cat)                                      return false;
    if (S.q && !`${t.title} ${t.note || ''}`.toLowerCase().includes(S.q)) return false;
    return true;
  }).sort(cmp);
}


/* ── Render helpers ── */
function row(t) {
  const late = group(t) === 'terlambat';
  return `<li class="task${t.done ? ' is-done' : ''}" data-id="${t.id}">
  <button class="chk" data-act="toggle"
    aria-label="${t.done ? 'Buka kembali' : 'Tandai selesai'}: ${esc(t.title)}"
    title="${t.done ? 'Buka kembali' : 'Tandai selesai'}">${ic('check')}</button>
  <div>
    <p class="ttl">${esc(t.title)}</p>
    <p class="meta">
      <span>${late ? ic('alert', 's') + 'Terlambat, ' : ic('clock', 's')}${dueText(t)}</span>
      ${t.cat ? `<span>${ic('tag', 's')}${esc(t.cat)}</span>` : ''}
    </p>
  </div>
  <div class="tact">
    <button class="ib" data-act="edit"  aria-label="Edit tugas: ${esc(t.title)}"  title="Edit tugas">${ic('edit')}</button>
    <button class="ib" data-act="del"   aria-label="Hapus tugas: ${esc(t.title)}" title="Hapus tugas">${ic('trash')}</button>
  </div></li>`;
}

const EMPTY = {
  ringkasan:  ['Belum ada tugas.',            'Tekan N untuk menambah tugas pertama.'],
  semua:      ['Belum ada tugas.',            'Tekan N untuk menambah tugas pertama.'],
  hari:       ['Belum ada tugas hari ini.',   'Tugas dengan tenggat hari ini muncul di sini.'],
  terlambat:  ['Tidak ada yang terlambat.',   'Tugas yang lewat tenggat muncul di sini.'],
  selesai:    ['Belum ada tugas selesai.',    'Tandai tugas selesai dan hasilnya terkumpul di sini.'],
  minggu:     ['Tidak ada tugas minggu ini.', 'Tugas bertenggat dalam pekan berjalan muncul di sini.']
};


/* ── Render: task list ── */
function renderList() {
  const items = visible(), el = $('#list');
  if (!items.length) {
    const [a, b] = S.q || S.cat
      ? ['Tidak ada tugas yang cocok.', 'Ubah kata kunci atau kategori.']
      : EMPTY[S.view];
    el.innerHTML = `<div class="empty"><p>${a}</p><p class="small">${b}</p></div>`;
    return;
  }

  if (S.lay === 'minggu') {
    const ws = wStart(new Date()), td = ymd(new Date());
    el.innerHTML = `<div class="week">${[0, 1, 2, 3, 4, 5, 6].map(i => {
      const d = addDays(ws, i), k = ymd(d);
      return `<div class="wd${k === td ? ' today' : ''}">
        <h3>${DAYS[d.getDay()]} ${d.getDate()}</h3>
        ${items.filter(t => t.due === k).map(t =>
          `<div class="wt" data-id="${t.id}">
            <button class="chk" data-act="toggle" style="width:24px;height:24px;margin:0"
              aria-label="${t.done ? 'Buka kembali' : 'Tandai selesai'}: ${esc(t.title)}">${ic('check', 's')}</button>
            <button data-act="edit" aria-label="Edit tugas: ${esc(t.title)}">
              ${esc(t.title)}${t.time ? `<br><span class="small">${t.time}</span>` : ''}
            </button>
          </div>`).join('')}
      </div>`;
    }).join('')}</div>
    <p class="small" style="margin-top:12px">Tugas tanpa tenggat tidak tampil di tampilan minggu.</p>`;
    return;
  }

  const now = new Date(), by = {};
  items.forEach(t => (by[group(t, now)] ??= []).push(t));
  el.innerHTML = ['terlambat', 'hari', 'besok', 'nanti', 'selesai']
    .filter(g => by[g])
    .map(g =>
      `<section class="grp${g === 'terlambat' ? ' g-late' : ''}">
        <div class="grp-h">
          <h3>${g === 'terlambat' ? ic('alert') : ''}${GL[g]}</h3>
          <span>${by[g].length} tugas</span>
        </div>
        <ul class="${S.lay === 'kartu' ? 'cards' : ''}">${by[g].map(row).join('')}</ul>
      </section>`)
    .join('');
}


/* ── Render: stats & top area ── */
function stats() {
  const now = new Date(), td = ymd(now),
        ws  = wStart(now), we = ymd(addDays(ws, 6)), wss = ymd(ws);
  const open = S.tasks.filter(t => !t.done);
  return {
    late:  open.filter(t => group(t, now) === 'terlambat').length,
    today: open.filter(t => t.due === td).length,
    week:  open.filter(t => t.due >= wss && t.due <= we).length,
    done:  S.tasks.filter(t => t.done && t.doneAt >= ws.getTime()).length
  };
}

function countUp(el, n) {
  if (!S.first || n === 0 || matchMedia('(prefers-reduced-motion:reduce)').matches) {
    el.textContent = n; return;
  }
  const t0 = performance.now();
  (function f(t) {
    const p = Math.min((t - t0) / 600, 1);
    el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(f);
  })(t0);
}

function renderTop() {
  const now = new Date(), s = stats();
  $('#hero').innerHTML = `
    <div>
      <p class="cap">${DAYS[now.getDay()]}</p>
      <h1 class="date">${now.getDate()} ${MON[now.getMonth()]} ${now.getFullYear()}</h1>
      <p>${s.today} tugas hari ini, ${s.late} terlambat${s.late ? '' : '. Tidak ada yang terlambat.'}</p>
    </div>
    <div class="late">
      <span class="late-n${s.late ? '' : ' zero'}" id="ln" aria-hidden="true">${s.late}</span>
      <span class="late-l">${ic('alert')}Terlambat: ${s.late}</span>
    </div>`;
  countUp($('#ln'), s.late);

  $('#sum').innerHTML = [
    ['hari',    s.today, 'Hari ini'],
    ['minggu',  s.week,  'Minggu ini'],
    ['selesai', s.done,  'Selesai minggu ini']
  ].map(([v, n, l]) => `<button data-go="${v}"><b>${n}</b><span>${l}</span></button>`).join('');

  if (S.first) $$('#sum b').forEach((b, i) => countUp(b, [s.today, s.week, s.done][i]));

  const f = S.tasks
    .filter(t => !t.done && t.due && ['terlambat', 'hari'].includes(group(t)))
    .sort(cmp).slice(0, 3);
  $('#focus').innerHTML = `
    <div class="sec-h"><h2 id="fh">Fokus sekarang</h2></div>
    ${f.length
      ? `<ul class="focus">${f.map(t =>
          `<li class="fi" data-id="${t.id}">
            <div>
              <p class="ttl">${esc(t.title)}</p>
              <p class="meta"><span>${group(t) === 'terlambat' ? ic('alert', 's') + 'Terlambat, ' : ic('clock', 's')}${dueText(t)}</span></p>
            </div>
            <button class="btn pri" data-act="toggle" aria-label="Tandai selesai: ${esc(t.title)}">${ic('check')}Selesai</button>
          </li>`).join('')}</ul>`
      : `<div class="empty" style="padding:24px 0;border-top:1px solid var(--line)">
           <p>Tidak ada tugas mendesak.</p>
           <p class="small">Tugas terlambat dan bertenggat hari ini tampil di sini.</p>
         </div>`}`;
}


/* ── Render: chrome (nav, cats, filters) ── */
function renderChrome() {
  const s = stats();
  const nav = [
    ['ringkasan', 'Ringkasan',    'summary'],
    ['semua',     'Semua tugas',  'list'],
    ['hari',      'Hari ini',     'calendar', s.today],
    ['terlambat', 'Terlambat',    'alert',    s.late],
    ['selesai',   'Selesai',      'check']
  ];

  $('#nav').innerHTML = nav.map(([v, l, i, c]) =>
    `<a href="#${v}" data-nav="${v}" title="${l}" ${S.view === v ? 'aria-current="page"' : ''}>
      ${ic(i)}<span class="lbl">${l}</span>
      ${c != null ? `<span class="cnt">${c}</span>` : ''}
    </a>`).join('');

  $('#bnav').innerHTML = [nav[0], nav[2], nav[3], nav[1]].map(([v, l, i]) =>
    `<a href="#${v}" data-nav="${v}" ${S.view === v ? 'aria-current="page"' : ''}>${ic(i)}${l}</a>`).join('');

  const cats = [...new Set(S.tasks.map(t => t.cat).filter(Boolean))].sort();
  $('#cats').innerHTML = cats.length
    ? `<p class="cap">Kategori</p>` + cats.map(c =>
        `<button data-cat="${esc(c)}" aria-pressed="${S.cat === c}">
          ${ic('tag')}<span class="lbl">${esc(c)}</span>
          <span class="cnt">${S.tasks.filter(t => t.cat === c && !t.done).length}</span>
        </button>`).join('')
    : '';

  $('#fcat').innerHTML = `<option value="">Semua kategori</option>` +
    cats.map(c => `<option${S.cat === c ? ' selected' : ''}>${esc(c)}</option>`).join('');
  $('#cl').innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');

  const full = ['ringkasan'].includes(S.view);
  ['#hero', '#sum', '#focus'].forEach(i => $(i).hidden = !full);
  $('#lh').textContent = {
    ringkasan: 'Semua tugas', semua: 'Semua tugas', hari: 'Hari ini',
    terlambat: 'Terlambat',   selesai: 'Selesai',   minggu: 'Minggu ini'
  }[S.view];
}


/* ── Render: right aside (mini calendar) ── */
function renderSide() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const first = new Date(y, m, 1), off = (first.getDay() + 6) % 7;
  const n = new Date(y, m + 1, 0).getDate();
  const has = new Set(S.tasks.filter(t => !t.done && t.due).map(t => t.due));

  $('#mh').textContent = `${MON[m]} ${y}`;
  $('#cal').innerHTML =
    ['S', 'S', 'R', 'K', 'J', 'S', 'M'].map(d => `<span class="wh">${d}</span>`).join('') +
    Array(off).fill('<span></span>').join('') +
    Array.from({ length: n }, (_, i) => {
      const k = `${y}-${pad(m + 1)}-${pad(i + 1)}`;
      return `<span class="d${has.has(k) ? ' has' : ''}${i + 1 === now.getDate() ? ' today' : ''}"><span>${i + 1}</span></span>`;
    }).join('');

  const up = S.tasks
    .filter(t => !t.done && t.due && t.time && group(t) !== 'terlambat')
    .sort(cmp).slice(0, 3);
  $('#up').innerHTML = up.length
    ? up.map(t => `<li><p class="ttl">${esc(t.title)}</p><p class="meta"><span>${ic('bell', 's')}${dueText(t)}</span></p></li>`).join('')
    : '<li class="small">Belum ada pengingat. Tambahkan jam pada tugas untuk menerimanya.</li>';
}

function render() { renderChrome(); renderTop(); renderList(); renderSide(); S.first = false; }


/* ── Dialog ── */
const dlg = $('#dlg'), F = $('#f');

function chipDue() { return F.dd.value; }

function openDlg(t) {
  S.edit = t ? t.id : null;
  F.reset();
  $('#more').hidden  = true;
  $('#dwrap').hidden = true;
  $('#dt').textContent = t ? 'Edit tugas' : 'Tugas baru';

  if (t) {
    F.ti.value = t.title;
    F.tm.value = t.time  || '';
    F.ct.value = t.cat   || '';
    F.nt.value = t.note  || '';
    const now = new Date();
    F.dd.value = !t.due ? 'none'
      : t.due === ymd(now)             ? 'hari'
      : t.due === ymd(addDays(now, 1)) ? 'besok'
      : 'pilih';
    if (F.dd.value === 'pilih') { F.dv.value = t.due; $('#dwrap').hidden = false; }
    if (t.cat || t.note) $('#more').hidden = false;
  }
  dlg.showModal();
  $('#ti').focus();
}

F.addEventListener('change', e => {
  if (e.target.name === 'dd') $('#dwrap').hidden = chipDue() !== 'pilih';
});

$('#tmore').onclick = () => { $('#more').hidden = !$('#more').hidden; };

F.addEventListener('submit', e => {
  e.preventDefault();
  const title = F.ti.value.trim();
  if (!title) { F.ti.focus(); return; }

  const now = new Date(), k = chipDue();
  let due = '';
  if      (k === 'hari')  due = ymd(now);
  else if (k === 'besok') due = ymd(addDays(now, 1));
  else if (k === 'akhir') due = ymd(addDays(now, (6 - now.getDay() + 7) % 7));
  else if (k === 'pilih') due = F.dv.value || ymd(now);

  const time = F.tm.value;
  if (time && !due) due = ymd(now);

  const data  = { title, due, time, cat: F.ct.value.trim(), note: F.nt.value.trim() };
  const probe = { ...data, done: false };
  data.notified = !!time && group(probe) === 'terlambat';

  if (S.edit) {
    Object.assign(S.tasks.find(t => t.id === S.edit), data);
  } else {
    S.tasks.push({ id: Date.now(), done: false, doneAt: 0, ...data });
  }

  save(); dlg.close(); render();
  if (time && !S.edit) askNotif();
});


/* ── Reminders / notifications ── */
function banner(msg, actions = '') {
  const b = document.createElement('div');
  b.className = 'banner';
  b.innerHTML = `${ic('bell')}<p>${esc(msg)}</p>${actions}<button class="ib" aria-label="Tutup pengingat" title="Tutup pengingat">${ic('x')}</button>`;
  b.querySelector('.ib:last-child').onclick = () => b.remove();
  $('#banners').prepend(b);
  return b;
}

function askNotif() {
  if (S.asked || !('Notification' in window) || Notification.permission !== 'default') return;
  S.asked = true;
  const b = banner(
    'Izinkan notifikasi agar pengingat jam muncul walau tab ini tidak sedang dibuka.',
    '<button class="btn" data-ask>Izinkan pengingat</button>'
  );
  b.querySelector('[data-ask]').onclick = () => {
    try { Notification.requestPermission(); } catch (e) { /* peramban lama */ }
    b.remove();
  };
}

function tick() {
  const now = new Date(), td = ymd(now), cur = hm(now);
  let ch = false;
  S.tasks.forEach(t => {
    if (!t.done && !t.notified && t.due === td && t.time && t.time <= cur) {
      t.notified = true; ch = true;
      banner(`Saatnya: ${t.title}, jam ${t.time}`);
      try {
        if (Notification.permission === 'granted')
          new Notification('Pengingat tugas', { body: `${t.title}, jam ${t.time}` });
      } catch (e) { /* notifikasi tidak tersedia di konteks ini */ }
    }
  });
  if (ch) save();
  render();
}


/* ── Delete with undo ── */
let undoT, removed = null;

function del(id) {
  const i = S.tasks.findIndex(t => t.id === id);
  if (i < 0) return;
  removed = { t: S.tasks[i], i };
  S.tasks.splice(i, 1);
  save(); render();
  $('#toast-t').textContent = `Tugas dihapus: ${removed.t.title}`;
  $('#toast').hidden = false;
  clearTimeout(undoT);
  undoT = setTimeout(() => { $('#toast').hidden = true; removed = null; }, 5000);
}

$('#undo').onclick = () => {
  if (!removed) return;
  S.tasks.splice(removed.i, 0, removed.t);
  removed = null;
  save(); render();
  $('#toast').hidden = true;
  clearTimeout(undoT);
};


/* ── Event delegation ── */
document.addEventListener('click', e => {
  const a  = e.target.closest('[data-act]');
  const li = e.target.closest('[data-id]');

  if (a) {
    const id = li && +li.dataset.id;
    const t  = id && S.tasks.find(x => x.id === id);

    if      (a.dataset.act === 'new')                  openDlg();
    else if (a.dataset.act === 'help')                 $('#help').showModal();
    else if (a.dataset.act === 'close')                a.closest('dialog').close();
    else if (a.dataset.act === 'toggle' && t)          { t.done = !t.done; t.doneAt = t.done ? Date.now() : 0; save(); render(); }
    else if (a.dataset.act === 'edit'   && t)          openDlg(t);
    else if (a.dataset.act === 'del'    && t)          del(id);
    return;
  }

  const go = e.target.closest('[data-go]');
  if (go) { S.view = go.dataset.go; location.hash = go.dataset.go; render(); $('#lh').scrollIntoView({ behavior: 'smooth' }); return; }

  const c = e.target.closest('[data-cat]');
  if (c) { S.cat = S.cat === c.dataset.cat ? '' : c.dataset.cat; render(); return; }

  const l = e.target.closest('[data-lay]');
  if (l) { S.lay = l.dataset.lay; $$('[data-lay]').forEach(b => b.setAttribute('aria-pressed', b === l)); renderList(); }
});

addEventListener('hashchange', () => {
  const v = location.hash.slice(1);
  if (['ringkasan', 'semua', 'hari', 'terlambat', 'selesai'].includes(v)) { S.view = v; render(); }
});

$('#q').addEventListener('input',  e => { S.q    = e.target.value.trim().toLowerCase(); renderList(); });
$('#fcat').addEventListener('change', e => { S.cat  = e.target.value; render(); });
$('#sort').addEventListener('change', e => { S.sort = e.target.value; renderList(); });

$('#collapse').onclick = () => {
  document.body.classList.toggle('rail');
  $('#collapse').setAttribute('aria-label',
    document.body.classList.contains('rail') ? 'Lebarkan sidebar' : 'Ciutkan sidebar'
  );
};

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (document.querySelector('dialog[open]')) return;

  if      (e.key === 'n' || e.key === 'N') { e.preventDefault(); openDlg(); }
  else if (e.key === '/')                   { e.preventDefault(); $('#q').focus(); }
  else if (e.key === '?')                   { $('#help').showModal(); }
});


/* ── Theme ── */
function setTheme(t, persist) {
  document.documentElement.dataset.theme = t;
  $('#theme use').setAttribute('href', t === 'dark' ? '#i-sun' : '#i-moon');
  if (persist) try { localStorage.setItem(THEME, t); } catch (e) { /* tema tetap berlaku di sesi ini */ }
}

$('#theme').onclick = () =>
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);

let th = null;
try { th = localStorage.getItem(THEME); } catch (e) { /* pakai preferensi sistem */ }
setTheme(th || (matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark'));


/* ── Init ── */
load();
{ const v = location.hash.slice(1); if (['ringkasan', 'semua', 'hari', 'terlambat', 'selesai'].includes(v)) S.view = v; }
render();
setInterval(tick, 30000);
