import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Users,
  ShieldCheck,
  ChevronDown,
  UserCheck,
  UserX,
  Save,
  AlertCircle,
  Database,
  Cloud,
  HardDrive,
  Sliders,
  Search,
  UserPlus,
  Pencil,
  Trash2,
  Key,
  X,
  FileText,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Role, Permission } from '@/lib/auth-rbac/roles';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/providers/auth-provider';
import { toast } from 'sonner';
import { MetadataFieldsTab } from './MetadataFieldsTab';
import { getUsers, updateUser, createUser, deleteUser, getUserRoles, setUserRoles, getRolePermissions, updateRolePermissions, getUserTags, setUserTags, getAllTags, type IdentityUserDto, type PermissionListResultDto, type PermissionGrantInfo } from './admin.service';
import { getMyStorageGrants, setMyActiveProvider, type TenantStorageGrantDto, type StorageProviderType } from '@/features/host/storage.service';
import { shareRequestService, type ShareRequestDto } from '@/features/documents/share-request.service';

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminTab = 'users' | 'roles' | 'storage' | 'metadata' | 'share-requests';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEffectiveRole(roleNames: string[] | undefined | null): Role {
  const lower = (roleNames ?? []).map((r) => r.toLowerCase());
  if (lower.some((r) => r === 'admin')) return Role.ADMIN;
  if (lower.some((r) => r === 'manager')) return Role.MANAGER;
  return Role.USER;
}

function getDisplayName(u: IdentityUserDto): string {
  return `${u.name ?? ''} ${u.surname ?? ''}`.trim() || u.userName;
}

const ROLE_BADGE_COLOR: Record<Role, string> = {
  [Role.ADMIN]:   'bg-red-500/10 text-red-500',
  [Role.MANAGER]: 'bg-indigo-500/10 text-indigo-500',
  [Role.USER]:    'bg-blue-500/10 text-blue-500',
};

const ROLE_LABEL: Record<Role, string> = {
  [Role.ADMIN]:   'Admin',
  [Role.MANAGER]: 'Manager',
  [Role.USER]:    'Standard User',
};

const DEFAULT_TAG_SUGGESTIONS = [
  'finance',
  'hr',
  'legal',
  'it',
  'operations',
  'sales',
  'marketing',
  'procurement',
  'management',
  'audit',
  'quality',
  'support',
];

// ─── Tab: Users ───────────────────────────────────────────────────────────────

function UsersTab() {
  const { user } = useAuth();
  const isAdminUser = (user?.role ?? '').toLowerCase() === Role.ADMIN;

  const parseTags = (value: string) => value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const appendTag = (currentValue: string, tagToAdd: string) => {
    const existing = parseTags(currentValue);
    if (existing.some((t) => t.toLowerCase() === tagToAdd.toLowerCase())) {
      return currentValue;
    }
    return [...existing, tagToAdd].join(', ');
  };

  const loadAvailableTags = async () => {
    try {
      const tags = await getAllTags();
      setAvailableTags(tags);
    } catch {
      setAvailableTags([]);
      toast.error('Impossible de charger les étiquettes existantes');
    }
  };

  const [users, setUsers] = useState<IdentityUserDto[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    userName: '',
    name: '',
    surname: '',
    email: '',
    password: '',
    role: Role.USER as Role,
    tags: '',
  });

  // Edit / delete / reset-password modals
  const [editingUser, setEditingUser] = useState<IdentityUserDto | null>(null);
  const [editForm, setEditForm] = useState({ userName: '', name: '', surname: '', email: '', role: Role.USER as Role, tags: '' });
  const [editing, setEditing] = useState(false);

  const [deletingUser, setDeletingUser] = useState<IdentityUserDto | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [pwdUser, setPwdUser] = useState<IdentityUserDto | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPwd, setResettingPwd] = useState(false);

  const suggestedTags = Array.from(
    new Set([
      ...DEFAULT_TAG_SUGGESTIONS,
      ...availableTags.map((t) => t.trim().toLowerCase()),
    ]),
  );

  useEffect(() => {
    if (!isAdminUser) {
      setUsers([]);
      setIsLoading(false);
      loadAvailableTags();
      return;
    }

    setIsLoading(true);
    getUsers({ maxResultCount: 100 })
      .then(async (result) => {
        // The list endpoint does not always populate roleNames — fetch roles
        // per user so the table reflects the real role.
        const withRoles = await Promise.all(
          result.items.map(async (u) => {
            if (u.roleNames && u.roleNames.length > 0) return u;
            try {
              const roles = await getUserRoles(u.id);
              return { ...u, roleNames: roles };
            } catch {
              return { ...u, roleNames: u.roleNames ?? [] };
            }
          }),
        );
        setUsers(withRoles);
      })
      .catch(() => toast.error('Erreur lors du chargement des utilisateurs'))
      .finally(() => setIsLoading(false));

    loadAvailableTags();
  }, [isAdminUser]);

  const handleRoleChange = async (user: IdentityUserDto, newRole: Role) => {
    try {
      await setUserRoles(user.id, [newRole]);
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, roleNames: [newRole] } : u)
      );
      toast.success('Rôle mis à jour avec succès');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Erreur lors de la mise à jour du rôle';
      toast.error(msg);
    }
  };

  const toggleActive = async (user: IdentityUserDto) => {
    try {
      await updateUser(user.id, {
        userName: user.userName,
        name: user.name,
        surname: user.surname,
        email: user.email,
        roleNames: user.roleNames ?? [],
        isActive: !user.isActive,
        extraProperties: { ClearanceLevel: 0 },
      });
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, isActive: !u.isActive } : u)
      );
    } catch {
      toast.error("Erreur lors de la mise à jour du statut");
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const displayName = getDisplayName(u);
    return displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const resetForm = () => setNewUser({ userName: '', name: '', surname: '', email: '', password: '', role: Role.USER, tags: '' });

  const handleCreate = async () => {
    if (!newUser.userName || !newUser.email || !newUser.password) {
      toast.error('Nom d’utilisateur, email et mot de passe sont obligatoires');
      return;
    }
    setCreating(true);
    try {
      const parsedTags = parseTags(newUser.tags);
      const created = await createUser({
        userName: newUser.userName,
        name: newUser.name || undefined,
        surname: newUser.surname || undefined,
        email: newUser.email,
        password: newUser.password,
        roleNames: [newUser.role],
        isActive: true,
        extraProperties: { ClearanceLevel: 0 },
      });
      if (parsedTags.length > 0) {
        await setUserTags(created.id, parsedTags);
        setAvailableTags((prev) =>
          Array.from(new Set([...prev, ...parsedTags.map((t) => t.toLowerCase())])).sort(),
        );
      }
      // Force the row to display the role we just assigned, even if the
      // create response omits roleNames.
      const createdWithRole: IdentityUserDto = {
        ...created,
        roleNames: created.roleNames && created.roleNames.length > 0
          ? created.roleNames
          : [newUser.role],
      };
      setUsers((prev) => [createdWithRole, ...prev]);
      toast.success('Utilisateur créé avec succès');
      setShowCreate(false);
      resetForm();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Erreur lors de la création de l’utilisateur';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const openEdit = async (u: IdentityUserDto) => {
    await loadAvailableTags();
    setEditingUser(u);
    setEditForm({
      userName: u.userName,
      name: u.name ?? '',
      surname: u.surname ?? '',
      email: u.email,
      role: getEffectiveRole(u.roleNames),
      tags: '',
    });
    try {
      const userTags = await getUserTags(u.id);
      setEditForm({
        userName: u.userName,
        name: u.name ?? '',
        surname: u.surname ?? '',
        email: u.email,
        role: getEffectiveRole(u.roleNames),
        tags: userTags.tags.join(', '),
      });
    } catch {
      toast.error('Impossible de charger les étiquettes de cet utilisateur');
    }
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    if (!editForm.userName || !editForm.email) {
      toast.error("Nom d'utilisateur et email sont obligatoires");
      return;
    }
    setEditing(true);
    try {
      const parsedTags = parseTags(editForm.tags);
      const updated = await updateUser(editingUser.id, {
        userName: editForm.userName,
        name: editForm.name || undefined,
        surname: editForm.surname || undefined,
        email: editForm.email,
        roleNames: [editForm.role],
        isActive: editingUser.isActive,
        extraProperties: { ClearanceLevel: 0 },
      });
      await setUserTags(editingUser.id, parsedTags);
      setAvailableTags((prev) =>
        Array.from(new Set([...prev, ...parsedTags.map((t) => t.toLowerCase())])).sort(),
      );
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, ...updated, roleNames: [editForm.role] }
            : u,
        ),
      );
      toast.success('Utilisateur modifié avec succès');
      setEditingUser(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || "Erreur lors de la modification";
      toast.error(msg);
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setConfirmingDelete(true);
    try {
      await deleteUser(deletingUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      toast.success('Utilisateur supprimé');
      setDeletingUser(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Erreur lors de la suppression';
      toast.error(msg);
    } finally {
      setConfirmingDelete(false);
    }
  };

  const handleResetPassword = async () => {
    if (!pwdUser) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setResettingPwd(true);
    try {
      await updateUser(pwdUser.id, {
        userName: pwdUser.userName,
        name: pwdUser.name,
        surname: pwdUser.surname,
        email: pwdUser.email,
        password: newPassword,
        roleNames: pwdUser.roleNames ?? [],
        isActive: pwdUser.isActive,
        extraProperties: { ClearanceLevel: 0 },
      });
      toast.success('Mot de passe réinitialisé');
      setPwdUser(null);
      setNewPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Erreur lors de la réinitialisation';
      toast.error(msg);
    } finally {
      setResettingPwd(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Chargement des utilisateurs…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {!isAdminUser && (
        <div className="px-4 py-3 border-b border-border bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
          La gestion complète des utilisateurs est réservée aux administrateurs.
        </div>
      )}
      <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un utilisateur (nom ou email)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button
          id="admin-new-user"
          onClick={async () => {
            await loadAvailableTags();
            setShowCreate(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Nouvel utilisateur
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Utilisateur</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Rôle</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Membre depuis</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Aucun utilisateur ne correspond à votre recherche.
                </td>
              </tr>
            ) : filteredUsers.map((u) => {
              const displayName = getDisplayName(u);
              const effectiveRole = getEffectiveRole(u.roleNames);
              const initials = displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <tr key={u.id} className="hover:bg-accent/30 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary border border-primary/20">
                        {initials}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{displayName}</p>
                        <p className="text-[11px] text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="relative inline-flex items-center">
                      <select
                        value={effectiveRole}
                        onChange={(e) => handleRoleChange(u, e.target.value as Role)}
                        className={`appearance-none rounded-full pl-2.5 pr-6 py-1 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/50 ${ROLE_BADGE_COLOR[effectiveRole]}`}
                        id={`user-role-${u.id}`}
                      >
                        {Object.values(Role).map((r) => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3" />
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${u.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-500/10 text-zinc-500'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                      {u.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {new Date(u.creationTime).toLocaleDateString('fr-FR')}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        title="Modifier"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        id={`user-edit-${u.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => { setPwdUser(u); setNewPassword(''); }}
                        title="Réinitialiser le mot de passe"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        id={`user-pwd-${u.id}`}
                      >
                        <Key className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        title={u.isActive ? 'Désactiver' : 'Activer'}
                        className={`rounded-lg p-1.5 transition-colors ${
                          u.isActive
                            ? 'text-amber-500 hover:bg-amber-500/10'
                            : 'text-emerald-500 hover:bg-emerald-500/10'
                        }`}
                        id={`user-toggle-${u.id}`}
                      >
                        {u.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => setDeletingUser(u)}
                        title="Supprimer"
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10 transition-colors"
                        id={`user-delete-${u.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !creating && setShowCreate(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Nouvel utilisateur</h2>
              </div>
              <button onClick={() => !creating && setShowCreate(false)} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Nom d'utilisateur *</label>
                <input
                  id="new-user-username"
                  type="text"
                  value={newUser.userName}
                  onChange={(e) => setNewUser({ ...newUser, userName: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Prénom</label>
                  <input
                    id="new-user-name"
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Nom</label>
                  <input
                    id="new-user-surname"
                    type="text"
                    value={newUser.surname}
                    onChange={(e) => setNewUser({ ...newUser, surname: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Email *</label>
                <input
                  id="new-user-email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Mot de passe *</label>
                <input
                  id="new-user-password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Min. 8 caractères, 1 maj., 1 chiffre, 1 spécial"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Rôle</label>
                <select
                  id="new-user-role"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {Object.values(Role).map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Étiquettes</label>
                <input
                  id="new-user-tags"
                  type="text"
                  value={newUser.tags}
                  onChange={(e) => setNewUser({ ...newUser, tags: e.target.value })}
                  list="existing-tags-create"
                  placeholder="finance, hr, legal"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <datalist id="existing-tags-create">
                  {suggestedTags.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
                <p className="mt-1 text-[11px] text-muted-foreground">Séparez les étiquettes par des virgules.</p>
                {suggestedTags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {suggestedTags.slice(0, 20).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setNewUser((prev) => ({ ...prev, tags: appendTag(prev.tags, tag) }))}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-muted-foreground">Aucune étiquette existante pour le moment.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-3 bg-muted/20">
              <button
                onClick={() => { setShowCreate(false); resetForm(); }}
                disabled={creating}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                id="new-user-submit"
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {creating && <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit user modal ─────────────────────────────────── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !editing && setEditingUser(null)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Modifier l'utilisateur</h2>
              </div>
              <button onClick={() => !editing && setEditingUser(null)} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Nom d'utilisateur *</label>
                <input
                  type="text"
                  value={editForm.userName}
                  onChange={(e) => setEditForm({ ...editForm, userName: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Prénom</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Nom</label>
                  <input
                    type="text"
                    value={editForm.surname}
                    onChange={(e) => setEditForm({ ...editForm, surname: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Email *</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Rôle</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {Object.values(Role).map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Étiquettes</label>
                <input
                  type="text"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  list="existing-tags-edit"
                  placeholder="finance, hr, legal"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <datalist id="existing-tags-edit">
                  {suggestedTags.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
                <p className="mt-1 text-[11px] text-muted-foreground">Séparez les étiquettes par des virgules.</p>
                {suggestedTags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {suggestedTags.slice(0, 20).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setEditForm((prev) => ({ ...prev, tags: appendTag(prev.tags, tag) }))}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-muted-foreground">Aucune étiquette existante pour le moment.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3 bg-muted/20">
              <button onClick={() => setEditingUser(null)} disabled={editing} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50">Annuler</button>
              <button onClick={handleEditSave} disabled={editing} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {editing && <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ───────────────────────── */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !confirmingDelete && setDeletingUser(null)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Trash2 className="h-5 w-5 text-red-500" />
              <h2 className="text-base font-semibold text-foreground">Supprimer l'utilisateur</h2>
            </div>
            <div className="p-5 text-sm text-muted-foreground">
              Êtes-vous sûr de vouloir supprimer <span className="font-medium text-foreground">{getDisplayName(deletingUser)}</span> ? Cette action est irréversible.
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3 bg-muted/20">
              <button onClick={() => setDeletingUser(null)} disabled={confirmingDelete} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50">Annuler</button>
              <button onClick={handleDelete} disabled={confirmingDelete} className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
                {confirmingDelete && <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset password modal ────────────────────────────── */}
      {pwdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !resettingPwd && setPwdUser(null)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Key className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Réinitialiser le mot de passe</h2>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                Définir un nouveau mot de passe pour <span className="font-medium text-foreground">{getDisplayName(pwdUser)}</span>.
              </p>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 caractères, 1 maj., 1 chiffre, 1 spécial"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3 bg-muted/20">
              <button onClick={() => setPwdUser(null)} disabled={resettingPwd} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50">Annuler</button>
              <button onClick={handleResetPassword} disabled={resettingPwd} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {resettingPwd && <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Roles ───────────────────────────────────────────────────────────────

const SYSTEM_ROLES: Role[] = [Role.ADMIN, Role.MANAGER, Role.USER];

function RolesTab() {
  const [selectedRole, setSelectedRole] = useState<Role>(Role.MANAGER);
  const [data, setData] = useState<PermissionListResultDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Local override map: permission name → granted bool. Empty when in sync with backend.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const loadPermissions = (role: Role) => {
    setLoading(true);
    setOverrides({});
    getRolePermissions(role)
      .then(setData)
      .catch((err) => {
        const msg = err?.response?.data?.error?.message || 'Erreur lors du chargement des permissions';
        toast.error(msg);
        setData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPermissions(selectedRole);
  }, [selectedRole]);

  const isGranted = (p: PermissionGrantInfo): boolean => {
    return overrides[p.name] ?? p.isGranted;
  };

  const toggle = (p: PermissionGrantInfo) => {
    setOverrides((prev) => ({ ...prev, [p.name]: !isGranted(p) }));
  };

  const dirty = Object.keys(overrides).length > 0;

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const permissions = Object.entries(overrides).map(([name, isGranted]) => ({ name, isGranted }));
      await updateRolePermissions(selectedRole, permissions);
      toast.success('Permissions mises à jour');
      loadPermissions(selectedRole);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Erreur lors de la mise à jour des permissions';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setOverrides({});
  };

  const filteredGroups = (data?.groups ?? [])
    .map((g) => ({
      ...g,
      permissions: g.permissions.filter((p) =>
        !search ||
        p.displayName.toLowerCase().includes(search.toLowerCase()) ||
        p.name.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((g) => g.permissions.length > 0);

  return (
    <div className="space-y-4">
      {/* Role selector */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Sélectionner un rôle</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SYSTEM_ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRole(r)}
              disabled={dirty && r !== selectedRole}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                selectedRole === r
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-accent'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={dirty && r !== selectedRole ? 'Enregistrer ou annuler les modifications avant de changer de rôle' : ''}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Permission list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-3 flex-wrap">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher une permission..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {dirty && (
              <span className="text-xs text-amber-500 inline-flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {Object.keys(overrides).length} modification(s) non enregistrée(s)
              </span>
            )}
            <button
              onClick={handleReset}
              disabled={!dirty || saving}
              className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving && <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
              <Save className="h-3.5 w-3.5" />
              Enregistrer
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">Chargement des permissions…</span>
            </div>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Aucune permission trouvée.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredGroups.map((group) => (
              <div key={group.name} className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-muted-foreground" />
                  {group.displayName}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-5">
                  {group.permissions.map((p) => {
                    const indent = p.parentName ? 'ml-4' : '';
                    const granted = isGranted(p);
                    const changed = overrides[p.name] !== undefined;
                    return (
                      <label
                        key={p.name}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors ${indent} ${changed ? 'bg-amber-500/5 border border-amber-500/20' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={granted}
                          onChange={() => toggle(p)}
                          className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/50"
                        />
                        <span className="text-xs text-foreground">{p.displayName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Share Requests ────────────────────────────────────────────────────

function ShareRequestsTab() {
  const [requests, setRequests] = useState<ShareRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await shareRequestService.getPendingRequests();
      setRequests(data);
    } catch (err: any) {
      toast.error('Impossible de charger les demandes de partage');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (id: string) => {
    setActioning(id);
    try {
      await shareRequestService.approve(id);
      toast.success('Demande approuvée');
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de l\'approbation');
    } finally {
      setActioning(null);
    }
  };

  const handleReject = async (id: string) => {
    setActioning(id);
    try {
      await shareRequestService.reject(id);
      toast.success('Demande rejetée');
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors du rejet');
    } finally {
      setActioning(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Chargement des demandes…</span>
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Aucune demande de partage en attente.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="divide-y divide-border">
        {requests.map((req) => (
          <div key={req.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">Demande de partage</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                Document ID : {req.documentId.substring(0, 8)}… | Permissions : {req.requestedPermissions} | Créée le {new Date(req.creationTime).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApprove(req.id)}
                disabled={actioning === req.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                {actioning === req.id ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Approuver
              </button>
              <button
                onClick={() => handleReject(req.id)}
                disabled={actioning === req.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {actioning === req.id ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 dark:border-red-400 border-t-transparent" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Rejeter
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Storage ────────────────────────────────────────────────────────────

function providerIcon(p: StorageProviderType) {
  if (p === 'Local') return <HardDrive className="h-5 w-5" />;
  if (p === 'S3') return <Cloud className="h-5 w-5" />;
  if (p === 'Minio') return <Database className="h-5 w-5" />;
  return <Database className="h-5 w-5" />;
}

function StorageTab() {
  const [grants, setGrants] = useState<TenantStorageGrantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<StorageProviderType | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await getMyStorageGrants();
      setGrants(data);
    } catch {
      toast.error('Impossible de charger la configuration de stockage');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleActivate = async (providerType: StorageProviderType) => {
    setActivating(providerType);
    try {
      await setMyActiveProvider(providerType);
      toast.success(`Provider actif : ${providerType}`);
      await reload();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Erreur lors de la sélection du provider');
    } finally {
      setActivating(null);
    }
  };

  const activeGrant = grants.find((g) => g.isActive);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">Stockage actif</h2>
          <p className="text-xs text-muted-foreground">
            L'administrateur hôte a accordé les providers ci-dessous à votre organisation.
            Sélectionnez celui que vous souhaitez utiliser.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Save className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : grants.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucun provider de stockage n'a encore été accordé à votre organisation.
            Contactez l'administrateur hôte.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {grants.map((g) => (
              <div
                key={g.providerType}
                className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
                  g.isActive
                    ? 'border-emerald-500/60 bg-emerald-500/5'
                    : 'border-border bg-background hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  {providerIcon(g.providerType)}
                  {g.providerType}
                  {g.isActive && (
                    <span className="ml-auto text-[10px] font-semibold text-emerald-500 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                      Actif
                    </span>
                  )}
                </div>
                {!g.isActive && (
                  <button
                    onClick={() => handleActivate(g.providerType)}
                    disabled={activating === g.providerType}
                    className="flex items-center justify-center gap-1.5 text-xs font-medium text-primary border border-primary/30 rounded-md px-3 py-1.5 hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    {activating === g.providerType ? (
                      <Save className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    Utiliser ce provider
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {activeGrant && (
          <p className="text-xs text-muted-foreground pt-1">
            Provider actif : <span className="font-semibold text-foreground">{activeGrant.providerType}</span>. 
            Les nouvelles versions de documents seront stockées via ce provider.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as AdminTab) || 'users';

  const setActiveTab = (tab: AdminTab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  if (!hasPermission(Permission.MANAGE_USERS)) {
    return <Navigate to="/dashboard" replace />;
  }

  const ALL_TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'roles', label: 'Rôles & Permissions', icon: ShieldCheck },
    { id: 'storage', label: 'Stockage', icon: Database },
    { id: 'metadata', label: 'Métadonnées', icon: Sliders },
    { id: 'share-requests', label: 'Demandes de Partage', icon: FileText },
  ];

  const MANAGER_TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'metadata', label: 'Métadonnées', icon: Sliders },
    { id: 'share-requests', label: 'Demandes de Partage', icon: FileText },
  ];

  const tabs = user?.role === Role.MANAGER ? MANAGER_TABS : ALL_TABS;
  const currentTabIsAllowed = tabs.some((tab) => tab.id === activeTab);
  const resolvedActiveTab = currentTabIsAllowed ? activeTab : tabs[0]?.id ?? 'metadata';

  useEffect(() => {
    if (!currentTabIsAllowed) {
      setActiveTab(resolvedActiveTab);
    }
  }, [currentTabIsAllowed, resolvedActiveTab]);

  return (
    <>
      <Helmet>
        <title>Administration — ItDoc</title>
        <meta name="description" content="Administration du système ItDoc : utilisateurs, rôles et fournisseur d'identité." />
      </Helmet>

      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Administration</h1>
          <p className="text-sm text-muted-foreground mt-1">Configuration du système et gestion des accès.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`admin-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all',
                resolvedActiveTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              ].join(' ')}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {resolvedActiveTab === 'users'          && <UsersTab />}
        {resolvedActiveTab === 'roles'          && <RolesTab />}
        {resolvedActiveTab === 'storage'        && <StorageTab />}
        {resolvedActiveTab === 'metadata'       && <MetadataFieldsTab />}
        {resolvedActiveTab === 'share-requests' && <ShareRequestsTab />}
      </div>
    </>
  );
}
