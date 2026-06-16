import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Download, Folder as FolderIcon, Plus, Library, Settings } from "lucide-react";
import { useLocalFolders, useCreateFolder } from "@/hooks/use-local-library";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const NavItem = ({ href, icon: Icon, label, isActive }: { href: string; icon: React.ElementType; label: string; isActive: boolean }) => (
  <Link href={href}>
    <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer group
      ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
      <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
      <span className="text-sm">{label}</span>
    </div>
  </Link>
);

export function Sidebar() {
  const [location] = useLocation();
  const { folders, isLoading: isFoldersLoading } = useLocalFolders();
  const createFolder = useCreateFolder();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setIsCreating(true);
    try {
      await createFolder(newFolderName.trim());
      setIsCreateOpen(false);
      setNewFolderName("");
      toast({ title: "Folder created", description: `"${newFolderName}" added to your library` });
    } catch {
      toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="hidden md:flex w-64 bg-sidebar border-r border-sidebar-border h-screen flex-col pt-6 flex-shrink-0">
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(200,80,0,0.3)]">
          <Library className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-lg tracking-tight text-sidebar-foreground">Sanctuary</span>
      </div>

      <div className="px-3 flex flex-col gap-1">
        <NavItem href="/"          icon={Home}     label="Library"   isActive={location === "/"} />
        <NavItem href="/downloads" icon={Download}  label="Downloads" isActive={location === "/downloads"} />
        <NavItem href="/settings"  icon={Settings}  label="Settings"  isActive={location === "/settings"} />
      </div>

      <div className="mt-8 px-6 flex items-center justify-between group">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Playlists</span>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <button className="text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
              <Plus className="w-4 h-4" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>New Folder</DialogTitle></DialogHeader>
            <form onSubmit={handleCreateFolder} className="space-y-4 pt-4">
              <Input placeholder="Folder name..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} autoFocus />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!newFolderName.trim() || isCreating}>Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1 mt-2 px-3">
        <div className="flex flex-col gap-1 pb-4">
          {isFoldersLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <Skeleton className="w-4 h-4 rounded-sm" /><Skeleton className="h-4 w-24 rounded-sm" />
              </div>
            ))
          ) : folders.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">No folders yet</div>
          ) : (
            folders.map(folder => (
              <NavItem key={folder.id} href={`/folders/${folder.id}`} icon={FolderIcon} label={folder.name} isActive={location === `/folders/${folder.id}`} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
