import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HOST = "127.0.0.1";
export const PORT = 3000;
export const REDIRECT_URI = `http://${HOST}:${PORT}/callback`;
export const SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "media.write",
  "offline.access",
];
export const EXPECTED_USERNAME = "aoba_day";

const OAUTH_DIR = dirname(fileURLToPath(import.meta.url));
export const SECRET_DIR = process.env.AOBA_X_SECRET_DIR ? resolve(process.env.AOBA_X_SECRET_DIR) : join(OAUTH_DIR, ".secrets");
export const TOKEN_FILE = join(SECRET_DIR, "x-oauth.json");
const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const ME_URL = "https://api.x.com/2/users/me?user.fields=username,name";
const MAX_FORM_BYTES = 16_384;

let pending = null;
let busy = false;

export function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

export function createPkce() {
  const verifier = base64url(randomBytes(64));
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authorizationUrl({ clientId, state, challenge }) {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function page(title, body) {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>
:root{color-scheme:light;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;background:#f3f6f8;color:#17212b}
body{margin:0;padding:24px}main{max-width:620px;margin:6vh auto;background:#fff;border-radius:20px;padding:28px;box-shadow:0 12px 40px #17212b18}
h1{font-size:1.55rem;margin:0 0 12px}.lead{line-height:1.75;color:#43515e}.notice{padding:14px 16px;border-radius:12px;background:#eef7f3;line-height:1.65}.warn{background:#fff3e6}
label{display:block;margin:18px 0 6px;font-weight:650}input{box-sizing:border-box;width:100%;font-size:16px;padding:12px;border:1px solid #aeb8c2;border-radius:10px}
button{margin-top:22px;width:100%;border:0;border-radius:12px;padding:14px;background:#111;color:#fff;font-size:16px;font-weight:700;cursor:pointer}.small{font-size:.88rem;color:#66727d;line-height:1.6}code{word-break:break-all}
</style></head><body><main>${body}</main></body></html>`;
}

function sendHtml(res, status, title, body) {
  const html = page(title, body);
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://x.com; base-uri 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(html);
}

export function isAllowedOAuthRequest(headers) {
  const expected = `${HOST}:${PORT}`;
  if (headers.host !== expected) return false;
  if (!headers.origin) return true;
  if (headers.origin === "null") return headers["sec-fetch-site"] === "same-origin";
  try {
    return new URL(headers.origin).origin === `http://${expected}`;
  } catch {
    return false;
  }
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

async function exchangeCode({ code, verifier, clientId, clientSecret }) {
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });
  const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.error_description || data.detail || data.error || `HTTP ${response.status}`;
    throw new Error(`トークン交換に失敗しました: ${detail}`);
  }
  return data;
}

async function getAuthenticatedUser(accessToken) {
  const response = await fetch(ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.data?.username) {
    const detail = data.detail || data.title || `HTTP ${response.status}`;
    throw new Error(`認証アカウントを確認できませんでした: ${detail}`);
  }
  return data.data;
}

async function saveCredentials({ token, user }) {
  await mkdir(SECRET_DIR, { recursive: true, mode: 0o700 });
  await chmod(SECRET_DIR, 0o700);
  const now = new Date();
  const record = {
    provider: "x",
    account: { id: user.id, username: user.username, name: user.name },
    client_credentials_persisted: false,
    token_type: token.token_type,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    scope: token.scope,
    obtained_at: now.toISOString(),
    expires_at: token.expires_in
      ? new Date(now.getTime() + Number(token.expires_in) * 1000).toISOString()
      : null,
  };
  if (!record.refresh_token) throw new Error("Refresh Tokenが返りませんでした。offline.accessの許可を確認してください。");

  const temporary = `${TOKEN_FILE}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, TOKEN_FILE);
  await chmod(TOKEN_FILE, 0o600);
}

async function handler(req, res) {
  if (!isAllowedOAuthRequest(req.headers)) {
    if (process.env.AOBA_OAUTH_DEBUG_HEADERS === "1") {
      console.log(JSON.stringify({
        method: req.method,
        url: req.url,
        host: req.headers.host || null,
        origin: req.headers.origin || null,
        referer: req.headers.referer || null,
        sec_fetch_site: req.headers["sec-fetch-site"] || null,
      }));
    }
    res.writeHead(421, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    return res.end("Local request required");
  }
  const url = new URL(req.url, REDIRECT_URI);

  if (req.method === "GET" && url.pathname === "/") {
    return sendHtml(res, 200, "AOBA X 認証", `
      <h1>AOBA X Operator 認証</h1>
      <p class="lead">X Consoleで控えた2項目を入力します。入力内容はこのMac内の一時メモリだけで処理し、画面やログには表示しません。</p>
      <div class="notice">認証画面では、必ず <strong>@${EXPECTED_USERNAME}</strong> でログインして許可してください。</div>
      <form method="post" action="/start" autocomplete="off">
        <label for="client_id">Client ID</label>
        <input id="client_id" name="client_id" type="text" required spellcheck="false" autocapitalize="none" autocomplete="off">
        <p class="small">手入力せず、X Consoleからコピー＆ペーストしてください（小文字の l と数字の 1 などの取り違えを防ぎます）。</p>
        <label for="client_secret">Client Secret</label>
        <input id="client_secret" name="client_secret" type="password" required spellcheck="false" autocapitalize="none">
        <button type="submit">Xの認証へ進む</button>
      </form>
      <p class="small">必要権限: ${SCOPES.map(escapeHtml).join(" / ")}<br>Callback: <code>${REDIRECT_URI}</code></p>`);
  }

  if (req.method === "POST" && url.pathname === "/start") {
    if (busy && pending?.authorizeUrl && Date.now() - pending.createdAt <= 10 * 60_000) {
      // A fast double-click can send the form twice before the first redirect lands.
      // Reuse the same PKCE request instead of leaving the user on an error page.
      res.writeHead(303, { Location: pending.authorizeUrl, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
      return res.end();
    }
    if (busy) {
      pending = null;
      busy = false;
    }
    const form = await readForm(req);
    const clientId = form.get("client_id")?.trim();
    const clientSecret = form.get("client_secret")?.trim();
    if (!clientId || !clientSecret) return sendHtml(res, 400, "入力不足", "<h1>入力を確認してください</h1><p>Client IDとClient Secretの両方が必要です。</p>");

    const state = base64url(randomBytes(32));
    const { verifier, challenge } = createPkce();
    const authorizeUrl = authorizationUrl({ clientId, state, challenge });
    pending = { state, verifier, clientId, clientSecret, authorizeUrl, createdAt: Date.now() };
    busy = true;
    res.writeHead(303, { Location: authorizeUrl, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/callback") {
    const current = pending;
    pending = null;
    if (!current || url.searchParams.get("state") !== current.state || Date.now() - current.createdAt > 10 * 60_000) {
      busy = false;
      return sendHtml(res, 400, "認証失敗", "<h1>認証を完了できませんでした</h1><p>認証要求が一致しないか、10分以上経過しています。最初からやり直してください。</p>");
    }
    if (url.searchParams.get("error")) {
      busy = false;
      return sendHtml(res, 400, "認証キャンセル", `<h1>認証は保存されていません</h1><p>${escapeHtml(url.searchParams.get("error_description") || url.searchParams.get("error"))}</p>`);
    }
    const code = url.searchParams.get("code");
    if (!code) {
      busy = false;
      return sendHtml(res, 400, "認証失敗", "<h1>認証コードがありません</h1><p>最初からやり直してください。</p>");
    }

    try {
      const token = await exchangeCode({ code, ...current });
      const user = await getAuthenticatedUser(token.access_token);
      if (user.username.toLowerCase() !== EXPECTED_USERNAME) {
        busy = false;
        return sendHtml(res, 409, "アカウント違い", `<h1>保存を中止しました</h1><div class="notice warn">認証されたのは <strong>@${escapeHtml(user.username)}</strong> です。<strong>@${EXPECTED_USERNAME}</strong> ではありません。</div><p>いったんXからログアウトするか、@${EXPECTED_USERNAME}へ切り替えて最初からやり直してください。</p>`);
      }
      await saveCredentials({ token, user });
      busy = false;
      return sendHtml(res, 200, "認証完了", `<h1>認証できました</h1><div class="notice"><strong>@${EXPECTED_USERNAME}</strong> を確認し、Access TokenとRefresh TokenをこのMac内だけに保存しました。</div><p class="lead">この画面は閉じて構いません。秘密情報は画面に表示していません。</p>`);
    } catch (error) {
      busy = false;
      return sendHtml(res, 502, "認証失敗", `<h1>認証を完了できませんでした</h1><div class="notice warn">${escapeHtml(error.message)}</div><p>Client ID / Client SecretとX ConsoleのCallback URIを確認して、最初からやり直してください。</p>`);
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  res.end("Not found");
}

export function startServer() {
  const server = createServer((req, res) => {
    handler(req, res).catch((error) => {
      busy = false;
      if (!res.headersSent) sendHtml(res, 500, "エラー", `<h1>処理できませんでした</h1><p>${escapeHtml(error.message)}</p>`);
      else res.destroy();
    });
  });
  server.listen(PORT, HOST, () => {
    console.log(`AOBA X 認証画面: ${REDIRECT_URI.replace("/callback", "/")}`);
    console.log("秘密情報やトークンはこの画面には表示されません。終了は Control + C です。");
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) startServer();
