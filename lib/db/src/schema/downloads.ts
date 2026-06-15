import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { foldersTable } from "./folders";
import { tracksTable } from "./tracks";

export const downloadsTable = pgTable("downloads", {
  id: serial("id").primaryKey(),
  youtubeUrl: text("youtube_url").notNull(),
  title: text("title"),
  status: text("status").notNull().default("pending"),
  progress: real("progress"),
  error: text("error"),
  trackId: integer("track_id").references(() => tracksTable.id, { onDelete: "set null" }),
  folderId: integer("folder_id").references(() => foldersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDownloadSchema = createInsertSchema(downloadsTable).omit({ id: true, createdAt: true });
export type InsertDownload = z.infer<typeof insertDownloadSchema>;
export type Download = typeof downloadsTable.$inferSelect;
