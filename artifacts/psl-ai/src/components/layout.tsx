import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Trophy, Info, BarChart3 } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/",           label: "Team Selector", icon: LayoutDashboard },
    { href: "/players",    label: "Players",       icon: Users },
    { href: "/leaderboard",label: "Leaderboard",   icon: Trophy },
    { href: "/statistics", label: "Statistics",    icon: BarChart3 },
    { href: "/about",      label: "AI Info",       icon: Info },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 border-r border-border bg-sidebar shrink-0 flex flex-col hidden md:flex">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight gold-shimmer">PSL AI</h1>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Premium Analytics</p>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
