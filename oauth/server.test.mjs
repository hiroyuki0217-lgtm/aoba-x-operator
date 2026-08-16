import test from "node:test";
import assert from "node:assert/strict";
import { authorizationUrl, createPkce, isAllowedOAuthRequest, REDIRECT_URI, SCOPES } from "./server.mjs";

test("PKCEはS256用の十分に長い値を作る", () => {
  const first = createPkce();
  const second = createPkce();
  assert.match(first.verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.match(first.challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.verifier, second.verifier);
});

test("認証URLは固定Callbackと必要scopeだけを含む", () => {
  const url = new URL(authorizationUrl({ clientId: "client-test", state: "state-test", challenge: "challenge-test" }));
  assert.equal(url.origin, "https://x.com");
  assert.equal(url.pathname, "/i/oauth2/authorize");
  assert.equal(url.searchParams.get("redirect_uri"), REDIRECT_URI);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.deepEqual(url.searchParams.get("scope").split(" "), SCOPES);
  assert.equal(url.searchParams.get("client_secret"), null);
});

test("OAuth入力画面は127.0.0.1以外からの要求を拒否する", () => {
  assert.equal(isAllowedOAuthRequest({ host: "127.0.0.1:3000" }), true);
  assert.equal(isAllowedOAuthRequest({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }), true);
  assert.equal(isAllowedOAuthRequest({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000/" }), true);
  assert.equal(isAllowedOAuthRequest({ host: "127.0.0.1:3000", origin: "null", "sec-fetch-site": "same-origin" }), true);
  assert.equal(isAllowedOAuthRequest({ host: "127.0.0.1:3000", origin: "null", "sec-fetch-site": "cross-site" }), false);
  assert.equal(isAllowedOAuthRequest({ host: "localhost:3000" }), false);
  assert.equal(isAllowedOAuthRequest({ host: "127.0.0.1:3000", origin: "https://attacker.example" }), false);
});
