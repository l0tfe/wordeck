'use strict';
(function () {
  // ---------------------------------------------------------------- constants
  const KEY = 'wordeck.v1';
  const MIN = 60e3, H = 60 * MIN, DAY = 24 * H;
  // first review 4 h after training, then 1, 3, 7, 21, 60 days; after the 6th successful review the word is learned
  const INTERVALS = [4 * H, DAY, 3 * DAY, 7 * DAY, 21 * DAY, 60 * DAY];
  const OX_AUDIO = 'https://www.oxfordlearnersdictionaries.com/media/english/';
  const POS_RU = { n: 'сущ.', v: 'гл.', adj: 'прил.', adv: 'нареч.', pron: 'мест.', prep: 'предлог', det: 'определитель', num: 'числ.', conj: 'союз', excl: 'межд.', mod: 'модальный гл.', art: 'артикль', part: 'частица' };
  const FUNC_POS = new Set(['art', 'pron', 'prep', 'det', 'conj', 'mod', 'part']);
  const TOPICS = [['f', 'Еда и напитки'], ['a', 'Животные'], ['n', 'Природа и погода'], ['b', 'Тело и здоровье'], ['h', 'Дом и быт'], ['c', 'Одежда и внешность'], ['p', 'Люди и семья'], ['m', 'Чувства и характер'], ['t', 'Путешествия и транспорт'], ['l', 'Город и места'], ['w', 'Работа и бизнес'], ['$', 'Деньги и покупки'], ['e', 'Учёба и наука'], ['i', 'Технологии'], ['r', 'Искусство и медиа'], ['s', 'Спорт и досуг'], ['g', 'Общество и право'], ['d', 'Время и числа']];
  const LEVELS = [['A1', 'Начальный'], ['A2', 'Элементарный'], ['B1', 'Средний'], ['B2', 'Выше среднего'], ['C1', 'Продвинутый']];
  const CR = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };
  const DEF_SET = { theme: 'system', voice: 'uk', ttsVoice: '', rate: 1, autoplay: true, showRu: true, goal: 10, batch: 5, images: 'all' };

  const I = {
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    spk: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15"/><path d="M4 20v-5h5"/></svg>'
  };

  // ---------------------------------------------------------------- data
  const W = (window.WORDS || []).map((r, i) => ({ i, w: r[0], ru: r[1], pos: r[2] ? r[2].split(',') : [], cefr: r[3], ipa: r[4], def: r[5], ex: r[6], topic: r[7], ngsl: r[8], ox: r[9], uk: r[10], us: r[11], emoji: r[12] || '', photo: r[13] || '' }));
  const BY = new Map(W.map(x => [x.w, x]));
  const byFreq = (a, b) => (a.ngsl || 9999) - (b.ngsl || 9999) || (CR[a.cefr] || 9) - (CR[b.cefr] || 9) || a.w.localeCompare(b.w);
  const byLevel = (a, b) => (CR[a.cefr] || 9) - (CR[b.cefr] || 9) || (a.ngsl || 9999) - (b.ngsl || 9999) || a.w.localeCompare(b.w);
  const SECTIONS = [], SEC = new Map();
  function addSec(group, id, name, sub, filter, sort) {
    const s = { group, id, name, sub, list: W.filter(filter).sort(sort) };
    SECTIONS.push(s); SEC.set(id, s);
  }
  addSec('Словари', 'ngsl', 'New General Service List', '2 800 самых частых слов английского', x => x.ngsl > 0, byFreq);
  addSec('Словари', 'ox3', 'Oxford 3000', 'Ключевые слова уровней A1-B2', x => x.ox === 3, byLevel);
  addSec('Словари', 'ox5', 'Oxford 5000', 'Ещё 2 000 слов уровней B2-C1', x => x.ox === 5, byLevel);
  [[1, 500], [501, 1000], [1001, 1500], [1501, 2000], [2001, 2500], [2501, 2809]].forEach(([a, b], k) =>
    addSec('NGSL по частоте', 'ng' + (k + 1), 'Слова ' + a + '-' + b, k === 0 ? 'Самые нужные слова' : 'По частоте употребления', x => x.ngsl >= a && x.ngsl <= b, byFreq));
  LEVELS.forEach(([L, d]) => addSec('Oxford по уровням', 'lv' + L, 'Уровень ' + L, d, x => x.ox && x.cefr === L, byFreq));
  TOPICS.forEach(([c, n]) => addSec('Темы', 't' + c, n, '', x => x.topic === c, byFreq));
  const GROUPS = [...new Set(SECTIONS.map(s => s.group))];

  // ---------------------------------------------------------------- state
  function load() {
    try {
      const j = JSON.parse(localStorage.getItem(KEY));
      if (j && typeof j === 'object') { const set = Object.assign({}, DEF_SET, j.set || {}); if (set.images === true) set.images = 'all'; if (set.images === false) set.images = 'off'; delete set.order; return { words: j.words || {}, days: j.days || {}, sel: (j.sel || []).filter(id => SEC.has(id)), set }; }
    } catch (e) { /* storage unavailable */ }
    return { words: {}, days: {}, sel: [], set: Object.assign({}, DEF_SET) };
  }
  let S = load();
  if (!S.sel.length) S.sel = ['ox3'];
  let saveT = 0;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 400); }
  const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function day(k = dayKey()) { return S.days[k] || (S.days[k] = { n: 0, k: 0, r: 0, d: 0, s: 0 }); }
  const peekDay = k => S.days[k] || { n: 0, k: 0, r: 0, d: 0, s: 0 };

  // ---------------------------------------------------------------- helpers
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function pl(n, a, b, c) { const m = Math.abs(n) % 100, m1 = m % 10; if (m > 10 && m < 20) return c; if (m1 > 1 && m1 < 5) return b; if (m1 === 1) return a; return c; }
  const words = n => n + ' ' + pl(n, 'слово', 'слова', 'слов');
  const fmtN = n => n.toLocaleString('ru-RU');
  const fmtRate = v => String(+v.toFixed(2)).replace('.', ',') + '×';
  function fmtTime(sec) {
    if (sec < 60) return sec + ' с';
    const m = Math.round(sec / 60);
    if (m < 60) return m + ' мин';
    return Math.floor(m / 60) + ' ч ' + String(m % 60).padStart(2, '0') + ' мин';
  }
  function relTime(ts) {
    const d = ts - Date.now();
    if (d <= 0) return 'сейчас';
    if (d < H) return 'через ' + Math.max(1, Math.round(d / MIN)) + ' мин';
    if (d < DAY) return 'через ' + Math.round(d / H) + ' ч';
    const n = Math.round(d / DAY); return 'через ' + n + ' ' + pl(n, 'день', 'дня', 'дней');
  }
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  const posLabel = x => x.pos.map(p => POS_RU[p] || p).join(', ');
  const status = w => S.words[w] ? S.words[w].s : '';

  function counts() {
    const c = { k: 0, n: 0, l: 0, d: 0 };
    for (const w in S.words) { const s = S.words[w].s; if (c[s] !== undefined && BY.has(w)) c[s]++; }
    return c;
  }
  const dueList = (now = Date.now()) => Object.keys(S.words).filter(w => S.words[w].s === 'l' && S.words[w].due <= now && BY.has(w)).map(w => BY.get(w));
  function nextDue() { let m = Infinity; for (const w in S.words) { const v = S.words[w]; if (v.s === 'l' && v.due < m) m = v.due; } return m; }
  const pendingList = () => Object.keys(S.words).filter(w => S.words[w].s === 'n' && BY.has(w)).sort((a, b) => S.words[a].t - S.words[b].t).map(w => BY.get(w));

  function buildQueue(limit, exclude) {
    const ex = exclude || new Set();
    const lists = S.sel.map(id => SEC.get(id)).filter(Boolean).map(s => s.list);
    const seen = new Set(), out = [];
    const ok = x => !S.words[x.w] && !seen.has(x.w) && !ex.has(x.w);
    // new words always come in random order from all selected sections
    for (const l of lists) for (const x of l) if (ok(x)) { seen.add(x.w); out.push(x); }
    return shuffle(out).slice(0, limit);
  }

  // ---------------------------------------------------------------- audio
  const audio = new Audio();
  audio.preload = 'auto';
  let voices = [];
  function loadVoices() { try { voices = speechSynthesis.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang)); } catch (e) { voices = []; } }
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.addEventListener('voiceschanged', () => { loadVoices(); if (tab === 'settings') renderSettings(); }); }
  function tts(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = voices.find(v => v.voiceURI === S.set.ttsVoice) || voices.find(v => /en[-_]GB/i.test(v.lang)) || voices[0];
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
      u.rate = S.set.rate * 0.95;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  function speak(x, text) {
    if (!x && !text) return;
    if (text) { tts(text); return; }
    const pref = S.set.voice;
    if (pref !== 'tts') {
      const useUs = pref === 'us' ? !!x.us : !x.uk;
      const path = useUs ? x.us : x.uk;
      if (path) {
        try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
        audio.src = OX_AUDIO + (useUs ? 'us_pron/' : 'uk_pron/') + path + '.mp3';
        audio.playbackRate = S.set.rate;
        const p = audio.play();
        if (p && p.catch) p.catch(err => { if (!err || err.name !== 'NotAllowedError') tts(x.w); });
        return;
      }
    }
    tts(x.w);
  }

  // ---------------------------------------------------------------- pictures
  // photo: hand-checked Wikimedia Commons image; emoji: hand-picked; otherwise a type-only card
  const photoURL = f => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(f.replace(/ /g, '_')) + '?width=800';
  function hashW(w) { let h = 7; for (let i = 0; i < w.length; i++) h = (h * 31 + w.charCodeAt(i)) | 0; return Math.abs(h); }
  function mediaKind(x) {
    const m = S.set.images;
    if (m === 'off') return 'type';
    if (m === 'all' && x.photo) return 'photo';
    if (x.emoji) return 'emoji';
    return 'type';
  }
  function typeSize(w) { return Math.max(34, Math.min(92, Math.floor(560 / Math.max(4, w.length)))); }
  function mediaHTML(x, kind) {
    kind = kind || mediaKind(x);
    const both = S.set.images === 'all' && x.photo && x.emoji;
    const attrs = ' data-media="' + esc(x.w) + '" data-kind="' + kind + '"' + (both ? ' data-both="1"' : '');
    if (kind === 'photo') return '<div class="media photo g' + (hashW(x.w) % 8) + '"' + attrs + '><span class="emo-ch ph-fallback">' + (x.emoji || '') + '</span><img class="ph" alt="" draggable="false" referrerpolicy="no-referrer" src="' + esc(photoURL(x.photo)) + '"></div>';
    if (kind === 'emoji') return '<div class="media emoji g' + (hashW(x.w) % 8) + '"' + attrs + '><span class="emo-ch">' + x.emoji + '</span></div>';
    return '<div class="media type v' + (hashW(x.w) % 6) + '"' + attrs + '><span class="type-w" style="font-size:' + typeSize(x.w) + 'px">' + esc(x.w) + '</span></div>';
  }
  function bindMedia(root) {
    $$('img.ph', root).forEach(img => {
      const box = img.closest('.media');
      const ok = () => box.classList.add('loaded');
      if (img.complete && img.naturalWidth) ok(); else img.addEventListener('load', ok, { once: true });
      img.addEventListener('error', () => {
        const x = BY.get(box.dataset.media); if (!x || !box.isConnected) return;
        const t = document.createElement('div'); t.innerHTML = mediaHTML(x, x.emoji ? 'emoji' : 'type');
        const nb = t.firstChild; nb.removeAttribute('data-both'); box.replaceWith(nb);
      }, { once: true });
    });
  }
  function toggleMedia(box) {
    if (!box || !box.dataset.both) return;
    const x = BY.get(box.dataset.media); if (!x) return;
    const t = document.createElement('div'); t.innerHTML = mediaHTML(x, box.dataset.kind === 'photo' ? 'emoji' : 'photo');
    const nb = t.firstChild; box.replaceWith(nb); bindMedia(nb.parentNode);
  }
  function prefetch(list) { list.forEach(x => { if (x && mediaKind(x) === 'photo') { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.src = photoURL(x.photo); } }); }

  // ---------------------------------------------------------------- theme
  function applyTheme() {
    const t = S.set.theme, root = document.documentElement;
    if (t === 'light' || t === 'dark') root.dataset.theme = t; else root.removeAttribute('data-theme');
    const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    $$('meta[name="theme-color"]').forEach(m => { m.setAttribute('content', dark ? '#000000' : '#F5F5F7'); m.removeAttribute('media'); });
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  // ---------------------------------------------------------------- tabs
  let tab = 'home';
  function showTab(name) {
    tab = name;
    $$('.tab').forEach(b => { if (b.dataset.tab === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    ['home', 'dict', 'settings'].forEach(v => { $('#view-' + v).hidden = v !== name; });
    if (name === 'home') renderHome(); else if (name === 'dict') renderDict(); else renderSettings();
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- home
  function streak() {
    let n = 0; const d = new Date();
    const active = k => { const v = S.days[k]; return v && (v.n + v.r + v.k) > 0; };
    if (!active(dayKey(d))) d.setDate(d.getDate() - 1);
    while (active(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return { n, today: active(dayKey()) };
  }
  function selLabel() {
    const names = S.sel.map(id => SEC.get(id) && SEC.get(id).name).filter(Boolean);
    if (names.length <= 2) return names.join(', ');
    return names.slice(0, 2).join(', ') + ' +' + (names.length - 2);
  }
  function renderHome() {
    const c = counts(), t = peekDay(dayKey()), due = dueList().length, pend = pendingList().length;
    const goal = S.set.goal, nd = nextDue(), st = streak();
    let totalSec = 0, totalRev = 0, weekSec = 0;
    const now = new Date(), weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 6);
    const wk = dayKey(weekAgo);
    for (const k in S.days) { const v = S.days[k]; totalSec += v.s || 0; totalRev += v.r || 0; if (k >= wk) weekSec += v.s || 0; }
    const R = 40, C = 2 * Math.PI * R, frac = Math.min(1, t.n / goal);
    const ds = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }), dateStr = ds.charAt(0).toUpperCase() + ds.slice(1);
    const newLeft = buildQueue(1).length;
    const learnSub = pend ? words(pend) + ' ' + pl(pend, 'ждёт', 'ждут', 'ждут') + ' тренировки' : newLeft ? 'Сегодня ' + t.n + ' из ' + goal + ' новых слов' : 'Отметьте другие разделы в словаре.';
    const reviewSub = due ? words(due) + ' на повторение' : nd < Infinity ? 'Следующее повторение ' + relTime(nd) : 'Пока нечего повторять';

    const firstName = (SEC.get(S.sel[0]) || {}).name || '';
    const art = ['📚', '✈️', '🍎'];
    $('#view-home').innerHTML = installHTML() +
      '<header class="page-head"><div class="eyebrow">' + esc(dateStr) + '</div><h1 class="large">Сегодня</h1></header>' +
      '<button class="hero" data-act="learn">' +
        '<span class="hero-eyebrow">Новые слова</span>' +
        '<span class="hero-title">' + (pend ? 'Пора<br>тренироваться.' : newLeft ? 'Учите новое.<br>Каждый день.' : 'Всё пройдено.') + '</span>' +
        '<span class="hero-sub">' + esc(learnSub) + '</span>' +
        '<span class="pill pill-light">' + (pend ? 'Тренировать' : 'Начать') + I.arrow + '</span>' +
        '<span class="hero-art" aria-hidden="true">' + art.map(e => '<i>' + e + '</i>').join('') + '</span>' +
      '</button>' +
      '<div class="duo">' +
        '<button class="card-btn' + (due ? '' : ' idle') + '" data-act="review"><span class="t-eyebrow">Повторение</span><span class="t-num">' + (due > 999 ? '999+' : due) + '</span>' +
          '<span class="t-sub">' + esc(due ? pl(due, 'слово ждёт', 'слова ждут', 'слов ждут') : (nd < Infinity ? 'Следующее ' + relTime(nd) : 'Пока нечего повторять')) + '</span>' +
          (due ? '<span class="pill pill-blue">Повторить</span>' : '') + '</button>' +
        '<button class="card-btn src" data-act="pick"><span class="t-eyebrow">Учу из</span><span class="t-val">' + esc(selLabel()) + '</span><span class="t-sub">Разделы' + I.chev + '</span></button>' +
      '</div>' +
      '<h2 class="section-h">Активность</h2>' +
      '<div class="panel goal">' +
        '<svg class="ring" viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5AC8FA"/><stop offset="1" stop-color="#0A84FF"/></linearGradient></defs>' +
          '<circle class="bgc" cx="48" cy="48" r="' + R + '"/><circle class="fg" cx="48" cy="48" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - frac)).toFixed(1) + '" transform="rotate(-90 48 48)"/></svg>' +
        '<div class="goal-txt"><span class="lbl">Цель дня</span><span class="big">' + t.n + '<small> / ' + goal + ' слов</small></span>' +
        '<span class="sub">' + (st.n ? '🔥 ' + st.n + ' ' + pl(st.n, 'день', 'дня', 'дней') + ' подряд' : 'Начните серию сегодня') + (t.r ? ' · повторено ' + t.r : '') + '</span></div>' +
      '</div>' +
      '<div class="tiles">' +
        '<div class="tile"><span class="lbl l-blue"><i></i>Изучаю</span><b>' + fmtN(c.l + c.n) + '<small>сл.</small></b></div>' +
        '<div class="tile"><span class="lbl l-green"><i></i>Выучено</span><b>' + fmtN(c.d) + '<small>сл.</small></b></div>' +
        '<div class="tile"><span class="lbl l-orange"><i></i>Уже знал</span><b>' + fmtN(c.k) + '<small>сл.</small></b></div>' +
        '<div class="tile"><span class="lbl l-purple"><i></i>Повторений</span><b>' + fmtN(totalRev) + '</b></div>' +
      '</div>' +
      '<div class="panel"><div class="panel-h"><b>Время занятий</b></div><div class="times">' +
        '<div><b>' + fmtTime(t.s) + '</b><span>Сегодня</span></div>' +
        '<div><b>' + fmtTime(weekSec) + '</b><span>За 7 дней</span></div>' +
        '<div><b>' + fmtTime(totalSec) + '</b><span>Всего</span></div>' +
      '</div></div>' +
      '<div class="panel"><div class="panel-h"><b>14 дней</b><small>новые и повторения</small></div><div class="chart" id="chart">' + chartSVG() + '</div></div>' +
      '<div class="panel"><div class="panel-h"><b>Уровни Oxford</b></div>' + levelsHTML() + '</div>' +
      '<div class="panel"><div class="panel-h"><b>Выбранные разделы</b></div><div class="sp-rows">' + S.sel.map(id => {
        const s = SEC.get(id); if (!s) return '';
        const done = s.list.reduce((a, x) => a + (S.words[x.w] ? 1 : 0), 0);
        return '<div class="sp-row"><div><span>' + esc(s.name) + '</span><em>' + fmtN(done) + ' / ' + fmtN(s.list.length) + '</em></div><div class="pbar"><i style="width:' + (100 * done / Math.max(1, s.list.length)).toFixed(1) + '%"></i></div></div>';
      }).join('') + '</div></div>';
    bindChart();
  }
  // hint for iPhone Safari: how to put the app on the home screen
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  function installHTML() {
    if (!isIOS || standalone || location.protocol === 'file:') return '';
    try { if (localStorage.getItem('wordeck.hint') === '0') return ''; } catch (e) { /* ignore */ }
    return '<div class="install"><img src="apple-touch-icon.png" alt=""><div><b>Установите Wordeck как приложение</b>' +
      'Нажмите <svg class="shr" viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg> «Поделиться» в Safari, затем «На экран \u00abДомой\u00bb».</div>' +
      '<button class="x" data-act="hide-install" aria-label="Скрыть">' + I.close + '</button></div>';
  }
  function chartSVG() {
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = dayKey(d); const v = peekDay(k); days.push({ k, d, n: v.n, r: v.r, s: v.s, v: v.n + v.r }); }
    const max = Math.max(5, ...days.map(d => d.v));
    const top = Math.ceil(max / 5) * 5;
    const Wd = 320, Ht = 120, base = 100, gap = 6, bw = (Wd - 28 - gap * 13) / 14;
    let s = '<svg viewBox="0 0 ' + Wd + ' ' + Ht + '" role="img" aria-label="Активность за 14 дней">';
    s += '<line class="grid" x1="0" x2="' + (Wd - 28) + '" y1="' + base + '" y2="' + base + '"/>';
    s += '<line class="grid" x1="0" x2="' + (Wd - 28) + '" y1="10" y2="10" stroke-dasharray="2 3"/>';
    s += '<text class="ax" x="' + (Wd - 24) + '" y="13">' + top + '</text><text class="ax" x="' + (Wd - 24) + '" y="' + (base + 3) + '">0</text>';
    days.forEach((d, i) => {
      const x = i * (bw + gap), h = d.v ? Math.max(3, (base - 10) * d.v / top) : 0, y = base - h, r = Math.min(4, h, bw / 2);
      const path = h ? 'M' + x + ',' + base + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + bw - r) + 'Q' + (x + bw) + ',' + y + ' ' + (x + bw) + ',' + (y + r) + 'V' + base + 'Z' : '';
      s += '<g class="grp" data-i="' + i + '"><rect class="hit" x="' + (x - gap / 2) + '" y="0" width="' + (bw + gap) + '" height="' + (base + 18) + '"/>' +
        (h ? '<path class="bar' + (i === 13 ? ' today' : '') + '" d="' + path + '"/>' : '') + '</g>';
      if (i % 2 === 1 || i === 13) s += '<text class="ax" x="' + (x + bw / 2) + '" y="' + (base + 14) + '" text-anchor="middle">' + d.d.getDate() + '</text>';
    });
    s += '</svg><div class="tip" hidden></div>';
    chartSVG.days = days; chartSVG.geo = { Wd, bw, gap, base, top };
    return s;
  }
  function bindChart() {
    const box = $('#chart'); if (!box) return;
    const tip = $('.tip', box), svg = $('svg', box);
    const show = g => {
      const i = +g.dataset.i, d = chartSVG.days[i], geo = chartSVG.geo;
      $$('.grp', box).forEach(e => e.classList.toggle('on', e === g));
      const rect = svg.getBoundingClientRect(), k = rect.width / geo.Wd;
      const h = d.v ? Math.max(3, (geo.base - 10) * d.v / geo.top) : 0;
      tip.innerHTML = '<b>' + esc(d.d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })) + '</b>Новых: ' + d.n + ' · Повторений: ' + d.r + (d.s ? ' · ' + fmtTime(d.s) : '');
      tip.hidden = false;
      const cx = (i * (geo.bw + geo.gap) + geo.bw / 2) * k;
      tip.style.left = Math.min(Math.max(cx, 90), rect.width - 90) + 'px';
      tip.style.top = ((geo.base - h) * k - 6) + 'px';
    };
    $$('.grp', box).forEach(g => { g.addEventListener('pointerenter', () => show(g)); g.addEventListener('click', () => show(g)); });
    box.addEventListener('pointerleave', () => { tip.hidden = true; $$('.grp', box).forEach(e => e.classList.remove('on')); });
  }
  function levelsHTML() {
    const rows = LEVELS.map(([L]) => {
      const list = SEC.get('lv' + L).list; let d = 0, l = 0, k = 0;
      list.forEach(x => { const s = status(x.w); if (s === 'd') d++; else if (s === 'l' || s === 'n') l++; else if (s === 'k') k++; });
      const p = v => (100 * v / Math.max(1, list.length)).toFixed(2) + '%';
      const seg = [[d, 'c-done'], [l, 'c-learn'], [k, 'c-known']].filter(a => a[0] > 0).map(a => '<i class="' + a[1] + '" style="width:' + p(a[0]) + '"></i>').join('');
      return '<div class="lv-row" title="Выучено ' + d + ', изучаю ' + l + ', знал ' + k + '"><b>' + L + '</b><div class="sbar">' + seg + '</div><em>' + fmtN(d + l + k) + ' / ' + fmtN(list.length) + '</em></div>';
    }).join('');
    return '<div class="legend"><span><i class="c-done"></i>Выучено</span><span><i class="c-learn"></i>Изучаю</span><span><i class="c-known"></i>Уже знал</span></div><div class="lv-rows">' + rows + '</div>';
  }

  // ---------------------------------------------------------------- sections sheet
  let sheetMode = '';
  function openSheet(html, mode) {
    sheetMode = mode; const sh = $('#sheet'); $('.sheet', sh).innerHTML = html; sh.hidden = false;
    $('.sheet', sh).scrollTop = 0;
  }
  function closeSheet() { $('#sheet').hidden = true; sheetMode = ''; if (tab === 'home') renderHome(); else if (tab === 'dict') renderDictBody(); }
  function newCount() {
    const seen = new Set();
    S.sel.forEach(id => { const sc = SEC.get(id); if (sc) sc.list.forEach(x => { if (!S.words[x.w]) seen.add(x.w); }); });
    return seen.size;
  }
  function toggleSec(id) {
    if (S.sel.includes(id)) {
      if (S.sel.length === 1) { toast('Нужен хотя бы один раздел'); return; }
      S.sel = S.sel.filter(x => x !== id);
    } else S.sel.push(id);
    save();
  }

  // ---------------------------------------------------------------- dictionary
  const D = { sec: null, filter: 'all', q: '', limit: 120 };
  const FILTERS = [['all', 'Все'], ['new', 'Новые'], ['l', 'Изучаю'], ['d', 'Выучено'], ['k', 'Знаю']];
  function renderDict() {
    const v = $('#view-dict');
    if (D.sec) {
      const s = SEC.get(D.sec);
      v.innerHTML = '<div class="sec-head"><button class="back" data-act="dict-back" aria-label="Назад">' + I.back + '</button><div style="min-width:0"><h1>' + esc(s.name) + '</h1><div class="sec-sub">' + esc(s.sub ? s.sub + ' · ' : '') + words(s.list.length) + '</div></div></div>' +
        '<div id="sec-toggle"></div>' +
        '<div class="chips">' + FILTERS.map(([k, n]) => '<button class="chip" data-filter="' + k + '" aria-pressed="' + (D.filter === k) + '">' + n + '</button>').join('') + '</div>' +
        '<div id="dict-body"></div>';
    } else {
      v.innerHTML = '<header class="page-head"><div class="row"><h1 class="large">Словарь</h1><span class="cnt">' + fmtN(W.length) + ' слов</span></div></header>' +
        '<div class="search">' + I.search + '<input id="dict-q" type="search" placeholder="Поиск" autocomplete="off" value="' + esc(D.q) + '"></div>' +
        '<div id="dict-body"></div>';
    }
    renderDictBody();
  }
  function wordRow(x) {
    const s = status(x.w);
    return '<button class="wrow" data-word="' + esc(x.w) + '"><span class="dot ' + s + '"></span><span style="min-width:0"><span class="w">' + esc(x.w) + '</span><span class="t">' + esc(x.ru) + '</span></span><span class="lv">' + esc(x.cefr) + '</span></button>';
  }
  function renderDictBody() {
    const b = $('#dict-body'); if (!b) return;
    if (D.sec) {
      const s = SEC.get(D.sec);
      const f = D.filter, on = S.sel.includes(s.id);
      const tg = $('#sec-toggle');
      if (tg) tg.innerHTML = '<button class="learn-from' + (on ? ' on' : '') + '" data-toggle-sec="' + esc(s.id) + '" aria-pressed="' + on + '"><span class="pick-box">' + I.check + '</span><span><b>' + (on ? 'Слова для «Учить слова» берутся отсюда' : 'Брать слова отсюда для «Учить слова»') + '</b><small>' + (on ? 'Нажмите, чтобы убрать раздел' : 'Сейчас раздел не отмечен') + '</small></span></button>';
      const list = s.list.filter(x => { const st = status(x.w); return f === 'all' || (f === 'new' ? !st : f === 'l' ? (st === 'l' || st === 'n') : st === f); });
      b.innerHTML = list.length ? '<div class="list">' + list.slice(0, D.limit).map(wordRow).join('') + (list.length > D.limit ? '<button class="more" data-act="more">Показать ещё (' + fmtN(list.length - D.limit) + ')</button>' : '') + '</div>' : '<div class="list"><div class="empty">Здесь пока пусто</div></div>';
      return;
    }
    const q = D.q.trim().toLowerCase();
    if (q) {
      const starts = [], has = [];
      for (const x of W) {
        const w = x.w.toLowerCase();
        if (w.startsWith(q)) starts.push(x); else if (w.includes(q) || x.ru.toLowerCase().includes(q)) has.push(x);
      }
      const res = starts.concat(has).slice(0, 100);
      b.innerHTML = '<div class="list">' + (res.length ? res.map(wordRow).join('') : '<div class="empty">Ничего не найдено</div>') + '</div>';
      return;
    }
    const nc = newCount();
    b.innerHTML = '<div class="sel-note"><b>Учить слова: ' + S.sel.length + ' ' + pl(S.sel.length, 'раздел', 'раздела', 'разделов') + ', ' + fmtN(nc) + ' ' + pl(nc, 'новое слово', 'новых слова', 'новых слов') + '</b>' +
      'Отметьте галочкой разделы, из которых брать новые слова. Слова выходят в случайном порядке.</div>' +
      GROUPS.map(g => '<div class="grp-title">' + esc(g) + '</div><div class="list">' + SECTIONS.filter(s => s.group === g).map(s => {
      const done = s.list.reduce((a, x) => a + (S.words[x.w] ? 1 : 0), 0), on = S.sel.includes(s.id);
      return '<div class="srow2"><button class="pick' + (on ? ' on' : '') + '" data-toggle-sec="' + esc(s.id) + '" aria-pressed="' + on + '" aria-label="Учить слова из раздела ' + esc(s.name) + '"><span class="pick-box">' + I.check + '</span></button>' +
        '<button class="srow" data-sec="' + esc(s.id) + '"><span class="nm">' + esc(s.name) + '</span><span class="sb">' + esc(s.sub || words(s.list.length)) + '</span><span class="ct">' + fmtN(done) + ' / ' + fmtN(s.list.length) + '<span class="pbar"><i style="width:' + (100 * done / Math.max(1, s.list.length)).toFixed(1) + '%"></i></span></span></button></div>';
    }).join('') + '</div>').join('');
  }

  // ---------------------------------------------------------------- word sheet
  function statusText(x) {
    const v = S.words[x.w];
    if (!v) return 'Новое слово';
    if (v.s === 'k') return 'Уже знал';
    if (v.s === 'n') return 'Ждёт тренировки';
    if (v.s === 'd') return 'Выучено';
    return 'Изучаю · этап ' + ((v.st || 0) + 1) + ' из ' + INTERVALS.length + ' · повторение ' + relTime(v.due);
  }
  function bodyHTML(x, o) {
    o = o || {};
    const lists = [x.ngsl ? 'NGSL #' + x.ngsl : '', x.ox === 3 ? 'Oxford 3000' : x.ox === 5 ? 'Oxford 5000' : ''].filter(Boolean);
    let h = '<div class="info"><div class="tags">' + (x.cefr ? '<span class="tag lv">' + x.cefr + '</span>' : '') + (x.pos.length ? '<span class="tag">' + esc(posLabel(x)) + '</span>' : '') + (o.lists ? lists.map(l => '<span class="tag">' + l + '</span>').join('') : '') + '</div>' +
      '<h2 class="word">' + esc(x.w) + '</h2>' +
      '<div class="ipa-row"><button class="spk" data-act="speak" aria-label="Произнести">' + I.spk + '</button><span>' + esc(x.ipa || '') + '</span></div>';
    if (o.hideRu) h += '<div class="ru hide" data-act="reveal">Показать перевод</div>';
    else if (o.ru !== false) h += '<div class="ru">' + esc(x.ru) + '</div>';
    if (o.def && x.def) h += '<p class="def">' + esc(x.def) + '</p>';
    if (o.ex !== false && x.ex) h += '<p class="ex"><button data-act="speak-ex" aria-label="Произнести пример">' + I.spk + '</button><span>' + esc(x.ex) + '</span></p>';
    return h + '</div>';
  }
  let sheetWord = null;
  function openWord(x) {
    sheetWord = x;
    const s = status(x.w);
    const h = '<div class="grab"></div><div class="wsheet"><div class="qcard k-' + mediaKind(x) + '">' + mediaHTML(x) + bodyHTML(x, { def: true, lists: true }) + '</div></div>' +
      '<div class="status-line"><span class="dot ' + s + '"></span>' + esc(statusText(x)) + '</div>' +
      '<div class="row2">' +
        (s === 'n' || s === 'l' ? '' : '<button class="btn btn-main" data-act="w-learn">Учить</button>') +
        (s === 'k' ? '' : '<button class="btn btn-soft" data-act="w-known">Уже знаю</button>') +
        (s ? '<button class="btn btn-soft" data-act="w-reset">Сбросить</button>' : '') +
      '</div>';
    openSheet(h, 'word');
    bindMedia($('#sheet'));
    if (S.set.autoplay) speak(x);
  }

  // ---------------------------------------------------------------- settings
  function seg(key, opts) { return '<div class="seg" role="group">' + opts.map(([v, n]) => '<button data-set="' + key + '" data-v="' + v + '" aria-pressed="' + (String(S.set[key]) === String(v)) + '">' + n + '</button>').join('') + '</div>'; }
  function sw(key) { return '<span class="switch"><input type="checkbox" id="set-' + key + '" data-toggle="' + key + '"' + (S.set[key] ? ' checked' : '') + '><span></span></span>'; }
  let resetArm = 0;
  function renderSettings() {
    const vs = voices.length ? voices.map(v => '<option value="' + esc(v.voiceURI) + '"' + (v.voiceURI === S.set.ttsVoice ? ' selected' : '') + '>' + esc(v.name + ' (' + v.lang + ')') + '</option>').join('') : '<option value="">Голоса не найдены</option>';
    $('#view-settings').innerHTML =
      '<header class="page-head"><h1 class="large">Настройки</h1></header>' +
      '<div class="set-group"><div class="h2">Оформление</div><div class="set">' +
        '<div class="set-row col"><span class="lab">Тема</span>' + seg('theme', [['system', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']]) + '</div>' +
      '</div></div>' +
      '<div class="set-group"><div class="h2">Озвучка</div><div class="set">' +
        '<div class="set-row col"><span class="lab">Голос</span>' + seg('voice', [['uk', 'Британский'], ['us', 'Американский'], ['tts', 'Синтезатор']]) + '<span class="note" style="margin-top:0">Британский и американский - записи диктора из словаря Oxford. Если записи нет, слово читает синтезатор.</span></div>' +
        '<div class="set-row col"><label for="set-tts">Голос синтезатора (для примеров и слов без записи)</label><select id="set-tts" data-select="ttsVoice">' + vs + '</select></div>' +
        '<div class="set-row col"><label for="set-rate">Скорость речи: <b id="rate-v">' + fmtRate(S.set.rate) + '</b></label><input id="set-rate" type="range" min="0.6" max="1.3" step="0.05" value="' + S.set.rate + '" data-range="rate"></div>' +
        '<div class="set-row"><label for="set-autoplay">Произносить слово автоматически</label>' + sw('autoplay') + '</div>' +
        '<div class="set-row"><span class="lab">Проверить голос</span><button class="btn btn-soft" data-act="test-voice">' + I.spk + 'Hello, world</button></div>' +
      '</div></div>' +
      '<div class="set-group"><div class="h2">Обучение</div><div class="set">' +
        '<div class="set-row col"><span class="lab">Цель: новых слов в день</span>' + seg('goal', [[5, '5'], [10, '10'], [15, '15'], [20, '20'], [30, '30']]) + '</div>' +
        '<div class="set-row col"><span class="lab">Слов в одной тренировке</span>' + seg('batch', [[3, '3'], [5, '5'], [7, '7'], [10, '10']]) + '</div>' +
        '<div class="set-row"><label for="set-showRu">Показывать перевод на новой карточке</label>' + sw('showRu') + '</div>' +
        '<div class="set-row col"><span class="lab">Картинки</span>' + seg('images', [['all', 'Фото и эмодзи'], ['emoji', 'Эмодзи'], ['off', 'Без картинок']]) + '<span class="note">Фото проверены вручную и подобраны по смыслу слова. Нажмите на картинку в карточке, чтобы переключить фото и эмодзи.</span></div>' +
      '</div></div>' +
      '<div class="set-group"><div class="h2">Прогресс</div><div class="set">' +
        '<div class="set-row"><span class="lab">Сохранить копию прогресса</span><button class="btn btn-soft" data-act="export">Скачать файл</button></div>' +
        '<div class="set-row"><span class="lab">Загрузить из файла</span><label class="btn btn-soft" for="imp">Выбрать файл</label><input id="imp" type="file" accept="application/json,.json" hidden></div>' +
        '<div class="set-row"><span class="lab">Удалить весь прогресс</span><button class="btn btn-danger" data-act="reset">' + (resetArm > Date.now() ? 'Нажмите ещё раз' : 'Сбросить') + '</button></div>' +
      '</div></div>' +
      '<div class="about"><p>Прогресс хранится только в этом браузере. Чтобы перенести его на другое устройство, скачайте файл и загрузите его там.</p>' +
      '<p>Списки слов: New General Service List 1.2 (Browne, Culligan, Phillips; CC BY-SA 4.0), Oxford 3000 и Oxford 5000 (Oxford University Press). Произношение: Oxford Learner\'s Dictionaries. Фото: Wikimedia Commons через Wikidata.</p></div>';
  }

  // ---------------------------------------------------------------- overlay sessions
  const ov = $('#overlay');
  let mode = '';        // 'learn' | 'train' | 'review' | 'done'
  let L = null, T = null, R = null, swipe = null;
  function openOverlay(m) { mode = m; ov.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeOverlay() {
    mode = ''; ov.hidden = true; ov.innerHTML = ''; document.body.style.overflow = ''; L = T = R = null; swipe = null;
    try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    save(); showTab(tab);
  }

  // ---- swipe deck
  function makeSwipe(card, onDecide, onTap) {
    let sx = 0, sy = 0, dx = 0, dy = 0, t0 = 0, drag = false, pid = null, downT = null, done = false;
    const sL = $('.stamp.left', card), sR = $('.stamp.right', card);
    card.addEventListener('pointerdown', e => {
      if (done || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (e.target.closest('button')) return;
      pid = e.pointerId; sx = e.clientX; sy = e.clientY; dx = dy = 0; t0 = performance.now(); drag = true; downT = e.target;
      try { card.setPointerCapture(pid); } catch (err) { /* ignore */ }
      card.style.transition = 'none';
    });
    card.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== pid) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      card.style.transform = 'translate(' + dx + 'px,' + dy * 0.25 + 'px) rotate(' + dx / 18 + 'deg)';
      const k = Math.min(1, Math.abs(dx) / 100);
      if (sL) sL.style.opacity = dx < 0 ? k : 0;
      if (sR) sR.style.opacity = dx > 0 ? k : 0;
    });
    const end = e => {
      if (!drag || e.pointerId !== pid) return;
      drag = false;
      const v = Math.abs(dx) / Math.max(1, performance.now() - t0);
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) { reset(); if (onTap) onTap(downT); return; }
      if (Math.abs(dx) > 100 || (v > 0.55 && Math.abs(dx) > 40)) fly(dx > 0 ? 1 : -1); else reset();
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', () => { drag = false; reset(); });
    function reset() { card.style.transition = 'transform .25s ease'; card.style.transform = ''; if (sL) sL.style.opacity = 0; if (sR) sR.style.opacity = 0; }
    function fly(dir) {
      if (done) return; done = true;
      const st = dir < 0 ? sL : sR; if (st) st.style.opacity = 1;
      card.style.transition = 'transform .32s ease-out, opacity .32s ease-out';
      card.style.transform = 'translate(' + dir * Math.max(window.innerWidth, 600) * 1.05 + 'px,' + dy * 0.25 + 'px) rotate(' + dir * 22 + 'deg)';
      card.style.opacity = '0'; card.style.pointerEvents = 'none';
      setTimeout(() => onDecide(dir), 200);
    }
    return { fly };
  }
  function cardHTML(x, cls, o) {
    o = o || {};
    const kind = mediaKind(x);
    return '<article class="card ' + cls + ' k-' + kind + '" data-w="' + esc(x.w) + '">' + mediaHTML(x, kind) + bodyHTML(x, o) +
      '<div class="stamp left' + (o.leftBad ? ' bad' : '') + '">' + (o.leftLabel || 'Знаю') + '</div><div class="stamp right">' + (o.rightLabel || 'Учить') + '</div></article>';
  }
  function cardTap(target, x) {
    const m = target && target.closest && target.closest('.media');
    if (m && m.dataset.both) { toggleMedia(m); return; }
    const hid = $('.card.is-top .ru.hide', ov);
    if (hid) { reveal(); return; }
    speak(x);
  }

  // ---- learn new words
  function startLearn() {
    const pend = pendingList();
    if (pend.length >= S.set.batch) { startTraining(pend.slice(0, S.set.batch)); return; }
    const q = buildQueue(60);
    if (!q.length) {
      if (pend.length) { startTraining(pend); return; }
      toast('В отмеченных разделах не осталось новых слов. Отметьте другие разделы в словаре.'); D.sec = null; showTab('dict'); return;
    }
    L = { q, hist: [] }; openOverlay('learn'); renderLearn();
  }
  function renderLearn() {
    const pend = pendingList().length, B = S.set.batch;
    const cur = L.q[0], nxt = L.q[1];
    let dots = ''; for (let i = 0; i < B; i++) dots += '<i class="' + (i < pend ? 'on' : '') + '"></i>';
    ov.innerHTML = '<div class="ses">' +
      '<header class="ses-top"><button class="icon-btn" data-act="close" aria-label="Закрыть">' + I.close + '</button>' +
        '<div class="ses-mid"><div class="ses-title">К изучению ' + Math.min(pend, B) + ' из ' + B + '</div><div class="dots">' + dots + '</div></div>' +
        '<button class="icon-btn" data-act="undo" aria-label="Вернуть прошлую карточку"' + (L.hist.length ? '' : ' disabled') + '>' + I.undo + '</button></header>' +
      '<div class="stack">' + (cur ? (nxt ? cardHTML(nxt, 'is-under', { hideRu: !S.set.showRu }) : '') + cardHTML(cur, 'is-top enter', { hideRu: !S.set.showRu }) : '<div class="done"><div class="done-ico">🎉</div><h2>Новые слова закончились</h2><p>Отметьте другие разделы в словаре.</p></div>') + '</div>' +
      '<div class="ses-actions"><button class="big-btn known" data-act="known"' + (cur ? '' : ' disabled') + '>' + I.left + 'Знаю</button><button class="round-btn" data-act="speak" aria-label="Произнести">' + I.spk + '</button><button class="big-btn learn" data-act="tolearn"' + (cur ? '' : ' disabled') + '>Учить' + I.arrow + '</button></div>' +
      '<div class="ses-foot">' + (pend ? '<button class="link-btn" data-act="train">Начать тренировку сейчас (' + pend + ')</button>' : 'Влево - уже знаю слово, вправо - начну его учить') + '</div>' +
      '</div>';
    if (!cur) return;
    const top = $('.card.is-top', ov);
    swipe = makeSwipe(top, decideLearn, t => cardTap(t, cur));
    bindMedia(ov);
    prefetch(L.q.slice(1, 5));
    if (S.set.autoplay) speak(cur);
  }
  function decideLearn(dir) {
    if (!L) return;
    const x = L.q.shift(); if (!x) return;
    const k = dayKey();
    if (dir < 0) { S.words[x.w] = { s: 'k', t: Date.now() }; day(k).k++; } else S.words[x.w] = { s: 'n', t: Date.now() };
    L.hist.push({ x, dir, k }); if (L.hist.length > 30) L.hist.shift();
    saveSoon();
    const pend = pendingList();
    if (dir > 0 && pend.length >= S.set.batch) { startTraining(pend.slice(0, S.set.batch)); return; }
    if (L.q.length < 6) { const have = new Set(L.q.map(y => y.w)); L.q.push(...buildQueue(40, have)); }
    renderLearn();
  }
  function undoLearn() {
    const h = L && L.hist.pop(); if (!h) return;
    const v = S.words[h.x.w];
    if (v && (v.s === 'k' || v.s === 'n')) { delete S.words[h.x.w]; if (h.dir < 0) { const d = day(h.k); d.k = Math.max(0, d.k - 1); } }
    L.q.unshift(h.x); saveSoon(); renderLearn();
  }

  // ---- training
  const canSpell = x => /^[a-z]{2,12}$/i.test(x.w);
  function distractors(x, field, n, batch) {
    const out = [], used = new Set([x[field].toLowerCase()]);
    const add = y => { const v = y[field].toLowerCase(); if (y !== x && !used.has(v)) { used.add(v); out.push(y); } };
    shuffle(batch.slice()).forEach(y => { if (out.length < 1) add(y); });
    const same = W.filter(y => y.pos[0] === x.pos[0] && y.ox && Math.abs((CR[y.cefr] || 3) - (CR[x.cefr] || 3)) <= 1);
    let guard = 0;
    while (out.length < n && guard++ < 200) add(same.length > 10 ? same[Math.random() * same.length | 0] : W[Math.random() * W.length | 0]);
    return out;
  }
  function startTraining(list) {
    const steps = list.map(x => ({ k: 'intro', x }));
    steps.push(...shuffle(list.map(x => ({ k: 'ru', x }))));
    steps.push(...shuffle(list.map(x => ({ k: 'en', x }))));
    steps.push(...shuffle(list.map(x => ({ k: canSpell(x) ? 'spell' : 'listen', x }))));
    T = { list, steps, i: 0, wrong: 0, tries: {}, lock: false, failed: new Set() };
    L = null; openOverlay('train'); renderStep();
  }
  function trainFrame(inner) {
    return '<div class="ses"><header class="ses-top"><button class="icon-btn" data-act="close" aria-label="Закрыть">' + I.close + '</button>' +
      '<div class="ses-mid"><div class="ses-title">Тренировка</div><div class="progress"><i style="width:' + (100 * T.i / T.steps.length).toFixed(1) + '%"></i></div></div><span></span></header>' +
      '<div class="train-body">' + inner + '</div></div>';
  }
  function renderStep() {
    if (T.i >= T.steps.length) { finishTraining(); return; }
    const s = T.steps[T.i], x = s.x;
    T.lock = false; T.cur = s;
    let h = '';
    if (s.k === 'intro') {
      h = '<div class="lead">Новое слово · ' + (T.i + 1) + ' из ' + T.list.length + '</div><div class="qcard intro k-' + mediaKind(x) + '">' + mediaHTML(x) + bodyHTML(x, { def: true }) + '</div>' +
        '<button class="btn btn-main btn-wide" data-act="next">Запомнил, дальше</button>';
    } else if (s.k === 'ru') {
      s.opts = shuffle([x, ...distractors(x, 'ru', 3, T.list)]);
      h = '<div class="lead">Выберите перевод</div><div class="qcard k-' + mediaKind(x) + '">' + mediaHTML(x) + bodyHTML(x, { ru: false, ex: false }) + '</div>' +
        '<div class="opts">' + s.opts.map((o, j) => '<button class="opt" data-opt="' + j + '">' + esc(o.ru) + '</button>').join('') + '</div><div class="feedback"></div>';
    } else if (s.k === 'en') {
      s.opts = shuffle([x, ...distractors(x, 'w', 3, T.list)]);
      h = '<div class="lead">Выберите слово</div><div class="qcard">' + (mediaKind(x) !== 'type' ? mediaHTML(x) : '') + '<div class="info"><div class="tags">' + (x.pos.length ? '<span class="tag">' + esc(posLabel(x)) + '</span>' : '') + '</div><div class="q-ru">' + esc(x.ru) + '</div></div></div>' +
        '<div class="opts">' + s.opts.map((o, j) => '<button class="opt en" data-opt="' + j + '">' + esc(o.w) + '</button>').join('') + '</div><div class="feedback"></div>';
    } else if (s.k === 'listen') {
      s.opts = shuffle([x, ...distractors(x, 'w', 3, T.list)]);
      h = '<div class="lead">Послушайте и выберите слово</div><button class="listen-btn" data-act="speak" aria-label="Прослушать ещё раз">' + I.spk + '</button>' +
        '<div class="opts">' + s.opts.map((o, j) => '<button class="opt en" data-opt="' + j + '">' + esc(o.w) + '</button>').join('') + '</div><div class="feedback"></div>';
    } else if (s.k === 'spell') {
      const ans = x.w.toLowerCase();
      s.sp = { ans, pos: 0, err: false, letters: shuffle(ans.split('').map((c, j) => ({ c, j }))) };
      let slots = ''; for (let j = 0; j < ans.length; j++) slots += '<span class="slot"></span>';
      h = '<div class="lead">Соберите слово</div><div class="qcard">' + (mediaKind(x) !== 'type' ? mediaHTML(x) : '') + '<div class="info"><div class="q-ru">' + esc(x.ru) + '</div></div></div>' +
        '<div class="slots">' + slots + '</div><div class="tiles-l">' + s.sp.letters.map((l, j) => '<button class="ltile" data-tile="' + j + '">' + esc(l.c) + '</button>').join('') + '</div>' +
        '<div class="feedback"></div><div class="row2"><button class="btn btn-soft" data-act="hint">Подсказка</button><button class="btn btn-soft" data-act="giveup">Не помню</button></div>';
    }
    ov.innerHTML = trainFrame(h);
    bindMedia(ov);
    if (S.set.autoplay && (s.k === 'intro' || s.k === 'ru')) speak(x);
    if (s.k === 'listen') speak(x);
  }
  function requeue(s) {
    const key = s.k + ':' + s.x.w; T.tries[key] = (T.tries[key] || 0) + 1;
    T.failed.add(s.x.w);
    if (T.tries[key] <= 2) T.steps.push({ k: s.k, x: s.x });
  }
  function pickOpt(j) {
    const s = T.cur; if (T.lock || !s.opts) return; T.lock = true;
    const ok = s.opts[j] === s.x;
    const btns = $$('.opt', ov);
    btns.forEach((b, i) => { if (s.opts[i] === s.x) b.classList.add('ok'); });
    const fb = $('.feedback', ov);
    if (!ok) { btns[j].classList.add('no'); T.wrong++; requeue(s); fb.className = 'feedback no'; fb.textContent = s.x.w + ' - ' + s.x.ru; }
    else { fb.className = 'feedback ok'; fb.textContent = 'Верно'; }
    if (s.k !== 'listen') speak(s.x);
    setTimeout(() => { if (T && T.cur === s) { T.i++; renderStep(); } }, ok ? 750 : 1700);
  }
  function tapTile(j, viaKey) {
    const s = T.cur; if (T.lock || !s.sp) return;
    const sp = s.sp, l = sp.letters[j], tile = $$('.ltile', ov)[j];
    if (!l || tile.classList.contains('used')) return;
    if (l.c === sp.ans[sp.pos]) {
      tile.classList.add('used'); placeLetter(l.c);
    } else {
      if (!viaKey) { tile.classList.remove('shake'); void tile.offsetWidth; tile.classList.add('shake'); }
      if (!sp.err) { sp.err = true; T.wrong++; }
    }
  }
  function placeLetter(c) {
    const sp = T.cur.sp, slots = $$('.slot', ov);
    slots[sp.pos].textContent = c; slots[sp.pos].classList.add('f'); sp.pos++;
    if (sp.pos >= sp.ans.length) spellDone(!sp.err);
  }
  function spellHint() {
    const s = T.cur; if (T.lock || !s.sp) return;
    const sp = s.sp; sp.err = true;
    const j = sp.letters.findIndex((l, i) => l.c === sp.ans[sp.pos] && !$$('.ltile', ov)[i].classList.contains('used'));
    if (j >= 0) { $$('.ltile', ov)[j].classList.add('used'); placeLetter(sp.letters[j].c); }
  }
  function spellGiveUp() {
    const s = T.cur; if (T.lock || !s.sp) return;
    const sp = s.sp; sp.err = true;
    const slots = $$('.slot', ov);
    for (let j = sp.pos; j < sp.ans.length; j++) slots[j].textContent = sp.ans[j];
    $$('.ltile', ov).forEach(t => t.classList.add('used'));
    spellDone(false);
  }
  function spellDone(ok) {
    const s = T.cur; T.lock = true;
    $('.slots', ov).classList.add(ok ? 'done' : 'fail');
    const fb = $('.feedback', ov);
    fb.className = 'feedback ' + (ok ? 'ok' : 'no'); fb.textContent = ok ? 'Верно' : 'Повторим это слово ещё раз';
    if (!ok) requeue(s);
    speak(s.x);
    setTimeout(() => { if (T && T.cur === s) { T.i++; renderStep(); } }, ok ? 900 : 1700);
  }
  function finishTraining() {
    const now = Date.now(), d = day();
    T.list.forEach(x => { S.words[x.w] = { s: 'l', st: 0, due: now + INTERVALS[0], t: now, r: 0 }; });
    d.n += T.list.length; save();
    const list = T.list, wrong = T.wrong;
    mode = 'done';
    ov.innerHTML = '<div class="ses"><div class="done"><div class="done-ico">🎉</div><h2>Готово!<br>+' + words(list.length) + '</h2>' +
      '<p>' + (wrong ? 'Ошибок: ' + wrong + '. ' : 'Без единой ошибки. ') + 'Первое повторение ' + relTime(now + INTERVALS[0]) + '.</p>' +
      '<div class="list">' + list.map(wordRow).join('') + '</div>' +
      '<div class="btns"><button class="btn btn-main" data-act="again-learn">Учить ещё</button><button class="btn btn-soft" data-act="close">На главную</button></div></div></div>';
    T = null;
  }

  // ---- review
  function startReview() {
    const due = shuffle(dueList());
    if (!due.length) { const nd = nextDue(); toast(nd < Infinity ? 'Повторять пока нечего. Следующее повторение ' + relTime(nd) + '.' : 'Сначала выучите несколько новых слов.'); return; }
    R = { q: due.slice(0, 60), total: Math.min(60, due.length), ok: 0, bad: 0, again: new Set(), seen: 0 };
    openOverlay('review'); renderReview();
  }
  function renderReview() {
    const cur = R.q[0], nxt = R.q[1];
    if (!cur) { finishReview(); return; }
    const o = { hideRu: true, leftLabel: 'Не помню', rightLabel: 'Помню', leftBad: true };
    ov.innerHTML = '<div class="ses">' +
      '<header class="ses-top"><button class="icon-btn" data-act="close" aria-label="Закрыть">' + I.close + '</button>' +
        '<div class="ses-mid"><div class="ses-title">Повторение · ' + Math.min(R.seen + 1, R.total) + ' из ' + R.total + '</div><div class="progress"><i style="width:' + (100 * Math.min(R.seen, R.total) / R.total).toFixed(1) + '%"></i></div></div><span></span></header>' +
      '<div class="stack">' + (nxt ? cardHTML(nxt, 'is-under', o) : '') + cardHTML(cur, 'is-top enter', o) + '</div>' +
      '<div class="ses-actions"><button class="big-btn bad" data-act="forgot">' + I.left + 'Не помню</button><button class="round-btn" data-act="speak" aria-label="Произнести">' + I.spk + '</button><button class="big-btn learn" data-act="remember">Помню' + I.arrow + '</button></div>' +
      '<div class="ses-foot">Вспомните перевод, затем откройте его и смахните карточку</div></div>';
    swipe = makeSwipe($('.card.is-top', ov), decideReview, t => cardTap(t, cur));
    bindMedia(ov);
    prefetch(R.q.slice(1, 4));
    if (S.set.autoplay) speak(cur);
  }
  function reveal() {
    const el = $('.card.is-top .ru.hide', ov); if (!el) return;
    const x = BY.get($('.card.is-top', ov).dataset.w);
    el.classList.remove('hide'); el.removeAttribute('data-act'); el.textContent = x.ru;
  }
  function decideReview(dir) {
    if (!R) return;
    const x = R.q.shift(); if (!x) return;
    const v = S.words[x.w];
    if (!R.again.has(x.w) && v && v.s === 'l') {
      R.seen++;
      const d = day(); d.r++; v.r = (v.r || 0) + 1;
      if (dir > 0) {
        v.st = (v.st || 0) + 1;
        if (v.st >= INTERVALS.length) { v.s = 'd'; v.due = 0; d.d++; } else v.due = Date.now() + INTERVALS[v.st];
        R.ok++;
      } else {
        v.st = 0; v.due = Date.now() + INTERVALS[0]; v.w = (v.w || 0) + 1; R.bad++;
        R.again.add(x.w); R.q.push(x);
      }
      saveSoon();
    }
    renderReview();
  }
  function finishReview() {
    save(); mode = 'done';
    const nd = nextDue();
    ov.innerHTML = '<div class="ses"><div class="done"><div class="done-ico">' + (R.bad ? '💪' : '🏆') + '</div><h2>Повторение завершено</h2>' +
      '<p>Помню: ' + R.ok + ' · Не помню: ' + R.bad + '. ' + (nd < Infinity ? 'Следующее повторение ' + relTime(nd) + '.' : '') + '</p>' +
      '<div class="btns"><button class="btn btn-main" data-act="close">На главную</button></div></div></div>';
    R = null;
  }

  // ---------------------------------------------------------------- events
  document.addEventListener('click', e => {
    const t = e.target;
    const tabBtn = t.closest('[data-tab]');
    if (tabBtn) { if (tabBtn.dataset.tab === 'dict' && tab === 'dict') { D.sec = null; } showTab(tabBtn.dataset.tab); return; }
    const opt = t.closest('[data-opt]'); if (opt && mode === 'train') { pickOpt(+opt.dataset.opt); return; }
    const tile = t.closest('[data-tile]'); if (tile && mode === 'train') { tapTile(+tile.dataset.tile); return; }
    const tgl = t.closest('[data-toggle-sec]'); if (tgl) { toggleSec(tgl.dataset.toggleSec); renderDictBody(); return; }
    const secBtn = t.closest('[data-sec]'); if (secBtn) { D.sec = secBtn.dataset.sec; D.filter = 'all'; D.limit = 120; renderDict(); window.scrollTo(0, 0); return; }
    const wBtn = t.closest('[data-word]'); if (wBtn) { const x = BY.get(wBtn.dataset.word); if (x) openWord(x); return; }
    const fBtn = t.closest('[data-filter]'); if (fBtn) { D.filter = fBtn.dataset.filter; D.limit = 120; $$('[data-filter]').forEach(b => b.setAttribute('aria-pressed', b === fBtn)); renderDictBody(); return; }
    const setBtn = t.closest('[data-set]');
    if (setBtn) {
      const k = setBtn.dataset.set, raw = setBtn.dataset.v;
      S.set[k] = typeof DEF_SET[k] === 'number' ? +raw : raw; save();
      if (k === 'theme') applyTheme();
      renderSettings();
      if (k === 'voice') speak(BY.get('hello'));
      return;
    }
    const a = t.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    const curX = () => {
      if (mode === 'train' && T && T.cur) return T.cur.x;
      const c = $('.card.is-top', ov); return c ? BY.get(c.dataset.w) : null;
    };
    switch (act) {
      case 'learn': startLearn(); break;
      case 'review': startReview(); break;
      case 'pick': D.sec = null; D.q = ''; showTab('dict'); break;
      case 'sheet-close': closeSheet(); break;
      case 'close': closeOverlay(); break;
      case 'again-learn': ov.hidden = true; mode = ''; startLearn(); break;
      case 'known': if (swipe) swipe.fly(-1); break;
      case 'tolearn': if (swipe) swipe.fly(1); break;
      case 'remember': if (swipe) swipe.fly(1); break;
      case 'forgot': if (swipe) swipe.fly(-1); break;
      case 'undo': undoLearn(); break;
      case 'train': { const p = pendingList(); if (p.length) startTraining(p.slice(0, S.set.batch)); break; }
      case 'reveal': reveal(); break;
      case 'next': if (mode === 'train') { T.i++; renderStep(); } break;
      case 'hint': spellHint(); break;
      case 'giveup': spellGiveUp(); break;
      case 'speak': { const x = sheetMode === 'word' && !$('#sheet').hidden ? sheetWord : curX(); if (x) speak(x); break; }
      case 'speak-ex': { const x = sheetMode === 'word' && !$('#sheet').hidden ? sheetWord : curX(); if (x && x.ex) speak(null, x.ex); break; }
      case 'dict-back': D.sec = null; renderDict(); break;
      case 'more': D.limit += 200; renderDictBody(); break;
      case 'w-learn': if (sheetWord) { S.words[sheetWord.w] = { s: 'n', t: Date.now() }; save(); toast('«' + sheetWord.w + '» добавлено к изучению'); closeSheet(); } break;
      case 'w-known': if (sheetWord) { const prev = S.words[sheetWord.w]; S.words[sheetWord.w] = { s: 'k', t: Date.now() }; if (!prev) day().k++; save(); closeSheet(); } break;
      case 'w-reset': if (sheetWord) { delete S.words[sheetWord.w]; save(); closeSheet(); } break;
      case 'hide-install': try { localStorage.setItem('wordeck.hint', '0'); } catch (e) { /* ignore */ } renderHome(); break;
      case 'test-voice': if (S.set.voice === 'tts') tts('Hello, world'); else speak(BY.get('hello')); break;
      case 'export': exportData(); break;
      case 'reset':
        if (resetArm > Date.now()) { S = { words: {}, days: {}, sel: S.sel, set: S.set }; save(); resetArm = 0; toast('Прогресс удалён'); renderSettings(); }
        else { resetArm = Date.now() + 4000; renderSettings(); setTimeout(() => { if (tab === 'settings') renderSettings(); }, 4100); }
        break;
    }
  });
  // pictures inside sheets / training cards: tap for another picture
  document.addEventListener('click', e => {
    const m = e.target.closest('.media');
    if (m && !m.closest('.card')) toggleMedia(m);
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.toggle) { S.set[t.dataset.toggle] = t.checked; save(); }
    else if (t.dataset.select) { S.set[t.dataset.select] = t.value; save(); tts('Hello, world'); }
    else if (t.id === 'imp' && t.files && t.files[0]) importData(t.files[0]);
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'dict-q') { D.q = t.value; clearTimeout(D.t); D.t = setTimeout(renderDictBody, 120); }
    if (t.dataset.range) { S.set[t.dataset.range] = +t.value; $('#rate-v').textContent = fmtRate(+t.value); saveSoon(); }
  });
  document.addEventListener('keydown', e => {
    lastInput = Date.now();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!$('#sheet').hidden) { if (e.key === 'Escape') closeSheet(); return; }
    if (!mode) return;
    if (e.key === 'Escape') { closeOverlay(); return; }
    if (mode === 'learn' || mode === 'review') {
      if (e.key === 'ArrowLeft' && swipe) { e.preventDefault(); swipe.fly(-1); }
      else if (e.key === 'ArrowRight' && swipe) { e.preventDefault(); swipe.fly(1); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if ($('.card.is-top .ru.hide', ov)) reveal(); else { const c = $('.card.is-top', ov); if (c) speak(BY.get(c.dataset.w)); } }
      else if ((e.key === 'Backspace' || e.key === 'z') && mode === 'learn') undoLearn();
    } else if (mode === 'train' && T && T.cur) {
      const s = T.cur;
      if (s.opts && /^[1-4]$/.test(e.key)) pickOpt(+e.key - 1);
      else if (s.k === 'intro' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); T.i++; renderStep(); }
      else if (s.sp && /^[a-z]$/i.test(e.key)) {
        const sp = s.sp, c = e.key.toLowerCase();
        const tiles = $$('.ltile', ov);
        let j = sp.letters.findIndex((l, i) => l.c === c && l.c === sp.ans[sp.pos] && !tiles[i].classList.contains('used'));
        if (j < 0) j = sp.letters.findIndex((l, i) => l.c === c && !tiles[i].classList.contains('used'));
        if (j >= 0) tapTile(j, false); else if (!sp.err) { sp.err = true; T.wrong++; }
      }
    }
  });

  // ---------------------------------------------------------------- export / import
  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'wordeck', v: 1, at: new Date().toISOString(), data: S }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'wordeck-progress-' + dayKey() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importData(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result), d = j.data || j;
        if (!d || typeof d.words !== 'object') throw new Error('bad');
        S = { words: d.words || {}, days: d.days || {}, sel: (d.sel || []).filter(id => SEC.has(id)), set: Object.assign({}, DEF_SET, d.set || {}) };
        if (!S.sel.length) S.sel = ['ox3'];
        save(); applyTheme(); toast('Прогресс загружен: ' + words(Object.keys(S.words).length)); renderSettings();
      } catch (e) { toast('Не получилось прочитать файл. Выберите файл, сохранённый из Wordeck.'); }
    };
    r.readAsText(file);
  }

  // ---------------------------------------------------------------- study timer
  let lastInput = Date.now();
  ['pointerdown', 'touchstart', 'wheel'].forEach(ev => document.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true }));
  let tick = 0;
  setInterval(() => {
    if (!mode || document.visibilityState !== 'visible' || Date.now() - lastInput > 90e3) return;
    day().s++;
    if (++tick % 15 === 0) save();
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); else if (tab === 'home' && !mode) renderHome(); });
  window.addEventListener('pagehide', save);

  // ---------------------------------------------------------------- boot
  applyTheme();
  if (!W.length) { $('#view-home').innerHTML = '<div class="panel">Не найден файл words.js. Он должен лежать рядом с index.html.</div>'; return; }
  showTab('home');
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode unavailable */ });
  }
})();
