import React from "react";
import { Link, useLocation } from "wouter";
import { Activity, Settings2, ShieldAlert, LogOut, RefreshCw } from "lucide-react";
import { useLogoutBot, useRestartBot } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { toast } = useToast();
  
  const logout = useLogoutBot();
  const restart = useRestartBot();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Logged out successfully" });
      }
    });
  };

  const handleRestart = () => {
    restart.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Bot restarted" });
      }
    });
  };

  const navItems = [
    { href: "/", label: "STATUS", icon: Activity },
    { href: "/warnings", label: "WARNINGS", icon: ShieldAlert },
    { href: "/settings", label: "CONFIG", icon: Settings2 },
  ];

  return (
    <div className="min-h-screen w-full flex bg-background">
      <aside className="w-64 border-r border-border flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <span className="font-bold text-xl tracking-tight text-primary">DLS_CTRL</span>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary border-l-2 border-transparent'}`}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleRestart} disabled={restart.isPending}>
            <RefreshCw className={`h-4 w-4 ${restart.isPending ? 'animate-spin' : ''}`} />
            RESTART
          </Button>
          <Button variant="destructive" className="w-full justify-start gap-2" onClick={handleLogout} disabled={logout.isPending}>
            <LogOut className="h-4 w-4" />
            LOGOUT
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {children}
      </main>
    </div>
  );
}
