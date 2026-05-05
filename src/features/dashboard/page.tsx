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
  AlertCircle, CalendarClock, Zap,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { activityLogger } from '@/lib/activity-logger';

// ─── Data ─────────────────────────────────────────────────────────────────────

const last30 = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  return {
    date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    uploads: Math.floor(20 + Math.random() * 60 + Math.sin(i / 3) * 15),
    approvals: Math.floor(10 + Math.random() * 40 + Math.cos(i / 4) * 10),
  };
});

const TURNAROUND = [
  { dept: 'Finance',    hours: 4.2 },
  { dept: 'RH',        hours: 6.8 },
  { dept: 'Direction', hours: 2.1 },
  { dept: 'Achat',     hours: 9.3 },
  { dept: 'IT',        hours: 3.5 },
  { dept: 'Marketing', hours: 7.1 },
];

const DEPT_USAGE = [
  { name: 'Finance',   value: 34, color: '#f97316' },
  { name: 'RH',        value: 24, color: '#8b5cf6' },
  { name: 'Direction', value: 18, color: '#06b6d4' },
  { name: 'Marketing', value: 14, color: '#10b981' },
  { name: 'Achat',     value: 10, color: '#f59e0b' },
];

const QUICK_ACTIONS = [
  { id: 'qa-upload', label: 'Importer un document', icon: UploadCloud, primary: true, path: '/documents' },
  { id: 'qa-folder', label: 'Créer un dossier',     icon: FolderPlus,  primary: false, path: '/documents' },
  { id: 'qa-user',   label: 'Ajouter un utilisateur',icon: UserPlus,   primary: false, path: '/admin' },
  { id: 'qa-task',   label: 'Créer une tâche',      icon: ListTodo,    primary: false, path: '/activity' },
];

const REMINDERS = [
  { icon: AlertCircle,   color: 'text-amber-500 bg-amber-500/10',   text: '5 documents expirent dans 7 jours',            time: "Aujourd'hui" },
  { icon: CalendarClock, color: 'text-blue-500 bg-blue-500/10',     text: 'Réunion de validation — Rapport Q2',           time: 'Demain 14h00' },
  { icon: CheckCircle2,  color: 'text-emerald-500 bg-emerald-500/10', text: '12 documents approuvés cette semaine',       time: 'Cette semaine' },
  { icon: Zap,           color: 'text-primary bg-primary/10',        text: 'Nouveau workflow Finance activé',             time: 'Il y a 2h' },
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeDonut, setActiveDonut] = useState<number | null>(null);

  const recentLogs = activityLogger.getAll().slice(0, 6);

  const KPI_CARDS = [
    {
      id: 'total-docs', label: 'Total Documents', value: '1 284',
      delta: '+12%', positive: true, sub: 'ce mois',
      icon: FileText, iconColor: 'text-blue-500', iconBg: 'bg-blue-500/10',
      border: 'border-blue-500/20', sparkColor: '#3b82f6',
      sparkData: [40,55,48,62,58,74,69,80,77,88],
    },
    {
      id: 'pending', label: 'En attente validation', value: '24',
      delta: '-8%', positive: true, sub: 'vs semaine passée',
      icon: Clock, iconColor: 'text-amber-500', iconBg: 'bg-amber-500/10',
      border: 'border-amber-500/20', sparkColor: '#f59e0b',
      sparkData: [30,26,28,20,24,18,22,20,24,22],
    },
    {
      id: 'users', label: 'Utilisateurs actifs', value: '38',
      delta: '+5%', positive: true, sub: 'ce mois',
      icon: Users, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20', sparkColor: '#10b981',
      sparkData: [28,30,29,33,31,34,33,36,35,38],
    },
    {
      id: 'storage', label: 'Espace utilisé', value: '42.7 GB',
      delta: '+3.2 GB', positive: false, sub: '/ 100 GB',
      icon: HardDrive, iconColor: 'text-purple-500', iconBg: 'bg-purple-500/10',
      border: 'border-purple-500/20', sparkColor: '#8b5cf6',
      sparkData: [30,32,33,34,36,37,38,39,41,43],
      pct: 42.7,
    },
    {
      id: 'approved', label: 'Approuvés ce mois', value: '186',
      delta: '+18%', positive: true, sub: 'vs mois précédent',
      icon: CheckCircle2, iconColor: 'text-teal-500', iconBg: 'bg-teal-500/10',
      border: 'border-teal-500/20', sparkColor: '#14b8a6',
      sparkData: [100,115,120,130,125,140,150,160,175,186],
    },
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard — EDMS Enterprise</title>
        <meta name="description" content="Tableau de bord analytique du système de gestion documentaire." />
      </Helmet>

      <div className="space-y-6 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Bonjour, {user?.fullName?.split(' ')[0] ?? 'Utilisateur'} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <Link to="/activity" className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <TrendingUp className="h-3.5 w-3.5" />
            Voir l'activité complète
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {KPI_CARDS.map((card) => (
            <div
              key={card.id}
              id={`kpi-${card.id}`}
              className={`relative rounded-2xl border ${card.border} bg-card p-5 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group`}
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
                  <span className="text-[11px] text-muted-foreground ml-0.5">ce mois</span>
                </div>
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
            </div>

            {/* Bottom row: Bar + Donut */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Approval Turnaround Bar */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-bold text-foreground">Délai d'approbation</h2>
                <p className="text-xs text-muted-foreground mt-0.5 mb-4">Temps moyen par département (heures)</p>
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
              </div>

              {/* Department Usage Donut */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-bold text-foreground">Utilisation par département</h2>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">% des documents par entité</p>
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
              </div>
            </div>
          </div>

          {/* RIGHT sidebar */}
          <div className="space-y-5">

            {/* Quick Actions */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold text-foreground mb-4">Actions rapides</h2>
              <div className="space-y-2">
                {QUICK_ACTIONS.map((action) => (
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
              </div>
            </div>

            {/* Reminders */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold text-foreground mb-4">Rappels</h2>
              <div className="space-y-3">
                {REMINDERS.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-accent/40 transition-colors">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${r.color}`}>
                      <r.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground leading-snug">{r.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{r.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Activity Feed */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-foreground">Activité récente</h2>
                <Link to="/activity" className="text-[10px] text-primary font-medium hover:underline">Tout voir →</Link>
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

            {/* Document Status Mini */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold text-foreground mb-4">Statut des documents</h2>
              <div className="space-y-3">
                {[
                  { label: 'Approuvés',  count: 843, pct: 67, color: 'bg-emerald-500' },
                  { label: 'En attente', count: 253, pct: 20, color: 'bg-amber-500' },
                  { label: 'Brouillons', count: 101, pct:  8, color: 'bg-zinc-400' },
                  { label: 'Rejetés',    count:  51, pct:  4, color: 'bg-red-500' },
                  { label: 'Expirés',    count:  36, pct:  3, color: 'bg-orange-500' },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-semibold text-foreground">{s.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${s.color} transition-all duration-700`} style={{ width: `${s.pct}%` }} />
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
