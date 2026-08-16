# AOBA X Operator

Drive正本 `AOBA_X_OPERATION_AND_MONETIZATION_v04.md` に合わせた、AOBAのX運用・投稿承認・分析ツールです。

## 現行運用

- 時系列ストーリーや固定9投稿は使わない
- `PV入口型`、`親近感・ファン化型`、`超やさしい不動産知識型`、`仕事のリアル型`を役割分担する
- 投稿ごとに目的、仮説、変更する1変数を記録する
- 24時間後・7日後の実測を直近中央値と比較し、Keep / Kill / Modifyを決める
- 顔・人物同一性・世界観は固定し、マーケティングだけを改善する
- 投稿先は `@aoba_day`。公開は毎回、画像・本文・ALT・AI表示を見た本人の明示承認後だけ行う

## Macでの投稿

1. `oauth/AOBA投稿.command` を開く
2. ローカル版のあおばWEBアプリで投稿カテゴリと候補を選ぶ
3. 「この案をX APIの最終確認へ」から、画像、本文、ALT、目的、検証変数を確認する
4. 必要なら最終確認画面で本文とALTを直接編集する
5. 編集後の内容を確認してチェックを入れ、確認語を入力した場合だけ公開する
6. Post IDとURLを非公開ログへ保存し、Sheets連携を読み戻して確認する

同じWEBアプリでも、公開版は投稿権限を持ちません。X APIで公開・実測取得できるのは、Mac上の `http://127.0.0.1:3001/app/` だけです。

Client ID / Client SecretはMacのキーチェーンへ保存し、期限前に自動更新します。チャット、Drive、GitHub、Sheets、公開版のブラウザ保存領域には置きません。

## スマホで常に最新版を見る

- 公開URL: `https://hiroyuki0217-lgtm.github.io/aoba-x-operator/`
- URLをChromeまたはSafariのお気に入りへ登録すれば、同じURLで最新版を開ける
- オンライン時はネットワーク上の最新版を優先し、更新されたService Workerを自動確認する
- 基準画像は端末内の個別保存ではなく、Drive正本を反映したGitHub Pages共通版を表示する
- X APIの秘密情報と実投稿機能はMacのローカル版だけに残し、公開版へは含めない

## 安全境界

- Xパスワード、API Key、Client Secret、Access Token、Refresh TokenをDrive、GitHub、Sheets、ブラウザ保存領域へ置かない
- 大量返信、自動いいね、無差別フォロー、人工的なエンゲージメント操作を行わない
- AI生成メディアはX API対応時に `made_with_ai: true` を付ける
- 不動産知識は一次資料で正確性を確認してから、日常語へ翻訳する

## 検証

```sh
npm test
npm run audit
```

テストは外部投稿を行わず、OAuth、必要scope、4カテゴリ、画像制限、秘密情報の非保存、二重投稿防止、ALT、AI表示、Sheets連携を確認します。
