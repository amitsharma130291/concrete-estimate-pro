import { useEffect, useState } from "react";
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
  HelpCircle,
} from "lucide-react";
import { WorkspaceProvider } from "../../lib/workspaceContext";
import { verifyAccess } from "../../lib/license";
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

/** The entire /app area is the paid product -- the free tools live at their own public
 * calculator pages, not here. Every page under /app mounts this fresh (Astro does a full
 * page load per route, not a client-side SPA nav), so this re-checks on every visit rather
 * than trusting a client-side flag that would let someone skip straight past the gate. */
export default function AppShell({ activeTab }: { activeTab: AppTab }) {
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let cancelled = false;
    verifyAccess().then((license) => {
      if (cancelled) return;
      setAccess(license ? "allowed" : "denied");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (access === "denied") window.location.href = "/pricing";
  }, [access]);

  if (access !== "allowed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white">
        <div className="flex items-center gap-2.5 text-sm text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-orange" aria-hidden="true" />
          {access === "checking" ? "Checking access…" : "Redirecting to pricing…"}
        </div>
      </div>
    );
  }

  return <AppShellContent activeTab={activeTab} />;
}

function AppShellContent({ activeTab }: { activeTab: AppTab }) {
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

        {/* min-w-0 overrides a flex item's default min-width:auto -- without it, this column
            refuses to shrink below the intrinsic width of whatever's inside it (a wide table,
            a stat-card grid, unwrapped text), blowing out the whole page into a horizontal
            scroll instead of that content wrapping or scrolling internally. */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-white px-4 py-3 min-[1200px]:hidden no-print">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="shrink-0 rounded-lg border border-border p-2 text-ink"
            >
              <Menu size={20} />
            </button>
            <span className="min-w-0 flex-1 truncate px-2 text-sm font-semibold text-ink">{NAV.find((n) => n.key === activeTab)?.label ?? "Concrete Cost Pro"}</span>
            <div className="flex shrink-0 items-center gap-3">
              <a href="/how-to-use" aria-label="How to use Concrete Cost Pro" className="flex items-center gap-1 text-xs font-medium text-orange">
                <HelpCircle size={15} />
                Guide
              </a>
              <a href="/" className="text-xs font-medium text-orange">
                Site
              </a>
            </div>
          </header>

          <main className="relative flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {/* Mobile/tablet already have this in the header bar above (<1200px) -- desktop's
                sidebar has it too, but this copy sits right at the top of every tab's own
                content, closest to where a first-time user is actually looking. Absolutely
                positioned (not a row of its own) so it sits parallel to each tab's own
                title/action row instead of pushing it down -- top/right match main's own
                padding scale (py-6 / px-4 sm:px-6 lg:px-8) so it lines up with that row. */}
            <a
              href="/how-to-use"
              className="absolute right-4 top-2 z-10 hidden items-center gap-1 text-[11px] font-medium text-muted hover:text-orange min-[1200px]:flex sm:right-6 lg:right-8"
            >
              <HelpCircle size={12} />
              How to use Concrete Cost Pro
            </a>
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
      <a href="/" className="flex items-center px-5 py-5" onClick={onNavigate}>
        {/* Same logo file the public site uses (PublicHeader.astro) -- its wordmark is dark
            charcoal, so it needs a light backing to stay legible on this dark sidebar,
            unlike on the site's white header. */}
        <span className="flex items-center rounded-lg bg-white px-2.5 py-2">
          <img src="/brand/logo-header.png" alt="Concrete Cost Pro" className="h-9 w-auto" width="614" height="100" />
        </span>
      </a>
      <a
        href="/how-to-use"
        onClick={onNavigate}
        className="mx-3 mb-3 flex items-center gap-2 rounded-lg bg-charcoal-light px-3 py-2 text-xs font-semibold text-orange-ondark hover:bg-charcoal-light/70"
      >
        <HelpCircle size={15} />
        How to use Concrete Cost Pro
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
