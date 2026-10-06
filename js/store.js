// Прогресс Слога: всё в localStorage `slog` (только этот браузер).
// cards: id -> {box, due, seen, miss}; mine: свои слова из книг; days: дата -> что сделано;
// used: id -> сколько раз слово само попало в речь («Мысль дня»); think: дата -> запись дня.

const DEMO = new URLSearchParams(location.search).get('demo');
const KEY = DEMO !== null ? 'slog-demo' : 'slog';
const BOXES = [0, 1, 3, 7, 14, 30, 60];

function loadState() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  const st = Object.assign({ cards: {}, mine: [], days: {}, used: {}, think: {}, settings: { newPerDay: 30, voice: '' } }, s);
  if (st.settings.newPerDay === 10) st.settings.newPerDay = 30; // старое значение по умолчанию (6 окт: «в день намного больше слов»)
  return st;
}
let S = loadState();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function today() { return ymd(new Date()); }
function addDays(day, n) { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
function dayRec(d = today()) { return S.days[d] || (S.days[d] = { cards: 0, fresh: 0, say: 0, think: false }); }

// Ударение: апостроф после гласной -> знак ударения. Для голоса и поиска — без него.
function accent(s) { return s.replace(/'/g, '́'); }
function plain(s) { return s.replace(/'/g, ''); }
function norm(s) { return s.toLowerCase().replace(/ё/g, 'е'); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// Все карточки: банк + свои слова. Своё слово без смысла показывается цитатой с пропуском.
function allItems() { return BANK.concat(S.mine); }
function item(id) { return allItems().find(x => x.id === id); }

function status(id) {
  if (S.used[id]) return 'speech';
  if (S.cards[id]) return 'learn';
  return 'new';
}

// Очередь дня: сначала те, чей срок пришёл, потом новые (свои слова первыми). Связки в карточки не идут
// (её слова 6 окт: «не слово, а конструкция; нужны только сложные слова»).
function freshOrder() {
  const mine = S.mine.filter(x => !S.cards[x.id]);
  const words = BANK.filter(x => x.k === 'w' && !S.cards[x.id]);
  return mine.concat(words);
}
function dueIds() {
  const t = today();
  return Object.keys(S.cards).filter(id => S.cards[id].due <= t && item(id) && item(id).k !== 'l')
    .sort((a, b) => S.cards[a].box - S.cards[b].box);
}
function freshLeft() { const r = dayRec(); return Math.max(0, S.settings.newPerDay + (r.extra || 0) - r.fresh); }
function queue() {
  return dueIds().concat(freshOrder().slice(0, freshLeft()).map(x => x.id));
}

// Знакомство: новое слово показано открытым, она прочитала вслух — завтра придёт по смыслу.
function intro(id) {
  const t = today(), r = dayRec();
  if (!S.cards[id]) { S.cards[id] = { box: 0, due: addDays(t, 1), seen: t, miss: 0 }; r.fresh++; }
  r.cards++;
  save();
}

function answer(id, got) {
  const t = today(), r = dayRec();
  let c = S.cards[id];
  if (!c) { c = S.cards[id] = { box: 0, due: t, seen: t, miss: 0 }; r.fresh++; }
  if (got) { c.box = Math.min(c.box + 1, BOXES.length - 1); c.due = addDays(t, BOXES[c.box]); }
  else { c.box = 0; c.due = t; c.miss++; }
  r.cards++;
  save();
}

// «Скажи книжно»: пять фраз из слов, которые уже встречались в карточках (свежие первыми).
function sayPool(n = 5) {
  const seen = Object.keys(S.cards).map(item).filter(x => x && x.s && x.s.length)
    .sort((a, b) => S.cards[b.id].seen.localeCompare(S.cards[a.id].seen) || S.cards[a.id].box - S.cards[b.id].box);
  const src = seen.length ? seen : queue().map(item).filter(x => x && x.s && x.s.length);
  const out = [];
  const seed = hash(today());
  for (const x of src) {
    out.push({ id: x.id, pair: x.s[(seed + x.id.length) % x.s.length] });
    if (out.length >= n) break;
  }
  return out;
}

function hash(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

// «Мысль дня»: вопрос и 4 слова на сегодня, одни и те же весь день (связок нет — её решение 6 окт).
function thinkPlan() {
  const t = today();
  if (S.think[t]) return S.think[t];
  const seed = hash(t);
  const q = QUESTIONS[seed % QUESTIONS.length];
  const seen = Object.keys(S.cards).map(item).filter(Boolean);
  const pool = (seen.length >= 3 ? seen : seen.concat(queue().map(item))).filter(Boolean);
  const words = pool.filter(x => x.k !== 'l').sort((a, b) => (S.used[a.id] || 0) - (S.used[b.id] || 0)).slice(0, 4);
  return { q, targets: words.map(x => x.id), text: '', done: false };
}

// Нашлось ли слово в тексте: по его основам (p), без учёта регистра и «ё».
function found(x, text) {
  const t = norm(text);
  const pats = x.p || [norm(plain(x.w)).slice(0, Math.max(4, plain(x.w).length - 2))];
  return pats.some(p => new RegExp(p.replace(/ё/g, 'е')).test(t));
}

function finishThink(plan, text) {
  const t = today();
  plan.text = text;
  plan.used = plan.targets.filter(id => found(item(id), text));
  plan.extra = allItems().filter(x => !plan.targets.includes(x.id) && found(x, text)).map(x => x.id);
  plan.done = true;
  S.think[t] = plan;
  for (const id of plan.used.concat(plan.extra)) S.used[id] = (S.used[id] || 0) + 1;
  // Что не вставила — завтра снова в карточках.
  for (const id of plan.targets) if (!plan.used.includes(id) && S.cards[id]) S.cards[id].due = addDays(t, 1);
  dayRec().think = true;
  save();
}

// Грубая основа своего слова, чтобы узнать его в других формах: кичиться -> кичи (кичился, кичится).
const ENDS = ['ироваться', 'ировать', 'иться', 'аться', 'яться', 'еться', 'ться', 'ость', 'ание', 'ение', 'ить', 'ать', 'ять',
  'еть', 'уть', 'ыть', 'ный', 'ной', 'ний', 'ский', 'ый', 'ий', 'ой', 'ая', 'яя', 'ое', 'ее', 'ие', 'ые', 'изм', 'ист', 'ия',
  'ть', 'ь', 'а', 'я', 'о', 'е', 'ы', 'и', 'у', 'ю', 'й'];
function stemOf(word) {
  const w = norm(word).trim().replace(/[.*+?^${}()|[\]\\]/g, '');
  if (/\s/.test(w)) return w;
  for (const e of ENDS) if (w.endsWith(e) && w.length - e.length >= 4) return w.slice(0, -e.length);
  return w;
}

function addMine(word, quote, book, meaning) {
  const id = 'my-' + Date.now().toString(36);
  S.mine.push({ id, k: 'm', t: 'mine', w: word, q: quote, b: book, m: meaning || '', p: [stemOf(word)], added: today() });
  save();
  return id;
}

function streak() {
  let d = today(), n = 0;
  const active = x => { const r = S.days[x]; return r && (r.cards || r.say || r.think); };
  if (!active(d)) d = addDays(d, -1);
  while (active(d)) { n++; d = addDays(d, -1); }
  return n;
}

function counts() {
  const ids = allItems().map(x => x.id);
  const speech = ids.filter(id => status(id) === 'speech').length;
  const learn = ids.filter(id => status(id) === 'learn').length;
  return { speech, learn, ahead: ids.length - speech - learn, total: ids.length };
}
