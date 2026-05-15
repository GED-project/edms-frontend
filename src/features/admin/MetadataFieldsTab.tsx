import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  Text,
  Calendar,
  Hash,
  List,
  Save,
  AlertCircle,
  ToggleLeft,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  MetadataFieldType,
  MetadataDefinitionDto,
  CreateUpdateMetadataDefinitionInput,
  getMetadataDefinitions,
  createMetadataDefinition,
  updateMetadataDefinition,
  deleteMetadataDefinition,
} from './metadata.service';

// ─── Local UI model ───────────────────────────────────────────────────────────

type UiFieldType = 'text' | 'date' | 'number' | 'list' | 'boolean';

interface UiField {
  /** undefined = new (not yet saved), string = existing backend id */
  backendId?: string;
  tempId: string;
  label: string;
  name: string;
  type: UiFieldType;
  required: boolean;
  options: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function apiTypeToUi(t: MetadataFieldType): UiFieldType {
  switch (t) {
    case MetadataFieldType.Text:         return 'text';
    case MetadataFieldType.Number:       return 'number';
    case MetadataFieldType.Date:         return 'date';
    case MetadataFieldType.Boolean:      return 'boolean';
    case MetadataFieldType.DropdownList: return 'list';
    default:                             return 'text';
  }
}

function uiTypeToApi(t: UiFieldType): MetadataFieldType {
  switch (t) {
    case 'text':    return MetadataFieldType.Text;
    case 'number':  return MetadataFieldType.Number;
    case 'date':    return MetadataFieldType.Date;
    case 'boolean': return MetadataFieldType.Boolean;
    case 'list':    return MetadataFieldType.DropdownList;
  }
}

function dtoToUi(dto: MetadataDefinitionDto): UiField {
  return {
    backendId: dto.id,
    tempId: dto.id,
    label: dto.displayName,
    name: dto.name,
    type: apiTypeToUi(dto.fieldType),
    required: dto.isRequired,
    options: dto.dropdownOptions
      ? dto.dropdownOptions.split(',').map((o) => o.trim()).filter(Boolean)
      : [],
  };
}

function generateInternalName(label: string, tempId: string): string {
  const normalized = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const slug = normalized
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (slug) return slug;

  const fallback = tempId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  return fallback ? `field_${fallback}` : `field_${Date.now()}`;
}

function uiToInput(f: UiField): CreateUpdateMetadataDefinitionInput {
  return {
    name: f.name || generateInternalName(f.label, f.tempId),
    displayName: f.label,
    fieldType: uiTypeToApi(f.type),
    isRequired: f.required,
    dropdownOptions: f.type === 'list' && f.options.length > 0
      ? f.options.join(',')
      : undefined,
  };
}

function newField(): UiField {
  return {
    tempId: 'new_' + Math.random().toString(36).substring(2, 9),
    label: '',
    name: '',
    type: 'text',
    required: false,
    options: [],
  };
}

// ─── TYPE_CONFIG ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<UiFieldType, { label: string; icon: React.ElementType; color: string }> = {
  text:    { label: 'Texte',    icon: Text,        color: 'text-blue-500 bg-blue-500/10' },
  date:    { label: 'Date',     icon: Calendar,    color: 'text-purple-500 bg-purple-500/10' },
  number:  { label: 'Nombre',   icon: Hash,        color: 'text-amber-500 bg-amber-500/10' },
  list:    { label: 'Liste',    icon: List,        color: 'text-emerald-500 bg-emerald-500/10' },
  boolean: { label: 'Oui/Non',  icon: ToggleLeft,  color: 'text-pink-500 bg-pink-500/10' },
};

const METADATA_DRAFT_KEY = 'edms_metadata_fields_draft_v1';

// ─── Component ────────────────────────────────────────────────────────────────

export function MetadataFieldsTab() {
  const [fields, setFields] = useState<UiField[]>([]);
  const [originalIds, setOriginalIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const getApiErrorMessage = (err: unknown, fallback: string) => {
    const e = err as any;
    return e?.response?.data?.error?.message
      || e?.response?.data?.error?.details
      || e?.message
      || fallback;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMetadataDefinitions(0, 200);
      const serverFields = result.items.map(dtoToUi);
      setOriginalIds(new Set(serverFields.map((f) => f.backendId!)));

      const rawDraft = localStorage.getItem(METADATA_DRAFT_KEY);
      if (rawDraft) {
        try {
          const parsed = JSON.parse(rawDraft) as { fields?: UiField[]; deletedIds?: string[] };
          if (Array.isArray(parsed.fields)) {
            setFields(parsed.fields);
            setDeletedIds(Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []);
            setDirty(true);
            toast.info('Brouillon restaure. Pensez a sauvegarder vos changements.');
          } else {
            setFields(serverFields);
            setDeletedIds([]);
            setDirty(false);
          }
        } catch {
          setFields(serverFields);
          setDeletedIds([]);
          setDirty(false);
        }
      } else {
        setFields(serverFields);
        setDeletedIds([]);
        setDirty(false);
      }
    } catch {
      toast.error('Impossible de charger les champs de métadonnées.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!dirty) return;
    localStorage.setItem(
      METADATA_DRAFT_KEY,
      JSON.stringify({ fields, deletedIds }),
    );
  }, [fields, deletedIds, dirty]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const update = (updated: UiField[]) => {
    setFields(updated);
    setDirty(true);
  };

  const addField = () => update([...fields, newField()]);

  const removeField = (tempId: string) => {
    const f = fields.find((x) => x.tempId === tempId);
    if (f?.backendId) setDeletedIds((prev) => [...prev, f.backendId!]);
    update(fields.filter((x) => x.tempId !== tempId));
  };

  const updateField = (tempId: string, patch: Partial<UiField>) => {
    update(fields.map((f) => (f.tempId === tempId ? { ...f, ...patch } : f)));
  };

  const handleSave = async () => {
    const invalid = fields.find((f) => !f.label.trim());
    if (invalid) {
      toast.error('Chaque champ doit avoir un libellé.');
      return;
    }

    const generatedNames = fields.map((f) => (f.name || generateInternalName(f.label, f.tempId)).trim());
    const duplicateName = generatedNames.find((name, index) =>
      generatedNames.findIndex((n) => n.toLowerCase() === name.toLowerCase()) !== index,
    );
    if (duplicateName) {
      toast.error(`Nom interne duplique detecte: ${duplicateName}. Utilisez des libelles differents.`);
      return;
    }

    setSaving(true);
    try {
      // Delete removed fields
      for (const id of deletedIds) {
        await deleteMetadataDefinition(id);
      }

      // Create or update remaining fields
      for (const f of fields) {
        const input = uiToInput(f);
        if (f.backendId && originalIds.has(f.backendId)) {
          await updateMetadataDefinition(f.backendId, input);
        } else {
          await createMetadataDefinition(input);
        }
      }

      await load(); // reload to get server-assigned IDs

      // Verify that all expected internal names now exist on backend.
      const expected = new Set(
        fields.map((f) => (f.name || generateInternalName(f.label, f.tempId)).toLowerCase()),
      );
      const verify = await getMetadataDefinitions(0, 500);
      const actual = new Set(verify.items.map((x) => x.name.toLowerCase()));
      const missing = Array.from(expected).filter((n) => !actual.has(n));

      if (missing.length > 0) {
        toast.error(`Sauvegarde incomplete. Champs manquants: ${missing.join(', ')}`);
        return;
      }

      localStorage.removeItem(METADATA_DRAFT_KEY);
      toast.success('Champs de metadonnees sauvegardes');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erreur lors de la sauvegarde des champs.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des champs…
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Définissez les champs personnalisés qui apparaîtront dans le formulaire d'import des documents.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
          id="save-meta-fields-btn"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Sauvegarder
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Les champs définis ici apparaîtront dans le formulaire d'import de tous les utilisateurs.
          Les champs <strong>obligatoires</strong> doivent être renseignés avant l'envoi.
        </p>
      </div>

      {/* Fields list */}
      <div className="space-y-3">
        {fields.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">Aucun champ défini. Cliquez sur « Ajouter un champ ».</p>
          </div>
        )}

        {fields.map((field, idx) => (
          <FieldRow
            key={field.tempId}
            field={field}
            index={idx}
            onUpdate={(patch) => updateField(field.tempId, patch)}
            onRemove={() => removeField(field.tempId)}
          />
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={addField}
        id="add-meta-field-btn"
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-accent/30 transition-all"
      >
        <Plus className="h-4 w-4" />
        Ajouter un champ
      </button>
    </div>
  );
}

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  index,
  onUpdate,
  onRemove,
}: {
  field: UiField;
  index: number;
  onUpdate: (patch: Partial<UiField>) => void;
  onRemove: () => void;
}) {
  const [optionInput, setOptionInput] = useState('');
  const TypeIcon = TYPE_CONFIG[field.type].icon;

  const addOption = () => {
    const trimmed = optionInput.trim();
    if (!trimmed || field.options.includes(trimmed)) return;
    onUpdate({ options: [...field.options, trimmed] });
    setOptionInput('');
  };

  const removeOption = (opt: string) => {
    onUpdate({ options: field.options.filter((o) => o !== opt) });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Row header */}
      <div className="flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />

        {/* Type badge */}
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TYPE_CONFIG[field.type].color}`}>
          <TypeIcon className="h-4 w-4" />
        </div>

        {/* Label input */}
        <input
          type="text"
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder={`Libellé du champ ${index + 1}…`}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
          id={`meta-field-label-${field.tempId}`}
        />

        {/* Type selector */}
        <select
          value={field.type}
          onChange={(e) => onUpdate({ type: e.target.value as UiFieldType, options: e.target.value === 'list' ? [] : field.options })}
          className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
          id={`meta-field-type-${field.tempId}`}
        >
          {(Object.entries(TYPE_CONFIG) as [UiFieldType, (typeof TYPE_CONFIG)[UiFieldType]][]).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>

        {/* Required toggle */}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onUpdate({ required: e.target.checked })}
            className="rounded border-input text-primary focus:ring-primary/50 cursor-pointer"
            id={`meta-field-required-${field.tempId}`}
          />
          Obligatoire
        </label>

        {/* Delete */}
        <button
          onClick={onRemove}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
          title="Supprimer ce champ"
          id={`meta-field-delete-${field.tempId}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Extra config per type */}
      <div className="pl-11 space-y-3">
        {/* List options */}
        {field.type === 'list' && (
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Options de la liste
            </label>
            <div className="flex flex-wrap gap-1.5">
              {field.options.map((opt) => (
                <span
                  key={opt}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                >
                  {opt}
                  <button
                    type="button"
                    onClick={() => removeOption(opt)}
                    className="rounded-full hover:bg-emerald-500/20 p-0.5"
                  >
                    <span className="sr-only">Supprimer</span>×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={optionInput}
                onChange={(e) => setOptionInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                placeholder="Nouvelle option…"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
              <button
                type="button"
                onClick={addOption}
                className="flex items-center gap-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </button>
            </div>
          </div>
        )}

        {/* Boolean hint */}
        {field.type === 'boolean' && (
          <p className="text-xs text-muted-foreground italic">
            Ce champ s'affichera comme une case à cocher.
          </p>
        )}
      </div>
    </div>
  );
}

