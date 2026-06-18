import { Link, useLocation } from "wouter";
import { Home, Download, Settings } from "lucide-react";
import { t } from "@/lib/pt-br";

export function MobileNav() {
  const [location] = useLocation();

  const items = [
    { href: "/", icon: Home, label: t.mobileNav.library },
    { href: "/downloads", icon: Download, label: t.mobileNav.downloads },
    { href: "/settings", icon: Settings, label: t.mobileNav.settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 flex">
      {items.map(({ href, icon: Icon, label }) => {
        const active = location === href;
        return (
          <Link key={href} href={href} className="flex-1">
            <div className={`flex flex-col items-center justify-center py-3 gap-1 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
