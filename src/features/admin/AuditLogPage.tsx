import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  User,
  Monitor,
  Globe,
  Filter,
  X,
  ChevronDown,
  UploadCloud,
  Download,
  Trash2,
  Pencil,
  Eye,
  Info,
} from 'lucide-react';
import { getActivityLogs, getUsersForAuditFilter, type BackendActivityDto, type UserForAuditFilterDto, type GetActivityInput } from '@/features/activity/activity.service';
import { Role } from '@/lib/auth-rbac/roles';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { Navigate } from 'react-router-dom';

// ─── Config ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  Upload:   { label: 'Import',        icon: UploadCloud, color: 'text-orange-500 bg-orange-500/10' },
  Download: { label: 'Téléchargement', icon: Download,   color: 'text-zinc-500 bg-zinc-500/10' },
  Delete:   { label: 'Suppression',   icon: Trash2,      color: 'text-red-500 bg-red-500/10' },
  Update:   { label: 'Modification',  icon: Pencil,      color: 'text-purple-500 bg-purple-500/10' },
  View:     { label: 'Consultation',  icon: Eye,         color: 'text-indigo-500 bg-indigo-500/10' },
  Info:     { label: 'Action',        icon: Info,        color: 'text-sky-500 bg-sky-500/10' },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CONFIG[action] ?? ACTION_CONFIG.Info;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AuditLogContent() {
  const [items, setItems] = useState<BackendActivityDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserForAuditFilterDto[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // Filters
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const selectedActionLabel = actionFilter
    ? (ACTION_CONFIG[actionFilter]?.label ?? actionFilter)
    : 'Toutes les actions';

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  // Load users for filter dropdown
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await getUsersForAuditFilter();
        setUsers(data);
      } catch {
        // Silently fail - users list not critical
      } finally {
        setUsersLoading(false);
      }
    };
    loadUsers();
  }, []);

  const load = useCallback(async (currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const input: GetActivityInput = {
        skipCount: currentPage * PAGE_SIZE,
        maxResultCount: PAGE_SIZE,
        sorting: 'ExecutionTime desc',
      };
      if (selectedUserId) input.userId = selectedUserId;
      if (actionFilter) input.actionType = actionFilter;
      if (startDate) input.startDate = new Date(startDate).toISOString();
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        input.endDate = end.toISOString();
      }
      const result = await getActivityLogs(input);
      setItems(result.items);
      setTotalCount(result.totalCount);
    } catch (err) {
      setError('Impossible de charger les journaux d\'audit. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }, [selectedUserId, actionFilter, startDate, endDate]);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    load(0);
  };

  const clearFilters = () => {
    setSelectedUserId('');
    setActionFilter('');
    setStartDate('');
    setEndDate('');
    setPage(0);
  };

  const hasActiveFilters = selectedUserId || actionFilter || startDate || endDate;

  return (
    <div className="flex flex-col gap-6">
      <Helmet>
        <title>Journal d'audit — ItDoc</title>
      </Helmet>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Journal d'audit</h1>
            <p className="text-sm text-muted-foreground">
              Toutes les actions des utilisateurs sur la plateforme
            </p>
          </div>
        </div>
        <button
          onClick={() => load(page)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Filters */}
      <form
        onSubmit={handleFilterSubmit}
        className="flex flex-wrap gap-3 p-4 bg-muted/40 border border-border rounded-xl"
      >
        <div
          ref={userMenuRef}
          className="relative flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 transition-colors hover:border-blue-500/70"
        >
          <User className="w-4 h-4 text-muted-foreground shrink-0" />
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 text-sm text-foreground hover:text-blue-500"
            aria-haspopup="listbox"
            aria-expanded={isUserMenuOpen}
          >
            <span>{selectedUserId ? users.find(u => u.id === selectedUserId)?.userName || 'Utilisateur' : 'Tous les utilisateurs'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isUserMenuOpen && (
            <ul
              role="listbox"
              className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-56 max-h-64 overflow-y-auto rounded-lg border border-border bg-background shadow-lg"
            >
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUserId('');
                    setIsUserMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-blue-500 hover:text-white ${selectedUserId === '' ? 'bg-blue-500/15 text-foreground' : 'text-foreground'}`}
                >
                  Tous les utilisateurs
                </button>
              </li>
              {usersLoading ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">Chargement...</li>
              ) : (
                users.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setIsUserMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-blue-500 hover:text-white ${selectedUserId === user.id ? 'bg-blue-500/15 text-foreground' : 'text-foreground'}`}
                    >
                      {user.userName}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div
          ref={actionMenuRef}
          className="relative flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 transition-colors hover:border-orange-500/70"
        >
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <button
            type="button"
            onClick={() => setIsActionMenuOpen((v) => !v)}
            className="flex items-center gap-2 text-sm text-foreground hover:text-orange-500"
            aria-haspopup="listbox"
            aria-expanded={isActionMenuOpen}
          >
            <span>{selectedActionLabel}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isActionMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isActionMenuOpen && (
            <ul
              role="listbox"
              className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-56 overflow-hidden rounded-lg border border-border bg-background shadow-lg"
            >
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActionFilter('');
                    setIsActionMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-orange-500 hover:text-white ${actionFilter === '' ? 'bg-orange-500/15 text-foreground' : 'text-foreground'}`}
                >
                  Toutes les actions
                </button>
              </li>
              {Object.entries(ACTION_CONFIG).map(([k, v]) => (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => {
                      setActionFilter(k);
                      setIsActionMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-orange-500 hover:text-white ${actionFilter === k ? 'bg-orange-500/15 text-foreground' : 'text-foreground'}`}
                  >
                    {v.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent text-sm outline-none text-foreground"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent text-sm outline-none text-foreground"
          />
        </div>

        <button
          type="submit"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Search className="w-4 h-4" />
          Filtrer
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
            Réinitialiser
          </button>
        )}
      </form>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          {error}
          <button
            onClick={() => load(page)}
            className="ml-auto underline underline-offset-2 hover:no-underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Utilisateur</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ressource</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  IP
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  Aucune entrée trouvée pour les filtres sélectionnés.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((entry) => (
                <tr
                  key={entry.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(entry.executionTime)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground">{entry.userName || '—'}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={entry.actionName} />
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <span className="truncate block text-foreground" title={entry.title || entry.entityId}>
                      {entry.title || (entry.entityId ? `#${entry.entityId.slice(0, 8)}` : '—')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.entityName || '—'}</td>
                  <td className="px-4 py-3">
                    {entry.clientIpAddress ? (
                      <span className="flex items-center gap-1 text-muted-foreground font-mono text-xs">
                        <Monitor className="w-3 h-3 shrink-0" />
                        {entry.clientIpAddress}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {totalCount} entrée{totalCount !== 1 ? 's' : ''}
            {hasActiveFilters ? ' (filtrées)' : ' au total'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 rounded-lg border border-border bg-background font-medium text-foreground">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AuditLogPage() {
  return (
    <RoleGuard allowedRoles={[Role.ADMIN]} fallback={<Navigate to="/dashboard" replace />}>
      <AuditLogContent />
    </RoleGuard>
  );
}
