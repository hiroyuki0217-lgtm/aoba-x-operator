import { access, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LAUNCH_POSTS } from "./launch-posts.mjs";
import { EXPECTED_SCOPES, inspectImage, loadToken, pendingSheetHandoffs, readPublicationState, tokenStatus } from "./x-api.mjs";

const oauthDir = dirname(fileURLToPath(import.meta.url));
const checks = [];

function check(name, passed, detail) {
  checks.push({ name, passed: Boolean(passed), detail });
}

try {
  const token = await loadToken();
  const status = tokenStatus(token);
  check("認証アカウント", token.account?.username === "aoba_day", token.account?.username ? `@${token.account.username}` : "なし");
  check("必要scope", [...EXPECTED_SCOPES].every((scope) => String(token.scope).split(/\s+/).includes(scope)), [...EXPECTED_SCOPES].join(" "));
  check("Client認証情報の非保存", !Object.hasOwn(token, "client_id") && !Object.hasOwn(token, "client_secret"), "Client ID / Client Secretなし");
  check("Token期限", !status.expired, status.expiresAt || "不明");
} catch (error) {
  check("OAuth Token", false, error.message);
}

check("v04実験カテゴリ数", LAUNCH_POSTS.length === 4 && new Set(LAUNCH_POSTS.map((post) => post.category)).size === 4, `${LAUNCH_POSTS.length}件`);
for (const post of LAUNCH_POSTS) {
  try {
    const image = await inspectImage(resolve(oauthDir, post.image));
    check(`投稿${post.id}画像`, image.bytes <= 5 * 1024 * 1024, `${Math.round(image.bytes / 1024)}KB ${image.mediaType}`);
    check(`投稿${post.id}本文とALT`, Boolean(post.text && post.alt && post.alt.length <= 1000), `本文${post.text.length}字 ALT${post.alt.length}字`);
    check(`投稿${post.id}検証設計`, Boolean(post.objective && post.hypothesis && post.testVariable), post.category || "なし");
  } catch (error) {
    check(`投稿${post.id}`, false, error.message);
  }
}

for (const file of ["AOBA認証.command", "AOBA投稿.command", "OPERATIONS.md", "sheet-handoff.mjs"]) {
  try {
    await access(resolve(oauthDir, file));
    check(`運用ファイル ${file}`, true, "あり");
  } catch {
    check(`運用ファイル ${file}`, false, "なし");
  }
}

const commandModes = await Promise.all(["AOBA認証.command", "AOBA投稿.command"].map((file) => stat(resolve(oauthDir, file))));
check("Mac起動ファイル実行権限", commandModes.every((info) => (info.mode & 0o111) !== 0), "実行可能");

const operation = await readPublicationState();
const pending = await pendingSheetHandoffs();
check("未解決の投稿処理", !operation || ["complete", "failed_before_post"].includes(operation.status), operation?.status || "なし");
check("Sheets未処理件数", true, `${pending.length}件`);

const failed = checks.filter((item) => !item.passed);
console.log(JSON.stringify({ checked_at: new Date().toISOString(), passed: failed.length === 0, checks, failed_count: failed.length }, null, 2));
if (failed.length) process.exitCode = 1;
