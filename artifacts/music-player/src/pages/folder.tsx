import React from "react";
import { useParams, useLocation } from "wouter";
import { useListTracks, getListTracksQueryKey, useListFolders, useDeleteFolder, useRenameFolder } from "@workspace/api-client-react";
import { TrackList } from "@/components/ui/track-list";
import { Play, Folder as FolderIcon, Trash2, Edit2 } from "lucide-react";
import { playTrack } from "@/hooks/use-player";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Folder() {
  const params = useParams();
  const folderId = params.id ? parseInt(params.id, 10) : null;
  const [, setLocation] = useLocation();

  const { data: folders = [] } = useListFolders();
  const folder = folders.find(f => f.id === folderId);

  const { data: tracks = [], isLoading } = useListTracks(
    { folderId },
    { query: { queryKey: getListTracksQueryKey({ folderId }), enabled: !!folderId } }
  );

  const deleteFolder = useDeleteFolder();
  const renameFolder = useRenameFolder();

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const handlePlayAll = () => {
    if (tracks.length > 0) playTrack(tracks[0], tracks);
  };

  const handleDelete = async () => {
    if (!folderId) return;
    if (confirm(`Delete folder "${folder?.name}"? Tracks will be moved to Library.`)) {
      await deleteFolder.mutateAsync({ id: folderId });
      setLocation("/");
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderId || !renameValue.trim()) return;
    await renameFolder.mutateAsync({ id: folderId, data: { name: renameValue } });
    setIsRenameOpen(false);
  };

  if (!folder && folders.length > 0) {
    return <div className="p-8 text-center text-muted-foreground mt-20">Folder not found</div>;
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 md:px-8 pt-8 pb-4 md:pt-14 md:pb-6 flex flex-col gap-3 relative border-b border-border/30 bg-card/10">
        <div className="absolute top-0 left-6 opacity-[0.03] pointer-events-none">
          <FolderIcon className="w-48 h-48" />
        </div>

        <div className="flex items-start justify-between relative z-10">
          <div className="flex flex-col gap-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 text-primary font-medium text-xs mb-1">
              <FolderIcon className="w-3 h-3" />
              <span>Playlist</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground truncate">
              {folder?.name}
            </h1>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 bg-transparent flex-shrink-0">
                <Edit2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => {
                setRenameValue(folder?.name || "");
                setIsRenameOpen(true);
              }}>
                <Edit2 className="w-4 h-4 mr-2" /> Rename Folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-2" /> Delete Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <Button
            size="default"
            className="rounded-full px-6 shadow-[0_0_20px_rgba(200,80,0,0.3)] font-semibold"
            onClick={handlePlayAll}
            disabled={tracks.length === 0}
          >
            <Play className="w-4 h-4 mr-2 fill-current" />
            Play Folder
          </Button>
          <span className="text-xs text-muted-foreground font-mono">{tracks.length} tracks</span>
        </div>
      </div>

      <div className="flex-1">
        <TrackList tracks={tracks} isLoading={isLoading} />
      </div>

      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4 pt-4">
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!renameValue.trim() || renameFolder.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
