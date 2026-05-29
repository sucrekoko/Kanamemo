// scripts/screens.js
// =================================================================
// 画面ルーティング・チップUI・ホーム・履歴
// =================================================================

let currentScreen = "home";

/* ====== 画面ルーティング ====== */
const SCREEN_IDS = {
  "home":               "screen-home",
  "fc-select":          "screen-fc-select",
  "flashcard":          "screen-flashcard",
  "challenge-select":   "screen-challenge-select",
  "challenge":          "screen-challenge",
  "challenge-result":   "screen-challenge-result",
  "history":            "screen-history"
};

const SCREEN_TITLES = {
  "fc-select":          "単元選択",
  "flashcard":          "フラッシュカード",
  "challenge-select":   "チャレンジ範囲選択",
  "challenge":          "チャレンジ",
  "challenge-result":   "結果",
  "history":            "学習履歴"
};

function showScreen(name) {
  currentScreen = name;
  for (const id of Object.values(SCREEN_IDS)) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }
  const target = document.getElementById(SCREEN_IDS[name]);
  if (target) target.hidden = false;

  const topbar = document.getElementById("topbar");
  const actionBar = document.getElementById("actionBar");
  const tbTitle = document.getElementById("topbarTitle");

  if (name === "home") {
    topbar.hidden = true;
    actionBar.hidden = true;
    tbTitle.textContent = "";
    renderHomeStats();
  } else {
    topbar.hidden = false;
    tbTitle.textContent = SCREEN_TITLES[name] || "";
    actionBar.hidden = (name !== "flashcard");
  }

  // チャレンジ画面を離れる時はタイマー停止
  if (name !== "challenge" && challengeState && challengeState.timer) {
    clearInterval(challengeState.timer);
    challengeState.timer = null;
  }

  window.scrollTo(0, 0);
}

/* ====== カード収集（フラッシュカード用） ====== */
function collectCards(modesSet) {
  let result = [];
  for (const mode of modesSet) {
    const unit = window.CARDS[mode];
    if (!unit || unit.active === false) continue;
    const items = (unit.items || [])
      .filter(c => c && c.active !== false)
      .map(c => ({ ...c, mode }));
    result = result.concat(items);
  }
  return result;
}

/* ====== チップUI（教科ごとにグルーピング） ====== */
function buildGroupedChips(containerId, selectedSet, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const order = Array.isArray(window.CARDS_MANIFEST)
    ? window.CARDS_MANIFEST
    : Object.keys(window.CARDS || {});

  const groups = new Map();
  for (const key of order) {
    const unit = window.CARDS[key];
    if (!unit || unit.active === false) continue;
    const subject = unit.subject || "その他";
    if (!groups.has(subject)) groups.set(subject, []);
    groups.get(subject).push({ key, unit });
  }

  if (groups.size === 0) {
    container.innerHTML = '<div class="no-units">利用可能な単元がありません</div>';
    return;
  }

  for (const [subject, items] of groups) {
    const heading = document.createElement("div");
    heading.className = "chip-group-title";
    heading.textContent = subject;
    container.appendChild(heading);

    const group = document.createElement("div");
    group.className = "chip-group";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "chip chip-all";
    allBtn.textContent = `${subject} 全て (${items.length})`;
    allBtn.addEventListener("click", () => {
      const allSelected = items.every(({ key }) => selectedSet.has(key));
      if (allSelected) items.forEach(({ key }) => selectedSet.delete(key));
      else            items.forEach(({ key }) => selectedSet.add(key));
      vibrate(8);
      refreshChipStates(containerId, selectedSet);
      onChange();
    });
    group.appendChild(allBtn);

    for (const { key, unit } of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.mode = key;
      btn.textContent = unit.title || key;
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => {
        if (selectedSet.has(key)) selectedSet.delete(key);
        else selectedSet.add(key);
        vibrate(8);
        refreshChipStates(containerId, selectedSet);
        onChange();
      });
      group.appendChild(btn);
    }

    container.appendChild(group);
  }

  refreshChipStates(containerId, selectedSet);
}

function refreshChipStates(containerId, selectedSet) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll(".chip").forEach(btn => {
    if (btn.classList.contains("chip-all")) return;
    const on = selectedSet.has(btn.dataset.mode);
    btn.classList.toggle("chip--on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  container.querySelectorAll(".chip-group").forEach(group => {
    const allBtn = group.querySelector(".chip-all");
    const regularChips = Array.from(group.querySelectorAll(".chip:not(.chip-all)"));
    if (!allBtn || regularChips.length === 0) return;
    const allOn = regularChips.every(b => b.classList.contains("chip--on"));
    allBtn.classList.toggle("chip--on", allOn);
  });
}

/* ====== ホーム ====== */
function initHome() {
  document.getElementById("modeFlashcard").onclick = () => {
    vibrate(10);
    enterFcSelect();
  };
  document.getElementById("modeChallenge").onclick = () => {
    vibrate(10);
    enterChallengeSelect();
  };
  document.getElementById("homeBtn").onclick = () => {
    vibrate(6);
    showScreen("home");
  };
  const histLink = document.getElementById("historyLink");
  if (histLink) histLink.onclick = () => {
    vibrate(8);
    enterHistoryScreen();
  };
}

/* ====== ホーム画面の統計表示 ====== */
function renderHomeStats() {
  const stats = document.getElementById("homeStats");
  if (!stats) return;
  // ストリーク
  const streak = (appState.meta && appState.meta.streakDays) || 0;
  // 累計問題（フラッシュカード正解＋不正解の総和）
  let total = 0;
  for (const u of Object.values(appState.flashcard.units || {})) {
    total += (u.right || 0) + (u.wrong || 0);
  }
  // ベストスコア（全ランキングの最高）
  let best = 0;
  for (const list of Object.values(appState.challenge.rankings || {})) {
    for (const r of list) if (r.score > best) best = r.score;
  }
  document.getElementById("homeStatStreak").textContent = streak;
  document.getElementById("homeStatTotal").textContent  = total;
  document.getElementById("homeStatBest").textContent   = best;
  // データが1つでもあれば表示
  stats.hidden = (streak === 0 && total === 0 && best === 0);
}

/* ====== 学習履歴画面 ====== */
function initHistoryScreen() {
  const reset = document.getElementById("historyReset");
  if (!reset) return;
  reset.onclick = () => {
    const ok = (typeof confirm !== "undefined") ?
      confirm("すべての学習履歴とランキングを消去します。よろしいですか？") : false;
    if (!ok) return;
    resetAppState();
    vibrate([20, 60, 20]);
    renderHistoryScreen();
  };
}

function enterHistoryScreen() {
  showScreen("history");
  renderHistoryScreen();
}

function renderHistoryScreen() {
  // フラッシュカード単元別の累計
  const fcEl = document.getElementById("historyFcList");
  if (fcEl) {
    fcEl.innerHTML = "";
    const order = Array.isArray(window.CARDS_MANIFEST) ? window.CARDS_MANIFEST : [];
    let anyData = false;
    for (const key of order) {
      const unit = (window.CARDS || {})[key];
      if (!unit) continue;
      const u = (appState.flashcard.units[key]) || { right: 0, wrong: 0 };
      const total = (u.right || 0) + (u.wrong || 0);
      const pct = total > 0 ? Math.round((u.right || 0) * 100 / total) : null;
      if (total > 0) anyData = true;
      const row = document.createElement("div");
      row.className = "history-row";
      row.innerHTML =
        `<div class="history-row__title">${unit.title || key}</div>` +
        `<div class="history-row__stat">` +
          `<span class="hr-right">正解 ${u.right || 0}</span>` +
          `<span class="hr-wrong">不正解 ${u.wrong || 0}</span>` +
          `<span class="hr-rate">${pct === null ? "—" : "正答率 " + pct + "%"}</span>` +
        `</div>`;
      fcEl.appendChild(row);
    }
    if (!anyData) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "まだフラッシュカードの記録はありません。";
      fcEl.appendChild(empty);
    }
  }

  // チャレンジ ランキング
  const chEl = document.getElementById("historyChList");
  if (chEl) {
    chEl.innerHTML = "";
    const bundles = window.CHALLENGE_BUNDLES || [];
    const titleByKey = {};
    for (const b of bundles) titleByKey[b.key] = b.title;
    const rankings = appState.challenge.rankings || {};
    const keys = Object.keys(rankings).filter(k => (rankings[k] || []).length > 0);
    if (keys.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "まだチャレンジの記録はありません。";
      chEl.appendChild(empty);
    } else {
      for (const k of keys) {
        const list = rankings[k] || [];
        const bundleKeyArr = k.split("+");
        const bundleTitles = bundleKeyArr.map(x => titleByKey[x] || x).join("　＋　");
        const block = document.createElement("div");
        block.className = "ranking-block";
        const heading = document.createElement("div");
        heading.className = "ranking-block__heading";
        heading.textContent = bundleTitles;
        block.appendChild(heading);
        list.slice(0, 10).forEach((r, i) => {
          const item = document.createElement("div");
          item.className = "ranking-item" + (i === 0 ? " ranking-item--top" : "");
          const dt = new Date(r.timestamp);
          const dateStr = `${dt.getMonth() + 1}/${dt.getDate()}`;
          item.innerHTML =
            `<span class="ri-rank">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1)}</span>` +
            `<span class="ri-score">${r.score}<small>点</small></span>` +
            `<span class="ri-detail">正解${r.correctCount}/${r.totalQuestions}　最高コンボ×${r.maxCombo}</span>` +
            `<span class="ri-date">${dateStr}</span>`;
          block.appendChild(item);
        });
        chEl.appendChild(block);
      }
    }
  }

}
