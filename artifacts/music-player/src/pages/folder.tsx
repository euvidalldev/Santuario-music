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
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
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
      {/* Hero Section */}
      <div className="px-8 py-10 pt-16 flex flex-col gap-6 relative border-b border-border/30 bg-card/10">
        <div className="absolute top-0 left-10 p-8 opacity-[0.03]">
          <FolderIcon className="w-64 h-64" />
        </div>
        
        <div className="flex items-start justify-between relative z-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 text-primary font-medium text-sm mb-2">
              <FolderIcon className="w-4 h-4" />
              <span>Playlist</span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-foreground">{folder?.name}</h1>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 bg-transparent">
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
        
        <div className="flex items-center gap-6 relative z-10 mt-4">
          <Button 
            size="lg" 
            className="rounded-full px-8 shadow-[0_0_20px_rgba(200,80,0,0.3)] hover:shadow-[0_0_30px_rgba(200,80,0,0.5)] transition-all font-semibold"
            onClick={handlePlayAll}
            disabled={tracks.length === 0}
          >
            <Play className="w-5 h-5 mr-2 fill-current" />
            Play Folder
          </Button>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
            <span>{tracks.length} tracks</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 pb-10">
        <TrackList tracks={tracks} isLoading={isLoading} />
      </div>

      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4 pt-4">
            <Input 
              value={renameValue} 
              onChange={(e) => setRenameValue(e.target.value)} 
              autoFocus 
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRenameOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim() || renameFolder.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
