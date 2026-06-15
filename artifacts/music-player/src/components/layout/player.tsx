import React, { useEffect, useRef } from "react";
import { usePlayer, togglePlayPause, prevTrack, nextTrack, setVolume, updateProgress, handleTrackEnd, seekTo } from "@/hooks/use-player";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { formatDuration } from "@/lib/format";

export function AudioPlayer() {
  const playerState = usePlayer();
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentTrack, isPlaying, volume, currentTime } = playerState;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current && currentTrack) {
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack]);

  // Handle seek from external (when audio time is different from state time by a margin)
  useEffect(() => {
    if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 1) {
      audioRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const handleTimeUpdate = () => {
    if (audioRef.current && currentTrack) {
      updateProgress(audioRef.current.currentTime, currentTrack.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (currentTrack) {
      seekTo(value[0]);
    }
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-card border-t border-border flex items-center px-6 z-50 animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
      <audio
        ref={audioRef}
        src={`/api/tracks/${currentTrack.id}/stream`}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleTrackEnd}
      />
      
      {/* Track Info */}
      <div className="flex items-center w-1/3 gap-4">
        <div className="w-14 h-14 bg-muted rounded-md overflow-hidden flex-shrink-0 relative group">
          {currentTrack.thumbnailUrl ? (
            <img 
              src={currentTrack.thumbnailUrl} 
              alt={currentTrack.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary">
              <span className="text-muted-foreground text-xs font-medium">No Art</span>
            </div>
          )}
          <div className="absolute inset-0 border border-white/10 rounded-md pointer-events-none"></div>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold truncate text-foreground tracking-tight">{currentTrack.title}</span>
          <span className="text-xs text-muted-foreground truncate">{currentTrack.artist}</span>
        </div>
      </div>

      {/* Controls & Progress */}
      <div className="flex flex-col items-center justify-center w-1/3 gap-2">
        <div className="flex items-center gap-6">
          <button 
            onClick={prevTrack}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          
          <button 
            onClick={togglePlayPause}
            className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(200,80,0,0.3)]"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-1" />
            )}
          </button>
          
          <button 
            onClick={nextTrack}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>
        
        <div className="flex items-center gap-3 w-full max-w-md">
          <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">
            {formatDuration(currentTime)}
          </span>
          <Slider
            value={[currentTime]}
            max={currentTrack.duration || 100}
            step={1}
            onValueChange={handleSeek}
            className="flex-1"
          />
          <span className="text-[10px] font-mono text-muted-foreground w-10">
            {formatDuration(currentTrack.duration)}
          </span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center justify-end w-1/3 gap-3 pr-4">
        <button 
          onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {volume === 0 ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
        <div className="w-24">
          <Slider
            value={[volume * 100]}
            max={100}
            step={1}
            onValueChange={(val) => setVolume(val[0] / 100)}
          />
        </div>
      </div>
    </div>
  );
}
