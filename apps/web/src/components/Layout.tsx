import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/context/app-context";
import { NAV_ITEMS, type PageId } from "@/lib/navigation";
import { filterModelsByProvider, formatProviderLabel } from "@/lib/models";
import { cn } from "@/lib/utils";

interface LayoutProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}

export function Layout({ page, onNavigate, children }: LayoutProps) {
  const { health, models, loading, error, refresh, setModel } = useAppContext();
  const activeNav = NAV_ITEMS.find((item) => item.id === page);

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <aside className="flex h-full w-64 shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar">
        <div className="border-b border-border px-5 py-5">
          <div className="flex items-center gap-3">
            <img
              src="/tinyclaw.png"
              alt="TinyClaw"
              className="size-9 shrink-0 rounded-lg object-contain"
            />
            <div>
              <p className="font-semibold text-foreground">TinyClaw</p>
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 p-3">
          {NAV_ITEMS.map((item) => {
            const active = item.id === page;

            return (
              <button
                key={item.id}
                type="button"
                title={item.description}
                aria-current={active ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "w-full rounded-md py-2 pr-3 text-left text-sm transition",
                  active
                    ? "border-l-2 border-sidebar-primary bg-sidebar-accent pl-[calc(0.75rem-2px)] font-semibold text-sidebar-foreground shadow-sm"
                    : "border-l-2 border-transparent pl-3 text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-border p-4 text-xs text-muted-foreground">
          Server must be running on port 4310.
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {page !== "chat" ? (
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-4">
            <div>
              <h1 className="text-lg font-semibold text-foreground">{activeNav?.label}</h1>
              <p className="text-sm text-muted-foreground">{activeNav?.description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusPill
                label={loading ? "Checking…" : health?.ok ? "Online" : "Offline"}
                tone={health?.ok ? "ok" : "bad"}
              />

              {health?.providerConfigured ? (
                <>
                  <StatusPill
                    label={formatProviderLabel(models?.provider)}
                    tone="neutral"
                  />
                  <select
                    className="h-8 min-w-48 rounded-md border border-input bg-input px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={models?.currentModel ?? ""}
                    disabled={!models?.models.length}
                    onChange={(event) => void setModel(event.target.value)}
                  >
                    {!models?.currentModel ? <option value="">No model</option> : null}
                    {filterModelsByProvider(models?.models ?? [], models?.provider).map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate("settings")}
                  className="rounded-full border border-amber-800/60 bg-amber-950/40 px-3 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-950/60"
                >
                  No provider — configure
                </button>
              )}

              <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
                Refresh
              </Button>
            </div>
          </header>
        ) : null}

        {error ? (
          <div className="shrink-0 border-b border-red-900/40 bg-red-950/30 px-6 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <main
          className={
            page === "chat"
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "min-h-0 flex-1 overflow-y-auto p-6"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "bad" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-200"
      : tone === "bad"
        ? "border-red-800/60 bg-red-950/40 text-red-200"
        : tone === "warn"
          ? "border-amber-800/60 bg-amber-950/40 text-amber-200"
          : "border-border bg-muted text-muted-foreground";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}>
      {label}
    </span>
  );
}
