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

async function runDownload(downloadId: number, youtubeUrl: string, folderId: number | null | undefined) {
  try {
    await db.update(downloadsTable).set({ status: "downloading", progress: 0 }).where(eq(downloadsTable.id, downloadId));

    const outputTemplate = path.join(musicDir, "%(title)s.%(ext)s");

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(YT_DLP, [
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--output", outputTemplate,
        "--print", "%(title)s|%(uploader)s|%(duration)s|%(thumbnail)s",
        "--no-playlist",
        youtubeUrl,
      ]);

      let infoLine = "";
      let stderrBuf = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        if (text.includes("|")) {
          infoLine = text.trim();
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stderrBuf += text;

        const progressMatch = text.match(/(\d+\.?\d*)%/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          db.update(downloadsTable)
            .set({ progress })
            .where(eq(downloadsTable.id, downloadId))
            .catch(() => {});
        }
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderrBuf.slice(-500) || "yt-dlp failed"));
        }
      });

      proc.on("error", reject);
    });

    let title = "Unknown Title";
    let artist = "Unknown Artist";
    let duration = 0;
    let thumbnailUrl: string | null = null;

    if (infoLine) {
      const parts = infoLine.split("|");
      title = parts[0]?.trim() || title;
      artist = parts[1]?.trim() || artist;
      duration = parseInt(parts[2] || "0", 10) || 0;
      thumbnailUrl = parts[3]?.trim() || null;
    }

    const expectedFile = path.join(musicDir, `${title}.mp3`);
    let filePath = expectedFile;
    let fileSize = 0;

    if (fs.existsSync(expectedFile)) {
      fileSize = fs.statSync(expectedFile).size;
    } else {
      const files = fs.readdirSync(musicDir).filter((f) => f.endsWith(".mp3"));
      const recent = files
        .map((f) => ({ f, mtime: fs.statSync(path.join(musicDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)[0];
      if (recent) {
        filePath = path.join(musicDir, recent.f);
        fileSize = fs.statSync(filePath).size;
        const baseName = path.basename(recent.f, ".mp3");
        if (title === "Unknown Title") title = baseName;
      }
    }

    const [track] = await db
      .insert(tracksTable)
      .values({
        title,
        artist,
        duration,
        fileSize,
        filePath,
        thumbnailUrl,
        youtubeUrl,
        folderId: folderId ?? null,
      })
      .returning();

    await db
      .update(downloadsTable)
      .set({ status: "completed", progress: 100, trackId: track.id, title })
      .where(eq(downloadsTable.id, downloadId));

    logger.info({ downloadId, trackId: track.id, title }, "Download completed");
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
  const { youtubeUrl, folderId } = parsed.data;

  const [download] = await db
    .insert(downloadsTable)
    .values({ youtubeUrl, folderId: folderId ?? null, status: "pending" })
    .returning();

  runDownload(download.id, youtubeUrl, folderId ?? null).catch(() => {});

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
