
/* =========================================================
   DÁTA – sem admin pri exporte vloží schválené lekcie.
   { subjects:[{key,name,sk}], lessons:[{...lekcia}] }
   ========================================================= */
let APP = /*__DATA__*/{"external":true}/*__END__*/;

/* Vlastné SVG kresby (lekcie ich môžu použiť cez "svg:názov") */
const SVG = {
  lever:`<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M60 78 L46 100 H74 Z" fill="var(--sun)"/><path d="M12 88 L108 62"/><rect x="14" y="60" width="24" height="22" rx="3" transform="rotate(-15 26 71)" fill="var(--card)"/><path d="M104 30 V52 M96 44 L104 54 L112 44"/></svg>`,
  fulcrum:`<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 76 L108 76" opacity=".45"/><path d="M60 78 L40 108 H80 Z" fill="var(--sun)"/><circle cx="60" cy="40" r="16"/><path d="M60 56 V70 M54 64 L60 72 L66 64"/></svg>`,
  ramp:`<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 100 H110 V40 Z" fill="var(--sun)"/><rect x="44" y="50" width="24" height="24" rx="3" transform="rotate(-31 56 62)" fill="var(--card)"/><path d="M22 70 L40 60 M32 56 L40 60 L36 68"/></svg>`,
  pulley:`<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10 H100 M60 10 V24"/><circle cx="60" cy="38" r="16" fill="var(--sun)"/><circle cx="60" cy="38" r="3" fill="currentColor"/><path d="M44 38 V80 M76 38 V104"/><rect x="32" y="80" width="24" height="22" rx="3" fill="var(--card)"/><path d="M70 96 L76 106 L82 96"/></svg>`,
  gear:`<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><g transform="translate(46 62)"><path fill="var(--sun)" d="M-6 -34 H6 L8 -26 L16 -22 L23 -27 L31 -19 L26 -12 L30 -4 L38 -2 V10 L30 12 L26 20 L31 27 L23 35 L16 30 L8 34 L6 42 H-6 L-8 34 L-16 30 L-23 35 L-31 27 L-26 20 L-30 12 L-38 10 V-2 L-30 -4 L-26 -12 L-31 -19 L-23 -27 L-16 -22 L-8 -26 Z" transform="translate(0 -4)"/><circle r="10"/></g><g transform="translate(92 34)"><path fill="var(--card)" d="M-4 -22 H4 L6 -16 L12 -12 L18 -16 L22 -10 L17 -5 L19 1 L25 3 V9 L19 11 L17 17 L22 22 L18 28 L12 24 L6 28 L4 34 H-4 L-6 28 L-12 24 L-18 28 L-22 22 L-17 17 L-19 11 L-25 9 V3 L-19 1 L-17 -5 L-22 -10 L-18 -16 L-12 -12 L-6 -16 Z" transform="translate(0 -6)"/><circle r="6"/></g></svg>`
};

/* ===== Pomocné funkcie ===== */
const $app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const pic = p => { p = String(p || "⭐"); return p.startsWith("svg:") ? (SVG[p.slice(4)] || "⭐") : esc(p); };
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/* Poradie odpovedí: vždy náhodne (AI často dáva správnu odpoveď na prvé miesto).
   Výnimka: true/false zostáva v pevnom poradí, aby sa žiak nemýlil. */
const mix = opts => { const o = [...(opts || [])]; const tf = o.length === 2 && o.map(x => String(x).toLowerCase()).sort().join() === "false,true";
  return tf ? o.slice().sort((a, b) => String(b).toLowerCase() === "true" ? 1 : -1) : shuffle(o); };
const starsFor = (s, t) => !t ? 0 : s >= t * .9 ? 3 : s >= t * .7 ? 2 : s >= t * .5 ? 1 : 0;

/* Výslovnosť – hlas zabudovaný v tablete */
function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text), v = speechSynthesis.getVoices();
    // len hlasy uložené v tablete (localService) – niektoré „online“ hlasy posielajú text na server
    const local = v.filter(x => x.localService && x.lang && x.lang.startsWith("en"));
    if (!local.length) return;
    u.voice = local.find(x => x.lang === "en-GB") || local[0];
    u.lang = "en-GB"; u.rate = .85; speechSynthesis.speak(u);
  } catch (e) {}
}

/* ===== Pokrok žiaka (uložený v tablete) ===== */
const KEY = "clil4-progress";
let P = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();
P.lessons = P.lessons || {};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };
const LP = id => (P.lessons[id] = P.lessons[id] || { learn:false, read:false, practice:false, draw:false, robot:false, best:0 });
/* Kroky lekcie – bežná lekcia má 6 krokov, preskúšanie pred písomkou len tie, na ktoré má obsah */
const stepsFor = l => ["learn",
  ...(l.reading && l.reading.paragraphs && l.reading.paragraphs.length ? ["read"] : []),
  "practice",
  ...(!l.extra ? ["draw"] : []),
  ...(l.robot && ((l.robot.statements || []).length || (l.robot.prompts || []).length) ? ["robot"] : []),
  "test"];
const stepsDone = (lp, l) => stepsFor(l).filter(k => k === "test" ? lp.best > 0 : lp[k]).length;

/* Preskúšania pred písomkou – aktívne do dňa písomky vrátane */
const TODAY = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
const activeExtras = () => APP.lessons.filter(l => l.extra && (!l.testDate || l.testDate >= TODAY));
const regular = () => APP.lessons.filter(l => !l.extra);
function testWhen(l) {
  if (!l.testDate) return "";
  if (l.testDate === TODAY) return "Test is TODAY! 💪";
  const d = new Date(l.testDate + "T12:00"), days = Math.round((d - new Date(TODAY + "T12:00")) / 864e5);
  const name = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return days === 1 ? `Test is tomorrow (${name})` : `Test on ${name} · in ${days} days`;
}

/* ===== Chyby na opakovanie =====
   Každá chyba (test, doplňovačka, spájačka, triedenie, robot) sa uloží ako otázka.
   V „Practise my mistakes“ ju treba 2× za sebou zodpovedať správne, potom zmizne. */
P.mistakes = P.mistakes || [];
function addMistake(m) {
  m.id = (S.lesson || "") + "|" + m.q + "|" + m.answer;
  m.lesson = S.lesson; m.need = 2;
  const old = P.mistakes.find(x => x.id === m.id);
  if (old) old.need = 2; else P.mistakes.push(m);
  if (P.mistakes.length > 200) P.mistakes.shift();
  save();
}
const wordQ = w => ({ pic: w.pic, q: "What is it?", qSk: "Čo je na obrázku?", answer: w.en,
  options: mix([w.en, ...shuffle(L().words.filter(x => x !== w)).slice(0, 2).map(x => x.en)]) });

/* Kresby – každá lekcia má vlastný kľúč (obrázky sú väčšie) */
const DKEY = id => "clil4-draw-" + id;
const loadDrawing = id => { try { return localStorage.getItem(DKEY(id)); } catch (e) { return null; } };
document.body.classList.toggle("show-sk", !!P.sk);

/* ===== Stav ===== */
let S = { screen: "home", subject: null, lesson: null };
const L = () => APP.lessons.find(x => x.id === S.lesson);
const TMAX = l => l.extra ? 12 : 10;
const TEST_TOTAL = () => Math.min(TMAX(L()), (L().test || []).length + 2);

function go(screen, extra = {}) {
  S = Object.assign({ screen, subject: S.subject, lesson: S.lesson }, extra);
  if (screen === "practice") setupPractice();
  if (screen === "robot") { const R = L().robot || {}; S.rOrder = null; S.r = { part: (R.statements||[]).length ? 0 : (R.prompts||[]).length ? 1 : -1, i: 0, pick: null }; if (S.r.part === -1) { LP(S.lesson).robot = true; save(); } }
  if (screen === "test") setupTest();
  if (screen === "mistakes") setupMistakes();
  if (screen === "draw") S.dr = { color: "#1D2A5B", size: 8, label: null, used: [] };
  render(); window.scrollTo(0, 0);
  if (screen === "draw") initCanvas();
}

function topbar(back) {
  return `<div class="topbar">
    ${back ? `<button class="iconbtn" data-a="go" data-to="${back}" aria-label="Back">${back === "home" ? "🏠" : "◀"}</button>` : ""}
    <div class="spacer"></div>
    <button class="iconbtn" data-a="sk" aria-pressed="${!!P.sk}">🇸🇰 SK</button>
  </div>`;
}

/* ===== DOMOV =====
   Všetky lekcie sú viditeľné. Lekcie aktuálneho mesiaca sú hore a zvýraznené. */
const NOW_M = new Date().getMonth() + 1;
function lessonCard(l, hot) {
  const lp = LP(l.id), st = starsFor(lp.best, Math.min(TMAX(l), (l.test || []).length + 2));
  const done = stepsDone(lp, l), total = stepsFor(l).length;
  return `<button class="lesson ${hot ? "hot" : ""} ${l.extra ? "extra" : ""}" data-a="open" data-id="${esc(l.id)}">
    <span class="ico">${pic(l.icon || (l.words && l.words[0] && l.words[0].pic))}</span>
    <span><h3>${esc(l.title)}</h3><p>${l.extra ? `<b>${esc(testWhen(l))}</b><br>` : ""}${done === total ? "Finished ✓" : `${done}/${total} steps done`}<span class="sk"> · ${esc(l.titleSk || "")}</span></p></span>
    <span class="st">${st ? "⭐".repeat(st) : "▶"}</span></button>`;
}
function renderHome() {
  const subs = APP.subjects.filter(s => regular().some(l => l.subject === s.key));
  const ex = activeExtras();
  const exBox = ex.length ? `<section class="now testbox"><div class="now-title">📝 Before the test<span class="sk"> · Pred písomkou</span></div>
    <div class="lessons">${ex.map(l => lessonCard(l, true)).join("")}</div></section>` : "";
  if (!subs.length && !ex.length) return topbar() + `<div class="empty">No lessons yet.<br><span class="sk">Zatiaľ tu nie sú žiadne lekcie.</span></div>`;
  if (subs.length && !subs.find(s => s.key === S.subject)) S.subject = (subs.find(s => regular().some(l => l.subject === s.key && l.m === NOW_M)) || subs[0]).key;
  const list = regular().filter(l => l.subject === S.subject);
  const now = list.filter(l => l.m === NOW_M), rest = list.filter(l => l.m !== NOW_M);
  let html = "";
  if (now.length) html += `<section class="now"><div class="now-title">⭐ This month: ${esc(now[0].month || "")}<span class="sk"> · Tento mesiac</span></div>
    <div class="lessons">${now.map(l => lessonCard(l, true)).join("")}</div></section>`;
  let grp = null;
  html += `<div class="lessons">`;
  rest.forEach(l => {
    if (l.month !== grp) { grp = l.month; html += `<div class="unit-title">${esc(grp || "")}</div>`; }
    html += lessonCard(l, false);
  });
  html += `</div>`;
  return topbar() + `<div class="hello"><h1>My lessons</h1><p>Choose a subject and a lesson.<br><span class="sk">Vyber si predmet a lekciu.</span></p></div>
    <div class="tabs" role="tablist">${subs.map(s => {
      const hasNow = regular().some(l => l.subject === s.key && l.m === NOW_M);
      return `<button class="tab" role="tab" aria-selected="${s.key === S.subject}" data-a="subj" data-k="${s.key}">${esc(s.name)}${hasNow ? " ⭐" : ""}</button>`; }).join("")}</div>
    ${exBox}
    <div class="home-actions">
      <button class="big ${P.mistakes.length ? "fix" : "ghost"}" data-a="go" data-to="mistakes" ${P.mistakes.length ? "" : "disabled"}>🔁 My mistakes (${P.mistakes.length})</button>
      <button class="big ghost" data-a="go" data-to="progress">📊 My progress</button>
    </div>
    ${html}`;
}

/* ===== LEKCIA – 5 krokov ===== */
function renderLesson() {
  const l = L(), lp = LP(l.id), st = starsFor(lp.best, TEST_TOTAL());
  const steps = [
    { id:"learn", t:"Learn the words", sk:"Nauč sa slovíčka", d:`${l.words.length} words`, done:lp.learn },
    { id:"read", t:"Read", sk:"Čítaj", d:"A short text", done:lp.read },
    { id:"practice", t:"Practice", sk:"Precvičuj", d:"Match and fill in", done:lp.practice },
    { id:"draw", t:"Draw it", sk:"Nakresli", d:"Draw and label a picture", done:lp.draw },
    { id:"robot", t:"Check the robot", sk:"Skontroluj robota", d:"Robots make mistakes too!", done:lp.robot, robot:true },
    { id:"test", t:"Test", sk:"Test", d:lp.best ? `Best: ${lp.best}/${TEST_TOTAL()}` : `${TEST_TOTAL()} questions`, done:lp.best > 0 }
  ].filter(x => stepsFor(l).includes(x.id));
  return topbar(APP.single ? null : "home") + `
    <div class="hero"><div class="hero-pic">${pic(l.icon || l.words[0].pic)}</div>
      <div><h1>${esc(l.title)}</h1><p class="sk">${esc(l.titleSk || "")}</p>${l.extra && l.testDate ? `<p><span class="testtag">📝 ${esc(testWhen(l))}</span></p>` : ""}${l.intro ? `<p>${esc(l.intro)}</p>` : ""}</div></div>
    <div class="path">${steps.map((s, i) => `
      <button class="step ${s.done ? "done" : ""} ${s.robot ? "robot" : ""}" data-a="go" data-to="${s.id}">
        <span class="num">${s.done ? "✓" : s.robot ? "🤖" : i + 1}</span>
        <span><h2>${s.t}</h2><p><span class="sk">${s.sk}. </span>${s.d}</p></span>
        <span class="go">${s.id === "test" && st ? "⭐".repeat(st) : "▶"}</span></button>`).join("")}</div>`;
}

/* ===== LEARN ===== */
function renderLearn() {
  const l = L(), i = S.i || 0, w = l.words[i], last = i === l.words.length - 1;
  return topbar("lesson") + `<h2 class="screen-title">Learn the words</h2>
    <p class="lead">Tap 🔊 to listen. Say the word.<br><span class="sk">Ťukni na 🔊 a zopakuj slovo nahlas.</span></p>
    <div class="flash"><div class="pic">${pic(w.pic)}</div><div class="word">${esc(w.en)}</div>
      <div class="trans">${S.flip ? esc(w.sk) : ""}</div><div class="ex">${esc(w.ex || "")}</div></div>
    <div class="row">
      <button class="big ghost" data-a="prev" ${i === 0 ? "disabled" : ""} aria-label="Previous">◀</button>
      <button class="big ghost" data-a="say" data-t="${esc(w.en)}">🔊</button>
      <button class="big ghost" data-a="flip">${S.flip ? "Hide" : "What is it?"}</button>
      <button class="big" data-a="${last ? "learn-done" : "next"}">${last ? "Done ✓" : "Next ▶"}</button></div>
    <div class="dots">${l.words.map((_, k) => `<span class="dot ${k <= i ? "on" : ""}"></span>`).join("")}</div>`;
}

/* ===== READ ===== */
function renderRead() {
  const l = L(), byEn = Object.fromEntries(l.words.map(w => [w.en.toLowerCase(), w]));
  const paras = l.reading.paragraphs.map(p => `<p>${esc(p).replace(/\[([^\]]+)\]/g, (_, t) =>
    byEn[t.toLowerCase()] ? `<button class="w" data-a="word" data-en="${esc(t)}">${t}</button>` : t)}</p>`).join("");
  const sel = S.word && byEn[S.word.toLowerCase()];
  return topbar("lesson") + `<h2 class="screen-title">${esc(l.reading.title)}</h2>
    <p class="lead">Read the text. Tap a <b>yellow word</b> to see what it means.<br><span class="sk">Prečítaj si text. Ťukni na žlté slovo a uvidíš, čo znamená.</span></p>
    <div class="row row-left"><button class="big ghost" data-a="say" data-t="${esc(l.reading.paragraphs.join(" ").replace(/[\[\]]/g, ""))}">🔊 Listen</button></div>
    <div class="reader">${paras}</div>
    <div class="row"><button class="big" data-a="read-done">I read it ✓</button></div>
    ${sel ? `<div class="sheet" role="dialog"><div class="pic">${pic(sel.pic)}</div><div><b>${esc(sel.en)}</b><span>${esc(sel.sk)}</span></div>
      <button class="iconbtn" data-a="say" data-t="${esc(sel.en)}">🔊</button><button class="iconbtn" data-a="close" aria-label="Close">✕</button></div>` : ""}`;
}

/* ===== PRACTICE: spájačka, triedenie (ak je), doplňovačka ===== */
function setupPractice() {
  const l = L(), six = shuffle(l.words).slice(0, 6);
  S.steps = ["match"]; if (l.sort && l.sort.items && l.sort.items.length) S.steps.push("sort"); S.steps.push("gap");
  S.step = 0;
  S.match = { left: six, right: shuffle(six), sel: null, done: [], wrong: null };
  S.sort = { items: l.sort ? shuffle(l.sort.items) : [], i: 0, fb: null };
  S.gap = { items: shuffle(l.gaps || []).map(g => ({ ...g, options: mix(g.options) })), i: 0, fb: null, pick: null };
}
function nextPractice() {
  S.step++;
  if (S.step >= S.steps.length || (S.steps[S.step] === "gap" && !S.gap.items.length)) { LP(S.lesson).practice = true; save(); return go("lesson"); }
  render();
}
function renderPractice() {
  const l = L(), kind = S.steps[S.step], names = { match:"Match", sort:"Sort it", gap:"Fill in" };
  let body = "";
  if (kind === "match") {
    const m = S.match;
    body = `<p class="lead">Tap a picture, then tap its word.<br><span class="sk">Ťukni na obrázok a potom na správne slovo.</span></p>
      <div class="match"><div class="col">${m.left.map((w, k) => `<button class="choice ${m.done.includes(k) ? "ok gone" : m.sel === k ? "sel" : ""}" data-a="m-pic" data-k="${k}" ${m.done.includes(k) ? "disabled" : ""} aria-label="picture"><span class="pic">${pic(w.pic)}</span></button>`).join("")}</div>
      <div class="col">${m.right.map(w => { const k = m.left.indexOf(w); return `<button class="choice ${m.done.includes(k) ? "ok gone" : ""} ${m.wrong === k ? "bad shake" : ""}" data-a="m-word" data-k="${k}" ${m.done.includes(k) ? "disabled" : ""}>${esc(w.en)}</button>`; }).join("")}</div></div>`;
  } else if (kind === "sort") {
    const s = S.sort, it = s.items[s.i], G = l.sort.groups;
    body = `<p class="lead">Where does it belong? Tap the right group.<br><span class="sk">Kam to patrí? Ťukni na správnu skupinu.</span></p>
      <div class="sort-item"><div class="pic">${pic(it.pic)}</div><div class="name">${esc(it.en)}</div></div>
      <div class="grid2">${G.map(g => `<button class="choice bin ${s.fb && s.fb.g === g.id ? (s.fb.ok ? "ok" : "bad shake") : ""} ${s.fb && !s.fb.ok && g.id === it.group ? "ok" : ""}" data-a="sort" data-g="${esc(g.id)}" ${s.fb ? "disabled" : ""}><span class="pic">${pic(g.pic)}</span>${esc(g.en)}</button>`).join("")}</div>
      <div class="feedback ${s.fb ? (s.fb.ok ? "ok" : "bad") : ""}">${s.fb ? (s.fb.ok ? "Great!" : `It goes to: ${esc((G.find(g => g.id === it.group) || {}).en)}`) : `${s.i + 1} / ${s.items.length}`}</div>
      ${s.fb ? `<div class="row"><button class="big" data-a="sort-next">Next ▶</button></div>` : ""}`;
  } else {
    const g = S.gap, it = g.items[g.i];
    body = `<p class="lead">Choose the missing word.<br><span class="sk">Vyber slovo, ktoré chýba.</span></p>
      <div class="panel"><div class="sentence">${esc(it.text).replace("___", `<span class="blank">${g.pick ? esc(g.pick) : "&nbsp;"}</span>`)}</div>
      <div class="grid2">${it.options.map(o => `<button class="choice ${g.fb ? (o === it.answer ? "ok" : o === g.pick ? "bad" : "") : ""}" data-a="gap" data-o="${esc(o)}" ${g.fb ? "disabled" : ""}>${esc(o)}</button>`).join("")}</div>
      <div class="feedback ${g.fb || ""}">${g.fb ? (g.fb === "ok" ? "Yes! Well done." : `The answer is “${esc(it.answer)}”.`) : `${g.i + 1} / ${g.items.length}`}</div></div>
      ${g.fb ? `<div class="row"><button class="big" data-a="gap-next">Next ▶</button></div>` : ""}`;
  }
  return topbar("lesson") + `<h2 class="screen-title">Practice: ${names[kind]}</h2>
    <div class="progress"><span data-w="${S.step / S.steps.length * 100}"></span></div>${body}`;
}

/* ===== CHECK THE ROBOT – AI zručnosti =====
   Časť 1: robot hovorí vety, žiak rozhodne, či je to pravda, alebo chyba.
   Časť 2: žiak vyberie lepšiu otázku pre robota a uvidí odpoveď.
   Žiak nikdy nepíše s ozajstnou AI – všetko je vopred schválené učiteľom. */
function renderRobot() {
  const l = L(), R = l.robot || {}, st = R.statements || [], pr = R.prompts || [], r = S.r;
  const total = st.length + pr.length, doneN = (r.part === 0 ? r.i : st.length + r.i);
  let body = "";
  if (r.part === -1) {
    body = `<div class="panel tc"><div class="robot-face center-block">🤖</div>
      <h2 class="screen-title">Robot detective!</h2>
      <p>AI robots can help us learn. But sometimes they make mistakes.<br>A good detective always checks!</p>
      <p class="sk">AI roboti nám pomáhajú, ale niekedy sa mýlia. Dobrý detektív vždy overuje!</p>
      <div class="row"><button class="big" data-a="go" data-to="lesson">Finish ✓</button></div></div>`;
  } else if (r.part === 0) {
    const it = st[r.i], ans = r.pick !== null, right = ans && (r.pick === "true") === !!it.ok;
    body = `<p class="lead">The robot says something. Is it <b>true</b> or a <b>mistake</b>?<br><span class="sk">Robot niečo tvrdí. Je to pravda, alebo chyba?</span></p>
      <div class="robot-say"><div class="robot-face">🤖</div><div class="bubble">${esc(it.text)}</div></div>
      <div class="grid2">
        <button class="choice ${ans ? (it.ok ? "ok" : r.pick === "true" ? "bad" : "") : ""}" data-a="r-tf" data-v="true" ${ans ? "disabled" : ""}>✓ True</button>
        <button class="choice ${ans ? (!it.ok ? "ok" : r.pick === "false" ? "bad" : "") : ""}" data-a="r-tf" data-v="false" ${ans ? "disabled" : ""}>✗ Mistake</button></div>
      ${ans ? `<div class="feedback ${right ? "ok" : "bad"}">${right ? (it.ok ? "Yes, the robot is right!" : "Well spotted, detective!") : (it.ok ? "The robot was right this time." : "Oops, the robot made a mistake.")}</div>
        ${it.explain ? `<div class="explain">${esc(it.explain)}</div>` : ""}
        <div class="row"><button class="big" data-a="r-next">Next ▶</button></div>` : ""}`;
  } else {
    const it = pr[r.i], ans = r.pick !== null;
    const opts = S.rOrder || (S.rOrder = shuffle(["good", "bad"]));
    body = `<p class="lead">You want to ask the robot. Which question is <b>better</b>?<br><span class="sk">Chceš sa opýtať robota. Ktorá otázka je lepšia?</span></p>
      <div class="panel mb14"><b>Your goal:</b> ${esc(it.goal)}<div class="sk">${esc(it.goalSk || "")}</div></div>
      <div class="grid1">${opts.map(k => `<button class="choice qcard ${ans ? (k === "good" ? "ok" : r.pick === k ? "bad" : "") : ""}" data-a="r-q" data-v="${k}" ${ans ? "disabled" : ""}>“${esc(it[k])}”</button>`).join("")}</div>
      ${ans ? `<div class="feedback ${r.pick === "good" ? "ok" : "bad"}">${r.pick === "good" ? "Great question!" : "The other question is better."}</div>
        ${it.tip ? `<div class="tipbox">💡 ${esc(it.tip)}</div>` : ""}
        <div class="robot-say mt16"><div class="robot-face">🤖</div><div class="bubble">${esc(it.answer)}</div></div>
        <div class="row"><button class="big ghost" data-a="say" data-t="${esc(it.answer)}">🔊</button><button class="big" data-a="r-next">Next ▶</button></div>` : ""}`;
  }
  return topbar("lesson") + `<h2 class="screen-title">Check the robot</h2>
    ${r.part >= 0 ? `<div class="progress"><span data-w="${doneN / Math.max(1, total) * 100}"></span></div>` : ""}${body}`;
}

/* ===== TEST ===== */
function setupTest() {
  const l = L();
  const picQs = shuffle(l.words).slice(0, 2).map(w => ({ pic: w.pic, q: "What is it?", qSk: "Čo je na obrázku?",
    options: shuffle([w.en, ...shuffle(l.words.filter(x => x !== w)).slice(0, 2).map(x => x.en)]), answer: w.en }));
  const fixed = shuffle(l.test || []).slice(0, TMAX(l) - 2).map(q => ({ ...q, options: mix(q.options) }));
  S.qs = shuffle([...picQs, ...fixed]); S.qi = 0; S.score = 0; S.wrong = []; S.pick = null;
}
function renderTest() {
  const q = S.qs[S.qi], ans = S.pick !== null;
  return topbar("lesson") + `<h2 class="screen-title">Test</h2>
    <div class="progress"><span data-w="${S.qi / S.qs.length * 100}"></span></div>
    <div class="panel">${q.pic ? `<div class="pic q-pic">${pic(q.pic)}</div>` : ""}
      <div class="q-text">${esc(q.q)}<div class="sk">${esc(q.qSk || "")}</div></div>
      <div class="${q.options.length === 3 ? "grid1" : "grid2"}">${q.options.map(o => `<button class="choice ${ans ? (o === q.answer ? "ok" : o === S.pick ? "bad" : "") : ""}" data-a="answer" data-o="${esc(o)}" ${ans ? "disabled" : ""}>${esc(o)}</button>`).join("")}</div>
      <div class="feedback ${ans ? (S.pick === q.answer ? "ok" : "bad") : ""}">${ans ? (S.pick === q.answer ? "Correct!" : "Not this time.") : `Question ${S.qi + 1} of ${S.qs.length}`}</div></div>
    ${ans ? `<div class="row"><button class="big" data-a="t-next">${S.qi === S.qs.length - 1 ? "See my result" : "Next ▶"}</button></div>` : ""}`;
}
function renderResult() {
  const t = S.qs.length, st = starsFor(S.score, t);
  const msg = st === 3 ? "Case solved, detective!" : st === 2 ? "Very good work!" : st === 1 ? "Good try! Practise once more." : "Let's learn the words again.";
  return topbar("lesson") + `<div class="panel result"><h2 class="screen-title">${msg}</h2>
    <div class="big-stars">${"⭐".repeat(st)}${"☆".repeat(3 - st)}</div><div class="score">${S.score} / ${t}</div>
    ${S.wrong.length ? `<div class="review"><b>Let's check these again:</b>${S.wrong.map(w => `<div>${esc(w.q)} → <b>${esc(w.answer)}</b></div>`).join("")}</div>` : ""}
    <div class="row"><button class="big ghost" data-a="go" data-to="test">Try again</button><button class="big" data-a="go" data-to="lesson">Done</button></div></div>`;
}

/* ===== DRAW IT – nakresli a popíš =====
   Žiak kreslí prstom, potom ťukne na slovíčko a na miesto v obrázku – slovo sa tam „nalepí“. */
const COLORS = ["#1D2A5B", "#E0452B", "#1E9E62", "#2D7FF9", "#FFC53D", "#8B5A2B"];
function drawTask() {
  const l = L(), d = l.draw || {};
  return { task: d.task || `Draw a picture about “${l.title}”. Label it with the words.`,
    taskSk: d.taskSk || "Nakresli obrázok k téme a popíš ho slovíčkami.",
    labels: (d.labels && d.labels.length ? d.labels : l.words.slice(0, 5).map(w => w.en)) };
}
function renderDraw() {
  const t = drawTask(), dr = S.dr;
  return topbar("lesson") + `<h2 class="screen-title">Draw it</h2>
    <p class="lead"><b>${esc(t.task)}</b><br><span class="sk">${esc(t.taskSk)}</span></p>
    <div class="draw-tools">
      ${COLORS.map(c => `<button class="swatch" data-a="d-color" data-c="${c}" aria-pressed="${dr.color === c}" aria-label="colour"></button>`).join("")}
      <button class="iconbtn" data-a="d-size" aria-label="Pen size">${dr.size > 10 ? "🖌️ big" : "✏️ thin"}</button>
      <button class="iconbtn" data-a="d-color" data-c="eraser" aria-pressed="${dr.color === "eraser"}">🧽</button>
      <button class="iconbtn" data-a="d-undo" aria-label="Undo">↩</button>
      <button class="iconbtn" data-a="d-clear" aria-label="Clear">🗑️</button>
    </div>
    <div class="canvas-wrap"><canvas id="cv"></canvas></div>
    <p class="lead mt12">Now tap a word, then tap your picture to put the label there.<br><span class="sk">Ťukni na slovo a potom na miesto v obrázku.</span></p>
    <div class="labels">${t.labels.map(w => `<button class="label-chip ${dr.used.includes(w) ? "used" : ""}" data-a="d-label" data-w="${esc(w)}" aria-pressed="${dr.label === w}">${esc(w)}</button>`).join("")}</div>
    <div class="row"><button class="big" data-a="d-save">Save my picture ✓</button></div>
    <p class="feedback ok" id="d-msg"></p>`;
}
let CV = null;
function initCanvas() {
  const cv = document.getElementById("cv"); if (!cv) return;
  const W = cv.parentElement.clientWidth || 700, H = Math.round(W * 0.68), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + "px";
  const ctx = cv.getContext("2d", { willReadFrequently: true }); ctx.scale(dpr, dpr); ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  CV = { cv, ctx, W, H, undo: [], drawing: false };
  const old = loadDrawing(S.lesson);
  if (old) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, W, H); img.src = old; }
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const snap = () => { try { CV.undo.push(ctx.getImageData(0, 0, cv.width, cv.height)); if (CV.undo.length > 15) CV.undo.shift(); } catch (e) {} };
  cv.addEventListener("pointerdown", e => {
    e.preventDefault(); snap(); const [x, y] = pos(e);
    if (S.dr.label) {                       // nalep slovíčko
      ctx.font = "700 22px 'Baloo 2', sans-serif";
      const w = ctx.measureText(S.dr.label).width + 20;
      ctx.fillStyle = "#FFF1C9"; ctx.strokeStyle = "#1D2A5B"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 18, w, 36, 12) : ctx.rect(x - w / 2, y - 18, w, 36); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1D2A5B"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(S.dr.label, x, y + 1);
      speak(S.dr.label); S.dr.used.push(S.dr.label); S.dr.label = null; refreshLabels(); return;
    }
    CV.drawing = true; cv.setPointerCapture(e.pointerId);
    ctx.strokeStyle = S.dr.color === "eraser" ? "#fff" : S.dr.color; ctx.lineWidth = S.dr.color === "eraser" ? 28 : S.dr.size;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + .1, y + .1); ctx.stroke();
  });
  cv.addEventListener("pointermove", e => { if (!CV.drawing) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); });
  const end = () => { CV.drawing = false; };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
}
// prekreslí len lištu a slovíčka, plátno zostáva
function refreshLabels() {
  document.querySelectorAll(".label-chip").forEach(b => { b.setAttribute("aria-pressed", S.dr.label === b.dataset.w); b.classList.toggle("used", S.dr.used.includes(b.dataset.w)); });
  document.querySelectorAll(".swatch, [data-c=eraser]").forEach(b => b.setAttribute("aria-pressed", S.dr.color === b.dataset.c));
  const sz = document.querySelector("[data-a=d-size]"); if (sz) sz.textContent = S.dr.size > 10 ? "🖌️ big" : "✏️ thin";
}
function saveDrawing() {
  const msg = document.getElementById("d-msg");
  try {
    // zmenšená kópia, aby sa zmestilo do pamäte tabletu
    const c = document.createElement("canvas"), sc = Math.min(1, 800 / CV.W);
    c.width = CV.W * sc; c.height = CV.H * sc; c.getContext("2d").drawImage(CV.cv, 0, 0, c.width, c.height);
    localStorage.setItem(DKEY(S.lesson), c.toDataURL("image/jpeg", 0.7));
    LP(S.lesson).draw = true; save();
    msg.textContent = "Great picture! It is in My progress."; speak("Great picture!");
    setTimeout(() => go("lesson"), 1200);
  } catch (e) { msg.className = "feedback bad"; msg.textContent = "The tablet is full. Delete old pictures in My progress."; }
}

/* ===== MY MISTAKES – opakovanie chýb ===== */
function setupMistakes() {
  S.mq = shuffle(P.mistakes).slice(0, 10).map(m => ({ ...m, options: mix(m.options) }));
  S.mi = 0; S.mpick = null; S.mfixed = 0;
}
function renderMistakes() {
  if (!S.mq.length || S.mi >= S.mq.length) {
    return topbar("home") + `<div class="panel result"><h2 class="screen-title">${S.mfixed ? "Well done!" : "Keep going!"}</h2>
      <div class="big-stars">🔁</div><p>You answered ${S.mfixed} of ${S.mq.length} right.<br>Mistakes left: <b>${P.mistakes.length}</b></p>
      <p class="sk">Chybu treba 2× správne zodpovedať, potom zmizne.</p>
      <div class="row">${P.mistakes.length ? `<button class="big ghost" data-a="go" data-to="mistakes">Again</button>` : ""}<button class="big" data-a="go" data-to="home">Home</button></div></div>`;
  }
  const q = S.mq[S.mi], ans = S.mpick !== null, lesson = APP.lessons.find(x => x.id === q.lesson);
  return topbar("home") + `<h2 class="screen-title">My mistakes</h2>
    <div class="progress"><span data-w="${S.mi / S.mq.length * 100}"></span></div>
    <div class="panel">${lesson ? `<p class="sk sk-always tc mb8">${esc(lesson.title)}</p>` : ""}
      ${q.pic ? `<div class="pic q-pic">${pic(q.pic)}</div>` : ""}
      <div class="q-text">${esc(q.q)}<div class="sk">${esc(q.qSk || "")}</div></div>
      <div class="${q.options.length === 3 ? "grid1" : "grid2"}">${q.options.map(o => `<button class="choice ${ans ? (o === q.answer ? "ok" : o === S.mpick ? "bad" : "") : ""}" data-a="m-answer" data-o="${esc(o)}" ${ans ? "disabled" : ""}>${esc(o)}</button>`).join("")}</div>
      <div class="feedback ${ans ? (S.mpick === q.answer ? "ok" : "bad") : ""}">${ans ? (S.mpick === q.answer ? "Correct!" : `The answer is “${esc(q.answer)}”.`) : `${S.mi + 1} / ${S.mq.length}`}</div>
      ${ans && q.explain ? `<div class="explain">${esc(q.explain)}</div>` : ""}</div>
    ${ans ? `<div class="row"><button class="big" data-a="m-next">Next ▶</button></div>` : ""}`;
}

/* ===== MY PROGRESS – prehľad aj pre rodiča/učiteľa ===== */
function renderProgress() {
  let stars = 0, finished = 0, words = 0, drawings = [];
  APP.lessons.forEach(l => { const lp = LP(l.id); stars += starsFor(lp.best, Math.min(TMAX(l), (l.test || []).length + 2));
    if (l.extra) return;
    if (stepsDone(lp, l) === stepsFor(l).length) finished++; if (lp.learn) words += l.words.length;
    const d = loadDrawing(l.id); if (d) drawings.push([l, d]); });
  const subs = APP.subjects.filter(s => APP.lessons.some(l => l.subject === s.key));
  return topbar("home") + `<h2 class="screen-title">My progress</h2><p class="lead sk sk-always">Prehľad pokroku – aj pre rodičov a učiteľa.</p>
    <div class="stats">
      <div class="stat"><b>${finished}/${regular().length}</b>lessons finished<div class="sk">dokončené lekcie</div></div>
      <div class="stat"><b>⭐ ${stars}</b>stars<div class="sk">hviezdičky z testov</div></div>
      <div class="stat"><b>${words}</b>words learned<div class="sk">naučené slovíčka</div></div>
      <div class="stat"><b>${P.mistakes.length}</b>mistakes to fix<div class="sk">chyby na opakovanie</div></div>
    </div>
    ${[...subs.map(s => [s.name, regular().filter(l => l.subject === s.key)]), ...(APP.lessons.some(l => l.extra) ? [["Before the test", APP.lessons.filter(l => l.extra)]] : [])].map(([name, ls]) => `<div class="unit-title">${esc(name)}</div><div class="grid1">${ls.map(l => {
      const lp = LP(l.id), st = starsFor(lp.best, Math.min(TMAX(l), (l.test || []).length + 2)), started = stepsDone(lp, l) > 0;
      return `<div class="prow ${started ? "" : "faded"}"><span><b>${esc(l.title)}</b> <span class="sk">${esc(l.month || "")}</span></span>
        <span class="pdots">${stepsFor(l).map(k => k === "test" ? lp.best > 0 : lp[k]).map(v => `<i class="${v ? "on" : ""}"></i>`).join("")}</span>
        <span>${lp.best ? `${lp.best}/${Math.min(TMAX(l), (l.test || []).length + 2)} ${"⭐".repeat(st)}` : "–"}</span></div>`; }).join("")}</div>`).join("")}
    <div class="unit-title">My drawings</div>
    ${drawings.length ? `<div class="gallery">${drawings.map(([l, d]) => `<figure><img src="${d}" alt="Drawing: ${esc(l.title)}"><figcaption>${esc(l.title)}</figcaption></figure>`).join("")}</div>`
      : `<div class="empty">No drawings yet.<br><span class="sk">Zatiaľ žiadne kresby.</span></div>`}`;
}

function render() {
  const map = { home:renderHome, lesson:renderLesson, learn:renderLearn, read:renderRead, practice:renderPractice, draw:renderDraw, robot:renderRobot, test:renderTest, result:renderResult, mistakes:renderMistakes, progress:renderProgress };
  $app.innerHTML = (map[S.screen] || renderHome)();
  // Inline style atribúty prísna CSP nepovolí – šírky a farby nastavíme cez JavaScript
  $app.querySelectorAll("[data-w]").forEach(el => { el.style.width = (+el.dataset.w || 0) + "%"; });
  $app.querySelectorAll(".swatch[data-c]").forEach(el => { el.style.background = el.dataset.c; });
}

/* ===== Ovládanie ===== */
$app.addEventListener("click", e => {
  const b = e.target.closest("[data-a]"); if (!b || b.disabled) return;
  const a = b.dataset.a, l = S.lesson && L();
  switch (a) {
    case "go": return go(b.dataset.to);
    case "open": return go("lesson", { lesson: b.dataset.id });
    case "subj": S.subject = b.dataset.k; return render();
    case "sk": P.sk = !P.sk; save(); document.body.classList.toggle("show-sk", P.sk); return render();
    case "say": return speak(b.dataset.t);
    case "next": S.i = (S.i || 0) + 1; S.flip = false; speak(l.words[S.i].en); return render();
    case "prev": S.i = Math.max(0, (S.i || 0) - 1); S.flip = false; return render();
    case "flip": S.flip = !S.flip; return render();
    case "learn-done": LP(l.id).learn = true; save(); return go("read");
    case "word": S.word = b.dataset.en; speak(S.word); return render();
    case "close": S.word = null; return render();
    case "read-done": LP(l.id).read = true; save(); return go("practice");
    case "m-pic": S.match.sel = +b.dataset.k; S.match.wrong = null; return render();
    case "m-word": {
      const m = S.match, k = +b.dataset.k;
      if (m.sel === k) {
        m.done.push(k); speak(m.left[k].en); m.sel = null;
        if (m.done.length === m.left.length) { render(); return setTimeout(nextPractice, 700); }
        return render();
      }
      if (m.sel !== null && m.sel !== undefined) addMistake(wordQ(m.left[m.sel]));
      m.wrong = k; render(); m.wrong = null; return;
    }
    case "sort": {
      const it = S.sort.items[S.sort.i]; S.sort.fb = { g: b.dataset.g, ok: b.dataset.g === it.group };
      if (!S.sort.fb.ok) { const G = l.sort.groups; addMistake({ pic: it.pic, q: `Where does “${it.en}” belong?`, qSk: "Kam to patrí?",
        options: G.map(g => g.en), answer: (G.find(g => g.id === it.group) || {}).en }); }
      return render();
    }
    case "sort-next": S.sort.fb = null; S.sort.i++; if (S.sort.i >= S.sort.items.length) return nextPractice(); return render();
    case "gap": {
      const it = S.gap.items[S.gap.i]; S.gap.pick = b.dataset.o; S.gap.fb = b.dataset.o === it.answer ? "ok" : "bad";
      if (S.gap.fb === "bad") addMistake({ q: it.text, qSk: "Doplň chýbajúce slovo.", options: it.options, answer: it.answer });
      return render();
    }
    case "gap-next": S.gap.fb = null; S.gap.pick = null; S.gap.i++; if (S.gap.i >= S.gap.items.length) return nextPractice(); return render();
    case "r-tf": case "r-q": {
      S.r.pick = b.dataset.v;
      if (a === "r-tf") { const it = l.robot.statements[S.r.i];
        if ((S.r.pick === "true") !== !!it.ok) addMistake({ q: `The robot says: “${it.text}” Is it true?`, qSk: "Robot tvrdí… Je to pravda?", options: ["true", "false"], answer: it.ok ? "true" : "false", explain: it.explain }); }
      return render();
    }
    case "r-next": {
      const R = l.robot || {}, st = R.statements || [], pr = R.prompts || [];
      S.r.pick = null; S.rOrder = null; S.r.i++;
      if (S.r.part === 0 && S.r.i >= st.length) { S.r.part = 1; S.r.i = 0; }
      if (S.r.part === 1 && S.r.i >= pr.length) { S.r.part = -1; LP(l.id).robot = true; save(); }
      render(); return window.scrollTo(0, 0);
    }
    case "answer": {
      const q = S.qs[S.qi]; S.pick = b.dataset.o;
      if (S.pick === q.answer) S.score++; else { S.wrong.push(q); addMistake({ pic: q.pic, q: q.q, qSk: q.qSk, options: q.options, answer: q.answer }); }
      return render();
    }
    // Draw it
    case "d-color": S.dr.color = b.dataset.c; S.dr.label = null; return refreshLabels();
    case "d-size": S.dr.size = S.dr.size > 10 ? 8 : 18; return refreshLabels();
    case "d-label": S.dr.label = S.dr.label === b.dataset.w ? null : b.dataset.w; return refreshLabels();
    case "d-undo": if (CV && CV.undo.length) CV.ctx.putImageData(CV.undo.pop(), 0, 0); return;
    case "d-clear": if (CV) { CV.undo.push(CV.ctx.getImageData(0, 0, CV.cv.width, CV.cv.height)); CV.ctx.fillStyle = "#fff"; CV.ctx.fillRect(0, 0, CV.W, CV.H); S.dr.used = []; refreshLabels(); } return;
    case "d-save": return saveDrawing();
    // My mistakes
    case "m-answer": {
      const q = S.mq[S.mi], m = P.mistakes.find(x => x.id === q.id); S.mpick = b.dataset.o;
      if (S.mpick === q.answer) { S.mfixed++; if (m) { m.need--; if (m.need <= 0) P.mistakes = P.mistakes.filter(x => x !== m); } }
      else if (m) m.need = 2;
      save(); return render();
    }
    case "m-next": S.mpick = null; S.mi++; render(); return window.scrollTo(0, 0);
    case "t-next":
      S.pick = null; S.qi++;
      if (S.qi >= S.qs.length) { const lp = LP(l.id); lp.best = Math.max(lp.best, S.score); save(); S.screen = "result"; render(); return window.scrollTo(0, 0); }
      return render();
  }
});

/* Štart: v exporte sú lekcie v samostatnom súbore lessons.json (žiadne dáta v kóde),
   v náhľade admina sú vložené priamo. */
function start() {
  if (APP.single && APP.lessons[0]) { S.lesson = APP.lessons[0].id; S.screen = "lesson"; }
  render();
}
try { if ("speechSynthesis" in window) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); } } catch (e) {}
if (APP.external) {
  fetch("lessons.json", { cache: "no-cache" }).then(r => r.json())
    .then(d => { APP = d; start(); })
    .catch(() => { $app.innerHTML = `<div class="empty">Lessons could not be loaded. Connect to the internet and try again.<br><span class="sk">Lekcie sa nenačítali – pripoj sa na internet.</span></div>`; });
} else start();

/* Offline režim: service worker (funguje len na https, napr. GitHub Pages) */
if ("serviceWorker" in navigator && location.protocol === "https:" && !APP.single) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
