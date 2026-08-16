import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LAUNCH_POSTS } from "./launch-posts.mjs";
import { applyPostEdits, canRequestPublication, isAllowedLocalRequest, isDue, localAppFile } from "./operator-server.mjs";
import { batchRequestsForHandoff, buildRefreshedTokenRecord, createPost, inspectImage, metricValues, metricsSheetHandoff, postSheetHandoff, publicationBlocker, safeError, setAltText, sheetColumnIndex, tokenStatus, uploadImage, verifyTokenAccount } from "./x-api.mjs";

const OAUTH_DIR = dirname(fileURLToPath(import.meta.url));

test("v04の4カテゴリ実験キューは役割・仮説・本文・ALT・画像が揃う", async () => {
  assert.equal(LAUNCH_POSTS.length, 4);
  assert.deepEqual(LAUNCH_POSTS.map((post) => post.id), ["01", "02", "03", "04"]);
  assert.deepEqual(LAUNCH_POSTS.map((post) => post.image), [
    "../assets/aoba/weekend-bakery-aoba-v01-20260817.png",
    "../assets/aoba/home-laundry-aoba-v01-20260817.png",
    "../assets/aoba/work-fees-aoba-v01-20260817.png",
    "../assets/aoba/work-first-viewing-aoba-v01-20260817.png",
  ]);
  assert.deepEqual(LAUNCH_POSTS.map((post) => post.text), [
    "パン屋さんの前で、もう一回呼ばれた。\n振り向いた瞬間、ちゃんと撮れてた？🌿",
    "たたみ始めたら、白い服ばっかりでした。\n部屋着のまま、あと少しだけやります。",
    "入社1年目。\nこれ、働きはじめて初めて知ったんだけど。\n\nマンションの「管理費」は、廊下やエレベーターを毎日ちゃんと使えるようにするお金。\n「修繕積立金」は、将来の大きな修理のために、みんなで少しずつ貯めるお金です。\n\n似ているけど、役目は別なんです。",
    "入社1年目。\n今日は初めて、一人で内見へ。\n心配で鍵をもう3回見ました。行ってきます。",
  ]);
  assert.deepEqual(new Set(LAUNCH_POSTS.map((post) => post.category)), new Set(["PV入口型", "親近感・ファン化型", "超やさしい不動産知識型", "仕事のリアル型"]));
  for (const post of LAUNCH_POSTS) {
    assert.equal(post.scheduledAt, null);
    assert.ok(post.objective.length > 0);
    assert.ok(post.hypothesis.length > 0);
    assert.ok(post.testVariable.length > 0);
    assert.ok(post.text.length > 0);
    assert.ok(post.alt.length > 0 && post.alt.length <= 1000);
    const path = resolve(OAUTH_DIR, post.image);
    await access(path);
    const image = await inspectImage(path);
    assert.ok(["image/jpeg", "image/png"].includes(image.mediaType));
    assert.ok(image.bytes < 5 * 1024 * 1024);
  }
});

test("期限判定は30秒の安全余裕を持つ", () => {
  const now = Date.parse("2026-08-15T12:00:00Z");
  assert.equal(tokenStatus({ expires_at: "2026-08-15T12:00:20Z" }, now).expired, true);
  assert.equal(tokenStatus({ expires_at: "2026-08-15T12:02:00Z" }, now).expired, false);
});

test("日時固定なしは本人承認後に公開でき、日時指定なら予定前を止める", () => {
  const post = LAUNCH_POSTS[0];
  assert.equal(isDue(post, Date.parse("2026-08-16T10:00:00+09:00")), true);
  const scheduled = { ...post, scheduledAt: "2026-08-17T20:30:00+09:00" };
  assert.equal(isDue(scheduled, Date.parse("2026-08-17T20:29:59+09:00")), false);
  assert.equal(isDue(scheduled, Date.parse("2026-08-17T20:30:00+09:00")), true);
  assert.equal(canRequestPublication(scheduled, Date.parse("2026-08-17T20:29:59+09:00"), false), false);
  assert.equal(canRequestPublication(scheduled, Date.parse("2026-08-17T20:29:59+09:00"), true), true);
});

test("最終プレビューの本文とALTを検証して投稿内容へ反映する", () => {
  const post = LAUNCH_POSTS[1];
  const edited = applyPostEdits(post, "  編集後の本文です。\n2行目です。  ", "  編集後のALTです。  ");
  assert.equal(edited.text, "編集後の本文です。\n2行目です。");
  assert.equal(edited.alt, "編集後のALTです。");
  assert.equal(edited.id, post.id);
  assert.throws(() => applyPostEdits(post, "", post.alt), /本文/);
  assert.throws(() => applyPostEdits(post, "あ".repeat(281), post.alt), /280/);
  assert.throws(() => applyPostEdits(post, post.text, ""), /ALT/);
  assert.throws(() => applyPostEdits(post, post.text, "あ".repeat(1001)), /1000/);
});

test("Mac外や別Originからのローカル投稿操作を拒否する", () => {
  assert.equal(isAllowedLocalRequest({ host: "127.0.0.1:3001" }), true);
  assert.equal(isAllowedLocalRequest({ host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" }), true);
  assert.equal(isAllowedLocalRequest({ host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001/" }), true);
  assert.equal(isAllowedLocalRequest({ host: "127.0.0.1:3001", origin: "null", "sec-fetch-site": "same-origin" }), true);
  assert.equal(isAllowedLocalRequest({ host: "127.0.0.1:3001", origin: "null", "sec-fetch-site": "cross-site" }), false);
  assert.equal(isAllowedLocalRequest({ host: "attacker.example" }), false);
  assert.equal(isAllowedLocalRequest({ host: "127.0.0.1:3001", origin: "https://attacker.example" }), false);
});

test("ローカル統合アプリは必要な公開素材だけを配信する", () => {
  assert.match(localAppFile("/app/"), /index\.html$/);
  assert.match(localAppFile("/app/app.js"), /app\.js$/);
  assert.match(localAppFile("/app/assets/aoba/launch-01.jpg"), /launch-01\.jpg$/);
  assert.equal(localAppFile("/app/oauth/.secrets/x-oauth.json"), null);
  assert.equal(localAppFile("/app/../oauth/server.mjs"), null);
});

test("APIエラーから秘密情報ではなく安全な説明だけを取り出す", () => {
  assert.equal(safeError({ errors: [{ detail: "invalid media" }] }, 400), "invalid media");
  assert.equal(safeError({}, 503), "HTTP 503");
});

test("トークン更新時もClient IDとClient Secretを保存しない", () => {
  const next = buildRefreshedTokenRecord(
    { account: { username: "aoba_day" }, client_id: "never-store", client_secret: "never-store", refresh_token: "old" },
    { access_token: "new-access", refresh_token: "new-refresh", expires_in: 7200 },
    new Date("2026-08-15T12:00:00Z"),
  );
  assert.equal(next.client_id, undefined);
  assert.equal(next.client_secret, undefined);
  assert.equal(next.access_token, "new-access");
  assert.equal(next.refresh_token, "new-refresh");
});

test("公開済み・途中状態では二重投稿を止める", () => {
  assert.match(publicationBlocker({ published: { post_url: "https://x.com/aoba_day/status/1" }, state: null }), /公開済み/);
  assert.match(publicationBlocker({ published: null, state: { status: "post_created_unlogged", post_id: "1" } }), /未解決/);
  assert.equal(publicationBlocker({ published: null, state: { status: "failed_before_post" } }), null);
  assert.equal(publicationBlocker({ published: null, state: { status: "complete" } }), null);
});

test("同じユーザー名でも認証アカウントIDが違えば中止する", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({ data: { id: "999", username: "aoba_day" } }), { status: 200 });
  await assert.rejects(() => verifyTokenAccount({ access_token: "test", account: { id: "111", username: "aoba_day" } }), /アカウントID/);
});

test("画像・ALT・投稿APIへ承認済み内容とAI表示を送る", async (context) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/media/upload")) return new Response(JSON.stringify({ data: { id: "123456", media_key: "3_123456" } }), { status: 200 });
    if (String(url).endsWith("/media/metadata")) return new Response(JSON.stringify({ data: {} }), { status: 200 });
    if (String(url).endsWith("/tweets")) return new Response(JSON.stringify({ data: { id: "987654", text: "test" } }), { status: 201 });
    return new Response(JSON.stringify({ detail: "unexpected" }), { status: 500 });
  };

  const first = LAUNCH_POSTS[0];
  const media = await uploadImage("token-not-logged", resolve(OAUTH_DIR, first.image));
  await setAltText("token-not-logged", media.id, first.alt);
  const created = await createPost("token-not-logged", { text: first.text, mediaId: media.id });

  assert.equal(created.id, "987654");
  assert.equal(calls.length, 3);
  const uploadBody = JSON.parse(calls[0].options.body);
  assert.equal(uploadBody.media_category, "tweet_image");
  assert.ok(uploadBody.media.length > 1000);
  assert.deepEqual(JSON.parse(calls[1].options.body), { id: "123456", metadata: { alt_text: { text: first.alt } } });
  assert.deepEqual(JSON.parse(calls[2].options.body), { text: first.text, media: { media_ids: ["123456"] }, made_with_ai: true });
});

test("投稿ログは初回投稿IDをSheetsの既存行へ対応させる", () => {
  const handoff = postSheetHandoff({ launch_id: "01", post_id: "987654", post_url: "https://x.com/aoba_day/status/987654" });
  assert.equal(handoff.sheet_name, "投稿ログ");
  assert.equal(handoff.row, 2);
  assert.deepEqual(handoff.cells, { B: "https://x.com/aoba_day/status/987654" });
});

test("24時間・7日後の実測値を別列へ残す", () => {
  const base = {
    collected_at: "2026-08-18T11:30:00.000Z",
    post_id: "987654",
    public_metrics: { impression_count: 1200, like_count: 34, retweet_count: 5, reply_count: 2 },
    organic_metrics: { user_profile_clicks: 17 },
  };
  assert.deepEqual(metricValues(base), { impressions: 1200, likes: 34, reposts: 5, replies: 2, profileVisits: 17 });
  const day = metricsSheetHandoff({ ...base, label: "24h" }, "01");
  assert.equal(day.row, 2);
  assert.deepEqual({ H: day.cells.H, I: day.cells.I, J: day.cells.J, K: day.cells.K, L: day.cells.L }, { H: 1200, I: 34, J: 5, K: 2, L: 17 });
  assert.deepEqual({ Q: day.cells.Q, R: day.cells.R, S: day.cells.S, T: day.cells.T, U: day.cells.U }, { Q: 1200, R: 34, S: 5, T: 2, U: 17 });
  assert.ok(Number.isFinite(day.cells.P));
  assert.equal(day.cells.V, undefined);

  const week = metricsSheetHandoff({ ...base, label: "7d", public_metrics: { impression_count: 2400, like_count: 55, retweet_count: 8, reply_count: 3 } }, "01");
  assert.deepEqual({ W: week.cells.W, X: week.cells.X, Y: week.cells.Y, Z: week.cells.Z, AA: week.cells.AA }, { W: 2400, X: 55, Y: 8, Z: 3, AA: 17 });
  assert.ok(Number.isFinite(week.cells.V));
  assert.equal(week.cells.P, undefined);
});

test("Sheets handoffを列ずれのない更新要求へ変換する", () => {
  assert.equal(sheetColumnIndex("A"), 0);
  assert.equal(sheetColumnIndex("Z"), 25);
  assert.equal(sheetColumnIndex("AA"), 26);
  const handoff = metricsSheetHandoff({ collected_at: "2026-08-24T12:00:00Z", post_id: "1", label: "7d", public_metrics: { impression_count: 10, like_count: 2, retweet_count: 1, reply_count: 0 } }, "01");
  const requests = batchRequestsForHandoff(handoff);
  assert.equal(requests[0].updateCells.start.rowIndex, 1);
  assert.equal(requests[0].updateCells.start.columnIndex, 7);
  assert.equal(requests.at(-1).updateCells.start.columnIndex, 25);
  assert.deepEqual(requests[0].updateCells.rows[0].values[0].userEnteredValue, { numberValue: 10 });
});
