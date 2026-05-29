// cards/suiyoeki.js
window.CARDS = window.CARDS || {};

// --------------------------------------
// ランダム生成：水溶液の濃さ（理科）
// --------------------------------------
function generateRandomScienceCard() {

  // ① 濃度計算（基本）
  function card_concentration_basic() {
    const water = Math.floor(Math.random() * 150) + 50;
    const solute = Math.floor(Math.random() * 40) + 10;
    const percent = (solute / (water + solute) * 100).toFixed(1);

    return {
      q: `【濃度計算】\n${water}gの水に${solute}gの物質を溶かした。\n濃さは何%？`,
      a: `${percent}%\n（溶質 ÷ 全体 ×100）`,
      mode: "suiyoeki",
      score: 0
    };
  }

  // ② 濃度から必要量
  function card_make_solution() {
    const total = (Math.floor(Math.random() * 10) + 10) * 10;
    const percent = Math.floor(Math.random() * 15) + 5;
    const solute = (total * percent / 100).toFixed(1);
    const water = (total - solute).toFixed(1);

    return {
      q: `【濃度調整】\n${percent}%の水溶液を${total}gつくる。\n溶質と水は何g必要？`,
      a: `溶質：${solute}g\n水：${water}g`,
      mode: "suiyoeki",
      score: 0
    };
  }

  // ③ 混合
  function card_mix() {
    const p1 = Math.floor(Math.random() * 15) + 5;
    const p2 = Math.floor(Math.random() * 15) + 5;
    const w1 = (Math.floor(Math.random() * 10) + 5) * 10;
    const w2 = (Math.floor(Math.random() * 10) + 5) * 10;

    const sol1 = w1 * p1 / 100;
    const sol2 = w2 * p2 / 100;
    const percent = ((sol1 + sol2) / (w1 + w2) * 100).toFixed(1);

    return {
      q: `【混合】\n${p1}%の水溶液${w1}g と\n${p2}%の水溶液${w2}g を混ぜる。\n濃さは？`,
      a: `${percent}%`,
      mode: "suiyoeki",
      score: 0
    };
  }

  // ④ 希釈
  function card_dilution() {
    const p1 = Math.floor(Math.random() * 20) + 10;
    const p2 = Math.floor(Math.random() * (p1 - 1)) + 1;
    const w = (Math.floor(Math.random() * 10) + 5) * 10;
    const factor = p1 / p2;
    const addWater = w * (factor - 1);

    return {
      q: `【希釈】\n${p1}%の水溶液${w}g を${p2}%にうすめる。\n水は何g加える？`,
      a: `${addWater.toFixed(1)}g`,
      mode: "suiyoeki",
      score: 0
    };
  }

  // ⑤ 飽和水溶液を冷却したとき（析出）
  function card_precipitation() {
    const solHot = 14.9;  // 60℃
    const solCold = 4.9;  // 20℃
    const precipitated = (solHot - solCold).toFixed(1);

    return {
      q: `【析出】\n60℃で飽和しているホウ酸水溶液を20℃まで冷やすと、\n何gのホウ酸が析出する？（水100g）`,
      a: `${precipitated}g`,
      mode: "suiyoeki",
      score: 0
    };
  }

  // ⑥ 蒸発
  function card_evaporation() {
    const percent = 10;
    const total = 200;
    const evaporated = 50;
    const solute = total * percent / 100;
    const newTotal = total - evaporated;
    const newPercent = (solute / newTotal * 100).toFixed(1);

    return {
      q: `【蒸発】\n${percent}%の水溶液${total}gから水${evaporated}gが蒸発した。\n新しい濃さは？`,
      a: `${newPercent}%`,
      mode: "suiyoeki",
      score: 0
    };
  }

  // ⑦ 体積表示（密度1g/mL）
  function card_volume_concentration() {
    const waterVol = Math.floor(Math.random() * 150) + 50;
    const solute = Math.floor(Math.random() * 40) + 10;
    const totalMass = waterVol + solute;
    const percent = (solute / totalMass * 100).toFixed(1);

    return {
      q: `【体積表示】\n${waterVol}mLの水に${solute}gの物質を溶かした。\n濃さは何%？（密度1g/mLとする）`,
      a: `${percent}%`,
      mode: "suiyoeki",
      score: 0
    };
  }

  // ⑧ 体積→質量（35%塩酸）
  function card_volume_hcl() {
    const percent = 35;
    const density = 1 / 0.85; // 1mLあたりの質量
    const volume = Math.floor(Math.random() * 40) + 10;

    const mass = volume * density;
    const solute = mass * percent / 100;
    const answer = (solute / mass * 100).toFixed(1);

    return {
      q: `【体積→質量（塩酸）】\n${percent}%の塩酸を${volume}mLとった。\n（35%塩酸1gの体積は0.85mL）\nこの塩酸の濃さは何%？`,
      a: `${answer}%\n（1mL ≒ 1.176g）`,
      mode: "suiyoeki",
      score: 0
    };
  }

  // ⑨ 溶解度（ホウ酸）
  const solubility_H3BO3 = { 0: 2.7, 20: 4.9, 40: 8.9, 60: 14.9, 80: 23.5 };
  function card_solubility() {
    const temps = [0, 20, 40, 60, 80];
    const t = temps[Math.floor(Math.random() * temps.length)];
    const water = (Math.floor(Math.random() * 3) + 1) * 100;
    const sol = solubility_H3BO3[t] * (water / 100);

    return {
      q: `【溶解度】\n${t}℃の水${water}g にホウ酸は最大何g溶ける？`,
      a: `${sol.toFixed(2)}g`,
      mode: "suiyoeki",
      score: 0,
      type: "solubility"
    };
  }

  // ⑩ 暗記問題（網羅版）
  const memoryCards = [
    () => ({ q: "物質が水の中で小さなつぶになって広がることを何という？", a: "溶解", mode: "suiyoeki", score: 0 }),
    () => ({ q: "溶かされている物質を何という？", a: "溶質", mode: "suiyoeki", score: 0 }),
    () => ({ q: "溶かしている液体を何という？", a: "溶媒", mode: "suiyoeki", score: 0 }),
    () => ({ q: "溶質が溶媒に溶けてできた液体を何という？", a: "溶液", mode: "suiyoeki", score: 0 }),
    () => ({ q: "水が溶媒になっている溶液を何という？", a: "水溶液", mode: "suiyoeki", score: 0 }),
    () => ({ q: "一定量の水に溶ける物質の最大量を何という？", a: "溶解度", mode: "suiyoeki", score: 0 }),
    () => ({ q: "溶解度いっぱいまで溶けた水溶液を何という？", a: "飽和水溶液", mode: "suiyoeki", score: 0 }),
    () => ({ q: "固体の溶解度は温度が高くなるとどうなる？", a: "ふつう大きくなる", mode: "suiyoeki", score: 0 }),
    () => ({ q: "温度が高くなると溶解度が小さくなる固体の例は？", a: "水酸化カルシウム", mode: "suiyoeki", score: 0 }),
    () => ({ q: "気体の溶解度は温度が高くなるとどうなる？", a: "小さくなる", mode: "suiyoeki", score: 0 }),
    () => ({ q: "気体の溶解度に大きく影響する条件は？", a: "圧力（高いほどよく溶ける）", mode: "suiyoeki", score: 0 }),
    () => ({ q: "溶解度表はふつう何gの水に対する溶ける量で表す？", a: "100gの水", mode: "suiyoeki", score: 0 }),
    () => ({ q: "水溶液の濃さは何の割合で表す？", a: "溶質の重さ ÷ 水溶液の重さ", mode: "suiyoeki", score: 0 }),
    () => ({ q: "食塩水の密度は濃くなるとどうなる？", a: "大きくなる", mode: "suiyoeki", score: 0 }),
    () => ({ q: "アルコール水溶液の密度は濃くなるとどうなる？", a: "小さくなる", mode: "suiyoeki", score: 0 }),
    () => ({ q: "温度を下げて溶質を取り出す方法は何を利用している？", a: "溶解度の温度変化", mode: "suiyoeki", score: 0 }),
    () => ({ q: "水を蒸発させて溶質を取り出す方法はどんな物質に有効？", a: "溶解度が温度であまり変わらない物質（例：食塩）", mode: "suiyoeki", score: 0 })
  ];

  // ⑪ 溶解度曲線：ある温度での溶解度
  function card_curve_read_value() {
    const temps = [0, 20, 40, 60, 80];
    const sol = solubility_H3BO3;
    const t = temps[Math.floor(Math.random() * temps.length)];

    return {
      q: `【溶解度曲線】\n${t}℃の水100gにはホウ酸は最大何g溶ける？`,
      a: `${sol[t]}g`,
      mode: "suiyoeki",
      score: 0,
      type: "solubility"
    };
  }

  // ⑫ 溶解度曲線：温度を上げたときの追加溶解量
  function card_curve_additional() {
    const sol = solubility_H3BO3;
    const pairs = [
      [20, 40],
      [20, 60],
      [40, 60],
      [40, 80],
      [60, 80]
    ];
    const [t1, t2] = pairs[Math.floor(Math.random() * pairs.length)];
    const diff = (sol[t2] - sol[t1]).toFixed(1);

    return {
      q: `【溶解度曲線】\n${t1}℃ → ${t2}℃ にすると、あと何g溶ける？（水100g）`,
      a: `${diff}g`,
      mode: "suiyoeki",
      score: 0,
      type: "solubility"
    };
  }

  // ⑬ 溶解度曲線：水の量が変わったとき
  function card_curve_water_amount() {
    const temps = [20, 40, 60, 80];
    const sol = solubility_H3BO3;
    const t = temps[Math.floor(Math.random() * temps.length)];
    const water = (Math.floor(Math.random() * 3) + 1) * 100;
    const amount = (sol[t] * (water / 100)).toFixed(1);

    return {
      q: `【溶解度曲線】\n${t}℃の水${water}gにはホウ酸は最大何g溶ける？`,
      a: `${amount}g`,
      mode: "suiyoeki",
      score: 0,
      type: "solubility"
    };
  }

  // ⑭ 溶解度曲線：飽和水溶液を冷やしたときの析出量
  function card_curve_precipitation() {
    const sol = solubility_H3BO3;
    const pairs = [
      [60, 20],
      [80, 40],
      [80, 20]
    ];
    const [hot, cold] = pairs[Math.floor(Math.random() * pairs.length)];
    const precip = (sol[hot] - sol[cold]).toFixed(1);

    return {
      q: `【溶解度曲線】\n${hot}℃の飽和水溶液（水100g）を${cold}℃まで冷やすと、\n何gのホウ酸が析出する？`,
      a: `${precip}g`,
      mode: "suiyoeki",
      score: 0,
      type: "solubility"
    };
  }

  // 生成関数一覧
  const generators = [
    card_concentration_basic,
    card_make_solution,
    card_mix,
    card_dilution,
    card_precipitation,
    card_evaporation,
    card_volume_concentration,
    card_volume_hcl,
    card_solubility,
    card_curve_read_value,
    card_curve_additional,
    card_curve_water_amount,
    card_curve_precipitation,
    () => memoryCards[Math.floor(Math.random() * memoryCards.length)]()
  ];

  return generators[Math.floor(Math.random() * generators.length)]();
}

// --------------------------------------
// suiyoeki モードはダミー1枚だけ
// --------------------------------------
window.CARDS.suiyoeki = [
  { q: "ダミー", a: "ダミー", mode: "suiyoeki", score: 0 }
];