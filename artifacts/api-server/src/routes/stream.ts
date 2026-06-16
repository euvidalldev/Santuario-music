import { Router } from "express";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const router = Router();
const YT_DLP = process.env["YT_DLP_PATH"] || "yt-dlp";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

function getCookiesArgs(req: import("express").Request): string[] {
  const raw = req.headers["x-youtube-cookies"] as string | undefined;
  if (!raw) return [];
  try {
    let cookies = Buffer.from(raw, "base64").toString("utf-8");
    if (!cookies.startsWith("#")) {
      cookies = "# Netscape HTTP Cookie File\n" + cookies;
    }
    const tmpPath = path.join(os.tmpdir(), `cookies-${crypto.randomUUID()}.txt`);
    fs.writeFileSync(tmpPath, cookies);
    return ["--cookies", tmpPath];
  } catch {
    return [];
  }
}

const EXTRACTOR_ARGS = [
  "--extractor-args", "youtube:player_client=android",
];

function runInfo(url: string, req: import("express").Request): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP, [
      "--dump-json", "--no-playlist", "--no-warnings",
      "--user-agent", UA,
      ...EXTRACTOR_ARGS,
      ...getCookiesArgs(req), url,
    ]);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (c: Buffer) => { stdout += c.toString(); });
    proc.stderr.on("data", (c: Buffer) => { stderr += c.toString(); });
    proc.on("close", (code) => {
      if (code === 0) return resolve(stdout);
      reject(new Error(stderr.slice(-1000)));
    });
    proc.on("error", reject);
  });
}

// GET /api/stream/info?url=<youtube-url>
// Returns track metadata without downloading
router.get("/stream/info", async (req, res) => {
  const url = req.query.url as string | undefined;
  if (!url) { res.status(400).json({ error: "url parameter required" }); return; }

  try {
    const json = await runInfo(url, req);
    const data = JSON.parse(json.split("\n")[0]);
    res.json({
      title:        data.title     ?? "Unknown Title",
      artist:       data.uploader  ?? data.channel ?? "Unknown Artist",
      duration:     data.duration  ?? 0,
      thumbnailUrl: data.thumbnail ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "stream/info failed");
    res.status(500).json({ error: msg.slice(0, 300) });
  }
});

// GET /api/stream/audio?url=<youtube-url>&quality=128K
// Downloads to a temp file then streams it to the client, deletes after.
router.get("/stream/audio", async (req, res) => {
  const url     = req.query.url     as string | undefined;
  const quality = (req.query.quality as string | undefined) ?? "128K";

  if (!url) { res.status(400).json({ error: "url parameter required" }); return; }

  const uid     = (crypto as typeof crypto).randomUUID();
  const tmpBase = path.join(os.tmpdir(), `sanctuary-${uid}`);
  const tmpOut  = `${tmpBase}.%(ext)s`;

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(YT_DLP, [
        "--extract-audio",
        "--audio-format", "m4a",
        "--audio-quality", quality,
        "--output", tmpOut,
        "--no-playlist",
        "--no-warnings",
        "--user-agent", UA,
        ...EXTRACTOR_ARGS,
        ...getCookiesArgs(req),
        url,
      ]);
      let stderr = "";
      proc.stderr.on("data", (c: Buffer) => { stderr += c.toString(); });
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.slice(-300))));
      proc.on("error", reject);
    });

    // Find the produced file
    let actualFile = "";
    for (const ext of [".m4a", ".mp4", ".aac", ".mp3"]) {
      const candidate = `${tmpBase}${ext}`;
      if (fs.existsSync(candidate)) { actualFile = candidate; break; }
    }
    if (!actualFile) { res.status(500).json({ error: "Temp file not found after download" }); return; }

    const stat = fs.statSync(actualFile);
    res.setHeader("Content-Type", "audio/mp4");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length");

    const stream = fs.createReadStream(actualFile);
    stream.pipe(res);

    const cleanup = () => fs.unlink(actualFile, () => {});
    stream.on("end", cleanup);
    res.on("close",  cleanup);
    res.on("finish", cleanup);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "stream/audio failed");
    // clean up any partial temp files
    for (const ext of [".m4a", ".mp4", ".aac", ".mp3"]) {
      fs.unlink(`${tmpBase}${ext}`, () => {});
    }
    if (!res.headersSent) res.status(500).json({ error: msg.slice(0, 300) });
  }
});

export default router;
