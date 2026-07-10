import assert from "node:assert/strict";
import handler from "../api/login.js";

process.env.APP_PASSWORD = "test-password";
process.env.SESSION_SECRET = "test-session-secret-with-enough-entropy";

function response() {
  return { statusCode: 200, headers: {}, body: null, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

const denied = response();
await handler({ method: "POST", body: { password: "wrong" } }, denied);
assert.equal(denied.statusCode, 401);
assert.equal(denied.headers["Set-Cookie"], undefined);

const allowed = response();
await handler({ method: "POST", body: { password: "test-password" } }, allowed);
assert.equal(allowed.statusCode, 200);
assert.match(allowed.headers["Set-Cookie"], /HttpOnly; Secure; SameSite=Strict/);
assert.doesNotMatch(allowed.headers["Set-Cookie"], /test-password/);

const logout = response();
await handler({ method: "DELETE" }, logout);
assert.match(logout.headers["Set-Cookie"], /Max-Age=0/);
console.log("Auth tests OK: denied, allowed, logout");
