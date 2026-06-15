import { Router } from "express";
import { db, tracksTable, foldersTable, downloadsTable } from "@workspace/db";
import { gt, sql, count } from "drizzle-orm";

const router = Router();

router.get("/stats", async (_req, res) => {
  const [tracksRow] = await db.select({
    totalTracks: sql<number>`cast(count(*) as int)`,
    totalSize: sql<number>`cast(coalesce(sum(${tracksTable.fileSize}), 0) as int)`,
  }).from(tracksTable);

  const [foldersRow] = await db.select({
    totalFolders: sql<number>`cast(count(*) as int)`,
  }).from(foldersTable);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [downloadsRow] = await db.select({
    recentDownloads: sql<number>`cast(count(*) as int)`,
  }).from(downloadsTable)
    .where(gt(downloadsTable.createdAt, sevenDaysAgo));

  res.json({
    totalTracks: tracksRow.totalTracks,
    totalFolders: foldersRow.totalFolders,
    totalSize: tracksRow.totalSize,
    recentDownloads: downloadsRow.recentDownloads,
  });
});

export default router;
