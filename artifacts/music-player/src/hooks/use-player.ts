import { useState, useEffect } from "react";
import { LocalTrack, getAudioSrc } from "@/lib/local-db";

export interface PlayableTrack extends LocalTrack {
  audioSrc: string;
}

type PlayerState = {
  currentTrack: PlayableTrack | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  volume: number;
  queue: PlayableTrack[];
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
function notify() { listeners.forEach(l => l()); }

export async function playTrack(track: LocalTrack, queue: LocalTrack[] = []) {
  const audioSrc = await getAudioSrc(track);
  const playable: PlayableTrack = { ...track, audioSrc };

  // Resolve queue src lazily — only the current track needs to be resolved immediately
  const playableQueue: PlayableTrack[] = queue.map(t =>
    t.id === track.id ? playable : { ...t, audioSrc: "" }
  );

  globalState = {
    ...globalState,
    currentTrack: playable,
    isPlaying: true,
    progress: 0,
    currentTime: 0,
    queue: playableQueue.length > 0 ? playableQueue : globalState.queue,
  };
  notify();
}

export function togglePlayPause() {
  if (!globalState.currentTrack) return;
  globalState = { ...globalState, isPlaying: !globalState.isPlaying };
  notify();
}

export async function nextTrack() {
  if (!globalState.currentTrack || globalState.queue.length === 0) return;
  const idx = globalState.queue.findIndex(t => t.id === globalState.currentTrack?.id);
  if (idx === -1 || idx === globalState.queue.length - 1) return;
  const next = globalState.queue[idx + 1];
  await playTrack(next, globalState.queue);
}

export async function prevTrack() {
  if (!globalState.currentTrack || globalState.queue.length === 0) return;
  if (globalState.currentTime > 3) {
    globalState = { ...globalState, currentTime: 0, progress: 0 };
    notify();
    return;
  }
  const idx = globalState.queue.findIndex(t => t.id === globalState.currentTrack?.id);
  if (idx <= 0) return;
  const prev = globalState.queue[idx - 1];
  await playTrack(prev, globalState.queue);
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
    progress: time / (globalState.currentTrack.duration || 1),
  };
  notify();
}

export function updateProgress(currentTime: number, duration: number) {
  globalState = {
    ...globalState,
    currentTime,
    progress: duration > 0 ? currentTime / duration : 0,
  };
  notify();
}

export function handleTrackEnd() { nextTrack(); }

export function usePlayer() {
  const [state, setState] = useState(globalState);
  useEffect(() => {
    const l = () => setState({ ...globalState });
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return state;
}
