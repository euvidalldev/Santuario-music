import { Router } from "express";
import { db, tracksTable, foldersTable } from "@workspace/db";
import { eq, isNull, sql } from "drizzle-orm";
import { UpdateTrackBody } from "@workspace/api-zod";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

const router = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const musicDir = path.resolve(workspaceRoot, "artifacts/api-server/music");

function trackWithFolder(row: { track: typeof tracksTable.$inferSelect; folder: typeof foldersTable.$inferSelect | null }) {
  const { track, folder } = row;
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    duration: track.duration,
    fileSize: track.fileSize,
    filePath: track.filePath,
    thumbnailUrl: track.thumbnailUrl,
    youtubeUrl: track.youtubeUrl,
    folderId: track.folderId,
    folderName: folder?.name ?? null,
    downloadedAt: track.downloadedAt.toISOString(),
  };
}

router.get("/tracks", async (req, res) => {
  const folderIdParam = req.query.folderId;

  const rows = await db
    .select({ track: tracksTable, folder: foldersTable })
    .from(tracksTable)
    .leftJoin(foldersTable, eq(tracksTable.folderId, foldersTable.id));

  const tracks = rows.map(trackWithFolder);

  if (folderIdParam === undefined) {
    res.json(tracks);
    return;
  }

  if (folderIdParam === "null" || folderIdParam === "") {
    res.json(tracks.filter((t) => t.folderId === null));
    return;
  }

  const fid = Number(folderIdParam);
  res.json(tracks.filter((t) => t.folderId === fid));
});

router.get("/tracks/:id", async (req, res) => {
  const id = Number(req.params.id);
  const rows = await db
    .select({ track: tracksTable, folder: foldersTable })
    .from(tracksTable)
    .leftJoin(foldersTable, eq(tracksTable.folderId, foldersTable.id))
    .where(eq(tracksTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Track not found" });
    return;
  }
  res.json(trackWithFolder(rows[0]));
});

router.patch("/tracks/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateTrackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const updates: Partial<typeof tracksTable.$inferSelect> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.artist !== undefined) updates.artist = parsed.data.artist;
  if ("folderId" in parsed.data) updates.folderId = parsed.data.folderId ?? null;

  const [updated] = await db.update(tracksTable).set(updates).where(eq(tracksTable.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Track not found" });
    return;
  }
  const rows = await db
    .select({ track: tracksTable, folder: foldersTable })
    .from(tracksTable)
    .leftJoin(foldersTable, eq(tracksTable.folderId, foldersTable.id))
    .where(eq(tracksTable.id, id));
  res.json(trackWithFolder(rows[0]));
});

router.delete("/tracks/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [track] = await db.select().from(tracksTable).where(eq(tracksTable.id, id));
  if (!track) {
    res.status(404).json({ error: "Track not found" });
    return;
  }
  const absPath = path.isAbsolute(track.filePath) ? track.filePath : path.resolve(musicDir, track.filePath);
  try {
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  } catch (err) {
    logger.warn({ err, filePath: track.filePath }, "Could not delete track file");
  }
  await db.delete(tracksTable).where(eq(tracksTable.id, id));
  res.status(204).send();
});

router.get("/tracks/:id/stream", async (req, res) => {
  const id = Number(req.params.id);
  const [track] = await db.select().from(tracksTable).where(eq(tracksTable.id, id));
  if (!track) {
    res.status(404).json({ error: "Track not found" });
    return;
  }
  const absPath = path.isAbsolute(track.filePath) ? track.filePath : path.resolve(musicDir, track.filePath);
  if (!fs.existsSync(absPath)) {
    res.status(404).json({ error: "Audio file not found" });
    return;
  }
  const stat = fs.statSync(absPath);
  const fileSize = stat.size;
  const rangeHeader = req.headers.range;

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(absPath, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "audio/mpeg",
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(absPath).pipe(res);
  }
});

export default router;
