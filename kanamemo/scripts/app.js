// scripts/app.js
// =================================================================
// アプリ起動エントリーポイント
//   - 各モジュールは個別のスクリプトファイルに分割されています
//     (helpers / storage / screens / flashcard / challenge)
//   - 読み込み順は index.html で管理
// =================================================================

function initApp() {
  loadAppState();
  initHome();
  bindFlashcardButtons();
  attachCardGestures();
  initResultButtons();
  initChallengeButtons();
  initHistoryScreen();
  updateStats(0, 0);
  refreshBackBtnState();
  updateGestureHint();
  showScreen("home");

  window.addEventListener("resize", () => {
    if (currentScreen === "challenge") updateChallengePanelRing();
  });
}

window.initApp = initApp;
