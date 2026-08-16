import { ensureFreshAccessToken, keychainCredentialsConfigured, tokenStatus } from "./x-api.mjs";

try {
  const configured = await keychainCredentialsConfigured();
  const token = await ensureFreshAccessToken();
  const status = tokenStatus(token);
  console.log(JSON.stringify({
    passed: !status.expired,
    account: `@${token.account.username}`,
    auto_refresh: configured,
    expires_at: status.expiresAt,
  }, null, 2));
  if (status.expired) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ passed: false, error: error.message }, null, 2));
  process.exitCode = 1;
}
