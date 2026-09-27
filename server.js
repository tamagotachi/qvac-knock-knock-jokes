// Knock-Knock Joke Maker - pick a theme or a name, and an AI on YOUR machine (QVAC) invents knock-knock jokes.
// Act-it-out mode reveals the joke one line at a time. Open http://localhost:3094 after starting.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// The QVAC worker can be slow to start on some computers. Wait up to 3 minutes for it.
process.env.QVAC_RPC_INIT_TIMEOUT_MS ??= "180000";
const { loadModel, completion, LLAMA_3_2_1B_INST_Q4_0 } = await import("@qvac/sdk");

const PORT = 3094;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Step 1: load the AI model (downloads the first time, then it's cached) ----
let modelId = null;
const status = { ready: false, message: "Starting...", percent: null, error: null };
async function startModel() {
  try {
    status.message = "Loading the AI model (first run downloads it)...";
    modelId = await loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,
      modelType: "llm",
      onProgress: (p) => { const v = typeof p === "number" ? p : p?.percentage; if (typeof v === "number") status.percent = Math.round(v); },
    });
    status.ready = true; status.message = "AI joke maker ready";
    console.log("Model loaded. Open http://localhost:" + PORT);
  } catch (err) { status.error = String(err?.message || err); console.error("Could not load model:", err); }
}

// One AI job at a time
let chain = Promise.resolve();
const enqueue = (job) => { const p = chain.then(job); chain = p.catch(() => {}); return p; };

function readBody(req, limit = 10000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > limit) { reject(new Error("Too big")); req.destroy(); } });
    req.on("end", () => resolve(data)); req.on("error", reject);
  });
}
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const clean = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);

// QVAC "structured output": each joke has the "who" word and the punchline.
const SCHEMA = { type: "object", properties: { jokes: { type: "array", items: { type: "object", properties: { who: { type: "string" }, punch: { type: "string" } }, required: ["who", "punch"], additionalProperties: false } } }, required: ["jokes"], additionalProperties: false };
const SYSTEM_PROMPT = `You write family-friendly knock-knock jokes for kids. Reply with JSON only.
Write 5 jokes. who: the word or name at the door (1 or 2 words, like "Lettuce"). punch: the punchline, which must be a pun that starts with or uses the who-word's sound (like "Lettuce in, it's cold out here!").
Keep them kind: no insults, nothing scary or rude.`;

// ---- Step 2: the web server ----
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(await readFile(path.join(__dirname, "public", "index.html")));
    }
    if (req.method === "GET" && req.url === "/api/status") return json(res, 200, status);
    if (req.method === "POST" && req.url === "/api/jokes") {
      if (!status.ready) return json(res, 503, { error: "The AI joke maker is not ready yet." });
      const b = JSON.parse(await readBody(req, 20000)), theme = clean(b.theme, 40) || "anything", name = clean(b.name, 30);
      const avoid = (Array.isArray(b.avoid) ? b.avoid : []).map((x) => clean(x, 30)).filter(Boolean).slice(-20);
      const ask = name ? `Make the jokes use the name or word "${name}" at the door if possible (at least one joke must).` : `Theme: ${theme}.` + (avoid.length ? `\nDon't use these words at the door: ${avoid.join(", ")}.` : "");
      const r = await enqueue(async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            // This is the QVAC call that runs the AI on-device
            const run = completion({ modelId, stream: true, history: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: ask }], responseFormat: { type: "json_schema", json_schema: { name: "Jokes", schema: SCHEMA } } });
            let out = "";
            for await (const event of run.events) if (event.type === "contentDelta") out += event.text;
            const seen = new Set();
            // Keep only jokes whose punchline actually plays on the word at the door (the first few letters must appear)
            const list = (JSON.parse(out).jokes || []).map((j) => ({ who: clean(j.who, 30).replace(/[.!?"]+$/g, "").replace(/^["\u201c]/, ""), punch: clean(j.punch, 200) }))
              .filter((j) => j.who && j.punch && j.punch.toLowerCase().includes(j.who.toLowerCase().slice(0, Math.min(4, j.who.length))) && !seen.has(j.who.toLowerCase()) && seen.add(j.who.toLowerCase()));
            if (list.length) return list.slice(0, 6);
          } catch (err) { console.error("Joke attempt failed:", err.message); }
        }
        return null;
      });
      return r ? json(res, 200, r) : json(res, 502, { error: "The AI couldn't make a joke that works. Try again!" });
    }
    res.writeHead(404); res.end("Not found");
  } catch (err) { console.error(err); json(res, 500, { error: String(err?.message || err) }); }
});

// "127.0.0.1" means only YOUR computer can reach this app
server.listen(PORT, "127.0.0.1", () => console.log("Server running at http://localhost:" + PORT));
startModel();
