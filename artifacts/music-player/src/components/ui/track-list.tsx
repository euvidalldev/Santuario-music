import React, { useState } from "react";
import { LocalTrack } from "@/lib/local-db";
import { formatDuration, formatFileSize, formatRelativeTime } from "@/lib/format";
import { usePlayer, playTrack } from "@/hooks/use-player";
import { useDeleteTrack, useUpdateTrack, useLocalFolders } from "@/hooks/use-local-library";
import { MoreHorizontal, Play, Pause, Trash2, Folder as FolderIcon, Clock, HardDrive, Edit2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface TrackListProps {
  tracks: LocalTrack[];
  isLoading: boolean;
}

export function TrackList({ tracks, isLoading }: TrackListProps) {
  const { currentTrack, isPlaying } = usePlayer();
  const deleteTrack = useDeleteTrack();
  const updateTrack = useUpdateTrack();
  const { folders } = useLocalFolders();

  const [editingTrack, setEditingTrack] = useState<LocalTrack | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");

  const handlePlay = (track: LocalTrack) => playTrack(track, tracks);

  const handleDelete = async (id: string) => {
    await deleteTrack(id);
  };

  const handleMoveToFolder = async (trackId: string, folderId: string | null) => {
    await updateTrack(trackId, { folderId });
  };

  const openEdit = (track: LocalTrack) => {
    setEditingTrack(track);
    setEditTitle(track.title);
    setEditArtist(track.artist);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrack) return;
    await updateTrack(editingTrack.id, { title: editTitle, artist: editArtist });
    setEditingTrack(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 px-3 rounded-lg bg-card/40 animate-pulse border border-border/50">
            <div className="w-10 h-10 bg-muted rounded-md flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center px-6">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 border border-border">
          <HardDrive className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-medium text-foreground mb-2">No tracks yet</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          Download music from YouTube — it will be saved directly on your device.
        </p>
      </div>
    );
  }

  const ActionsMenu = ({ track }: { track: LocalTrack }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-all flex-shrink-0">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => openEdit(track)}>
          <Edit2 className="w-4 h-4 mr-2" /> Edit Info
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderIcon className="w-4 h-4 mr-2" /> Move to Folder
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handleMoveToFolder(track.id, null)} className={!track.folderId ? "bg-secondary" : ""}>
                No Folder
              </DropdownMenuItem>
              {folders?.length ? <DropdownMenuSeparator /> : null}
              {folders?.map(folder => (
                <DropdownMenuItem key={folder.id} onClick={() => handleMoveToFolder(track.id, folder.id)} className={track.folderId === folder.id ? "bg-secondary text-primary" : ""}>
                  {folder.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleDelete(track.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
          <Trash2 className="w-4 h-4 mr-2" /> Delete Track
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      {/* ── Desktop ── */}
      <div className="hidden md:block w-full">
        <div className="grid grid-cols-[2rem_1fr_minmax(120px,2fr)_minmax(100px,1fr)_minmax(80px,1fr)_2.5rem] gap-4 px-8 py-3 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur z-20">
          <div>#</div><div>Title</div><div>Artist</div>
          <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Added</div>
          <div className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> Size</div>
          <div />
        </div>
        <div className="flex flex-col pt-2 pb-6 px-4">
          {tracks.map((track, index) => {
            const active = currentTrack?.id === track.id;
            return (
              <div key={track.id} onDoubleClick={() => handlePlay(track)}
                className={`group grid grid-cols-[2rem_1fr_minmax(120px,2fr)_minmax(100px,1fr)_minmax(80px,1fr)_2.5rem] gap-4 items-center px-4 py-3 rounded-lg hover:bg-card/80 transition-colors border border-transparent hover:border-border/50 cursor-pointer ${active ? "bg-primary/5 border-primary/20" : ""}`}>
                <div className="flex justify-center text-muted-foreground text-sm font-mono relative">
                  <span className={`group-hover:opacity-0 ${active ? "opacity-0" : "opacity-100"}`}>{(index + 1).toString().padStart(2, "0")}</span>
                  <button onClick={() => handlePlay(track)} className={`absolute inset-0 flex items-center justify-center ${active ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"}`}>
                    {active && isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 relative bg-secondary border border-border/50">
                    {track.thumbnailUrl && <img src={track.thumbnailUrl} alt="" className="w-full h-full object-cover" />}
                    {active && isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-0.5">
                        <div className="w-1 h-3 bg-primary animate-[bounce_1s_infinite] rounded-full" style={{ animationDelay: "0s" }} />
                        <div className="w-1 h-2 bg-primary animate-[bounce_1s_infinite] rounded-full" style={{ animationDelay: "0.2s" }} />
                        <div className="w-1 h-4 bg-primary animate-[bounce_1s_infinite] rounded-full" style={{ animationDelay: "0.4s" }} />
                      </div>
                    )}
                  </div>
                  <span className={`text-sm font-medium truncate ${active ? "text-primary" : "text-foreground"}`}>{track.title}</span>
                </div>
                <div className="min-w-0"><span className="text-sm text-muted-foreground truncate block group-hover:text-foreground transition-colors">{track.artist}</span></div>
                <div className="min-w-0"><span className="text-sm text-muted-foreground font-mono truncate block">{formatRelativeTime(track.downloadedAt)}</span></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-foreground font-mono">{formatDuration(track.duration)}</span>
                  <span className="text-xs text-muted-foreground font-mono">{formatFileSize(track.fileSize)}</span>
                </div>
                <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-all"><ActionsMenu track={track} /></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Mobile ── */}
      <div className="md:hidden flex flex-col pb-4">
        {tracks.map(track => {
          const active = currentTrack?.id === track.id;
          return (
            <div key={track.id} className={`flex items-center gap-3 px-4 py-3 border-b border-border/30 ${active ? "bg-primary/5" : ""}`}>
              <button onClick={() => handlePlay(track)} className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-secondary border border-border/50">
                {track.thumbnailUrl && <img src={track.thumbnailUrl} alt="" className="w-full h-full object-cover" />}
                <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${active ? "opacity-100" : "opacity-0"}`}>
                  {active && isPlaying ? <Pause className="w-4 h-4 fill-white text-white" /> : <Play className="w-4 h-4 fill-white text-white ml-0.5" />}
                </div>
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${active ? "text-primary" : "text-foreground"}`}>{track.title}</p>
                <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{formatDuration(track.duration)} · {formatFileSize(track.fileSize)}</p>
              </div>
              <ActionsMenu track={track} />
            </div>
          );
        })}
      </div>

      <Dialog open={!!editingTrack} onOpenChange={(open) => !open && setEditingTrack(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Track Info</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={editTitle} onChange={e => setEditTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="artist">Artist</Label>
              <Input id="artist" value={editArtist} onChange={e => setEditArtist(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingTrack(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
