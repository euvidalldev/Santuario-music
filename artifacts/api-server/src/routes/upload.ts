import { Router } from "express";
import multer from "multer";
import { parseBuffer } from "music-metadata";
import { db, tracksTable } from "@workspace/db";
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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, musicDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w\s\-().]/g, "_");
    const unique = `${Date.now()}-${safe}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || file.originalname.toLowerCase().endsWith(".mp3")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
  limits: { fileSize: 200 * 1024 * 1024 },
});

router.post("/tracks/upload", upload.array("files", 20), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files uploaded" });
    return;
  }

  const folderId = req.body.folderId ? Number(req.body.folderId) : null;
  const results: { success: boolean; title?: string; error?: string }[] = [];

  for (const file of files) {
    try {
      const buffer = fs.readFileSync(file.path);
      let title = path.basename(file.originalname, path.extname(file.originalname));
      let artist = "Unknown Artist";
      let duration = 0;

      try {
        const meta = await parseBuffer(buffer, { mimeType: file.mimetype });
        title = meta.common.title || title;
        artist = meta.common.artist || meta.common.albumartist || artist;
        duration = Math.round(meta.format.duration || 0);
      } catch {
        // fall back to filename if metadata extraction fails
      }

      const fileSize = file.size;
      const filePath = file.path;

      await db.insert(tracksTable).values({
        title,
        artist,
        duration,
        fileSize,
        filePath,
        thumbnailUrl: null,
        youtubeUrl: null,
        folderId,
      });

      logger.info({ title, filePath }, "Track imported from device");
      results.push({ success: true, title });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, file: file.originalname }, "Failed to import track");
      results.push({ success: false, error: msg });
    }
  }

  res.status(201).json({ results });
});

export default router;
