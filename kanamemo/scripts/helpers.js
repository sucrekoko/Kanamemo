// scripts/helpers.js
// =================================================================
// 共通ユーティリティ
//   - すべてのモード（フラッシュカード／チャレンジ）から使用される
// =================================================================

/* ====== ヘルパー：振動 ====== */
function vibrate(pattern) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (_) {}
  }
}

/* ====== ヘルパー：シャッフル ====== */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ====== cloze 展開（fact 形式のカードを表示用に変換） ====== */
function materializeCloze(fact, withSiblings) {
  const re = /\[([^\]]+)\]/g;
  const matches = [];
  let m;
  while ((m = re.exec(fact)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, term: m[1] });
  }
  if (matches.length === 0) {
    return withSiblings ? { q: fact, a: fact, siblings: [] } : { q: fact, a: fact };
  }
  const picked = matches[Math.floor(Math.random() * matches.length)];
  let q = "";
  let last = 0;
  for (const x of matches) {
    q += fact.slice(last, x.start);
    q += (x === picked) ? "（　　　）" : x.term;
    last = x.end;
  }
  q += fact.slice(last);
  if (withSiblings) {
    const siblings = matches.filter(x => x !== picked).map(x => x.term);
    return { q, a: picked.term, siblings };
  }
  return { q, a: picked.term };
}

