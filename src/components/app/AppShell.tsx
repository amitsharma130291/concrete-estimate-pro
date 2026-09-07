import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  LayoutTemplate,
  Activity,
  Boxes,
  ClipboardCheck,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { WorkspaceProvider } from "../../lib/workspaceContext";
import OverviewTab from "./tabs/OverviewTab";
import EstimatesTab from "./tabs/EstimatesTab";
import TemplatesTab from "./tabs/TemplatesTab";
import RateHealthTab from "./tabs/RateHealthTab";
import CatalogTab from "./tabs/CatalogTab";
import ActualsTab from "./tabs/ActualsTab";
import SettingsTab from "./tabs/SettingsTab";

export type AppTab = "overview" | "estimates" | "templates" | "rate-health" | "catalog" | "actuals" | "settings";

const TAB_COMPONENTS: Record<AppTab, React.ComponentType> = {
  overview: OverviewTab,
  estimates: EstimatesTab,
  templates: TemplatesTab,
  "rate-health": RateHealthTab,
  catalog: CatalogTab,
  actuals: ActualsTab,
  settings: SettingsTab,
};

const NAV: { key: AppTab; label: string; href: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Overview", href: "/app", icon: LayoutDashboard },
  { key: "estimates", label: "Current Estimate", href: "/app/estimates", icon: FileText },
  { key: "templates", label: "Templates", href: "/app/templates", icon: LayoutTemplate },
  { key: "rate-health", label: "Rate Health", href: "/app/rate-health", icon: Activity },
  { key: "catalog", label: "Catalog", href: "/app/catalog", icon: Boxes },
  { key: "actuals", label: "Estimate vs Actual", href: "/app/actuals", icon: ClipboardCheck },
  { key: "settings", label: "Settings", href: "/app/settings", icon: Settings },
];

export default function AppShell({ activeTab }: { activeTab: AppTab }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const TabComponent = TAB_COMPONENTS[activeTab];

  return (
    <WorkspaceProvider>
      <div className="flex min-h-screen bg-warm-white">
        {/* Desktop sidebar — full sidebar only at 1200px+; tablet and mobile use the drawer below */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-charcoal-light bg-charcoal text-white min-[1200px]:flex no-print">
          <SidebarContent activeTab={activeTab} />
        </aside>

        {/* Tablet + mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 min-[1200px]:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
            <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-charcoal text-white shadow-xl">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="font-semibold">Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="rounded-lg p-1.5 text-white/70 hover:bg-charcoal-light hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <SidebarContent activeTab={activeTab} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-white px-4 py-3 min-[1200px]:hidden no-print">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="rounded-lg border border-border p-2 text-ink"
            >
              <Menu size={20} />
            </button>
            <span className="text-sm font-semibold text-ink">{NAV.find((n) => n.key === activeTab)?.label ?? "Concrete Cost Pro"}</span>
            <a href="/" className="text-xs font-medium text-orange">
              Site
            </a>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <TabComponent />
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}

function SidebarContent({ activeTab, onNavigate }: { activeTab: AppTab; onNavigate?: () => void }) {
  return (
    <>
      <a href="/" className="flex items-center gap-2.5 px-5 py-5" onClick={onNavigate}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white p-1">
          <img src="/icon-192.png" alt="" className="h-full w-full object-contain" width="192" height="192" />
        </span>
        <span className="text-sm font-bold">
          Concrete Cost <span className="text-orange-ondark">Pro</span>
        </span>
      </a>
      <nav aria-label="Application" className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.key === activeTab;
          return (
            <a
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-orange text-white" : "text-white/75 hover:bg-charcoal-light hover:text-white"
              }`}
            >
              <Icon size={17} />
              {item.label}
            </a>
          );
        })}
      </nav>
      <div className="border-t border-charcoal-light px-5 py-4">
        <a href="/" className="text-xs font-medium text-white/50 hover:text-white">
          &larr; Back to site
        </a>
      </div>
    </>
  );
}
