import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  HardDrive, Cloud, Database, Server, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Loader2, Save, ShieldCheck,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  TenantDto, listTenants,
} from './tenant.service';
import {
  ALL_PROVIDERS, StorageProviderType, TenantStorageGrantDto,
  getTenantStorageGrants, setTenantStorageGrant, setTenantActiveProvider,
  type ProviderConfig,
} from './storage.service';

// ── helpers ────────────────────────────────────────────────────────────────

function providerIcon(p: StorageProviderType) {
  if (p === 'Local') return <HardDrive className="h-4 w-4" />;
  if (p === 'S3') return <Cloud className="h-4 w-4" />;
  if (p === 'Minio') return <Server className="h-4 w-4" />;
  return <Database className="h-4 w-4" />;
}

function parseConfig(json: string | null): ProviderConfig {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

// ── provider config form ────────────────────────────────────────────────────

function ProviderConfigForm({
  provider,
  value,
  onChange,
}: {
  provider: StorageProviderType;
  value: ProviderConfig;
  onChange: (c: ProviderConfig) => void;
}) {
  const field = (label: string, key: keyof ProviderConfig, placeholder?: string, secret?: boolean) => (
    <div key={key} className="space-y-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <Input
        type={secret ? 'password' : 'text'}
        value={(value[key] as string) ?? ''}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
    </div>
  );

  if (provider === 'Local') return (
    <div className="space-y-3 pt-2">
      {field('Chemin racine', 'rootPath', '/var/edms/storage')}
    </div>
  );

  if (provider === 'S3') return (
    <div className="grid grid-cols-2 gap-3 pt-2">
      {field('Nom du bucket', 'bucketName', 'edms-production-docs')}
      {field('Région', 'region', 'eu-west-3')}
      {field('Access Key', 'accessKey', 'AKIAIOSFODNN7EXAMPLE')}
      {field('Secret Key', 'secretKey', '••••••••••', true)}
    </div>
  );

  if (provider === 'Minio') return (
    <div className="grid grid-cols-2 gap-3 pt-2">
      {field('Endpoint', 'endpoint', 'https://minio.example.com')}
      {field('Nom du bucket', 'bucketName', 'edms')}
      {field('Access Key', 'accessKey', 'minioadmin')}
      {field('Secret Key', 'secretKey', '••••••••', true)}
    </div>
  );

  // Azure
  return (
    <div className="space-y-3 pt-2">
      {field('Nom du conteneur Blob', 'containerName', 'edms-blobs')}
      {field('Connection String', 'connectionString', 'DefaultEndpointsProtocol=https;AccountName=...', true)}
    </div>
  );
}

// ── tenant storage row ──────────────────────────────────────────────────────

function TenantStorageRow({ tenant }: { tenant: TenantDto }) {
  const [open, setOpen] = useState(false);
  const [grants, setGrants] = useState<TenantStorageGrantDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<StorageProviderType | null>(null);
  const [activating, setActivating] = useState<StorageProviderType | null>(null);
  const [configs, setConfigs] = useState<Record<StorageProviderType, ProviderConfig>>({
    Local: {}, S3: {}, Minio: {}, Azure: {},
  });

  const reload = async () => {
    setLoading(true);
    try {
      const data = await getTenantStorageGrants(tenant.id);
      setGrants(data);
      const next = { ...configs };
      for (const g of data) {
        next[g.providerType] = parseConfig(g.configJson);
      }
      setConfigs(next);
    } catch {
      // tenant might have no grants yet — ok
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) reload();
  }, [open]);

  const grantMap = Object.fromEntries(grants.map((g) => [g.providerType, g])) as
    Partial<Record<StorageProviderType, TenantStorageGrantDto>>;

  const handleSave = async (provider: StorageProviderType, isGranted: boolean) => {
    setSaving(provider);
    try {
      await setTenantStorageGrant({
        tenantId: tenant.id,
        providerType: provider,
        isGranted,
        configJson: isGranted ? JSON.stringify(configs[provider]) : null,
      });
      toast.success(`Provider ${provider} ${isGranted ? 'accordé' : 'révoqué'} pour ${tenant.name}`);
      await reload();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Erreur');
    } finally {
      setSaving(null);
    }
  };

  const handleActivate = async (provider: StorageProviderType) => {
    setActivating(provider);
    try {
      await setTenantActiveProvider(tenant.id, provider);
      toast.success(`Provider actif pour ${tenant.name} : ${provider}`);
      await reload();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Erreur');
    } finally {
      setActivating(null);
    }
  };

  const activeProvider = grants.find((g) => g.isActive)?.providerType;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {tenant.name[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold">{tenant.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{tenant.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeProvider && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {activeProvider} actif
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {grants.filter((g) => g.isGranted).length} provider(s) accordé(s)
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-border bg-muted/20 p-5 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : (
            ALL_PROVIDERS.map((provider) => {
              const grant = grantMap[provider];
              const isGranted = grant?.isGranted ?? false;
              const isActive = grant?.isActive ?? false;

              return (
                <div
                  key={provider}
                  className={`rounded-lg border p-4 space-y-3 transition-colors ${
                    isActive
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : isGranted
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      {providerIcon(provider)}
                      {provider}
                      {isActive && (
                        <span className="text-xs text-emerald-500 font-semibold ml-1">(actif)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isGranted && !isActive && (
                        <button
                          onClick={() => handleActivate(provider)}
                          disabled={activating === provider}
                          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 rounded-md px-2.5 py-1 transition-colors disabled:opacity-50"
                        >
                          {activating === provider ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          )}
                          Définir actif
                        </button>
                      )}
                      <button
                        onClick={() => handleSave(provider, !isGranted)}
                        disabled={saving === provider || (isActive && isGranted)}
                        title={isActive ? 'Désactiver avant de révoquer' : undefined}
                        className={`flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1 border transition-colors disabled:opacity-50 ${
                          isGranted
                            ? 'border-destructive/40 text-destructive hover:bg-destructive/10'
                            : 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10'
                        }`}
                      >
                        {saving === provider ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isGranted ? (
                          <XCircle className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {isGranted ? 'Révoquer' : 'Accorder'}
                      </button>
                    </div>
                  </div>

                  {/* Config form — shown only when granted */}
                  {isGranted && (
                    <>
                      <ProviderConfigForm
                        provider={provider}
                        value={configs[provider]}
                        onChange={(c) => setConfigs((prev) => ({ ...prev, [provider]: c }))}
                      />
                      <button
                        onClick={() => handleSave(provider, true)}
                        disabled={saving === provider}
                        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                      >
                        {saving === provider ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Enregistrer la configuration
                      </button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── main page ───────────────────────────────────────────────────────────────

export function HostStoragePage() {
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTenants({ maxResultCount: 200 })
      .then((res) => setTenants(res.items))
      .catch(() => toast.error('Impossible de charger les tenants'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <HardDrive className="h-6 w-6 text-primary" />
          Stockage par Tenant
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Accordez des providers de stockage à chaque tenant et configurez leurs identifiants.
          Le tenant sélectionnera ensuite son provider actif.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Chargement des tenants…
        </div>
      ) : tenants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center text-muted-foreground text-sm">
          Aucun tenant trouvé. Créez d'abord un tenant dans la page Tenants.
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => (
            <TenantStorageRow key={t.id} tenant={t} />
          ))}
        </div>
      )}
    </div>
  );
}
