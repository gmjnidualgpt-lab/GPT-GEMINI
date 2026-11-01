import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

test("health endpoint reports service", async () => {
  const response = await worker.fetch(new Request("https://cleaner.test/health"), {
    OAUTH_KV: { get: async () => null, put: async () => {}, delete: async () => {} },
    GOOGLE_CLIENT_ID: "test",
    GOOGLE_CLIENT_SECRET: "test"
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, "photos-cleaner-google-api");
});

test("API rejects requests without a session", async () => {
  const response = await worker.fetch(new Request("https://cleaner.test/api/status"), {
    OAUTH_KV: { get: async () => null, put: async () => {}, delete: async () => {} }
  });
  assert.equal(response.status, 401);
});
