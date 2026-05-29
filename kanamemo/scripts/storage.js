// scripts/storage.js
// =================================================================
// 永続ストレージ層（localStorage）
//   - appState: アプリ全体の保存状態
//   - フラッシュカード正答数、チャレンジランキング、ストリーク
// =================================================================

/* ====== 永続ストレージ（localStorage）====== */
const STORAGE_KEY = "kanamemo_v1";
const MAX_RANKING = 10;

function getDefaultAppState() {
  return {
    flashcard: { units: {} },             // { unitKey: { right, wrong, lastUpdate } }
    challenge: { rankings: {} },          // { bundleKey(s): [ {score,correctCount,...} ] }
    meta: {
      streakDays: 0,
      lastStudyDate: null                 // "YYYY-MM-DD"
    }
  };
}

let appState = getDefaultAppState();

function loadAppState() {
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    appState = Object.assign(getDefaultAppState(), parsed);
    appState.flashcard = Object.assign({ units: {} }, parsed.flashcard || {});
    appState.challenge = Object.assign({ rankings: {} }, parsed.challenge || {});
    appState.meta = Object.assign({ streakDays: 0, lastStudyDate: null }, parsed.meta || {});
  } catch (e) {
    console.warn("[storage] load failed:", e);
    appState = getDefaultAppState();
  }
}

/* ストリーク（連続学習日数）の更新。日付が変わった瞬間に呼ばれた場合のみカウント */
function touchStudyDate() {
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (!appState.meta) appState.meta = { streakDays: 0, lastStudyDate: null };
  if (appState.meta.lastStudyDate === ymd) return;
  if (appState.meta.lastStudyDate) {
    const last = appState.meta.lastStudyDate.split("-").map(Number);
    const lastDate = new Date(last[0], last[1] - 1, last[2]);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.round((todayDate - lastDate) / (24 * 60 * 60 * 1000));
    if (diffDays === 1)      appState.meta.streakDays = (appState.meta.streakDays || 0) + 1;
    else if (diffDays > 1)   appState.meta.streakDays = 1;
  } else {
    appState.meta.streakDays = 1;
  }
  appState.meta.lastStudyDate = ymd;
}

function saveAppState() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.warn("[storage] save failed:", e);
  }
}

function resetAppState() {
  appState = getDefaultAppState();
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

function recordFlashcardCorrect(unitKey) {
  if (!unitKey) return;
  const u = appState.flashcard.units[unitKey] || (appState.flashcard.units[unitKey] = { right: 0, wrong: 0 });
  u.right = (u.right || 0) + 1;
  u.lastUpdate = new Date().toISOString();
  touchStudyDate();
  saveAppState();
}

function recordFlashcardWrong(unitKey) {
  if (!unitKey) return;
  const u = appState.flashcard.units[unitKey] || (appState.flashcard.units[unitKey] = { right: 0, wrong: 0 });
  u.wrong = (u.wrong || 0) + 1;
  u.lastUpdate = new Date().toISOString();
  touchStudyDate();
  saveAppState();
}

/* バンドルキーを並べてユニークなキーに */
function rankingKey(bundleKeysSet) {
  return Array.from(bundleKeysSet).sort().join("+");
}

/* スコア記録、新エントリーの順位（1始まり、トップ10圏外なら 0）と更新後リストを返す */
function recordChallengeScore({ bundleKeysSet, score, correctCount, totalQuestions, maxCombo, hp }) {
  const key = rankingKey(bundleKeysSet);
  const list = appState.challenge.rankings[key] || (appState.challenge.rankings[key] = []);
  const entry = {
    score, correctCount, totalQuestions, maxCombo, hp,
    timestamp: new Date().toISOString()
  };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const rank = list.indexOf(entry) + 1;
  if (list.length > MAX_RANKING) {
    appState.challenge.rankings[key] = list.slice(0, MAX_RANKING);
  }
  touchStudyDate();
  saveAppState();
  const inTop = rank > 0 && rank <= MAX_RANKING;
  return { rank: inTop ? rank : 0, list: appState.challenge.rankings[key], isPersonalBest: rank === 1 };
}

function getChallengeRanking(bundleKeysSet) {
  const key = rankingKey(bundleKeysSet);
  return appState.challenge.rankings[key] || [];
}
