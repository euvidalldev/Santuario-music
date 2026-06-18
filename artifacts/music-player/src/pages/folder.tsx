import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { TrackList } from "@/components/ui/track-list";
import { Play, Folder as FolderIcon, Trash2, Edit2 } from "lucide-react";
import { playTrack } from "@/hooks/use-player";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLocalTracks, useLocalFolders, useDeleteFolder, useRenameFolder } from "@/hooks/use-local-library";
import { t } from "@/lib/pt-br";

export default function Folder() {
  const params = useParams();
  const folderId = params.id ?? null;
  const [, setLocation] = useLocation();

  const { folders } = useLocalFolders();
  const folder = folders.find(f => f.id === folderId);
  const { tracks, isLoading } = useLocalTracks(folderId);

  const deleteFolder = useDeleteFolder();
  const renameFolder = useRenameFolder();

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const handlePlayAll = () => { if (tracks.length > 0) playTrack(tracks[0], tracks); };

  const handleDelete = async () => {
    if (!folderId) return;
    await deleteFolder(folderId);
    setLocation("/");
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderId || !renameValue.trim()) return;
    await renameFolder(folderId, renameValue);
    setIsRenameOpen(false);
  };

  if (!folder && folders.length > 0) {
    return <div className="p-8 text-center text-muted-foreground mt-20">{t.folder.notFound}</div>;
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-4 md:px-8 pt-8 pb-4 md:pt-14 md:pb-6 flex flex-col gap-3 relative border-b border-border/30 bg-card/10">
        <div className="absolute top-0 left-6 opacity-[0.03] pointer-events-none">
          <FolderIcon className="w-48 h-48" />
        </div>
        <div className="flex items-start justify-between relative z-10">
          <div className="flex flex-col gap-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 text-primary font-medium text-xs mb-1">
              <FolderIcon className="w-3 h-3" /><span>{t.folder.playlist}</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground truncate">{folder?.name}</h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 bg-transparent flex-shrink-0">
                <Edit2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => { setRenameValue(folder?.name || ""); setIsRenameOpen(true); }}>
                <Edit2 className="w-4 h-4 mr-2" /> {t.folder.rename}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsDeleteOpen(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-2" /> {t.folder.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <Button size="default" className="rounded-full px-6 shadow-[0_0_20px_rgba(200,80,0,0.3)] font-semibold" onClick={handlePlayAll} disabled={tracks.length === 0}>
            <Play className="w-4 h-4 mr-2 fill-current" /> {t.folder.playFolder}
          </Button>
          <span className="text-xs text-muted-foreground font-mono">{t.folder.tracks(tracks.length)}</span>
        </div>
      </div>
      <div className="flex-1"><TrackList tracks={tracks} isLoading={isLoading} /></div>

      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.folder.renameTitle}</DialogTitle></DialogHeader>
          <form onSubmit={handleRename} className="space-y-4 pt-4">
            <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRenameOpen(false)}>{t.folder.cancel}</Button>
              <Button type="submit" disabled={!renameValue.trim()}>{t.folder.save}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.folder.deleteTitle}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground pt-2" dangerouslySetInnerHTML={{ __html: t.folder.deleteConfirm(folder?.name || "") }} />
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>{t.folder.cancel}</Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>{t.folder.deleteBtn}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
