import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie, Tooltip,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import {
  FileText, HardDrive, Clock, Users, CheckCircle2,
  ArrowUpRight, ArrowDownRight, UploadCloud, Eye, FolderPlus,
  UserPlus, ListTodo, XCircle, Pencil, Download, TrendingUp,
  AlertCircle, CalendarClock, RefreshCw,
} from 'lucide-react';
import { Permission, Role } from '@/lib/auth-rbac/roles';
import { useAuth } from '@/providers/auth-provider';
import { useDashboard } from './useDashboard';
import { getActivityLogs, mapBackendEntry } from '@/features/activity/activity.service';

// ─── Data ─────────────────────────────────────────────────────────────────────

// Quick actions are route-based shortcuts for common dashboard workflows.
type QuickAction = {
  id: string;
  label: string;
  icon: React.ElementType;
  primary: boolean;
  path: string;
  requiredPermissions?: Permission[];
  requiredRoles?: Role[];
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'qa-upload',
    label: 'Importer un document',
    icon: UploadCloud,
    primary: true,
    path: '/documents/upload',
    requiredPermissions: [Permission.UPLOAD_DOCUMENT],
  },
  {
    id: 'qa-folder',
    label: 'Créer un dossier',
    icon: FolderPlus,
    primary: false,
    path: '/documents',
    requiredPermissions: [Permission.CREATE_FOLDER],
  },
  {
    id: 'qa-approvals',
    label: 'Valider les documents',
    icon: CheckCircle2,
    primary: false,
    path: '/documents/approvals',
    requiredPermissions: [Permission.APPROVE_DOCUMENT],
  },
  {
    id: 'qa-share-review',
    label: 'Demandes de partage',
    icon: TrendingUp,
    primary: false,
    path: '/documents/shared',
    requiredPermissions: [Permission.APPROVE_SHARING_REQUEST],
  },
  {
    id: 'qa-libraries',
    label: 'Gerer les bibliotheques',
    icon: FolderPlus,
    primary: false,
    path: '/libraries',
    requiredPermissions: [Permission.MANAGE_LIBRARIES],
  },
  {
    id: 'qa-user',
    label: 'Ajouter un utilisateur',
    icon: UserPlus,
    primary: false,
    path: '/admin',
    requiredPermissions: [Permission.MANAGE_USERS],
  },
  {
    id: 'qa-task',
    label: 'Journal d\'audit',
    icon: ListTodo,
    primary: false,
    path: '/audit',
    requiredPermissions: [Permission.CONSULTE_AUDIT_LOGS],
    requiredRoles: [Role.ADMIN],
  },
];

const ACTION_ICON: Record<string, React.ElementType> = {
  upload: UploadCloud, delete: XCircle, share: TrendingUp,
  approve: CheckCircle2, reject: XCircle, view: Eye, edit: Pencil,
  download: Download, restore: CheckCircle2, scan: FileText,
  cloud_import: UploadCloud, create_folder: FolderPlus,
  rename_folder: Pencil, bulk_delete: XCircle, bulk_tag: FileText,
  bulk_move: FolderPlus, bulk_archive: HardDrive, bulk_share: TrendingUp,
  expiry_set: CalendarClock, version_restore: CheckCircle2,
};
const ACTION_COLOR: Record<string, string> = {
  upload: 'text-orange-500 bg-orange-500/10', delete: 'text-red-500 bg-red-500/10',
  share: 'text-blue-500 bg-blue-500/10', bulk_share: 'text-blue-500 bg-blue-500/10',
  approve: 'text-emerald-500 bg-emerald-500/10', reject: 'text-red-500 bg-red-500/10',
  view: 'text-indigo-500 bg-indigo-500/10', edit: 'text-purple-500 bg-purple-500/10',
  download: 'text-zinc-500 bg-zinc-500/10', restore: 'text-teal-500 bg-teal-500/10',
  scan: 'text-amber-500 bg-amber-500/10', cloud_import: 'text-sky-500 bg-sky-500/10',
  create_folder: 'text-blue-500 bg-blue-500/10', version_restore: 'text-violet-500 bg-violet-500/10',
};

// ─── Sparkline (mini SVG) ─────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80, h = 28;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-70">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-bold">{p.value}</span></p>
      ))}
    </div>
  );
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-xl text-xs">
      <p style={{ color: payload[0].payload.color }} className="font-semibold">{payload[0].name}</p>
      <p className="text-foreground">{payload[0].value}%</p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 text-center">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="mt-3 h-7 w-20 rounded bg-muted" />
            <div className="mt-3 h-2 w-full rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-6">
          <div className="h-[300px] rounded-2xl border border-border bg-card animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-[260px] rounded-2xl border border-border bg-card animate-pulse" />
            <div className="h-[260px] rounded-2xl border border-border bg-card animate-pulse" />
          </div>
        </div>
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[160px] rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user, hasRole, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [activeDonut, setActiveDonut] = useState<number | null>(null);
  const { data, isLoading, error, refetch } = useDashboard();

  const visibleQuickActions = QUICK_ACTIONS.filter((action) => {
    const roleOk = action.requiredRoles?.length
      ? action.requiredRoles.some((role) => hasRole(role))
      : true;
    const permissionOk = action.requiredPermissions?.length
      ? action.requiredPermissions.some((permission) => hasPermission(permission))
      : true;
    return roleOk && permissionOk;
  });

  // Load recent activity from backend
  const [recentLogs, setRecentLogs] = React.useState<ReturnType<typeof mapBackendEntry>[]>([]);
  React.useEffect(() => {
    getActivityLogs({ maxResultCount: 6 })
      .then((r) => setRecentLogs(r.items.map(mapBackendEntry)))
      .catch(() => {});
  }, []);

  // Build KPI cards from real data (fall back to placeholders while loading)
  const kpi = data?.kpi;
  const KPI_CARDS = [
    {
      id: 'total-docs', label: 'Total Documents', value: kpi?.totalDocuments ?? '—',
      delta: kpi?.totalDocumentsTrend ?? '+0%', positive: kpi?.trendPositive ?? true, sub: 'ce mois',
      icon: FileText, iconColor: 'text-blue-500', iconBg: 'bg-blue-500/10',
      border: 'border-blue-500/20', sparkColor: '#3b82f6',
      sparkData: [40,55,48,62,58,74,69,80,77,88],
    },
    {
      id: 'pending', label: 'En attente validation', value: String(kpi?.pendingValidations ?? '—'),
      delta: '-8%', positive: true, sub: 'vs semaine passée',
      icon: Clock, iconColor: 'text-amber-500', iconBg: 'bg-amber-500/10',
      border: 'border-amber-500/20', sparkColor: '#f59e0b',
      sparkData: [30,26,28,20,24,18,22,20,24,22],
    },
    {
      id: 'users', label: 'Utilisateurs actifs', value: String(kpi?.activeUsers ?? '—'),
      delta: '+5%', positive: true, sub: 'ce mois',
      icon: Users, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20', sparkColor: '#10b981',
      sparkData: [28,30,29,33,31,34,33,36,35,38],
    },
    {
      id: 'storage', label: 'Espace utilisé', value: kpi ? `${kpi.storageUsedGB.toFixed(1)} GB` : '—',
      delta: '+3.2 GB', positive: false, sub: kpi ? `/ ${kpi.storageCapacityGB} GB` : '/ — GB',
      icon: HardDrive, iconColor: 'text-purple-500', iconBg: 'bg-purple-500/10',
      border: 'border-purple-500/20', sparkColor: '#8b5cf6',
      sparkData: [30,32,33,34,36,37,38,39,41,43],
      pct: kpi?.storagePct ?? 0,
    },
    {
      id: 'approved', label: 'Approuvés ce mois', value: String(kpi?.approvedThisMonth ?? '—'),
      delta: '+18%', positive: true, sub: 'vs mois précédent',
      icon: CheckCircle2, iconColor: 'text-teal-500', iconBg: 'bg-teal-500/10',
      border: 'border-teal-500/20', sparkColor: '#14b8a6',
      sparkData: [100,115,120,130,125,140,150,160,175,186],
    },
  ];

  const last30 = data?.dailyActivity ?? [];
  const TURNAROUND = data?.departmentDelays ?? [];
  const DEPT_USAGE = data?.departmentUsage ?? [];

  const uploads30 = last30.reduce((sum, p) => sum + p.uploads, 0);
  const approvals30 = last30.reduce((sum, p) => sum + p.approvals, 0);
  const backlogDelta = Math.max(uploads30 - approvals30, 0);

  const PRIORITIES = [
    kpi && kpi.pendingValidations > 0
      ? {
          id: 'prio-pending',
          icon: AlertCircle,
          color: 'text-amber-600 bg-amber-500/10',
          title: `${kpi.pendingValidations} validations en attente`,
          hint: 'Priorité élevée',
          action: 'Ouvrir les approbations',
          path: '/documents/approvals',
        }
      : null,
    kpi && kpi.storagePct >= 80
      ? {
          id: 'prio-storage',
          icon: HardDrive,
          color: 'text-red-600 bg-red-500/10',
          title: `Capacité utilisée à ${kpi.storagePct}%`,
          hint: 'Risque de saturation',
          action: 'Voir les archives',
          path: '/documents',
        }
      : null,
    backlogDelta > 0
      ? {
          id: 'prio-backlog',
          icon: CalendarClock,
          color: 'text-blue-600 bg-blue-500/10',
          title: `${backlogDelta} éléments de backlog ce mois`,
          hint: 'Uploads > approbations',
          action: 'Voir le flux d\'activité',
          path: '/activity',
        }
      : {
          id: 'prio-good',
          icon: CheckCircle2,
          color: 'text-emerald-600 bg-emerald-500/10',
          title: 'Aucune alerte critique détectée',
          hint: 'Système stable',
          action: 'Voir les indicateurs',
          path: '/dashboard',
        },
  ].filter(Boolean) as Array<{
    id: string;
    icon: React.ElementType;
    color: string;
    title: string;
    hint: string;
    action: string;
    path: string;
  }>;

  if (isLoading && !data) {
    return (
      <>
        <Helmet>
          <title>Dashboard — ItDoc</title>
          <meta name="description" content="Tableau de bord analytique du système de gestion documentaire." />
        </Helmet>
        <div className="space-y-6 max-w-[1600px] mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chargement du dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Préparation des indicateurs et graphiques…</p>
          </div>
          <LoadingDashboard />
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Dashboard — ItDoc</title>
        <meta name="description" content="Tableau de bord analytique du système de gestion documentaire." />
      </Helmet>

      <div className="space-y-6 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Bonjour, {user?.fullName?.split(' ')[0] ?? 'Utilisateur'} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="dashboard-refresh"
              onClick={refetch}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Actualiser
            </button>
            <Link to="/audit" className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <TrendingUp className="h-3.5 w-3.5" />
              Journal d'audit
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <p className="font-medium">Impossible de charger certaines données du dashboard.</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {KPI_CARDS.map((card) => (
            <div
              key={card.id}
              id={`kpi-${card.id}`}
              className={`relative rounded-2xl border ${card.border} bg-card p-5 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group ${
                card.id === 'total-docs' || card.id === 'pending' || card.id === 'approved' ? '' : 'xl:col-span-1'
              } ${card.id === 'users' || card.id === 'storage' ? 'xl:col-span-1' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <Sparkline data={card.sparkData} color={card.sparkColor} />
              </div>

              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-bold text-foreground tracking-tight">{card.value}</span>
                {card.sub && <span className="text-xs text-muted-foreground">{card.sub}</span>}
              </div>

              {card.id === 'storage' ? (
                <div className="mt-3 space-y-1">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400" style={{ width: `${card.pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{card.pct}% utilisé</p>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-1">
                  {card.positive
                    ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                    : <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />}
                  <span className={`text-xs font-semibold ${card.positive ? 'text-emerald-500' : 'text-red-400'}`}>{card.delta}</span>
                  <span className="text-[11px] text-muted-foreground ml-0.5">vs période précédente</span>
                </div>
              )}

              {card.id === 'pending' && kpi && kpi.pendingValidations > 0 && (
                <button
                  id="kpi-open-pending"
                  onClick={() => navigate('/documents/approvals')}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:underline"
                >
                  Traiter maintenant
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Main 2-column grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">

          {/* LEFT column */}
          <div className="space-y-6">

            {/* Area chart — 30 days */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Activité des 30 derniers jours</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Uploads &amp; Approbations quotidiens</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-orange-500 inline-block" />Uploads</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-emerald-500 inline-block" />Approbations</span>
                </div>
              </div>
              {last30.length === 0 ? (
                <EmptyState
                  title="Aucune activité disponible"
                  description="Les courbes s'afficheront dès que des uploads et approbations seront enregistrés."
                />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={last30} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradUp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradAp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="uploads" name="Uploads" stroke="#f97316" strokeWidth={2} fill="url(#gradUp)" dot={false} activeDot={{ r: 5, fill: '#f97316' }} />
                    <Area type="monotone" dataKey="approvals" name="Approbations" stroke="#10b981" strokeWidth={2} fill="url(#gradAp)" dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bottom row: Bar + Donut */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Approval Turnaround Bar */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-bold text-foreground">Délai d'approbation</h2>
                <p className="text-xs text-muted-foreground mt-0.5 mb-4">Temps moyen par département (heures)</p>
                {TURNAROUND.length === 0 ? (
                  <EmptyState
                    title="Pas de délai calculable"
                    description="Ce module affichera les temps moyens dès qu'il y aura des approbations." 
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={TURNAROUND} margin={{ top: 0, right: 10, left: -25, bottom: 0 }} barSize={22}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal vertical={false} />
                      <XAxis dataKey="dept" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} unit="h" />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--accent))' }} />
                      <Bar dataKey="hours" name="Délai (h)" radius={[6, 6, 0, 0]}>
                        {TURNAROUND.map((entry, i) => (
                          <Cell key={i} fill={entry.hours <= 4 ? '#10b981' : entry.hours <= 7 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Department Usage Donut */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-bold text-foreground">Utilisation par département</h2>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">% des documents par entité</p>
                {DEPT_USAGE.length === 0 ? (
                  <EmptyState
                    title="Aucune répartition disponible"
                    description="La répartition par département apparaîtra quand des documents seront catégorisés."
                  />
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie
                          data={DEPT_USAGE} cx="50%" cy="50%" innerRadius={42} outerRadius={65}
                          dataKey="value" paddingAngle={3}
                          onMouseEnter={(_, i) => setActiveDonut(i)}
                          onMouseLeave={() => setActiveDonut(null)}
                        >
                          {DEPT_USAGE.map((entry, i) => (
                            <Cell
                              key={i} fill={entry.color}
                              opacity={activeDonut === null || activeDonut === i ? 1 : 0.4}
                              style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<DonutTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {DEPT_USAGE.map((d, i) => (
                        <div
                          key={d.name}
                          className="flex items-center gap-2 cursor-pointer"
                          onMouseEnter={() => setActiveDonut(i)}
                          onMouseLeave={() => setActiveDonut(null)}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                          <span className="text-xs text-muted-foreground flex-1 truncate">{d.name}</span>
                          <span className="text-xs font-semibold text-foreground">{d.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT sidebar */}
          <div className="space-y-5">

            {/* Quick Actions */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold text-foreground mb-4">Actions rapides</h2>
              <div className="space-y-2">
                {visibleQuickActions.map((action) => (
                  <button
                    key={action.id}
                    id={action.id}
                    onClick={() => navigate(action.path)}
                    className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 ${
                      action.primary
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20'
                        : 'bg-muted/40 text-foreground hover:bg-accent border border-border/60'
                    }`}
                  >
                    <action.icon className="h-4 w-4 shrink-0" />
                    {action.label}
                  </button>
                ))}
                {visibleQuickActions.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Aucune action rapide disponible pour votre role.
                  </p>
                )}
              </div>
            </div>

            {/* Reminders */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold text-foreground mb-4">Centre de priorités</h2>
              <div className="space-y-3">
                {PRIORITIES.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-accent/40 transition-colors">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground leading-snug">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.hint}</p>
                      <button
                        onClick={() => navigate(item.path)}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                      >
                        {item.action}
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Activity Feed */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-foreground">Activité récente</h2>
                <Link to="/audit" className="text-[10px] text-primary font-medium hover:underline">Tout voir →</Link>
              </div>
              <div className="space-y-1">
                {recentLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Aucune activité enregistrée.</p>
                ) : (
                  recentLogs.map((log) => {
                    const Icon = ACTION_ICON[log.action] ?? FileText;
                    const colorCls = ACTION_COLOR[log.action] ?? 'text-zinc-500 bg-zinc-500/10';
                    return (
                      <div key={log.id} className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-accent/40 transition-colors">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colorCls}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-foreground truncate">{log.documentName}</p>
                          <p className="text-[10px] text-muted-foreground">{log.user}</p>
                        </div>
                        <span className="text-[9px] text-muted-foreground/60 whitespace-nowrap shrink-0 mt-0.5">
                          {new Date(log.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* KPI Snapshot */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold text-foreground mb-4">Snapshot exécutif</h2>
              <div className="space-y-3">
                {[
                  {
                    label: 'Documents totaux',
                    value: kpi?.totalDocuments ?? '—',
                    pct: 100,
                    color: 'bg-blue-500',
                  },
                  {
                    label: 'En attente de validation',
                    value: String(kpi?.pendingValidations ?? '—'),
                    pct: kpi?.totalDocuments ? Math.min((kpi.pendingValidations / Number(String(kpi.totalDocuments).replace(/\s/g, ''))) * 100, 100) : 0,
                    color: 'bg-amber-500',
                  },
                  {
                    label: 'Approuvés ce mois',
                    value: String(kpi?.approvedThisMonth ?? '—'),
                    pct: kpi?.totalDocuments ? Math.min((kpi.approvedThisMonth / Number(String(kpi.totalDocuments).replace(/\s/g, ''))) * 100, 100) : 0,
                    color: 'bg-emerald-500',
                  },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-semibold text-foreground">{s.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${s.color} transition-all duration-700`} style={{ width: `${Math.round(s.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
