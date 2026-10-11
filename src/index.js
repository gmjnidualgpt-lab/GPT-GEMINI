const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const configured = (env.CORS_ORIGIN || "").split(",").map(x => x.trim()).filter(Boolean);
  if (!origin || configured.includes("*") || configured.includes(origin)) {
    return {
      "access-control-allow-origin": origin && configured.includes("*") ? "*" : (origin || configured[0] || "null"),
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      "vary": "Origin"
    };
  }
  return {};
}

function authorized(request, env) {
  const expected = env.INTEGRATION_SHARED_SECRET;
  if (!expected || expected.length < 24) return false;
  const supplied = request.headers.get("Authorization") || "";
  return supplied === `Bearer ${expected}`;
}

function safeModel(value, fallback) {
  const model = typeof value === "string" ? value : fallback;
  if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(model || "")) return fallback;
  return model;
}

async function readJsonLimited(request, env) {
  const maxBytes = Math.max(1024, Math.min(Number(env.MAX_REQUEST_BYTES) || 20000, 100000));
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error("BODY_TOO_LARGE");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error("BODY_TOO_LARGE");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("INVALID_JSON");
  }
}

async function callOpenAI({ apiKey, model, system, message }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions: system || "You are a helpful assistant.",
      input: message
    }),
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Do not return upstream response bodies, which can contain sensitive details.
    throw new Error(`OPENAI_UPSTREAM_${response.status}`);
  }
  const text = typeof data.output_text === "string"
    ? data.output_text
    : (data.output || []).flatMap(item => item.content || [])
        .filter(part => part.type === "output_text")
        .map(part => part.text || "")
        .join("\n");
  if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");
  return { text, model: data.model || model, provider: "openai" };
}

async function callGemini({ apiKey, model, system, message }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: { maxOutputTokens: 2048 }
    }),
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GEMINI_UPSTREAM_${response.status}`);
  const text = (data.candidates || [])
    .flatMap(candidate => candidate.content?.parts || [])
    .map(part => part.text || "")
    .join("\n");
  if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
  return { text, model, provider: "gemini" };
}

async function checkSupabase(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { configured: false, reachable: false };
  }
  let base;
  try {
    base = new URL(env.SUPABASE_URL);
    if (base.protocol !== "https:") return { configured: true, reachable: false, reason: "HTTPS_REQUIRED" };
  } catch {
    return { configured: true, reachable: false, reason: "INVALID_URL" };
  }
  try {
    const response = await fetch(new URL("/auth/v1/health", base), {
      headers: { apikey: env.SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(8000)
    });
    return { configured: true, reachable: response.ok, status: response.status };
  } catch {
    return { configured: true, reachable: false, reason: "NETWORK_ERROR" };
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const origin = request.headers.get("Origin");
    const allowed = !origin || (env.CORS_ORIGIN || "").split(",").map(x => x.trim()).includes("*")
      || (env.CORS_ORIGIN || "").split(",").map(x => x.trim()).includes(origin);

    if (request.method === "OPTIONS") {
      if (!allowed) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "triadbridge-worker",
        configuration: {
          sharedSecret: Boolean(env.INTEGRATION_SHARED_SECRET && env.INTEGRATION_SHARED_SECRET.length >= 24),
          openai: Boolean(env.OPENAI_API_KEY),
          gemini: Boolean(env.GEMINI_API_KEY),
          supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY)
        },
        note: "Configuration status only. Provider APIs have not been tested by this endpoint."
      }, 200, cors);
    }

    if (!allowed) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
    if (request.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405, { ...cors, allow: "GET, POST, OPTIONS" });
    }

    if (!authorized(request, env)) {
      return json({ error: "UNAUTHORIZED" }, 401, cors);
    }

    if (url.pathname === "/api/supabase-check") {
      const result = await checkSupabase(env);
      return json({ ok: result.reachable, supabase: result }, result.reachable ? 200 : 502, cors);
    }

    if (url.pathname !== "/api/chat") {
      return json({ error: "NOT_FOUND" }, 404, cors);
    }

    let body;
    try {
      body = await readJsonLimited(request, env);
    } catch (error) {
      const code = error.message === "BODY_TOO_LARGE" ? 413 : 400;
      return json({ error: error.message }, code, cors);
    }

    const provider = body?.provider;
    const message = body?.message;
    const system = typeof body?.system === "string" ? body.system.slice(0, 4000) : "";
    if (!["openai", "gemini"].includes(provider)) {
      return json({ error: "INVALID_PROVIDER", allowed: ["openai", "gemini"] }, 400, cors);
    }
    if (typeof message !== "string" || !message.trim() || message.length > 12000) {
      return json({ error: "INVALID_MESSAGE" }, 400, cors);
    }

    try {
      const result = provider === "openai"
        ? (env.OPENAI_API_KEY
            ? await callOpenAI({
                apiKey: env.OPENAI_API_KEY,
                model: safeModel(body.model, env.OPENAI_MODEL || "gpt-4.1-mini"),
                system,
                message: message.trim()
              })
            : (() => { throw new Error("OPENAI_NOT_CONFIGURED"); })())
        : (env.GEMINI_API_KEY
            ? await callGemini({
                apiKey: env.GEMINI_API_KEY,
                model: safeModel(body.model, env.GEMINI_MODEL || "gemini-2.5-flash"),
                system,
                message: message.trim()
              })
            : (() => { throw new Error("GEMINI_NOT_CONFIGURED"); })());

      return json({ ok: true, ...result }, 200, cors);
    } catch (error) {
      const known = new Set([
        "OPENAI_NOT_CONFIGURED", "GEMINI_NOT_CONFIGURED",
        "OPENAI_EMPTY_RESPONSE", "GEMINI_EMPTY_RESPONSE"
      ]);
      const message = String(error?.message || "");
      const upstream = /^(OPENAI|GEMINI)_UPSTREAM_\d+$/.test(message);
      const status = message.endsWith("_NOT_CONFIGURED") ? 503 : upstream ? 502 : 502;
      return json({
        ok: false,
        error: known.has(message) || upstream ? message : "UPSTREAM_REQUEST_FAILED"
      }, status, cors);
    }
  }
};
