import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, Filter, MoreVertical, Eye, Pencil, Download, Trash2, FileText,
  FileSpreadsheet, FileImage, File, ChevronLeft, ChevronRight,
  SortAsc, SortDesc, Folder, RotateCcw, Trash, Clock, Tag, X, Tags,
  LayoutGrid, List, Calendar, Archive, Share2, FolderInput, Plus, Home, Library,
  ChevronDown, SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { Permission } from '@/lib/auth-rbac/roles';
import { CreateFolderModal, RenameFolderModal, DeleteConfirmModal } from './FolderModals';
import { VersionHistoryModal } from './VersionHistoryModal';
import { TagEditor } from './TagEditor';
import { AddMenu } from './AddMenu';
import {
  SetExpiryModal, ArchiveModal, BulkDeleteModal, ShareModal, BulkTagModal, MoveToFolderModal
} from './BulkActionModals';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { activityLogger } from '@/lib/activity-logger';

type DocStatus = 'active' | 'approved' | 'pending' | 'expired' | 'draft' | 'rejected';

export interface DocumentVersion {
  id: string;
  version: number;
  size: string;
  date: string;
  author: string;
}

export interface DocumentRow {
  id: string;
  name: string;
  type: 'folder' | 'pdf' | 'excel' | 'image' | 'other';
  parentId: string | null;
  extension?: string;
  size?: string;
  status?: DocStatus;
  author?: string;
  date: string;
  deleted?: boolean;
  deletedAt?: string;
  versions?: DocumentVersion[];
  tags?: string[];
  metadata?: Record<string, string>;
  department?: string;
  expiryDate?: string;
  archived?: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_DOCUMENTS: DocumentRow[] = [
  // Root-level "Library" folders
  { id: 'lib-rh',  name: 'Ressources Humaines',      type: 'folder', parentId: null, date: '2025-04-20', department: 'RH' },
  { id: 'lib-fin', name: 'Finance & Comptabilité',  type: 'folder', parentId: null, date: '2025-04-10', department: 'Finance' },
  { id: 'lib-dir', name: 'Direction Générale',       type: 'folder', parentId: null, date: '2025-01-01', department: 'Direction' },
  // Sub-folders inside RH library
  { id: 'f-rh-1', name: 'Contrats de travail',  type: 'folder', parentId: 'lib-rh',  date: '2025-04-20' },
  { id: 'f-rh-2', name: 'Fiches de paie',       type: 'folder', parentId: 'lib-rh',  date: '2025-04-18' },
  // Sub-folders inside Finance library
  { id: 'f-fin-1', name: 'Projets 2025',         type: 'folder', parentId: 'lib-fin', date: '2025-04-10' },
  { id: 'f-fin-2', name: 'Factures',             type: 'folder', parentId: 'lib-fin', date: '2025-03-20' },
  // Documents inside sub-folders
  { id: '1', name: 'Rapport Annuel 2025',    type: 'pdf',   parentId: 'f-rh-1',  extension: 'PDF',  size: '4.2 MB',  status: 'approved', author: 'Sophie Martin', date: '2025-04-28', tags: ['rapport', 'annuel', 'finance'],    department: 'Finance' },
  { id: '2', name: 'Budget Q2 2025',         type: 'excel', parentId: 'f-fin-1', extension: 'XLSX', size: '1.8 MB',  status: 'pending',  author: 'Emma Leroy',    date: '2025-04-27', tags: ['budget', 'finance'],                department: 'Finance' },
  { id: '3', name: 'Contrat Fournisseur ABC',type: 'pdf',   parentId: 'f-fin-1', extension: 'PDF',  size: '890 KB',  status: 'active',   author: 'Marc Dupont',   date: '2025-04-25', tags: ['contrat', 'fournisseur'],           department: 'Achat',     expiryDate: '2025-12-31' },
  { id: '4', name: 'Charte Graphique 2025', type: 'image', parentId: 'f-rh-2',  extension: 'PNG',  size: '12.4 MB', status: 'active',   author: 'Lisa Chen',     date: '2025-04-24', tags: ['design', 'charte'],                 department: 'Marketing' },
  { id: '5', name: 'Devis Prestataire X',   type: 'excel', parentId: 'f-fin-2', extension: 'XLSX', size: '340 KB',  status: 'expired',  author: 'Claire Leclerc',date: '2024-11-22', tags: ['devis', 'fournisseur'],             department: 'Achat',     expiryDate: '2025-01-01' },
  { id: '6', name: 'Procédure RH v3',       type: 'pdf',   parentId: 'f-rh-1',  extension: 'PDF',  size: '2.1 MB',  status: 'approved', author: 'Julien Bernard',date: '2025-04-20', tags: ['rh', 'procédure'],                  department: 'RH' },
  { id: '7', name: 'Inventaire Matériel Q1', type: 'excel', parentId: 'f-rh-2',  extension: 'XLSX', size: '567 KB',  status: 'pending',  author: 'Sophie Martin', date: '2025-04-18', tags: ['inventaire'],                       department: 'IT' },
  { id: '8', name: 'Plan de Continuité',    type: 'pdf',   parentId: 'f-rh-1',  extension: 'PDF',  size: '3.7 MB',  status: 'draft',    author: 'Marc Dupont',   date: '2025-04-15', tags: ['continuité', 'risque'],              department: 'Direction', archived: true },
];

const PAGE_SIZE = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<DocStatus, { label: string; cls: string }> = {
  active:   { label: 'Actif', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  approved: { label: 'Approuvé', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  pending:  { label: 'En attente', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  expired:  { label: 'Expiré', cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  draft:    { label: 'Brouillon', cls: 'bg-zinc-500/10 text-zinc-500' },
  rejected: { label: 'Rejeté', cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

const TYPE_ICON: Record<DocumentRow['type'], React.ElementType> = {
  folder: Folder,
  pdf: FileText,
  excel: FileSpreadsheet,
  image: FileImage,
  other: File,
};

const TYPE_COLOR: Record<DocumentRow['type'], string> = {
  folder: 'text-blue-500 bg-blue-500/10',
  pdf: 'text-red-500 bg-red-500/10',
  excel: 'text-emerald-500 bg-emerald-500/10',
  image: 'text-purple-500 bg-purple-500/10',
  other: 'text-zinc-500 bg-zinc-500/10',
};

// ─── Highlight Utility ────────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-amber-200 dark:bg-amber-500/40 text-amber-900 dark:text-amber-100 rounded px-0.5 not-italic font-semibold">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

function ContextMenu({
  doc,
  onClose,
  onPreview,
  onRename,
  onReplace,
  onHistory,
  onDelete,
  onRestore,
  onPermanentlyDelete,
  onManageTags,
  canEdit,
  canDelete,
  showTrash,
  actorName,
}: {
  doc: DocumentRow;
  onClose: () => void;
  onPreview: (doc: DocumentRow) => void;
  onRename: (doc: DocumentRow) => void;
  onReplace: (doc: DocumentRow) => void;
  onHistory: (doc: DocumentRow) => void;
  onDelete: (doc: DocumentRow) => void;
  onRestore: (doc: DocumentRow) => void;
  onPermanentlyDelete: (doc: DocumentRow) => void;
  onManageTags: (doc: DocumentRow) => void;
  canEdit: boolean;
  canDelete: boolean;
  showTrash: boolean;
  actorName: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const actions = showTrash
    ? [
        { icon: RotateCcw, label: 'Restaurer', always: true, show: true, color: 'text-primary' },
        { icon: Trash, label: 'Supprimer définitivement', always: true, show: canDelete, color: 'text-red-500' },
      ].filter(a => a.show)
    : doc.type === 'folder'
    ? [
        { icon: Pencil, label: 'Renommer', always: false, show: canEdit, color: 'text-foreground' },
        { icon: Trash2, label: 'Supprimer', always: false, show: canDelete, color: 'text-red-500' },
      ].filter(a => a.always || a.show)
    : [
        { icon: Eye,      label: 'Consulter',               always: true,  color: 'text-foreground' },
        { icon: Trash2,   label: 'Supprimer',               always: false, show: canDelete, color: 'text-red-500' },
        { icon: Pencil,   label: 'Modifier',                always: false, show: canEdit,   color: 'text-foreground' },
        { icon: RotateCcw,label: 'Remplacer',              always: false, show: canEdit,   color: 'text-foreground' },
        { icon: Clock,    label: 'Historique des versions', always: true,  color: 'text-foreground' },
        { icon: Tag,      label: 'Gérer les tags',         always: false, show: canEdit,   color: 'text-primary' },
        { icon: Download, label: 'Télécharger',            always: true,  color: 'text-foreground' },
      ].filter((a) => a.always || a.show);

  return (
    <div
      ref={ref}
      className="absolute right-8 top-0 z-50 min-w-[160px] rounded-xl border border-border bg-popover shadow-xl shadow-black/10 py-1 animate-in fade-in-0 zoom-in-95"
      role="menu"
    >
      {actions.map((action) => (
        <button
          key={action.label}
          role="menuitem"
          onClick={() => {
            if (action.label === 'Télécharger') {
              activityLogger.log('download', doc.name, actorName);
              toast.success(`Téléchargement de ${doc.name}...`);
              const blob = new Blob(['Contenu factice du document ' + doc.name], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = window.document.createElement('a');
              a.href = url;
              a.download = `${doc.name}.${doc.extension?.toLowerCase() || 'txt'}`;
              window.document.body.appendChild(a);
              a.click();
              window.document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } else if (action.label === 'Consulter') {
              activityLogger.log('view', doc.name, actorName);
              onPreview(doc);
            } else if (action.label === 'Renommer') {
              onRename(doc);
            } else if (action.label === 'Remplacer') {
              onReplace(doc);
            } else if (action.label === 'Historique des versions') {
              onHistory(doc);
            } else if (action.label === 'Gérer les tags') {
              onManageTags(doc);
            } else if (action.label === 'Supprimer') {
              onDelete(doc);
            } else if (action.label === 'Restaurer') {
              onRestore(doc);
            } else if (action.label === 'Supprimer définitivement') {
              onPermanentlyDelete(doc);
            } else {
              alert(`Action: ${action.label} — Doc: ${doc.id}`);
            }
            onClose();
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors ${action.color}`}
        >
          <action.icon className="h-3.5 w-3.5" />
          {action.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function DocumentsPage() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get('folder') || null;
  
  const setCurrentFolderId = (folderId: string | null) => {
    if (folderId) {
      setSearchParams({ folder: folderId });
    } else {
      setSearchParams({});
    }
  };

  const [nodes, setNodes] = useState<DocumentRow[]>(() => {
    const saved = localStorage.getItem('edms_documents_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as DocumentRow[];
        let needsMigration = false;
        // Revert any 'library' types back to 'folder' to prevent crashes
        const migrated = parsed.map(n => {
          if ((n as any).type === 'library') {
            needsMigration = true;
            return { ...n, type: 'folder' as const };
          }
          return n;
        });
        if (needsMigration) {
          localStorage.setItem('edms_documents_v2', JSON.stringify(migrated));
          return migrated;
        }
        return parsed;
      } catch (e) {
        return MOCK_DOCUMENTS;
      }
    }
    return MOCK_DOCUMENTS;
  });

  useEffect(() => {
    localStorage.setItem('edms_documents_v2', JSON.stringify(nodes));
  }, [nodes]);

  // Initialise search from ?q= param set by topbar
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('q') ?? '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState<DocStatus | 'all'>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<'AND' | 'OR'>('OR');
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  // Advanced filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<DocumentRow['type'] | 'all'>('all');
  const [sizeFilter, setSizeFilter] = useState<'all' | 'small' | 'medium' | 'large'>('all');
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [managingTagsDoc, setManagingTagsDoc] = useState<DocumentRow | null>(null);
  
  // New States for Library module
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [departmentFilter, setDepartmentFilter] = useState<string | 'all'>('all');
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'expiry' | 'archive' | 'delete' | 'share' | 'tag' | 'move' | null>(null);

  const [replacingDoc, setReplacingDoc] = useState<DocumentRow | null>(null);
  const [historyDoc, setHistoryDoc] = useState<DocumentRow | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<DocumentRow | null>(null);
  const [itemToDelete, setItemToDelete] = useState<DocumentRow | null>(null);
  const showTrash = searchParams.get('trash') === 'true';
  const setShowTrash = (val: boolean) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set('trash', 'true');
      else next.delete('trash');
      return next;
    });
  };
  const [itemToRestore, setItemToRestore] = useState<DocumentRow | null>(null);
  const [itemToPermanentlyDelete, setItemToPermanentlyDelete] = useState<DocumentRow | null>(null);

  const canEdit   = hasPermission(Permission.MANAGE_DOCUMENTS);
  const canDelete = hasPermission(Permission.MANAGE_DOCUMENTS);

  // Sync ?q= param → local search state when URL changes externally (topbar)
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setSearch(q);
    setDebouncedSearch(q);
  }, [searchParams]);

  // Debounce local typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Autocomplete suggestions based on live search value
  const suggestions = useMemo(() => {
    if (!search.trim() || search.length < 2) return [];
    const q = search.toLowerCase();
    const names = nodes
      .filter(n => !n.deleted && n.type !== 'folder')
      .map(n => n.name)
      .filter(name => name.toLowerCase().includes(q));
    const tags = Array.from(new Set(nodes.flatMap(n => n.tags || [])))
      .filter(t => t.toLowerCase().includes(q))
      .map(t => `🏷 ${t}`);
    return [...new Set([...names, ...tags])].slice(0, 6);
  }, [search, nodes]);

  // Size filter helper
  const parseSizeMB = (size?: string): number => {
    if (!size) return 0;
    const num = parseFloat(size);
    if (size.toLowerCase().includes('kb')) return num / 1024;
    if (size.toLowerCase().includes('gb')) return num * 1024;
    return num; // assume MB
  };

  // Active advanced filter count
  const activeAdvancedCount = [dateFrom, dateTo, fileTypeFilter !== 'all', sizeFilter !== 'all'].filter(Boolean).length;

  // Collect all tags corpus from all documents
  const allTags = Array.from(new Set(nodes.flatMap((d) => d.tags || []))).sort();
  const allDepartments = Array.from(new Set(nodes.filter(d => d.department).map(d => d.department!))).sort();


  const isRootView = currentFolderId === null;
  const currentFolderNode = nodes.find(n => n.id === currentFolderId);

  const filtered = nodes
    .filter((d) => showTrash ? d.deleted : !d.deleted)
    .filter((d) => {
      if (showTrash) return true;
      if (debouncedSearch) return d.type !== 'folder';
      return d.parentId === currentFolderId;
    })
    .filter((d) => !showTrash && !debouncedSearch ? !d.archived : true)
    .filter((d) => {
      const q = debouncedSearch.toLowerCase();
      const statusMatch = statusFilter === 'all' || d.type === 'folder' || d.status === statusFilter;
      const deptMatch = departmentFilter === 'all' || d.type === 'folder' || d.department === departmentFilter;
      const searchMatch = !q || d.name.toLowerCase().includes(q) ||
        (d.author && d.author.toLowerCase().includes(q)) ||
        (d.tags && d.tags.some(t => t.toLowerCase().includes(q))) ||
        (d.department && d.department.toLowerCase().includes(q));
      let tagMatch = true;
      if (selectedTags.length > 0 && d.type !== 'folder') {
        const docTags = d.tags || [];
        tagMatch = tagMode === 'AND'
          ? selectedTags.every((t) => docTags.includes(t))
          : selectedTags.some((t) => docTags.includes(t));
      }
      // Advanced filters
      const typeMatch = fileTypeFilter === 'all' || d.type === fileTypeFilter;
      const dateMatchFrom = !dateFrom || new Date(d.date) >= new Date(dateFrom);
      const dateMatchTo = !dateTo || new Date(d.date) <= new Date(dateTo);
      const sizeMB = parseSizeMB(d.size);
      const sizeMatch = sizeFilter === 'all' ||
        (sizeFilter === 'small' && sizeMB < 1) ||
        (sizeFilter === 'medium' && sizeMB >= 1 && sizeMB <= 10) ||
        (sizeFilter === 'large' && sizeMB > 10);
      return statusMatch && deptMatch && searchMatch && tagMatch && typeMatch && dateMatchFrom && dateMatchTo && (d.type === 'folder' || sizeMatch);
    })
    .sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      const cmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      return sortAsc ? -cmp : cmp;
    });


  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getBreadcrumbs = () => {
    const crumbs = [];
    let current = currentFolderId;
    while (current) {
      const node = nodes.find(n => n.id === current);
      if (node) {
        crumbs.unshift(node);
        current = node.parentId;
      } else {
        break;
      }
    }
    return crumbs;
  };
  const breadcrumbs = getBreadcrumbs();

  const handleSearch = useCallback((val: string) => { setSearch(val); setPage(1); setShowSuggestions(true); }, []);
  const handleStatus = (val: DocStatus | 'all') => { setStatusFilter(val); setPage(1); };
  const resetAdvancedFilters = () => { setDateFrom(''); setDateTo(''); setFileTypeFilter('all'); setSizeFilter('all'); };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginated.map(d => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownloadZip = async () => {
    if (selectedIds.size === 0) return;
    toast.info("Génération de l'archive ZIP en cours...", { id: 'zip-toast' });
    
    try {
      const zip = new JSZip();
      
      Array.from(selectedIds).forEach(id => {
        const doc = nodes.find(d => d.id === id);
        if (doc && doc.type !== 'folder') {
          zip.file(`${doc.name}.${doc.extension?.toLowerCase() || 'txt'}`, `Contenu factice de ${doc.name}`);
        }
      });
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `documents_selection.zip`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Archive ZIP téléchargée avec succès', { id: 'zip-toast' });
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Erreur lors de la génération du ZIP', { id: 'zip-toast' });
    }
  };



  const handleCreateFolder = (name: string) => {
    const newFolder: DocumentRow = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      type: 'folder',
      parentId: currentFolderId,
      date: new Date().toISOString().split('T')[0],
    };
    setNodes(prev => [newFolder, ...prev]);
    activityLogger.log('create_folder', name, user?.fullName ?? 'Utilisateur');
    toast.success(`Dossier "${name}" créé`);
  };

  const handleRename = (newName: string) => {
    if (!folderToRename) return;
    setNodes(prev => prev.map(n => n.id === folderToRename.id ? { ...n, name: newName } : n));
    activityLogger.log('rename_folder', newName, user?.fullName ?? 'Utilisateur', `Renommé depuis "${folderToRename.name}"`);
    toast.success(`Renommé en "${newName}"`);
  };

  const getFolderItemCount = (folderId: string) => {
    return nodes.filter(n => n.parentId === folderId).length;
  };

  const handleDeleteItem = () => {
    if (!itemToDelete) return;
    const actor = user?.fullName ?? 'Utilisateur';
    if (itemToDelete.type === 'folder') {
      const softDeleteRecursive = (idsToDelete: Set<string>, currentId: string) => {
        idsToDelete.add(currentId);
        nodes.filter(n => n.parentId === currentId).forEach(n => softDeleteRecursive(idsToDelete, n.id));
      };
      const ids = new Set<string>();
      softDeleteRecursive(ids, itemToDelete.id);
      setNodes(prev => prev.map(n => ids.has(n.id) ? { ...n, deleted: true, deletedAt: new Date().toISOString() } : n));
      activityLogger.log('delete', itemToDelete.name, actor, 'Dossier déplacé à la corbeille');
      toast.success(`Dossier déplacé à la corbeille`);
    } else {
      setNodes(prev => prev.map(n => n.id === itemToDelete.id ? { ...n, deleted: true, deletedAt: new Date().toISOString() } : n));
      activityLogger.log('delete', itemToDelete.name, actor, 'Placé dans la corbeille');
      toast.success(`Document déplacé à la corbeille`);
    }
    setItemToDelete(null);
  };

  const handleRestoreItem = (item: DocumentRow) => {
    setNodes(prev => prev.map(n => n.id === item.id ? { ...n, deleted: false, deletedAt: undefined } : n));
    activityLogger.log('restore', item.name, user?.fullName ?? 'Utilisateur', 'Restauré depuis la corbeille');
    toast.success(`${item.type === 'folder' ? 'Dossier' : 'Document'} restauré`);
    setItemToRestore(null);
  };

  const handlePermanentlyDeleteItem = () => {
    if (!itemToPermanentlyDelete) return;
    const actor = user?.fullName ?? 'Utilisateur';
    if (itemToPermanentlyDelete.type === 'folder') {
      const deleteRecursive = (idsToDelete: Set<string>, currentId: string) => {
        idsToDelete.add(currentId);
        nodes.filter(n => n.parentId === currentId).forEach(n => deleteRecursive(idsToDelete, n.id));
      };
      const ids = new Set<string>();
      deleteRecursive(ids, itemToPermanentlyDelete.id);
      setNodes(prev => prev.filter(n => !ids.has(n.id)));
      activityLogger.log('delete', itemToPermanentlyDelete.name, actor, 'Suppression définitive du dossier');
      toast.success(`Dossier supprimé définitivement`);
    } else {
      setNodes(prev => prev.filter(n => n.id !== itemToPermanentlyDelete.id));
      activityLogger.log('delete', itemToPermanentlyDelete.name, actor, 'Suppression définitive');
      toast.success(`Document supprimé définitivement`);
    }
    setItemToPermanentlyDelete(null);
  };

  const handleRestoreVersion = (doc: DocumentRow, versionToRestore: DocumentVersion) => {
    const author = user?.fullName || 'Utilisateur';
    setNodes(prev => prev.map(n => {
      if (n.id === doc.id) {
        const currentVersions = n.versions || [{
          id: n.id + '-v1',
          version: 1,
          size: n.size || '--',
          date: n.date,
          author: n.author || 'Système',
        }];
        const newVersionNum = currentVersions[0].version + 1;
        
        const newVersion: DocumentVersion = {
          id: n.id + '-v' + newVersionNum,
          version: newVersionNum,
          size: versionToRestore.size,
          date: new Date().toISOString(), // Use full ISO string to ensure uniqueness and accurate sorting
          author: author,
        };

        return {
          ...n,
          size: versionToRestore.size,
          date: newVersion.date,
          author: author,
          versions: [newVersion, ...currentVersions]
        };
      }
      return n;
    }));
    toast.success(`Version ${versionToRestore.version} restaurée avec succès (création de la version ${doc.versions ? doc.versions[0].version + 1 : 2})`);
    setHistoryDoc(null);
  };

  const handleApproveDocument = (doc: DocumentRow) => {
    setNodes(prev => prev.map(n => n.id === doc.id ? { ...n, status: 'approved' } : n));
    activityLogger.log('approve', doc.name, user?.fullName ?? 'Utilisateur', 'Document approuvé');
    toast.success(`Le document ${doc.name} a été approuvé`);
  };

  const handleDuplicateDocument = (doc: DocumentRow) => {
    const newDoc = {
      ...doc,
      id: Math.random().toString(36).substr(2, 9),
      name: doc.name + ' (Copie)',
      date: new Date().toISOString().split('T')[0],
      status: 'draft' as const,
      versions: undefined,
    };
    setNodes(prev => [newDoc, ...prev]);
    activityLogger.log('upload', newDoc.name, user?.fullName ?? 'Utilisateur', 'Document dupliqué');
    toast.success(`Document dupliqué`);
  };

  const handleDownloadDocument = (doc: DocumentRow) => {
    activityLogger.log('download', doc.name, user?.fullName ?? 'Utilisateur');
    toast.success(`Téléchargement de ${doc.name}...`);
    const blob = new Blob(['Contenu factice du document ' + doc.name], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${doc.name}.${doc.extension?.toLowerCase() || 'txt'}`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenEditor = (doc: DocumentRow) => {
    toast.info(`Ouverture de l'espace de travail Éditeur pour ${doc.name}`);
    activityLogger.log('edit', doc.name, user?.fullName ?? 'Utilisateur', 'Ouverture du mode éditeur');
  };

  return (
    <>
      <Helmet>
        <title>Documents — EDMS Enterprise</title>
        <meta name="description" content="Gestion et consultation des documents du système EDMS." />
      </Helmet>

      <div className="space-y-5 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {showTrash ? 'Corbeille' : isRootView ? 'Document Library' : currentFolderNode?.name ?? 'Documents'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {search ? `${filtered.length} résultat(s) pour "${search}"` : `${filtered.length} élément(s)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTrash(!showTrash)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-sm ${
                showTrash
                  ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                  : 'border border-input bg-background text-foreground hover:bg-accent'
              }`}
            >
              <Trash className="h-4 w-4" />
              Corbeille
            </button>
            <div className="flex items-center rounded-lg border border-input bg-background p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                title="Vue liste"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                title="Vue grille"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>

            {!showTrash && hasPermission(Permission.CREATE_FOLDER) && (
              <button
                onClick={() => setIsCreateFolderOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                {isRootView ? 'New Library' : 'New Folder'}
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumb — always show when inside a folder */}
        {!showTrash && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground overflow-x-auto pb-1">
            <button
              onClick={() => setCurrentFolderId(null)}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors shrink-0"
            >
              <Home className="h-3.5 w-3.5" />
              <span className={isRootView ? 'font-semibold text-foreground' : ''}>Document Library</span>
            </button>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
                <button
                  onClick={() => setCurrentFolderId(crumb.id)}
                  className={`hover:text-foreground transition-colors truncate max-w-[160px] ${
                    idx === breadcrumbs.length - 1 ? 'font-semibold text-foreground' : ''
                  }`}
                  title={crumb.name}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search with autocomplete */}
            <div className="relative flex-1" ref={searchRef}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="doc-search"
                type="search"
                placeholder="Rechercher par nom, auteur, tag, département…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                autoComplete="off"
                className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition"
              />
              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-border bg-popover shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onMouseDown={() => { handleSearch(s.replace('🏷 ', '')); setShowSuggestions(false); }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-accent transition-colors"
                    >
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Highlight text={s} query={search} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status + Sort + Tag + Advanced toggle */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              
              {/* Department Filter */}
              <select
                id="dept-filter"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer hidden sm:block"
              >
                <option value="all">Tous les départements</option>
                {allDepartments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => handleStatus(e.target.value as DocStatus | 'all')}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actif</option>
                <option value="approved">Approuvé</option>
                <option value="pending">En attente</option>
                <option value="expired">Expiré</option>
                <option value="draft">Brouillon</option>
                <option value="rejected">Rejeté</option>
              </select>

              <button
                id="tag-filter-toggle"
                onClick={() => setShowTagFilter((v) => !v)}
                title="Filtrer par tags"
                className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  showTagFilter || selectedTags.length > 0
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Tags className="h-4 w-4" />
                Tags
                {selectedTags.length > 0 && (
                  <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {selectedTags.length}
                  </span>
                )}
              </button>

              {/* Advanced Filters button */}
              <button
                onClick={() => setShowAdvancedFilters(v => !v)}
                className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  showAdvancedFilters || activeAdvancedCount > 0
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtres
                {activeAdvancedCount > 0 && (
                  <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {activeAdvancedCount}
                  </span>
                )}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
              </button>

              <button
                onClick={() => setSortAsc((v) => !v)}
                title={sortAsc ? 'Tri croissant' : 'Tri décroissant'}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {sortAsc ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Filtres avancés</span>
                </div>
                {activeAdvancedCount > 0 && (
                  <button onClick={resetAdvancedFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" />Réinitialiser
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Date From */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Date depuis</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>
                {/* Date To */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Date jusqu'au</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => { setDateTo(e.target.value); setPage(1); }}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>
                {/* File Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Type de fichier</label>
                  <select
                    value={fileTypeFilter}
                    onChange={e => { setFileTypeFilter(e.target.value as DocumentRow['type'] | 'all'); setPage(1); }}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer"
                  >
                    <option value="all">Tous les types</option>
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel (XLSX)</option>
                    <option value="image">Image (PNG/JPG)</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
                {/* File Size */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Taille du fichier</label>
                  <select
                    value={sizeFilter}
                    onChange={e => { setSizeFilter(e.target.value as typeof sizeFilter); setPage(1); }}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer"
                  >
                    <option value="all">Toutes les tailles</option>
                    <option value="small">&lt; 1 MB</option>
                    <option value="medium">1 MB – 10 MB</option>
                    <option value="large">&gt; 10 MB</option>
                  </select>
                </div>
              </div>
              {/* Active filter summary */}
              {activeAdvancedCount > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {dateFrom && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">Depuis: {dateFrom}</span>}
                  {dateTo && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">Jusqu'au: {dateTo}</span>}
                  {fileTypeFilter !== 'all' && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">Type: {fileTypeFilter.toUpperCase()}</span>}
                  {sizeFilter !== 'all' && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">Taille: {sizeFilter === 'small' ? '< 1MB' : sizeFilter === 'medium' ? '1-10MB' : '> 10MB'}</span>}
                </div>
              )}
            </div>
          )}

          {/* Tag filter panel */}
          {showTagFilter && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Filtrer par tags</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* AND / OR toggle */}
                  <div className="flex items-center rounded-lg border border-input bg-background p-0.5 text-xs font-medium">
                    <button
                      id="tag-mode-or"
                      onClick={() => setTagMode('OR')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        tagMode === 'OR' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >OU</button>
                    <button
                      id="tag-mode-and"
                      onClick={() => setTagMode('AND')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        tagMode === 'AND' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >ET</button>
                  </div>
                  {selectedTags.length > 0 && (
                    <button
                      onClick={() => setSelectedTags([])}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />Effacer
                    </button>
                  )}
                </div>
              </div>

              {/* Tag chips */}
              <div className="flex flex-wrap gap-1.5">
                {allTags.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Aucun tag disponible.</p>
                )}
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    id={`tag-filter-${tag}`}
                    onClick={() =>
                      setSelectedTags((prev) =>
                        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                      )
                    }
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </button>
                ))}
              </div>

              {selectedTags.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Affichage des documents avec {tagMode === 'AND' ? 'tous les' : 'au moins un des'} tags sélectionnés.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Bar (Multi-selection) */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 animate-in fade-in slide-in-from-top-2">
            <span className="text-sm font-medium text-primary whitespace-nowrap">
              {selectedIds.size} sélectionné(s)
            </span>
            
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setBulkAction('share')} className="flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-xs font-medium text-foreground border border-input hover:bg-accent transition-colors">
                <Share2 className="h-3.5 w-3.5 text-sky-500" />Partager
              </button>
              <button onClick={() => setBulkAction('tag')} className="flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-xs font-medium text-foreground border border-input hover:bg-accent transition-colors">
                <Tag className="h-3.5 w-3.5 text-primary" />Tagger
              </button>
              <button onClick={() => setBulkAction('move')} className="flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-xs font-medium text-foreground border border-input hover:bg-accent transition-colors">
                <FolderInput className="h-3.5 w-3.5 text-blue-500" />Déplacer
              </button>
              <button onClick={() => setBulkAction('expiry')} className="flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-xs font-medium text-foreground border border-input hover:bg-accent transition-colors">
                <Calendar className="h-3.5 w-3.5 text-amber-500" />Expiration
              </button>
              <button onClick={() => setBulkAction('archive')} className="flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-xs font-medium text-foreground border border-input hover:bg-accent transition-colors">
                <Archive className="h-3.5 w-3.5 text-zinc-500" />Archiver
              </button>
              <button onClick={handleDownloadZip} className="flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-xs font-medium text-foreground border border-input hover:bg-accent transition-colors">
                <Download className="h-3.5 w-3.5" />ZIP
              </button>
              <button onClick={() => setBulkAction('delete')} className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/20 transition-colors ml-auto">
                <Trash2 className="h-3.5 w-3.5" />Supprimer
              </button>
            </div>
          </div>
        )}

        {/* Library Root View — card grid of top-level libraries */}
        {isRootView && !search && !showTrash ? (
          <div>
            {filtered.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-2xl bg-card">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Library className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No Libraries Yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {hasPermission(Permission.CREATE_FOLDER)
                    ? 'Create a library to start organizing your folders and documents.'
                    : 'No libraries are available at the moment.'}
                </p>
                {hasPermission(Permission.CREATE_FOLDER) && (
                  <button
                    onClick={() => setIsCreateFolderOpen(true)}
                    className="mt-6 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors shadow-sm"
                  >
                    Create First Library
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filtered.map((item) => {
                  const isFolder = item.type === 'folder';
                  const Icon = isFolder ? Library : (TYPE_ICON[item.type] || FileText);
                  
                  return (
                    <div
                      key={item.id}
                      onClick={() => isFolder ? setCurrentFolderId(item.id) : navigate(`/documents/${item.id}`)}
                      className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                    >
                      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full transition-transform group-hover:scale-125 ${isFolder ? 'bg-primary/5' : 'bg-zinc-500/5'}`} />
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isFolder ? 'bg-primary/10 text-primary' : 'bg-accent text-muted-foreground'}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
                            className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground transition-all"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {openMenuId === item.id && (
                            <div onClick={e => e.stopPropagation()}>
                              <ContextMenu
                                doc={item}
                                onClose={() => setOpenMenuId(null)}
                                onPreview={(d) => navigate(`/documents/${d.id}`)}
                                onRename={(d) => setFolderToRename(d)}
                                onReplace={(d) => { setReplacingDoc(d); navigate(`/documents/upload?replace=${d.id}`); }}
                                onHistory={(d) => setHistoryDoc(d)}
                                onDelete={(d) => setItemToDelete(d)}
                                onRestore={(d) => setItemToRestore(d)}
                                onPermanentlyDelete={(d) => setItemToPermanentlyDelete(d)}
                                onManageTags={(d) => setManagingTagsDoc(d)}
                                canEdit={canEdit}
                                canDelete={canDelete}
                                showTrash={showTrash}
                                actorName={user?.fullName ?? 'Utilisateur'}
                              />
                            </div>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors truncate" title={item.name}>{item.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {isFolder ? `${getFolderItemCount(item.id)} dossier(s)` : `${item.size || '--'} • ${item.extension || 'DOC'}`}
                        </p>
                      </div>
                      
                      <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(item.date).toLocaleDateString('fr-FR')}
                          </div>
                          {canDelete && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }}
                              className="p-1 hover:bg-red-500/10 text-red-500 rounded transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {isFolder && item.department && (
                          <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-foreground">
                            {item.department}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : viewMode === 'table' ? (
          <div className="rounded-xl border border-border bg-card">
            <div className="w-full overflow-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-input bg-background text-primary focus:ring-primary/50 cursor-pointer"
                        checked={paginated.length > 0 && selectedIds.size === paginated.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Département</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Taille</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Expiration</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Tags</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Auteur</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Date</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
              <tbody className="divide-y divide-border">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                      Aucun document ne correspond à votre recherche.
                    </td>
                  </tr>
                ) : (
                  paginated.map((doc) => {
                    const Icon = TYPE_ICON[doc.type];
                    const status = doc.type === 'folder' ? null : (doc.status ? STATUS_MAP[doc.status] : null);
                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-accent/30 transition-colors group"
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-input bg-background text-primary focus:ring-primary/50 cursor-pointer"
                            checked={selectedIds.has(doc.id)}
                            onChange={() => handleSelectRow(doc.id)}
                          />
                        </td>
                        {/* Name + type */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TYPE_COLOR[doc.type]}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              {doc.type === 'folder' ? (
                                <button onClick={() => setCurrentFolderId(doc.id)} className="font-medium text-foreground hover:text-primary hover:underline truncate max-w-[180px] block text-left">
                                  <Highlight text={doc.name} query={debouncedSearch} />
                                </button>
                              ) : (
                                <button onClick={() => navigate(`/documents/${doc.id}`)} className="font-medium text-foreground hover:text-primary hover:underline truncate max-w-[180px] block text-left">
                                  <Highlight text={doc.name} query={debouncedSearch} />
                                </button>
                              )}
                              <p className="text-[11px] text-muted-foreground">
                                {doc.type === 'folder' ? `${getFolderItemCount(doc.id)} élément(s)` : doc.extension}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
                          {doc.department || '--'}
                        </td>

                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          {doc.type === 'folder' ? '--' : doc.size}
                        </td>

                        <td className="px-4 py-3">
                          {status ? (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status.cls}`}>
                              {status.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
                          {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString('fr-FR') : '--'}
                        </td>

                        {/* Tags cell */}
                        <td className="px-4 py-3 hidden lg:table-cell max-w-[180px]">
                          {doc.type === 'folder' ? (
                            <span className="text-muted-foreground">--</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {(doc.tags || []).slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  onClick={() => { setSelectedTags([tag]); setShowTagFilter(true); }}
                                  className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary cursor-pointer hover:bg-primary/20 transition-colors"
                                >
                                  <Tag className="h-2 w-2" />{tag}
                                </span>
                              ))}
                              {(doc.tags || []).length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{(doc.tags || []).length - 3}</span>
                              )}
                              {(doc.tags || []).length === 0 && (
                                <span className="text-[10px] text-muted-foreground italic">—</span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                          {doc.type === 'folder' ? '--' : doc.author}
                        </td>

                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                          {new Date(doc.date).toLocaleDateString('fr-FR')}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            aria-label={`Actions pour ${doc.name}`}
                            id={`doc-menu-${doc.id}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {openMenuId === doc.id && (
                            <ContextMenu
                              doc={doc}
                              onClose={() => setOpenMenuId(null)}
                              onPreview={(d) => navigate(`/documents/${d.id}`)}
                              onRename={(d) => setFolderToRename(d)}
                              onReplace={(d) => { setReplacingDoc(d); navigate(`/documents/upload?replace=${d.id}`); }}
                              onHistory={(d) => setHistoryDoc(d)}
                              onDelete={(d) => setItemToDelete(d)}
                              onRestore={(d) => setItemToRestore(d)}
                              onPermanentlyDelete={(d) => setItemToPermanentlyDelete(d)}
                              onManageTags={(d) => setManagingTagsDoc(d)}
                              canEdit={canEdit}
                              canDelete={canDelete}
                              showTrash={showTrash}
                              actorName={user?.fullName ?? 'Utilisateur'}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginated.length === 0 ? (
              <div className="col-span-full py-12 text-center text-sm text-muted-foreground border border-border rounded-xl bg-card">
                Aucun document ne correspond à votre recherche.
              </div>
            ) : (
              paginated.map((doc) => {
                const Icon = TYPE_ICON[doc.type];
                const status = doc.type === 'folder' ? null : (doc.status ? STATUS_MAP[doc.status] : null);
                const isSelected = selectedIds.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    className={`relative rounded-xl border p-4 transition-all hover:shadow-md bg-card group ${
                      isSelected ? 'border-primary ring-1 ring-primary/50' : 'border-border hover:border-border/80'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="absolute top-3 left-3 z-10">
                      <input
                        type="checkbox"
                        className="rounded border-input bg-background text-primary focus:ring-primary/50 cursor-pointer"
                        checked={isSelected}
                        onChange={() => handleSelectRow(doc.id)}
                      />
                    </div>
                    {/* Actions Menu */}
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground bg-background/80 hover:bg-accent hover:text-foreground transition-colors backdrop-blur-sm shadow-sm"
                        aria-label={`Actions pour ${doc.name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {openMenuId === doc.id && (
                        <ContextMenu
                          doc={doc}
                          onClose={() => setOpenMenuId(null)}
                          onPreview={(d) => navigate(`/documents/${d.id}`)}
                          onRename={(d) => setFolderToRename(d)}
                          onReplace={(d) => { setReplacingDoc(d); navigate(`/documents/upload?replace=${d.id}`); }}
                          onHistory={(d) => setHistoryDoc(d)}
                          onDelete={(d) => setItemToDelete(d)}
                          onRestore={(d) => setItemToRestore(d)}
                          onPermanentlyDelete={(d) => setItemToPermanentlyDelete(d)}
                          onManageTags={(d) => setManagingTagsDoc(d)}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          showTrash={showTrash}
                          actorName={user?.fullName ?? 'Utilisateur'}
                        />
                      )}
                    </div>
                    
                    {/* Icon / Thumbnail */}
                    <div className="mt-4 mb-3 flex justify-center">
                      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${TYPE_COLOR[doc.type]} bg-opacity-20`}>
                        <Icon className="h-8 w-8" />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="space-y-1 text-center">
                      {doc.type === 'folder' ? (
                        <button onClick={() => setCurrentFolderId(doc.id)} className="font-semibold text-foreground hover:text-primary hover:underline truncate w-full">
                          {doc.name}
                        </button>
                      ) : (
                        <button onClick={() => navigate(`/documents/${doc.id}`)} className="font-semibold text-foreground hover:text-primary hover:underline truncate w-full text-center">
                          {doc.name}
                        </button>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {doc.type === 'folder' ? `${getFolderItemCount(doc.id)} élément(s)` : `${doc.extension} • ${doc.size}`}
                      </p>
                    </div>

                    {/* Metadata Footer */}
                    {doc.type !== 'folder' && (
                      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                        {status ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${status.cls} truncate max-w-[50%]`}>
                            {status.label}
                          </span>
                        ) : <span />}
                        <span className="text-[10px] text-muted-foreground truncate" title={doc.department}>
                          {doc.department || '--'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-card rounded-xl">
            <p className="text-xs text-muted-foreground">
              Page {page} / {totalPages} — {filtered.length} résultats
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                    p === page
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Page suivante"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {!showTrash && (
        <AddMenu 
          onUpload={() => navigate(`/documents/upload${currentFolderId ? `?folder=${currentFolderId}` : ''}`)} 
          onScan={() => navigate(`/documents/scan${currentFolderId ? `?folder=${currentFolderId}` : ''}`)}
          onAddFolder={() => setIsCreateFolderOpen(true)}
        />
      )}

      {/* UploadModal removed in favor of DocumentUploadPage navigation */}

      {/* PreviewModal removed in favor of DocumentViewPage navigation */}

      <VersionHistoryModal
        isOpen={!!historyDoc}
        onClose={() => setHistoryDoc(null)}
        document={historyDoc}
        onRestore={handleRestoreVersion}
      />

      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreate={handleCreateFolder}
        existingNames={nodes.filter(n => n.parentId === currentFolderId).map(n => n.name)}
      />

      <RenameFolderModal
        isOpen={!!folderToRename}
        onClose={() => setFolderToRename(null)}
        onRename={handleRename}
        initialName={folderToRename?.name || ''}
        existingNames={nodes.filter(n => n.parentId === currentFolderId).map(n => n.name)}
      />

      <DeleteConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDeleteItem}
        folderName={itemToDelete?.name || ''}
        itemCount={itemToDelete?.type === 'folder' ? getFolderItemCount(itemToDelete.id) : 0}
      />

      {/* Restore Confirm Modal */}
      {itemToRestore && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg animate-in zoom-in-95 duration-200">
            <h2 className="text-base font-semibold text-foreground">Restaurer</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Êtes-vous sûr de vouloir restaurer <strong>{itemToRestore.name}</strong> ?
            </p>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setItemToRestore(null)}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleRestoreItem(itemToRestore)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Restaurer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirm Modal */}
      {itemToPermanentlyDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg animate-in zoom-in-95 duration-200">
            <h2 className="text-base font-semibold text-red-600">Supprimer définitivement</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Êtes-vous sûr de vouloir supprimer définitivement <strong>{itemToPermanentlyDelete.name}</strong> ? Cette action est irréversible.
            </p>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setItemToPermanentlyDelete(null)}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handlePermanentlyDeleteItem}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manage Tags Modal ─────────────────────────────────────────── */}
      {managingTagsDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Tags className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Gérer les tags</h2>
                  <p className="text-xs text-muted-foreground truncate max-w-[220px]">{managingTagsDoc.name}</p>
                </div>
              </div>
              <button
                onClick={() => setManagingTagsDoc(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tag editor */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Tags du document</label>
              <TagEditor
                tags={managingTagsDoc.tags || []}
                allTags={allTags}
                onChange={(newTags) =>
                  setManagingTagsDoc((prev) => prev ? { ...prev, tags: newTags } : null)
                }
              />
            </div>

            {/* Current tag count info */}
            <p className="text-xs text-muted-foreground">
              {(managingTagsDoc.tags || []).length === 0
                ? 'Aucun tag sur ce document.'
                : `${(managingTagsDoc.tags || []).length} tag(s) défini(s).`}
            </p>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setManagingTagsDoc(null)}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Annuler
              </button>
              <button
                id="save-tags-btn"
                onClick={() => {
                  setNodes((prev) =>
                    prev.map((n) =>
                      n.id === managingTagsDoc.id ? { ...n, tags: managingTagsDoc.tags } : n
                    )
                  );
                  toast.success('Tags mis à jour avec succès');
                  setManagingTagsDoc(null);
                }}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Tag className="h-4 w-4" />
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Bulk Action Modals ────────────────────────────────────────── */}
      <SetExpiryModal
        isOpen={bulkAction === 'expiry'}
        selectedCount={selectedIds.size}
        onClose={() => setBulkAction(null)}
        onConfirm={(date) => {
          setNodes(prev => prev.map(n => selectedIds.has(n.id) ? { ...n, expiryDate: date } : n));
          activityLogger.log('expiry_set', `${selectedIds.size} document(s)`, user?.fullName ?? 'Utilisateur', `Expiration fixée au ${date}`);
          toast.success(`Date d'expiration définie pour ${selectedIds.size} document(s)`);
          setSelectedIds(new Set());
        }}
      />
      <ArchiveModal
        isOpen={bulkAction === 'archive'}
        selectedCount={selectedIds.size}
        onClose={() => setBulkAction(null)}
        onConfirm={() => {
          setNodes(prev => prev.map(n => selectedIds.has(n.id) ? { ...n, archived: true } : n));
          activityLogger.log('bulk_archive', `${selectedIds.size} document(s)`, user?.fullName ?? 'Utilisateur');
          toast.success(`${selectedIds.size} document(s) archivé(s)`);
          setSelectedIds(new Set());
        }}
      />
      <BulkDeleteModal
        isOpen={bulkAction === 'delete'}
        selectedCount={selectedIds.size}
        onClose={() => setBulkAction(null)}
        onConfirm={() => {
          setNodes(prev => prev.map(n => selectedIds.has(n.id) ? { ...n, deleted: true, deletedAt: new Date().toISOString() } : n));
          activityLogger.log('bulk_delete', `${selectedIds.size} document(s)`, user?.fullName ?? 'Utilisateur', 'Déplacés vers la corbeille');
          toast.success(`${selectedIds.size} document(s) déplacé(s) vers la corbeille`);
          setSelectedIds(new Set());
        }}
      />
      <ShareModal
        isOpen={bulkAction === 'share'}
        selectedCount={selectedIds.size}
        onClose={() => setBulkAction(null)}
        onConfirm={(emails, permission) => {
          activityLogger.log('bulk_share', `${selectedIds.size} document(s)`, user?.fullName ?? 'Utilisateur', `Partagé avec ${emails.length} personne(s) (${permission})`);
          toast.success(`${selectedIds.size} document(s) partagé(s) avec ${emails.length} personne(s) (${permission})`);
          setSelectedIds(new Set());
        }}
      />
      <BulkTagModal
        isOpen={bulkAction === 'tag'}
        selectedCount={selectedIds.size}
        allTags={allTags}
        onClose={() => setBulkAction(null)}
        onConfirm={(tags) => {
          setNodes(prev => prev.map(n => {
            if (!selectedIds.has(n.id) || n.type === 'folder') return n;
            const newTags = Array.from(new Set([...(n.tags || []), ...tags]));
            return { ...n, tags: newTags };
          }));
          activityLogger.log('bulk_tag', `${selectedIds.size} document(s)`, user?.fullName ?? 'Utilisateur', `Tags appliqués: ${tags.join(', ')}`);
          toast.success(`Tags appliqués à ${selectedIds.size} document(s)`);
          setSelectedIds(new Set());
        }}
      />
      <MoveToFolderModal
        isOpen={bulkAction === 'move'}
        selectedCount={selectedIds.size}
        folders={nodes.filter(n => n.type === 'folder' && !n.deleted && !selectedIds.has(n.id))}
        onClose={() => setBulkAction(null)}
        onConfirm={(folderId) => {
          setNodes(prev => prev.map(n => selectedIds.has(n.id) ? { ...n, parentId: folderId } : n));
          activityLogger.log('bulk_move', `${selectedIds.size} document(s)`, user?.fullName ?? 'Utilisateur', `Déplacés vers le dossier`);
          toast.success(`${selectedIds.size} document(s) déplacé(s)`);
          setSelectedIds(new Set());
        }}
      />
    </>
  );
}
