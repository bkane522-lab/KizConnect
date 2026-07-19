// Backend unifié KizConnect — Vercel serverless (CommonJS)
// Env requis : UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

const R_URL = process.env.UPSTASH_REDIS_REST_URL;
const R_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command) {
  const res = await fetch(R_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${R_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  return data.result;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const TYPES = { tickets: "kc:tickets", carpools: "kc:carpools", training: "kc:training" };

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = body.action || req.query.action || "";

    if (action === "list") {
      const key = TYPES[body.type];
      if (!key) return res.status(400).json({ error: "type invalide" });
      const all = await redis(["HGETALL", key]);
      const items = [];
      if (Array.isArray(all)) for (let i = 0; i < all.length; i += 2) {
        try { items.push(JSON.parse(all[i + 1])); } catch (e) {}
      }
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return res.status(200).json({ items });
    }

    if (action === "create") {
      const key = TYPES[body.type];
      if (!key) return res.status(400).json({ error: "type invalide" });
      const id = uid();
      const item = { id, ...body.data, createdAt: Date.now() };
      await redis(["HSET", key, id, JSON.stringify(item)]);
      return res.status(200).json({ item });
    }

    if (action === "delete") {
      const key = TYPES[body.type];
      if (!key) return res.status(400).json({ error: "type invalide" });
      await redis(["HDEL", key, body.id]);
      return res.status(200).json({ ok: true });
    }

    if (action === "saveProfile") {
      const p = body.profile;
      if (!p || !p.userId) return res.status(400).json({ error: "profil invalide" });
      await redis(["HSET", "kc:profiles", p.userId, JSON.stringify(p)]);
      return res.status(200).json({ ok: true });
    }

    if (action === "getProfile") {
      const raw = await redis(["HGET", "kc:profiles", body.userId]);
      return res.status(200).json({ profile: raw ? JSON.parse(raw) : null });
    }

    if (action === "sendMessage") {
      const { from, to, text, fromName } = body;
      if (!from || !to || !text) return res.status(400).json({ error: "champs manquants" });
      const thread = [from, to].sort().join("__");
      const msg = { id: uid(), from, to, text, at: Date.now() };
      await redis(["RPUSH", `kc:msg:${thread}`, JSON.stringify(msg)]);
      await redis(["SADD", `kc:threads:${from}`, thread]);
      await redis(["SADD", `kc:threads:${to}`, thread]);
      return res.status(200).json({ message: msg });
    }

    if (action === "getMessages") {
      const thread = [body.userA, body.userB].sort().join("__");
      const raw = await redis(["LRANGE", `kc:msg:${thread}`, 0, -1]);
      const messages = (raw || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
      return res.status(200).json({ messages });
    }

    if (action === "listThreads") {
      const u = body.userId;
      const threads = (await redis(["SMEMBERS", `kc:threads:${u}`])) || [];
      const result = [];
      for (const t of threads) {
        const last = await redis(["LINDEX", `kc:msg:${t}`, -1]);
        const other = t.split("__").find(x => x !== u);
        const prof = await redis(["HGET", "kc:profiles", other]);
        let lastMsg = null, otherName = null;
        try { lastMsg = JSON.parse(last); } catch (e) {}
        try { otherName = JSON.parse(prof).name; } catch (e) {}
        result.push({ thread: t, other, otherName, last: lastMsg });
      }
      result.sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0));
      return res.status(200).json({ threads: result });
    }

    return res.status(400).json({ error: "action inconnue" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
