import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { foldersTable } from "./folders";

export const tracksTable = pgTable("tracks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull().default("Unknown Artist"),
  duration: integer("duration").notNull().default(0),
  fileSize: integer("file_size").notNull().default(0),
  filePath: text("file_path").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  youtubeUrl: text("youtube_url"),
  folderId: integer("folder_id").references(() => foldersTable.id, { onDelete: "set null" }),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrackSchema = createInsertSchema(tracksTable).omit({ id: true, downloadedAt: true });
export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Track = typeof tracksTable.$inferSelect;
