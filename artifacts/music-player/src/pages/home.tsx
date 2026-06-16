import React from "react";
import { TrackList } from "@/components/ui/track-list";
import { Play } from "lucide-react";
import { playTrack } from "@/hooks/use-player";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";
import { useLocalTracks, useLocalStats } from "@/hooks/use-local-library";

export default function Home() {
  const { tracks, isLoading } = useLocalTracks(null);
  const stats = useLocalStats();

  const handlePlayAll = () => {
    if (tracks.length > 0) playTrack(tracks[0], tracks);
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-4 md:px-8 pt-8 pb-4 md:pt-14 md:pb-6 flex flex-col gap-4 relative">
        <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
          <div className="w-48 h-48 rounded-full bg-primary blur-[80px]" />
        </div>
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground relative z-10">All Tracks</h1>
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <Button size="default" className="rounded-full px-6 shadow-[0_0_20px_rgba(200,80,0,0.3)] font-semibold" onClick={handlePlayAll} disabled={tracks.length === 0}>
            <Play className="w-4 h-4 mr-2 fill-current" /> Play All
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span>{tracks.length} tracks</span>
            {stats.totalSize > 0 && (
              <><span className="w-1 h-1 rounded-full bg-border inline-block" /><span>{formatFileSize(stats.totalSize)}</span></>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1">
        <TrackList tracks={tracks} isLoading={isLoading} />
      </div>
    </div>
  );
}
