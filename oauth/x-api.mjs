import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extname, resolve } from "node:path";
import { SECRET_DIR, TOKEN_FILE } from "./server.mjs";

export const EXPECTED_SCOPES = new Set(["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"]);
export const LOG_FILE = resolve(SECRET_DIR, "post-log.jsonl");
export const ANALYTICS_FILE = resolve(SECRET_DIR, "analytics-log.jsonl");
export const SHEET_HANDOFF_FILE = resolve(SECRET_DIR, "sheet-handoff.jsonl");
export const SHEET_ACK_FILE = resolve(SECRET_DIR, "sheet-handoff-acks.jsonl");
export const PUBLISH_STATE_FILE = resolve(SECRET_DIR, "publication-state.json");
export const SPREADSHEET_ID = "1d3vwBxZP5ng8ni-4m7HjZmUHv-8anG-vhfzFbI1kk1o";
export const POST_LOG_SHEET_ID = 134368518;
const API = "https://api.x.com/2";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const execFileAsync = promisify(execFile);
const KEYCHAIN_SERVICE = "AOBA X Operator";
const KEYCHAIN_CLIENT_ID = "x-oauth-client-id";
const KEYCHAIN_CLIENT_SECRET = "x-oauth-client-secret";
const AUTO_REFRESH_WINDOW_MS = 15 * 60_000;
let refreshInFlight = null;

const MIME = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
]);

export function safeError(data, status) {
  return data?.detail || data?.title || data?.error_description || data?.error || data?.errors?.[0]?.detail || `HTTP ${status}`;
}

export async function loadToken() {
  const info = await stat(TOKEN_FILE);
  if ((info.mode & 0o077) !== 0) throw new Error("トークンファイルの権限が安全ではありません。600に直してください。");
  const token = JSON.parse(await readFile(TOKEN_FILE, "utf8"));
  if (token.account?.username?.toLowerCase() !== "aoba_day") throw new Error("認証先が@aoba_dayではありません。");
  if (!/^\d+$/.test(String(token.account?.id || ""))) throw new Error("認証アカウントIDがありません。OAuth認証をやり直してください。");
  if (!token.access_token || !token.refresh_token) throw new Error("Access TokenまたはRefresh Tokenがありません。");
  const scopes = new Set(String(token.scope || "").split(/\s+/).filter(Boolean));
  for (const scope of EXPECTED_SCOPES) if (!scopes.has(scope)) throw new Error(`必要権限がありません: ${scope}`);
  return token;
}

export function tokenStatus(token, now = Date.now()) {
  const expires = Date.parse(token.expires_at || "");
  return {
    expired: !Number.isFinite(expires) || expires <= now + 30_000,
    expiresAt: Number.isFinite(expires) ? new Date(expires).toISOString() : null,
  };
}

export function tokenNeedsRefresh(token, now = Date.now(), windowMs = AUTO_REFRESH_WINDOW_MS) {
  const expires = Date.parse(token.expires_at || "");
  return !Number.isFinite(expires) || expires <= now + windowMs;
}

async function readKeychain(account) {
  try {
    const { stdout } = await execFileAsync("/usr/bin/security", ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", account, "-w"]);
    return stdout.trim();
  } catch { return ""; }
}

export async function keychainCredentialsConfigured() {
  return Boolean(await readKeychain(KEYCHAIN_CLIENT_ID) && await readKeychain(KEYCHAIN_CLIENT_SECRET));
}

export async function saveClientCredentialsToKeychain({ clientId, clientSecret }) {
  if (!clientId?.trim() || !clientSecret?.trim()) throw new Error("Client IDとClient Secretの両方が必要です。");
  await execFileAsync("/usr/bin/security", ["add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_CLIENT_ID, "-w", clientId.trim()]);
  await execFileAsync("/usr/bin/security", ["add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_CLIENT_SECRET, "-w", clientSecret.trim()]);
}

async function requestJson(url, { accessToken, ...options }) {
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(safeError(data, response.status));
  return data;
}

export function buildRefreshedTokenRecord(current, refreshed, now = new Date()) {
  const { client_id: _clientId, client_secret: _clientSecret, ...safeCurrent } = current;
  const next = {
    ...safeCurrent,
    token_type: refreshed.token_type || current.token_type,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || current.refresh_token,
    scope: refreshed.scope || current.scope,
    obtained_at: now.toISOString(),
    expires_at: refreshed.expires_in ? new Date(now.getTime() + Number(refreshed.expires_in) * 1000).toISOString() : null,
  };
  return next;
}

async function saveTokenRecord(current, refreshed) {
  const next = buildRefreshedTokenRecord(current, refreshed);
  await mkdir(SECRET_DIR, { recursive: true, mode: 0o700 });
  const temporary = `${TOKEN_FILE}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, TOKEN_FILE);
  await chmod(TOKEN_FILE, 0o600);
  return next;
}

async function writePrivateJson(file, value) {
  await mkdir(SECRET_DIR, { recursive: true, mode: 0o700 });
  await chmod(SECRET_DIR, 0o700);
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, file);
  await chmod(file, 0o600);
}

export async function readPublicationState() {
  return readFile(PUBLISH_STATE_FILE, "utf8")
    .then((value) => JSON.parse(value))
    .catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
}

async function savePublicationState(value) {
  const next = { ...value, updated_at: new Date().toISOString() };
  await writePrivateJson(PUBLISH_STATE_FILE, next);
  return next;
}

export async function readPrivateLog(file) {
  const value = await readFile(file, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  return value.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

export async function publicationStatus(launchId) {
  const logs = await readPrivateLog(LOG_FILE);
  const published = [...logs].reverse().find((item) => item.launch_id === launchId && ["published", "published_unverified"].includes(item.status));
  const state = await readPublicationState();
  return { published: published || null, state: state?.launch_id === launchId ? state : null };
}

export function publicationBlocker({ published, state }) {
  if (published) return `この投稿候補は公開済みです: ${published.post_url}`;
  if (state && ["starting", "account_verified", "media_uploaded", "metadata_set", "post_created", "published_unverified", "post_created_unlogged"].includes(state.status)) {
    const detail = state.post_url || state.post_id || state.status;
    return `前回の投稿処理が未解決です。再投稿せず確認してください: ${detail}`;
  }
  return null;
}

export function metricValues(record) {
  const merged = { ...(record.public_metrics || {}), ...(record.non_public_metrics || {}), ...(record.organic_metrics || {}) };
  return {
    impressions: merged.impression_count ?? null,
    likes: merged.like_count ?? null,
    reposts: merged.retweet_count ?? null,
    replies: merged.reply_count ?? null,
    profileVisits: merged.user_profile_clicks ?? merged.profile_clicks ?? null,
  };
}

function sheetsSerial(iso) {
  return Date.parse(iso) / 86_400_000 + 25_569;
}

export function postSheetHandoff(record) {
  const row = Number(record.launch_id) + 1;
  return {
    kind: "post",
    handoff_id: randomUUID(),
    status: "pending",
    created_at: new Date().toISOString(),
    spreadsheet_id: SPREADSHEET_ID,
    sheet_id: POST_LOG_SHEET_ID,
    sheet_name: "投稿ログ",
    launch_id: record.launch_id,
    post_id: record.post_id,
    row,
    cells: { B: record.post_url },
  };
}

export function metricsSheetHandoff(record, launchId) {
  const row = Number(launchId) + 1;
  const values = metricValues(record);
  const cells = { H: values.impressions, I: values.likes, J: values.reposts, K: values.replies, L: values.profileVisits };
  if (record.label === "24h") Object.assign(cells, { P: sheetsSerial(record.collected_at), Q: values.impressions, R: values.likes, S: values.reposts, T: values.replies, U: values.profileVisits });
  if (record.label === "7d") Object.assign(cells, { V: sheetsSerial(record.collected_at), W: values.impressions, X: values.likes, Y: values.reposts, Z: values.replies, AA: values.profileVisits });
  for (const [column, value] of Object.entries(cells)) if (value === null || value === undefined) delete cells[column];
  return {
    kind: "metrics",
    handoff_id: randomUUID(),
    status: "pending",
    created_at: new Date().toISOString(),
    spreadsheet_id: SPREADSHEET_ID,
    sheet_id: POST_LOG_SHEET_ID,
    sheet_name: "投稿ログ",
    launch_id: launchId,
    post_id: record.post_id,
    label: record.label,
    row,
    cells,
  };
}

export async function pendingSheetHandoffs() {
  const handoffs = await readPrivateLog(SHEET_HANDOFF_FILE);
  const acks = await readPrivateLog(SHEET_ACK_FILE);
  const completed = new Set(acks.filter((item) => item.status === "applied").map((item) => item.handoff_id));
  return handoffs.filter((item) => !completed.has(item.handoff_id));
}

export async function acknowledgeSheetHandoff(handoffId, evidence = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(handoffId || "")) throw new Error("handoff_idが正しくありません。");
  const exists = (await readPrivateLog(SHEET_HANDOFF_FILE)).some((item) => item.handoff_id === handoffId);
  if (!exists) throw new Error("対象のSheets連携記録がありません。");
  const record = { handoff_id: handoffId, status: "applied", applied_at: new Date().toISOString(), ...evidence };
  await appendPrivateLog(SHEET_ACK_FILE, record);
  return record;
}

export function sheetColumnIndex(column) {
  if (!/^[A-Z]+$/.test(column || "")) throw new Error(`列名が正しくありません: ${column}`);
  return [...column].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0) - 1;
}

function userEnteredValue(value) {
  if (typeof value === "number") return { numberValue: value };
  if (typeof value === "boolean") return { boolValue: value };
  return { stringValue: String(value) };
}

export function batchRequestsForHandoff(handoff) {
  if (!Number.isInteger(handoff.row) || handoff.row < 1) throw new Error("Sheets行番号が正しくありません。");
  return Object.entries(handoff.cells || {})
    .sort(([left], [right]) => sheetColumnIndex(left) - sheetColumnIndex(right))
    .map(([column, value]) => ({
      updateCells: {
        start: { sheetId: handoff.sheet_id, rowIndex: handoff.row - 1, columnIndex: sheetColumnIndex(column) },
        rows: [{ values: [{ userEnteredValue: userEnteredValue(value) }] }],
        fields: "userEnteredValue",
      },
    }));
}

export async function refreshAccessToken({ clientId, clientSecret } = {}) {
  clientId ||= await readKeychain(KEYCHAIN_CLIENT_ID);
  clientSecret ||= await readKeychain(KEYCHAIN_CLIENT_SECRET);
  if (!clientId?.trim() || !clientSecret?.trim()) throw new Error("Client IDとClient Secretの両方が必要です。");
  const current = await loadToken();
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: current.refresh_token });
  const basic = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`, "utf8").toString("base64");
  const response = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(safeError(data, response.status));
  return saveTokenRecord(current, data);
}

export async function ensureFreshAccessToken() {
  const current = await loadToken();
  if (!tokenNeedsRefresh(current)) return current;
  if (!await keychainCredentialsConfigured()) {
    if (!tokenStatus(current).expired) return current;
    throw new Error("投稿権限が期限切れです。Client ID / Client SecretをMacのキーチェーンへ登録してください。");
  }
  refreshInFlight ||= refreshAccessToken().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function verifyAccount(accessToken) {
  const data = await requestJson(`${API}/users/me?user.fields=username,name`, { accessToken });
  if (data.data?.username?.toLowerCase() !== "aoba_day") throw new Error("X APIで確認したアカウントが@aoba_dayではありません。");
  return data.data;
}

export async function verifyTokenAccount(token) {
  const user = await verifyAccount(token.access_token);
  if (token.account?.id && String(user.id) !== String(token.account.id)) throw new Error("認証アカウントIDが保存時と一致しません。投稿を中止しました。");
  return user;
}

export async function inspectImage(filePath) {
  const absolute = resolve(filePath);
  const info = await stat(absolute);
  const mediaType = MIME.get(extname(absolute).toLowerCase());
  if (!mediaType) throw new Error("画像形式はJPG、PNG、GIF、WEBPだけ使えます。");
  if (!info.isFile() || info.size <= 0) throw new Error("画像ファイルを読み込めません。");
  if (info.size > MAX_IMAGE_BYTES) throw new Error("画像がX APIの5MB上限を超えています。");
  return { absolute, bytes: info.size, mediaType };
}

export async function uploadImage(accessToken, filePath) {
  const image = await inspectImage(filePath);
  const media = (await readFile(image.absolute)).toString("base64");
  const data = await requestJson(`${API}/media/upload`, {
    accessToken,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media, media_category: "tweet_image", media_type: image.mediaType, shared: false }),
  });
  const id = String(data.data?.id || data.media_id_string || "");
  if (!/^\d+$/.test(id)) throw new Error("XからMedia IDが返りませんでした。");
  return { id, mediaKey: data.data?.media_key || null, bytes: image.bytes, mediaType: image.mediaType };
}

export async function setAltText(accessToken, mediaId, alt) {
  if (!alt || alt.length > 1000) throw new Error("ALTは1〜1000文字にしてください。");
  return requestJson(`${API}/media/metadata`, {
    accessToken,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: mediaId, metadata: { alt_text: { text: alt } } }),
  });
}

export async function createPost(accessToken, { text, mediaId }) {
  if (!text?.trim()) throw new Error("投稿本文が空です。");
  const data = await requestJson(`${API}/tweets`, {
    accessToken,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, media: { media_ids: [mediaId] }, made_with_ai: true }),
  });
  if (!data.data?.id) throw new Error("XからPost IDが返りませんでした。");
  return data.data;
}

export async function getPost(accessToken, postId, { includePrivateMetrics = false } = {}) {
  const tweetFields = includePrivateMetrics
    ? "created_at,author_id,public_metrics,non_public_metrics,organic_metrics"
    : "created_at,author_id,public_metrics";
  const query = new URLSearchParams({
    "tweet.fields": tweetFields,
    expansions: "attachments.media_keys",
    "media.fields": "media_key,type,url,preview_image_url,alt_text",
  });
  return requestJson(`${API}/tweets/${encodeURIComponent(postId)}?${query}`, { accessToken });
}

export async function appendPrivateLog(file, record) {
  await mkdir(SECRET_DIR, { recursive: true, mode: 0o700 });
  await chmod(SECRET_DIR, 0o700);
  const previous = await readFile(file, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${previous}${JSON.stringify(record)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, file);
  await chmod(file, 0o600);
}

export async function publishLaunchPost(token, post, imagePath, now = new Date()) {
  const base = { launch_id: post.id, title: post.title, scheduled_at: post.scheduledAt, attempted_at: now.toISOString() };
  let media;
  let created;
  const existing = await publicationStatus(post.id);
  const blocker = publicationBlocker(existing);
  if (blocker) throw new Error(blocker);
  let state = await savePublicationState({ ...base, status: "starting", post_id: null, post_url: null, media_id: null });
  try {
    await verifyTokenAccount(token);
    state = await savePublicationState({ ...state, status: "account_verified" });
    media = await uploadImage(token.access_token, imagePath);
    state = await savePublicationState({ ...state, status: "media_uploaded", media_id: media.id, media_key: media.mediaKey });
    await setAltText(token.access_token, media.id, post.alt);
    state = await savePublicationState({ ...state, status: "metadata_set" });
    created = await createPost(token.access_token, { text: post.text, mediaId: media.id });
    const postUrl = `https://x.com/aoba_day/status/${created.id}`;
    state = await savePublicationState({ ...state, status: "post_created", post_id: created.id, post_url: postUrl });
    let verified = null;
    let verificationError = null;
    try {
      verified = await getPost(token.access_token, created.id);
    } catch (error) {
      verificationError = error.message;
    }
    const record = {
      ...base,
      status: verified?.data?.id === created.id ? "published" : "published_unverified",
      account: "aoba_day",
      post_id: created.id,
      post_url: postUrl,
      text: post.text,
      alt: post.alt,
      image_file: imagePath,
      media_id: media.id,
      media_key: media.mediaKey,
      made_with_ai: true,
      verified_at: verified ? new Date().toISOString() : null,
      verified_author_id: verified?.data?.author_id || null,
      verification_error: verificationError,
    };
    await savePublicationState({ ...state, status: record.status, verification_error: verificationError });
    try {
      await appendPrivateLog(LOG_FILE, record);
      await appendPrivateLog(SHEET_HANDOFF_FILE, postSheetHandoff(record));
      await savePublicationState({ ...state, status: "complete", verification_error: verificationError });
    } catch (error) {
      await savePublicationState({ ...state, status: "post_created_unlogged", log_error: error.message });
      return { ...record, status: "post_created_unlogged", log_error: error.message };
    }
    return record;
  } catch (error) {
    if (created?.id) {
      const postUrl = `https://x.com/aoba_day/status/${created.id}`;
      await savePublicationState({ ...state, status: "post_created_unlogged", post_id: created.id, post_url: postUrl, error: error.message });
      return { ...base, status: "post_created_unlogged", post_id: created.id, post_url: postUrl, media_id: media?.id || null, error: error.message };
    }
    await savePublicationState({ ...state, status: "failed_before_post", media_id: media?.id || null, error: error.message });
    await appendPrivateLog(LOG_FILE, { ...base, status: "failed_before_post", media_id: media?.id || null, error: error.message }).catch(() => {});
    throw error;
  }
}

export async function collectMetrics(token, postId, label = "manual") {
  await verifyTokenAccount(token);
  let result;
  let privateMetricsAvailable = true;
  try {
    result = await getPost(token.access_token, postId, { includePrivateMetrics: true });
  } catch {
    privateMetricsAvailable = false;
    result = await getPost(token.access_token, postId);
  }
  const record = {
    collected_at: new Date().toISOString(),
    label,
    post_id: postId,
    private_metrics_available: privateMetricsAvailable,
    public_metrics: result.data?.public_metrics || null,
    non_public_metrics: result.data?.non_public_metrics || null,
    organic_metrics: result.data?.organic_metrics || null,
  };
  await appendPrivateLog(ANALYTICS_FILE, record);
  const published = (await readPrivateLog(LOG_FILE)).findLast((item) => item.post_id === postId && ["published", "published_unverified"].includes(item.status));
  if (!published?.launch_id) throw new Error("このPost IDに対応する投稿ログがありません。Sheets反映を中止しました。");
  await appendPrivateLog(SHEET_HANDOFF_FILE, metricsSheetHandoff(record, published.launch_id));
  return record;
}
