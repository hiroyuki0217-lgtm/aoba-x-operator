import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = new URL("./outputs/daily-ops/", import.meta.url).pathname;
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const dashboard = workbook.worksheets.add("ダッシュボード");
const daily = workbook.worksheets.add("日次入力");
const posts = workbook.worksheets.add("投稿ログ");
const visual = workbook.worksheets.add("画像要素");
const ideas = workbook.worksheets.add("改善提案");
const sync = workbook.worksheets.add("アプリ同期");

const header = { fill: "#E5E7EB", font: { bold: true, color: "#111827" }, borders: { preset: "outside", style: "thin", color: "#D1D5DB" } };
const section = { fill: "#F3F4F6", font: { bold: true, color: "#111827" } };

dashboard.getRange("A1:H1").merge();
dashboard.getRange("A1").values = [["AOBA X Operator｜日次運用ダッシュボード"]];
dashboard.getRange("A1").format = { fill: "#111827", font: { bold: true, color: "#FFFFFF", size: 16 }, horizontalAlignment: "left" };
dashboard.getRange("A3:B3").values = [["指標", "現在値"]];
dashboard.getRange("A3:B3").format = header;
dashboard.getRange("A4:A8").values = [["登録投稿数"], ["累計表示回数"], ["平均反応率"], ["最新フォロワー数"], ["判定"]];
dashboard.getRange("B4:B8").formulas = [
  ["=COUNTIF('投稿ログ'!B2:B201,\"<>\")"],
  ["=SUM('投稿ログ'!H2:H201)"],
  ["=IFERROR(AVERAGE('投稿ログ'!N2:N201),\"\")"],
  ["=IFERROR(LOOKUP(2,1/('日次入力'!B2:B201<>\"\"),'日次入力'!B2:B201),\"\")"],
  ["=IF(B4=0,\"投稿実績の入力待ち\",\"Keep / Kill / Modifyを確認\")"],
];
dashboard.getRange("B5:B5").format.numberFormat = "#,##0";
dashboard.getRange("B6:B6").format.numberFormat = "0.0%";
dashboard.getRange("D3:H3").merge();
dashboard.getRange("D3").values = [["次に試す実験（v04・反応入力後に更新）"]];
dashboard.getRange("D3").format = section;
dashboard.getRange("D4:H4").merge();
dashboard.getRange("D4").formulas = [["=IFERROR('アプリ同期'!B6,\"反応データを入れると、ここに次の実験案が表示されます。\")"]];
dashboard.getRange("D4").format = { font: { bold: true }, wrapText: true, verticalAlignment: "top" };
dashboard.getRange("D5:H8").merge();
dashboard.getRange("D5").formulas = [["=IFERROR('アプリ同期'!B9,\"\")"]];
dashboard.getRange("D5").format = { wrapText: true, verticalAlignment: "top" };

daily.getRange("A1:J1").values = [["日付", "フォロワー数", "表示回数", "プロフィール閲覧", "いいね", "リポスト", "返信", "リンククリック", "メモ", "入力状態"]];
daily.getRange("A1:J1").format = header;
daily.getRange("A2:J2").values = [[new Date("2026-08-13"), null, null, null, null, null, null, null, "毎日、Xアナリティクスの数値を記録", "入力待ち"]];
daily.getRange("A2:A201").format.numberFormat = "yyyy-mm-dd";
daily.freezePanes.freezeRows(1);

posts.getRange("A1:AL1").values = [["投稿日", "Post ID/URL", "投稿カテゴリ", "目的", "仮説", "今回変える1変数", "画像・構図", "表示回数", "いいね", "リポスト", "返信", "プロフィール遷移", "本文タイプ", "エンゲージメント率", "判断メモ", "24h取得日時", "24h表示回数", "24hいいね", "24hリポスト", "24h返信", "24hプロフィール遷移", "7d取得日時", "7d表示回数", "7dいいね", "7dリポスト", "7d返信", "7dプロフィール遷移", "プロフィール遷移率", "フォロー増分", "フォロー転換率", "リンククリック", "売上", "APIコスト", "差引売上", "直近中央値（表示）", "中央値比", "Keep/Kill/Modify", "事実確認・出典"]];
posts.getRange("A1:AL1").format = header;
posts.getRange("A2:AL5").values = [
  [null,null,"PV入口型","タイムライン停止率とプロフィール遷移","顔寄りの自然な夕方セルフィーは初見停止を作りやすい","冒頭文を自己紹介から一場面の描写へ変更","夕方の帰り道／顔寄りセルフィー",null,null,null,null,null,"短い一場面",null,"未判定",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"未判定",""],
  [null,null,"親近感・ファン化型","返信率と再訪につながる親近感","短い脱力文と自宅セルフィーは人柄への好意を作りやすい","問いかけなし／ありを別投稿で比較","日曜夜のベッド／顔寄りセルフィー",null,null,null,null,null,"短い脱力文",null,"未判定",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"未判定",""],
  [null,null,"超やさしい不動産知識型","保存的反応とフォロー理由の形成","専門用語の生活語訳は役立つアカウントだと伝わりやすい","定義ではなく本人の発見から始める","仕事デスク／間取り図から顔を上げる",null,null,null,null,null,"本人の発見→生活語訳",null,"未判定",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"未判定","国土交通省 住まリテ｜住まいにはどんな費用がかかる？"],
  [null,null,"仕事のリアル型","職業設定の理解とプロフィール遷移","仕事前の一動作は職業のリアリティを伝えやすい","顔寄り／全身の画角を比較","朝のエレベーター／全身鏡セルフィー",null,null,null,null,null,"仕事前の一動作",null,"未判定",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"未判定",""]
];
// 2026-08-16ユーザー承認済みの仕事写真ルールで旧スーツ案を上書きする。
posts.getRange("G4").values = [["不動産店舗／撮影者へ物件ファイルと鍵を見せる3/4身"]];
posts.getRange("E5:G5").values = [[
  "撮影者へ反応する仕事前の一動作は新卒入社1年目の新人らしさと職業のリアリティを伝えやすい",
  "顔寄り／膝下までの3/4身を比較",
  "初めての内見前／撮影者へ鍵を見せる",
]];
posts.getRange("N2").formulas = [["=IFERROR((I2+J2+K2+AE2)/H2,\"\")"]];
posts.getRange("N2:N201").fillDown();
posts.getRange("AB2").formulas = [["=IFERROR(L2/H2,\"\")"]];
posts.getRange("AB2:AB201").fillDown();
posts.getRange("AD2").formulas = [["=IFERROR(AC2/L2,\"\")"]];
posts.getRange("AD2:AD201").fillDown();
posts.getRange("AH2").formulas = [["=IF(COUNTA(AF2:AG2)=0,\"\",AF2-AG2)"]];
posts.getRange("AH2:AH201").fillDown();
posts.getRange("AI2").formulas = [["=IF(COUNTA($H$2:$H$201)<3,\"\",MEDIAN(FILTER($H$2:$H$201,$H$2:$H$201<>\"\")))"]];
posts.getRange("AI2:AI201").fillDown();
posts.getRange("AJ2").formulas = [["=IFERROR(H2/AI2,\"\")"]];
posts.getRange("AJ2:AJ201").fillDown();
posts.getRange("AK2").formulas = [["=IF(C2=\"\",\"\",IF(H2=\"\",\"未判定\",IF(AJ2>=1.2,\"Keep\",IF(AJ2<0.5,\"Kill\",\"Modify\"))))"]];
posts.getRange("AK2:AK201").fillDown();
posts.getRange("A2:A201").format.numberFormat = "yyyy-mm-dd";
posts.getRange("H2:L201").format.numberFormat = "#,##0";
posts.getRange("N2:N201").format.numberFormat = "0.0%";
posts.getRange("AB2:AB201").format.numberFormat = "0.0%";
posts.getRange("AD2:AD201").format.numberFormat = "0.0%";
posts.getRange("AJ2:AJ201").format.numberFormat = "0.0%";
posts.getRange("P2:P201").format.numberFormat = "yyyy-mm-dd hh:mm";
posts.getRange("Q2:U201").format.numberFormat = "#,##0";
posts.getRange("V2:V201").format.numberFormat = "yyyy-mm-dd hh:mm";
posts.getRange("W2:AA201").format.numberFormat = "#,##0";
posts.freezePanes.freezeRows(1);
posts.freezePanes.freezeColumns(3);

visual.getRange("A1:J1").values = [["投稿日", "投稿ID/URL", "場面", "構図", "髪・表情", "光", "服装", "本文タイプ", "反応率", "学び"]];
visual.getRange("A1:J1").format = header;
visual.getRange("A2:J10").values = [
  [new Date("2026-08-17"), "", "夕方の帰り道", "顔寄りセルフィー", "下ろした髪・静かな微笑み", "夕日の逆光", "青い小花柄ワンピース", "短い自己紹介", null, "初回固定投稿候補"],
  [new Date("2026-08-18"), "", "初めての内見前", "撮影者を意識した3/4身", "低いポニー・少し照れた柔らかな笑顔", "店舗の窓光と室内光", "青灰アシメノースリーブ・アイボリーAラインミディ", "短い独白", null, "ユーザー承認済み仕事写真の基準"],
  [new Date("2026-08-19"), "", "不動産店舗の接客テーブル", "撮影者を意識した3/4身", "まとめ髪・カメラ目線の柔らかな微笑み", "店舗の窓光と室内光", "若いモード感のノースリーブ・明るいAラインミディ", "具体的な一場面", null, "非セルフィーはAOBAと撮影者の一対一"],
  [new Date("2026-08-20"), "", "外出合間のカフェ", "顔寄りセルフィー", "まとめ髪・柔らかい笑顔", "窓際の自然光", "KBF/MURUA寄りリブトップス・明るいミディスカート", "短い独白", null, "顔寄り写真の反応を見る"],
  [new Date("2026-08-21"), "", "帰宅して部屋着に着替えた直後", "全身鏡セルフィー", "低いポニー・疲れと安堵", "暖色の室内光", "柔らかいTシャツ・ルームパンツ・裸足", "共感の一言", null, "自宅は必ず部屋着。外履きなし"],
  [new Date("2026-08-22"), "", "休日朝の自宅", "全身鏡セルフィー", "下ろした髪・期待感", "朝の自然光", "ボートネックのルームニット・ルームパンツ・裸足", "短い独白", null, "外出着へ着替える前も部屋着を守る"],
  [new Date("2026-08-22"), "", "昼の街歩き", "撮影者へ振り返る全身", "下ろした髪・撮影者への自然な笑顔", "屋外の木漏れ日", "青い小花柄ワンピース", "寄り道の一場面", null, "非セルフィーは撮られている意識を必須にする"],
  [new Date("2026-08-23"), "", "日曜夜のベッド", "座位の顔寄りセルフィー", "ほどいた髪・リラックス", "暖色の室内光", "グレーTシャツ・ショートパンツ", "短い独白", null, "部屋時間の親近感"],
  [new Date("2026-08-24"), "", "洗濯物をたたむ夜", "低位置セルフタイマー", "ラフな髪・大きな笑顔", "暖色の室内光", "グレーTシャツ・ショートパンツ", "具体的な一場面", null, "生活感と笑顔の反応を見る"],
];
visual.getRange("I2").formulas = [["=IFERROR('投稿ログ'!N2,\"\")"]];
visual.getRange("I2:I201").fillDown();
visual.getRange("A2:A201").format.numberFormat = "yyyy-mm-dd";
visual.getRange("I2:I201").format.numberFormat = "0.0%";
visual.freezePanes.freezeRows(1);

ideas.getRange("A1:H1").values = [["作成日", "根拠", "維持する要素", "試す変数", "避ける要素", "日本語画像プロンプト", "投稿文案", "状態"]];
ideas.getRange("A1:H1").format = header;
ideas.getRange("A2:H2").values = [[new Date("2026-08-13"), "初期仮説：仕事帰り・全身・短い弱音", "仕事帰り／全身／少し乱れた髪", "光を少し柔らかくする", "説明が長すぎる本文", "23歳、4年制大学卒業後に不動産会社へ新卒入社した入社1年目・社会人1年目の日本人女性「あおば」。駅から帰宅して部屋着へ着替えた後の1K、自宅の玄関から室内を見た縦構図。柔らかいグレーのTシャツと締め付けないルームパンツ、低い位置で雑に結んだダークブラウンの髪、前髪が少し割れ、肩の力が抜けている。全身が自然に入り、裸足または靴下。白・グレー・薄い木目の生活感、暖色の室内灯と自然な影。営業用の笑顔ではなく、疲れがほどけた静かな表情。スマホで撮ったような自然な写真、セルフィーの腕を長くしない、過度な加工なし、9:16。", "ただいま。今日は少しだけ、ちゃんとしてなくていい日にしたい。", "初期案"]];
ideas.getRange("A2:A201").format.numberFormat = "yyyy-mm-dd";
ideas.getRange("F2:G201").format.wrapText = true;
ideas.freezePanes.freezeRows(1);

sync.getRange("A1:B1").values = [["項目", "値"]];
sync.getRange("A1:B1").format = header;
sync.getRange("A2:B11").values = [
  ["更新日時", "2026-08-16 11:28 JST"],
  ["正本", "運用: AOBA_X_OPERATION_AND_MONETIZATION_v04／画像: AOBA_IMAGE_DIRECTION_v01"],
  ["分析状態", "入力待ち（投稿実績なし。推測値は使用しない）"],
  ["本命カテゴリ", "超やさしい不動産知識型"],
  ["本命タイトル", "入社1年目に知った、管理費と修繕積立金"],
  ["目的", "保存的反応とフォロー理由の形成"],
  ["テスト変数", "定義ではなく入社1年目の本人の発見から始める"],
  ["本文", "入社1年目。\nこれ、働きはじめて初めて知ったんだけど。\n\nマンションの『管理費』は、廊下やエレベーターを毎日ちゃんと使えるようにするお金。『修繕積立金』は、将来の大きな修理のために、みんなで少しずつ貯めるお金です。\n\n似ているけど、役目は別なんです。"],
  ["ALT", "新卒で不動産会社へ入社して1年目、店舗で撮影者へ柔らかく微笑みながら物件ファイルと鍵を見せる23歳のアオバ。青灰色のアシンメトリーなノースリーブとアイボリーのミディスカートを着ています。AI生成の架空キャラクターです。"],
  ["公開条件", "本人が画像・本文・ALT・AI表示を確認後に承認"]
];
sync.getRange("B2:B11").format.wrapText = true;

for (const sheet of [dashboard, daily, posts, visual, ideas, sync]) {
  sheet.showGridLines = false;
  sheet.getUsedRange().format.autofitColumns();
}
dashboard.getRange("A1:H10").format.columnWidth = 18;
dashboard.getRange("D4:H8").format.rowHeight = 32;
daily.getRange("A1:J201").format.columnWidth = 15;
posts.getRange("A1:AL201").format.columnWidth = 16;
posts.getRange("C1:G201").format.columnWidth = 22;
posts.getRange("O1:O201").format.columnWidth = 26;
posts.getRange("AL1:AL201").format.columnWidth = 32;
visual.getRange("A1:J201").format.columnWidth = 18;
visual.getRange("J1:J201").format.columnWidth = 26;
ideas.getRange("A1:H201").format.columnWidth = 18;
ideas.getRange("B1:E201").format.columnWidth = 22;
ideas.getRange("F1:G201").format.columnWidth = 48;
sync.getRange("A1:A11").format.columnWidth = 18;
sync.getRange("B1:B11").format.columnWidth = 85;

const check = await workbook.inspect({ kind: "table", range: "ダッシュボード!A1:H8", include: "values,formulas", tableMaxRows: 10, tableMaxCols: 8 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 50 }, summary: "formula error scan" });
console.log(errors.ndjson);
for (const sheetName of ["ダッシュボード", "日次入力", "投稿ログ", "画像要素", "改善提案", "アプリ同期"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${sheetName}.png`, new Uint8Array(await preview.arrayBuffer()));
}
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/AOBA_X_日次分析.xlsx`);
