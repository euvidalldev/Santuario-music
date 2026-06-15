import React from "react";
import { useListTracks, getListTracksQueryKey, useGetStats, getGetStatsQueryKey } from "@workspace/api-client-react";
import { TrackList } from "@/components/ui/track-list";
import { Play } from "lucide-react";
import { playTrack } from "@/hooks/use-player";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { data: tracks = [], isLoading } = useListTracks({ folderId: null }, { 
    query: { queryKey: getListTracksQueryKey({ folderId: null }) } 
  });
  const { data: stats } = useGetStats({ 
    query: { queryKey: getGetStatsQueryKey() } 
  });

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Hero Section */}
      <div className="px-8 py-10 pt-16 flex flex-col gap-6 relative">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <div className="w-64 h-64 rounded-full bg-primary blur-[100px]" />
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight text-foreground relative z-10">All Tracks</h1>
        
        <div className="flex items-center gap-6 relative z-10">
          <Button 
            size="lg" 
            className="rounded-full px-8 shadow-[0_0_20px_rgba(200,80,0,0.3)] hover:shadow-[0_0_30px_rgba(200,80,0,0.5)] transition-all font-semibold"
            onClick={handlePlayAll}
            disabled={tracks.length === 0}
          >
            <Play className="w-5 h-5 mr-2 fill-current" />
            Play All
          </Button>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
            <span>{tracks.length} tracks</span>
            {stats && (
              <>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>{(stats.totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB total</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 pb-10">
        <TrackList tracks={tracks} isLoading={isLoading} />
      </div>
    </div>
  );
}
