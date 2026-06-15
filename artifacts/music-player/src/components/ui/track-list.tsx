import React, { useState } from "react";
import { Track, useDeleteTrack, useUpdateTrack, useListFolders, getListTracksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDuration, formatFileSize, formatRelativeTime } from "@/lib/format";
import { usePlayer, playTrack } from "@/hooks/use-player";
import { MoreHorizontal, Play, Pause, Trash2, Folder as FolderIcon, Clock, HardDrive, Edit2, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface TrackListProps {
  tracks: Track[];
  isLoading: boolean;
}

export function TrackList({ tracks, isLoading }: TrackListProps) {
  const { currentTrack, isPlaying } = usePlayer();
  const queryClient = useQueryClient();
  const deleteTrack = useDeleteTrack();
  const updateTrack = useUpdateTrack();
  const { data: folders } = useListFolders();
  
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");

  const handlePlay = (track: Track) => {
    playTrack(track, tracks);
  };

  const handleDelete = async (id: number) => {
    await deleteTrack.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListTracksQueryKey() });
  };

  const handleMoveToFolder = async (trackId: number, folderId: number | null) => {
    await updateTrack.mutateAsync({ id: trackId, data: { folderId } });
    queryClient.invalidateQueries({ queryKey: getListTracksQueryKey() });
  };

  const openEdit = (track: Track) => {
    setEditingTrack(track);
    setEditTitle(track.title);
    setEditArtist(track.artist);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrack) return;
    
    await updateTrack.mutateAsync({ 
      id: editingTrack.id, 
      data: { title: editTitle, artist: editArtist } 
    });
    
    setEditingTrack(null);
    queryClient.invalidateQueries({ queryKey: getListTracksQueryKey() });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 px-4 rounded-lg bg-card/40 animate-pulse border border-border/50">
            <div className="w-12 h-12 bg-muted rounded-md" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-1/4" />
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
        <h3 className="text-xl font-medium text-foreground mb-2">No tracks found</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          Download some tracks from YouTube to start building your personal sanctuary.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        {/* Header */}
        <div className="grid grid-cols-[auto_1fr_minmax(120px,2fr)_minmax(100px,1fr)_minmax(80px,1fr)_auto] gap-4 px-8 py-3 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur z-20">
          <div className="w-8">#</div>
          <div>Title</div>
          <div className="hidden md:block">Artist</div>
          <div className="hidden lg:flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Added</div>
          <div className="hidden lg:flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> Size</div>
          <div className="w-10"></div>
        </div>

        {/* Tracks */}
        <div className="flex flex-col pt-2 pb-6 px-4">
          {tracks.map((track, index) => {
            const isCurrentlyPlaying = currentTrack?.id === track.id;
            
            return (
              <div 
                key={track.id}
                onDoubleClick={() => handlePlay(track)}
                className={`group grid grid-cols-[auto_1fr_minmax(120px,2fr)_minmax(100px,1fr)_minmax(80px,1fr)_auto] gap-4 items-center px-4 py-3 rounded-lg hover:bg-card/80 transition-colors border border-transparent hover:border-border/50 cursor-pointer ${isCurrentlyPlaying ? 'bg-primary/5 border-primary/20' : ''}`}
              >
                {/* Index / Play Button */}
                <div className="w-8 flex justify-center text-muted-foreground text-sm font-mono relative">
                  <span className={`group-hover:opacity-0 ${isCurrentlyPlaying ? 'opacity-0' : 'opacity-100'}`}>
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  <button 
                    onClick={() => handlePlay(track)}
                    className={`absolute inset-0 flex items-center justify-center ${isCurrentlyPlaying ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity'}`}
                  >
                    {isCurrentlyPlaying && isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>
                </div>

                {/* Title & Thumbnail */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 relative bg-secondary border border-border/50">
                    {track.thumbnailUrl && (
                      <img src={track.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    )}
                    {isCurrentlyPlaying && isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-0.5">
                        <div className="w-1 h-3 bg-primary animate-[bounce_1s_infinite] rounded-full" style={{ animationDelay: '0s' }}></div>
                        <div className="w-1 h-2 bg-primary animate-[bounce_1s_infinite] rounded-full" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-1 h-4 bg-primary animate-[bounce_1s_infinite] rounded-full" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm font-medium truncate ${isCurrentlyPlaying ? 'text-primary' : 'text-foreground'}`}>
                      {track.title}
                    </span>
                    <span className="text-xs text-muted-foreground md:hidden truncate">{track.artist}</span>
                  </div>
                </div>

                {/* Artist */}
                <div className="hidden md:flex min-w-0">
                  <span className="text-sm text-muted-foreground truncate group-hover:text-foreground transition-colors">
                    {track.artist}
                  </span>
                </div>

                {/* Date */}
                <div className="hidden lg:flex min-w-0">
                  <span className="text-sm text-muted-foreground font-mono truncate">
                    {formatRelativeTime(track.downloadedAt)}
                  </span>
                </div>

                {/* Duration/Size */}
                <div className="hidden lg:flex flex-col min-w-0">
                  <span className="text-sm text-foreground font-mono">{formatDuration(track.duration)}</span>
                  <span className="text-xs text-muted-foreground font-mono">{formatFileSize(track.fileSize)}</span>
                </div>

                {/* Actions */}
                <div className="w-10 flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => openEdit(track)}>
                        <Edit2 className="w-4 h-4 mr-2" /> Edit Info
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href={`/api/tracks/${track.id}/download`} download>
                          <Download className="w-4 h-4 mr-2" /> Download to Device
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <FolderIcon className="w-4 h-4 mr-2" /> Move to Folder
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem 
                              onClick={() => handleMoveToFolder(track.id, null)}
                              className={!track.folderId ? "bg-secondary" : ""}
                            >
                              No Folder
                            </DropdownMenuItem>
                            {folders?.length ? <DropdownMenuSeparator /> : null}
                            {folders?.map(folder => (
                              <DropdownMenuItem 
                                key={folder.id} 
                                onClick={() => handleMoveToFolder(track.id, folder.id)}
                                className={track.folderId === folder.id ? "bg-secondary text-primary" : ""}
                              >
                                {folder.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(track.id)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete Track
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!editingTrack} onOpenChange={(open) => !open && setEditingTrack(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Track Info</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input 
                id="title" 
                value={editTitle} 
                onChange={(e) => setEditTitle(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="artist">Artist</Label>
              <Input 
                id="artist" 
                value={editArtist} 
                onChange={(e) => setEditArtist(e.target.value)} 
                required 
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingTrack(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateTrack.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
