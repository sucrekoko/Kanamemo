// scripts/ui.js
// =================================================================
// 汎用UIヘルパー。app.js から呼ばれます。
// （以前ここにあった showCard は app.js 側に統合されました）
// =================================================================

function updateStats(right, wrong) {
  const total = right + wrong;
  const rate = total === 0 ? 0 : Math.round((right / total) * 100);
  document.getElementById("right").textContent = right;
  document.getElementById("wrongCount").textContent = wrong;
  document.getElementById("rate").textContent = rate + "%";
}
