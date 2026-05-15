import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Trash2, Library, Clock, X, AlertTriangle, Share2, UserPlus, Search, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { Permission, Role } from '@/lib/auth-rbac/roles';
import {
  getLibraries,
  createLibrary,
  deleteLibrary,
  getLibraryAccess,
  grantLibraryAccess,
  revokeLibraryAccess,
  type LibraryDto,
  type LibraryAccessDto,
} from './library.service';
import { getShareableUsers, type ShareableUserDto } from '@/features/admin/admin.service';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LibrariesPage() {
  const { hasPermission, user } = useAuth();
  const [libraries, setLibraries] = useState<LibraryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [libraryToDelete, setLibraryToDelete] = useState<LibraryDto | null>(null);

  // ── Share modal state ──────────────────────────────────────────────────
  const [libraryToShare, setLibraryToShare] = useState<LibraryDto | null>(null);
  const [accessList, setAccessList] = useState<LibraryAccessDto[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<ShareableUserDto[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const canManage = hasPermission(Permission.MANAGE_DOCUMENTS);
  const isAdmin = (user?.role ?? '').toLowerCase() === Role.ADMIN;
  const canShare = (lib: LibraryDto) => {
    if (isAdmin) return true;
    if (!user?.id || !lib.creatorId) return false;
    return lib.creatorId.toLowerCase() === user.id.toLowerCase();
  };

  useEffect(() => {
    loadLibraries();
  }, []);

  async function loadLibraries() {
    try {
      setLoading(true);
      const data = await getLibraries();
      setLibraries(data);
    } catch (error) {
      toast.error('Échec du chargement des bibliothèques');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError('Le nom de la bibliothèque ne peut pas être vide');
      return;
    }

    if (libraries.some(lib => lib.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('Une bibliothèque avec ce nom existe déjà');
      return;
    }

    try {
      setSubmitting(true);
      await createLibrary({ name: trimmed, description: description.trim() || undefined, isPublic });
      toast.success('Bibliothèque créée avec succès');
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setIsPublic(false);
      setError('');
      loadLibraries();
    } catch (error) {
      toast.error('Échec de la création de la bibliothèque');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!libraryToDelete) return;

    try {
      await deleteLibrary(libraryToDelete.id);
      toast.success('Bibliothèque supprimée');
      setLibraryToDelete(null);
      loadLibraries();
    } catch (error) {
      toast.error('Échec de la suppression de la bibliothèque');
    }
  }

  // ── Share modal handlers ─────────────────────────────────────────────────

  async function openShareModal(lib: LibraryDto) {
    setLibraryToShare(lib);
    setUserSearch('');
    setAccessLoading(true);
    try {
      const [acl, usersResp] = await Promise.all([
        getLibraryAccess(lib.id),
        getShareableUsers(),
      ]);
      setAccessList(acl);
      setAllUsers(usersResp);
    } catch {
      toast.error("Échec du chargement des accès");
      setLibraryToShare(null);
    } finally {
      setAccessLoading(false);
    }
  }

  async function handleGrantAccess(userId: string) {
    if (!libraryToShare) return;
    try {
      const newEntry = await grantLibraryAccess(libraryToShare.id, userId);
      setAccessList(prev => {
        if (prev.some(a => a.userId === userId)) return prev;
        return [...prev, newEntry].sort((a, b) => a.userName.localeCompare(b.userName));
      });
      toast.success('Accès accordé');
    } catch {
      toast.error("Échec de l'octroi de l'accès");
    }
  }

  async function handleRevokeAccess(entry: LibraryAccessDto) {
    if (!libraryToShare) return;
    if (libraryToShare.creatorId === entry.userId) {
      toast.error("Impossible de révoquer l'accès du propriétaire");
      return;
    }
    try {
      await revokeLibraryAccess(libraryToShare.id, entry.userId);
      setAccessList(prev => prev.filter(a => a.userId !== entry.userId));
      toast.success('Accès révoqué');
    } catch {
      toast.error("Échec de la révocation");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Bibliothèques — ItDoc</title>
        <meta name="description" content="Gestion des bibliothèques de documents." />
      </Helmet>

      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bibliothèques</h1>
            <p className="text-sm text-muted-foreground">
              {libraries.length} bibliothèque(s)
            </p>
          </div>
          {canManage && (
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="primary"
              size="md"
            >
              <Plus className="h-4 w-4" />
              Créer une bibliothèque
            </Button>
          )}
        </div>

        {/* Libraries Grid */}
        {libraries.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-2xl bg-card">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Library className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Aucune bibliothèque</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {canManage
                ? 'Créez votre première bibliothèque pour commencer à organiser vos documents.'
                : 'Aucune bibliothèque disponible pour le moment.'}
            </p>
            {canManage && (
              <Button
                onClick={() => setShowCreateModal(true)}
                variant="primary"
                size="lg"
                className="mt-6"
              >
                Créer la première bibliothèque
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {libraries.map((lib) => (
              <div
                key={lib.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all overflow-hidden"
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 transition-transform group-hover:scale-125" />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Library className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1">
                      {lib.isPublic && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20">
                          <Globe className="h-2.5 w-2.5" /> Public
                        </span>
                      )}
                      {canShare(lib) && (
                        <button
                          onClick={() => openShareModal(lib)}
                          className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                          title="Partager"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => setLibraryToDelete(lib)}
                          className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors truncate" title={lib.name}>
                    {lib.name}
                  </h3>
                  {lib.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {lib.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-border/50 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(lib.creationTime).toLocaleDateString('fr-FR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Library Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Library className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Nouvelle bibliothèque</h2>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setName('');
                  setDescription('');
                  setIsPublic(false);
                  setError('');
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label htmlFor="libraryName" className="block text-sm font-medium text-foreground mb-1">
                  Nom de la bibliothèque
                </label>
                <Input
                  autoFocus
                  id="libraryName"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  placeholder="ex: Ressources Humaines"
                  variant="md"
                />
                {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
              </div>
              <div>
                <label htmlFor="libraryDescription" className="block text-sm font-medium text-foreground mb-1">
                  Description (optionnel)
                </label>
                <textarea
                  id="libraryDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez l'objectif de cette bibliothèque..."
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/80"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setName('');
                    setDescription('');
                    setIsPublic(false);
                    setError('');
                  }}
                  variant="outline"
                  size="md"
                  disabled={submitting}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submitting}
                >
                  {submitting ? 'Création...' : 'Créer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {libraryToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-red-500/10">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-500">
                <AlertTriangle className="h-5 w-5" />
                <h2 className="text-base font-semibold">Supprimer la bibliothèque</h2>
              </div>
              <button
                onClick={() => setLibraryToDelete(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-foreground">
                Êtes-vous sûr de vouloir supprimer la bibliothèque <strong>{libraryToDelete.name}</strong> ?
              </p>
              <div className="rounded-lg bg-accent/50 p-3 text-sm text-muted-foreground">
                Cette action est définitive et supprimera tous les dossiers et documents associés.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={() => setLibraryToDelete(null)}
                  variant="outline"
                  size="md"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleDelete}
                  variant="destructive"
                  size="md"
                >
                  Supprimer définitivement
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Library Modal */}
      {libraryToShare && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">
                  Partager « {libraryToShare.name} »
                </h2>
              </div>
              <button
                onClick={() => { setLibraryToShare(null); setAccessList([]); setUserSearch(''); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {accessLoading ? (
              <div className="p-10 flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border min-h-[400px]">
                {/* Currently shared */}
                <div className="flex flex-col p-4 overflow-hidden">
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Accès actuel ({accessList.length})
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {accessList.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Aucun accès
                      </p>
                    ) : accessList.map(entry => {
                      const isOwner = libraryToShare.creatorId === entry.userId;
                      return (
                        <div
                          key={entry.userId}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">
                              {entry.userName}
                              {isOwner && (
                                <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-primary">
                                  Propriétaire
                                </span>
                              )}
                            </p>
                            {entry.email && (
                              <p className="text-xs text-muted-foreground truncate">
                                {entry.email}
                              </p>
                            )}
                          </div>
                          {!isOwner && (
                            <button
                              onClick={() => handleRevokeAccess(entry)}
                              className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all"
                              title="Révoquer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add a user */}
                <div className="flex flex-col p-4 overflow-hidden">
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Ajouter un utilisateur
                  </h3>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Rechercher un utilisateur..."
                      variant="md"
                      className="pl-9"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {(() => {
                      const grantedIds = new Set(accessList.map(a => a.userId));
                      const term = userSearch.trim().toLowerCase();
                      const candidates = allUsers
                        .filter(u => !grantedIds.has(u.id))
                        .filter(u => !term ||
                          u.userName.toLowerCase().includes(term) ||
                          (u.email && u.email.toLowerCase().includes(term)) ||
                          (u.name && u.name.toLowerCase().includes(term)));

                      if (candidates.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            {term ? 'Aucun résultat' : 'Tous les utilisateurs ont déjà accès'}
                          </p>
                        );
                      }
                      return candidates.slice(0, 50).map(u => (
                        <button
                          key={u.id}
                          onClick={() => handleGrantAccess(u.id)}
                          className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left hover:border-primary/40 hover:bg-primary/5 transition-all"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">
                              {u.userName}
                            </p>
                            {u.email && (
                              <p className="text-xs text-muted-foreground truncate">
                                {u.email}
                              </p>
                            )}
                          </div>
                          <UserPlus className="flex-shrink-0 h-4 w-4 text-primary" />
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
