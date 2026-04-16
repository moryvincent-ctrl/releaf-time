import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Clock, Briefcase, User, LayoutDashboard, Leaf, Settings, BarChart3, Shield, ChevronDown, CalendarRange } from "lucide-react";

type Role = "consultant" | "manager" | "admin";

const roleNavItems: Record<Role, { label: string; path: string; icon: any }[]> = {
  consultant: [
    { label: "Mes temps", path: "/consultant", icon: Clock },
    { label: "Mon tableau de bord", path: "/consultant/dashboard", icon: BarChart3 },
    { label: "Mes missions", path: "/missions", icon: Briefcase },
    { label: "Mon compte", path: "#", icon: User },
  ],
  manager: [
    { label: "Tableau de bord", path: "/manager", icon: LayoutDashboard },
    { label: "Missions", path: "/missions", icon: Briefcase },
    { label: "Prévisionnel", path: "/manager/forecast", icon: CalendarRange },
    { label: "Mon compte", path: "#", icon: User },
  ],
  admin: [
    { label: "Vue globale", path: "/admin", icon: Shield },
    { label: "Missions", path: "/missions", icon: Briefcase },
    { label: "Prévisionnel", path: "/forecast", icon: CalendarRange },
    { label: "Paramètres", path: "/settings", icon: Settings },
  ],
};

interface AppLayoutProps {
  children: ReactNode;
  role?: Role;
}

const AppLayout = ({ children, role = "consultant" }: AppLayoutProps) => {
  const location = useLocation();
  const navItems = roleNavItems[role];

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 bg-primary flex flex-col flex-shrink-0">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <Leaf size={24} className="text-secondary" />
          <span className="font-heading font-semibold text-lg text-sidebar-foreground">
            Releaf <span className="font-normal">Time</span>
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-border hover:text-sidebar-foreground"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Role switcher for demo */}
        <div className="px-3 py-2 border-t border-sidebar-border">
          <div className="label-uppercase text-sidebar-foreground/50 px-3 mb-2">Rôle actif</div>
          <div className="flex flex-col gap-1">
            <Link to="/consultant" className={`text-xs px-3 py-1.5 rounded ${role === "consultant" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"}`}>Consultant</Link>
            <Link to="/manager" className={`text-xs px-3 py-1.5 rounded ${role === "manager" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"}`}>Manager</Link>
            <Link to="/admin" className={`text-xs px-3 py-1.5 rounded ${role === "admin" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"}`}>Admin</Link>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-sidebar-border">
          <Link to="/" className="text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground">
            Se déconnecter
          </Link>
        </div>
      </aside>

      <main className="flex-1 p-8 bg-background overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
