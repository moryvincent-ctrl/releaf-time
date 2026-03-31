import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Clock, Briefcase, User, LayoutDashboard, Leaf } from "lucide-react";

const navItems = [
  { label: "Mes temps", path: "/consultant", icon: Clock, role: "consultant" },
  { label: "Mes missions", path: "#", icon: Briefcase, role: "consultant" },
  { label: "Mon compte", path: "#", icon: User, role: "consultant" },
  { label: "Tableau de bord", path: "/dashboard", icon: LayoutDashboard, role: "manager" },
];

interface AppLayoutProps {
  children: ReactNode;
  active: "temps" | "missions" | "compte" | "dashboard";
}

const activeMap: Record<string, string> = {
  temps: "/consultant",
  missions: "#",
  compte: "#",
  dashboard: "/dashboard",
};

const AppLayout = ({ children, active }: AppLayoutProps) => {
  const activePath = activeMap[active];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 bg-primary flex flex-col flex-shrink-0">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <Leaf size={24} className="text-secondary" />
          <span className="font-heading font-semibold text-lg text-sidebar-foreground">
            Releaf <span className="font-normal">Time</span>
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = item.path === activePath;
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

        <div className="px-5 py-4 border-t border-sidebar-border">
          <Link to="/" className="text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground">
            Se déconnecter
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 bg-background overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
