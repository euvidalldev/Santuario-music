import React, { useState } from "react";
import { Settings as SettingsIcon, Zap, Cookie } from "lucide-react";
import { useSettings, type DownloadQuality } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";

const QUALITIES: { value: DownloadQuality; label: string; desc: string; size: string }[] = [
  { value: "64K",  label: "64 kbps",  desc: "Small",   size: "~1.4 MB / min" },
  { value: "128K", label: "128 kbps", desc: "Balanced", size: "~2.8 MB / min" },
  { value: "192K", label: "192 kbps", desc: "Good",     size: "~4.3 MB / min" },
  { value: "256K", label: "256 kbps", desc: "High",     size: "~5.8 MB / min" },
];

export default function Settings() {
  const { settings, setSettings } = useSettings();
  const { toast } = useToast();

  const handleQuality = (value: DownloadQuality) => {
    setSettings({ downloadQuality: value });
    toast({ title: "Settings saved", description: `Download quality set to ${value}` });
  };

  return (
    <div className="flex flex-col min-h-full max-w-2xl mx-auto w-full">
      <div className="px-4 md:px-8 pt-8 pb-4 md:pt-14 md:pb-6 flex items-center gap-3">
        <SettingsIcon className="w-6 h-6 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Settings</h1>
      </div>

      <div className="px-4 md:px-8 pb-10 flex flex-col gap-6">
        {/* Download Quality */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Download Quality</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                AAC (.m4a) bitrate for YouTube downloads. Higher = better sound, larger file.
              </p>
            </div>
          </div>

          <div className="divide-y divide-border/40">
            {QUALITIES.map((q) => {
              const active = settings.downloadQuality === q.value;
              return (
                <button
                  key={q.value}
                  onClick={() => handleQuality(q.value)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors text-left
                    ${active ? "bg-primary/10" : "hover:bg-secondary/60"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                      ${active ? "border-primary" : "border-muted-foreground/40"}`}>
                      {active && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <span className={`text-sm font-medium ${active ? "text-primary" : "text-foreground"}`}>
                        {q.label}
                      </span>
                      <span className={`text-xs ml-2 ${active ? "text-primary/70" : "text-muted-foreground"}`}>
                        — {q.desc}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{q.size}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* YouTube Cookies */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2">
            <Cookie className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">YouTube Cookies</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Required to bypass YouTube bot detection. Export from browser with "Get cookies.txt LOCALLY" extension and paste below.
              </p>
            </div>
          </div>
          <div className="px-5 py-4">
            <textarea
              className="w-full h-32 bg-secondary/50 border border-border rounded-lg p-3 text-xs font-mono text-foreground resize-y"
              placeholder="Paste your YouTube cookies here (Netscape format)..."
              value={settings.youtubeCookies}
              onChange={(e) => setSettings({ youtubeCookies: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Your cookies are stored locally and never shared.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Changes apply to new downloads only. Existing tracks are not affected.
        </p>
      </div>
    </div>
  );
}
