// scripts/challenge.js
// =================================================================
// チャレンジモード：4択／並べ替え／DQ風UI／タイマー／HP／コンボ
// =================================================================

// 設定とチャレンジ用 状態
/* ====== チャレンジ設定 ====== */
const CHALLENGE_CONFIG = {
  questionCount: 20,
  timePerQuestion: 15,           // 秒
  matchingTimeMultiplier: 2,     // マッチングは×2倍 = 30秒
  startHp: 50,
  hpDamage: 10,                  // 不正解1回でHPが減る量（5回まで耐える）
  basePoints: 10,
  comboBonus: 5,                 // コンボ1段ごとの追加点
  timeBonusPerSec: 1,            // 残り1秒につき+1点
  matchingScoreMultiplier: 4,    // マッチングは 4倍 = 40点ベース
  arrangeTotalTiles: 10,         // 並べ替え タイル総数（5×2）
  arrangeMinLen: 2,
  arrangeMaxLen: 8,
  arrangeInvalidPattern: /[（）\(\)・\s／\/]/,
  numericPattern: /^[0-9]+(\.[0-9]+)?$/,
  numericMaxLen: 6,
  matchingFrequency: 0           // 0 にするとマッチング出題は完全停止
};


const challengeSelectedBundles = new Set();
let challengeState = null;

// マッチング用カラー（マッチング廃止につき未使用、互換のため残置）
const MATCHING_COLORS = ["#ec4899", "#3b82f6", "#10b981", "#f59e0b"];

/* ────────────── 敵モンスター進行 ──────────────
   出現順：スライム → キングスライム → キラーマシン → ドラゴン → ゾーマ
   - 各モンスターは指定回数の正解で倒れて次に進む
   - 最後のゾーマは hits=Infinity（HPを残して20問完走で勝利扱い）
*/
const ENEMIES = [
  { key: "slime",         name: "スライム",       image: "images/Slime.png",         hits: 3 },
  { key: "kingslime",     name: "キングスライム", image: "images/Kingslime.png",     hits: 3 },
  { key: "killermachine", name: "キラーマシン",   image: "images/Killermachine.png", hits: 3 },
  { key: "dragon",        name: "ドラゴン",       image: "images/Dragon.png",        hits: 4 },
  { key: "zoma",          name: "ゾーマ",         image: "images/Zoma.png",          hits: Infinity }
];

/* ====== チャレンジモード本体 ====== */
/* ============================================================ */

/* ── 案①：答えの末尾でカテゴリを判定 ── */
const CATEGORY_PATTERNS = [
  { name: "prefecture", re: /県$/ },
  { name: "city",       re: /[市町村]$/ },
  { name: "mountain",   re: /[山岳]$/ },
  { name: "river",      re: /川$/ },
  { name: "plain",      re: /[平野盆地]$/ },
  { name: "water",      re: /(海|湾|海峡)$/ },
  { name: "island",     re: /島$/ }
];
function detectCategory(answer) {
  if (!answer) return null;
  for (const cat of CATEGORY_PATTERNS) {
    if (cat.re.test(answer)) return cat.name;
  }
  return null;
}

/* ── 出題対象になる答えか？ ── */
function isArrangeAnswer(a) {
  if (!a || typeof a !== "string") return false;
  if (CHALLENGE_CONFIG.arrangeInvalidPattern.test(a)) return false;
  const chars = Array.from(a);
  if (chars.length < CHALLENGE_CONFIG.arrangeMinLen) return false;
  if (chars.length > CHALLENGE_CONFIG.arrangeMaxLen) return false;
  return true;
}
function isNumericAnswer(a) {
  return typeof a === "string"
    && CHALLENGE_CONFIG.numericPattern.test(a)
    && a.length <= CHALLENGE_CONFIG.numericMaxLen;
}
/* ▼ 案⑦：4択は10文字以内、特殊文字なしの答えのみ対象 */
const FOURCHOICE_MAX_LEN = 10;
const FOURCHOICE_INVALID_PATTERN = /[（）\(\)／\/。、]/;
function is4ChoiceAnswer(a) {
  if (!a || typeof a !== "string") return false;
  if (Array.from(a).length > FOURCHOICE_MAX_LEN) return false;
  if (FOURCHOICE_INVALID_PATTERN.test(a)) return false;
  return true;
}

/* ── 数字 trivia フィルタ：覚える価値のある数字だけを残す ── */
function isMeaningfulNumber(a) {
  if (!a || typeof a !== "string") return true;
  // 数字＋単位（例：100万人、2025年）は trivia とは限らないが、ここでは純粋な数字かをまず判定
  if (!/^[0-9]+(\.[0-9]+)?$/.test(a)) return true;  // 純粋な数字でないなら meaningful 扱い
  const n = parseFloat(a);
  if (isNaN(n)) return true;
  // 年号（1800〜2100 の整数）→ 出題する
  if (Number.isInteger(n) && n >= 1800 && n <= 2100) return true;
  // 小数点ありはたいてい trivia（気温・降水量など）
  if (!Number.isInteger(n)) return false;
  // 4桁以上の固有数値（面積・人口）→ 出題しない
  if (n >= 1000 && !(n >= 1800 && n <= 2100)) return false;
  // 3桁の特定数値（〇〇mm, 〇〇km）→ trivia 寄り
  if (n >= 100) return false;
  // 2桁以下の整数は意味あり（％、年数、人数の○○万 など）
  return true;
}

/* ── 案③：数字答え用、近接する数字を生成 ── */
function generateNumericDistractors(a, count = 6) {
  const n = parseFloat(a);
  if (isNaN(n)) return [];
  const isInt = Number.isInteger(n);
  const isYear = n >= 1000 && isInt;
  let offsets;
  if (isYear)        offsets = [-5, -3, -1, 1, 3, 5, -10, 10, -2, 2];
  else if (n >= 100) offsets = [-30, -20, -10, -5, 5, 10, 20, 30];
  else if (n >= 10)  offsets = [-5, -3, -2, -1, 1, 2, 3, 5, 10, -10];
  else if (isInt)    offsets = [-3, -2, -1, 1, 2, 3, 4, -4, 5];
  else               offsets = [-1.5, -1, -0.5, 0.5, 1, 1.5, 2, -2];
  const candidates = [];
  const seen = new Set([a]);
  for (const off of offsets) {
    const v = n + off;
    if (v < 0) continue;
    const formatted = isInt ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString();
    if (seen.has(formatted)) continue;
    seen.add(formatted);
    candidates.push(formatted);
    if (candidates.length >= count) break;
  }
  return candidates;
}

/* ── 案①②③④⑦：4択の誤答3つを作る ──
   優先順位：手書き wrong → 兄弟空欄 → 数字近接 → 同カテゴリ → ランダム
*/
function generate4ChoiceWrongs(correct, siblings, candidatePool, need, manualWrongs) {
  const wrongs = [];
  const used = new Set([correct]);
  function add(x) {
    if (!x || used.has(x)) return false;
    if (!is4ChoiceAnswer(x)) return false;        // 案⑦：長文・特殊は誤答にしない
    used.add(x);
    wrongs.push(x);
    return wrongs.length >= need;
  }
  // 0) 手書き wrong（最優先・案④）
  for (const w of shuffle(manualWrongs || [])) {
    if (add(w)) return wrongs;
  }
  // 1) 兄弟空欄（cloze の同じ fact 内の他の語）
  for (const s of shuffle(siblings || [])) {
    if (add(s)) return wrongs;
  }
  // 2) 数字なら近接数字
  if (/^[0-9]+(\.[0-9]+)?$/.test(correct)) {
    for (const n of generateNumericDistractors(correct, 6)) {
      if (add(n)) return wrongs;
    }
  }
  // 3) 同カテゴリ（県・山・川・市など）
  const cat = detectCategory(correct);
  if (cat) {
    const same = candidatePool.filter(x => detectCategory(x) === cat);
    for (const x of shuffle(same)) {
      if (add(x)) return wrongs;
    }
  }
  // 4) フォールバック：全体プール
  for (const x of shuffle(candidatePool)) {
    if (add(x)) return wrongs;
  }
  return wrongs;
}

/* ── 案①②③④：並べ替えのダミー文字を作る ── */
function generateArrangeDummies(correct, siblings, candidatePool, need, manualWrongs) {
  const correctChars = new Set(Array.from(correct));
  const dummyChars = [];
  const used = new Set();
  function addChar(c) {
    if (!c || correctChars.has(c) || used.has(c)) return false;
    used.add(c);
    dummyChars.push(c);
    return dummyChars.length >= need;
  }
  // 0) 手書き wrong の文字（最優先）
  for (const w of shuffle(manualWrongs || [])) {
    for (const c of Array.from(w)) if (addChar(c)) return dummyChars;
  }
  // 1) 兄弟空欄の文字
  for (const s of shuffle(siblings || [])) {
    for (const c of Array.from(s)) if (addChar(c)) return dummyChars;
  }
  // 2) 数字答えなら 0〜9 の不足桁
  if (/^[0-9]+(\.[0-9]+)?$/.test(correct)) {
    for (const c of shuffle(Array.from("0123456789"))) if (addChar(c)) return dummyChars;
  }
  // 3) 同カテゴリの文字
  const cat = detectCategory(correct);
  if (cat) {
    const same = candidatePool.filter(x => detectCategory(x) === cat);
    for (const x of shuffle(same)) {
      for (const c of Array.from(x)) if (addChar(c)) return dummyChars;
    }
  }
  // 4) フォールバック：全体プールの文字
  for (const x of shuffle(candidatePool)) {
    for (const c of Array.from(x)) if (addChar(c)) return dummyChars;
  }
  return dummyChars;
}

/* ── バンドル → 単元キー → カードに展開 ── */
function collectChallengeCards(bundleKeysSet) {
  const unitKeys = new Set();
  const bundles = window.CHALLENGE_BUNDLES || [];
  for (const b of bundles) {
    if (bundleKeysSet.has(b.key)) {
      for (const u of (b.units || [])) unitKeys.add(u);
    }
  }
  return collectCards(unitKeys);
}

/* ── チャレンジ用バンドルチップを構築 ── */
function buildBundleChips(containerId, selectedSet, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  const bundles = window.CHALLENGE_BUNDLES || [];
  if (bundles.length === 0) {
    container.innerHTML = '<div class="no-units">バンドル未定義</div>';
    return;
  }
  // 教科ごとに見出しをつける
  const bySubject = new Map();
  for (const b of bundles) {
    const s = b.subject || "その他";
    if (!bySubject.has(s)) bySubject.set(s, []);
    bySubject.get(s).push(b);
  }
  for (const [subject, items] of bySubject) {
    const heading = document.createElement("div");
    heading.className = "chip-group-title";
    heading.textContent = subject;
    container.appendChild(heading);
    const group = document.createElement("div");
    group.className = "chip-group";
    for (const b of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.bundle = b.key;
      btn.textContent = b.title;
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => {
        if (selectedSet.has(b.key)) selectedSet.delete(b.key);
        else selectedSet.add(b.key);
        vibrate(8);
        refreshBundleChipStates(containerId, selectedSet);
        onChange();
      });
      group.appendChild(btn);
    }
    container.appendChild(group);
  }
  refreshBundleChipStates(containerId, selectedSet);
}

function refreshBundleChipStates(containerId, selectedSet) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll(".chip").forEach(btn => {
    const on = selectedSet.has(btn.dataset.bundle);
    btn.classList.toggle("chip--on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

/* ====== チャレンジ：範囲選択 ====== */
function enterChallengeSelect() {
  showScreen("challenge-select");
  buildBundleChips("chChips", challengeSelectedBundles, updateChallengeSelectInfo);
  updateChallengeSelectInfo();
  document.getElementById("chStart").onclick = () => {
    if (challengeSelectedBundles.size === 0) return;
    vibrate(10);
    startChallengeSession();
  };
}

function updateChallengeSelectInfo() {
  const info = document.getElementById("chSelectInfo");
  const start = document.getElementById("chStart");
  const pool = collectChallengeCards(challengeSelectedBundles);
  if (challengeSelectedBundles.size === 0) {
    info.innerHTML = "範囲を選んでください";
    start.disabled = true;
  } else if (pool.length < 4) {
    info.innerHTML = `<strong>カードが少なすぎます</strong>（${pool.length}問）— 最低4問必要です`;
    start.disabled = true;
  } else {
    info.innerHTML = `選択範囲から <strong>${pool.length}</strong> 問のうち <strong>${CHALLENGE_CONFIG.questionCount}</strong> 問を出題`;
    start.disabled = false;
  }
}

/* ====== チャレンジ：問題セット生成 ====== */
function buildChallengeQuestions(bundleSet) {
  const raw = collectChallengeCards(bundleSet);
  let pool = [];
  for (const c of raw) {
    if (c.fact) {
      // 数字 trivia を避けるため、意味ある答えが出るまで最大5回 materialize し直す
      let m = null;
      for (let i = 0; i < 5; i++) {
        const tmp = materializeCloze(c.fact, true);
        if (isMeaningfulNumber(tmp.a)) { m = tmp; break; }
        m = tmp;
      }
      if (!m || !m.a) continue;
      if (!isMeaningfulNumber(m.a)) continue;  // 5回試して全部 trivia ならスキップ
      const manualWrongs = (c.wrong && typeof c.wrong === "object" && !Array.isArray(c.wrong)) ?
        (c.wrong[m.a] || []) : [];
      pool.push({ card: c, q: m.q, a: m.a, siblings: m.siblings || [], manualWrongs });
    } else if (c.q && c.a) {
      if (!isMeaningfulNumber(c.a)) continue;
      const manualWrongs = Array.isArray(c.wrong) ? c.wrong : [];
      pool.push({ card: c, q: c.q, a: c.a, siblings: [], manualWrongs });
    }
  }
  if (pool.length === 0) return null;

  // 全答えのプール（誤答候補用）
  const allAnswers = pool.map(p => p.a);

  const questions = [];
  let slot = 0;
  while (slot < CHALLENGE_CONFIG.questionCount && pool.length > 0) {
    // 普通の1問
    const idx = Math.floor(Math.random() * pool.length);
    const { card, q, a, siblings, manualWrongs } = pool.splice(idx, 1)[0];

    // 案⑦：長文・特殊な答えは4択候補にならない
    const eligibles = [];
    if (is4ChoiceAnswer(a)) eligibles.push("4choice");
    if (isArrangeAnswer(a)) eligibles.push("arrange");
    if (eligibles.length === 0) {
      // どちらにも向かない答えはセッションから除外
      continue;
    }
    const type = eligibles[Math.floor(Math.random() * eligibles.length)];

    if (type === "4choice") {
      const wrongs = generate4ChoiceWrongs(a, siblings, allAnswers, 3, manualWrongs);
      // 万一3つ集まらなかったら他の答えで埋める
      while (wrongs.length < 3) {
        const cand = allAnswers[Math.floor(Math.random() * allAnswers.length)];
        if (cand !== a && !wrongs.includes(cand) && is4ChoiceAnswer(cand)) wrongs.push(cand);
        else if (allAnswers.length < 4) break;
      }
      const choices = shuffle([a, ...wrongs.slice(0, 3)]);
      questions.push({ type, card, q, a, choices });
    } else {  // arrange
      const chars = Array.from(a);
      const need = CHALLENGE_CONFIG.arrangeTotalTiles - chars.length;
      const dummies = generateArrangeDummies(a, siblings, allAnswers, need, manualWrongs);
      const all = shuffle([...chars, ...dummies]);
      const tiles = all.map((char, i) => ({ id: i, char }));
      questions.push({
        type, card, q, a,
        tiles,
        placement: chars.map(() => null)
      });
    }
    slot++;
  }

  return questions;
}
/* ====== チャレンジ：セッション開始 ====== */
function startChallengeSession() {
  const questions = buildChallengeQuestions(challengeSelectedBundles);
  if (!questions || questions.length === 0) {
    alert("選択範囲にカードがありません");
    return;
  }
  // ゾーマの defeated 状態をリセット（リトライ時に必要）
  resetEnemyAnim();
  challengeState = {
    questions,
    index: 0,
    hp: CHALLENGE_CONFIG.startHp,
    score: 0,
    combo: 0,
    maxCombo: 0,
    correctCount: 0,
    finished: false,
    answered: false,
    timeLeft: 0,
    maxTime: CHALLENGE_CONFIG.timePerQuestion,
    timer: null,
    matchingSelectedQ: null,
    // ▼ 4択の現在の選択（提出前）
    selectedChoice: null,
    // ▼ モンスター進行
    enemyIdx: 0,
    enemyHits: 0
  };
  document.getElementById("chResultTotal").textContent = questions.length;
  showScreen("challenge");
  renderEnemy(true);   // 最初の敵（スライム）を登場演出付きで表示
  showCurrentChallenge();
}

/* ====== チャレンジ：HP表示（DQ風バー） ====== */
function renderChallengeHp(hp) {
  const max = CHALLENGE_CONFIG.startHp;
  const safeHp = Math.max(0, Math.min(max, hp));
  const pct = (safeHp / max) * 100;
  let stateCls = "";
  if (pct <= 20)      stateCls = " ch-hero__stat--low";
  else if (pct <= 40) stateCls = " ch-hero__stat--mid";
  return `<span class="ch-hero__icon ch-hero__icon--hp${stateCls}">♥</span>` +
         `<span class="ch-hero__lbl">HP</span>` +
         `<span class="ch-hero__val${stateCls}">${safeHp}/${max}</span>`;
}

/* ====== チャレンジ：HP表示（旧ハート版・未使用） ====== */
function renderChallengeHpHearts(hp) {
  const max = CHALLENGE_CONFIG.startHp;
  let html = "";
  for (let i = 0; i < max; i++) {
    const filled = i < hp;
    html += `<span class="hp-heart${filled ? "" : " hp-heart--lost"}" aria-hidden="true">♥</span>`;
  }
  return html;
}

/* ====== チャレンジ：問題表示（共通） ====== */
function showCurrentChallenge() {
  if (!challengeState) return;
  const q = challengeState.questions[challengeState.index];
  if (!q) { finishChallenge(); return; }

  // ステータスバー＋勇者画像（HPベースの idle 状態）
  renderHeroStats();
  setHeroImage("idle");

  // コンボ表示は勇者ステータス枠の CB 行に統合済み（旧コンボバナーは廃止）
  const comboEl = document.getElementById("chCombo");
  if (comboEl) { comboEl.hidden = true; comboEl.textContent = ""; }

  // コマンドカーソル更新（現在の形式に ▶ が付く）
  document.querySelectorAll(".ch-cmd").forEach(el => {
    el.classList.toggle("ch-cmd--active", el.dataset.cmd === q.type);
  });

  // メタ情報：何問目／ジャンル（単元タイトル）
  const metaEl = document.getElementById("chQMeta");
  if (metaEl) {
    const idx = challengeState.index + 1;
    const total = challengeState.questions.length;
    const unit = (q.card && q.card.mode && window.CARDS) ? window.CARDS[q.card.mode] : null;
    const genre = unit ? (unit.title || q.card.mode) : "";
    metaEl.innerHTML =
      `<span class="ch-q-meta__progress">${idx} / ${total}</span>` +
      `<span class="ch-q-meta__genre">${genre}</span>`;
  }

  // Question text rendering (typewriter reveal)
  const qTextEl = document.getElementById("chQText");
  const qText = (q.type === "matching") ? "問題と答えを線で結ぼう" : q.q;
  // Safety net: render the full text first so something is always visible
  if (qTextEl) qTextEl.textContent = String(qText == null ? "" : qText);
  try { typewriterReveal(qTextEl, qText); } catch (e) { console.warn("[challenge] typewriter failed", e); }

  // 画像
  const img = document.getElementById("chQImg");
  if (q.card && q.card.qImg) { img.src = q.card.qImg; img.hidden = false; }
  else { img.removeAttribute("src"); img.hidden = true; }

  // 各エリアの表示切り替え
  document.getElementById("chChoices").hidden = q.type !== "4choice";
  document.getElementById("chArrangeArea").hidden = q.type !== "arrange";
  document.getElementById("chNumericArea").hidden = q.type !== "numeric";
  document.getElementById("chMatchingArea").hidden = q.type !== "matching";

  // ▼ DOM 生成より先に answered をリセット
  //   （前問の answered=true のまま render すると新ボタンが軒並み disabled になるバグ防止）
  challengeState.answered = false;
  // 前問の選択状態をクリア
  challengeState.selectedChoice = null;

  // 形式ごとの描画
  if (q.type === "4choice") render4Choice(q);
  else if (q.type === "arrange") renderArrangeChallenge(q);
  else if (q.type === "numeric") renderNumericChallenge(q);
  else if (q.type === "matching") renderMatchingChallenge(q);

  // タイマー
  challengeState.maxTime = q.type === "matching"
    ? CHALLENGE_CONFIG.timePerQuestion * CHALLENGE_CONFIG.matchingTimeMultiplier
    : CHALLENGE_CONFIG.timePerQuestion;
  challengeState.timeLeft = challengeState.maxTime;
  startChallengeTimer();

  // こたえるボタンの活性状態を初期化
  updateSubmitButton();
}

/* ====== タイマー & リング ====== */
function updateChallengePanelRing() {
  const panel = document.getElementById("chPanel");
  if (!panel) return;
  const svg = panel.querySelector(".ch-panel-ring");
  const bgRect = panel.querySelector(".ch-panel-ring__bg");
  const fgRect = document.getElementById("chPanelRingFg");
  if (!svg || !fgRect) return;
  const w = panel.offsetWidth;
  const h = panel.offsetHeight;
  if (w === 0 || h === 0) return;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const inset = 3;
  const rw = Math.max(0, w - inset * 2);
  const rh = Math.max(0, h - inset * 2);
  [bgRect, fgRect].forEach(r => {
    if (!r) return;
    r.setAttribute("x", inset);
    r.setAttribute("y", inset);
    r.setAttribute("width", rw);
    r.setAttribute("height", rh);
  });
  const perimeter = 2 * (rw + rh);
  fgRect.setAttribute("stroke-dasharray", perimeter);
  fgRect.dataset.perimeter = perimeter;
}

function startChallengeTimer() {
  if (challengeState.timer) clearInterval(challengeState.timer);
  updateChallengeTimerDisplay();
  challengeState.timer = setInterval(() => {
    if (!challengeState || challengeState.answered) return;
    challengeState.timeLeft -= 0.05;
    if (challengeState.timeLeft <= 0) {
      challengeState.timeLeft = 0;
      updateChallengeTimerDisplay();
      onChallengeTimeout();
    } else {
      updateChallengeTimerDisplay();
    }
  }, 50);
}

function updateChallengeTimerDisplay() {
  if (!challengeState) return;
  const t = Math.max(0, challengeState.timeLeft);
  const ratio = t / challengeState.maxTime;
  const el = document.getElementById("chTimerDisplay");
  if (el) {
    el.textContent = t.toFixed(2);
    el.classList.remove("ch-time--warn", "ch-time--danger");
    if (ratio < 0.2) el.classList.add("ch-time--danger");
    else if (ratio < 0.5) el.classList.add("ch-time--warn");
  }
  // ▼ タイマー進行バー（横方向にドレイン）
  const fill = document.getElementById("chTimerFill");
  if (fill) {
    fill.style.width = Math.max(0, Math.min(100, ratio * 100)) + "%";
    fill.classList.remove("ch-time-fill--warn", "ch-time-fill--danger");
    if (ratio < 0.2) fill.classList.add("ch-time-fill--danger");
    else if (ratio < 0.5) fill.classList.add("ch-time-fill--warn");
  }
}

function stopChallengeTimer() {
  if (challengeState && challengeState.timer) {
    clearInterval(challengeState.timer);
    challengeState.timer = null;
  }
}

/* ====== 共通：正解／不正解の処理 ====== */
function onChallengeCorrect(extraMultiplier = 1) {
  if (!challengeState || challengeState.answered) return;
  challengeState.answered = true;
  stopChallengeTimer();
  challengeState.combo += 1;
  if (challengeState.combo > challengeState.maxCombo)
    challengeState.maxCombo = challengeState.combo;
  challengeState.correctCount += 1;

  const base = CHALLENGE_CONFIG.basePoints * extraMultiplier;
  const comboPts = CHALLENGE_CONFIG.comboBonus * Math.max(0, challengeState.combo - 1);
  const timePts = Math.floor(Math.max(0, challengeState.timeLeft) * CHALLENGE_CONFIG.timeBonusPerSec);
  const total = base + comboPts + timePts;
  challengeState.score += total;

  vibrate(20);
  // ▼ DQ風：浮き上がる「+N」ダメージ数
  spawnDqDamage(`+${total}`, "correct");
  // ▼ コンボバナー（2連以上）
  if (challengeState.combo >= 2) showDqComboBanner(challengeState.combo);
  // ▼ 敵モンスターに被ダメージ＋ヒット累積（必要なら次の敵へ）
  triggerEnemyAnim("hit");
  // ▼ 提案#6：スラッシュエフェクト（モンスターを横切る斬撃）
  spawnSlashEffect();
  setTimeout(tickEnemyOnCorrect, 200);
  // ▼ 勇者は攻撃モーション＋CB画像へ切替
  setHeroImage("attack");
  triggerHeroAnim("attack");

  let text = `かいしんのいちげき！　+${total}点`;
  if (comboPts > 0) text += `（コンボ+${comboPts}）`;
  showChallengeFeedback({ type: "correct", text });

  renderHeroStats();
  setTimeout(nextChallengeOrFinish, 1300);
}

function onChallengeWrong(showAnswer = null, extraMultiplier = 1) {
  if (!challengeState || challengeState.answered) return;
  challengeState.answered = true;
  stopChallengeTimer();
  challengeState.hp -= CHALLENGE_CONFIG.hpDamage;
  if (challengeState.hp < 0) challengeState.hp = 0;
  challengeState.combo = 0;
  vibrate([12, 38, 12]);
  // ▼ DQ風：MISS!! のダメージ表記＋画面シェイク
  spawnDqDamage("MISS!", "wrong");
  shakeChallengeScreen();
  // ▼ 敵モンスターが攻撃モーション
  triggerEnemyAnim("attack");
  // ▼ 勇者はダメージモーション（画像はHP更新後のものに切替）
  setHeroImage("idle");
  triggerHeroAnim("hit");

  const text = showAnswer ? `せいかいは「${showAnswer}」` : "ざんねん…！";
  showChallengeFeedback({ type: "wrong", text });
  renderHeroStats();
  setTimeout(nextChallengeOrFinish, 1500);
}

function onChallengeTimeout() {
  if (!challengeState || challengeState.answered) return;
  const q = challengeState.questions[challengeState.index];
  onChallengeWrong(q ? q.a || "" : "");
}

function nextChallengeOrFinish() {
  if (!challengeState) return;
  if (challengeState.hp <= 0) {
    finishChallenge("over");
  } else if (challengeState.index + 1 >= challengeState.questions.length) {
    finishChallenge("clear");
  } else {
    challengeState.index += 1;
    showCurrentChallenge();
  }
}

function showChallengeFeedback({ type, text }) {
  const el = document.getElementById("chFeedback");
  el.textContent = text;
  el.className = "ch-feedback ch-feedback--" + type;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 1200);
}

/* ====== DQ風：浮き上がるダメージ／スコア表記 ====== */
function spawnDqDamage(text, type) {
  const panel = document.getElementById("chPanel");
  if (!panel) return;
  const el = document.createElement("div");
  el.className = "dq-damage dq-damage--" + type;
  el.textContent = text;
  // ランダムな横位置でちょっと散らす
  el.style.left = (38 + Math.random() * 24) + "%";
  panel.appendChild(el);
  setTimeout(() => { try { el.remove(); } catch(_) {} }, 1100);
}

/* ====== DQ風：コンボバナー ====== */
function showDqComboBanner(n) {
  const el = document.createElement("div");
  el.className = "dq-combo-banner";
  el.textContent = `⚡ ${n}れんぞくヒット！`;
  document.body.appendChild(el);
  setTimeout(() => { try { el.remove(); } catch(_) {} }, 1100);
}

/* ====== DQ風：画面シェイク ====== */
function shakeChallengeScreen() {
  const scr = document.getElementById("screen-challenge");
  if (!scr) return;
  scr.classList.add("dq-shake");
  setTimeout(() => scr.classList.remove("dq-shake"), 400);
}

/* ====== 敵モンスター（ゾーマ）の演出 ====== */
//   type: "hit"      → 被ダメージ（正解時）
//         "attack"   → 攻撃モーション（不正解時）
//         "defeated" → クリア時に倒れる
function triggerEnemyAnim(type) {
  const enemy = document.getElementById("chEnemy");
  if (!enemy) return;
  const cls = "ch-enemy--" + type;
  enemy.classList.remove("ch-enemy--hit", "ch-enemy--attack", "ch-enemy--defeated");
  // reflow を強制してアニメを再生させる
  void enemy.offsetWidth;
  enemy.classList.add(cls);
  const ms = type === "defeated" ? 1600 : 600;
  if (type === "defeated") {
    // 提案#9：撃破演出を強化（魂上昇＋砕け散る破片）
    spawnSoulRising(enemy);
    spawnDefeatShards(enemy);
  } else {
    setTimeout(() => enemy.classList.remove(cls), ms);
  }
}

function resetEnemyAnim() {
  const enemy = document.getElementById("chEnemy");
  if (!enemy) return;
  enemy.classList.remove("ch-enemy--hit", "ch-enemy--attack", "ch-enemy--defeated");
}

/* ====== 提案#9：撃破時の魂上昇エフェクト ====== */
function spawnSoulRising(enemyEl) {
  if (!enemyEl) return;
  // モンスター画像の中心あたりから魂が立ち上る（少し遅延させて白フラッシュの後に出す）
  setTimeout(() => {
    const sprite = enemyEl.querySelector(".ch-enemy__sprite");
    const soul = document.createElement("div");
    soul.className = "ch-soul";
    // sprite の中心 x、ちょい上から発生（enemy 要素を基準にした座標で left/top）
    const rect = sprite ? sprite.getBoundingClientRect() : null;
    const baseRect = enemyEl.getBoundingClientRect();
    if (rect && baseRect) {
      const cx = rect.left + rect.width / 2 - baseRect.left;
      const cy = rect.top + rect.height * 0.35 - baseRect.top;
      soul.style.left = cx + "px";
      soul.style.top = cy + "px";
    } else {
      soul.style.left = "50%";
      soul.style.top = "30%";
    }
    enemyEl.appendChild(soul);
    setTimeout(() => { if (soul.parentNode) soul.parentNode.removeChild(soul); }, 1800);
  }, 260);
}

/* ====== 提案#9：撃破時の破片パーティクル ====== */
function spawnDefeatShards(enemyEl) {
  if (!enemyEl) return;
  setTimeout(() => {
    const sprite = enemyEl.querySelector(".ch-enemy__sprite");
    const baseRect = enemyEl.getBoundingClientRect();
    const rect = sprite ? sprite.getBoundingClientRect() : null;
    let cx = "50%", cy = "50%";
    if (rect && baseRect) {
      cx = (rect.left + rect.width / 2 - baseRect.left) + "px";
      cy = (rect.top + rect.height / 2 - baseRect.top) + "px";
    }
    const N = 10;
    for (let i = 0; i < N; i++) {
      const shard = document.createElement("div");
      shard.className = "ch-shard" + (i % 2 === 0 ? " ch-shard--white" : "");
      shard.style.left = cx;
      shard.style.top = cy;
      // 放射状に飛ばす
      const angle = (Math.PI * 2 * i) / N + Math.random() * 0.4;
      const dist = 50 + Math.random() * 60;
      shard.style.setProperty("--shard-dx", `${Math.cos(angle) * dist}px`);
      shard.style.setProperty("--shard-dy", `${Math.sin(angle) * dist - 20}px`);
      enemyEl.appendChild(shard);
      setTimeout(() => { if (shard.parentNode) shard.parentNode.removeChild(shard); }, 1000);
    }
  }, 180);
}

/* ====== 提案#9：ボス（Dragon/Zoma）撃破時の画面全体フラッシュ ====== */
function spawnBossDefeatFlash() {
  const flash = document.createElement("div");
  flash.className = "ch-boss-flash";
  document.body.appendChild(flash);
  setTimeout(() => { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 1500);
}

/* ====== こたえる／にげるボタン ====== */
function updateSubmitButton() {
  const btn = document.getElementById("chSubmit");
  if (!btn || !challengeState) return;
  const q = challengeState.questions[challengeState.index];
  if (!q || challengeState.answered) { btn.disabled = true; return; }
  if (q.type === "4choice") {
    btn.disabled = challengeState.selectedChoice === null;
  } else if (q.type === "arrange") {
    btn.disabled = !q.placement.every(s => s !== null);
  } else {
    btn.disabled = true;
  }
}

function submitChallengeAnswer() {
  if (!challengeState || challengeState.answered) return;
  const q = challengeState.questions[challengeState.index];
  if (!q) return;
  if (q.type === "4choice") {
    if (challengeState.selectedChoice === null) return;
    // 視覚フィードバック：正解は緑、選択した誤答は赤
    document.querySelectorAll(".ch-choice").forEach(b => {
      b.disabled = true;
      b.classList.remove("ch-choice--selected");
      if (b.textContent === q.a) b.classList.add("ch-choice--correct");
      if (b.textContent === challengeState.selectedChoice && challengeState.selectedChoice !== q.a)
        b.classList.add("ch-choice--wrong");
    });
    if (challengeState.selectedChoice === q.a) onChallengeCorrect();
    else                                       onChallengeWrong(q.a);
  } else if (q.type === "arrange") {
    checkArrangeAnswerCh();
  }
}

function escapeChallenge() {
  if (!challengeState || challengeState.finished) return;
  vibrate(10);
  finishChallenge("escape");
}

/* 初期化（app.js から initApp 経由で呼ばれる） */
function initChallengeButtons() {
  const submit = document.getElementById("chSubmit");
  const escape = document.getElementById("chEscape");
  if (submit) submit.onclick = () => { submitChallengeAnswer(); };
  if (escape) escape.onclick = () => { escapeChallenge(); };
}

/* 現在の敵モンスターを画面に描画（画像・名前・HPバー） */
function renderEnemy(animateEntry) {
  if (!challengeState) return;
  const e = ENEMIES[challengeState.enemyIdx];
  if (!e) return;
  const sprite = document.getElementById("chEnemySprite");
  const name = document.querySelector(".ch-enemy__name");
  if (sprite) sprite.src = e.image;
  if (name) name.textContent = e.name;
  // ▼ 提案#2：バトルエリア背景を敵に応じて切替
  const battle = document.querySelector(".ch-battle");
  if (battle) {
    for (const en of ENEMIES) battle.classList.remove("ch-bg--" + en.key);
    battle.classList.add("ch-bg--" + e.key);
  }
  // Enemy entry animation: add a CSS class that drives the keyframe
  if (animateEntry) {
    const enemyEl = document.getElementById("chEnemy");
    if (enemyEl) {
      enemyEl.classList.remove("ch-enemy--entering");
      void enemyEl.offsetWidth; // force reflow so the animation replays
      enemyEl.classList.add("ch-enemy--entering");
      setTimeout(() => { if (enemyEl) enemyEl.classList.remove("ch-enemy--entering"); }, 600);
    }
  }
  // 敵HPバー
  const hpBar = document.getElementById("chEnemyHp");
  if (hpBar) {
    if (e.hits === Infinity) {
      // ゾーマは残り問題数で計る（クリア条件＝完走）
      const remaining = challengeState.questions.length - challengeState.index;
      const total = challengeState.questions.length;
      const pct = Math.max(0, Math.min(100, remaining * 100 / total));
      hpBar.innerHTML =
        `<span class="ch-enemy-hp__label">のこり</span>` +
        `<span class="ch-enemy-hp__bar"><span class="ch-enemy-hp__fill" style="width:${pct}%"></span></span>` +
        `<span class="ch-enemy-hp__text">${remaining}問</span>`;
    } else {
      const remHits = Math.max(0, e.hits - challengeState.enemyHits);
      const pct = (remHits / e.hits) * 100;
      hpBar.innerHTML =
        `<span class="ch-enemy-hp__label">HP</span>` +
        `<span class="ch-enemy-hp__bar"><span class="ch-enemy-hp__fill" style="width:${pct}%"></span></span>` +
        `<span class="ch-enemy-hp__text">${remHits}/${e.hits}</span>`;
    }
  }
}

/* 正解時にヒット累積。閾値に達したら次の敵へ */
function tickEnemyOnCorrect() {
  if (!challengeState) return;
  const e = ENEMIES[challengeState.enemyIdx];
  if (!e) return;
  if (e.hits === Infinity) {
    // ゾーマ：問題進行で残りHPバー更新（倒れるのは finishChallenge "clear" 時のみ）
    renderEnemy();
    return;
  }
  challengeState.enemyHits += 1;
  if (challengeState.enemyHits >= e.hits) {
    // この敵を倒した！ → defeated 演出を入れて次へ
    triggerEnemyAnim("defeated");
    // 提案#9：ボス（Dragon）を倒した瞬間は画面全体に金色のフラッシュ
    if (e.key === "dragon") spawnBossDefeatFlash();
    setTimeout(() => {
      if (!challengeState) return;
      challengeState.enemyIdx = Math.min(challengeState.enemyIdx + 1, ENEMIES.length - 1);
      challengeState.enemyHits = 0;
      resetEnemyAnim();
      renderEnemy(true);   // 次のモンスターは登場演出付きで
    }, 1100);
  } else {
    // まだ生きている → hit 演出と HPバー更新（登場演出なし）
    renderEnemy();
  }
}

/* ============================================================ */
/* ====== 形式①：4択 ====== */
/* ============================================================ */
function render4Choice(q) {
  const root = document.getElementById("chChoices");
  root.innerHTML = "";
  q.choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ch-choice";
    btn.textContent = choice;
    btn.addEventListener("click", () => {
      if (challengeState.answered) return;
      // 同じものを再タップ → 解除（押しミス訂正）
      if (challengeState.selectedChoice === choice) {
        challengeState.selectedChoice = null;
      } else {
        challengeState.selectedChoice = choice;
      }
      // 選択状態を反映
      document.querySelectorAll(".ch-choice").forEach(b => {
        b.classList.toggle("ch-choice--selected",
          b.textContent === challengeState.selectedChoice);
      });
      vibrate(4);
      updateSubmitButton();
    });
    root.appendChild(btn);
  });
}

/* ============================================================ */
/* ====== 形式②：並べ替え ====== */
/* ============================================================ */
function renderArrangeChallenge(q) {
  const slotsEl = document.getElementById("chSlots");
  slotsEl.innerHTML = "";
  slotsEl.classList.remove("ch-slots--correct", "ch-slots--wrong");
  q.placement.forEach((tileId, slotIdx) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "ch-slot" + (tileId !== null ? " ch-slot--filled" : "");
    if (tileId !== null) {
      const tile = q.tiles.find(t => t.id === tileId);
      slot.textContent = tile ? tile.char : "";
      slot.addEventListener("click", () => onArrangeSlotTapCh(slotIdx));
    } else {
      slot.textContent = "";
    }
    slot.disabled = challengeState.answered;
    slotsEl.appendChild(slot);
  });

  const tilesEl = document.getElementById("chTiles");
  tilesEl.innerHTML = "";
  for (const t of q.tiles) {
    const inSlot = q.placement.includes(t.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ch-tile" + (inSlot ? " ch-tile--used" : "");
    btn.textContent = t.char;
    btn.disabled = inSlot || challengeState.answered;
    btn.addEventListener("click", () => onArrangeTileTapCh(t.id));
    tilesEl.appendChild(btn);
  }
}

function onArrangeTileTapCh(tileId) {
  if (!challengeState || challengeState.answered) return;
  const q = challengeState.questions[challengeState.index];
  const slotIdx = q.placement.indexOf(tileId);
  if (slotIdx !== -1) {
    q.placement[slotIdx] = null;
    vibrate(4);
    renderArrangeChallenge(q);
    updateSubmitButton();
    return;
  }
  const emptyIdx = q.placement.indexOf(null);
  if (emptyIdx === -1) return;
  q.placement[emptyIdx] = tileId;
  vibrate(6);
  renderArrangeChallenge(q);
  updateSubmitButton();   // 全部埋まったらこたえるボタンが有効化
}

function onArrangeSlotTapCh(slotIdx) {
  if (!challengeState || challengeState.answered) return;
  const q = challengeState.questions[challengeState.index];
  if (q.placement[slotIdx] === null) return;
  q.placement[slotIdx] = null;
  vibrate(4);
  renderArrangeChallenge(q);
  updateSubmitButton();
}

function checkArrangeAnswerCh() {
  if (!challengeState || challengeState.answered) return;
  const q = challengeState.questions[challengeState.index];
  const userAnswer = q.placement
    .map(tid => (q.tiles.find(t => t.id === tid) || {}).char || "")
    .join("");
  const slotsEl = document.getElementById("chSlots");
  if (userAnswer === q.a) {
    slotsEl.classList.add("ch-slots--correct");
    onChallengeCorrect();
  } else {
    slotsEl.classList.add("ch-slots--wrong");
    onChallengeWrong(q.a);
  }
}

/* ============================================================ */
/* ====== 形式③：数字テンキー ====== */
/* ============================================================ */
function renderNumericChallenge(q) {
  // ディスプレイ：N桁分の枠
  const disp = document.getElementById("chNumericDisplay");
  disp.innerHTML = "";
  const chars = Array.from(q.input.padEnd(q.maxLen, " "));
  for (let i = 0; i < q.maxLen; i++) {
    const cell = document.createElement("span");
    cell.className = "ch-num-cell" + (q.input[i] ? " ch-num-cell--filled" : "");
    cell.textContent = q.input[i] || "";
    disp.appendChild(cell);
  }

  // テンキー配線（毎回上書き）
  const numpad = document.querySelector(".ch-numpad");
  numpad.querySelectorAll(".ch-numkey").forEach(btn => {
    btn.disabled = challengeState.answered;
    btn.onclick = () => onNumericKeyTap(btn.dataset.key);
  });
}

function onNumericKeyTap(key) {
  if (!challengeState || challengeState.answered) return;
  const q = challengeState.questions[challengeState.index];
  if (key === "backspace") {
    q.input = q.input.slice(0, -1);
    vibrate(4);
    renderNumericChallenge(q);
    return;
  }
  if (q.input.length >= q.maxLen) return;
  if (key === "dot" && (q.input.includes(".") || q.input.length === 0)) return;
  q.input += (key === "dot" ? "." : key);
  vibrate(6);
  renderNumericChallenge(q);
  if (q.input.length === q.maxLen) {
    if (q.input === q.a) onChallengeCorrect();
    else onChallengeWrong(q.a);
  }
}

/* ============================================================ */
/* ====== 形式④：マッチング（線結び） ====== */
/* ============================================================ */
function renderMatchingChallenge(q) {
  challengeState.matchingSelectedQ = null;
  const qsEl = document.getElementById("chMatchingQs");
  const asEl = document.getElementById("chMatchingAs");
  qsEl.innerHTML = "";
  asEl.innerHTML = "";

  // Q chips
  q.pairs.forEach((p, qIdx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ch-match-chip ch-match-chip--q";
    btn.textContent = p.q;
    btn.dataset.qIdx = qIdx;
    btn.addEventListener("click", () => onMatchingQTap(qIdx));
    qsEl.appendChild(btn);
  });
  // A chips（shuffledAs順）
  q.shuffledAs.forEach((aText, aIdx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ch-match-chip ch-match-chip--a";
    btn.textContent = aText;
    btn.dataset.aIdx = aIdx;
    btn.addEventListener("click", () => onMatchingATap(aIdx));
    asEl.appendChild(btn);
  });

  refreshMatchingDisplay();
}

function refreshMatchingDisplay() {
  const q = challengeState.questions[challengeState.index];
  // Q chips
  document.querySelectorAll(".ch-match-chip--q").forEach(btn => {
    const qIdx = parseInt(btn.dataset.qIdx, 10);
    const aIdx = q.userPairs[qIdx];
    btn.style.borderColor = "";
    btn.style.background = "";
    btn.classList.remove("ch-match-chip--selected", "ch-match-chip--paired");
    if (qIdx === challengeState.matchingSelectedQ) {
      btn.classList.add("ch-match-chip--selected");
    }
    if (aIdx !== null && aIdx !== undefined) {
      btn.classList.add("ch-match-chip--paired");
      btn.style.borderColor = MATCHING_COLORS[qIdx];
      btn.style.background = MATCHING_COLORS[qIdx] + "22";
    }
    btn.disabled = challengeState.answered;
  });
  // A chips
  document.querySelectorAll(".ch-match-chip--a").forEach(btn => {
    const aIdx = parseInt(btn.dataset.aIdx, 10);
    btn.style.borderColor = "";
    btn.style.background = "";
    btn.classList.remove("ch-match-chip--paired");
    // 自分とペアになっている Q を探す
    const pairedQ = q.userPairs.indexOf(aIdx);
    if (pairedQ !== -1) {
      btn.classList.add("ch-match-chip--paired");
      btn.style.borderColor = MATCHING_COLORS[pairedQ];
      btn.style.background = MATCHING_COLORS[pairedQ] + "22";
    }
    btn.disabled = challengeState.answered;
  });
}

function onMatchingQTap(qIdx) {
  if (!challengeState || challengeState.answered) return;
  const q = challengeState.questions[challengeState.index];
  // 既にペアになっているならクリア
  if (q.userPairs[qIdx] !== null && q.userPairs[qIdx] !== undefined) {
    q.userPairs[qIdx] = null;
    challengeState.matchingSelectedQ = qIdx;
  } else {
    challengeState.matchingSelectedQ = qIdx;
  }
  vibrate(6);
  refreshMatchingDisplay();
}

function onMatchingATap(aIdx) {
  if (!challengeState || challengeState.answered) return;
  const q = challengeState.questions[challengeState.index];
  // 選択中の Q が無ければ何もしない
  const qIdx = challengeState.matchingSelectedQ;
  if (qIdx === null) {
    // すでに他とペアの A をタップ → そのペアを解除
    const pairedQ = q.userPairs.indexOf(aIdx);
    if (pairedQ !== -1) {
      q.userPairs[pairedQ] = null;
      vibrate(6);
      refreshMatchingDisplay();
    }
    return;
  }
  // この A が既に他とペアなら、そのペアをクリア
  const conflictQ = q.userPairs.indexOf(aIdx);
  if (conflictQ !== -1) q.userPairs[conflictQ] = null;
  q.userPairs[qIdx] = aIdx;
  challengeState.matchingSelectedQ = null;
  vibrate(8);
  refreshMatchingDisplay();
  refreshMatchingDisplay();
  // 全ペア揃ったら判定
  if (q.userPairs.every(p => p !== null && p !== undefined)) {
    checkMatchingAnswer();
  }
}

function checkMatchingAnswer() {
  if (!challengeState || challengeState.answered) return;
  const q = challengeState.questions[challengeState.index];
  let correctPairs = 0;
  for (let qIdx = 0; qIdx < q.pairs.length; qIdx++) {
    const aIdx = q.userPairs[qIdx];
    if (q.shuffledAs[aIdx] === q.pairs[qIdx].a) correctPairs++;
  }
  if (correctPairs === q.pairs.length) {
    onChallengeCorrect(CHALLENGE_CONFIG.matchingScoreMultiplier);
  } else {
    const partial = correctPairs * (CHALLENGE_CONFIG.basePoints);
    challengeState.score += partial;
    renderHeroStats();
    onChallengeWrong(`正解 ${correctPairs}/${q.pairs.length}ペア`);
  }
}

/* ============================================================ */
/* ====== チャレンジ：終了 ====== */
/* ============================================================ */
function finishChallenge(reason) {
  if (!challengeState) return;
  stopChallengeTimer();
  challengeState.finished = true;
  if (reason === "clear") {
    triggerEnemyAnim("defeated");
    // 提案#9：ラスボス（Zoma）撃破時は画面全体に金色のフラッシュ
    spawnBossDefeatFlash();
    setTimeout(() => showScreen("challenge-result"), 1200);
  } else {
    showScreen("challenge-result");
  }

  const cleared = reason === "clear";
  const escaped = reason === "escape";
  document.getElementById("chResultTitle").textContent =
    cleared  ? "🎉 クリア！"
    : escaped ? "🏃 にげた…"
              : "💔 ゲームオーバー";
  document.getElementById("chResultScore").textContent = challengeState.score;
  document.getElementById("chResultRight").textContent = challengeState.correctCount;
  document.getElementById("chResultTotal").textContent = challengeState.questions.length;
  document.getElementById("chResultMaxCombo").textContent = challengeState.maxCombo;
  document.getElementById("chResultHp").innerHTML = renderChallengeHp(Math.max(0, challengeState.hp));

  let msg;
  if (cleared && challengeState.hp === CHALLENGE_CONFIG.startHp) msg = "🏆 ノーミス完璧！";
  else if (cleared)                                              msg = "✨ 最後まで生き残った！";
  else if (escaped)                                              msg = "また挑戦してね！";
  else if (challengeState.correctCount >= 10)                    msg = "👍 ナイスファイト！";
  else                                                           msg = "📖 復習してリベンジ！";

  const rec = recordChallengeScore({
    bundleKeysSet: challengeSelectedBundles,
    score: challengeState.score,
    correctCount: challengeState.correctCount,
    totalQuestions: challengeState.questions.length,
    maxCombo: challengeState.maxCombo,
    hp: Math.max(0, challengeState.hp)
  });
  if (rec.isPersonalBest) msg = "🥇 自己ベスト更新！　" + msg;
  else if (rec.rank > 0)  msg = `#${rec.rank} 位　` + msg;
  document.getElementById("chResultMessage").textContent = msg;
}

/* ====== 結果画面のボタン ====== */
function initResultButtons() {
  document.getElementById("chResultRetry").onclick = () => {
    vibrate(10);
    startChallengeSession();
  };
  document.getElementById("chResultChangeRange").onclick = () => {
    vibrate(8);
    enterChallengeSelect();
  };
  document.getElementById("chResultHome").onclick = () => {
    vibrate(6);
    showScreen("home");
  };
}

/* ====== 勇者ステータス表示（HP/CB/EXP） ====== */
function renderHeroStats() {
  if (!challengeState) return;
  if (!challengeState) return;
  const hpEl = document.getElementById("chHp");
  const cbEl = document.getElementById("chCB");
  const expEl = document.getElementById("chExp");
  if (hpEl) hpEl.innerHTML = renderChallengeHp(challengeState.hp);
  if (cbEl) cbEl.innerHTML =
    `<span class="ch-hero__icon ch-hero__icon--cb">⚡</span>` +
    `<span class="ch-hero__lbl">CB</span>` +
    `<span class="ch-hero__val">${challengeState.combo}</span>`;
  if (expEl) expEl.innerHTML =
    `<span class="ch-hero__icon ch-hero__icon--exp">◆</span>` +
    `<span class="ch-hero__lbl">EXP</span>` +
    `<span class="ch-hero__val">${challengeState.score}</span>`;
}

/* ====== 勇者画像の選定 ======
   idle  : HPで切替 (HP≥30→HP5, HP=20→HP2, HP≤10→HP1)
   attack: CBで切替 (CB<5→CB0, 5≤CB≤9→CB5, CB≥10→CB10)
   hit   : 被ダメージ表現のため idle と同じく HP 画像を使う */
function heroImageFor(state) {
  if (!challengeState) return "images/Brave_HP5.png";
  if (state === "attack") {
    const cb = challengeState.combo || 0;
    if (cb >= 10)     return "images/Brave_CB10.png";
    else if (cb >= 5) return "images/Brave_CB5.png";
    else              return "images/Brave_CB0.png";
  }
  // idle / hit は HP に応じて
  const hp = Math.max(0, challengeState.hp);
  if (hp >= 30)      return "images/Brave_HP5.png";
  else if (hp >= 20) return "images/Brave_HP2.png";
  else               return "images/Brave_HP1.png";
}

function setHeroImage(state) {
  const sprite = document.getElementById("chHeroSprite");
  if (sprite) sprite.src = heroImageFor(state);
}

/* ====== 勇者ポートレイトのモーション ======
   type: "attack" → 正解時の攻撃モーション
         "hit"    → 不正解時の被ダメージモーション */
function triggerHeroAnim(type) {
  const portrait = document.getElementById("chHeroPortrait");
  if (!portrait) return;
  const cls = "ch-hero__portrait--" + type;
  portrait.classList.remove("ch-hero__portrait--attack", "ch-hero__portrait--hit");
  // reflow でアニメ再生
  void portrait.offsetWidth;
  portrait.classList.add(cls);
  setTimeout(() => portrait.classList.remove(cls), 600);
}

/* ====== スラッシュエフェクト：正解時に敵を横切る斜めの一閃 ====== */
function spawnSlashEffect() {
  const enemy = document.getElementById("chEnemy");
  if (!enemy) return;
  const slash = document.createElement("div");
  slash.className = "ch-slash";
  enemy.appendChild(slash);
  setTimeout(() => { if (slash.parentNode) slash.parentNode.removeChild(slash); }, 500);
}

/* ====== Question text typewriter reveal ======
   Multibyte-safe via Array.from. Reveals one char at a time.
   Safety net: textContent is set to the full string first, so even if the
   animation hiccups, the full text is always visible. */
function typewriterReveal(el, text, speedMs) {
  if (!el) return;
  if (typeof speedMs !== "number") speedMs = 24;
  var full = (text === null || text === undefined) ? "" : String(text);
  if (el._typewriterTimer) {
    clearTimeout(el._typewriterTimer);
    el._typewriterTimer = null;
  }
  // Safety net: full text first
  el.textContent = full;
  var chars = Array.from(full);
  if (chars.length === 0) {
    el.classList.remove("ch-typewriting");
    return;
  }
  el.classList.add("ch-typewriting");
  el.textContent = chars[0];
  var i = 1;
  var step = function () {
    if (!el.isConnected) { el._typewriterTimer = null; return; }
    if (i >= chars.length) {
      el._typewriterTimer = null;
      el.classList.remove("ch-typewriting");
      el.textContent = full;
      return;
    }
    i += 1;
    el.textContent = chars.slice(0, i).join("");
    el._typewriterTimer = setTimeout(step, speedMs);
  };
  el._typewriterTimer = setTimeout(step, speedMs);
}
