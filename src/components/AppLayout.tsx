import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Clock,
  Briefcase,
  User,
  LayoutDashboard,
  Leaf,
  Settings,
  BarChart3,
  Shield,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { Role } from "@/lib/database.types";

const roleNavItems: Record<Role, { label: string; path: string; icon: any }[]> = {
  consultant: [
    { label: "Mes temps", path: "/consultant", icon: Clock },
    { label: "Mon tableau de bord", path: "/consultant/dashboard", icon: BarChart3 },
    { label: "Mes missions", path: "/missions", icon: Briefcase },
    { label: "Mon compte", path: "#", icon: User },
  ],
  manager: [
    { label: "Mes temps", path: "/consultant", icon: Clock },
    { label: "Tableau de bord", path: "/manager", icon: LayoutDashboard },
    { label: "Missions", path: "/missions", icon: Briefcase },
    { label: "Mon compte", path: "#", icon: User },
  ],
  admin: [
    { label: "Mes temps", path: "/consultant", icon: Clock },
    { label: "Vue globale", path: "/admin", icon: Shield },
    { label: "Missions", path: "/missions", icon: Briefcase },
    { label: "Paramètres", path: "/settings", icon: Settings },
  ],
};

interface AppLayoutProps {
  children: ReactNode;
  role?: Role;
}

const AppLayout = ({ children, role }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  // Utilise le rôle réel depuis le profil, avec fallback sur la prop (pour démo)
  const activeRole: Role = profile?.role ?? role ?? "consultant";
  const navItems = roleNavItems[activeRole];

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-60 bg-primary flex flex-col flex-shrink-0 h-screen">
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

        {/* Profil utilisateur */}
        <div className="px-4 py-4 border-t border-sidebar-border">
          {profile && (
            <div className="mb-3">
              <div className="text-sm font-medium text-sidebar-foreground truncate">
                {profile.full_name}
              </div>
              <div className="text-xs text-sidebar-foreground/50 truncate">
                {profile.email}
              </div>
              <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground capitalize">
                {profile.role}
              </span>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut size={14} />
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 bg-background overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
