import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("投稿から検証・ログ・Sheets待ち・24h取得まで一連で完了し、再投稿を拒否する", async (context) => {
  const secretDir = await mkdtemp(join(tmpdir(), "aoba-x-flow-"));
  process.env.AOBA_X_SECRET_DIR = secretDir;
  const originalFetch = globalThis.fetch;
  context.after(async () => {
    globalThis.fetch = originalFetch;
    delete process.env.AOBA_X_SECRET_DIR;
    await rm(secretDir, { recursive: true, force: true });
  });

  const api = await import(`./x-api.mjs?flow=${Date.now()}`);
  const { LAUNCH_POSTS } = await import("./launch-posts.mjs");
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const request = { url: String(url), method: options.method || "GET" };
    calls.push(request);
    if (request.url.includes("/users/me")) return new Response(JSON.stringify({ data: { id: "111", username: "aoba_day", name: "アオバ" } }), { status: 200 });
    if (request.url.endsWith("/media/upload")) return new Response(JSON.stringify({ data: { id: "222", media_key: "3_222" } }), { status: 200 });
    if (request.url.endsWith("/media/metadata")) return new Response(JSON.stringify({ data: { associated_metadata: {} } }), { status: 200 });
    if (request.url.endsWith("/tweets") && request.method === "POST") return new Response(JSON.stringify({ data: { id: "333", text: LAUNCH_POSTS[0].text } }), { status: 201 });
    if (request.url.includes("/tweets/333") && request.url.includes("non_public_metrics")) {
      return new Response(JSON.stringify({ data: { id: "333", author_id: "111", public_metrics: { impression_count: 1200, like_count: 34, retweet_count: 5, reply_count: 2 }, organic_metrics: { user_profile_clicks: 17 } } }), { status: 200 });
    }
    if (request.url.includes("/tweets/333")) return new Response(JSON.stringify({ data: { id: "333", author_id: "111", public_metrics: { impression_count: 1, like_count: 0, retweet_count: 0, reply_count: 0 } } }), { status: 200 });
    return new Response(JSON.stringify({ detail: "unexpected test request" }), { status: 500 });
  };

  const token = { access_token: "test-token", account: { id: "111", username: "aoba_day" } };
  const post = LAUNCH_POSTS[0];
  const imagePath = resolve(new URL(post.image, import.meta.url).pathname);
  const published = await api.publishLaunchPost(token, post, imagePath, new Date("2026-08-17T11:30:00Z"));
  assert.equal(published.status, "published");
  assert.equal(published.post_id, "333");
  assert.deepEqual(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`), [
    "GET /2/users/me",
    "POST /2/media/upload",
    "POST /2/media/metadata",
    "POST /2/tweets",
    "GET /2/tweets/333",
  ]);

  const state = JSON.parse(await readFile(api.PUBLISH_STATE_FILE, "utf8"));
  assert.equal(state.status, "complete");
  assert.equal(state.post_id, "333");
  assert.equal((await stat(api.PUBLISH_STATE_FILE)).mode & 0o077, 0);
  assert.equal((await api.readPrivateLog(api.LOG_FILE)).length, 1);
  assert.equal((await api.pendingSheetHandoffs()).length, 1);

  const callsBeforeRetry = calls.length;
  await assert.rejects(() => api.publishLaunchPost(token, post, imagePath), /公開済み/);
  assert.equal(calls.length, callsBeforeRetry);

  const metrics = await api.collectMetrics(token, "333", "24h");
  assert.equal(metrics.public_metrics.impression_count, 1200);
  const pending = await api.pendingSheetHandoffs();
  assert.equal(pending.length, 2);
  const metricsHandoff = pending.find((item) => item.kind === "metrics");
  assert.deepEqual({ H: metricsHandoff.cells.H, L: metricsHandoff.cells.L, Q: metricsHandoff.cells.Q, U: metricsHandoff.cells.U }, { H: 1200, L: 17, Q: 1200, U: 17 });

  await api.acknowledgeSheetHandoff(pending[0].handoff_id, { verified_by: "integration_test" });
  assert.equal((await api.pendingSheetHandoffs()).length, 1);
  await assert.rejects(() => api.acknowledgeSheetHandoff("00000000-0000-0000-0000-000000000000"), /対象/);
});
