import { Router } from "express";
import { db, foldersTable, tracksTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { CreateFolderBody, RenameFolderBody } from "@workspace/api-zod";

const router = Router();

router.get("/folders", async (req, res) => {
  const rows = await db
    .select({
      id: foldersTable.id,
      name: foldersTable.name,
      createdAt: foldersTable.createdAt,
      trackCount: sql<number>`cast(count(${tracksTable.id}) as int)`,
    })
    .from(foldersTable)
    .leftJoin(tracksTable, eq(tracksTable.folderId, foldersTable.id))
    .groupBy(foldersTable.id)
    .orderBy(foldersTable.name);

  res.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.post("/folders", async (req, res) => {
  const parsed = CreateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const [folder] = await db
    .insert(foldersTable)
    .values({ name: parsed.data.name })
    .returning();
  res.status(201).json({ ...folder, trackCount: 0, createdAt: folder.createdAt.toISOString() });
});

router.patch("/folders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = RenameFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [updated] = await db
    .update(foldersTable)
    .set({ name: parsed.data.name })
    .where(eq(foldersTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }
  const [{ trackCount }] = await db
    .select({ trackCount: sql<number>`cast(count(${tracksTable.id}) as int)` })
    .from(tracksTable)
    .where(eq(tracksTable.folderId, id));
  res.json({ ...updated, trackCount, createdAt: updated.createdAt.toISOString() });
});

router.delete("/folders/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(foldersTable).where(eq(foldersTable.id, id));
  res.status(204).send();
});

export default router;
