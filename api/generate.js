// ND Model Lab prompt engine.
// Sends the page's brief + reference frames to Claude and returns the parsed JSON result.
// Env vars (Vercel > Project > Settings > Environment Variables):
//   ANTHROPIC_API_KEY  required
//   APP_PASSCODE       optional, team passcode required to generate
//   ANTHROPIC_MODEL    optional, defaults to claude-sonnet-5-5

const MAX_IMAGES = 8;
const MAX_PROMPT_CHARS = 200000;

function parseJson(text) {
  if (!text) return null;
  const tryParse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
  let v = tryParse(text.trim());
  if (v) return v;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && (v = tryParse(fence[1].trim()))) return v;
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a >= 0 && b > a && (v = tryParse(text.slice(a, b + 1)))) return v;
  return null;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.ANTHROPIC_API_KEY;
  const pass = process.env.APP_PASSCODE || "";

  if (req.method === "GET") {
    if (!key) return res.status(200).json({ ok: false, code: "no_key" });
    return res.status(200).json({ ok: true, passcode: !!pass });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ code: "method", error: "Use POST" });
  }
  if (pass && req.headers["x-nd-pass"] !== pass) {
    return res.status(401).json({ code: "needs_pass", error: "Passcode required" });
  }
  if (!key) return res.status(500).json({ code: "no_key", error: "ANTHROPIC_API_KEY is not set" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const prompt = body && typeof body.prompt === "string" ? body.prompt : "";
  const images = Array.isArray(body && body.images) ? body.images.filter((x) => typeof x === "string").slice(0, MAX_IMAGES) : [];
  if (!prompt) return res.status(400).json({ code: "invalid_request", error: "Missing prompt" });
  if (prompt.length > MAX_PROMPT_CHARS) return res.status(413).json({ code: "prompt_too_large", error: "Prompt too long" });

  const content = [
    ...images.map((data) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } })),
    { type: "text", text: prompt + "\n\nYour reply is machine-parsed: output only the JSON object, no prose, no code fence." },
  ];

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 8000,
        messages: [{ role: "user", content }],
      }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const code = r.status === 429 || r.status === 529 ? "rate_limited" : r.status === 413 ? "too_large" : "upstream_error";
      return res.status(502).json({ code, error: (j && j.error && j.error.message) || `Anthropic API ${r.status}` });
    }
    if (j && j.stop_reason === "refusal") return res.status(422).json({ code: "refused", error: "Declined" });
    const text = ((j && j.content) || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const data = parseJson(text);
    if (!data) return res.status(502).json({ code: "invalid_json", error: "Could not parse the reply" });
    return res.status(200).json({ data });
  } catch (e) {
    return res.status(502).json({ code: "upstream_error", error: String((e && e.message) || e) });
  }
};
