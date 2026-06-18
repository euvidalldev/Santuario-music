import React, { useEffect, useRef } from "react";
import { usePlayer, togglePlayPause, prevTrack, nextTrack, setVolume, updateProgress, handleTrackEnd, seekTo } from "@/hooks/use-player";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { t } from "@/lib/pt-br";

export function AudioPlayer() {
  const playerState = usePlayer();
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentTrack, isPlaying, volume, currentTime } = playerState;

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;
    if (audioRef.current.src !== currentTrack.audioSrc) {
      audioRef.current.src = currentTrack.audioSrc;
      audioRef.current.load();
    }
    if (isPlaying) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 1) {
      audioRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const handleTimeUpdate = () => {
    if (audioRef.current && currentTrack)
      updateProgress(audioRef.current.currentTime, currentTrack.duration);
  };

  const handleSeek = (value: number[]) => { if (currentTrack) seekTo(value[0]); };

  if (!currentTrack) return null;

  return (
    <>
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={handleTrackEnd} />

      <div className="md:hidden fixed bottom-[56px] left-0 right-0 bg-card border-t border-border z-40 animate-in slide-in-from-bottom-full duration-300 shadow-[0_-6px_20px_rgba(0,0,0,0.3)]">
        <div className="px-3 pt-2">
          <Slider value={[currentTime]} max={currentTrack.duration || 100} step={1} onValueChange={handleSeek} className="w-full" />
        </div>
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="w-10 h-10 rounded bg-muted overflow-hidden flex-shrink-0">
            {currentTrack.thumbnailUrl
              ? <img src={currentTrack.thumbnailUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-secondary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground">{currentTrack.title}</p>
            <p className="text-[10px] text-muted-foreground font-mono">
              {formatDuration(currentTime)} / {formatDuration(currentTrack.duration)}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={() => prevTrack()} className="text-muted-foreground hover:text-foreground transition-colors">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button onClick={togglePlayPause} className="w-9 h-9 flex items-center justify-center bg-primary text-primary-foreground rounded-full shadow-[0_0_12px_rgba(200,80,0,0.3)] active:scale-95 transition-all">
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <button onClick={() => nextTrack()} className="text-muted-foreground hover:text-foreground transition-colors">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>
      </div>

      <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-card border-t border-border items-center px-6 z-50 animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        <div className="flex items-center w-1/3 gap-4">
          <div className="w-14 h-14 bg-muted rounded-md overflow-hidden flex-shrink-0 relative group">
            {currentTrack.thumbnailUrl
              ? <img src={currentTrack.thumbnailUrl} alt={currentTrack.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              : <div className="w-full h-full flex items-center justify-center bg-secondary"><span className="text-muted-foreground text-xs font-medium">{t.player.noArt}</span></div>}
            <div className="absolute inset-0 border border-white/10 rounded-md pointer-events-none" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate text-foreground tracking-tight">{currentTrack.title}</span>
            <span className="text-xs text-muted-foreground truncate">{currentTrack.artist}</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center w-1/3 gap-2">
          <div className="flex items-center gap-6">
            <button onClick={() => prevTrack()} className="text-muted-foreground hover:text-foreground transition-colors">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button onClick={togglePlayPause} className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(200,80,0,0.3)]">
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
            </button>
            <button onClick={() => nextTrack()} className="text-muted-foreground hover:text-foreground transition-colors">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
          <div className="flex items-center gap-3 w-full max-w-md">
            <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{formatDuration(currentTime)}</span>
            <Slider value={[currentTime]} max={currentTrack.duration || 100} step={1} onValueChange={handleSeek} className="flex-1" />
            <span className="text-[10px] font-mono text-muted-foreground w-10">{formatDuration(currentTrack.duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-end w-1/3 gap-3 pr-4">
          <button onClick={() => setVolume(volume === 0 ? 0.8 : 0)} className="text-muted-foreground hover:text-foreground transition-colors">
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="w-24">
            <Slider value={[volume * 100]} max={100} step={1} onValueChange={(val) => setVolume(val[0] / 100)} />
          </div>
        </div>
      </div>
    </>
  );
}
