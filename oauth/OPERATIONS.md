# AOBA X Operator 実運用手順

## 投稿前

1. `AOBA投稿.command` をダブルクリックし、ローカル版のあおばWEBアプリを開く。
2. 投稿案を選び、「この案をX APIの最終確認へ」を押す。
3. 初回だけX ConsoleからClient IDとClient Secretを入力し、「Macのキーチェーンに保存して自動更新する」を有効にする。
4. `@aoba_day`、投稿カテゴリ、目的、仮説、今回変える1変数、画像、本文、ALT、`made_with_ai: true` を確認する。
5. 投稿日時は固定せず、その日のResearch結果と直近実績を見て本人が決める。
6. 本人が最終プレビューを確認し、チェックを付けて「投稿する」と入力した場合だけ公開する。

Client IDとClient SecretはMacのキーチェーンだけに保存される。Operatorは起動時・期限15分前・投稿前・計測前にRefresh Tokenで自動更新する。X側で権限を取り消した場合は`AOBA認証.command`から再認証する。

## 投稿後に完了と判断する条件

- X APIからPost IDが返っている。
- `https://x.com/aoba_day/status/<Post ID>` を読み戻せる。
- Mac内の非公開投稿ログにPost ID、URL、時刻、Media ID、結果がある。
- `node oauth/sheet-handoff.mjs list` に投稿URLの未処理連携がある。
- Google Sheets「投稿ログ」の対象行B列へURLを書き込み、読み戻して一致する。
- 一致後にだけhandoffを`ack`する。

いずれかが未確認なら完了扱いにしない。ただしPost IDが一度でも発行された場合は、再投稿しない。

## 途中終了・エラー時

ホーム画面に「処理要確認」が出た場合、同じ投稿をやり直さない。表示された投稿URLまたは `oauth/.secrets/publication-state.json` のPost IDを使って、X上の実体を先に確認する。

- `failed_before_post`: Post ID発行前の失敗。原因を直した後に再試行できる。
- `post_created` / `published_unverified`: 投稿作成済みの可能性が高い。再投稿禁止。
- `post_created_unlogged`: 投稿は作成されたが記録処理が未完了。Post IDからログとSheets連携を復旧する。
- `complete`: ローカル投稿ログとSheets連携待ちの作成まで完了。

## 24時間後・7日後

1. Operatorの「反応を取得する」にPost IDを入力する。
2. `24時間後` または `7日後` を選ぶ。
3. X APIの実測値だけを取得する。取得できない値は推測しない。
4. Google SheetsではH:Lを最新値、P:Uを24時間後、V:AAを7日後として更新する。
5. 書き込み後に同じセルを読み戻し、一致したhandoffだけ`ack`する。

## 禁止事項

- Client ID、Client Secret、Access Token、Refresh Tokenをチャット、GitHub、Drive、Sheetsへ貼らない。
- 自動いいね、返信、フォローをしない。
- 予定時刻前や本人の明示承認前に投稿しない。
- Post ID発行後に同じ投稿候補を再送しない。
