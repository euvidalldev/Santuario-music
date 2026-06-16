import { Router } from "express";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const router = Router();
const YT_DLP = process.env["YT_DLP_PATH"] || "yt-dlp";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (like Gecko) Chrome/149.0.0.0 Safari/537.36";
const EXTRACTOR = ["--extractor-args", "youtube:player_client=android"];
const COOKIES_HEADER = "x-youtube-cookies";

function cookiesArgs(req: import("express").Request): string[] {
  const raw = req.headers[COOKIES_HEADER] as string | undefined;
  if (!raw) return [];
  try {
    let txt = Buffer.from(raw, "base64").toString("utf-8");
    if (!txt.startsWith("#")) txt = "# Netscape HTTP Cookie File\n" + txt;
    const p = path.join(os.tmpdir(), `cookies-${crypto.randomUUID()}.txt`);
    fs.writeFileSync(p, txt);
    return ["--cookies", p];
  } catch { return []; }
}

// GET /api/stream/info?url=<youtube-url>
router.get("/stream/info", async (req, res) => {
  const url = req.query.url as string | undefined;
  if (!url) { res.status(400).json({ error: "url parameter required" }); return; }

  try {
    const out = await new Promise<string>((resolve, reject) => {
      const proc = spawn(YT_DLP, [
        "--dump-json", "--no-playlist", "--no-warnings",
        "--user-agent", UA,
        ...EXTRACTOR,
        ...cookiesArgs(req), url,
      ]);
      let o = "", e = "";
      proc.stdout.on("data", (c: Buffer) => o += c);
      proc.stderr.on("data", (c: Buffer) => e += c);
      proc.on("close", code => code === 0 ? resolve(o) : reject(new Error(e.slice(-600))));
      proc.on("error", reject);
    });

    const d = JSON.parse(out.split("\n")[0]);
    res.json({
      title: d.title ?? "Unknown Title",
      artist: d.uploader ?? d.channel ?? "Unknown Artist",
      duration: d.duration ?? 0,
      thumbnailUrl: d.thumbnail ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "stream/info failed");
    res.status(500).json({ error: msg.slice(0, 600) });
  }
});

// GET /api/stream/audio?url=<youtube-url>&quality=128K
router.get("/stream/audio", async (req, res) => {
  const url = req.query.url as string | undefined;
  const quality = (req.query.quality as string) ?? "128K";
  if (!url) { res.status(400).json({ error: "url parameter required" }); return; }

  const uid = crypto.randomUUID();
  const tmp = path.join(os.tmpdir(), `sanctuary-${uid}`);

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(YT_DLP, [
        "--extract-audio",
        "--audio-format", "m4a",
        "--audio-quality", quality,
        "--output", `${tmp}.%(ext)s`,
        "--no-playlist", "--no-warnings",
        "--user-agent", UA,
        ...EXTRACTOR,
        ...cookiesArgs(req), url,
      ]);
      let e = "";
      proc.stderr.on("data", (c: Buffer) => e += c);
      proc.on("close", code => code === 0 ? resolve() : reject(new Error(e.slice(-300))));
      proc.on("error", reject);
    });

    let file = "";
    for (const ext of [".m4a", ".mp4", ".aac", ".mp3"]) {
      const c = `${tmp}${ext}`;
      if (fs.existsSync(c)) { file = c; break; }
    }
    if (!file) { res.status(500).json({ error: "File not found after download" }); return; }

    const stat = fs.statSync(file);
    res.setHeader("Content-Type", "audio/mp4");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length");

    const s = fs.createReadStream(file);
    s.pipe(res);
    const clean = () => fs.unlink(file, () => {});
    s.on("end", clean);
    res.on("close", clean);
    res.on("finish", clean);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "stream/audio failed");
    for (const ext of [".m4a", ".mp4", ".aac", ".mp3"]) fs.unlink(`${tmp}${ext}`, () => {});
    if (!res.headersSent) res.status(500).json({ error: msg.slice(0, 300) });
  }
});

export default router;
