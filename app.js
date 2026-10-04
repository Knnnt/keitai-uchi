'use strict';

(() => {
  const SITE_URL = 'https://knnnt.github.io/keitai-uchi/';
  const SITE_LABEL = 'knnnt.github.io/keitai-uchi';
  const LS_PREFIX = 'keitai-uchi:';
  const TOGGLE_MS = 1200; // 実機っぽく、無操作でトグル中の文字が確定するまでの時間
  const NUDGE_MS = 5000;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // プライベートモード等で localStorage が使えなくてもゲーム自体は遊べるようにする
  const store = {
    get(key, fallback) {
      try {
        const v = window.localStorage.getItem(LS_PREFIX + key);
        return v === null ? fallback : v;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(LS_PREFIX + key, String(value));
      } catch (e) {
        /* 保存できない環境では記録を残さないだけ */
      }
    },
  };

  // ========== 入力仕様（日本のガラケー標準のトグル入力） ==========
  const KEYMAP = {
    '1': 'あいうえおぁぃぅぇぉ',
    '2': 'かきくけこ',
    '3': 'さしすせそ',
    '4': 'たちつてとっ',
    '5': 'なにぬねの',
    '6': 'はひふへほ',
    '7': 'まみむめも',
    '8': 'やゆよゃゅょ',
    '9': 'らりるれろ',
    '0': 'わをんー',
    '#': '、。？！…',
  };
  const KEY_LIST = {};
  for (const [k, v] of Object.entries(KEYMAP)) KEY_LIST[k] = Array.from(v);

  // ＊キーで「直前の文字」を順に変身させる。は→ば→ぱ→は、つ→っ→づ→つ
  const CYCLES = [
    'あぁ', 'いぃ', 'うぅ', 'えぇ', 'おぉ',
    'かが', 'きぎ', 'くぐ', 'けげ', 'こご',
    'さざ', 'しじ', 'すず', 'せぜ', 'そぞ',
    'ただ', 'ちぢ', 'つっづ', 'てで', 'とど',
    'はばぱ', 'ひびぴ', 'ふぶぷ', 'へべぺ', 'ほぼぽ',
    'やゃ', 'ゆゅ', 'よょ',
  ];
  const NEXT = {};
  const BASE = {};
  for (const cyc of CYCLES) {
    const a = Array.from(cyc);
    a.forEach((c, i) => {
      NEXT[c] = a[(i + 1) % a.length];
      if (i > 0) BASE[c] = { base: a[0], stars: i };
    });
  }

  function optionsFor(ch) {
    const opts = [];
    for (const [k, list] of Object.entries(KEY_LIST)) {
      const i = list.indexOf(ch);
      if (i >= 0) opts.push({ key: k, n: i + 1, stars: 0 });
    }
    const b = BASE[ch];
    if (b) {
      for (const [k, list] of Object.entries(KEY_LIST)) {
        const i = list.indexOf(b.base);
        if (i >= 0) opts.push({ key: k, n: i + 1, stars: b.stars });
      }
    }
    return opts;
  }
  function bestOption(ch) {
    const opts = optionsFor(ch);
    opts.sort((a, b) => (a.n + a.stars) - (b.n + b.stars));
    return opts[0] || null;
  }
  // 最短打鍵数。同じキーが続く時は →（1打）が要る。＊を押した文字はその時点で確定済み
  function idealKeys(text) {
    let prev = [{ key: null, stars: 0, cost: 0 }];
    for (const ch of text) {
      const opts = optionsFor(ch);
      prev = opts.map((o) => {
        let best = Infinity;
        for (const p of prev) {
          const c = p.cost + o.n + o.stars + (p.key === o.key && p.stars === 0 ? 1 : 0);
          if (c < best) best = c;
        }
        return { key: o.key, stars: o.stars, cost: best };
      });
    }
    return Math.min(...prev.map((p) => p.cost));
  }

  // ========== お題（平成メール） ==========
  const MAILS = [
    [
      { to: '親友', text: 'いまどこ？' },
      { to: '好きな人', text: 'おやすみー' },
      { to: 'おかん', text: 'でんぱわるい' },
      { to: '待ち合わせ相手', text: 'いまおきた！' },
      { to: '彼氏', text: 'めーるみた？' },
    ],
    [
      { to: '一斉送信（48件）', text: 'あけおめことよろ' },
      { to: 'アドレス帳の全員', text: 'めあどかえました！' },
      { to: '親友', text: 'ぱけほうだいにした！' },
      { to: 'クラスのみんな', text: 'きょうからおけいく？' },
      { to: '好きな人', text: 'でんわしていい？' },
    ],
    [
      { to: '親友', text: 'ちゃくめろだうんろーどした' },
      { to: 'ホムペの常連さん', text: 'きりばんふんだらかきこしてね' },
      { to: '隣の席の子', text: 'せきがいせんでおくって' },
      { to: '親友', text: 'まちうけ、かれとのぷりにした' },
      { to: '彼氏', text: 'せんたーといあわせ、きてない' },
    ],
    [
      { to: '部活の先輩', text: 'りょうかいでーす！あしたえきまえで' },
      { to: 'クラスのみんな', text: 'ぷろふみてね！ほむぺもある' },
      { to: '彼氏', text: 'おやにばれないようにまなーもーど' },
      { to: '親友', text: 'ぱけしした…しばらくめーるむりかも' },
      { to: '友達5人', text: 'このめーるをごにんにまわさないと…' },
    ],
    [
      { to: '親友', text: 'ぱけだいやばい！ばれたらぼっしゅう…' },
      { to: '親友', text: 'せんぱいからへんしんきた…どきっ！' },
      { to: 'クラスのみんな', text: 'ぷりとろ？しゅうごうはえきまえで！' },
      { to: '彼氏', text: 'でんちぴんちだから、いったんきるね。' },
      { to: '親友', text: 'ごめん！ぷりちょうわすれた…' },
    ],
  ];
  const LEVEL_LABEL = ['初級', '初級', '中級', '上級', '最終問題'];

  for (const pool of MAILS) {
    for (const m of pool) {
      for (const ch of m.text) {
        if (!optionsFor(ch).length) throw new Error(`お題に入力できない文字があります: 「${ch}」in ${m.text}`);
      }
    }
  }

  // ========== 親指年式（理想打鍵数 ÷ タイム で判定。お題の長さの差を吸収する） ==========
  const TIERS = [
    { min: 5.6, year: 1999, name: 'ポケベル上がり（神）', comments: ['14106（あいしてる）で育った親指。', '公衆電話の行列で鍛えた親指。', '速すぎてケータイが追いついてない。'] },
    { min: 4.3, year: 2003, name: 'ギャル打ち（伝説）', comments: ['机の下で画面を見ずに打ってた人。', 'ネイルが長くても速度が落ちない親指。', '「返信はやっ」と言われ続けた親指。'] },
    { min: 3.4, year: 2005, name: 'パケ放題世代', comments: ['1日100通は余裕。問い合わせ常連。', '親指の側面、今でもちょっと硬いでしょ。', '赤外線通信のポーズが今でも完璧。'] },
    { min: 2.6, year: 2008, name: 'ホムペ職人', comments: ['キリ番踏んだら、カキコは忘れない。', '打つのは並。でも絵文字にこだわる派。', 'ホムペの足あと、毎日チェックしてた。'] },
    { min: 1.8, year: 2011, name: 'スマホ移行期', comments: ['ガラケーとスマホ、二台持ちしてた。', '指は覚えてる。頭が思い出せない。', '親指が「フリックどこ？」って迷ってる。'] },
    { min: 1.2, year: 2016, name: 'フリック入力ネイティブ', comments: ['同じキーを連打する意味が分からない。', '「→で確定」って何…？の顔をしてた。', 'ついスワイプしたくなる親指。'] },
    { min: 0, year: 2026, name: '音声入力でよくない？', comments: ['親指より先に心が折れた。', 'それ、AIに打たせればよくない？', '平成のみんな、これで恋してたんだよ。'] },
  ];

  const THEMES = [
    { id: 'pink', name: 'パールピンク', bg: ['#fff3f8', '#fbd6e6', '#efe4ff'], body: ['#fff8fb', '#f8d3e3', '#eeb2cc'], edge: '#d995b4', ink: '#4a1f38', accent: '#ff3f8e' },
    { id: 'silver', name: 'シルバー', bg: ['#f4f7fb', '#dfe7f1', '#efeaff'], body: ['#ffffff', '#e2e7ee', '#b9c3cf'], edge: '#9ba6b4', ink: '#24324a', accent: '#2f6fd0' },
    { id: 'black', name: 'ブラック', bg: ['#fbeef5', '#f1d9e7', '#e6e0f5'], body: ['#5a5d66', '#2c2e35', '#16171b'], edge: '#08080a', ink: '#3b1d33', accent: '#ff5fa2' },
  ];

  // ========== 日付（日本時間）と日替わり出題 ==========
  const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const today = { y: jstNow.getUTCFullYear(), m: jstNow.getUTCMonth() + 1, d: jstNow.getUTCDate(), w: jstNow.getUTCDay() };
  const dateKey = `${today.y}-${String(today.m).padStart(2, '0')}-${String(today.d).padStart(2, '0')}`;
  const dateLabel = `${today.m}/${today.d}`;

  function hashStr(s) {
    let h = 2166136261;
    for (const ch of s) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function rand() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 同じ日は全国共通の5通にして、Xでタイムを比べ合えるようにする
  function dailySet() {
    const rand = mulberry32(hashStr(`keitai-uchi/${dateKey}`));
    return MAILS.map((pool) => pool[Math.floor(rand() * pool.length)]);
  }

  // ========== 効果音（WebAudio合成） ==========
  const Sound = (() => {
    let ctx = null;
    let muted = store.get('muted', '0') === '1';
    function ensure() {
      if (muted) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(freq, dur, opt = {}) {
      const c = ensure();
      if (!c) return;
      const { type = 'square', vol = 0.04, at = 0, to = 0 } = opt;
      const t0 = c.currentTime + at;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
      g.gain.setValueAtTime(vol, t0 + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    }
    return {
      get muted() { return muted; },
      setMuted(v) {
        muted = v;
        store.set('muted', v ? '1' : '0');
        if (muted && ctx && ctx.state === 'running') ctx.suspend();
        if (!muted) ensure();
      },
      unlock() { ensure(); },
      key() { tone(2093, 0.045, { vol: 0.03 }); },
      fn() { tone(1568, 0.05, { vol: 0.03 }); },
      clear() { tone(880, 0.06, { vol: 0.035, to: 600 }); },
      nope() { tone(330, 0.07, { vol: 0.04 }); },
      buzz() {
        tone(170, 0.09, { vol: 0.05 });
        tone(170, 0.09, { vol: 0.05, at: 0.12 });
      },
      count() { tone(1318, 0.08, { type: 'sine', vol: 0.08 }); },
      go() { tone(2637, 0.22, { type: 'sine', vol: 0.08 }); },
      send() {
        [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.07, { type: 'triangle', vol: 0.07, at: i * 0.06 }));
      },
      done() {
        tone(1568, 0.08, { type: 'sine', vol: 0.07 });
        tone(2093, 0.16, { type: 'sine', vol: 0.07, at: 0.08 });
      },
      incoming() {
        const seq = [1319, 1568, 1760, 1568, 2093, 2349, 2637];
        seq.forEach((f, i) => tone(f, 0.1, { type: 'square', vol: 0.025, at: i * 0.1 }));
      },
    };
  })();

  // ========== DOM ==========
  const $ = (id) => document.getElementById(id);
  const screens = { title: $('screen-title'), game: $('screen-game'), result: $('screen-result') };
  const el = {
    level: $('g-level'), to: $('g-to'), target: $('g-target'), body: $('g-body'),
    cands: $('g-cands'), msg: $('g-msg'), time: $('g-time'), keys: $('g-keys'), overlay: $('g-overlay'),
    lcd: $('lcd'), hint: $('btn-hint'), keypad: $('keypad'),
  };

  // ========== 状態 ==========
  const S = {
    phase: 'title', // title | countdown | playing | paused | sending | result
    set: [],
    idx: 0,
    target: [],
    committed: [],
    tog: null, // { key, i }
    togTimer: 0,
    keys: 0,
    clears: 0,
    hints: 0,
    hintPos: -1,
    flash: null,
    flashTimer: 0,
    hadErr: false,
    stageStart: 0,
    pausedAt: 0,
    total: 0,
    stageTimes: [],
    lastInputAt: 0,
    timers: [],
    raf: 0,
    result: null,
    cardBlob: null,
    cardPromise: null,
  };

  function later(fn, ms) {
    const id = setTimeout(() => {
      S.timers = S.timers.filter((t) => t !== id);
      fn();
    }, ms);
    S.timers.push(id);
    return id;
  }
  function clearTimers() {
    S.timers.forEach((t) => clearTimeout(t));
    S.timers = [];
    clearTimeout(S.togTimer);
    clearTimeout(S.flashTimer);
  }

  function setPhase(p) {
    S.phase = p;
    screens.game.dataset.phase = p;
  }

  function showScreen(name) {
    for (const [k, node] of Object.entries(screens)) node.hidden = k !== name;
    document.body.dataset.screen = name;
    window.scrollTo(0, 0);
  }

  // ========== 時計（待ち受け・ステータスバー） ==========
  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  function updateClock() {
    const d = new Date();
    const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    document.querySelectorAll('.js-clock').forEach((n) => { n.textContent = hm; });
    document.querySelectorAll('.js-date').forEach((n) => { n.textContent = `${d.getMonth() + 1}/${d.getDate()}(${WEEK[d.getDay()]})`; });
  }
  updateClock();
  setInterval(updateClock, 15000);

  // ========== 機種変更・ミュート ==========
  let themeIdx = Math.max(0, THEMES.findIndex((t) => t.id === store.get('theme', 'pink')));
  function applyTheme() {
    document.documentElement.dataset.theme = THEMES[themeIdx].id;
  }
  applyTheme();
  $('btn-theme').addEventListener('click', () => {
    themeIdx = (themeIdx + 1) % THEMES.length;
    store.set('theme', THEMES[themeIdx].id);
    applyTheme();
    Sound.unlock();
    Sound.send();
    toast(`機種変更しました（${THEMES[themeIdx].name}）`);
  });

  function renderMute() {
    document.querySelectorAll('.btn-mute').forEach((b) => {
      const isChip = b.classList.contains('chip');
      b.textContent = Sound.muted ? (isChip ? '🔇 音なし' : '🔇') : (isChip ? '🔊 音あり' : '🔊');
      b.setAttribute('aria-pressed', String(Sound.muted));
    });
  }
  document.querySelectorAll('.btn-mute').forEach((b) => {
    b.addEventListener('click', () => {
      Sound.setMuted(!Sound.muted);
      renderMute();
      if (!Sound.muted) Sound.fn();
    });
  });
  renderMute();

  let toastTimer = 0;
  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  // ========== タイトル ==========
  function bestKey() { return `best:${dateKey}`; }
  function renderTitle() {
    const best = Number(store.get(bestKey(), '0'));
    $('title-best').textContent = best > 0 ? `今日のベスト：${(best / 1000).toFixed(1)}秒` : '今日のベスト：まだなし';
    const bt = store.get('bestTier', '');
    const tier = TIERS[Number(bt)];
    $('title-tier').textContent = bt !== '' && tier ? `最高年式：${tier.year}年製` : '';
    $('title-set').textContent = `本日の出題：${dateLabel}版`;
  }
  renderTitle();

  $('btn-start').addEventListener('click', () => {
    Sound.unlock();
    startGame();
  });

  // ========== ゲーム進行 ==========
  function startGame() {
    clearTimers();
    S.set = dailySet();
    S.idx = 0;
    S.keys = 0;
    S.clears = 0;
    S.hints = 0;
    S.total = 0;
    S.stageTimes = [];
    S.result = null;
    S.cardBlob = null;
    S.cardPromise = null;
    showScreen('game');
    loadStage();
    countdown();
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(tick);
  }

  function loadStage() {
    const mail = S.set[S.idx];
    S.target = Array.from(mail.text);
    S.committed = [];
    S.tog = null;
    S.hadErr = false;
    S.hintPos = -1;
    S.flash = null;
    clearTimeout(S.togTimer);
    el.level.textContent = `${S.idx + 1}/5・${LEVEL_LABEL[S.idx]}`;
    el.to.textContent = mail.to;
    el.hint.classList.remove('is-nudge');
    render();
  }

  function countdown() {
    setPhase('countdown');
    const mail = S.set[0];
    const steps = ['3', '2', '1'];
    const show = (n) => {
      el.overlay.hidden = false;
      el.overlay.innerHTML = `<p class="ov-small">第1問　宛先：${escapeHtml(mail.to)}</p><p class="ov-big">${n}</p><p class="ov-sub">お題を打ったら自動で送信されます</p>`;
    };
    steps.forEach((n, i) => {
      later(() => { show(n); Sound.count(); }, i * 650);
    });
    later(() => {
      el.overlay.hidden = true;
      el.overlay.innerHTML = '';
      Sound.go();
      beginStage();
    }, steps.length * 650);
  }

  function beginStage() {
    setPhase('playing');
    S.stageStart = performance.now();
    S.lastInputAt = S.stageStart;
    render();
  }

  function tick() {
    if (S.phase === 'playing') {
      const now = performance.now();
      el.time.textContent = ((S.total + now - S.stageStart) / 1000).toFixed(1);
      if (now - S.lastInputAt > NUDGE_MS) el.hint.classList.add('is-nudge');
    }
    if (screens.game.hidden) return;
    S.raf = requestAnimationFrame(tick);
  }

  function togChar() {
    return S.tog ? KEY_LIST[S.tog.key][S.tog.i] : '';
  }

  function commitTog() {
    clearTimeout(S.togTimer);
    if (!S.tog) return false;
    S.committed.push(togChar());
    S.tog = null;
    return true;
  }

  function armTog() {
    clearTimeout(S.togTimer);
    S.togTimer = setTimeout(() => {
      if (S.phase !== 'playing' || !S.tog) return;
      commitTog();
      update();
    }, TOGGLE_MS);
  }

  function okLength() {
    let ok = 0;
    while (ok < S.committed.length && S.committed[ok] === S.target[ok]) ok++;
    return ok;
  }

  function flash(text) {
    S.flash = text;
    clearTimeout(S.flashTimer);
    S.flashTimer = setTimeout(() => { S.flash = null; render(); }, 1600);
  }

  function press(k) {
    if (S.phase !== 'playing') return;
    S.lastInputAt = performance.now();
    el.hint.classList.remove('is-nudge');

    if (k === 'hint') {
      Sound.fn();
      showHint();
      return;
    }

    S.keys++;
    if (/^[0-9#]$/.test(k)) {
      if (S.tog && S.tog.key === k) {
        S.tog.i = (S.tog.i + 1) % KEY_LIST[k].length;
      } else {
        commitTog();
        S.tog = { key: k, i: 0 };
      }
      armTog();
      Sound.key();
    } else if (k === '*') {
      commitTog();
      const last = S.committed.length - 1;
      const ch = S.committed[last];
      if (ch && NEXT[ch]) {
        S.committed[last] = NEXT[ch];
        Sound.key();
      } else {
        Sound.nope();
        flash(ch ? `「${ch}」には ゛゜小 がつかないよ` : '先に文字を打ってから＊だよ');
      }
    } else if (k === 'right') {
      commitTog();
      Sound.fn();
    } else if (k === 'clear') {
      if (S.tog) {
        clearTimeout(S.togTimer);
        S.tog = null;
        S.clears++;
        Sound.clear();
      } else if (S.committed.length) {
        S.committed.pop();
        S.clears++;
        Sound.clear();
      } else {
        Sound.nope();
      }
    }
    update();
  }

  function update() {
    const ok = okLength();
    const err = ok < S.committed.length;
    if (err && !S.hadErr) {
      Sound.buzz();
      if (!reduceMotion) {
        el.lcd.classList.remove('is-shake');
        void el.lcd.offsetWidth;
        el.lcd.classList.add('is-shake');
      }
    }
    S.hadErr = err;
    render();
    const text = S.committed.join('') + togChar();
    if (text === S.target.join('')) completeStage();
  }

  function progressOf() {
    const ok = okLength();
    const err = ok < S.committed.length;
    if (err) return { ok, err, prog: ok, togMatch: false };
    const togMatch = !!S.tog && S.target[S.committed.length] === togChar();
    return { ok, err, prog: ok + (togMatch ? 1 : 0), togMatch };
  }

  function keyLabel(k) {
    return k === '#' ? '＃' : k === '*' ? '＊' : k;
  }

  function hintText(pos) {
    const ch = S.target[pos];
    if (!ch) return '';
    const o = bestOption(ch);
    let s = `「${ch}」は［${keyLabel(o.key)}］${o.n}回`;
    if (o.stars) s += `→［＊］${o.stars}回`;
    if (S.tog && S.tog.key === o.key && pos === S.committed.length + 1) s = `［→］で確定してから、${s}`;
    return s;
  }

  function showHint() {
    const { err, prog } = progressOf();
    if (err) {
      flash('ちがう字があるよ！先に［クリア］で消してね');
      render();
      return;
    }
    if (S.hintPos !== prog) {
      S.hintPos = prog;
      S.hints++;
    }
    render();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render() {
    const { ok, err, prog, togMatch } = progressOf();

    // お題（打ち終わった所は緑、次の1字に下線）
    let t = '';
    S.target.forEach((c, i) => {
      const cls = i < prog ? 't-done' : i === prog ? 't-next' : 't-rest';
      t += `<span class="${cls}">${escapeHtml(c)}</span>`;
    });
    el.target.innerHTML = t;

    // 本文
    let b = '';
    S.committed.forEach((c, i) => {
      b += `<span class="${i < ok ? 'c-ok' : 'c-ng'}">${escapeHtml(c)}</span>`;
    });
    if (S.tog) b += `<span class="c-tog${togMatch ? ' is-match' : ''}">${escapeHtml(togChar())}</span>`;
    b += '<span class="caret"></span>';
    if (!S.committed.length && !S.tog) b += '<span class="placeholder">ここに本文</span>';
    el.body.innerHTML = b;
    // 本文が長くて欄からあふれても、カーソルのある最終行が見えるようにする
    const box = el.body.parentElement;
    box.scrollTop = box.scrollHeight;
    box.classList.toggle('is-overflow', box.scrollHeight > box.clientHeight + 1);

    // 候補（トグル中のキーの文字一覧）
    if (S.tog) {
      const list = KEY_LIST[S.tog.key];
      el.cands.innerHTML = `<span class="cands-key">[${keyLabel(S.tog.key)}]</span>` + list.map((c, i) => `<span class="${i === S.tog.i ? 'is-cur' : ''}">${escapeHtml(c)}</span>`).join('');
    } else {
      el.cands.innerHTML = '<span class="cands-empty">キーを押すと、ここに候補が出ます</span>';
    }

    // メッセージ行
    let msg = '';
    let cls = '';
    const next = S.target[prog];
    if (err) {
      msg = 'ちがう字が入ってるよ！［クリア］で消してね';
      cls = 'is-ng';
    } else if (S.flash) {
      msg = S.flash;
      cls = 'is-tip';
    } else if (S.hintPos === prog && next) {
      msg = `ヒント：${hintText(prog)}`;
      cls = 'is-hint';
    } else if (togMatch && next && bestOption(next).key === S.tog.key) {
      msg = '同じキーが続く！［→］で確定してから次へ';
      cls = 'is-tip';
    } else if (S.idx === 0 && !S.committed.length && !S.tog) {
      msg = '同じキーを何回か押して文字を選ぶよ';
    }
    el.msg.textContent = msg;
    el.msg.className = `lcd-msg ${cls}`;

    el.keys.textContent = String(S.keys);
    if (S.phase !== 'playing') el.time.textContent = (S.total / 1000).toFixed(1);
  }

  function completeStage() {
    const now = performance.now();
    clearTimeout(S.togTimer);
    clearTimeout(S.flashTimer);
    S.flash = null;
    S.hintPos = -1;
    S.committed = S.target.slice();
    S.tog = null;
    const t = now - S.stageStart;
    S.stageTimes.push(t);
    S.total += t;
    setPhase('sending');
    render();
    Sound.send();

    const last = S.idx === S.set.length - 1;
    el.overlay.hidden = false;
    el.overlay.innerHTML = `
      <div class="env-wrap"><svg class="env" viewBox="0 0 80 52" aria-hidden="true"><path d="M2 18h9M0 27h10M4 36h7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="14" y="6" width="62" height="42" rx="3" fill="#fff" stroke="currentColor" stroke-width="3.5"/><path d="M15 8l30 22L75 8" fill="none" stroke="currentColor" stroke-width="3.5"/></svg></div>
      <p class="ov-mid">送信中…</p>
      <div class="send-bar"><i></i></div>
      <p class="ov-sub">宛先：${escapeHtml(S.set[S.idx].to)}</p>`;
    later(() => {
      Sound.done();
      el.overlay.innerHTML = `<p class="ov-done">送信完了</p><p class="ov-sub">${(t / 1000).toFixed(1)}秒　${last ? '' : `次は第${S.idx + 2}問`}</p>`;
    }, 680);
    later(() => {
      if (last) {
        incoming();
      } else {
        S.idx++;
        loadStage();
        el.overlay.hidden = true;
        el.overlay.innerHTML = '';
        beginStage();
      }
    }, 1150);
  }

  function incoming() {
    setPhase('result');
    Sound.incoming();
    el.overlay.innerHTML = '<p class="ov-incoming">新着メール1件</p><p class="ov-small">From：ケータイ打ち検定協会</p><p class="ov-sub">判定結果が届きました</p>';
    later(() => {
      el.overlay.hidden = true;
      finish();
    }, 1100);
  }

  // ========== やめる ==========
  $('btn-quit').addEventListener('click', () => {
    if (S.phase === 'playing') {
      setPhase('paused');
      S.pausedAt = performance.now();
      clearTimeout(S.togTimer);
      el.overlay.hidden = false;
      el.overlay.innerHTML = `
        <p class="ov-mid">検定をやめる？</p>
        <p class="ov-sub">ここまでの記録は残りません</p>
        <div class="ov-actions">
          <button type="button" class="ov-btn" data-ov="quit">やめる</button>
          <button type="button" class="ov-btn is-primary" data-ov="resume">つづける</button>
        </div>`;
    } else if (S.phase === 'countdown') {
      goTitle();
    }
  });
  el.overlay.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ov]');
    if (!btn || S.phase !== 'paused') return;
    if (btn.dataset.ov === 'quit') {
      goTitle();
    } else {
      S.stageStart += performance.now() - S.pausedAt;
      el.overlay.hidden = true;
      el.overlay.innerHTML = '';
      setPhase('playing');
      if (S.tog) armTog();
      S.lastInputAt = performance.now();
    }
  });

  function goTitle() {
    clearTimers();
    cancelAnimationFrame(S.raf);
    setPhase('title');
    el.overlay.hidden = true;
    el.overlay.innerHTML = '';
    renderTitle();
    showScreen('title');
  }

  // ========== 入力（タッチ／マウス／キーボード） ==========
  function pressVisual(btn, ms = 90) {
    btn.classList.add('is-down');
    clearTimeout(btn._downTimer);
    btn._downTimer = setTimeout(() => btn.classList.remove('is-down'), ms);
  }

  // click の遅延を避けて pointerdown で即反応させる
  el.keypad.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.key');
    if (!btn) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    pressVisual(btn, 110);
    press(btn.dataset.k);
  });
  // キーボードやスクリーンリーダーからのボタン操作（detail===0）だけ拾う
  el.keypad.addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (!btn || e.detail !== 0) return;
    pressVisual(btn);
    press(btn.dataset.k);
  });
  // 長押しメニュー・ダブルタップ拡大を防ぐ
  el.keypad.addEventListener('touchstart', (e) => {
    if (e.target.closest('.key')) e.preventDefault();
  }, { passive: false });
  screens.game.addEventListener('contextmenu', (e) => e.preventDefault());

  const keyBtn = {};
  el.keypad.querySelectorAll('.key').forEach((b) => { keyBtn[b.dataset.k] = b; });

  function keyFromEvent(e) {
    const k = e.key;
    if (/^[0-9]$/.test(k)) return k;
    if (k === '*' || k === '.' || e.code === 'NumpadMultiply' || e.code === 'NumpadDecimal') return '*';
    if (k === '#' || k === '/' || e.code === 'NumpadDivide') return '#';
    if (k === 'ArrowRight' || k === 'Enter') return 'right';
    if (k === 'Backspace' || k === 'Delete') return 'clear';
    if (k === 'h' || k === 'H') return 'hint';
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code || '');
    if (m) return m[1];
    return null;
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (screens.game.hidden) return;
    if (S.phase === 'paused') {
      if (e.key === 'Escape') el.overlay.querySelector('[data-ov="resume"]').click();
      return;
    }
    const k = keyFromEvent(e);
    if (!k) return;
    e.preventDefault();
    if (e.repeat) return;
    if (keyBtn[k]) pressVisual(keyBtn[k]);
    Sound.unlock();
    press(k);
  });

  // ========== 結果 ==========
  function finish() {
    cancelAnimationFrame(S.raf);
    const totalMs = Math.round(S.total);
    const sec = totalMs / 1000;
    const chars = S.set.reduce((n, m) => n + Array.from(m.text).length, 0);
    const ideal = S.set.reduce((n, m) => n + idealKeys(m.text), 0);
    const speed = ideal / Math.max(sec, 0.1);
    const tierIdx = TIERS.findIndex((t) => speed >= t.min);
    const tier = TIERS[tierIdx];
    const plays = Number(store.get('plays', '0')) + 1;
    store.set('plays', plays);
    const comment = tier.comments[(plays + Math.floor(totalMs / 100)) % tier.comments.length];

    const prevBest = Number(store.get(bestKey(), '0'));
    const isBest = !(prevBest > 0) || totalMs < prevBest;
    if (isBest) store.set(bestKey(), totalMs);
    const prevTier = store.get('bestTier', '');
    if (prevTier === '' || tierIdx < Number(prevTier)) store.set('bestTier', tierIdx);

    // 次の年式まであと何秒か（もう一回を押したくなるように）
    let nextText = '';
    if (tierIdx > 0) {
      const nt = TIERS[tierIdx - 1];
      const needSec = ideal / nt.min;
      const diff = Math.max(0.1, sec - needSec);
      nextText = `あと${diff.toFixed(1)}秒縮めると【${nt.year}年製・${nt.name}】`;
    } else {
      nextText = 'これ以上古い親指は存在しません。';
    }

    S.result = {
      sec,
      timeStr: sec.toFixed(1),
      keys: S.keys,
      clears: S.clears,
      hints: S.hints,
      cpm: Math.round(chars / (sec / 60)),
      tier,
      tierIdx,
      comment,
      plays,
      isBest,
      bestMs: isBest ? totalMs : prevBest,
    };

    const r = S.result;
    $('r-no').textContent = String(plays).padStart(4, '0');
    $('r-year').textContent = String(tier.year);
    $('r-name').textContent = tier.name;
    $('r-comment').textContent = `「${comment}」`;
    $('r-time').textContent = r.timeStr;
    $('r-keys').textContent = String(r.keys);
    $('r-miss').textContent = String(r.clears);
    $('r-cpm').textContent = String(r.cpm);
    $('r-next').textContent = nextText;
    $('r-best').innerHTML = `今日のベスト ${(r.bestMs / 1000).toFixed(1)}秒${isBest ? '<span class="new">NEW!</span>' : ''}${r.hints ? `　｜　ヒント使用 ${r.hints}回` : ''}`;
    $('btn-post').href = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText(r))}&url=${encodeURIComponent(SITE_URL)}`;

    $('sent-date').textContent = `（${dateLabel}の出題）`;
    $('sent-list').innerHTML = S.set.map((m, i) => `
      <li><span class="sent-to">第${i + 1}問・宛先：${escapeHtml(m.to)}</span><span class="sent-sec">${(S.stageTimes[i] / 1000).toFixed(1)}秒</span><span class="sent-text">${escapeHtml(m.text)}</span></li>`).join('');

    setPhase('result');
    showScreen('result');
    S.cardPromise = buildCard(r).then((blob) => {
      S.cardBlob = blob;
      return blob;
    });
  }

  function shareText(r) {
    return `ケータイ打ち検定、私の親指は【${r.tier.year}年製・${r.tier.name}】でした📱 平成メール5通を${r.timeStr}秒（${r.keys}打鍵）で送信 #ケータイ打ち検定`;
  }

  $('btn-retry').addEventListener('click', () => {
    Sound.unlock();
    startGame();
  });
  $('btn-home').addEventListener('click', () => goTitle());

  $('btn-image').addEventListener('click', async () => {
    if (!S.result) return;
    const blob = S.cardBlob || await S.cardPromise;
    const file = new File([blob], 'keitai-uchi-result.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${shareText(S.result)} ${SITE_URL}` });
      } catch (e) {
        if (e.name === 'AbortError') return; // ユーザーが共有シートを閉じただけ
        console.warn('共有に失敗したので画像を保存します', e);
        downloadBlob(blob);
      }
    } else {
      downloadBlob(blob);
    }
  });

  function downloadBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'keitai-uchi-result.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('結果画像を保存しました');
  }

  // ========== 結果カード画像（canvas 1200x630） ==========
  function rr(g, x, y, w, h, r) {
    const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
    g.beginPath();
    g.moveTo(x + tl, y);
    g.lineTo(x + w - tr, y);
    g.quadraticCurveTo(x + w, y, x + w, y + tr);
    g.lineTo(x + w, y + h - br);
    g.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    g.lineTo(x + bl, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - bl);
    g.lineTo(x, y + tl);
    g.quadraticCurveTo(x, y, x + tl, y);
    g.closePath();
  }
  function sparkle(g, x, y, s, color) {
    g.save();
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x, y - s);
    g.quadraticCurveTo(x, y, x + s, y);
    g.quadraticCurveTo(x, y, x, y + s);
    g.quadraticCurveTo(x, y, x - s, y);
    g.quadraticCurveTo(x, y, x, y - s);
    g.fill();
    g.restore();
  }
  function fitFont(g, text, maxW, size, family, weight = '') {
    let s = size;
    g.font = `${weight} ${s}px ${family}`.trim();
    while (g.measureText(text).width > maxW && s > 12) {
      s -= 2;
      g.font = `${weight} ${s}px ${family}`.trim();
    }
    return s;
  }

  async function buildCard(r) {
    const W = 1200;
    const H = 630;
    const DOT = '"DotGothic16", "MS Gothic", monospace';
    const RND = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif';
    const th = THEMES[themeIdx];
    const stats = [
      ['タイム', `${r.timeStr}`, '秒'],
      ['総打鍵数', `${r.keys}`, '回'],
      ['ミス', `${r.clears}`, '回'],
      ['1分あたり', `${r.cpm}`, '文字'],
    ];
    const clock = document.querySelector('.js-clock').textContent;
    const dotText = `受信メールFrom：ケータイ打ち検定協会あなたの親指は年製「」${r.comment}${r.tier.year}${clock}${stats.flat().join('')}0123456789.`;
    const rndText = `${r.tier.name}#ケータイ打ち検定${SITE_LABEL}親指認定`;
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load(`40px "DotGothic16"`, dotText),
          document.fonts.load(`800 40px "M PLUS Rounded 1c"`, rndText),
        ]),
        new Promise((res) => setTimeout(res, 3000)),
      ]);
    } catch (e) {
      console.warn('Webフォントを読み込めなかったので代替フォントで描画します', e);
    }

    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');

    // 背景
    let gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, th.bg[0]);
    gr.addColorStop(0.5, th.bg[1]);
    gr.addColorStop(1, th.bg[2]);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let y = 14; y < H; y += 30) {
      for (let x = (Math.floor(y / 30) % 2) * 15 + 8; x < W; x += 30) {
        g.beginPath();
        g.arc(x, y, 1.8, 0, Math.PI * 2);
        g.fill();
      }
    }
    sparkle(g, 48, 70, 22, '#fff');
    sparkle(g, 1150, 110, 18, '#fff');
    sparkle(g, 1160, 520, 26, th.accent);
    sparkle(g, 40, 470, 14, th.accent);

    // ケータイの上半分
    const px = 70;
    const py = 26;
    const pw = 1060;
    const ph = 532;
    g.save();
    g.shadowColor = 'rgba(90,30,60,.28)';
    g.shadowBlur = 30;
    g.shadowOffsetY = 12;
    rr(g, px, py, pw, ph, [60, 60, 20, 20]);
    gr = g.createLinearGradient(px, py, px + pw * 0.4, py + ph);
    gr.addColorStop(0, th.body[0]);
    gr.addColorStop(0.5, th.body[1]);
    gr.addColorStop(1, th.body[2]);
    g.fillStyle = gr;
    g.fill();
    g.restore();
    g.strokeStyle = th.edge;
    g.lineWidth = 2;
    rr(g, px, py, pw, ph, [60, 60, 20, 20]);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.7)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(px + 60, py + 4);
    g.lineTo(px + pw - 60, py + 4);
    g.stroke();
    // スピーカー
    g.fillStyle = 'rgba(0,0,0,.3)';
    for (let i = 0; i < 16; i++) {
      rr(g, 553 + i * 6, 42, 3, 10, 1.5);
      g.fill();
    }

    // ヒンジ
    gr = g.createLinearGradient(0, 552, 0, 584);
    gr.addColorStop(0, th.body[2]);
    gr.addColorStop(0.45, th.body[0]);
    gr.addColorStop(1, th.body[2]);
    g.fillStyle = gr;
    rr(g, 120, 552, 960, 30, 15);
    g.fill();

    // 液晶
    const lx = 112;
    const ly = 70;
    const lw = 976;
    const lh = 462;
    g.fillStyle = '#17161c';
    rr(g, lx, ly, lw, lh, 26);
    g.fill();
    const sx = lx + 12;
    const sy = ly + 12;
    const sw = lw - 24;
    const sh = lh - 24;
    gr = g.createLinearGradient(0, sy, 0, sy + sh);
    gr.addColorStop(0, '#effffc');
    gr.addColorStop(1, '#bfeee7');
    g.fillStyle = gr;
    rr(g, sx, sy, sw, sh, 16);
    g.fill();
    g.save();
    rr(g, sx, sy, sw, sh, 16);
    g.clip();

    const INK = '#0f3442';
    const DIM = '#4f7f88';
    // ステータスバー
    g.fillStyle = 'rgba(15,52,66,.08)';
    g.fillRect(sx, sy, sw, 40);
    g.fillStyle = INK;
    // アンテナ
    g.beginPath();
    g.moveTo(sx + 18, sy + 10);
    g.lineTo(sx + 32, sy + 10);
    g.lineTo(sx + 25, sy + 19);
    g.closePath();
    g.fill();
    g.fillRect(sx + 23.5, sy + 18, 3, 13);
    g.fillRect(sx + 38, sy + 24, 6, 7);
    g.fillRect(sx + 47, sy + 18, 6, 13);
    g.fillRect(sx + 56, sy + 11, 6, 20);
    // メールアイコン
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.strokeRect(sx + 80, sy + 12, 26, 18);
    g.beginPath();
    g.moveTo(sx + 81, sy + 13);
    g.lineTo(sx + 93, sy + 23);
    g.lineTo(sx + 105, sy + 13);
    g.stroke();
    g.font = `24px ${DOT}`;
    g.textBaseline = 'alphabetic';
    g.fillText('受信メール', sx + 118, sy + 29);
    // 時刻と電池
    g.textAlign = 'right';
    g.fillText(clock, sx + sw - 70, sy + 29);
    g.textAlign = 'left';
    g.strokeRect(sx + sw - 58, sy + 12, 36, 18);
    g.fillRect(sx + sw - 21, sy + 17, 4, 8);
    for (let i = 0; i < 3; i++) g.fillRect(sx + sw - 54 + i * 11, sy + 16, 8, 10);

    // ヘッダー
    g.fillStyle = DIM;
    g.font = `24px ${DOT}`;
    g.fillText('From：ケータイ打ち検定協会', sx + 26, sy + 76);
    g.strokeStyle = 'rgba(15,52,66,.25)';
    g.setLineDash([6, 5]);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(sx + 20, sy + 92);
    g.lineTo(sx + sw - 20, sy + 92);
    g.stroke();
    g.setLineDash([]);

    // 本体：年式
    g.fillStyle = INK;
    g.font = `34px ${DOT}`;
    g.fillText('あなたの親指は', sx + 30, sy + 140);
    g.font = `150px ${DOT}`;
    const yearStr = String(r.tier.year);
    g.fillText(yearStr, sx + 22, sy + 278);
    const yw = g.measureText(yearStr).width;
    g.font = `64px ${DOT}`;
    g.fillText('年製', sx + 30 + yw, sy + 276);

    // 判子
    g.save();
    g.translate(sx + 30 + yw + 200, sy + 205);
    g.rotate(-0.24);
    g.strokeStyle = 'rgba(224,25,63,.85)';
    g.fillStyle = 'rgba(224,25,63,.85)';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(0, 0, 56, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, 48, 0, Math.PI * 2);
    g.stroke();
    g.font = `800 26px ${RND}`;
    g.textAlign = 'center';
    g.fillText('親指', 0, -4);
    g.fillText('認定', 0, 28);
    g.restore();
    g.textAlign = 'left';

    // 称号
    g.fillStyle = '#c81e66';
    fitFont(g, r.tier.name, 560, 62, RND, '800');
    g.fillText(r.tier.name, sx + 30, sy + 360);
    // コメント
    g.fillStyle = INK;
    fitFont(g, `「${r.comment}」`, sw - 60, 28, DOT);
    g.fillText(`「${r.comment}」`, sx + 26, sy + 412);

    // 成績（右側の2x2）
    const bx = sx + 620;
    const by = sy + 112;
    const cw = 150;
    const ch = 104;
    stats.forEach((s, i) => {
      const x = bx + (i % 2) * (cw + 12);
      const y = by + Math.floor(i / 2) * (ch + 12);
      g.fillStyle = 'rgba(255,255,255,.62)';
      rr(g, x, y, cw, ch, 10);
      g.fill();
      g.strokeStyle = 'rgba(15,52,66,.22)';
      g.lineWidth = 1.5;
      rr(g, x, y, cw, ch, 10);
      g.stroke();
      g.fillStyle = DIM;
      g.font = `20px ${DOT}`;
      g.fillText(s[0], x + 12, y + 30);
      g.fillStyle = INK;
      const vs = fitFont(g, s[1], cw - 50, 48, DOT);
      g.fillText(s[1], x + 12, y + 84);
      const vw = g.measureText(s[1]).width;
      g.font = `${Math.round(vs * 0.42)}px ${DOT}`;
      g.fillText(s[2], x + 16 + vw, y + 84);
    });

    // 液晶の質感
    g.fillStyle = 'rgba(0,40,50,.035)';
    for (let y = sy; y < sy + sh; y += 3) g.fillRect(sx, y, sw, 1);
    g.fillStyle = 'rgba(255,255,255,.1)';
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx + 240, sy);
    g.lineTo(sx + 90, sy + sh);
    g.lineTo(sx, sy + sh);
    g.closePath();
    g.fill();
    g.restore();

    // 下部のハッシュタグとURL
    g.fillStyle = th.ink;
    g.textAlign = 'center';
    g.font = `800 30px ${RND}`;
    g.fillText(`#ケータイ打ち検定　${SITE_LABEL}`, W / 2, 616);
    g.textAlign = 'left';

    return new Promise((resolve, reject) => {
      cv.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('結果画像の生成に失敗しました'))), 'image/png');
    });
  }
})();
