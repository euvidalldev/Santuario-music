import React from "react";
import { Sidebar } from "./sidebar";
import { AudioPlayer } from "./player";
import { MobileNav } from "./mobile-nav";
import { usePlayer } from "@/hooks/use-player";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentTrack } = usePlayer();

  // On mobile: bottom nav (56px) + player (72px when active) = 128px padding
  // On desktop: player (96px) when active
  const mobilePb = currentTrack ? "pb-[128px]" : "pb-[56px]";
  const desktopPb = currentTrack ? "md:pb-24" : "md:pb-0";

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/20">
      {/* Sidebar — desktop only */}
      <Sidebar />

      <main className={`flex-1 relative overflow-hidden flex flex-col ${mobilePb} ${desktopPb}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-card/30 to-transparent pointer-events-none z-0 h-64" />
        <div className="flex-1 overflow-y-auto z-10 relative">
          {children}
        </div>
      </main>

      {/* Bottom nav — mobile only */}
      <MobileNav />

      {/* Audio player — above bottom nav on mobile */}
      <AudioPlayer />
    </div>
  );
}
