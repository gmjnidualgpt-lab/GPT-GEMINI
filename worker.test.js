import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const env = {
  INTEGRATION_SHARED_SECRET: "a-secure-test-secret-that-is-long-enough",
  CORS_ORIGIN: "http://localhost:3000",
  MAX_REQUEST_BYTES: "20000"
};

function req(path, { method = "GET", body, headers = {} } = {}) {
  return new Request(`https://example.test${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers
    },
    ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {})
  });
}

test("health reports service and configuration without claiming provider connectivity", async () => {
  const response = await worker.fetch(req("/health"), env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.match(data.note, /have not been tested/);
});

test("chat requires authentication", async () => {
  const response = await worker.fetch(req("/api/chat", {
    method: "POST",
    body: { provider: "openai", message: "hello" }
  }), env);
  assert.equal(response.status, 401);
});

test("chat rejects unsupported provider", async () => {
  const response = await worker.fetch(req("/api/chat", {
    method: "POST",
    body: { provider: "unknown", message: "hello" },
    headers: { authorization: `Bearer ${env.INTEGRATION_SHARED_SECRET}` }
  }), env);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_PROVIDER");
});

test("chat rejects empty message", async () => {
  const response = await worker.fetch(req("/api/chat", {
    method: "POST",
    body: { provider: "openai", message: " " },
    headers: { authorization: `Bearer ${env.INTEGRATION_SHARED_SECRET}` }
  }), env);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_MESSAGE");
});

test("chat reports missing provider key without making a network call", async () => {
  const response = await worker.fetch(req("/api/chat", {
    method: "POST",
    body: { provider: "openai", message: "hello" },
    headers: { authorization: `Bearer ${env.INTEGRATION_SHARED_SECRET}` }
  }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "OPENAI_NOT_CONFIGURED");
});

test("unknown paths return 404", async () => {
  const response = await worker.fetch(req("/missing", {
    method: "POST",
    body: {},
    headers: { authorization: `Bearer ${env.INTEGRATION_SHARED_SECRET}` }
  }), env);
  assert.equal(response.status, 404);
});

test("disallowed browser origin is rejected", async () => {
  const response = await worker.fetch(req("/api/chat", {
    method: "POST",
    body: { provider: "openai", message: "hello" },
    headers: {
      authorization: `Bearer ${env.INTEGRATION_SHARED_SECRET}`,
      origin: "https://not-allowed.example"
    }
  }), env);
  assert.equal(response.status, 403);
});
