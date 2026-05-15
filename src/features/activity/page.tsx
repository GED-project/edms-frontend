import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Activity,
  Search,
  Filter,
  UploadCloud,
  Trash2,
  Share2,
  CheckCircle2,
  XCircle,
  Eye,
  Pencil,
  Clock,
  Download,
  RotateCcw,
  Archive,
  Folder,
  Tag,
  Cloud,
  ScanLine,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import type { ActionType, ActivityEntry } from '@/lib/activity-logger';
import { getActivityLogs, mapBackendEntry } from './activity.service';

// ─── Seed mock data on first run ─────────────────────────────────────────────
// (removed — using backend-only data)

// ─── Config ───────────────────────────────────────────────────────────────────

type FilterAction = ActionType | 'all';

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  upload:         { label: 'Import',           icon: UploadCloud,  color: 'text-orange-500 bg-orange-500/10' },
  delete:         { label: 'Suppression',      icon: Trash2,       color: 'text-red-500 bg-red-500/10' },
  share:          { label: 'Partage',          icon: Share2,       color: 'text-blue-500 bg-blue-500/10' },
  bulk_share:     { label: 'Partage groupé',   icon: Share2,       color: 'text-blue-500 bg-blue-500/10' },
  approve:        { label: 'Approbation',      icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10' },
  reject:         { label: 'Rejet',            icon: XCircle,      color: 'text-red-500 bg-red-500/10' },
  view:           { label: 'Consultation',     icon: Eye,          color: 'text-indigo-500 bg-indigo-500/10' },
  edit:           { label: 'Modification',     icon: Pencil,       color: 'text-purple-500 bg-purple-500/10' },
  download:       { label: 'Téléchargement',   icon: Download,     color: 'text-zinc-500 bg-zinc-500/10' },
  restore:        { label: 'Restauration',     icon: RotateCcw,    color: 'text-teal-500 bg-teal-500/10' },
  archive:        { label: 'Archivage',        icon: Archive,      color: 'text-zinc-500 bg-zinc-500/10' },
  bulk_archive:   { label: 'Archivage groupé', icon: Archive,      color: 'text-zinc-500 bg-zinc-500/10' },
  move:           { label: 'Déplacement',      icon: Folder,       color: 'text-sky-500 bg-sky-500/10' },
  bulk_move:      { label: 'Déplacement groupé', icon: Folder,     color: 'text-sky-500 bg-sky-500/10' },
  tag:            { label: 'Tag',              icon: Tag,          color: 'text-primary bg-primary/10' },
  bulk_tag:       { label: 'Tag groupé',       icon: Tag,          color: 'text-primary bg-primary/10' },
  version_restore:{ label: 'Restauration de version', icon: RotateCcw, color: 'text-violet-500 bg-violet-500/10' },
  scan:           { label: 'Scan / OCR',       icon: ScanLine,     color: 'text-amber-500 bg-amber-500/10' },
  cloud_import:   { label: 'Import Cloud',     icon: Cloud,        color: 'text-sky-500 bg-sky-500/10' },
  create_folder:  { label: 'Nouveau dossier',  icon: Folder,       color: 'text-blue-500 bg-blue-500/10' },
  rename_folder:  { label: 'Renommage',        icon: Pencil,       color: 'text-purple-500 bg-purple-500/10' },
  bulk_delete:    { label: 'Suppression groupée', icon: Trash2,    color: 'text-red-500 bg-red-500/10' },
  expiry_set:     { label: 'Expiration définie', icon: Calendar,   color: 'text-amber-500 bg-amber-500/10' },
};

const PAGE_SIZE = 15;

// ─── Highlight helper ─────────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-amber-200 dark:bg-amber-500/40 text-amber-900 dark:text-amber-100 rounded px-0.5 not-italic font-semibold">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ActivityPage() {
  const [allLogs, setAllLogs] = useState<ActivityEntry[]>([]);
  const [isLoadingBackend, setIsLoadingBackend] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadLogs = useCallback(() => {
    setIsLoadingBackend(true);
    setLoadError(false);
    getActivityLogs({ maxResultCount: 200 })
      .then((result) => setAllLogs(result.items.map(mapBackendEntry)))
      .catch(() => setLoadError(true))
      .finally(() => setIsLoadingBackend(false));
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const [search, setSearch]           = useState('');
  const [filterAction, setFilterAction] = useState<FilterAction>('all');
  const [filterUser, setFilterUser]   = useState('all');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [page, setPage]               = useState(1);

  // Derived: unique users for filter dropdown
  const allUsers = useMemo(
    () => Array.from(new Set(allLogs.map(l => l.user))).sort(),
    [allLogs]
  );

  // Filter logic
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allLogs.filter(log => {
      const matchSearch = !q ||
        log.documentName.toLowerCase().includes(q) ||
        log.user.toLowerCase().includes(q) ||
        (log.details ?? '').toLowerCase().includes(q);
      const matchAction = filterAction === 'all' || log.action === filterAction;
      const matchUser   = filterUser === 'all' || log.user === filterUser;
      const logDate     = new Date(log.date);
      const matchFrom   = !dateFrom || logDate >= new Date(dateFrom);
      const matchTo     = !dateTo   || logDate <= new Date(dateTo + 'T23:59:59');
      return matchSearch && matchAction && matchUser && matchFrom && matchTo;
    });
  }, [allLogs, search, filterAction, filterUser, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  const resetPage = useCallback(() => setPage(1), []);
  useEffect(() => { resetPage(); }, [search, filterAction, filterUser, dateFrom, dateTo, resetPage]);

  const hasActiveFilters = filterAction !== 'all' || filterUser !== 'all' || dateFrom || dateTo || search;

  const resetAllFilters = () => {
    setSearch(''); setFilterAction('all'); setFilterUser('all');
    setDateFrom(''); setDateTo(''); setPage(1);
  };

  const refresh = () => {
    loadLogs();
  };

  return (
    <>
      <Helmet>
        <title>Activité — ItDoc</title>
        <meta name="description" content="Journal d'activité et historique des actions des utilisateurs." />
      </Helmet>

      <div className="space-y-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Historique d'activité</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} événement{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
              {allLogs.length !== filtered.length ? ` sur ${allLogs.length} au total` : ''}
              {isLoadingBackend && <span className="ml-2 text-xs opacity-60">· chargement…</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Réinitialiser les filtres
              </button>
            )}
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Actualiser"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Actualiser
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          {/* Row 1: search + action */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="activity-search"
                type="search"
                placeholder="Rechercher un document, utilisateur, détail…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition"
              />
            </div>

            {/* Action filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                id="activity-action-filter"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value as FilterAction)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer"
              >
                <option value="all">Toutes les actions</option>
                <option value="upload">Imports</option>
                <option value="scan">Scans / OCR</option>
                <option value="cloud_import">Import Cloud</option>
                <option value="download">Téléchargements</option>
                <option value="view">Consultations</option>
                <option value="edit">Modifications</option>
                <option value="delete">Suppressions</option>
                <option value="restore">Restaurations</option>
                <option value="share">Partages</option>
                <option value="approve">Approbations</option>
                <option value="reject">Rejets</option>
                <option value="archive">Archivages</option>
                <option value="version_restore">Restaurations de version</option>
                <option value="create_folder">Nouveaux dossiers</option>
                <option value="tag">Tags</option>
                <option value="expiry_set">Expirations définies</option>
              </select>
            </div>
          </div>

          {/* Row 2: user + dates */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* User filter */}
            <div className="flex items-center gap-2 flex-1">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                id="activity-user-filter"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer"
              >
                <option value="all">Tous les utilisateurs</option>
                {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                title="Date depuis"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                title="Date jusqu'au"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Effacer les dates"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
              {search && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                  Recherche: &ldquo;{search}&rdquo;
                  <button onClick={() => setSearch('')}><X className="h-3 w-3" /></button>
                </span>
              )}
              {filterAction !== 'all' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                  Action: {ACTION_CONFIG[filterAction]?.label ?? filterAction}
                  <button onClick={() => setFilterAction('all')}><X className="h-3 w-3" /></button>
                </span>
              )}
              {filterUser !== 'all' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                  Utilisateur: {filterUser}
                  <button onClick={() => setFilterUser('all')}><X className="h-3 w-3" /></button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                  Depuis: {dateFrom}
                  <button onClick={() => setDateFrom('')}><X className="h-3 w-3" /></button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                  Jusqu'au: {dateTo}
                  <button onClick={() => setDateTo('')}><X className="h-3 w-3" /></button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timeline / List */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loadError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 mb-3">
                <XCircle className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Impossible de charger les activités</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Une erreur s'est produite lors du chargement des données.
              </p>
              <button
                onClick={refresh}
                className="mt-4 text-xs text-primary font-medium hover:underline"
              >
                Réessayer
              </button>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Aucune activité trouvée</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Ajustez vos filtres pour voir plus de résultats.
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetAllFilters}
                  className="mt-4 text-xs text-primary font-medium hover:underline"
                >
                  Réinitialiser tous les filtres
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {paginated.map((log) => {
                const config = ACTION_CONFIG[log.action] ?? ACTION_CONFIG['view'];
                const Icon = config.icon;
                return (
                  <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-accent/30 transition-colors group">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                        <p className="text-sm font-medium text-foreground">
                          {config.label}{' '}
                          <span className="text-muted-foreground font-normal mx-1">sur</span>{' '}
                          <Highlight text={log.documentName} query={search} />
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                          <Clock className="h-3 w-3" />
                          {new Date(log.date).toLocaleString('fr-FR', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                          Effectué par{' '}
                          <button
                            onClick={() => { setFilterUser(log.user); setPage(1); }}
                            className="font-medium text-foreground hover:text-primary hover:underline transition-colors"
                            title={`Filtrer par ${log.user}`}
                          >
                            <Highlight text={log.user} query={search} />
                          </button>
                        </p>
                        {log.details && (
                          <>
                            <span className="text-muted-foreground/30">•</span>
                            <p className="text-xs text-muted-foreground truncate max-w-xs">
                              <Highlight text={log.details} query={search} />
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-card rounded-xl">
            <p className="text-xs text-muted-foreground">
              Page {page} / {totalPages} — {filtered.length} événement(s)
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) {
                  p = i + 1;
                } else if (page <= 4) {
                  p = i + 1;
                } else if (page >= totalPages - 3) {
                  p = totalPages - 6 + i;
                } else {
                  p = page - 3 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                      p === page
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Page suivante"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
