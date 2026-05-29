// scripts/srs.js

// ▼ スコア初期化
function initScores(cards) {
  for (const c of cards) c.score = 0;
}

// ▼ 重み付きランダム（SRS）
function pickCard(cards) {
  let weighted = [];
  for (const c of cards) {
    const weight = c.score + 1;
    for (let i = 0; i < weight; i++) weighted.push(c);
  }
  return weighted[Math.floor(Math.random() * weighted.length)];
}