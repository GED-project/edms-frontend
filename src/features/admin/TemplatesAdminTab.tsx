import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, FileText, FolderOpen,
  ChevronRight, ChevronDown, X, Save, RefreshCw,
} from 'lucide-react';
import {
  getAllDocumentTemplatesDetailed,
  createDocumentTemplate,
  updateDocumentTemplate,
  deleteDocumentTemplate,
  type DocumentTemplateDetailDto,
  type CreateUpdateDocumentTemplateDto,
} from '../documents/document-template.service';
import {
  getAllLibraryTemplatesDetailed,
  createLibraryTemplate,
  updateLibraryTemplate,
  deleteLibraryTemplate,
  parseFolderStructure,
  type LibraryTemplateDetailDto,
  type CreateUpdateLibraryTemplateDto,
  type FolderNode,
} from '../../features/libraries/library-template.service';

// ── Folder tree preview component ─────────────────────────────────────────────

function FolderTree({ nodes, depth = 0 }: { nodes: FolderNode[]; depth?: number }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  return (
    <ul className={depth === 0 ? 'space-y-0.5' : 'ml-4 mt-0.5 space-y-0.5'}>
      {nodes.map((node, i) => {
        const key = `${depth}-${i}-${node.name}`;
        const isOpen = expanded.has(key);
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => setExpanded(prev => {
                const next = new Set(prev);
                isOpen ? next.delete(key) : next.add(key);
                return next;
              })}
              className="flex items-center gap-1.5 text-xs text-foreground hover:text-primary transition-colors w-full text-left py-0.5"
            >
              {node.children?.length > 0
                ? (isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />)
                : <span className="w-3" />}
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="truncate">{node.name}</span>
              {node.roles?.length > 0 && (
                <span className="ml-auto text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded shrink-0">
                  {node.roles.join(', ')}
                </span>
              )}
            </button>
            {isOpen && node.children?.length > 0 && (
              <FolderTree nodes={node.children} depth={depth + 1} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Document Template form modal ──────────────────────────────────────────────

function DocTemplateModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: DocumentTemplateDetailDto;
  onSave: (dto: CreateUpdateDocumentTemplateDto) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [metaJson, setMetaJson] = useState(
    initial?.defaultMetadataJson
      ? JSON.stringify(JSON.parse(initial.defaultMetadataJson || '{}'), null, 2)
      : '{\n  "Field1": "",\n  "Field2": false,\n  "Amount": 0\n}',
  );
  const [jsonError, setJsonError] = useState('');
  const [saving, setSaving] = useState(false);

  function validateJson(v: string) {
    try { JSON.parse(v); setJsonError(''); return true; }
    catch (e: any) { setJsonError(e.message); return false; }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateJson(metaJson)) return;
    try {
      setSaving(true);
      await onSave({ name: name.trim(), description: desc.trim() || undefined, defaultMetadataJson: metaJson });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Erreur lors de la sauvegarde');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              {initial ? 'Modifier le modèle de document' : 'Nouveau modèle de document'}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nom *</label>
              <input
                required value={name} onChange={e => setName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="IT Incident Report"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
              <textarea
                value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                placeholder="Description optionnelle du modèle..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Champs du formulaire (JSON)
              </label>
              <span className="text-[10px] text-muted-foreground">
                Valeur booléenne → case à cocher · numérique → champ numérique · clé contenant "date" → sélecteur de date
              </span>
            </div>
            <textarea
              value={metaJson}
              onChange={e => { setMetaJson(e.target.value); validateJson(e.target.value); }}
              rows={10}
              spellCheck={false}
              className={`w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 resize-y transition-colors ${
                jsonError ? 'border-red-400 focus:ring-red-400/30 bg-red-50 dark:bg-red-950/20' : 'border-input bg-background focus:ring-primary/50'
              }`}
            />
            {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
            <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold">Exemple de schéma :</p>
              <pre className="whitespace-pre-wrap font-mono">{`{
  "Reporter": "",
  "Severity": "Medium",
  "TotalAmount": 0,
  "IncidentDate": "",
  "IsDataBreach": false
}`}</pre>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving || !!jsonError || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Library Template form modal ───────────────────────────────────────────────

const FOLDER_JSON_EXAMPLE = `[
  {
    "name": "01_Documents",
    "roles": ["manager", "user"],
    "children": [
      {
        "name": "Drafts",
        "roles": ["user"],
        "children": []
      }
    ]
  },
  {
    "name": "02_Archives",
    "roles": ["manager"],
    "children": []
  }
]`;

function LibraryTemplateModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: LibraryTemplateDetailDto;
  onSave: (dto: CreateUpdateLibraryTemplateDto) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [folderJson, setFolderJson] = useState(
    initial?.folderStructureJson
      ? JSON.stringify(JSON.parse(initial.folderStructureJson || '[]'), null, 2)
      : FOLDER_JSON_EXAMPLE,
  );
  const [jsonError, setJsonError] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedFolders = (() => {
    try { return parseFolderStructure(folderJson); } catch { return []; }
  })();

  function validateJson(v: string) {
    try {
      const p = JSON.parse(v);
      if (!Array.isArray(p)) throw new Error('Doit être un tableau JSON');
      setJsonError(''); return true;
    } catch (e: any) { setJsonError(e.message); return false; }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateJson(folderJson)) return;
    try {
      setSaving(true);
      await onSave({ name: name.trim(), description: desc.trim() || undefined, folderStructureJson: folderJson });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Erreur lors de la sauvegarde');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">
              {initial ? 'Modifier le modèle de bibliothèque' : 'Nouveau modèle de bibliothèque'}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 max-h-[85vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nom *</label>
              <input
                required value={name} onChange={e => setName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Agile Software Project"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
              <textarea
                value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* JSON editor */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Structure des dossiers (JSON)
              </label>
              <textarea
                value={folderJson}
                onChange={e => { setFolderJson(e.target.value); validateJson(e.target.value); }}
                rows={16}
                spellCheck={false}
                className={`w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 resize-y transition-colors ${
                  jsonError ? 'border-red-400 focus:ring-red-400/30 bg-red-50 dark:bg-red-950/20' : 'border-input bg-background focus:ring-primary/50'
                }`}
              />
              {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
            </div>

            {/* Live tree preview */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Aperçu en temps réel
              </label>
              <div className="rounded-lg border border-border bg-muted/20 p-3 min-h-[200px] max-h-[350px] overflow-y-auto">
                {parsedFolders.length === 0
                  ? <p className="text-xs text-muted-foreground italic">Arborescence vide ou JSON invalide</p>
                  : <FolderTree nodes={parsedFolders} />
                }
              </div>
              <p className="text-[10px] text-muted-foreground">
                Chaque dossier peut avoir des rôles restreints. Cliquez sur une flèche pour développer.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving || !!jsonError || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main tab component ─────────────────────────────────────────────────────────

export function TemplatesAdminTab() {
  const [activeSection, setActiveSection] = useState<'document' | 'library'>('document');

  // Document templates state
  const [docTemplates, setDocTemplates] = useState<DocumentTemplateDetailDto[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentTemplateDetailDto | undefined>();
  const [showDocModal, setShowDocModal] = useState(false);

  // Library templates state
  const [libTemplates, setLibTemplates] = useState<LibraryTemplateDetailDto[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [editingLib, setEditingLib] = useState<LibraryTemplateDetailDto | undefined>();
  const [showLibModal, setShowLibModal] = useState(false);

  const loadDocTemplates = useCallback(async () => {
    setDocLoading(true);
    try { setDocTemplates(await getAllDocumentTemplatesDetailed()); }
    catch { toast.error('Impossible de charger les modèles de document'); }
    finally { setDocLoading(false); }
  }, []);

  const loadLibTemplates = useCallback(async () => {
    setLibLoading(true);
    try { setLibTemplates(await getAllLibraryTemplatesDetailed()); }
    catch { toast.error('Impossible de charger les modèles de bibliothèque'); }
    finally { setLibLoading(false); }
  }, []);

  useEffect(() => { loadDocTemplates(); loadLibTemplates(); }, [loadDocTemplates, loadLibTemplates]);

  // Document template handlers
  async function handleSaveDoc(dto: CreateUpdateDocumentTemplateDto) {
    if (editingDoc) {
      await updateDocumentTemplate(editingDoc.id, dto);
      toast.success('Modèle de document mis à jour');
    } else {
      await createDocumentTemplate(dto);
      toast.success('Modèle de document créé');
    }
    await loadDocTemplates();
  }

  async function handleDeleteDoc(tpl: DocumentTemplateDetailDto) {
    if (!confirm(`Supprimer le modèle "${tpl.name}" ?`)) return;
    try {
      await deleteDocumentTemplate(tpl.id);
      toast.success('Modèle supprimé');
      await loadDocTemplates();
    } catch { toast.error('Erreur lors de la suppression'); }
  }

  // Library template handlers
  async function handleSaveLib(dto: CreateUpdateLibraryTemplateDto) {
    if (editingLib) {
      await updateLibraryTemplate(editingLib.id, dto);
      toast.success('Modèle de bibliothèque mis à jour');
    } else {
      await createLibraryTemplate(dto);
      toast.success('Modèle de bibliothèque créé');
    }
    await loadLibTemplates();
  }

  async function handleDeleteLib(tpl: LibraryTemplateDetailDto) {
    if (!confirm(`Supprimer le modèle "${tpl.name}" ?`)) return;
    try {
      await deleteLibraryTemplate(tpl.id);
      toast.success('Modèle supprimé');
      await loadLibTemplates();
    } catch { toast.error('Erreur lors de la suppression'); }
  }

  return (
    <div className="space-y-6">
      {/* Section switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-4">
        <button
          onClick={() => setActiveSection('document')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSection === 'document'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          <FileText className="h-4 w-4" />
          Modèles de document
          <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/10">
            {docTemplates.length}
          </span>
        </button>
        <button
          onClick={() => setActiveSection('library')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSection === 'library'
              ? 'bg-amber-500 text-white'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          <FolderOpen className="h-4 w-4" />
          Modèles de bibliothèque
          <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/10">
            {libTemplates.length}
          </span>
        </button>
      </div>

      {/* ── Document templates section ── */}
      {activeSection === 'document' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Modèles de document</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Les modèles pré-remplissent un nouveau document avec des champs métadonnées définis.
              </p>
            </div>
            <button
              onClick={() => { setEditingDoc(undefined); setShowDocModal(true); }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Nouveau modèle
            </button>
          </div>

          {docLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Chargement...</div>
          ) : docTemplates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucun modèle de document défini.</p>
              <button
                onClick={() => { setEditingDoc(undefined); setShowDocModal(true); }}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Créer le premier modèle
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {docTemplates.map(tpl => {
                let fields: Record<string, unknown> = {};
                try { fields = JSON.parse(tpl.defaultMetadataJson || '{}'); } catch {}
                const fieldKeys = Object.keys(fields);
                return (
                  <div key={tpl.id} className="rounded-xl border border-border bg-card p-4 flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground">{tpl.name}</h4>
                        <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                          {fieldKeys.length} champ{fieldKeys.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{tpl.description}</p>
                      )}
                      {fieldKeys.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {fieldKeys.map(k => (
                            <span key={k} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                              {k}
                              <span className="text-primary/70 ml-1">
                                {typeof fields[k] === 'boolean' ? '☑' : typeof fields[k] === 'number' ? '#' : 'A'}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingDoc(tpl); setShowDocModal(true); }}
                        className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(tpl)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Library templates section ── */}
      {activeSection === 'library' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Modèles de bibliothèque</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Les modèles créent une bibliothèque complète avec une arborescence de dossiers et des droits par rôle.
              </p>
            </div>
            <button
              onClick={() => { setEditingLib(undefined); setShowLibModal(true); }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Nouveau modèle
            </button>
          </div>

          {libLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Chargement...</div>
          ) : libTemplates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucun modèle de bibliothèque défini.</p>
              <button
                onClick={() => { setEditingLib(undefined); setShowLibModal(true); }}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Créer le premier modèle
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {libTemplates.map(tpl => {
                const folders = parseFolderStructure(tpl.folderStructureJson);
                const countFolders = (nodes: FolderNode[]): number =>
                  nodes.reduce((acc, n) => acc + 1 + countFolders(n.children ?? []), 0);
                const totalFolders = countFolders(folders);
                return (
                  <div key={tpl.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-foreground">{tpl.name}</h4>
                          <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                            {totalFolders} dossier{totalFolders !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {tpl.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                        )}
                        {folders.length > 0 && (
                          <div className="mt-3 rounded-lg bg-muted/30 p-3 max-h-40 overflow-y-auto">
                            <FolderTree nodes={folders} />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setEditingLib(tpl); setShowLibModal(true); }}
                          className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLib(tpl)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showDocModal && (
        <DocTemplateModal
          initial={editingDoc}
          onSave={handleSaveDoc}
          onClose={() => setShowDocModal(false)}
        />
      )}
      {showLibModal && (
        <LibraryTemplateModal
          initial={editingLib}
          onSave={handleSaveLib}
          onClose={() => setShowLibModal(false)}
        />
      )}
    </div>
  );
}
