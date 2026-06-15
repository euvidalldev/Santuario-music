import React, { useState, useRef } from "react";
import { useListDownloads, useStartDownload, useCancelDownload, getListDownloadsQueryKey, getListTracksQueryKey, useListFolders } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, AlertCircle, CheckCircle2, XCircle, RefreshCw, X, Folder as FolderIcon, Clock, Upload, Music, FileAudio } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface UploadItem {
  name: string;
  status: "pending" | "done" | "error";
  error?: string;
}

export default function Downloads() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("none");

  const [uploadFolder, setUploadFolder] = useState<string>("none");
  const [uploading, setUploading] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const { data: downloads = [], isLoading } = useListDownloads({
    query: {
      queryKey: getListDownloadsQueryKey(),
      refetchInterval: (query) => {
        const hasActive = query.state.data?.some(d => d.status === "pending" || d.status === "downloading");
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

  const uploadFiles = async (files: File[]) => {
    const audioFiles = files.filter(f => f.type.startsWith("audio/") || f.name.toLowerCase().endsWith(".mp3") || f.name.toLowerCase().endsWith(".m4a") || f.name.toLowerCase().endsWith(".flac") || f.name.toLowerCase().endsWith(".wav") || f.name.toLowerCase().endsWith(".ogg"));
    if (audioFiles.length === 0) {
      toast({ title: "No audio files found", description: "Only MP3, M4A, FLAC, WAV, OGG files are supported.", variant: "destructive" });
      return;
    }

    setUploading(true);
    setUploadItems(audioFiles.map(f => ({ name: f.name, status: "pending" })));

    const formData = new FormData();
    audioFiles.forEach(f => formData.append("files", f));
    if (uploadFolder !== "none") {
      formData.append("folderId", uploadFolder);
    }

    try {
      const res = await fetch("/api/tracks/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      const { results } = await res.json() as { results: { success: boolean; title?: string; error?: string }[] };

      setUploadItems(audioFiles.map((f, i) => ({
        name: results[i]?.title || f.name,
        status: results[i]?.success ? "done" : "error",
        error: results[i]?.error,
      })));

      const succeeded = results.filter(r => r.success).length;
      queryClient.invalidateQueries({ queryKey: getListTracksQueryKey() });
      toast({ title: `${succeeded} track${succeeded !== 1 ? "s" : ""} imported successfully` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadItems(audioFiles.map(f => ({ name: f.name, status: "error", error: msg })));
      toast({ title: "Import failed", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);

  return (
    <div className="flex flex-col min-h-full max-w-5xl mx-auto w-full">
      <div className="px-4 md:px-8 py-10 pt-10 md:pt-16 flex flex-col gap-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Downloads</h1>

        {/* YouTube download form */}
        <div className="bg-card border border-border p-6 rounded-xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[50px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">From YouTube</p>
          <form onSubmit={handleStart} className="flex flex-col md:flex-row gap-3 relative z-10">
            <div className="flex-1">
              <Input
                placeholder="Paste YouTube URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-12 text-base bg-background/50"
              />
            </div>
            <div className="w-full md:w-44">
              <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                <SelectTrigger className="h-12 bg-background/50">
                  <div className="flex items-center gap-2">
                    <FolderIcon className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Folder" />
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
              {startDownload.isPending ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Download className="w-5 h-5 mr-2" />}
              Download
            </Button>
          </form>
        </div>

        {/* Import from device */}
        <div className="bg-card border border-border p-6 rounded-xl shadow-lg relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-[50px] pointer-events-none translate-y-1/2 -translate-x-1/2" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Import from Device</p>

          <div className="flex flex-col md:flex-row gap-3 mb-4 relative z-10">
            <div className="w-full md:w-44">
              <Select value={uploadFolder} onValueChange={setUploadFolder}>
                <SelectTrigger className="h-10 bg-background/50">
                  <div className="flex items-center gap-2">
                    <FolderIcon className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Folder" />
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
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <FileAudio className="w-4 h-4 mr-2" />
              Choose Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.m4a,.flac,.wav,.ogg"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`relative z-10 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all select-none
              ${isDragOver
                ? "border-primary bg-primary/10 scale-[1.01]"
                : "border-border hover:border-primary/50 hover:bg-card/60"
              } ${uploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors ${isDragOver ? "bg-primary/20 border-primary" : "bg-secondary border-border"}`}>
                {uploading
                  ? <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                  : <Upload className={`w-5 h-5 ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
                }
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {uploading ? "Importing..." : isDragOver ? "Drop to import" : "Drag & drop audio files here"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">MP3, M4A, FLAC, WAV, OGG — up to 200 MB each</p>
              </div>
            </div>
          </div>

          {/* Upload results */}
          {uploadItems.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 relative z-10">
              {uploadItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-background/50 border border-border/50">
                  <Music className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-sm truncate text-foreground">{item.name}</span>
                  {item.status === "pending" && <RefreshCw className="w-4 h-4 text-primary animate-spin flex-shrink-0" />}
                  {item.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                  {item.status === "error" && (
                    <div className="flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                      {item.error && <span className="text-xs text-destructive max-w-[120px] truncate">{item.error}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Download Queue */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">YouTube Queue</h2>

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
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-secondary border border-border/50">
                    {download.status === "completed" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    {download.status === "failed" && <XCircle className="w-5 h-5 text-destructive" />}
                    {download.status === "pending" && <Clock className="w-5 h-5 text-muted-foreground" />}
                    {download.status === "downloading" && <RefreshCw className="w-5 h-5 text-primary animate-spin" />}
                  </div>

                  <div className="flex-1 min-w-0 z-10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate pr-4">
                        {download.title || download.youtubeUrl}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {download.status === "downloading" ? `${Math.round(download.progress || 0)}%` : download.status}
                      </span>
                    </div>

                    {download.error ? (
                      <p className="text-xs text-destructive truncate">{download.error}</p>
                    ) : (
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            download.status === "completed" ? "bg-green-500" :
                            download.status === "failed" ? "bg-destructive" : "bg-primary"
                          }`}
                          style={{ width: `${download.status === "completed" ? 100 : (download.progress || 0)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="w-10 flex justify-end z-10">
                    {(download.status === "pending" || download.status === "downloading") && (
                      <button
                        onClick={() => handleCancel(download.id)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {download.status === "downloading" && (
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
