import { Router } from "express";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ytdl = require("@distube/ytdl-core");

const router = Router();

function getCookieString(req: import("express").Request): string | undefined {
  const raw = req.headers["x-youtube-cookies"] as string | undefined;
  if (!raw) return undefined;
  try {
    const txt = Buffer.from(raw, "base64").toString("utf-8");
    // Netscape format: domain, flag, path, secure, exp, name, value
    const cookies = txt.split("\n")
      .map(l => l.trim())
      .filter(l => l && !l.startsWith("#"))
      .map(l => l.split("\t"))
      .filter(p => p.length >= 7)
      .map(p => `${p[5]}=${p[6]}`);
    return cookies.join("; ");
  } catch {
    return undefined;
  }
}

// GET /api/stream/info?url=<youtube-url>
router.get("/stream/info", async (req, res) => {
  const url = req.query.url as string | undefined;
  if (!url) { res.status(400).json({ error: "url parameter required" }); return; }

  try {
    const cookie = getCookieString(req);
    const info = await ytdl.getInfo(url, {
      requestOptions: cookie ? { headers: { Cookie: cookie } } : undefined,
    });
    const d = info.videoDetails;
    res.json({
      title:        d.title ?? "Unknown Title",
      artist:       d.author?.name ?? d.ownerChannelName ?? "Unknown Artist",
      duration:     parseInt(String(d.lengthSeconds), 10) || 0,
      thumbnailUrl: d.thumbnails?.at(-1)?.url ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "stream/info failed");
    res.status(500).json({ error: msg.slice(0, 300) });
  }
});

// GET /api/stream/audio?url=<youtube-url>&quality=lowest
// Streams audio directly from YouTube to the client (proxies the stream).
router.get("/stream/audio", async (req, res) => {
  const url     = req.query.url     as string | undefined;
  const quality = (req.query.quality as string) ?? "lowest";

  if (!url) { res.status(400).json({ error: "url parameter required" }); return; }

  try {
    const cookie = getCookieString(req);
    const stream = ytdl(url, {
      quality: quality === "128K" ? "lowest" : quality,
      filter: "audioonly",
      highWaterMark: 1 << 25,
      requestOptions: cookie ? { headers: { Cookie: cookie } } : undefined,
    });

    res.setHeader("Content-Type", "audio/webm");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length");

    stream.pipe(res);
    stream.on("error", () => { if (!res.headersSent) res.status(502).end(); });
    req.on("close", () => stream.destroy());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "stream/audio failed");
    if (!res.headersSent) res.status(500).json({ error: msg.slice(0, 300) });
  }
});

export default router;
