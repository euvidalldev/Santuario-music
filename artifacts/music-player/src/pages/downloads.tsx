import React, { useState } from "react";
import { useListDownloads, useStartDownload, useCancelDownload, getListDownloadsQueryKey, getListTracksQueryKey, useListFolders } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, AlertCircle, CheckCircle2, XCircle, RefreshCw, X, Folder as FolderIcon, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Downloads() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [url, setUrl] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("none");

  const { data: downloads = [], isLoading } = useListDownloads({
    query: {
      queryKey: getListDownloadsQueryKey(),
      refetchInterval: (query) => {
        // Poll every 2s if any download is pending or downloading
        const hasActive = query.state.data?.some(d => d.status === 'pending' || d.status === 'downloading');
        return hasActive ? 2000 : false;
      }
    }
  });

  const { data: folders = [] } = useListFolders();

  const startDownload = useStartDownload({
    mutation: {
      onSuccess: () => {
        setUrl("");
        queryClient.invalidateQueries({ queryKey: getListDownloadsQueryKey() });
        toast({ title: "Download started" });
      },
      onError: (err) => {
        toast({ title: "Failed to start", description: err.message, variant: "destructive" });
      }
    }
  });

  const cancelDownload = useCancelDownload({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDownloadsQueryKey() });
      }
    }
  });

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    startDownload.mutate({
      data: {
        youtubeUrl: url,
        folderId: selectedFolder !== "none" ? parseInt(selectedFolder, 10) : null
      }
    });
  };

  const handleCancel = (id: number) => {
    cancelDownload.mutate({ id });
  };

  return (
    <div className="flex flex-col min-h-full max-w-5xl mx-auto w-full">
      <div className="px-8 py-10 pt-16 flex flex-col gap-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Downloads</h1>
        
        {/* Input Form */}
        <div className="bg-card border border-border p-6 rounded-xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[50px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
          
          <form onSubmit={handleStart} className="flex flex-col md:flex-row gap-4 relative z-10">
            <div className="flex-1">
              <Input 
                placeholder="Paste YouTube URL here..." 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-12 text-base bg-background/50"
              />
            </div>
            
            <div className="w-full md:w-48">
              <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                <SelectTrigger className="h-12 bg-background/50">
                  <div className="flex items-center gap-2">
                    <FolderIcon className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Select folder" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder</SelectItem>
                  {folders.map(f => (
                    <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              type="submit" 
              size="lg" 
              className="h-12 px-8 font-semibold shadow-md"
              disabled={!url.trim() || startDownload.isPending}
            >
              {startDownload.isPending ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Download className="w-5 h-5 mr-2" />
              )}
              Download
            </Button>
          </form>
        </div>

        {/* Queue */}
        <div className="flex flex-col gap-4 mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Queue</h2>
          
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-card rounded-lg border border-border animate-pulse" />
              ))}
            </div>
          ) : downloads.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground bg-card/30 rounded-lg border border-dashed border-border">
              Queue is empty
            </div>
          ) : (
            <div className="space-y-3">
              {downloads.map(download => (
                <div key={download.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 relative overflow-hidden group">
                  {/* Status Icon */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-secondary border border-border/50">
                    {download.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    {download.status === 'failed' && <XCircle className="w-5 h-5 text-destructive" />}
                    {download.status === 'pending' && <Clock className="w-5 h-5 text-muted-foreground" />}
                    {download.status === 'downloading' && <RefreshCw className="w-5 h-5 text-primary animate-spin" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 z-10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate pr-4">
                        {download.title || download.youtubeUrl}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {download.status === 'downloading' ? `${Math.round(download.progress || 0)}%` : download.status}
                      </span>
                    </div>
                    
                    {download.error ? (
                      <p className="text-xs text-destructive truncate">{download.error}</p>
                    ) : (
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            download.status === 'completed' ? 'bg-green-500' : 
                            download.status === 'failed' ? 'bg-destructive' : 'bg-primary'
                          }`}
                          style={{ width: `${download.status === 'completed' ? 100 : (download.progress || 0)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="w-10 flex justify-end z-10">
                    {(download.status === 'pending' || download.status === 'downloading') && (
                      <button 
                        onClick={() => handleCancel(download.id)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Subtle background progress for active downloads */}
                  {download.status === 'downloading' && (
                    <div 
                      className="absolute inset-0 bg-primary/5 transition-all duration-300 z-0"
                      style={{ width: `${download.progress || 0}%` }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
