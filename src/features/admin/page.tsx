import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Users,
  ShieldCheck,
  Server,
  ChevronDown,
  UserCheck,
  UserX,
  Save,
  AlertCircle,
  Database,
  Play,
  RotateCcw,
  Cloud,
  HardDrive,
  Sliders,
  Search,
} from 'lucide-react';
import { Role, Permission } from '@/lib/auth-rbac/roles';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/providers/auth-provider';
import { toast } from 'sonner';
import { MetadataFieldsTab } from './MetadataFieldsTab';

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminTab = 'users' | 'roles' | 'auth' | 'storage' | 'metadata';

interface MockUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
  lastLogin: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_USERS: MockUser[] = [
  { id: '1', fullName: 'Admin System',  email: 'admin@entreprise.fr',   role: Role.ADMIN,   active: true,  lastLogin: '2025-04-30' },
  { id: '2', fullName: 'Jean Dupont',   email: 'manager@entreprise.fr', role: Role.MANAGER, active: true,  lastLogin: '2025-04-30' },
  { id: '3', fullName: 'Marie Martin',  email: 'user@entreprise.fr',    role: Role.USER,    active: true,  lastLogin: '2025-04-29' },
  { id: '4', fullName: 'Sophie Leclerc', email: 'sophie.leclerc@entreprise.fr', role: Role.USER, active: true, lastLogin: '2025-04-28' },
  { id: '5', fullName: 'Julien Bernard', email: 'julien.bernard@entreprise.fr', role: Role.USER, active: false, lastLogin: '2025-04-15' },
  { id: '6', fullName: 'Emma Leroy',    email: 'emma.leroy@entreprise.fr', role: Role.MANAGER, active: true, lastLogin: '2025-04-27' },
];

const ROLES_INFO = [
  {
    role: Role.ADMIN,
    color: 'border-red-500/30 bg-red-500/5',
    badge: 'bg-red-500/10 text-red-500',
    desc: 'Accès complet au système. Hérite des permissions du Manager.',
    permissions: [
      Permission.CONSULTE_AUDIT_LOGS
    ],
  },
  {
    role: Role.MANAGER,
    color: 'border-indigo-500/30 bg-indigo-500/5',
    badge: 'bg-indigo-500/10 text-indigo-500',
    desc: 'Gère les utilisateurs, bibliothèques et valide les documents.',
    permissions: [
      Permission.REVIEW_DOCUMENT, Permission.MANAGE_USERS, 
      Permission.MANAGE_PERMISSIONS, Permission.MANAGE_LIBRARIES,
      Permission.APPROVE_DOCUMENT, Permission.APPROVE_SHARING_REQUEST
    ],
  },
  {
    role: Role.USER,
    color: 'border-blue-500/30 bg-blue-500/5',
    badge: 'bg-blue-500/10 text-blue-500',
    desc: 'Droits de base pour consulter, importer, et gérer ses documents.',
    permissions: [
      Permission.LOGIN, Permission.LOGOUT, Permission.CREATE_FOLDER,
      Permission.MANAGE_PROFILE, Permission.RESET_PASSWORD,
      Permission.UPLOAD_DOCUMENT, Permission.ADD_DESCRIPTION,
      Permission.PERFORM_OCR, Permission.MANAGE_DOCUMENTS,
      Permission.SHARE_DOCUMENT, Permission.REQUEST_SHARING_DOCUMENT,
      Permission.SEARCH_DOCUMENT, Permission.FULL_TEXT_SEARCH,
      Permission.META_DATA_SEARCH, Permission.RETRIEVE_DOCUMENT
    ],
  },
];

const PERM_LABELS: Record<Permission, string> = {
  [Permission.LOGIN]: 'Se connecter',
  [Permission.LOGOUT]: 'Se déconnecter',
  [Permission.CREATE_FOLDER]: 'Créer un dossier',
  [Permission.MANAGE_PROFILE]: 'Gérer son profil',
  [Permission.RESET_PASSWORD]: 'Réinitialiser le mot de passe',
  [Permission.UPLOAD_DOCUMENT]: 'Importer des documents',
  [Permission.ADD_DESCRIPTION]: 'Ajouter une description',
  [Permission.PERFORM_OCR]: 'Effectuer OCR',
  [Permission.MANAGE_DOCUMENTS]: 'Gérer des documents',
  [Permission.SHARE_DOCUMENT]: 'Partager un document',
  [Permission.REQUEST_SHARING_DOCUMENT]: 'Demander un partage',
  [Permission.SEARCH_DOCUMENT]: 'Rechercher des documents',
  [Permission.FULL_TEXT_SEARCH]: 'Recherche plein texte',
  [Permission.META_DATA_SEARCH]: 'Recherche par métadonnées',
  [Permission.RETRIEVE_DOCUMENT]: 'Récupérer des documents',
  [Permission.REVIEW_DOCUMENT]: 'Revoir des documents',
  [Permission.MANAGE_USERS]: 'Gérer les utilisateurs',
  [Permission.MANAGE_PERMISSIONS]: 'Gérer les permissions',
  [Permission.MANAGE_LIBRARIES]: 'Gérer les bibliothèques',
  [Permission.APPROVE_DOCUMENT]: 'Approuver des documents',
  [Permission.APPROVE_SHARING_REQUEST]: 'Approuver demande partage',
  [Permission.CONSULTE_AUDIT_LOGS]: 'Consulter les logs d\'audit',
};

const ROLE_BADGE_COLOR: Record<Role, string> = {
  [Role.ADMIN]:   'bg-red-500/10 text-red-500',
  [Role.MANAGER]: 'bg-indigo-500/10 text-indigo-500',
  [Role.USER]:    'bg-blue-500/10 text-blue-500',
};

// ─── Tab: Users ───────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [searchQuery, setSearchQuery] = useState('');

  const handleRoleChange = (id: string, newRole: Role) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: newRole } : u));
    toast.success('Rôle mis à jour avec succès');
  };

  const toggleActive = (id: string) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, active: !u.active } : u));
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/20">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un utilisateur (nom ou email)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Utilisateur</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Rôle</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Dernière connexion</th>
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
            ) : filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-accent/30 transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary border border-primary/20">
                      {u.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{u.fullName}</p>
                      <p className="text-[11px] text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="relative inline-flex items-center">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                      className={`appearance-none rounded-full pl-2.5 pr-6 py-1 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/50 ${ROLE_BADGE_COLOR[u.role]}`}
                      id={`user-role-${u.id}`}
                    >
                      {Object.values(Role).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3" />
                  </div>
                </td>

                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${u.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-500/10 text-zinc-500'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${u.active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                    {u.active ? 'Actif' : 'Inactif'}
                  </span>
                </td>

                <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                  {new Date(u.lastLogin).toLocaleDateString('fr-FR')}
                </td>

                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleActive(u.id)}
                    title={u.active ? 'Désactiver' : 'Activer'}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      u.active
                        ? 'text-red-500 hover:bg-red-500/10'
                        : 'text-emerald-500 hover:bg-emerald-500/10'
                    }`}
                    id={`user-toggle-${u.id}`}
                  >
                    {u.active ? <><UserX className="h-3.5 w-3.5" />Désactiver</> : <><UserCheck className="h-3.5 w-3.5" />Activer</>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Roles ───────────────────────────────────────────────────────────────

function RolesTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {ROLES_INFO.map((ri) => (
        <div key={ri.role} className={`rounded-xl border p-5 ${ri.color}`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ri.badge}`}>
                {ri.role}
              </span>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{ri.desc}</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 ml-2" />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {ri.permissions.map((p) => (
              <span key={p} className="rounded-md bg-background/60 border border-border px-2 py-0.5 text-[10px] font-medium text-foreground/70">
                {PERM_LABELS[p]}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Provider ────────────────────────────────────────────────────────────

type ProviderType = 'local' | 'ldap' | 'saml' | 'oidc';

function AuthTab() {
  const [providerType, setProviderType] = useState<ProviderType>('local');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 900));
    setSaving(false);
    toast.success('Configuration du provider sauvegardée');
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 max-w-2xl space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-1">Type de fournisseur d'identité</h2>
        <p className="text-xs text-muted-foreground">Sélectionnez le mécanisme d'authentification pour votre organisation.</p>
      </div>

      {/* Provider selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(['local', 'ldap', 'saml', 'oidc'] as ProviderType[]).map((p) => (
          <button
            key={p}
            onClick={() => setProviderType(p)}
            id={`provider-${p}`}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all ${
              providerType === p
                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Server className="h-5 w-5" />
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Dynamic fields */}
      <div className="space-y-4">
        {providerType === 'local' && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">Authentification locale active</p>
              <p className="text-xs text-muted-foreground mt-0.5">Les utilisateurs s'authentifient avec leur email/mot de passe stocké en base de données.</p>
            </div>
          </div>
        )}

        {providerType === 'ldap' && (
          <div className="space-y-3">
            {[
              { id: 'ldap-url', label: 'URL du serveur LDAP', placeholder: 'ldap://ldap.entreprise.fr:389' },
              { id: 'ldap-base', label: 'Base DN', placeholder: 'dc=entreprise,dc=fr' },
              { id: 'ldap-bind', label: 'Bind DN (compte de service)', placeholder: 'cn=admin,dc=entreprise,dc=fr' },
              { id: 'ldap-pass', label: 'Mot de passe du compte de service', placeholder: '••••••••', type: 'password' },
            ].map((f) => (
              <div key={f.id} className="space-y-1.5">
                <label htmlFor={f.id} className="text-xs font-medium text-foreground">{f.label}</label>
                <input
                  id={f.id}
                  type={f.type ?? 'text'}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>
            ))}
          </div>
        )}

        {providerType === 'saml' && (
          <div className="space-y-3">
            {[
              { id: 'saml-entityid', label: 'Entity ID (IdP)', placeholder: 'https://idp.entreprise.fr/saml2' },
              { id: 'saml-sso', label: 'SSO URL', placeholder: 'https://idp.entreprise.fr/saml2/sso' },
              { id: 'saml-cert', label: 'Certificat X.509 (IdP)', placeholder: '-----BEGIN CERTIFICATE-----\n...', textarea: true },
            ].map((f) => (
              <div key={f.id} className="space-y-1.5">
                <label htmlFor={f.id} className="text-xs font-medium text-foreground">{f.label}</label>
                {f.textarea ? (
                  <textarea
                    id={f.id}
                    placeholder={f.placeholder}
                    rows={4}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
                  />
                ) : (
                  <input
                    id={f.id}
                    type="text"
                    placeholder={f.placeholder}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {providerType === 'oidc' && (
          <div className="space-y-3">
            {[
              { id: 'oidc-authority', label: 'Authority URL', placeholder: 'https://login.microsoftonline.com/tenant-id' },
              { id: 'oidc-clientid', label: 'Client ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
              { id: 'oidc-secret', label: 'Client Secret', placeholder: '••••••••••••••••••••••••', type: 'password' },
              { id: 'oidc-scope', label: 'Scopes', placeholder: 'openid profile email' },
            ].map((f) => (
              <div key={f.id} className="space-y-1.5">
                <label htmlFor={f.id} className="text-xs font-medium text-foreground">{f.label}</label>
                <input
                  id={f.id}
                  type={f.type ?? 'text'}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        id="save-provider-btn"
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all shadow-sm"
      >
        <Save className="h-4 w-4" />
        {saving ? 'Sauvegarde…' : 'Sauvegarder la configuration'}
      </button>
    </div>
  );
}

// ─── Tab: Storage ────────────────────────────────────────────────────────────

type StorageProviderType = 'local' | 's3' | 'azure';

function StorageTab() {
  const [activeProvider, setActiveProvider] = useState<StorageProviderType>('local');
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [migrationLogs, setMigrationLogs] = useState<string[]>([]);
  const [migrationProgress, setMigrationProgress] = useState(0);

  const handleSaveConfig = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast.success('Configuration de stockage mise à jour et active');
  };

  const handleStartMigration = async () => {
    setMigrating(true);
    setMigrationStatus('running');
    setMigrationProgress(0);
    setMigrationLogs(['Démarrage de la migration...']);

    // Simulation de migration
    for (let i = 1; i <= 5; i++) {
      await new Promise(r => setTimeout(r, 800));
      setMigrationProgress(i * 20);
      setMigrationLogs(prev => [...prev, `Migration du lot ${i}/5 terminée...`]);
    }
    
    await new Promise(r => setTimeout(r, 500));
    setMigrationLogs(prev => [...prev, 'Vérification de l\'intégrité des fichiers...']);
    
    await new Promise(r => setTimeout(r, 800));
    setMigrationStatus('success');
    setMigrationLogs(prev => [...prev, 'Migration terminée avec succès ! 0 perte détectée.']);
    setMigrating(false);
    toast.success('Migration terminée');
  };

  const handleRollback = async () => {
    toast.info('Rollback en cours...');
    setMigrationStatus('idle');
    setMigrationProgress(0);
    setMigrationLogs([]);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      {/* Colonne Config Active */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">Configuration du Stockage</h2>
          <p className="text-xs text-muted-foreground">Sélectionnez le Storage Provider actif. Le changement s'applique sans redémarrage.</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['local', 's3', 'azure'] as StorageProviderType[]).map((p) => (
            <button
              key={p}
              onClick={() => setActiveProvider(p)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all ${
                activeProvider === p
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {p === 'local' && <HardDrive className="h-5 w-5" />}
              {p === 's3' && <Cloud className="h-5 w-5" />}
              {p === 'azure' && <Database className="h-5 w-5" />}
              {p.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {activeProvider === 'local' && (
             <div className="space-y-1.5">
               <label className="text-xs font-medium text-foreground">Chemin du répertoire racine</label>
               <input type="text" defaultValue="/var/edms/storage" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50" />
             </div>
          )}
          {activeProvider === 's3' && (
             <div className="space-y-3">
               <div className="space-y-1.5">
                 <label className="text-xs font-medium text-foreground">Nom du Bucket AWS</label>
                 <input type="text" placeholder="edms-production-docs" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50" />
               </div>
               <div className="space-y-1.5">
                 <label className="text-xs font-medium text-foreground">Région</label>
                 <input type="text" placeholder="eu-west-3" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50" />
               </div>
             </div>
          )}
          {activeProvider === 'azure' && (
             <div className="space-y-1.5">
               <label className="text-xs font-medium text-foreground">Nom du conteneur Blob</label>
               <input type="text" placeholder="edms-blobs" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50" />
             </div>
          )}
        </div>

        <button
          onClick={handleSaveConfig}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all shadow-sm"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Sauvegarde…' : 'Appliquer sans redémarrer'}
        </button>
      </div>

      {/* Colonne Migration */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">Migration des documents</h2>
          <p className="text-xs text-muted-foreground">Transférez l'intégralité des fichiers d'un provider à un autre sans perte de données.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 space-y-1.5 w-full">
            <label className="text-xs font-medium text-foreground">Source</label>
            <select disabled={migrating} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50">
              <option value="local">LOCAL (/var/edms/storage)</option>
            </select>
          </div>
          <div className="hidden sm:block text-muted-foreground mt-6">→</div>
          <div className="flex-1 space-y-1.5 w-full">
            <label className="text-xs font-medium text-foreground">Destination</label>
            <select disabled={migrating} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50">
              <option value="s3">AWS S3 (edms-production-docs)</option>
              <option value="azure">Azure Blob</option>
            </select>
          </div>
        </div>

        {migrationStatus === 'idle' && (
          <button
            onClick={handleStartMigration}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-all shadow-sm"
          >
            <Play className="h-4 w-4" />
            Lancer la migration complète
          </button>
        )}

        {(migrationStatus === 'running' || migrationStatus === 'success') && (
          <div className="space-y-4 border border-border rounded-lg p-4 bg-muted/20">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className={migrationStatus === 'success' ? 'text-emerald-500' : 'text-indigo-500'}>
                {migrationStatus === 'success' ? 'Terminé' : 'En cours...'}
              </span>
              <span>{migrationProgress}%</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${migrationStatus === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${migrationProgress}%` }}
              />
            </div>
            
            <div className="bg-zinc-950 rounded border border-zinc-800 p-3 h-32 overflow-y-auto font-mono text-[10px] text-zinc-300 space-y-1">
              {migrationLogs.map((log, i) => (
                <div key={i}>{'>'} {log}</div>
              ))}
            </div>

            {migrationStatus === 'success' && (
              <button
                onClick={handleRollback}
                className="flex items-center justify-center gap-2 w-full rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-accent transition-all shadow-sm mt-4"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Rollback (Annuler la migration)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { hasPermission } = useAuth();
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

  const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'roles', label: 'Rôles & Permissions', icon: ShieldCheck },
    { id: 'auth', label: 'Authentification', icon: Server },
    { id: 'storage', label: 'Stockage', icon: Database },
    { id: 'metadata', label: 'Métadonnées', icon: Sliders },
  ];

  return (
    <>
      <Helmet>
        <title>Administration — EDMS Enterprise</title>
        <meta name="description" content="Administration du système EDMS : utilisateurs, rôles et fournisseur d'identité." />
      </Helmet>

      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Administration</h1>
          <p className="text-sm text-muted-foreground mt-1">Configuration du système et gestion des accès.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`admin-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all',
                activeTab === tab.id
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
        {activeTab === 'users'    && <UsersTab />}
        {activeTab === 'roles'    && <RolesTab />}
        {activeTab === 'auth'     && <AuthTab />}
        {activeTab === 'storage'  && <StorageTab />}
        {activeTab === 'metadata' && <MetadataFieldsTab />}
      </div>
    </>
  );
}
