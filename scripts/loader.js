// scripts/loader.js
// =================================================================
// マニフェストに従って各カードファイルを動的に読み込み、
// すべてロードし終わったらアプリを初期化します。
// =================================================================

(function () {
  const manifest = Array.isArray(window.CARDS_MANIFEST) ? window.CARDS_MANIFEST : [];

  function startApp() {
    if (typeof window.initApp === "function") {
      window.initApp();
    } else {
      console.error("[loader] initApp が見つかりません。app.js が先に読み込まれているか確認してください。");
    }
  }

  if (manifest.length === 0) {
    console.warn("[loader] CARDS_MANIFEST が空です。cards/_manifest.js を確認してください。");
    startApp();
    return;
  }

  let remaining = manifest.length;
  const onDone = () => {
    remaining--;
    if (remaining === 0) startApp();
  };

  manifest.forEach((name) => {
    const script = document.createElement("script");
    script.src = "cards/" + name + ".js";
    script.async = false; // 順序は問わないが念のため
    script.onload = onDone;
    script.onerror = () => {
      console.error("[loader] cards/" + name + ".js の読み込みに失敗しました。");
      onDone();
    };
    document.head.appendChild(script);
  });
})();
