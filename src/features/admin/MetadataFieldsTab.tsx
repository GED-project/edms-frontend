import React, { useState } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import {
  MetaFieldDefinition,
  MetaFieldType,
  loadMetaFields,
  saveMetaFields,
} from '@/lib/metadata-store';

const TYPE_CONFIG: Record<MetaFieldType, { label: string; icon: React.ElementType; color: string }> = {
  text:   { label: 'Texte',  icon: Text,     color: 'text-blue-500 bg-blue-500/10' },
  date:   { label: 'Date',   icon: Calendar,  color: 'text-purple-500 bg-purple-500/10' },
  number: { label: 'Nombre', icon: Hash,      color: 'text-amber-500 bg-amber-500/10' },
  list:   { label: 'Liste',  icon: List,      color: 'text-emerald-500 bg-emerald-500/10' },
};

function newField(): MetaFieldDefinition {
  return {
    id: 'meta_' + Math.random().toString(36).substring(2, 9),
    label: '',
    type: 'text',
    required: false,
    options: [],
    placeholder: '',
  };
}

export function MetadataFieldsTab() {
  const [fields, setFields] = useState<MetaFieldDefinition[]>(loadMetaFields);
  const [dirty, setDirty] = useState(false);

  const update = (updated: MetaFieldDefinition[]) => {
    setFields(updated);
    setDirty(true);
  };

  const addField = () => {
    update([...fields, newField()]);
  };

  const removeField = (id: string) => {
    update(fields.filter((f) => f.id !== id));
  };

  const updateField = (id: string, patch: Partial<MetaFieldDefinition>) => {
    update(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const handleSave = () => {
    // Validate: all fields must have a non-empty label
    const invalid = fields.find((f) => !f.label.trim());
    if (invalid) {
      toast.error('Chaque champ doit avoir un libellé.');
      return;
    }
    saveMetaFields(fields);
    setDirty(false);
    toast.success('Champs de métadonnées sauvegardés');
  };

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
          disabled={!dirty}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
          id="save-meta-fields-btn"
        >
          <Save className="h-4 w-4" />
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
            key={field.id}
            field={field}
            index={idx}
            onUpdate={(patch) => updateField(field.id, patch)}
            onRemove={() => removeField(field.id)}
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

// ─── Field Row ──────────────────────────────────────────────────────────────

function FieldRow({
  field,
  index,
  onUpdate,
  onRemove,
}: {
  field: MetaFieldDefinition;
  index: number;
  onUpdate: (patch: Partial<MetaFieldDefinition>) => void;
  onRemove: () => void;
}) {
  const [optionInput, setOptionInput] = useState('');
  const TypeIcon = TYPE_CONFIG[field.type].icon;

  const addOption = () => {
    const trimmed = optionInput.trim();
    if (!trimmed || field.options?.includes(trimmed)) return;
    onUpdate({ options: [...(field.options || []), trimmed] });
    setOptionInput('');
  };

  const removeOption = (opt: string) => {
    onUpdate({ options: field.options?.filter((o) => o !== opt) });
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
          id={`meta-field-label-${field.id}`}
        />

        {/* Type selector */}
        <select
          value={field.type}
          onChange={(e) => onUpdate({ type: e.target.value as MetaFieldType, options: e.target.value === 'list' ? [] : undefined })}
          className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
          id={`meta-field-type-${field.id}`}
        >
          {(Object.entries(TYPE_CONFIG) as [MetaFieldType, typeof TYPE_CONFIG[MetaFieldType]][]).map(([key, cfg]) => (
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
            id={`meta-field-required-${field.id}`}
          />
          Obligatoire
        </label>

        {/* Delete */}
        <button
          onClick={onRemove}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
          title="Supprimer ce champ"
          id={`meta-field-delete-${field.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Extra config per type */}
      <div className="pl-11 space-y-3">
        {/* Placeholder (text/number) */}
        {(field.type === 'text' || field.type === 'number') && (
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Placeholder (optionnel)
            </label>
            <input
              type="text"
              value={field.placeholder || ''}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              placeholder="Texte indicatif…"
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>
        )}

        {/* List options */}
        {field.type === 'list' && (
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Options de la liste
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(field.options || []).map((opt) => (
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
      </div>
    </div>
  );
}
