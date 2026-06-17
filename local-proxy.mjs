/**
 * Local proxy para YouTube.
 * Roda no seu PC (IP residencial), o frontend chama ele em vez do Render.
 *
 * Uso: node local-proxy.mjs
 * (precisa ter yt-dlp instalado: pip install yt-dlp)
 */

import http from "http";
import { spawn } from "child_process";

const PORT = 3456;
const YT_DLP = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const videoUrl = url.searchParams.get("url");
  if (!videoUrl) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "url parameter required" }));
    return;
  }

  if (path === "/info") {
    const proc = spawn(YT_DLP, [
      "--dump-json", "--no-playlist", "--no-warnings",
      "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      videoUrl,
    ]);
    let out = "", err = "";
    proc.stdout.on("data", c => out += c);
    proc.stderr.on("data", c => err += c);
    proc.on("close", code => {
      if (code !== 0) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.slice(-300) }));
        return;
      }
      try {
        const d = JSON.parse(out.split("\n")[0]);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          title: d.title ?? "Unknown",
          artist: d.uploader ?? d.channel ?? "Unknown",
          duration: d.duration ?? 0,
          thumbnailUrl: d.thumbnail ?? null,
        }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else if (path === "/audio") {
    const proc = spawn(YT_DLP, [
      "--get-url", "--no-playlist", "--no-warnings",
      "-f", "bestaudio[ext=m4a]/bestaudio/best",
      "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      videoUrl,
    ]);
    let out = "", err = "";
    proc.stdout.on("data", c => out += c);
    proc.stderr.on("data", c => err += c);
    proc.on("close", async code => {
      if (code !== 0) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.slice(-300) }));
        return;
      }
      const audioUrl = out.trim();
      if (!audioUrl) {
        res.writeHead(500).end("No audio URL");
        return;
      }
      try {
        const audioRes = await fetch(audioUrl);
        if (!audioRes.ok || !audioRes.body) {
          res.writeHead(502).end("Failed to fetch audio");
          return;
        }
        const ct = audioRes.headers.get("content-type") || "audio/mp4";
        const cl = audioRes.headers.get("content-length");
        res.writeHead(200, {
          "Content-Type": ct,
          ...(cl ? { "Content-Length": cl } : {}),
          "Access-Control-Expose-Headers": "Content-Length",
        });
        // @ts-ignore
        for await (const chunk of audioRes.body) res.write(chunk);
        res.end();
      } catch (e) {
        res.writeHead(502).end(String(e));
      }
    });
  } else {
    res.writeHead(404).end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`🎵 Local proxy rodando em http://localhost:${PORT}`);
  console.log(`   Info:  http://localhost:${PORT}/info?url=YOUTUBE_URL`);
  console.log(`   Audio: http://localhost:${PORT}/audio?url=YOUTUBE_URL`);
});
