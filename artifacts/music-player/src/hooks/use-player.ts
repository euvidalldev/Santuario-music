import { useState, useRef, useEffect } from "react";
import { Track } from "@workspace/api-client-react";

type PlayerState = {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number; // 0 to 1
  currentTime: number; // seconds
  volume: number; // 0 to 1
  queue: Track[];
};

let globalState: PlayerState = {
  currentTrack: null,
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  volume: 0.8,
  queue: [],
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function playTrack(track: Track, queue: Track[] = []) {
  globalState = {
    ...globalState,
    currentTrack: track,
    isPlaying: true,
    progress: 0,
    currentTime: 0,
    queue: queue.length > 0 ? queue : globalState.queue,
  };
  notify();
}

export function togglePlayPause() {
  if (!globalState.currentTrack) return;
  globalState = {
    ...globalState,
    isPlaying: !globalState.isPlaying,
  };
  notify();
}

export function nextTrack() {
  if (!globalState.currentTrack || globalState.queue.length === 0) return;
  const currentIndex = globalState.queue.findIndex((t) => t.id === globalState.currentTrack?.id);
  if (currentIndex === -1 || currentIndex === globalState.queue.length - 1) return;
  
  playTrack(globalState.queue[currentIndex + 1], globalState.queue);
}

export function prevTrack() {
  if (!globalState.currentTrack || globalState.queue.length === 0) return;
  
  // If we're more than 3 seconds in, just restart current track
  if (globalState.currentTime > 3) {
    globalState = { ...globalState, currentTime: 0, progress: 0 };
    notify();
    return;
  }
  
  const currentIndex = globalState.queue.findIndex((t) => t.id === globalState.currentTrack?.id);
  if (currentIndex <= 0) return;
  
  playTrack(globalState.queue[currentIndex - 1], globalState.queue);
}

export function setVolume(volume: number) {
  globalState = { ...globalState, volume };
  notify();
}

export function seekTo(time: number) {
  if (!globalState.currentTrack) return;
  globalState = { 
    ...globalState, 
    currentTime: time,
    progress: time / globalState.currentTrack.duration
  };
  notify();
}

// Private updates from the audio element
export function updateProgress(currentTime: number, duration: number) {
  globalState = {
    ...globalState,
    currentTime,
    progress: duration > 0 ? currentTime / duration : 0,
  };
  notify();
}

export function handleTrackEnd() {
  nextTrack();
}

export function usePlayer() {
  const [state, setState] = useState(globalState);

  useEffect(() => {
    const listener = () => setState(globalState);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}
