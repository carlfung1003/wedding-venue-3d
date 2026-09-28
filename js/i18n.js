// i18n.js — EVERY guest-facing string, in both languages (KAN-232).
//
// ONE module on purpose: no builder, no ui.js template and no HTML attribute
// carries its own copy any more. index.html keeps the ENGLISH text inline (the
// no-JS / crawler default) and tags each node with data-i18n* so applyStatic()
// can swap it; everything drawn from JS calls t(key) at render time.
//
//   t(key, vars?)      → the string in the current language ({name} placeholders)
//   mt(m, field)       → a CFG.MOMENTS field (name/short/area/blurb) in the
//                        current language — the zh copy lives on m.zh
//   getLang() · setLang('en'|'zh', {remember}) · onLang(fn)
//   whenLong(m) · whenShort(m) · dayHead(date)   — the dated labels
//
// ⚠ ZH IS TRADITIONAL, matching ~/projects/wedding-app (src/app/invite/copy.ts:
// "ZH is Traditional, matching the marketing site's register"). Reuse that
// site's Chinese wherever an equivalent exists — venue 三亞海棠灣威斯汀度假酒店,
// 隱逸居 (never 隐逸居), 迎賓派對 / 婚禮儀式 / 雞尾酒會 / 晚宴 / 派對, 立即進入,
// 3D 場地漫遊 — and its punctuation: full-width 。、「」 and —, ASCII commas.
// The couple are "Carl & Rachel" in both languages (the wedding-app has no
// Chinese rendering of the names; never Feng/Zheng, never a guessed surname).
//
// ⚠ Every CJK character used here must be in the self-hosted font subset:
// after adding or changing Chinese copy run `node tools/cjk-subset.mjs` (it
// re-cuts assets/fonts/venue-serif-tc.woff2 and fails if a glyph is missing).
//
// Language choice, strongest first: ?lang=zh|en · the guest's own toggle
// (localStorage, try/catch — private mode throws) · navigator.language (zh* → zh).
// The inline boot script in index.html repeats that detection (it has to run
// before this module can) — keep the two in step.

export const LANGS = ['en', 'zh'];
const KEY = 'venue.lang';

/* glyphs the touch help rows embed (markup, not copy) */
const G_UP = '<span class="tglyph sm"><svg aria-hidden="true"><use href="#i-up"/></svg></span>';
const G_DN = '<span class="tglyph sm"><svg aria-hidden="true"><use href="#i-down"/></svg></span>';
const CJK = '<span class="cjk" lang="zh-Hant" translate="no">隱逸居</span>';

const STR = {
  en: {
    /* document */
    'doc.title': 'Carl & Rachel · The Big Day in 3D',
    'doc.desc': 'A first-person 3D walkthrough of Carl & Rachel’s wedding venue — six moments, from the rooftop welcome brunch to the after party. Free in your browser.',
    'a.canvas': 'The venue in 3D',

    /* loading card */
    'load.date': '20 · 03 · 2027',
    'load.place': 'The Westin Sanya Haitang Bay',
    'ph.tables': 'Setting the tables',
    'ph.lights': 'Warming the lights',
    'ph.florist': 'Unloading the florist’s van',
    'ph.sky': 'Hanging the sky over Haitang Bay',
    'ph.pool': 'Filling the pool',
    'ph.villas': 'Raising the villas',
    'ph.atrium': 'Setting the atrium stone',
    'ph.suite': 'Opening up the suite',
    'ph.turn': 'Turning the clubhouse to the sea',
    'ph.palms': 'Planting the palm grove',
    'ph.hour': 'Setting the hour',
    'ph.places': 'Laying the places',
    'ph.drone': 'Sending up the drone',
    'ph.light': 'Waiting on the light',
    'ph.golden': 'Catching the golden hour',
    'ph.lanterns': 'Lighting the lanterns',
    'ph.doors': 'Opening the doors',
    'ph.ready': 'Ready when you are',

    /* the invitation */
    'inv.eyebrow': 'The Big Day · a walkthrough',
    'inv.date': '<span>Saturday</span> 20 · 03 · 2027',
    'inv.venue': `The Westin Sanya Haitang Bay<br>${CJK} <span class="sep">·</span> The Serene Retreat`,
    'inv.lede': 'Walk our wedding day — before anyone else does.',
    'inv.begin': 'Step inside',
    'inv.go': 'Go to the {name}',
    'inv.howto': 'How to move',
    'inv.legal': 'Modelled from our own site photos and the suite walkthrough. Not to survey accuracy.',

    /* the language switch */
    'lang.group': 'Language',
    'lang.other': '中',
    'lang.otherAria': '中文 — switch to Chinese',

    /* HUD */
    'hud.view': 'View',
    'hud.walking': 'Walking',
    'hud.flying': 'Flying',
    'hud.walkAria': 'Walking — fly (F)',
    'hud.flyAria': 'Flying — land (F)',
    'hud.golden': 'Golden hour',
    'hud.night': 'Night',
    'hud.goldenAria': 'Golden hour — switch to night (N)',
    'hud.nightAria': 'Night — switch to golden hour (N)',
    'hud.help': 'How to move (H)',
    'hud.timeline': 'The wedding, in order',
    'hud.lockClick': 'Click the view to look around',
    'hud.lockCursor': 'Cursor free <kbd>Tab</kbd> to look around',

    /* touch */
    'tb.climb': 'Climb',
    'tb.dive': 'Dive',
    'tb.fly': 'Fly',
    'tb.land': 'Land',
    'tb.interact': 'Interact',
    'co.move': '<b>Move</b>left thumb',
    'co.look': '<b>Look</b>drag anywhere',

    /* the controls sheet */
    'help.eyebrow': 'Getting around',
    'help.title': 'How to move',
    'help.close': 'Close',
    'k.walk': 'Walk',
    'k.run': 'Hurry — there’s a schedule',
    'k.mouse': 'Mouse',
    'k.look': 'Look around (click the view first)',
    'k.interact': 'Interact when a prompt appears',
    'k.fly': 'Fly · land',
    'k.climb': 'Climb · dive while flying',
    'k.jump': 'Jump through the timeline',
    'k.night': 'Golden hour · night',
    'k.tab': 'Free the cursor to click the timeline',
    'k.esc': 'Release the mouse',
    'k.sheet': 'This sheet',
    't.move': '<b>Move</b> — press and drag with your left thumb',
    't.look': '<b>Look</b> — drag anywhere else',
    't.interact': '<b>Interact</b> — tap the prompt, or this button',
    't.fly': `<b>Fly</b> · land — then ${G_UP}${G_DN} for height`,
    't.night': '<b>Night</b> — the sun / moon at the top',
    't.timeline': '<b>The timeline</b> — tap a moment at the bottom',
    'help.fine': 'Six moments across three days — 18 to 20 March 2027. Nothing here is to survey accuracy; it is how the day will feel.',
    'help.done': 'Back to the venue',

    /* system cards (the instruction style) */
    'mode.flyTouch': 'Flying — the arrows climb and dive',
    'mode.flyKeys': 'Flying — Space / C climb and dive · F lands',
    'mode.walk': 'Back on your feet',
    'light.night': 'Night over Haitang Bay.',
    'light.golden': 'Golden hour.',

    /* the interactables — prompt label + what it says when used.
       Emoji are kept in the copy and stripped at render (ui.js). */
    /* the guided tour (KAN-233, js/tour.js) */
    'inv.tour': 'Take the tour',
    'tour.bar': 'Tour controls',
    'tour.pause': 'Pause (Space)',
    'tour.play': 'Play (Space)',
    'tour.prev': 'Previous moment (←)',
    'tour.next': 'Next moment (→)',
    'tour.exit': 'Walk myself',
    'tour.exitAria': 'Stop the tour and walk yourself (Esc)',
    'tour.fromHere': 'Take the tour from here',
    'tour.hintTouch': 'Sit back — tap anywhere to walk yourself',
    'tour.hintKeys': 'Sit back — press any key or click to walk yourself',
    'tour.walking': 'You’re walking now',
    'tb.tour': 'Tour',
    'help.tour': 'Take the tour',
    'help.tourSub': 'Sit back — two minutes, all six moments',
    'end.aria': 'The end of the tour',
    'end.eyebrow': 'That was our wedding day',
    'end.lede': 'See you in Haitang Bay.',
    'end.walk': 'Walk it yourself',
    'end.again': 'Watch again',

    /* the music + ambience (KAN-234 v2, js/sound.js) — off by default */
    'snd.on': 'Sound on',
    'snd.off': 'Sound off',
    'snd.onAria': 'Sound on — mute (M)',
    'snd.offAria': 'Sound off — play the venue’s sound (M)',
    'k.sound': 'Sound on · off',
    't.sound': '<b>Sound</b> — the speaker at the top',

    'act.checkin': 'Check in',
    'say.checkin': '“Welcome to 隱逸居, Mr & Mrs Fung.” Rooms are LEFT along the upper gallery; the presidential suite is RIGHT, across the walkway. 🔑',
    'act.pour': 'Pour a glass',
    'say.pour': '🥂 To the two of you — and to whoever booked the roof.',
    'act.sign': 'Read the welcome sign',
    'say.sign': '“Carl & Rachel — welcome to Haitang Bay. Shoes optional.”',
    'act.arch': 'Stand at the arch',
    'say.arch': 'This is where the “I do” happens — with the sea right behind you. 💍',
    'act.bar': 'Order from the bar',
    'say.bar': '🍸 One 荔枝尼格羅尼 — lychee negroni, amber, with the orange twist.',
    'act.dance': 'Step onto the dance floor',
    'say.dance': 'The floor is yours — everyone joins after the second song.',
    'act.song': 'Request a song',
    'say.song': '🎧 The DJ nods. It was always going to be this song.',
  },

  zh: {
    'doc.title': 'Carl & Rachel · 婚禮之日 3D 場地漫遊',
    'doc.desc': 'Carl & Rachel 婚禮場地的第一人稱 3D 漫遊 — 從頂層的迎賓早午餐到深夜的派對，六個時刻，在瀏覽器中即可免費體驗。',
    'a.canvas': '3D 婚禮場地',

    'load.date': '2027 · 03 · 20',
    'load.place': '三亞海棠灣威斯汀度假酒店',
    'ph.tables': '正在擺放餐桌',
    'ph.lights': '正在點亮燈光',
    'ph.florist': '花藝師正在卸下鮮花',
    'ph.sky': '為海棠灣掛上天空',
    'ph.pool': '為泳池注滿清水',
    'ph.villas': '搭起一座座別墅',
    'ph.atrium': '鋪設中庭的石材',
    'ph.suite': '打開套房的玻璃牆',
    'ph.turn': '讓會所轉身面向大海',
    'ph.palms': '種下整片棕櫚林',
    'ph.hour': '調好時辰',
    'ph.places': '擺好每一個席位',
    'ph.drone': '放飛無人機',
    'ph.light': '等待光線就位',
    'ph.golden': '捕捉黃金時刻',
    'ph.lanterns': '點亮水上的燈籠',
    'ph.doors': '推開大門',
    'ph.ready': '一切就緒，等您到來',

    'inv.eyebrow': '婚禮之日 · 3D 場地漫遊',
    'inv.date': '<span>星期六</span> 2027 · 03 · 20',
    'inv.venue': `三亞海棠灣威斯汀度假酒店<br>${CJK} <span class="sep">·</span> The Serene Retreat`,
    'inv.lede': '比任何人都早一步，<br>走進我們的婚禮之日。',
    'inv.begin': '立即進入',
    'inv.go': '前往{name}',
    'inv.howto': '操作說明',
    'inv.legal': '根據我們的實地照片與套房影片親手重現，比例僅供參考。',

    'lang.group': '語言',
    'lang.other': 'EN',
    'lang.otherAria': 'English — 切換至英文',

    'hud.view': '視角',
    'hud.walking': '步行',
    'hud.flying': '飛行',
    'hud.walkAria': '步行中 — 切換為飛行 (F)',
    'hud.flyAria': '飛行中 — 降落 (F)',
    'hud.golden': '黃金時刻',
    'hud.night': '夜晚',
    'hud.goldenAria': '黃金時刻 — 切換為夜晚 (N)',
    'hud.nightAria': '夜晚 — 切換為黃金時刻 (N)',
    'hud.help': '操作說明 (H)',
    'hud.timeline': '婚禮流程',
    'hud.lockClick': '點擊畫面，即可環顧四周',
    'hud.lockCursor': '游標已釋放 · 按 <kbd>Tab</kbd> 繼續環顧',

    'tb.climb': '上升',
    'tb.dive': '下降',
    'tb.fly': '飛行',
    'tb.land': '降落',
    'tb.interact': '互動',
    'co.move': '<b>移動</b>左手拇指',
    'co.look': '<b>環顧</b>隨處拖動',

    'help.eyebrow': '四處走走',
    'help.title': '操作說明',
    'help.close': '關閉',
    'k.walk': '行走',
    'k.run': '快步走 — 行程可不等人',
    'k.mouse': '滑鼠',
    'k.look': '環顧四周（請先點擊畫面）',
    'k.interact': '出現提示時互動',
    'k.fly': '飛行 · 降落',
    'k.climb': '飛行時上升 · 下降',
    'k.jump': '在流程中跳轉',
    'k.night': '黃金時刻 · 夜晚',
    'k.tab': '釋放游標，點選流程',
    'k.esc': '釋放滑鼠',
    'k.sheet': '本說明',
    't.move': '<b>移動</b> — 用左手拇指按住拖動',
    't.look': '<b>環顧</b> — 在畫面其他位置拖動',
    't.interact': '<b>互動</b> — 輕觸提示，或這個按鈕',
    't.fly': `<b>飛行</b> · 降落 — 以 ${G_UP}${G_DN} 升降`,
    't.night': '<b>夜晚</b> — 輕觸頂部的太陽/月亮',
    't.timeline': '<b>流程</b> — 輕觸底部任一時刻',
    'help.fine': '三天、六個時刻 — 2027 年 3 月 18 日至 20 日。比例未必精確，但那天的感覺，就是這樣。',
    'help.done': '返回場地',

    'mode.flyTouch': '飛行中 — 以箭頭上升、下降',
    'mode.flyKeys': '飛行中 — Space / C 上升、下降 · F 降落',
    'mode.walk': '回到地面',
    'light.night': '海棠灣入夜了。',
    'light.golden': '黃金時刻。',

    'inv.tour': '觀看導覽',
    'tour.bar': '導覽控制',
    'tour.pause': '暫停（空白鍵）',
    'tour.play': '播放（空白鍵）',
    'tour.prev': '上一個時刻（←）',
    'tour.next': '下一個時刻（→）',
    'tour.exit': '自己走走',
    'tour.exitAria': '結束導覽，自己走走（Esc）',
    'tour.fromHere': '從這裡開始導覽',
    'tour.hintTouch': '安坐欣賞 — 輕觸畫面，即可自己走走',
    'tour.hintKeys': '安坐欣賞 — 按任意鍵或點擊畫面，即可自己走走',
    'tour.walking': '現在由您自己走走',
    'tb.tour': '導覽',
    'help.tour': '觀看導覽',
    'help.tourSub': '安坐欣賞 — 兩分鐘，走遍六個時刻',
    'end.aria': '導覽結束',
    'end.eyebrow': '這就是我們的婚禮之日',
    'end.lede': '海棠灣見。',
    'end.walk': '親自走一走',
    'end.again': '再看一次',

    'snd.on': '聲音：開',
    'snd.off': '聲音：關',
    'snd.onAria': '聲音已開啟 — 靜音（M）',
    'snd.offAria': '聲音已關閉 — 聆聽現場的聲音（M）',
    'k.sound': '開啟 · 關閉聲音',
    't.sound': '<b>聲音</b> — 輕觸頂部的喇叭',

    'act.checkin': '辦理入住',
    'say.checkin': '「歡迎蒞臨隱逸居。」客房在左邊，沿上層迴廊前行；總統套房在右邊，穿過連廊即達。',
    'act.pour': '斟一杯香檳',
    'say.pour': '敬你們兩位 — 也敬訂下這個天台的人。',
    'act.sign': '看看迎賓牌',
    'say.sign': '「Carl & Rachel — 歡迎來到海棠灣。赤腳也無妨。」',
    'act.arch': '站到花拱之下',
    'say.arch': '就在這裡說「我願意」— 大海就在身後。',
    'act.bar': '到吧台點一杯',
    'say.bar': '來一杯荔枝尼格羅尼 — 琥珀色，配一片橙皮。',
    'act.dance': '走進舞池',
    'say.dance': '舞池交給你們 — 第二首歌起，大家一起來。',
    'act.song': '點一首歌',
    'say.song': 'DJ 點點頭。果然，就是這一首。',
  },
};

/* ── the language itself ── */
const norm = v => (v === 'zh' || v === 'en') ? v : null;
function stored() { try { return norm(localStorage.getItem(KEY)); } catch { return null; } }
function fromURL() { try { return norm(new URLSearchParams(location.search).get('lang')); } catch { return null; } }
export function detectLang() {
  const nav = navigator.language || (navigator.languages && navigator.languages[0]) || '';
  return fromURL() || stored() || (/^zh/i.test(nav) ? 'zh' : 'en');
}

let lang = detectLang();
const listeners = [];

export const getLang = () => lang;

export function t(key, vars) {
  let s = STR[lang][key];
  if (s == null) s = STR.en[key];
  if (s == null) { console.warn('i18n: missing key', key); return key; }
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}

/** A CFG.MOMENTS field in the current language (m.zh holds the Chinese). */
export const mt = (m, field) => (lang === 'zh' && m.zh && m.zh[field]) || m[field];

export function onLang(fn) { listeners.push(fn); }

/** Switch live. `remember` (the guest's own toggle) persists it; a ?lang= in the
 *  address is rewritten too — it outranks the stored choice, so leaving it
 *  stale would undo the switch on the next reload. */
export function setLang(next, { remember = true } = {}) {
  next = norm(next);
  if (!next || next === lang) return;
  lang = next;
  if (remember) { try { localStorage.setItem(KEY, next); } catch { /* private mode */ } }
  try {
    const u = new URL(location.href);
    if (u.searchParams.has('lang')) { u.searchParams.set('lang', next); history.replaceState(history.state, '', u); }
  } catch { /* file:// or sandboxed */ }
  applyStatic();
  for (const fn of listeners) { try { fn(lang); } catch (e) { console.error(e); } }
}

/* ── dates: calendar dates, not instants — noon UTC so no zone moves them ── */
const at = d => new Date(d + 'T12:00:00Z');
const enLong = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const enShort = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const enWk = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
const enDM = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
/* the wedding-app's own forms: "3 月 20 日 星期六" (itinerary) and "週六 3.20" (short) */
const ZH_WK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const ZH_WK_S = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const md = d => { const x = at(d); return [x.getUTCMonth() + 1, x.getUTCDate(), x.getUTCDay()]; };

/** "Saturday 20 March" / "3 月 20 日 星期六" */
export function dateLong(d) {
  if (lang !== 'zh') return enLong.format(at(d));
  const [m, day, w] = md(d);
  return `${m} 月 ${day} 日 ${ZH_WK[w]}`;
}
/** "Sat 20 Mar" / "週六 3.20" */
export function dateShort(d) {
  if (lang !== 'zh') return enShort.format(at(d));
  const [m, day, w] = md(d);
  return `${ZH_WK_S[w]} ${m}.${day}`;
}
/** the timeline's day rule: "Sat <b>20.03</b>" / "週六 <b>3.20</b>" (HTML) */
export function dayHead(d) {
  if (lang !== 'zh') return `${enWk.format(at(d))} <b>${enDM.format(at(d)).replace('/', '.')}</b>`;
  const [m, day, w] = md(d);
  return `${ZH_WK_S[w]} <b>${m}.${day}</b>`;
}
export const whenLong = m => dateLong(m.date) + (m.time ? ` · ${m.time}` : '');

/* ── the static markup ─────────────────────────────────────────────────────
   data-i18n="k"        → textContent
   data-i18n-html="k"   → innerHTML (our own strings only — never guest input)
   data-i18n-aria="k"   → aria-label
   The <html> lang, the <title> and the meta description follow too. */
export function applyStatic(root = document) {
  const html = document.documentElement;
  html.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  html.dataset.lang = lang;
  html.classList.remove('i18n-pending');
  document.title = t('doc.title');
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', t('doc.desc'));
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-lang-pick]')) {
    const on = el.dataset.langPick === lang;
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

/* The switches (title card, HUD, help sheet) are plain markup with
   data-lang-pick="zh|en" (a fixed choice) or data-lang-toggle (the other one).
   One delegated listener serves all of them, before the game exists. */
document.addEventListener('click', e => {
  const pick = e.target.closest?.('[data-lang-pick],[data-lang-toggle]');
  if (!pick) return;
  e.preventDefault();
  pick.blur();                               // Space is fly-ascend (the #begin gotcha)
  setLang(pick.dataset.langPick || (lang === 'zh' ? 'en' : 'zh'));
});

/* run as soon as the module evaluates — index.html loads this module before
   main.js, so the loading card is in the right language before three.js has
   even arrived */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => applyStatic());
else applyStatic();
