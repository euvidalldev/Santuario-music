import { Router } from "express";
import { spawn } from "child_process";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const router = Router();
const YT_DLP = process.env["YT_DLP_PATH"] || "yt-dlp";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (like Gecko) Chrome/149.0.0.0 Safari/537.36";
const FORMAT = ["-f", "worstaudio/worst"];
const COOKIES_HEADER = "x-youtube-cookies";

function cookiesArgs(req: import("express").Request): string[] {
  const raw = req.headers[COOKIES_HEADER] as string | undefined;
  if (!raw) return [];
  try {
    let txt = Buffer.from(raw, "base64").toString("utf-8");
    if (!txt.startsWith("#")) txt = "# Netscape HTTP Cookie File\n" + txt;
    const p = path.join(os.tmpdir(), `cookies-${crypto.randomUUID()}.txt`);
    fs.writeFileSync(p, txt);
    const lines = txt.split("\n").filter(l => l && !l.startsWith("#"));
    req.log.info({ cookieCount: lines.length, firstCookie: lines[0]?.split("\t")[5] }, "cookies received");
    return ["--cookies", p];
  } catch (e) {
    req.log.error({ err: e }, "cookies parse failed");
    return [];
  }
}

// GET /api/stream/info?url=<youtube-url>
router.get("/stream/info", async (req, res) => {
  const url = req.query.url as string | undefined;
  if (!url) { res.status(400).json({ error: "url parameter required" }); return; }

  try {
    req.log.info({ url }, "stream/info request");
    const out = await new Promise<string>((resolve, reject) => {
      const proc = spawn(YT_DLP, [
        "--dump-json", "--no-playlist", "--no-warnings",
        "--user-agent", UA,
        ...FORMAT,
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
// Gets the direct audio URL from yt-dlp and proxies the stream.
router.get("/stream/audio", async (req, res) => {
  const url = req.query.url as string | undefined;
  const quality = (req.query.quality as string) ?? "128K";
  if (!url) { res.status(400).json({ error: "url parameter required" }); return; }

  const format = quality === "lowest" ? "worstaudio/worst" : "bestaudio[ext=m4a]/bestaudio/best";

  try {
    // Step 1: yt-dlp --get-url to get the direct stream URL
    const audioUrl = await new Promise<string>((resolve, reject) => {
      const proc = spawn(YT_DLP, [
        "--get-url", "--no-playlist", "--no-warnings",
        "-f", format,
        "--user-agent", UA,
        ...cookiesArgs(req), url,
      ]);
      let o = "", e = "";
      proc.stdout.on("data", (c: Buffer) => o += c);
      proc.stderr.on("data", (c: Buffer) => e += c);
      proc.on("close", code => code === 0 ? resolve(o.trim()) : reject(new Error(e.slice(-300))));
      proc.on("error", reject);
    });

    if (!audioUrl) {
      res.status(500).json({ error: "Could not get audio URL" });
      return;
    }

    req.log.info({ audioUrl: audioUrl.slice(0, 80) }, "stream/audio got URL");

    // Step 2: Proxy the audio stream
    const controller = new AbortController();
    const audioRes = await fetch(audioUrl, { signal: controller.signal });

    if (!audioRes.ok || !audioRes.body) {
      res.status(502).json({ error: `Audio source returned ${audioRes.status}` });
      return;
    }

    const contentType = audioRes.headers.get("content-type") || "audio/mp4";
    const contentLength = audioRes.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Expose-Headers", "Content-Length");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    // ReadableStream → Node.js Readable → pipe to response
    const nodeStream = Readable.from(audioRes.body as any);
    nodeStream.pipe(res);

    req.on("close", () => { controller.abort(); nodeStream.destroy(); });
    nodeStream.on("error", () => { if (!res.headersSent) res.status(502).end(); });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "stream/audio failed");
    if (!res.headersSent) res.status(500).json({ error: msg.slice(0, 300) });
  }
});

export default router;
