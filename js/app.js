// Слог: экраны. Маршруты в адресе после #: / сегодня, /cards, /say, /think, /add, /bank, /w/<id>, /more.

const $ = s => document.querySelector(s);
const P = new URLSearchParams(location.search);
if (P.get('theme')) document.documentElement.dataset.theme = P.get('theme');
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WD2 = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const KIND = { w: ['Слово', 'pink'], l: ['Связка', 'lav'], m: ['Из книги', 'yellow'] };

function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}
function themeName(t) { return t === 'mine' ? 'Из книги' : (THEMES.find(x => x.id === t) || {}).name || ''; }
function stars(s) { return esc(s).replace(/\*([^*]+)\*/g, '<mark>$1</mark>'); }
function lower1(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
function view(html) { $('#view').innerHTML = html; window.scrollTo(0, 0); }
function setTab(name) { document.querySelectorAll('.topbar nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === name)); }
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200);
}
function play(text) { return `<button class="play" data-speak="${esc(plain(text))}" aria-label="Послушать">▶</button>`; }

// Шапка страницы и карточка с ярлыком, как в учебнике. Кот — один на страницу (opt.cat).
function head(badge, num, kicker, title, sub) {
  return `<header class="head"><div class="badge"><span class="d">${badge}</span><span class="n">${num}</span></div>
    <img class="star" src="sprites/star-yellow.png" alt="">
    <div><div class="kicker">${kicker}</div><h1 class="title">${title}</h1><div class="sub">${sub}</div></div></header>`;
}
function card(tag, body, opt = {}) {
  const c = `<section class="card" style="--sh:var(--${opt.sh || 'pink'});--tc:var(--${opt.tc || 'pink'})">
    <span class="tag ${opt.navy ? 'navy' : ''}">${tag}</span>${body}</section>`;
  return opt.cat ? `<div class="catwrap"><img class="cat" src="sprites/cat-peek.png" alt="">${c}</div>` : c;
}
function prog(done, total) {
  return `<div class="prog"><i style="width:${total ? Math.round(100 * done / total) : 100}%"></i></div>`;
}

// ---------- голос ----------
function ruVoices() { return ('speechSynthesis' in window) ? speechSynthesis.getVoices().filter(v => /^ru/i.test(v.lang)) : []; }
function bestVoice() {
  const vs = ruVoices();
  const own = vs.find(v => v.voiceURI === S.settings.voice);
  if (own) return own;
  const rank = v => /google/i.test(v.name) ? 0 : /premium|enhanced|natural|online/i.test(v.name) ? 1 : /milena|svetlana|dariya|katya/i.test(v.name) ? 2 : 3;
  return vs.sort((a, b) => rank(a) - rank(b))[0];
}
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plain(text).replace(/…/g, ' '));
  u.lang = 'ru-RU'; u.rate = 0.95;
  const v = bestVoice(); if (v) u.voice = v;
  speechSynthesis.speak(u);
}

// ---------- подсветка слов в тексте ----------
function spans(text, x, cls) {
  const t = norm(text), out = [];
  for (const p of (x.p || [])) for (const part of p.replace(/ё/g, 'е').split('[\\s\\S]*')) {
    const re = new RegExp(part, 'g'); let m;
    while ((m = re.exec(t))) {
      let e = m.index + m[0].length;
      while (e < t.length && /[а-яa-z]/.test(t[e])) e++;
      out.push({ s: m.index, e, cls });
      if (!m[0].length) re.lastIndex++;
    }
  }
  return out;
}
function highlight(text, groups) {
  let rs = [];
  for (const [ids, cls] of groups) for (const id of ids) { const x = item(id); if (x) rs = rs.concat(spans(text, x, cls)); }
  rs.sort((a, b) => a.s - b.s);
  let html = '', i = 0;
  for (const r of rs) { if (r.s < i) continue; html += esc(text.slice(i, r.s)) + `<mark class="${r.cls}">${esc(text.slice(r.s, r.e))}</mark>`; i = r.e; }
  return (html + esc(text.slice(i))).replace(/\n/g, '<br>');
}
// Цитата своего слова с пропуском на месте слова.
function blank(x) {
  const rs = spans(x.q || '', x, '');
  if (!rs.length) return esc(x.q || '');
  const r = rs[0];
  return esc(x.q.slice(0, r.s)) + '<span class="gap">' + '_'.repeat(Math.min(10, r.e - r.s)) + '</span>' + esc(x.q.slice(r.e));
}

// ---------- сегодня ----------
function home() {
  setTab('');
  const r = S.days[today()] || { cards: 0, say: 0, think: false };
  const due = dueIds().length, fresh = Math.min(freshLeft(), freshOrder().length);
  const cardsDone = due + fresh === 0 && r.cards > 0;
  const plan = thinkPlan();
  const c = counts(), st = streak(), d = new Date();
  const week = [...Array(7)].map((_, i) => addDays(today(), i - 6));
  const row = (href, n, title, sub, done) => `<a class="trow ${done ? 'done' : ''}" href="${href}"><span class="num">${done ? '✓' : n}</span>
    <span class="tt"><b>${title}</b><small>${sub}</small></span><span class="arr">›</span></a>`;
  view(head(plural(st, 'день', 'дня', 'дней') + '<br>подряд', st, 'Слог · книжная речь', 'Сегодня', `${WDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`) +
  `<div class="stack">
    ${card('15 минут', `
      ${row('#/cards', 1, 'Карточки', cardsDone ? `готово: ${r.cards} ${plural(r.cards, 'ответ', 'ответа', 'ответов')}` : `${due} ${plural(due, 'ждёт', 'ждут', 'ждут')} · ${fresh} ${plural(fresh, 'новая', 'новые', 'новых')} · 7 мин`, cardsDone)}
      ${row('#/say', 2, 'Скажи книжно', r.say >= 5 ? 'готово: 5 фраз' : 'простая фраза → книжная · 3 мин', r.say >= 5)}
      ${row('#/think', 3, 'Мысль дня', esc(plan.q), plan.done)}
      <a class="btn light wide" href="#/add" style="margin-top:12px">+ Слово из книги</a>`, { cat: true, navy: true, sh: 'blue' })}
    ${card('Мой прогресс', `
      <div class="grid3">
        <div class="mini speech"><div class="label">В речи</div><b>${c.speech}</b><small>сказала сама</small></div>
        <div class="mini"><div class="label">Учу</div><b>${c.learn}</b><small>в карточках</small></div>
        <div class="mini"><div class="label">Впереди</div><b>${c.ahead}</b><small>в банке</small></div>
      </div>
      <div class="week">${week.map(x => { const o = S.days[x]; const on = o && (o.cards || o.say || o.think); return `<i class="${on ? 'on' : ''} ${x === today() ? 'now' : ''}">${WD2[new Date(x + 'T12:00').getDay()]}</i>`; }).join('')}</div>
      <p class="note" style="margin-top:12px">«В речи» — слова, которые ты сама вставила в «Мысль дня». Узнать слово мало: оно твоё, когда пришло в твою фразу.</p>`,
      { tc: 'blue', sh: 'lav' })}
    ${card('Слог', `
      <a class="lrow" href="#/bank"><span><b>Банк слов</b><small>${c.total} слов и связок по темам</small></span><span class="arr">›</span></a>
      <a class="lrow" href="#/add"><span><b>Из книги</b><small>${S.mine.length ? 'моих слов: ' + S.mine.length : 'свои слова с фразой из книги'}</small></span><span class="arr">›</span></a>
      <a class="lrow" href="#/more"><span><b>Голос и настройки</b><small>сколько новых в день, как устроен Слог</small></span><span class="arr">›</span></a>`,
      { tc: 'lav', sh: 'yellow' })}
  </div>`);
}

// ---------- карточки ----------
let CQ = null;
function cards(fresh) {
  setTab('cards');
  if (fresh || !CQ || CQ.day !== today()) { const q = queue(); CQ = { day: today(), q, total: q.length, passed: 0, open: P.has('reveal') }; }
  const top = head('осталось', CQ.q.length, 'Каждый день · 7 минут', 'Карточки', 'сначала смысл — слово говоришь сама') + prog(CQ.passed, CQ.total);
  if (!CQ.q.length) {
    const r = dayRec();
    return view(top + `<div class="stack">${card('Сегодня', `<div class="face">
      <div class="score">На сегодня всё</div>
      <p>${r.cards} ${plural(r.cards, 'ответ', 'ответа', 'ответов')} за сегодня. Следующие карточки придут, когда подойдёт их срок.</p>
      <div class="btns"><a class="btn" href="#/say">Скажи книжно →</a></div>
      ${freshOrder().length ? '<button class="linkbtn" data-a="more5">Ещё 5 новых</button>' : ''}</div>`, { cat: true, tc: 'yellow', sh: 'blue' })}</div>`);
  }
  const x = item(CQ.q[0]);
  const [kind, tc] = KIND[x.k];
  let face, back;
  if (x.k === 'm') {
    const w = plain(x.w);
    face = `<div class="src">${x.b ? '«' + esc(x.b) + '»' : 'фраза из книги'}</div>
      <div class="quote">${blank(x)}</div>
      <div class="hint">${x.m ? esc(x.m) + ' · ' : ''}на «${esc(w[0])}», ${w.length} ${plural(w.length, 'буква', 'буквы', 'букв')} · скажи вслух</div>`;
    back = `<div class="word">${esc(x.w)}${play(x.w)}</div><p class="ex">${highlight(x.q || '', [[[x.id], 'own']])}</p>`;
  } else {
    face = `<div class="src">${themeName(x.t)}</div>
      <div class="mean">${esc(x.m)}</div>
      <div class="hint">${esc(x.h || '')} · скажи вслух</div>`;
    back = `<div class="word">${esc(accent(x.w))}${play(x.w)}</div>
      ${x.c ? `<div class="chips">${x.c.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : ''}
      <p class="ex">${highlight(x.e, [[[x.id], 'own']])}${play(x.e)}</p>
      ${x.n ? `<p class="nb"><strong>Не путать.</strong> ${esc(x.n)}</p>` : ''}`;
  }
  view(top + `<div class="stack">${card(kind, `<div class="face">${face}
    ${CQ.open ? `<div class="back">${back}</div>
      <div class="btns"><button class="btn no" data-a="miss">Не пришло</button><button class="btn" data-a="got">Вспомнила</button></div>`
      : '<div class="btns"><button class="btn" data-a="open">Показать</button></div>'}
    <a class="linkbtn" href="#/">Закончить — ответы уже сохранены</a></div>`, { cat: true, tc, sh: 'blue' })}</div>`);
}

// ---------- скажи книжно ----------
let SQ = null;
function say(fresh) {
  setTab('');
  if (fresh || !SQ || SQ.day !== today()) { const q = sayPool(5); SQ = { day: today(), q, total: q.length, passed: 0, open: P.has('reveal'), hint: P.has('reveal') }; }
  const top = head('фраз', SQ.q.length, 'Каждый день · 3 минуты', 'Скажи книжно', 'простая фраза — ты говоришь её книжно') + prog(SQ.passed, SQ.total);
  if (!SQ.q.length) {
    return view(top + `<div class="stack">${card('Готово', `<div class="face"><div class="score">Пять из пяти</div>
      <p>Теперь те же слова — в свою мысль.</p><div class="btns"><a class="btn" href="#/think">Мысль дня →</a></div></div>`,
      { cat: true, tc: 'yellow', sh: 'blue' })}</div>`);
  }
  const it = SQ.q[0], x = item(it.id);
  view(top + `<div class="stack">${card(`Фраза ${SQ.passed + 1} из ${SQ.total}`, `<div class="face">
    <div class="src">скажи ту же мысль книжно, вслух</div>
    <div class="plainq">«${esc(it.pair[0])}»</div>
    ${SQ.hint ? `<div class="tip">${esc(x.h || '')}</div>` : '<button class="linkbtn" data-a="hint">Подсказка</button>'}
    ${SQ.open ? `<div class="back"><div class="bookq">«${stars(it.pair[1])}» ${play(it.pair[1].replace(/\*/g, ''))}</div>
      <div class="hint">${esc(accent(x.w))} — ${esc(lower1(x.m))}</div></div>
      <div class="btns"><button class="btn no" data-a="again">Ещё раз</button><button class="btn" data-a="said">Сказала</button></div>`
      : '<div class="btns"><button class="btn" data-a="sayopen">Показать</button></div>'}</div>`, { cat: true, tc: 'lav', sh: 'blue' })}</div>`);
}

// ---------- мысль дня ----------
let TIMER = null, REC = null;
function think() {
  setTab('');
  const plan = thinkPlan();
  if (plan.done) return thinkDone(plan);
  const draft = (S.draft && S.draft.day === today()) ? S.draft.text : '';
  view(head('минуты', 2, 'Каждый день · 3–5 минут', 'Мысль дня', 'порассуждай вслух и вставь слова') +
  `<div class="stack">${card('Вопрос дня', `
    <h2 class="question">${esc(plan.q)}</h2>
    <div class="label">Вставь в речь</div>
    <div class="chips targets" style="margin-top:8px">${plan.targets.map(id => `<span data-id="${id}">${esc(accent(item(id).w))}</span>`).join('')}</div>`,
    { cat: true, navy: true, sh: 'yellow' })}</div>
  <div class="tools"><button class="btn light" data-a="timer">▶ 2:00</button>${SR ? '<button class="btn light" data-a="mic">● Диктовать</button>' : ''}</div>
  <textarea id="speech" rows="7" placeholder="Говори в микрофон клавиатуры или пиши. Слова отметятся сами.">${esc(draft)}</textarea>
  <div class="btns"><button class="btn" data-a="finish">Готово</button></div>`);
  const ta = $('#speech');
  const mark = () => {
    document.querySelectorAll('.targets span').forEach(s => s.classList.toggle('on', found(item(s.dataset.id), ta.value)));
    S.draft = { day: today(), text: ta.value }; save();
  };
  ta.addEventListener('input', mark); mark();
}
function thinkDone(plan) {
  const missed = plan.targets.filter(id => !plan.used.includes(id));
  const names = ids => ids.map(id => '<strong>' + esc(accent(item(id).w)) + '</strong>').join(', ');
  view(head('вставила', `${plan.used.length}/${plan.targets.length}`, 'Мысль дня · готово', 'Мысль дня', esc(plan.q)) +
  `<div class="stack">
    ${card('Твоя мысль', `
      <div class="spoken">${highlight(plan.text, [[plan.used, 'used'], [plan.extra || [], 'extra']])}</div>
      ${missed.length ? `<p class="note" style="margin-top:12px">Не пришли: ${names(missed)} — завтра снова в карточках.</p>` : ''}
      ${(plan.extra || []).length ? `<p class="note" style="margin-top:6px">Сверх плана: ${names(plan.extra)} <mark class="extra">вот так</mark></p>` : ''}`,
      { cat: true, tc: 'yellow', sh: 'blue' })}
    ${card('Разбор', `
      <p class="note">Как сказать то же точнее и куда ещё просились слова из банка. Работает, когда включён компьютер.</p>
      <div class="btns"><button class="btn light" data-a="ai">Разобрать с ИИ</button></div>
      <div id="aiout"></div>`, { tc: 'lav', sh: 'pink' })}
    <a class="btn wide" href="#/">На главную</a>
  </div>`);
}

// ---------- из книги ----------
function add() {
  setTab('add');
  view(head('моих', S.mine.length, 'Свои слова', 'Из книги', 'встретила слово — запиши его с фразой') +
  `<div class="stack">
    ${card('Новое слово', `<form class="form" id="addf">
      <label>Слово<input name="w" required autocomplete="off" placeholder="пиетет"></label>
      <label>Фраза из книги<textarea name="q" rows="3" required placeholder="К старым мастерам он относился с почти религиозным пиететом."></textarea></label>
      <label><span>Книга <small>— можно пропустить</small></span><input name="b" autocomplete="off"></label>
      <label><span>Что значит <small>— можно пропустить</small></span><input name="m" autocomplete="off" placeholder="благоговейное уважение"></label>
      <button class="btn">Добавить</button>
      <p class="note">В карточках оно придёт цитатой с пропуском: вспомнить слово по фразе.</p>
    </form>`, { cat: true, tc: 'yellow', sh: 'blue' })}
    ${S.mine.length ? card(`Мои слова · ${S.mine.length}`, S.mine.slice().reverse().map(x => `
      <div class="wrow"><a href="#/w/${x.id}"><b>${esc(x.w)}</b><small>${esc(x.b || x.q)}</small></a>
      <i class="dot ${status(x.id)}"></i><button class="del" data-a="del" data-id="${x.id}" aria-label="Удалить">✕</button></div>`).join(''),
      { tc: 'blue', sh: 'lav' }) : ''}
  </div>`);
  $('#addf').addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target), w = f.get('w').trim(), q = f.get('q').trim();
    if (!found({ p: [stemOf(w)] }, q)) { toast('Не нашла слово во фразе — проверь написание'); return; }
    addMine(w, q, f.get('b').trim(), f.get('m').trim());
    toast('Добавлено — придёт в карточках'); add();
  });
}

// ---------- банк ----------
let BF = { t: 'all', q: '' };
function bank() {
  setTab('bank');
  const c = counts();
  const themes = [['all', 'Все']].concat(THEMES.map(t => [t.id, t.name]), S.mine.length ? [['mine', 'Мои']] : []);
  view(head('всего', c.total, 'Банк', 'Слова и связки', 'в речи ' + c.speech + ' · учу ' + c.learn) +
  `<input id="bq" type="search" placeholder="Найти слово" value="${esc(BF.q)}" style="margin-top:18px">
  <div class="pills">${themes.map(([id, n]) => `<button class="pill ${BF.t === id ? 'on' : ''}" data-a="theme" data-id="${id}">${n}</button>`).join('')}</div>
  <div class="stack">${card(themes.find(t => t[0] === BF.t)[1], '<div id="blist"></div>', { cat: true, tc: 'blue', sh: 'pink' })}</div>
  <p class="note" style="margin-top:14px"><i class="dot"></i> впереди · <i class="dot learn"></i> учу · <i class="dot speech"></i> в речи</p>`);
  const draw = () => {
    const q = norm(BF.q.trim());
    const xs = allItems().filter(x => (BF.t === 'all' || x.t === BF.t) && (!q || norm(plain(x.w)).includes(q) || norm(x.m || '').includes(q)));
    $('#blist').innerHTML = xs.map(x => `<a class="wrow" href="#/w/${x.id}"><span><b>${esc(accent(x.w))}</b><small>${esc(x.m || x.q || '')}</small></span><i class="dot ${status(x.id)}"></i></a>`).join('')
      || '<p class="note">Ничего не нашлось.</p>';
  };
  $('#bq').addEventListener('input', e => { BF.q = e.target.value; draw(); });
  draw();
}
function word(id) {
  const x = item(id);
  if (!x) return bank();
  setTab(x.k === 'm' ? 'add' : 'bank');
  const st = status(id);
  const label = { speech: 'в речи', learn: 'учу', new: 'ещё не в карточках' }[st];
  const [kind, tc] = KIND[x.k];
  view(`<a class="back-link" href="#/${x.k === 'm' ? 'add' : 'bank'}">← ${x.k === 'm' ? 'Из книги' : 'Банк'}</a>
  <div class="stack">${card(kind, `<div class="face">
    <div class="src">${themeName(x.t)} · <i class="dot ${st}"></i> ${label}</div>
    <div class="back" style="border:0;margin:0">
      <div class="word">${esc(accent(x.w))}${play(x.w)}</div>
      ${x.m ? `<div class="mean" style="margin:0">${esc(x.m)}</div>` : ''}
      ${x.c ? `<div class="chips">${x.c.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : ''}
      ${x.e ? `<p class="ex">${highlight(x.e, [[[x.id], 'own']])}${play(x.e)}</p>` : ''}
      ${x.q ? `<p class="ex">${highlight(x.q, [[[x.id], 'own']])}</p>${x.b ? `<p class="note">«${esc(x.b)}»</p>` : ''}` : ''}
      ${x.n ? `<p class="nb"><strong>Не путать.</strong> ${esc(x.n)}</p>` : ''}
      ${x.s ? `<div class="label" style="margin-top:6px">Скажи книжно</div>${x.s.map(p => `<p class="pair"><span>«${esc(p[0])}»</span><span>→ «${stars(p[1])}»</span></p>`).join('')}` : ''}
      ${S.used[id] ? `<p class="tip">Сказала сама: ${S.used[id]} ${plural(S.used[id], 'раз', 'раза', 'раз')}</p>` : ''}
    </div>
    ${st === 'new' ? `<div class="btns"><button class="btn" data-a="learn" data-id="${id}">В карточки сегодня</button></div>` : ''}
  </div>`, { cat: true, tc, sh: 'blue' })}</div>`);
}

// ---------- ещё ----------
function more() {
  setTab('');
  const vs = ruVoices(), cur = bestVoice();
  view(head('новых', S.settings.newPerDay, 'Настройки', 'Ещё', 'голос, сколько новых, как это устроено') +
  `<div class="stack">
    ${card('Новых карточек в день', `<div class="pills" style="margin:0">${[5, 10, 15, 20].map(n => `<button class="pill ${S.settings.newPerDay === n ? 'on' : ''}" data-a="newn" data-id="${n}">${n}</button>`).join('')}</div>`,
      { cat: true, tc: 'yellow', sh: 'blue' })}
    ${card('Голос', vs.length ? `<select id="voice">${vs.map(v => `<option value="${esc(v.voiceURI)}" ${cur && v.voiceURI === cur.voiceURI ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
      <div class="btns"><button class="btn light" data-speak="Он не спорил по существу — он апеллировал к жалости.">▶ Послушать</button></div>`
      : '<p class="note">В этом браузере нет русского голоса. На айфоне: Настройки → Универсальный доступ → Устная речь → Голоса → Русский, скачать «Милена (улучшенный)».</p>',
      { tc: 'blue', sh: 'lav' })}
    ${card('Как устроен Слог', `
      <p>Каждое упражнение идёт от мысли к слову: смысл или простая фраза — а слово ты достаёшь сама и говоришь вслух.</p>
      <p style="margin-top:8px">«Вспомнила» — карточка вернётся через 1, 3, 7, 14, 30, 60 дней. «Не пришло» — ещё раз сегодня.</p>
      <p style="margin-top:8px">Слово «в речи», когда ты сама вставила его в «Мысль дня».</p>
      <p class="note" style="margin-top:8px">Прогресс хранится в этом браузере.</p>`, { tc: 'lav', sh: 'pink' })}
  </div>`);
  const sel = $('#voice');
  if (sel) sel.addEventListener('change', () => { S.settings.voice = sel.value; save(); });
}

// ---------- кнопки ----------
document.addEventListener('click', e => {
  const sp = e.target.closest('[data-speak]');
  if (sp) { speak(sp.dataset.speak); return; }
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const a = b.dataset.a, id = b.dataset.id;
  if (a === 'open') { CQ.open = true; cards(); }
  else if (a === 'got' || a === 'miss') {
    const cur = CQ.q.shift();
    answer(cur, a === 'got');
    if (a === 'got') CQ.passed++; else CQ.q.push(cur);
    CQ.open = false; cards();
  }
  else if (a === 'more5') { dayRec().extra = (dayRec().extra || 0) + 5; save(); cards(true); }
  else if (a === 'hint') { SQ.hint = true; say(); }
  else if (a === 'sayopen') { SQ.open = true; say(); }
  else if (a === 'said' || a === 'again') {
    const cur = SQ.q.shift();
    if (a === 'said') { SQ.passed++; dayRec().say++; save(); } else SQ.q.push(cur);
    SQ.open = false; SQ.hint = false; say();
  }
  else if (a === 'timer') runTimer(b);
  else if (a === 'mic') toggleMic(b);
  else if (a === 'finish') {
    const text = $('#speech').value.trim();
    if (!text) { toast('Сначала скажи или напиши мысль'); return; }
    stopAll(); finishThink(thinkPlan(), text); S.draft = null; save(); think();
  }
  else if (a === 'ai') aiReview();
  else if (a === 'del') { if (confirm('Удалить это слово?')) { S.mine = S.mine.filter(x => x.id !== id); delete S.cards[id]; save(); add(); } }
  else if (a === 'theme') { BF.t = id; bank(); }
  else if (a === 'learn') { S.cards[id] = { box: 0, due: today(), seen: today(), miss: 0 }; save(); toast('Придёт в карточках сегодня'); word(id); }
  else if (a === 'newn') { S.settings.newPerDay = +id; save(); more(); }
});

function runTimer(b) {
  if (TIMER) { clearInterval(TIMER); TIMER = null; b.textContent = '▶ 2:00'; return; }
  let left = 120;
  const tick = () => {
    b.textContent = `■ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (left-- <= 0) { clearInterval(TIMER); TIMER = null; b.textContent = 'Время!'; if (navigator.vibrate) navigator.vibrate(300); }
  };
  tick(); TIMER = setInterval(tick, 1000);
}
function toggleMic(b) {
  if (REC) { REC.stop(); REC = null; b.textContent = '● Диктовать'; b.classList.remove('rec'); return; }
  REC = new SR(); REC.lang = 'ru-RU'; REC.continuous = true; REC.interimResults = false;
  REC.onresult = ev => {
    const ta = $('#speech');
    for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) ta.value += (ta.value && !/\s$/.test(ta.value) ? ' ' : '') + ev.results[i][0].transcript;
    ta.dispatchEvent(new Event('input'));
  };
  REC.onend = () => { if (REC) { REC = null; b.textContent = '● Диктовать'; b.classList.remove('rec'); } };
  REC.start(); b.textContent = '■ Стоп'; b.classList.add('rec');
}
function stopAll() { if (TIMER) { clearInterval(TIMER); TIMER = null; } if (REC) { REC.stop(); REC = null; } }

// Разбор ИИ: адрес сервера на её компьютере (S.settings.ai). Подключается следующим шагом.
async function aiReview() {
  const out = $('#aiout');
  if (!S.settings.ai) { out.innerHTML = '<p class="note" style="margin-top:12px">Разбор ещё не подключён: он пойдёт через Claude на твоём компьютере.</p>'; return; }
  out.innerHTML = '<p class="note" style="margin-top:12px">Разбираю…</p>';
  const plan = S.think[today()];
  try {
    const r = await fetch(S.settings.ai + '/review', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: plan.q, text: plan.text, targets: plan.targets.map(id => plain(item(id).w)) }) });
    const j = await r.json();
    out.innerHTML = `<div class="spoken" style="margin-top:12px">${esc(j.text || '').replace(/\n/g, '<br>')}</div>`;
  } catch (e) { out.innerHTML = '<p class="note" style="margin-top:12px">Компьютер не отвечает. Разбор работает, когда он включён.</p>'; }
}

// ---------- маршруты ----------
let LAST = '';
function route() {
  stopAll();
  const [path] = (location.hash.slice(1) || '/').split('?');
  const [, name, arg] = path.split('/');
  const enter = name !== LAST; LAST = name;
  if (name === 'cards') cards(enter);
  else if (name === 'say') say(enter);
  else if (name === 'think') think();
  else if (name === 'add') add();
  else if (name === 'bank') bank();
  else if (name === 'w') word(arg);
  else if (name === 'more') more();
  else home();
}
window.addEventListener('hashchange', route);
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { if (LAST === 'more') more(); };
if (DEMO !== null) seedDemo(DEMO);
route();
if ('serviceWorker' in navigator && DEMO === null && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js');

// Образец прогресса для картинок экранов: ?demo (и ?demo=done — «Мысль дня» уже сказана). Хранится отдельно, `slog-demo`.
function seedDemo(mode) {
  const t = today();
  S = { cards: {}, mine: [], days: {}, used: {}, think: {}, settings: { newPerDay: 10, voice: '' } };
  BANK.slice(0, 18).forEach((x, i) => { S.cards[x.id] = { box: i % 5, due: i < 6 ? t : addDays(t, 1 + i % 6), seen: addDays(t, -(i % 6) - 1), miss: 0 }; });
  ['gedonizm', 'apellirovat', 'otnyud', 'ne-stolko'].forEach(id => S.used[id] = 1);
  for (let i = 1; i <= 5; i++) S.days[addDays(t, -i)] = { cards: 14, fresh: 5, say: 5, think: i % 2 === 1 };
  S.mine.push({ id: 'my-demo', k: 'm', t: 'mine', w: 'пиетет', q: 'К старым мастерам он относился с почти религиозным пиететом.', b: '', m: '', p: ['пиетет'], added: addDays(t, -2) });
  S.cards['my-demo'] = { box: 0, due: t, seen: addDays(t, -2), miss: 1 };
  const plan = { q: 'Гедонизм — слабость или мудрость?', targets: ['gedonizm', 'tshchetny', 'konformizm', 'ne-stolko'], text: '', done: false };
  const text = 'Мне кажется, гедонизм — это не столько слабость, сколько честность с собой. Попытки жить только ради долга часто тщетны: человек выгорает и уже никому не помогает. Справедливости ради, без дисциплины тоже ничего не построишь.';
  S.think[t] = plan;
  if (mode === 'done') { S.days[t] = { cards: 12, fresh: 6, say: 5, think: false }; finishThink(plan, text); }
  else S.draft = { day: t, text: text.split('. ')[0] + '.' };
  save();
}
