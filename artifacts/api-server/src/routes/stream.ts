import { Router } from "express";
import ytdl from "@distube/ytdl-core";

const router = Router();

// GET /api/stream/info?url=<youtube-url>
router.get("/stream/info", async (req, res) => {
  const url = req.query.url as string | undefined;
  if (!url) { res.status(400).json({ error: "url parameter required" }); return; }

  try {
    const raw = req.headers["x-youtube-cookies"] as string | undefined;
    const opts: any = {};
    if (raw) {
      const txt = Buffer.from(raw, "base64").toString("utf-8");
      const cookies = txt.split("\n")
        .map(l => l.trim())
        .filter(l => l && !l.startsWith("#"))
        .map(l => l.split("\t"))
        .filter(p => p.length >= 7)
        .map(p => ({
          name: p[5],
          value: p[6],
          domain: p[0],
          path: p[2],
          secure: p[3] === "TRUE",
          httpOnly: p[1] !== "TRUE",
          hostOnly: false,
          expirationDate: parseInt(p[4], 10) || undefined,
        }));
      opts.agent = ytdl.createAgent(cookies);
    }
    const info = await ytdl.getInfo(url, opts);
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
router.get("/stream/audio", async (req, res) => {
  const url     = req.query.url     as string | undefined;
  const quality = (req.query.quality as string) ?? "lowest";

  if (!url) { res.status(400).json({ error: "url parameter required" }); return; }

  try {
    const raw = req.headers["x-youtube-cookies"] as string | undefined;
    const opts: any = {
      quality: quality === "128K" ? "lowest" : quality,
      filter: "audioonly",
      highWaterMark: 1 << 25,
    };
    if (raw) {
      const txt = Buffer.from(raw, "base64").toString("utf-8");
      const cookies = txt.split("\n")
        .map(l => l.trim())
        .filter(l => l && !l.startsWith("#"))
        .map(l => l.split("\t"))
        .filter(p => p.length >= 7)
        .map(p => ({
          name: p[5],
          value: p[6],
          domain: p[0],
          path: p[2],
          secure: p[3] === "TRUE",
          httpOnly: p[1] !== "TRUE",
          hostOnly: false,
          expirationDate: parseInt(p[4], 10) || undefined,
        }));
      opts.agent = ytdl.createAgent(cookies);
    }
    const stream = ytdl(url, opts);

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
