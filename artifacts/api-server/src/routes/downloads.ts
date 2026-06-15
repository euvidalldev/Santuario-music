import { Router } from "express";
import { db, downloadsTable, tracksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { StartDownloadBody } from "@workspace/api-zod";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

const router = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const musicDir = path.resolve(workspaceRoot, "artifacts/api-server/music");
if (!fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir, { recursive: true });
}

const YT_DLP = "/home/runner/workspace/.pythonlibs/bin/yt-dlp";

function formatRow(row: typeof downloadsTable.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
  };
}

function runCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.slice(-500) || `yt-dlp exited with code ${code}`));
    });
    proc.on("error", reject);
  });
}

interface YtMeta {
  title: string;
  uploader: string;
  duration: number;
  thumbnail: string;
}

async function fetchMeta(youtubeUrl: string): Promise<YtMeta> {
  const json = await runCommand([
    "--dump-json",
    "--no-playlist",
    "--no-warnings",
    youtubeUrl,
  ]);
  const data = JSON.parse(json.split("\n")[0]);
  return {
    title: data.title ?? "Unknown Title",
    uploader: data.uploader ?? data.channel ?? "Unknown Artist",
    duration: data.duration ?? 0,
    thumbnail: data.thumbnail ?? "",
  };
}

async function runDownload(downloadId: number, youtubeUrl: string, folderId: number | null | undefined, audioQuality = "128K") {
  try {
    await db.update(downloadsTable).set({ status: "downloading", progress: 0 }).where(eq(downloadsTable.id, downloadId));

    // Step 1: fetch metadata
    const meta = await fetchMeta(youtubeUrl).catch(() => ({
      title: "Unknown Title",
      uploader: "Unknown Artist",
      duration: 0,
      thumbnail: "",
    }));

    await db.update(downloadsTable)
      .set({ title: meta.title })
      .where(eq(downloadsTable.id, downloadId));

    // Step 2: download audio as AAC/M4A (smaller than MP3, native YouTube format)
    const outputTemplate = path.join(musicDir, "%(title)s.%(ext)s");

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(YT_DLP, [
        "--extract-audio",
        "--audio-format", "m4a",
        "--audio-quality", audioQuality,
        "--output", outputTemplate,
        "--no-playlist",
        "--no-warnings",
        youtubeUrl,
      ]);

      let stderrBuf = "";

      proc.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stderrBuf += text;
        const m = text.match(/(\d+\.?\d*)%/);
        if (m) {
          const progress = parseFloat(m[1]);
          db.update(downloadsTable)
            .set({ progress })
            .where(eq(downloadsTable.id, downloadId))
            .catch(() => {});
        }
      });

      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderrBuf.slice(-500) || `yt-dlp exited with code ${code}`));
      });
      proc.on("error", reject);
    });

    // Step 3: find the downloaded file
    const expectedFile = path.join(musicDir, `${meta.title}.m4a`);
    let filePath = expectedFile;
    let fileSize = 0;

    if (fs.existsSync(expectedFile)) {
      fileSize = fs.statSync(expectedFile).size;
    } else {
      const files = fs.readdirSync(musicDir).filter((f) => f.endsWith(".m4a") || f.endsWith(".mp3"));
      const recent = files
        .map((f) => ({ f, mtime: fs.statSync(path.join(musicDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)[0];
      if (recent) {
        filePath = path.join(musicDir, recent.f);
        fileSize = fs.statSync(filePath).size;
      }
    }

    const [track] = await db
      .insert(tracksTable)
      .values({
        title: meta.title,
        artist: meta.uploader,
        duration: meta.duration,
        fileSize,
        filePath,
        thumbnailUrl: meta.thumbnail || null,
        youtubeUrl,
        folderId: folderId ?? null,
      })
      .returning();

    await db
      .update(downloadsTable)
      .set({ status: "completed", progress: 100, trackId: track.id })
      .where(eq(downloadsTable.id, downloadId));

    logger.info({ downloadId, trackId: track.id, title: meta.title }, "Download completed");
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ downloadId, err }, "Download failed");
    await db
      .update(downloadsTable)
      .set({ status: "failed", error: errMsg.slice(0, 500) })
      .where(eq(downloadsTable.id, downloadId));
  }
}

router.get("/downloads", async (_req, res) => {
  const rows = await db.select().from(downloadsTable).orderBy(downloadsTable.createdAt);
  res.json(rows.map(formatRow));
});

router.post("/downloads", async (req, res) => {
  const parsed = StartDownloadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const { youtubeUrl, folderId, quality } = parsed.data;

  const [download] = await db
    .insert(downloadsTable)
    .values({ youtubeUrl, folderId: folderId ?? null, status: "pending" })
    .returning();

  runDownload(download.id, youtubeUrl, folderId ?? null, quality ?? "128K").catch(() => {});

  res.status(202).json(formatRow(download));
});

router.get("/downloads/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [download] = await db.select().from(downloadsTable).where(eq(downloadsTable.id, id));
  if (!download) {
    res.status(404).json({ error: "Download not found" });
    return;
  }
  res.json(formatRow(download));
});

router.delete("/downloads/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(downloadsTable).where(eq(downloadsTable.id, id));
  res.status(204).send();
});

export default router;
