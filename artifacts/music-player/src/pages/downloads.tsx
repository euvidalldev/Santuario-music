import React, { useState, useRef } from "react";
import { Download, CheckCircle2, XCircle, RefreshCw, X, Folder as FolderIcon, Upload, Music, FileAudio, Settings, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { useLocalFolders, refreshLibrary } from "@/hooks/use-local-library";
import { useLocalDownload } from "@/hooks/use-local-download";
import { saveAudioFile, addTrack, newId, LocalTrack } from "@/lib/local-db";
import { Link } from "wouter";
import { getApiBaseUrl } from "@/lib/api-url";
import { t } from "@/lib/pt-br";

interface UploadItem { name: string; status: "pending" | "done" | "error"; error?: string; }

export default function Downloads() {
  const { toast } = useToast();
  const { settings } = useSettings();
  const { folders } = useLocalFolders();
  const { queue, download, removeFromQueue } = useLocalDownload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("none");
  const [uploadFolder, setUploadFolder] = useState<string>("none");
  const [uploading, setUploading] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const folderId = selectedFolder !== "none" ? selectedFolder : null;
    setUrl("");
    await download(url.trim(), settings.downloadQuality, folderId);
  };

  const uploadFiles = async (files: File[]) => {
    const audioFiles = files.filter(f =>
      f.type.startsWith("audio/") ||
      [".mp3", ".m4a", ".flac", ".wav", ".ogg"].some(ext => f.name.toLowerCase().endsWith(ext))
    );
    if (!audioFiles.length) {
      toast({ title: t.downloads.noAudioFiles, description: t.downloads.supportedFormats, variant: "destructive" });
      return;
    }
    setUploading(true);
    setUploadItems(audioFiles.map(f => ({ name: f.name, status: "pending" })));
    const folderId = uploadFolder !== "none" ? uploadFolder : null;

    const results: UploadItem[] = [];
    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      try {
        const trackId = newId();
        const { localPath } = await saveAudioFile(trackId, file, file.name);
        const track: LocalTrack = {
          id: trackId,
          title: file.name.replace(/\.[^.]+$/, ""),
          artist: "Artista Desconhecido",
          duration: 0,
          fileSize: file.size,
          localPath,
          thumbnailUrl: null,
          youtubeUrl: null,
          folderId,
          downloadedAt: new Date().toISOString(),
        };

        try {
          const formData = new FormData();
          formData.append("files", file);
          if (folderId) formData.append("folderId", folderId);
          const res = await fetch(`${getApiBaseUrl()}/api/tracks/upload`, { method: "POST", body: formData });
          if (res.ok) {
            const { results: serverResults } = await res.json() as { results: { success: boolean; title?: string; artist?: string; duration?: number }[] };
            if (serverResults[0]?.success) {
              track.title  = serverResults[0].title  ?? track.title;
              track.artist = serverResults[0].artist ?? track.artist;
              track.duration = serverResults[0].duration ?? 0;
            }
          }
        } catch {}

        await addTrack(track);
        results.push({ name: track.title, status: "done" });
      } catch (err) {
        results.push({ name: file.name, status: "error", error: err instanceof Error ? err.message : "Falhou" });
      }
      setUploadItems([...results, ...audioFiles.slice(results.length).map(f => ({ name: f.name, status: "pending" as const }))]);
    }

    refreshLibrary();
    setUploading(false);
    const succeeded = results.filter(r => r.status === "done").length;
    toast({ title: t.downloads.imported(succeeded) });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) uploadFiles(Array.from(e.target.files));
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  };

  const activeQueue = queue.filter(d => d.status !== "done" || queue.indexOf(d) >= queue.length - 5);

  return (
    <div className="flex flex-col min-h-full max-w-5xl mx-auto w-full">
      <div className="px-4 md:px-8 pt-8 pb-4 md:pt-14 md:pb-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">{t.downloads.title}</h1>
          <Link href="/settings">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors cursor-pointer">
              <Settings className="w-3.5 h-3.5" />
              <span className="font-mono">{t.downloads.quality(settings.downloadQuality)}</span>
            </div>
          </Link>
        </div>

        <div className="bg-card border border-border p-5 rounded-xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[50px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">{t.downloads.fromYoutube}</p>
          <form onSubmit={handleStart} className="flex flex-col md:flex-row gap-3 relative z-10">
            <div className="flex-1">
              <Input placeholder={t.downloads.pasteUrl} value={url} onChange={e => setUrl(e.target.value)} className="h-12 text-base bg-background/50" />
            </div>
            <div className="w-full md:w-44">
              <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                <SelectTrigger className="h-12 bg-background/50">
                  <div className="flex items-center gap-2"><FolderIcon className="w-4 h-4 text-muted-foreground" /><SelectValue placeholder={t.downloads.folder} /></div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.downloads.noFolder}</SelectItem>
                  {folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="lg" className="h-12 px-8 font-semibold shadow-md" disabled={!url.trim()}>
              <Download className="w-5 h-5 mr-2" /> {t.downloads.download}
            </Button>
          </form>
        </div>

        {activeQueue.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t.downloads.queue}</h2>
            {activeQueue.map(item => (
              <div key={item.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 relative overflow-hidden">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-secondary border border-border/50">
                  {item.status === "done"            && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  {item.status === "error"           && <XCircle      className="w-5 h-5 text-destructive" />}
                  {item.status === "idle"            && <Clock        className="w-5 h-5 text-muted-foreground" />}
                  {(item.status === "fetching_info" || item.status === "downloading" || item.status === "saving") &&
                    <RefreshCw className="w-5 h-5 text-primary animate-spin" />}
                </div>
                <div className="flex-1 min-w-0 z-10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate pr-4">{item.title}</span>
                    <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {item.status === "done" ? t.downloads.saved :
                       item.status === "error" ? t.downloads.failed :
                       item.status === "fetching_info" ? t.downloads.gettingInfo :
                       item.status === "saving" ? t.downloads.saving :
                       `${Math.round(item.progress)}%`}
                    </span>
                  </div>
                  {item.error
                    ? <p className="text-xs text-destructive truncate">{item.error}</p>
                    : <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${item.status === "done" ? "bg-green-500" : item.status === "error" ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${item.status === "done" ? 100 : item.progress}%` }} />
                      </div>}
                </div>
                {(item.status === "done" || item.status === "error") && (
                  <button onClick={() => removeFromQueue(item.id)} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors z-10">
                    <X className="w-4 h-4" />
                  </button>
                )}
                {item.status === "downloading" && (
                  <div className="absolute inset-0 bg-primary/5 transition-all duration-300 z-0" style={{ width: `${item.progress}%` }} />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-card border border-border p-5 rounded-xl shadow-lg relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-[50px] pointer-events-none translate-y-1/2 -translate-x-1/2" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">{t.downloads.importFromDevice}</p>
          <div className="flex flex-col md:flex-row gap-3 mb-4 relative z-10">
            <div className="w-full md:w-44">
              <Select value={uploadFolder} onValueChange={setUploadFolder}>
                <SelectTrigger className="h-10 bg-background/50">
                  <div className="flex items-center gap-2"><FolderIcon className="w-4 h-4 text-muted-foreground" /><SelectValue /></div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.downloads.noFolder}</SelectItem>
                  {folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" className="h-10" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <FileAudio className="w-4 h-4 mr-2" /> {t.downloads.chooseFiles}
            </Button>
            <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.m4a,.flac,.wav,.ogg" multiple className="hidden" onChange={handleFileChange} />
          </div>

          <div onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`relative z-10 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all select-none
              ${isDragOver ? "border-primary bg-primary/10 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-card/60"}
              ${uploading ? "pointer-events-none opacity-60" : ""}`}>
            <div className="flex flex-col items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors ${isDragOver ? "bg-primary/20 border-primary" : "bg-secondary border-border"}`}>
                {uploading ? <RefreshCw className="w-5 h-5 text-primary animate-spin" /> : <Upload className={`w-5 h-5 ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{uploading ? t.downloads.importing : isDragOver ? t.downloads.dropToImport : t.downloads.dragAndDrop}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.downloads.savedToDevice}</p>
              </div>
            </div>
          </div>

          {uploadItems.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 relative z-10">
              {uploadItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-background/50 border border-border/50">
                  <Music className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-sm truncate text-foreground">{item.name}</span>
                  {item.status === "pending" && <RefreshCw className="w-4 h-4 text-primary animate-spin flex-shrink-0" />}
                  {item.status === "done"    && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                  {item.status === "error"   && <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
