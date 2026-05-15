import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FileText, FolderTree, HardDrive, Users, Loader2 } from 'lucide-react';
import { listTenants, getAllTenantStats, TenantStatsDto } from './tenant.service';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function HostDashboardPage() {
  const [stats, setStats] = useState<TenantStatsDto[]>([]);
  const [tenantCount, setTenantCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Always load tenants — works even if the stats endpoint is missing.
        const page = await listTenants({ maxResultCount: 200 });
        setTenantCount(page.totalCount ?? page.items.length);

        try {
          const s = await getAllTenantStats();
          setStats(s);
        } catch {
          // Backend stats endpoint not deployed yet — fall back to zeros.
          setStatsError(true);
          setStats(
            page.items.map((t) => ({
              tenantId: t.id,
              tenantName: t.name,
              userCount: 0,
              documentCount: 0,
              libraryCount: 0,
              storageBytes: 0,
            })),
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totals = stats.reduce(
    (acc, s) => ({
      users: acc.users + s.userCount,
      documents: acc.documents + s.documentCount,
      libraries: acc.libraries + s.libraryCount,
      storage: acc.storage + s.storageBytes,
    }),
    { users: 0, documents: 0, libraries: 0, storage: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Tableau de bord global</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d'ensemble de tous les tenants hébergés.
        </p>
      </div>

      {/* Global counters */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Tenants" value={tenantCount} icon={Building2} accent="primary" />
        <KpiCard label="Utilisateurs" value={totals.users} icon={Users} />
        <KpiCard label="Documents" value={totals.documents} icon={FileText} />
        <KpiCard label="Bibliothèques" value={totals.libraries} icon={FolderTree} />
        <KpiCard
          label="Stockage"
          value={formatBytes(totals.storage)}
          icon={HardDrive}
          isString
        />
      </div>

      {statsError && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          Les statistiques par tenant ne sont pas disponibles (endpoint{' '}
          <code>/app/host/tenant-stats</code> introuvable). Les compteurs ci-dessous sont à zéro.
        </div>
      )}

      {/* Per-tenant cards */}
      <div>
        <h3 className="text-base font-semibold mb-3">Détails par tenant</h3>

        {loading ? (
          <div className="rounded-lg border bg-card p-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Chargement…
          </div>
        ) : stats.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun tenant pour le moment.
            </p>
            <Link
              to="/host/tenants"
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              Créer le premier tenant →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {stats.map((s) => (
              <div
                key={s.tenantId}
                className="rounded-lg border bg-card p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{s.tenantName}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {s.tenantId}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Utilisateurs" value={s.userCount} icon={Users} />
                  <Stat label="Documents" value={s.documentCount} icon={FileText} />
                  <Stat label="Bibliothèques" value={s.libraryCount} icon={FolderTree} />
                  <Stat
                    label="Stockage"
                    value={formatBytes(s.storageBytes)}
                    icon={HardDrive}
                    isString
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  isString,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent?: 'primary';
  isString?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </p>
        <Icon
          className={`h-4 w-4 ${accent === 'primary' ? 'text-primary' : 'text-muted-foreground'}`}
        />
      </div>
      <p className="text-2xl font-semibold mt-2">
        {isString ? value : (value as number).toLocaleString()}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  isString,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  isString?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider truncate">
          {label}
        </p>
        <p className="font-semibold truncate">
          {isString ? value : (value as number).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
