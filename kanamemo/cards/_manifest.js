// cards/_manifest.js
// =================================================================
// 単元ファイルの登録一覧 と チャレンジモード用バンドル定義
// =================================================================
//
// 【CARDS_MANIFEST】単元ファイル
//   - フラッシュカード／チャレンジで使うすべての単元キーをここに列挙。
//   - 新規追加するときは1行追加するだけでOK。
//
// 【CHALLENGE_BUNDLES】チャレンジモードの範囲選択チップ単位
//   - 「11〜14回まとめ」など、ユーザに見せる単位でグルーピング。
//   - 1バンドル＝1チップとして範囲選択に出る。複数選択可。
//   - フラッシュカードでは BUNDLES は使わず、個別単元を選べる。
//
// =================================================================

window.CARDS_MANIFEST = [
  "kyushu_cloze",
  "chushikoku_cloze",
  "kinki_cloze",
  "chubu_cloze",
  "suiyoeki"
];

window.CHALLENGE_BUNDLES = [
  {
    key: "shakai_11_14",
    title: "社会 第11〜14回（地方）",
    subject: "社会",
    units: ["kyushu_cloze","chushikoku_cloze","kinki_cloze","chubu_cloze"]
  },
  {
    key: "rika_12",
    title: "理科 第12回（水溶液）",
    subject: "理科",
    units: ["suiyoeki"]
  }
];
