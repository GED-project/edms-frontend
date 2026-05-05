/**
 * Metadata Store
 * Persists admin-defined custom metadata field definitions in localStorage.
 * Replace with real API calls when backend is ready.
 */

export type MetaFieldType = 'text' | 'date' | 'number' | 'list';

export interface MetaFieldDefinition {
  id: string;
  label: string;
  type: MetaFieldType;
  required: boolean;
  /** For type=list: the selectable options */
  options?: string[];
  placeholder?: string;
}

const STORE_KEY = 'edms_meta_field_definitions';

const DEFAULT_FIELDS: MetaFieldDefinition[] = [
  {
    id: 'meta_ref',
    label: 'Référence interne',
    type: 'text',
    required: false,
    placeholder: 'Ex: REF-2025-001',
  },
  {
    id: 'meta_category',
    label: 'Catégorie',
    type: 'list',
    required: false,
    options: ['Contrat', 'Rapport', 'Facture', 'Procédure', 'Autre'],
  },
  {
    id: 'meta_expiry',
    label: "Date d'expiration",
    type: 'date',
    required: false,
  },
];

export function loadMetaFields(): MetaFieldDefinition[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT_FIELDS;
    return JSON.parse(raw) as MetaFieldDefinition[];
  } catch {
    return DEFAULT_FIELDS;
  }
}

export function saveMetaFields(fields: MetaFieldDefinition[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(fields));
}
