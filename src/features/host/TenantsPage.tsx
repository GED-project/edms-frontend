import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Plus, Trash2, Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TenantDto,
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
} from './tenant.service';

interface CreateForm {
  name: string;
  adminEmailAddress: string;
  adminPassword: string;
}

interface EditForm {
  id: string;
  name: string;
  concurrencyStamp?: string;
}

export function TenantsPage() {
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    name: '',
    adminEmailAddress: '',
    adminPassword: '',
  });

  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const page = await listTenants({ maxResultCount: 200 });
      setTenants(page.items);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Erreur de chargement des tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const submitCreate = async () => {
    if (!createForm.name || !createForm.adminEmailAddress || !createForm.adminPassword) {
      toast.error('Tous les champs sont requis');
      return;
    }
    setCreating(true);
    try {
      await createTenant(createForm);
      toast.success(`Tenant "${createForm.name}" créé`);
      setCreateOpen(false);
      setCreateForm({ name: '', adminEmailAddress: '', adminPassword: '' });
      await reload();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Création échouée');
    } finally {
      setCreating(false);
    }
  };

  const submitEdit = async () => {
    if (!editForm) return;
    if (!editForm.name) {
      toast.error('Le nom est requis');
      return;
    }
    setBusyId(editForm.id);
    try {
      await updateTenant(editForm.id, {
        name: editForm.name,
        concurrencyStamp: editForm.concurrencyStamp,
      });
      toast.success('Tenant mis à jour');
      setEditForm(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Mise à jour échouée');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (t: TenantDto) => {
    if (!confirm(`Supprimer le tenant "${t.name}" ? Cette action est irréversible.`)) return;
    setBusyId(t.id);
    try {
      await deleteTenant(t.id);
      toast.success(`Tenant "${t.name}" supprimé`);
      await reload();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Suppression échouée');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Tenants
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Liste des organisations clientes hébergées sur la plateforme.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} variant="primary">
          <Plus className="h-4 w-4" />
          Nouveau tenant
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Chargement…
          </div>
        ) : tenants.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun tenant pour le moment. Créez-en un pour commencer.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nom</th>
                <th className="px-4 py-3 text-left font-medium">ID</th>
                <th className="px-4 py-3 text-right font-medium w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {t.id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={busyId === t.id}
                        onClick={() =>
                          setEditForm({
                            id: t.id,
                            name: t.name,
                            concurrencyStamp: t.concurrencyStamp,
                          })
                        }
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={busyId === t.id}
                        onClick={() => handleDelete(t)}
                        title="Supprimer"
                        className="text-destructive hover:text-destructive"
                      >
                        {busyId === t.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {createOpen && (
        <Modal title="Nouveau tenant" onClose={() => setCreateOpen(false)}>
          <div className="space-y-4">
            <Field label="Nom du tenant">
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="acme"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ce nom sert aussi de sous-domaine. Ex: <code>acme</code> →{' '}
                <code>acme.localhost:5174</code>
              </p>
            </Field>
            <Field label="Email de l'admin du tenant">
              <Input
                type="email"
                value={createForm.adminEmailAddress}
                onChange={(e) =>
                  setCreateForm({ ...createForm, adminEmailAddress: e.target.value })
                }
                placeholder="admin@acme.com"
              />
            </Field>
            <Field label="Mot de passe initial de l'admin">
              <Input
                type="password"
                value={createForm.adminPassword}
                onChange={(e) =>
                  setCreateForm({ ...createForm, adminPassword: e.target.value })
                }
                placeholder="1q2w3E*"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Annuler
            </Button>
            <Button onClick={submitCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer
            </Button>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editForm && (
        <Modal title="Modifier le tenant" onClose={() => setEditForm(null)}>
          <Field label="Nom">
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setEditForm(null)}
              disabled={busyId === editForm.id}
            >
              Annuler
            </Button>
            <Button onClick={submitEdit} disabled={busyId === editForm.id}>
              {busyId === editForm.id && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border rounded-xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
