import React from "react";
import { Sidebar } from "./sidebar";
import { AudioPlayer } from "./player";
import { usePlayer } from "@/hooks/use-player";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentTrack } = usePlayer();
  
  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/20">
      <Sidebar />
      <main className={`flex-1 relative overflow-hidden flex flex-col ${currentTrack ? 'pb-24' : ''}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-card/30 to-transparent pointer-events-none z-0 h-64"></div>
        <div className="flex-1 overflow-y-auto z-10 relative">
          {children}
        </div>
      </main>
      <AudioPlayer />
    </div>
  );
}
