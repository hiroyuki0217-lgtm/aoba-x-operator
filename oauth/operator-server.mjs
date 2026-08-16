import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LAUNCH_POSTS } from "./launch-posts.mjs";
import { collectMetrics, ensureFreshAccessToken, inspectImage, keychainCredentialsConfigured, loadToken, LOG_FILE, pendingSheetHandoffs, publishLaunchPost, readPrivateLog, readPublicationState, refreshAccessToken, saveClientCredentialsToKeychain, tokenStatus, verifyTokenAccount } from "./x-api.mjs";

export const OPERATOR_HOST = "127.0.0.1";
export const OPERATOR_PORT = 3001;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_FORM_BYTES = 16_384;
const STATIC_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
]);
let approval = null;
let publishing = false;
const EARLY_TEST_MODE = process.env.AOBA_ALLOW_EARLY_TEST === "1";

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function page(title, body) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
  :root{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;color:#17212b;background:#eef2f4}body{margin:0;padding:18px}main{max-width:720px;margin:2vh auto}.card{background:#fff;border-radius:20px;padding:24px;margin:0 0 16px;box-shadow:0 10px 35px #17212b12}h1{font-size:1.6rem;margin:0 0 8px}h2{font-size:1.2rem}.lead,.small{line-height:1.7;color:#53616d}.small{font-size:.88rem}.ok,.warn{padding:14px 16px;border-radius:12px;background:#eaf7f0;line-height:1.6}.warn{background:#fff1e4}.image{width:100%;border-radius:14px;display:block}label{display:block;margin:14px 0 6px;font-weight:700}input[type=text],input[type=password],select,textarea{box-sizing:border-box;width:100%;font:inherit;font-size:16px;padding:12px;border:1px solid #adb7c0;border-radius:10px;background:#fff;color:#17212b}textarea{resize:vertical;line-height:1.65;min-height:9em}.alt-edit{min-height:11em}button{box-sizing:border-box;width:100%;margin-top:14px;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:750;background:#101820;color:#fff;cursor:pointer}.secondary{background:#e7ecef;color:#17212b}.danger{background:#b42318}.meta{display:grid;grid-template-columns:8em 1fr;gap:8px 12px;line-height:1.5}.meta dt{color:#66727d}.meta dd{margin:0;word-break:break-word}.check{display:flex;gap:10px;align-items:flex-start;line-height:1.5;margin-top:16px}.check input{margin-top:4px}.deadline{font-weight:700}.disabled{opacity:.55;pointer-events:none}
  </style></head><body><main>${body}</main></body></html>`;
}

function sendHtml(res, status, title, body) {
  const html = page(title, body);
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(html), "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
  res.end(html);
}

function sendJson(res, status, value) {
  const body = `${JSON.stringify(value)}\n`;
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(body);
}

export function localAppFile(pathname) {
  if (pathname === "/app" || pathname === "/app/") return resolve(ROOT, "index.html");
  if (!pathname.startsWith("/app/")) return null;
  const relative = pathname.slice(5);
  if (!/^(?:app\.js|style\.css|operator\.css|manifest\.webmanifest|icon\.svg|data\/[a-z0-9._/-]+|assets\/[a-z0-9._/-]+)$/i.test(relative)) return null;
  const absolute = resolve(ROOT, relative);
  return absolute.startsWith(`${ROOT}/`) ? absolute : null;
}

async function sendLocalApp(res, pathname) {
  const file = localAppFile(pathname);
  if (!file) return false;
  try {
    const body = await readFile(file);
    const type = file.endsWith(".webmanifest") ? "application/manifest+json; charset=utf-8" : STATIC_TYPES.get(extname(file)) || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Content-Length": body.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
    res.end(body);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end("Not found");
  }
  return true;
}

async function readForm(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_FORM_BYTES) throw new Error("入力が大きすぎます。");
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function imagePath(post) {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), post.image);
  if (!path.startsWith(`${ROOT}/assets/aoba/`)) throw new Error("画像パスが許可範囲外です。");
  return path;
}

function scheduleLabel(post) {
  return post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
    : "日時固定なし・本人承認後";
}

async function postSelect(token, message = "") {
  const status = tokenStatus(token);
  const logs = await readPrivateLog(LOG_FILE);
  const operation = await readPublicationState();
  const pendingSheets = await pendingSheetHandoffs();
  const rows = LAUNCH_POSTS.map((post) => {
    const published = [...logs].reverse().find((item) => item.launch_id === post.id && ["published", "published_unverified"].includes(item.status));
    const unresolved = operation?.launch_id === post.id && !["complete", "failed_before_post"].includes(operation.status);
    const stateLabel = published ? "公開済み" : unresolved ? "処理要確認" : canRequestPublication(post, Date.now(), EARLY_TEST_MODE) ? (isDue(post) ? "公開確認待ち" : "前倒しテスト可") : "予定前";
    return `<option value="${post.id}">${post.id}｜${esc(post.category || post.pillar)}｜${esc(post.title)}｜${stateLabel}｜${esc(scheduleLabel(post))}</option>`;
  }).join("");
  const recovery = operation && !["complete", "failed_before_post"].includes(operation.status)
    ? `<div class="warn"><strong>前回の投稿処理を確認してください。</strong><br>状態: ${esc(operation.status)}${operation.post_url ? `<br><a href="${esc(operation.post_url)}">作成済みの可能性がある投稿を開く</a>` : ""}<br>確認が済むまで同じ投稿候補は再投稿できません。</div>`
    : "";
  return `<section class="card"><h1>AOBA X Operator</h1><p class="lead">Mac内だけで、画像付き投稿を最終確認して公開します。</p>${message}${recovery}<dl class="meta"><dt>投稿先</dt><dd><strong>@aoba_day</strong></dd><dt>権限期限</dt><dd>${esc(status.expiresAt ? new Date(status.expiresAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "不明")} ${status.expired ? "（更新が必要）" : ""}</dd><dt>Sheets連携</dt><dd>${pendingSheets.length ? `${pendingSheets.length}件が反映待ち` : "未処理なし"}</dd><dt>秘密情報</dt><dd>画面・ログ・GitHub・Driveに表示しません</dd></dl><p><a href="/app/">あおばWEBアプリへ戻る</a></p></section><section class="card"><h2>投稿を選ぶ</h2><form method="get" action="/preview"><label for="post_id">投稿候補</label><select id="post_id" name="post_id">${rows}</select><button type="submit">内容を確認する</button></form></section><section class="card"><h2>反応を取得する</h2><form method="post" action="/metrics"><label for="metric_post_id">Post ID</label><input id="metric_post_id" name="post_id" inputmode="numeric" pattern="[0-9]+" required><label for="metric_label">記録時点</label><select id="metric_label" name="label"><option value="24h">24時間後</option><option value="7d">7日後</option><option value="manual">手動確認</option></select><button class="secondary" type="submit">Xから数値を取得する</button></form></section>`;
}

function refreshForm(message = "") {
  return `<section class="card"><h1>投稿権限の自動更新を設定</h1>${message}<p class="lead">X Developer Consoleの対象アプリで <strong>Keys and tokens → OAuth 2.0 Client ID and Client Secret</strong> を開き、同じ名前の欄へ貼り付けてください。</p><div class="warn"><strong>貼らないもの</strong><br>API Key／API Key Secret／Bearer Token／Access Tokenではありません。</div><form method="post" action="/refresh" autocomplete="off"><label for="client_id">1．Client IDをここへ貼る</label><input id="client_id" name="client_id" required autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="X Consoleの Client ID"><label for="client_secret">2．Client Secretをここへ貼る</label><input id="client_secret" name="client_secret" type="password" required autocomplete="off" placeholder="X Consoleの Client Secret"><label class="check"><input type="checkbox" name="remember" value="yes" checked><span>3．Macのキーチェーンに保存して自動更新する</span></label><button type="submit">4．安全に更新する</button></form><p class="small">入力値はチャット、Drive、GitHub、Sheetsへ送りません。設定後は値を書かずに「更新完了」とだけ伝えてください。</p></section>`;
}

function approvalMatches(nonce) {
  if (!approval || Date.now() - approval.createdAt > 10 * 60_000) return false;
  const a = Buffer.from(String(nonce || ""));
  const b = Buffer.from(approval.nonce);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isDue(post, now = Date.now()) {
  return !post.scheduledAt || now >= Date.parse(post.scheduledAt);
}

export function canRequestPublication(post, now = Date.now(), allowEarlyTest = false) {
  return isDue(post, now) || allowEarlyTest;
}

export function applyPostEdits(post, text, alt) {
  const editedText = String(text ?? "").trim();
  const editedAlt = String(alt ?? "").trim();
  if (!editedText) throw new Error("本文を入力してください。");
  if (Array.from(editedText).length > 280) throw new Error("本文は280文字以内にしてください。");
  if (!editedAlt) throw new Error("ALTを入力してください。");
  if (Array.from(editedAlt).length > 1000) throw new Error("ALTは1000文字以内にしてください。");
  return { ...post, text: editedText, alt: editedAlt };
}

export function isAllowedLocalRequest(headers) {
  const expected = `${OPERATOR_HOST}:${OPERATOR_PORT}`;
  if (headers.host !== expected) return false;
  if (!headers.origin) return true;
  if (headers.origin === "null") return headers["sec-fetch-site"] === "same-origin";
  try {
    return new URL(headers.origin).origin === `http://${expected}`;
  } catch {
    return false;
  }
}

async function handler(req, res) {
  if (!isAllowedLocalRequest(req.headers)) {
    res.writeHead(421, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    return res.end("Local request required");
  }
  const url = new URL(req.url, `http://${OPERATOR_HOST}:${OPERATOR_PORT}`);

  if (req.method === "GET" && await sendLocalApp(res, url.pathname)) return;

  if (req.method === "GET" && url.pathname === "/api/status") {
    try {
      const token = await ensureFreshAccessToken();
      const status = tokenStatus(token);
      const operation = await readPublicationState();
      const pendingSheets = await pendingSheetHandoffs();
      return sendJson(res, 200, {
        connected: true,
        account: `@${token.account.username}`,
        expired: status.expired,
        expiresAt: status.expiresAt,
        pendingSheets: pendingSheets.length,
        operation: operation && !["complete", "failed_before_post"].includes(operation.status) ? operation.status : null,
        publishing,
        autoRefresh: await keychainCredentialsConfigured(),
      });
    } catch (error) {
      return sendJson(res, 503, { connected: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/") {
    const token = await ensureFreshAccessToken();
    return sendHtml(res, 200, "AOBA X Operator", tokenStatus(token).expired ? refreshForm('<div class="warn">Access Tokenの期限が切れています。公開や数値取得の前に更新してください。</div>') : await postSelect(token, '<div class="ok">@aoba_dayの認証情報を安全に読み込みました。</div>'));
  }

  if (req.method === "GET" && url.pathname === "/refresh") {
    return sendHtml(res, 200, "投稿権限の自動更新を設定", refreshForm());
  }

  if (req.method === "GET" && url.pathname === "/image") {
    const post = LAUNCH_POSTS.find((item) => item.id === url.searchParams.get("id"));
    if (!post) { res.writeHead(404); return res.end(); }
    const path = imagePath(post);
    const image = await inspectImage(path);
    const bytes = await readFile(path);
    res.writeHead(200, { "Content-Type": image.mediaType, "Content-Length": bytes.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    return res.end(bytes);
  }

  if (req.method === "POST" && url.pathname === "/refresh") {
    const form = await readForm(req);
    try {
      const token = await refreshAccessToken({ clientId: form.get("client_id"), clientSecret: form.get("client_secret") });
      await verifyTokenAccount(token);
      const remembered = form.get("remember") === "yes";
      if (remembered) await saveClientCredentialsToKeychain({ clientId: form.get("client_id"), clientSecret: form.get("client_secret") });
      const message = remembered
        ? '<div class="ok">@aoba_dayの投稿権限を更新し、Client ID / Client SecretをMacのキーチェーンへ保存しました。</div>'
        : '<div class="ok">@aoba_dayの投稿権限を更新しました。Client ID / Client Secretは保存していません。</div>';
      return sendHtml(res, 200, "更新完了", await postSelect(token, message));
    } catch (error) {
      return sendHtml(res, 502, "更新失敗", refreshForm(`<div class="warn">更新できませんでした: ${esc(error.message)}</div>`));
    }
  }

  if (["GET", "POST"].includes(req.method) && url.pathname === "/preview") {
    const form = req.method === "POST" ? await readForm(req) : url.searchParams;
    const post = LAUNCH_POSTS.find((item) => item.id === form.get("post_id"));
    if (!post) return sendHtml(res, 400, "選択エラー", '<section class="card"><h1>投稿を選び直してください</h1></section>');
    const token = await ensureFreshAccessToken();
    if (tokenStatus(token).expired) return sendHtml(res, 401, "更新が必要", refreshForm('<div class="warn">公開前に投稿権限の更新が必要です。</div>'));
    await verifyTokenAccount(token);
    const image = await inspectImage(imagePath(post));
    const due = isDue(post);
    const earlyTest = !due && EARLY_TEST_MODE;
    const canPublish = canRequestPublication(post, Date.now(), EARLY_TEST_MODE);
    approval = canPublish ? { nonce: randomBytes(32).toString("base64url"), postId: post.id, createdAt: Date.now(), earlyTest } : null;
    const editableFields = `<label for="post_text">本文（ここで編集できます）</label><textarea id="post_text" name="text" maxlength="280" required>${esc(post.text)}</textarea><p class="small">空欄不可・280文字以内。改行もそのまま投稿されます。</p><label for="post_alt">ALT（ここで編集できます）</label><textarea class="alt-edit" id="post_alt" name="alt" maxlength="1000" required>${esc(post.alt)}</textarea><p class="small">画像の内容を説明する文章です。空欄不可・1000文字以内。</p>`;
    const publishControls = canPublish
      ? `<form method="post" action="/publish"><input type="hidden" name="nonce" value="${approval.nonce}">${editableFields}<label class="check"><input type="checkbox" name="confirmed" value="yes" required><span>編集後の本文・ALT、画像、投稿先を確認し、この内容を実際に公開します。</span></label><label for="phrase">確認のため「投稿する」と入力</label><input id="phrase" name="phrase" type="text" required autocomplete="off"><button class="danger" type="submit">@aoba_dayへ公開する</button></form>`
      : `${editableFields}<div class="warn"><strong>予定時刻前のため、公開ボタンを止めています。</strong><br>編集内容はまだ保存されません。予定時刻以降にもう一度この画面を開いてください。</div>`;
    return sendHtml(res, 200, "最終確認", `<section class="card"><h1>公開前の最終確認</h1><div class="warn"><strong>${earlyTest ? "前倒しの実投稿テストです。この次のボタンで実際にXへ公開されます。" : due ? "編集後、この画面の公開ボタンで実際にXへ投稿されます。" : "いまは内容確認だけできます。"}</strong><br>投稿後は自動では削除できません。</div><dl class="meta"><dt>投稿先</dt><dd><strong>@aoba_day</strong></dd><dt>公開条件</dt><dd class="deadline">${esc(scheduleLabel(post))}${earlyTest ? "（前倒しテスト）" : due ? "" : "（まだ予定時刻前です）"}</dd><dt>カテゴリ</dt><dd>${esc(post.category || post.pillar)}</dd><dt>テーマ</dt><dd>${esc(post.pillar)}／${esc(post.title)}</dd><dt>目的</dt><dd>${esc(post.objective || "未設定")}</dd><dt>検証変数</dt><dd>${esc(post.testVariable || "未設定")}</dd><dt>画像</dt><dd>${Math.round(image.bytes / 1024)}KB・${esc(image.mediaType)}</dd><dt>AI表示</dt><dd>made_with_ai: true</dd></dl></section><section class="card"><img class="image" src="/image?id=${post.id}" alt="${esc(post.alt)}">${publishControls}<form method="get" action="/"><button class="secondary" type="submit">戻る</button></form></section>`);
  }

  if (req.method === "POST" && url.pathname === "/publish") {
    const form = await readForm(req);
    if (publishing) return sendHtml(res, 409, "処理中", '<section class="card"><h1>投稿処理中です</h1><p>二重投稿を防ぐため、そのままお待ちください。</p></section>');
    if (!approvalMatches(form.get("nonce")) || form.get("confirmed") !== "yes" || form.get("phrase")?.trim() !== "投稿する") {
      approval = null;
      return sendHtml(res, 400, "確認不足", '<section class="card"><h1>公開しませんでした</h1><p>確認内容が一致しません。最初からやり直してください。</p><form method="get" action="/"><button type="submit">戻る</button></form></section>');
    }
    const current = approval;
    approval = null;
    publishing = true;
    try {
      const basePost = LAUNCH_POSTS.find((item) => item.id === current.postId);
      const post = applyPostEdits(basePost, form.get("text"), form.get("alt"));
      const token = await ensureFreshAccessToken();
      if (tokenStatus(token).expired) throw new Error("Access Tokenの期限が切れました。更新してからやり直してください。");
      const record = await publishLaunchPost(token, post, imagePath(post));
      const verified = record.status === "published";
      return sendHtml(res, 200, "投稿完了", `<section class="card"><h1>${verified ? "投稿を確認できました" : "投稿は作成されました"}</h1><div class="${verified ? "ok" : "warn"}"><strong>@aoba_day</strong>への画像付き投稿を作成しました。${verified ? "X APIでの読み戻しも完了しています。" : "読み戻しだけ失敗したため、下のリンクで実体を確認してください。再投稿はしないでください。"}</div><dl class="meta"><dt>Post ID</dt><dd>${esc(record.post_id)}</dd><dt>確認時刻</dt><dd>${esc(record.verified_at || "未確認")}</dd><dt>記録</dt><dd>Mac内の非公開ログへ保存済み</dd></dl><p><a href="${esc(record.post_url)}">Xで投稿を開く</a></p><form method="get" action="/"><button class="secondary" type="submit">一覧へ戻る</button></form></section>`);
    } catch (error) {
      return sendHtml(res, 502, "投稿失敗", `<section class="card"><h1>投稿を完了できませんでした</h1><div class="warn">${esc(error.message)}</div><p>二重投稿を避けるため、Xのプロフィールを確認してからやり直してください。</p><form method="get" action="/"><button type="submit">戻る</button></form></section>`);
    } finally {
      publishing = false;
    }
  }

  if (req.method === "POST" && url.pathname === "/metrics") {
    const form = await readForm(req);
    const postId = form.get("post_id")?.trim();
    if (!/^\d+$/.test(postId || "")) return sendHtml(res, 400, "入力エラー", '<section class="card"><h1>Post IDを確認してください</h1></section>');
    const token = await ensureFreshAccessToken();
    if (tokenStatus(token).expired) return sendHtml(res, 401, "更新が必要", refreshForm('<div class="warn">数値取得の前に投稿権限の更新が必要です。</div>'));
    try {
      const metrics = await collectMetrics(token, postId, form.get("label") || "manual");
      const values = metrics.organic_metrics || metrics.non_public_metrics || metrics.public_metrics || {};
      return sendHtml(res, 200, "取得完了", `<section class="card"><h1>反応を取得しました</h1><div class="ok">X APIから読み取り、Mac内の非公開ログへ保存しました。</div><dl class="meta">${Object.entries(values).map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join("")}</dl><form method="get" action="/"><button class="secondary" type="submit">戻る</button></form></section>`);
    } catch (error) {
      return sendHtml(res, 502, "取得失敗", `<section class="card"><h1>反応を取得できませんでした</h1><div class="warn">${esc(error.message)}</div></section>`);
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  res.end("Not found");
}

export function startOperatorServer() {
  const server = createServer((req, res) => handler(req, res).catch((error) => {
    if (!res.headersSent) sendHtml(res, 500, "エラー", `<section class="card"><h1>処理できませんでした</h1><div class="warn">${esc(error.message)}</div></section>`);
    else res.destroy();
  }));
  server.listen(OPERATOR_PORT, OPERATOR_HOST, () => console.log(`AOBA X Operator: http://${OPERATOR_HOST}:${OPERATOR_PORT}/`));
  const timer = setInterval(() => ensureFreshAccessToken().catch(() => {}), 30 * 60_000);
  timer.unref();
  ensureFreshAccessToken().catch(() => {});
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) startOperatorServer();
