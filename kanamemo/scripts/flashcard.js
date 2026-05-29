// scripts/flashcard.js
// =================================================================
// フラッシュカード本編：単元選択・カード表示・ジェスチャー
// =================================================================

// フラッシュカード用 状態
let currentCards = [];
let current = null;
let right = 0;
let wrong = 0;
const selectedModes = new Set();
let prevSnapshot = null;

// ジェスチャー
let drag = null;
let isCardLocked = false;

const SWIPE_THRESHOLD_PX = 110;
const SWIPE_THRESHOLD_RATIO = 0.28;
const TAP_MAX_MOVE = 10;
const TAP_MAX_TIME = 280;
const LONG_PRESS_MS = 600;

/* ====== フラッシュカード：単元選択 ====== */
function enterFcSelect() {
  showScreen("fc-select");
  buildGroupedChips("fcChips", selectedModes, () => {
    document.getElementById("fcStart").disabled = selectedModes.size === 0;
  });
  document.getElementById("fcStart").disabled = selectedModes.size === 0;
  document.getElementById("fcStart").onclick = () => {
    if (selectedModes.size === 0) return;
    vibrate(10);
    startFlashcard();
  };
}

/* ====== フラッシュカード：本編開始 ====== */
function startFlashcard() {
  showScreen("flashcard");
  currentCards = collectCards(selectedModes);
  right = 0; wrong = 0;
  updateStats(right, wrong);
  prevSnapshot = null;
  refreshBackBtnState();
  if (currentCards.length === 0) {
    current = null;
  } else {
    initScores(currentCards);
    current = pickCard(currentCards);
  }
  showCard(current);
}


/* ====== フラッシュカード本編のロジック ====== */

function flashCorrect() {
  const card = document.querySelector("#screen-flashcard .flip-card");
  if (!card) return;
  card.classList.add("correct-flash");
  setTimeout(() => card.classList.remove("correct-flash"), 600);
}

function shakeWrong() {
  const card = document.querySelector("#screen-flashcard .flip-card");
  if (!card) return;
  card.classList.add("wrong-shake");
  setTimeout(() => card.classList.remove("wrong-shake"), 450);
}

function setSide(textId, imgId, text, imgSrc) {
  document.getElementById(textId).textContent = text || "";
  const img = document.getElementById(imgId);
  if (imgSrc) {
    img.src = imgSrc;
    img.alt = text || "";
    img.hidden = false;
  } else {
    img.removeAttribute("src");
    img.alt = "";
    img.hidden = true;
  }
}

function isAnswerShowing() {
  const cardEl = document.getElementById("card");
  return !!cardEl && cardEl.classList.contains("show-answer");
}

function showCard(card) {
  const cardEl = document.getElementById("card");
  const badge = document.getElementById("genreBadge");
  if (!cardEl) return;

  cardEl.classList.remove("show-answer");
  cardEl.classList.remove("swipe-out-right", "swipe-out-left", "long-pressing");
  cardEl.style.transform = "";
  cardEl.style.opacity = "";

  updateGestureHint();

  if (!card) {
    badge.textContent = "単元を選択してください";
    setTimeout(() => {
      setSide("q", "qImg", "単元を選んでください", null);
      setSide("a", "aImg", "", null);
    }, 150);
    return;
  }

  const unit = window.CARDS[card.mode];
  badge.textContent = (unit && unit.title) || "ジャンル不明";

  // fact 形式なら表示のたびに空欄をランダム選択
  let qText = card.q;
  let aText = card.a;
  if (card.fact) {
    const mat = materializeCloze(card.fact);
    qText = mat.q;
    aText = mat.a;
  }

  setTimeout(() => {
    setSide("q", "qImg", qText, card.qImg);
    setSide("a", "aImg", aText, card.aImg);
    cardEl.classList.remove("swipe-in");
    void cardEl.offsetWidth;
    cardEl.classList.add("swipe-in");
    setTimeout(() => cardEl.classList.remove("swipe-in"), 320);
  }, 150);
}

function snapshotBeforeAdvance() {
  if (!current) return;
  prevSnapshot = {
    card: current,
    score: current.score,
    right: right,
    wrong: wrong
  };
  refreshBackBtnState();
}

function goBack() {
  if (!prevSnapshot) return;
  const snap = prevSnapshot;
  snap.card.score = snap.score;
  right = snap.right;
  wrong = snap.wrong;
  current = snap.card;
  prevSnapshot = null;
  updateStats(right, wrong);
  showCard(current);
  refreshBackBtnState();
  vibrate(8);
}

function refreshBackBtnState() {
  const btn = document.getElementById("back");
  if (!btn) return;
  btn.disabled = !prevSnapshot;
}

function handleCorrect({ animate = "flash", direction = "right" } = {}) {
  if (!current || isCardLocked) return;
  snapshotBeforeAdvance();
  current.score = Math.max(0, current.score - 1);
  right++;
  updateStats(right, wrong);
  recordFlashcardCorrect(current.mode);
  vibrate(20);
  if (animate === "swipe") {
    swipeOutThenNext(direction);
  } else {
    flashCorrect();
    setTimeout(() => {
      current = pickCard(currentCards);
      showCard(current);
    }, 320);
  }
}

function handleWrong({ animate = "shake" } = {}) {
  if (!current || isCardLocked) return;
  snapshotBeforeAdvance();
  current.score += 2;
  wrong++;
  updateStats(right, wrong);
  recordFlashcardWrong(current.mode);
  vibrate([12, 38, 12]);
  shakeWrong();
  setTimeout(() => {
    current = pickCard(currentCards);
    showCard(current);
  }, 380);
}

function handleNext() {
  if (currentCards.length === 0 || isCardLocked) return;
  snapshotBeforeAdvance();
  current = pickCard(currentCards);
  showCard(current);
}

function swipeOutThenNext(direction) {
  const cardEl = document.getElementById("card");
  isCardLocked = true;
  cardEl.classList.add(direction === "right" ? "swipe-out-right" : "swipe-out-left");
  cardEl.classList.add("is-animating");
  setTimeout(() => {
    cardEl.classList.remove("swipe-out-right", "swipe-out-left", "is-animating");
    cardEl.style.transform = "";
    cardEl.style.opacity = "";
    isCardLocked = false;
    current = pickCard(currentCards);
    showCard(current);
  }, 330);
}

function toggleFlip() {
  if (!current || isCardLocked) return;
  const cardEl = document.getElementById("card");
  cardEl.classList.toggle("show-answer");
  updateGestureHint();
  vibrate(6);
}

function updateGestureHint() {
  const el = document.getElementById("gestureHint");
  if (!el) return;
  if (isAnswerShowing()) {
    el.textContent = "← → 横スワイプで正解　・　長押しで不正解";
  } else {
    el.textContent = "カードをタップして答えを表示";
  }
}

function attachCardGestures() {
  const cardEl = document.getElementById("card");
  if (!cardEl) return;
  cardEl.addEventListener("pointerdown", onPointerDown);
  cardEl.addEventListener("pointermove", onPointerMove);
  cardEl.addEventListener("pointerup", onPointerUp);
  cardEl.addEventListener("pointercancel", onPointerCancel);
  cardEl.addEventListener("contextmenu", e => e.preventDefault());
}

function startLongPressTimer() {
  if (!drag) return;
  const cardEl = document.getElementById("card");
  cardEl.classList.add("long-pressing");
  drag.longPressTimer = setTimeout(() => {
    if (!drag || drag.isSwipe || drag.wasMoved) return;
    const pid = drag.pointerId;
    drag = null;
    cardEl.classList.remove("long-pressing", "is-dragging");
    try { cardEl.releasePointerCapture(pid); } catch (_) {}
    handleWrong({ animate: "shake" });
  }, LONG_PRESS_MS);
}

function cancelLongPress() {
  if (drag && drag.longPressTimer) {
    clearTimeout(drag.longPressTimer);
    drag.longPressTimer = null;
  }
  const cardEl = document.getElementById("card");
  if (cardEl) cardEl.classList.remove("long-pressing");
}

function onPointerDown(e) {
  if (currentScreen !== "flashcard") return;
  if (isCardLocked || !current) return;
  if (e.button !== undefined && e.button !== 0) return;

  drag = {
    startX: e.clientX, startY: e.clientY, startTime: Date.now(),
    pointerId: e.pointerId, dx: 0,
    isSwipe: false, wasMoved: false,
    answerWasShowing: isAnswerShowing(),
    longPressTimer: null
  };

  const cardEl = document.getElementById("card");
  try { cardEl.setPointerCapture(e.pointerId); } catch (_) {}
  cardEl.classList.add("is-dragging");

  if (drag.answerWasShowing) startLongPressTimer();
}

function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;

  if (!drag.wasMoved && (Math.abs(dx) > TAP_MAX_MOVE || Math.abs(dy) > TAP_MAX_MOVE)) {
    drag.wasMoved = true;
    cancelLongPress();
  }

  if (!drag.answerWasShowing) return;

  if (!drag.isSwipe) {
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) drag.isSwipe = true;
    else return;
  }

  drag.dx = dx;
  const cardEl = document.getElementById("card");
  const rotation = Math.max(-15, Math.min(15, dx * 0.04));
  cardEl.style.transform = `translateX(${dx}px) rotate(${rotation}deg)`;
  updateSwipeHint(dx);
  e.preventDefault();
}

function onPointerUp(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  cancelLongPress();

  const cardEl = document.getElementById("card");
  cardEl.classList.remove("is-dragging");

  const dx = drag.dx;
  const dy = e.clientY - drag.startY;
  const duration = Date.now() - drag.startTime;

  const wasTap = !drag.isSwipe
    && Math.abs(dx) < TAP_MAX_MOVE
    && Math.abs(dy) < TAP_MAX_MOVE
    && duration < TAP_MAX_TIME;

  resetSwipeHint();

  if (wasTap) {
    drag = null;
    toggleFlip();
    return;
  }

  if (!drag.answerWasShowing) {
    drag = null;
    return;
  }

  const threshold = Math.min(SWIPE_THRESHOLD_PX, cardEl.offsetWidth * SWIPE_THRESHOLD_RATIO);
  if (Math.abs(dx) > threshold) {
    const direction = dx > 0 ? "right" : "left";
    drag = null;
    handleCorrect({ animate: "swipe", direction });
  } else {
    cardEl.style.transition = "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)";
    cardEl.style.transform = "";
    setTimeout(() => { cardEl.style.transition = ""; }, 240);
    drag = null;
  }
}

function onPointerCancel(e) {
  if (!drag) return;
  cancelLongPress();
  const cardEl = document.getElementById("card");
  cardEl.classList.remove("is-dragging");
  cardEl.style.transition = "transform 0.22s ease";
  cardEl.style.transform = "";
  setTimeout(() => { cardEl.style.transition = ""; }, 240);
  resetSwipeHint();
  drag = null;
}

function updateSwipeHint(dx) {
  const rH = document.querySelector(".swipe-hint--right");
  const lH = document.querySelector(".swipe-hint--left");
  if (!rH || !lH) return;
  const intensity = Math.min(1, (Math.abs(dx) - 50) / 100);
  if (dx > 50) {
    rH.style.opacity = String(Math.max(0, intensity));
    rH.style.transform = `scale(${0.85 + intensity * 0.18})`;
    lH.style.opacity = "0";
  } else if (dx < -50) {
    lH.style.opacity = String(Math.max(0, intensity));
    lH.style.transform = `scale(${0.85 + intensity * 0.18})`;
    rH.style.opacity = "0";
  } else {
    rH.style.opacity = "0";
    lH.style.opacity = "0";
  }
}

function resetSwipeHint() {
  const rH = document.querySelector(".swipe-hint--right");
  const lH = document.querySelector(".swipe-hint--left");
  if (rH) { rH.style.opacity = "0"; rH.style.transform = ""; }
  if (lH) { lH.style.opacity = "0"; lH.style.transform = ""; }
}

function bindFlashcardButtons() {
  document.getElementById("show").onclick = () => { toggleFlip(); };
  document.getElementById("next").onclick = () => handleNext();
  document.getElementById("correct").onclick = () => handleCorrect({ animate: "swipe", direction: "right" });
  document.getElementById("wrong").onclick = () => handleWrong({ animate: "shake" });
  document.getElementById("back").onclick = () => goBack();
}

