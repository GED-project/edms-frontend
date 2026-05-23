import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, Filter, MoreVertical, Eye, Download, Trash2, FileText,
  FileSpreadsheet, FileImage, File, ChevronLeft, ChevronRight,
  SortAsc, SortDesc, Folder, RotateCcw, Trash,
  LayoutGrid, List, Library, Clock, Plus, X, AlertTriangle, Upload, FolderPlus, Home,
  Edit3, Send, CheckCircle2, Archive as ArchiveIcon, Lock, FilePlus,
  Share2, UserPlus, Globe, Camera, ChevronDown, FolderOpen,
  Tag, SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { Permission, Role } from '@/lib/auth-rbac/roles';
import { useDocuments } from './useDocuments';
import { DocumentDto, DocumentState } from './document.service';
import {
  submitForReview as submitForReviewApi,
  approveDocument as approveDocumentApi,
  archiveDocument as archiveDocumentApi,
  downloadOcrFile as downloadOcrFileApi,
} from './document.service';
import {
  getLibraries, createLibrary, deleteLibrary,
  getLibraryAccess, grantLibraryAccess, grantLibraryAccessByTag, revokeLibraryAccess,
  type LibraryDto, type LibraryAccessDto,
} from '../libraries/library.service';
import {
  getLibraryTemplates,
  buildLibraryFromTemplate,
  parseFolderStructure,
  type LibraryTemplateLookupDto,
  type FolderNode,
} from '../libraries/library-template.service';
import { getAllTags, getShareableUsers, type ShareableUserDto } from '@/features/admin/admin.service';
import { getAllDocumentTags } from './document.service';
import { getFolders, createFolder, type FolderDto } from './folder.service';
import {
  getDocumentTemplates,
  getTemplateMetadata,
  instantiateDocument,
  type DocumentTemplateLookupDto,
} from './document-template.service';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { toast } from 'sonner';

const PAGE_SIZE = 8;

// ─── Type Icons ───────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  folder: Folder,
  pdf: FileText,
  excel: FileSpreadsheet,
  image: FileImage,
  other: File,
};

const TYPE_COLOR: Record<string, string> = {
  folder: 'text-blue-500 bg-blue-500/10',
  pdf: 'text-red-500 bg-red-500/10',
  excel: 'text-emerald-500 bg-emerald-500/10',
  image: 'text-purple-500 bg-purple-500/10',
  other: 'text-zinc-500 bg-zinc-500/10',
};

// ─── Status Map ───────────────────────────────────────────────────────────────

const STATUS_MAP: Record<DocumentState, { label: string; cls: string }> = {
  [DocumentState.Draft]: { label: 'Brouillon', cls: 'bg-zinc-500/10 text-zinc-500' },
  [DocumentState.Review]: { label: 'En attente d\'approbation', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  [DocumentState.Approved]: { label: 'Approuvé', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  [DocumentState.Archived]: { label: 'Archivé', cls: 'bg-zinc-500/10 text-zinc-500' },
  [DocumentState.Trash]: { label: 'Corbeille', cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

// ─── Folder Tree Preview ──────────────────────────────────────────────────────

function FolderTree({ nodes, depth = 0 }: { nodes: FolderNode[]; depth?: number }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className={depth === 0 ? 'space-y-0.5' : 'ml-3 mt-0.5 space-y-0.5'}>
      {nodes.map((node, i) => {
        const key = `${depth}-${i}-${node.name}`;
        const isOpen = expanded.has(key);
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  isOpen ? next.delete(key) : next.add(key);
                  return next;
                })
              }
              className="flex items-center gap-1.5 text-xs text-foreground hover:text-primary transition-colors w-full text-left py-0.5"
            >
              {node.children?.length > 0
                ? isOpen
                  ? <ChevronDown className="h-3 w-3 shrink-0" />
                  : <ChevronRight className="h-3 w-3 shrink-0" />
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

// ─── Smart metadata field type detector ───────────────────────────────────────

function getMetaFieldType(key: string, value: unknown): 'checkbox' | 'number' | 'date' | 'textarea' | 'text' {
  if (typeof value === 'boolean') return 'checkbox';
  if (typeof value === 'number') return 'number';
  if (key.toLowerCase().includes('date')) return 'date';
  if (typeof value === 'string' && value.length > 100) return 'textarea';
  return 'text';
}

// ─── Helper to get file extension from title ──────────────────────────────────

function getExtensionFromTitle(title: string): string {
  const parts = title.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toUpperCase();
  }
  return 'DOC';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DocumentsPageConnected() {
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL structure:
  //   /documents              → root (libraries)
  //   /documents?lib=LIB_ID   → inside a library (root folders)
  //   /documents?lib=LIB_ID&folder=FOLDER_ID  → inside a specific folder
  const libId    = searchParams.get('lib');
  const folderId = searchParams.get('folder');
  const showTrash = searchParams.get('trash') === 'true';

  const isRootView      = !libId && !showTrash;
  const isInsideLibrary = !!libId && !folderId && !showTrash;
  const isInsideFolder  = !!libId && !!folderId && !showTrash;
  
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('q') ?? '');
  const [page, setPage] = useState(1);
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<'OR' | 'AND'>('OR');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showTagsPanel, setShowTagsPanel] = useState(false);
  const [allTagsList, setAllTagsList] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  
  // Libraries state
  const [libraries, setLibraries] = useState<LibraryDto[]>([]);
  const [librariesLoading, setLibrariesLoading] = useState(false);

  // Folders state (shown inside a library or folder)
  const [folders, setFolders] = useState<FolderDto[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  
  // Library modals
  const [showCreateLibraryModal, setShowCreateLibraryModal] = useState(false);
  const [libraryName, setLibraryName] = useState('');
  const [libraryDescription, setLibraryDescription] = useState('');
  const [libraryIsPublic, setLibraryIsPublic] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [submittingLibrary, setSubmittingLibrary] = useState(false);
  const [libraryToDelete, setLibraryToDelete] = useState<LibraryDto | null>(null);
  const [libraryCreateMode, setLibraryCreateMode] = useState<'manual' | 'template'>('manual');
  const [libraryTemplates, setLibraryTemplates] = useState<LibraryTemplateLookupDto[]>([]);
  const [libraryTemplatesLoading, setLibraryTemplatesLoading] = useState(false);
  const [selectedLibraryTemplateId, setSelectedLibraryTemplateId] = useState('');

  // Share modal state
  const [libraryToShare, setLibraryToShare] = useState<LibraryDto | null>(null);
  const [accessList, setAccessList] = useState<LibraryAccessDto[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<ShareableUserDto[]>([]);
  const [usersListUnavailable, setUsersListUnavailable] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [shareMode, setShareMode] = useState<'users' | 'tag'>('users');
  const [tagInput, setTagInput] = useState('');
  const [tagOptions, setTagOptions] = useState<string[]>([]);

  // Add menu state
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Document template modal state
  const [showTemplateDocModal, setShowTemplateDocModal] = useState(false);
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplateLookupDto[]>([]);
  const [documentTemplatesLoading, setDocumentTemplatesLoading] = useState(false);
  const [selectedDocumentTemplateId, setSelectedDocumentTemplateId] = useState('');
  const [templateMetadata, setTemplateMetadata] = useState<Record<string, unknown>>({});
  const [templateDocTitle, setTemplateDocTitle] = useState('');
  const [templateDocDescription, setTemplateDocDescription] = useState('');
  const [submittingTemplateDoc, setSubmittingTemplateDoc] = useState(false);
  
  // Folder creation modal
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderError, setFolderError] = useState('');
  const [submittingFolder, setSubmittingFolder] = useState(false);

  const canDelete = hasPermission(Permission.MANAGE_DOCUMENTS);
  const canManage = hasPermission(Permission.MANAGE_DOCUMENTS);
  const canCreate = hasPermission(Permission.CREATE_FOLDER);
  const userRole = (user?.role || '').toLowerCase();
  const canCreateLibrary = userRole === 'admin' || userRole === 'manager';
  const isAdmin = (user?.role ?? '').toLowerCase() === Role.ADMIN;
  const isManager = (user?.role ?? '').toLowerCase() === Role.MANAGER;
  const getLibraryOwnerId = (lib?: LibraryDto | null): string | undefined => {
    if (!lib) return undefined;
    const withPascalCase = lib as LibraryDto & { CreatorId?: string };
    return lib.creatorId ?? withPascalCase.CreatorId;
  };
  const canShare = (lib: LibraryDto) => {
    if (isAdmin || isManager) return true;
    const ownerId = getLibraryOwnerId(lib);
    if (!user?.id || !ownerId) return false;
    return ownerId.toLowerCase() === user.id.toLowerCase();
  };

  async function openShareModal(lib: LibraryDto) {
    setLibraryToShare(lib);
    setUserSearch('');
    setShareMode('users');
    setTagInput('');
    setUsersListUnavailable(false);
    setAccessLoading(true);
    try {
      const [acl, usersResp, tags] = await Promise.all([
        getLibraryAccess(lib.id),
        getShareableUsers(),
        getAllTags(),
      ]);
      setAccessList(acl);
      setAllUsers(usersResp);
      setTagOptions(tags);
      setUsersListUnavailable(false);
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

  async function handleGrantAccessByTag() {
    if (!libraryToShare) return;
    const normalizedTag = tagInput.trim().toLowerCase();
    if (!normalizedTag) {
      toast.error('Saisissez une étiquette');
      return;
    }
    try {
      const newEntries = await grantLibraryAccessByTag(libraryToShare.id, normalizedTag);
      setAccessList((prev) => {
        const byUserId = new Map(prev.map((entry) => [entry.userId, entry]));
        newEntries.forEach((entry) => byUserId.set(entry.userId, entry));
        return Array.from(byUserId.values()).sort((a, b) => a.userName.localeCompare(b.userName));
      });
      setTagInput('');
      toast.success('Accès accordé par étiquette');
    } catch {
      toast.error("Échec du partage par étiquette");
    }
  }

  async function handleRevokeAccess(entry: LibraryAccessDto) {
    if (!libraryToShare) return;
    const ownerId = getLibraryOwnerId(libraryToShare);
    if (ownerId === entry.userId) {
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

  // Fetch libraries when at root view
  useEffect(() => {
    if (isRootView && !debouncedSearch) {
      loadLibraries();
    }
  }, [isRootView, debouncedSearch]);

  // Fetch folders when inside a library or folder
  useEffect(() => {
    if (libId && !showTrash && !debouncedSearch) {
      loadFolders();
    } else {
      setFolders([]);
    }
  }, [libId, folderId, showTrash, debouncedSearch]);

  async function loadLibraries() {
    try {
      setLibrariesLoading(true);
      const data = await getLibraries();
      const filtered = isManager && user?.id
        ? data.filter((lib) => {
            const ownerId = getLibraryOwnerId(lib);
            return ownerId?.toLowerCase() === user.id.toLowerCase();
          })
        : data;
      setLibraries(filtered);
    } catch (err) {
      console.error('Failed to load libraries:', err);
    } finally {
      setLibrariesLoading(false);
    }
  }

  useEffect(() => {
    if (!isManager || !libId || librariesLoading) return;
    const canAccessLibrary = libraries.some((lib) => lib.id === libId);
    if (!canAccessLibrary) {
      toast.error('En tant que manager, vous pouvez modifier uniquement vos bibliotheques.');
      navigate('/documents', { replace: true });
    }
  }, [isManager, libId, librariesLoading, libraries, navigate]);

  async function loadFolders() {
    if (!libId) return;
    try {
      setFoldersLoading(true);
      const data = await getFolders(libId, folderId ?? undefined);
      setFolders(data);
    } catch (err) {
      console.error('Failed to load folders:', err);
      setFolders([]);
    } finally {
      setFoldersLoading(false);
    }
  }

  async function handleCreateLibrary(e: React.FormEvent) {
    e.preventDefault();

    if (libraryCreateMode === 'template') {
      if (!selectedLibraryTemplateId) {
        setLibraryError('Veuillez sélectionner un modèle de bibliothèque');
        return;
      }

      try {
        setSubmittingLibrary(true);
        await buildLibraryFromTemplate(selectedLibraryTemplateId);
        toast.success('Bibliothèque créée depuis le modèle');
        setShowCreateLibraryModal(false);
        setLibraryCreateMode('manual');
        setSelectedLibraryTemplateId('');
        setLibraryError('');
        loadLibraries();
      } catch {
        toast.error('Échec de la création depuis le modèle');
      } finally {
        setSubmittingLibrary(false);
      }

      return;
    }

    const trimmed = libraryName.trim();

    if (!trimmed) {
      setLibraryError('Le nom de la bibliothèque ne peut pas être vide');
      return;
    }

    if (libraries.some(lib => lib.name.toLowerCase() === trimmed.toLowerCase())) {
      setLibraryError('Une bibliothèque avec ce nom existe déjà');
      return;
    }

    try {
      setSubmittingLibrary(true);
      await createLibrary({ name: trimmed, description: libraryDescription.trim() || undefined, isPublic: libraryIsPublic });
      toast.success('Bibliothèque créée avec succès');
      setShowCreateLibraryModal(false);
      setLibraryName('');
      setLibraryDescription('');
      setLibraryIsPublic(false);
      setLibraryError('');
      setLibraryCreateMode('manual');
      setSelectedLibraryTemplateId('');
      loadLibraries();
    } catch (error) {
      toast.error('Échec de la création de la bibliothèque');
    } finally {
      setSubmittingLibrary(false);
    }
  }

  async function handleDeleteLibrary() {
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

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = folderName.trim();

    if (!trimmed) {
      setFolderError('Le nom du dossier ne peut pas être vide');
      return;
    }

    if (!libId) {
      setFolderError('Bibliothèque introuvable');
      return;
    }

    try {
      setSubmittingFolder(true);
      await createFolder({
        name: trimmed,
        libraryId: libId,
        parentFolderId: folderId ?? undefined,
      });
      toast.success(`Dossier "${trimmed}" créé avec succès`);
      setShowCreateFolderModal(false);
      setFolderName('');
      setFolderError('');
      loadFolders();
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || 'Échec de la création du dossier';
      toast.error(message);
    } finally {
      setSubmittingFolder(false);
    }
  }

  async function openTemplateDocumentModal() {
    setShowTemplateDocModal(true);
    setTemplateDocTitle('');
    setTemplateDocDescription('');
    setTemplateMetadata({});
    setSelectedDocumentTemplateId('');
    setDocumentTemplatesLoading(true);
    try {
      const templates = await getDocumentTemplates();
      setDocumentTemplates(templates);
      if (templates.length > 0) {
        setSelectedDocumentTemplateId(templates[0].id);
      }
    } catch {
      toast.error('Impossible de charger les modèles de document');
      setShowTemplateDocModal(false);
    } finally {
      setDocumentTemplatesLoading(false);
    }
  }

  async function loadTemplateMetadata(templateId: string) {
    if (!templateId) {
      setTemplateMetadata({});
      return;
    }

    try {
      const response = await getTemplateMetadata(templateId);
      const raw = response.metadata;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        setTemplateMetadata(raw as Record<string, unknown>);
      } else {
        setTemplateMetadata({});
      }
    } catch {
      setTemplateMetadata({});
      toast.error('Impossible de charger les métadonnées du modèle');
    }
  }

  async function handleInstantiateTemplateDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDocumentTemplateId) {
      toast.error('Veuillez sélectionner un modèle de document');
      return;
    }

    try {
      setSubmittingTemplateDoc(true);
      await instantiateDocument({
        templateId: selectedDocumentTemplateId,
        title: templateDocTitle.trim() || undefined,
        description: templateDocDescription.trim() || undefined,
        folderId: folderId ?? undefined,
        libraryId: libId ?? undefined,
        formData: templateMetadata,
      });

      toast.success('Document créé depuis le modèle');
      setShowTemplateDocModal(false);
      await refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Échec de création du document depuis le modèle');
    } finally {
      setSubmittingTemplateDoc(false);
    }
  }

  useEffect(() => {
    if (!showCreateLibraryModal || libraryCreateMode !== 'template') {
      return;
    }

    setLibraryTemplatesLoading(true);
    getLibraryTemplates()
      .then((items) => {
        setLibraryTemplates(items);
        if (!selectedLibraryTemplateId && items.length > 0) {
          setSelectedLibraryTemplateId(items[0].id);
        }
      })
      .catch(() => {
        toast.error('Impossible de charger les modèles de bibliothèque');
      })
      .finally(() => setLibraryTemplatesLoading(false));
  }, [showCreateLibraryModal, libraryCreateMode, selectedLibraryTemplateId]);

  useEffect(() => {
    if (selectedDocumentTemplateId) {
      loadTemplateMetadata(selectedDocumentTemplateId);
    }
  }, [selectedDocumentTemplateId]);

  // Load all tags once on mount
  useEffect(() => {
    getAllDocumentTags().then(setAllTagsList).catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Sync ?q= param
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setSearch(q);
    setDebouncedSearch(q);
  }, [searchParams]);

  // Fetch documents from API
  const {
    documents,
    trashItems,
    totalCount,
    isLoading,
    error,
    moveToTrash,
    restoreFromTrash,
    hardDelete,
    downloadDocument,
    renameDocument,
    refetch,
  } = useDocuments({
    folderId: folderId,
    libId: libId,
    showTrash,
    searchQuery: debouncedSearch,
    skipCount: (page - 1) * PAGE_SIZE,
    maxResultCount: PAGE_SIZE,
    sorting: sortAsc ? 'creationTime' : 'creationTime desc',
    selectedTags: selectedTags.length > 0 ? selectedTags : undefined,
    tagMode,
    statusFilter: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const items = showTrash ? trashItems : documents;

  // File type is client-side only (not a backend filter); all other filters are server-side.
  const filteredItems = fileTypeFilter
    ? items.filter((doc) => {
        const ext = doc.title.split('.').pop()?.toLowerCase() ?? '';
        if (fileTypeFilter === 'pdf') return ext === 'pdf';
        if (fileTypeFilter === 'excel') return ['xls', 'xlsx'].includes(ext);
        if (fileTypeFilter === 'image') return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
        if (fileTypeFilter === 'other') return !['pdf', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
        return true;
      })
    : items;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hideDocumentListAtLibraryRoot = isInsideLibrary && !debouncedSearch && folders.length > 0;

  const canSubmitForReview = (doc: DocumentDto) => {
    if (doc.state !== DocumentState.Draft) return false;
    if (!user?.id || !doc.creatorId) return false;
    return doc.creatorId.toLowerCase() === user.id.toLowerCase();
  };

  const canArchiveDocument = (doc: DocumentDto) => {
    return doc.state === DocumentState.Approved && hasPermission(Permission.APPROVE_DOCUMENT);
  };

  // Handlers
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleDownload = async (doc: DocumentDto) => {
    const filename = `${doc.title}.${getExtensionFromTitle(doc.title).toLowerCase()}`;
    await downloadDocument(doc.id, filename);
  };

  const handleDownloadOcr = async (doc: DocumentDto) => {
    try {
      await downloadOcrFileApi(doc.id, `${doc.title}_ocr.txt`);
      toast.success(`OCR téléchargé pour ${doc.title}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'OCR indisponible pour ce document');
    }
  };

  const handleMoveToTrash = async (doc: DocumentDto) => {
    if (confirm(`Déplacer "${doc.title}" vers la corbeille ?`)) {
      await moveToTrash(doc.id);
    }
  };

  const handleRestore = async (doc: DocumentDto) => {
    await restoreFromTrash(doc.id);
  };

  const handleHardDelete = async (doc: DocumentDto) => {
    if (confirm(`Supprimer définitivement "${doc.title}" ? Cette action est irréversible.`)) {
      await hardDelete(doc.id);
    }
  };

  const handleRename = async (doc: DocumentDto) => {
    const newName = prompt('Nouveau nom du document :', doc.title);
    if (!newName || newName.trim() === '' || newName === doc.title) return;
    await renameDocument(doc.id, newName.trim());
  };

  const handleSubmitForReview = async (doc: DocumentDto) => {
    try {
      await submitForReviewApi(doc.id);
      toast.success(`"${doc.title}" est en attente d'approbation`);
      await refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Erreur lors de la soumission');
    }
  };

  const handleApprove = async (doc: DocumentDto) => {
    try {
      await approveDocumentApi(doc.id);
      toast.success(`"${doc.title}" approuvé`);
      await refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Erreur lors de l\'approbation');
    }
  };

  const handleArchive = async (doc: DocumentDto) => {
    if (!confirm(`Archiver "${doc.title}" ?`)) return;
    try {
      await archiveDocumentApi(doc.id);
      toast.success(`"${doc.title}" archivé`);
      await refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Erreur lors de l\'archivage');
    }
  };

  const setShowTrash = (val: boolean) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set('trash', 'true');
      else next.delete('trash');
      return next;
    });
  };

  // Navigate into a folder
  const enterFolder = (folder: FolderDto) => {
    if (libId) {
      navigate(`/documents?lib=${libId}&folder=${folder.id}`);
    }
  };

  return (
    <>
      <Helmet>
        <title>Documents — ItDoc</title>
      </Helmet>

      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Breadcrumb - show when inside a library or folder */}
        {(isInsideLibrary || isInsideFolder) && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground overflow-x-auto pb-1">
            <button
              onClick={() => navigate('/documents')}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors shrink-0"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Document Library</span>
            </button>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
            <button
              onClick={() => libId && navigate(`/documents?lib=${libId}`)}
              className={`font-semibold truncate ${isInsideFolder ? 'hover:text-foreground transition-colors' : 'text-foreground'}`}
            >
              {libraries.find(lib => lib.id === libId)?.name || 'Bibliothèque'}
            </button>
            {isInsideFolder && folders.length === 0 && (
              <>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
                <span className="font-semibold text-foreground truncate">Dossier</span>
              </>
            )}
          </div>
        )}
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {showTrash ? 'Corbeille' : isRootView ? 'Document Library' : 'Documents'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRootView && !debouncedSearch
                ? `${libraries.length} bibliothèque(s)`
                : isLoading
                ? 'Chargement...'
                : `${folders.length > 0 ? `${folders.length} dossier(s) · ` : ''}${totalCount} document(s)`}
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
            {!showTrash && (
              <div className="flex items-center rounded-lg border border-input bg-background p-0.5">
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                    viewMode === 'table' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                    viewMode === 'grid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            )}
            {isRootView && canCreateLibrary && (
              <Button
                onClick={() => setShowCreateLibraryModal(true)}
                variant="primary"
                size="md"
              >
                <Plus className="h-4 w-4" />
                Nouvelle bibliothèque
              </Button>
            )}
            {(isInsideLibrary || isInsideFolder) && canCreate && (
              <div className="relative">
                <Button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  variant="primary"
                  size="md"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter
                </Button>
                {showAddMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowAddMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-xl border border-border bg-popover shadow-xl py-1 animate-in fade-in-0 zoom-in-95">
                      <button
                        onClick={() => {
                          setShowAddMenu(false);
                          navigate(`/documents/upload?lib=${libId}${folderId ? `&folder=${folderId}` : ''}`);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-foreground"
                      >
                        <Upload className="h-4 w-4 text-primary" />
                        <div className="text-left">
                          <div className="font-medium">Téléverser un document</div>
                          <div className="text-xs text-muted-foreground">Ajouter un fichier</div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setShowAddMenu(false);
                          openTemplateDocumentModal();
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-foreground"
                      >
                        <FilePlus className="h-4 w-4 text-emerald-500" />
                        <div className="text-left">
                          <div className="font-medium">Créer depuis un modèle</div>
                          <div className="text-xs text-muted-foreground">Document prérempli</div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setShowAddMenu(false);
                          navigate(`/documents/scan?lib=${libId}${folderId ? `&folder=${folderId}` : ''}`);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-foreground"
                      >
                        <Camera className="h-4 w-4 text-orange-500" />
                        <div className="text-left">
                          <div className="font-medium">Numériser un document</div>
                          <div className="text-xs text-muted-foreground">Scanner ou photographier</div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setShowAddMenu(false);
                          setShowCreateFolderModal(true);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-foreground"
                      >
                        <FolderPlus className="h-4 w-4 text-blue-500" />
                        <div className="text-left">
                          <div className="font-medium">Nouveau dossier</div>
                          <div className="text-xs text-muted-foreground">Organiser les documents</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Filter Toolbar ── */}
        {!showTrash && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search — always visible so users can search from root view too */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={isRootView ? 'Rechercher une bibliothèque par nom...' : 'Rechercher par nom, contenu, métadonnées...'}
                  className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/70"
                />
              </div>
              {!isRootView && <Filter className="h-4 w-4 text-muted-foreground shrink-0" />}
              {/* Advanced filters — only relevant inside a library */}
              {!isRootView && <>
              {/* Status filter */}
              <CustomSelect
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); setPage(1); }}
                options={[
                  { value: '', label: 'Tous les statuts' },
                  { value: 'Draft', label: 'Brouillon' },
                  { value: 'Review', label: 'En attente' },
                  { value: 'Approved', label: 'Approuvé' },
                  { value: 'Archived', label: 'Archivé' },
                ]}
              />
              {/* File type filter */}
              <CustomSelect
                value={fileTypeFilter}
                onChange={(v) => { setFileTypeFilter(v); setPage(1); }}
                options={[
                  { value: '', label: 'Tous les types' },
                  { value: 'pdf', label: 'PDF' },
                  { value: 'excel', label: 'Excel' },
                  { value: 'image', label: 'Image' },
                  { value: 'other', label: 'Autre' },
                ]}
              />
              {/* Tags toggle */}
              <button
                onClick={() => setShowTagsPanel(v => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showTagsPanel || selectedTags.length > 0 ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-background text-foreground hover:bg-accent'}`}
              >
                <Tag className="h-4 w-4" />
                Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
              </button>
              {/* Filters toggle */}
              <button
                onClick={() => setShowFiltersPanel(v => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showFiltersPanel || dateFrom || dateTo ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-background text-foreground hover:bg-accent'}`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtres {showFiltersPanel ? '▲' : '▼'}
              </button>
              {/* Clear filters */}
              {(statusFilter || fileTypeFilter || selectedTags.length > 0 || dateFrom || dateTo) && (
                <button
                  onClick={() => { setStatusFilter(''); setFileTypeFilter(''); setSelectedTags([]); setDateFrom(''); setDateTo(''); setPage(1); }}
                  className="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                >
                  <X className="h-3 w-3" /> Effacer
                </button>
              )}
              </>}
              {/* Sort — always visible */}
              <button
                onClick={() => { setSortAsc(v => !v); setPage(1); }}
                className="flex items-center gap-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                title="Inverser le tri"
              >
                {sortAsc ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </button>
            </div>

            {/* Advanced filters panel */}
            {!isRootView && showFiltersPanel && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" /> Filtres avancés
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Date depuis</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Date jusqu'au</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Type de fichier</label>
                    <CustomSelect
                      value={fileTypeFilter}
                      onChange={(v) => { setFileTypeFilter(v); setPage(1); }}
                      options={[
                        { value: '', label: 'Tous les types' },
                        { value: 'pdf', label: 'PDF' },
                        { value: 'excel', label: 'Excel' },
                        { value: 'image', label: 'Image' },
                        { value: 'other', label: 'Autre' },
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Taille du fichier</label>
                    <select className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                      <option>Toutes les tailles</option>
                      <option value="small">{'< 1 MB'}</option>
                      <option value="medium">1 MB – 10 MB</option>
                      <option value="large">{'> 10 MB'}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Tags filter panel */}
            {!isRootView && showTagsPanel && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Tag className="h-4 w-4" /> Filtrer par tags
                  </p>
                  <div className="flex items-center gap-1 rounded-lg border border-border overflow-hidden text-xs font-semibold">
                    <button onClick={() => setTagMode('OR')}
                      className={`px-3 py-1 transition-colors ${tagMode === 'OR' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent'}`}>
                      OU
                    </button>
                    <button onClick={() => setTagMode('AND')}
                      className={`px-3 py-1 transition-colors ${tagMode === 'AND' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent'}`}>
                      ET
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allTagsList.map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        setSelectedTags(prev =>
                          prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                        );
                        setPage(1);
                      }}
                      className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selectedTags.includes(tag)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      }`}
                    >
                      <Tag className="h-3 w-3" /> {tag}
                    </button>
                  ))}
                  {allTagsList.length === 0 && (
                    <p className="text-xs text-muted-foreground">Aucun tag disponible</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Library Root View - Grid of Libraries (only shown when no search query) */}
        {isRootView && !debouncedSearch ? (
          <div>
            {librariesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : libraries.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-2xl bg-card">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Library className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Aucune bibliothèque</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {canCreateLibrary
                    ? 'Créez votre première bibliothèque pour commencer à organiser vos documents.'
                    : 'Aucune bibliothèque disponible pour le moment.'}
                </p>
                {canCreateLibrary && (
                  <Button
                    onClick={() => setShowCreateLibraryModal(true)}
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
                    <div
                      onClick={() => navigate(`/documents?lib=${lib.id}`)}
                      className="cursor-pointer"
                    >
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
                              onClick={(e) => { e.stopPropagation(); openShareModal(lib); }}
                              className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                              title="Partager"
                            >
                              <Share2 className="h-4 w-4" />
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setLibraryToDelete(lib); }}
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
        ) : (
          <>
            {/* Folders display — shown above documents when inside a library or folder */}
            {(isInsideLibrary || isInsideFolder) && !debouncedSearch && (
              <div>
                {foldersLoading ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Chargement des dossiers...
                  </div>
                ) : folders.length > 0 ? (
                  viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                      {folders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => enterFolder(folder)}
                          className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:bg-accent transition-all group text-left"
                        >
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                            <Folder className="h-8 w-8" />
                          </div>
                          <span className="text-xs font-medium text-foreground truncate w-full text-center" title={folder.name}>
                            {folder.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-card mb-4 overflow-hidden">
                      {folders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => enterFolder(folder)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors border-b last:border-b-0 border-border"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                            <Folder className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium text-foreground truncate" title={folder.name}>
                            {folder.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )
                ) : null}
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            )}

        {/* Table View */}
        {!isLoading && viewMode === 'table' && !hideDocumentListAtLibraryRoot && (
          <div className="rounded-xl border border-border bg-card">
            <div className="w-full overflow-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Date</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-foreground">Aucun document</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {statusFilter || fileTypeFilter || selectedTags.length > 0 || dateFrom || dateTo
                              ? 'Aucun document ne correspond aux filtres sélectionnés.'
                              : isInsideFolder
                              ? 'Aucun document dans ce dossier.'
                              : isInsideLibrary
                              ? 'Ouvrez un dossier pour afficher les documents.'
                              : 'Aucun document trouvé.'}
                          </p>
                          {(isInsideLibrary || isInsideFolder) && canCreate && (
                            <Button
                              onClick={() => navigate(`/documents/upload?lib=${libId}${folderId ? `&folder=${folderId}` : ''}`)}
                              variant="primary"
                              size="sm"
                              className="mt-4"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Téléverser un document
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((doc) => {
                      const Icon = TYPE_ICON['pdf'] || FileText;
                      const status = STATUS_MAP[doc.state];
                      return (
                        <tr key={doc.id} className="hover:bg-accent/30 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TYPE_COLOR['pdf']}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <button
                                  onClick={() => navigate(`/documents/${doc.id}`, { state: { doc } })}
                                  className="font-medium text-foreground hover:text-primary hover:underline truncate max-w-[180px] block text-left"
                                >
                                  {doc.title}
                                </button>
                                <p className="text-[11px] text-muted-foreground">
                                  {getExtensionFromTitle(doc.title)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status.cls}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {(() => {
                              const lvl = doc.clearanceLevel as unknown as number;
                              const cfg = lvl === 2
                                ? { label: 'Confidentiel', cls: 'bg-red-500/10 text-red-600 dark:text-red-400' }
                                : lvl === 1
                                ? { label: 'Interne',      cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' }
                                : { label: 'Public',       cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
                              return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cfg.cls}`}>{cfg.label}</span>;
                            })()}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                            {new Date(doc.creationTime).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-4 py-3 relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openMenuId === doc.id && (
                              <div className="absolute right-8 top-0 z-50 min-w-[160px] rounded-xl border border-border bg-popover shadow-xl py-1">
                                <button
                                  onClick={() => { handleDownload(doc); setOpenMenuId(null); }}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-foreground"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Télécharger
                                </button>
                                <button
                                  onClick={() => { handleDownloadOcr(doc); setOpenMenuId(null); }}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-foreground"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  Télécharger OCR (.txt)
                                </button>
                                {showTrash ? (
                                  <>
                                    <button
                                      onClick={() => { handleRestore(doc); setOpenMenuId(null); }}
                                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-primary"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      Restaurer
                                    </button>
                                    {canDelete && (
                                      <button
                                        onClick={() => { handleHardDelete(doc); setOpenMenuId(null); }}
                                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-red-500"
                                      >
                                        <Trash className="h-3.5 w-3.5" />
                                        Supprimer définitivement
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => { navigate(`/documents/${doc.id}`, { state: { doc } }); setOpenMenuId(null); }}
                                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-foreground"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Consulter
                                    </button>
                                    <button
                                      onClick={() => { handleRename(doc); setOpenMenuId(null); }}
                                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-foreground"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                      Renommer
                                    </button>
                                    {canSubmitForReview(doc) && (
                                      <button
                                        onClick={() => { handleSubmitForReview(doc); setOpenMenuId(null); }}
                                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-foreground"
                                      >
                                        <Send className="h-3.5 w-3.5" />
                                        Soumettre pour révision
                                      </button>
                                    )}
                                    {doc.state === DocumentState.Review && hasPermission(Permission.APPROVE_DOCUMENT) && (
                                      <button
                                        onClick={() => { handleApprove(doc); setOpenMenuId(null); }}
                                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-emerald-600"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Approuver
                                      </button>
                                    )}
                                    {canArchiveDocument(doc) && (
                                      <button
                                        onClick={() => { handleArchive(doc); setOpenMenuId(null); }}
                                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-foreground"
                                      >
                                        <ArchiveIcon className="h-3.5 w-3.5" />
                                        Archiver
                                      </button>
                                    )}
                                    {canDelete && (
                                      <button
                                        onClick={() => { handleMoveToTrash(doc); setOpenMenuId(null); }}
                                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-red-500"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Supprimer
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
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
        )}

        {/* Grid View */}
        {!isLoading && viewMode === 'grid' && !hideDocumentListAtLibraryRoot && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-16 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl bg-card">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Aucun document</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {statusFilter || fileTypeFilter || selectedTags.length > 0 || dateFrom || dateTo
                    ? 'Aucun document ne correspond aux filtres sélectionnés.'
                    : isInsideFolder
                    ? 'Aucun document dans ce dossier.'
                    : isInsideLibrary
                    ? 'Ouvrez un dossier pour afficher les documents.'
                    : 'Aucun document trouvé.'}
                </p>
                {(isInsideLibrary || isInsideFolder) && canCreate && (
                  <div className="flex gap-2 mt-6">
                    <Button
                      onClick={() => navigate(`/documents/upload?lib=${libId}${folderId ? `&folder=${folderId}` : ''}`)}
                      variant="primary"
                      size="md"
                    >
                      <Upload className="h-4 w-4" />
                      Téléverser
                    </Button>
                    <Button
                      onClick={() => setShowCreateFolderModal(true)}
                      variant="outline"
                      size="md"
                    >
                      <FolderPlus className="h-4 w-4" />
                      Nouveau dossier
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              filteredItems.map((doc) => {
                const Icon = TYPE_ICON['pdf'] || FileText;
                const status = STATUS_MAP[doc.state];
                return (
                  <div
                    key={doc.id}
                    className="relative rounded-xl border border-border p-4 transition-all hover:shadow-md bg-card group"
                  >
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground bg-background/80 hover:bg-accent hover:text-foreground transition-colors backdrop-blur-sm shadow-sm"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-4 mb-3 flex justify-center">
                      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${TYPE_COLOR['pdf']} bg-opacity-20`}>
                        <Icon className="h-8 w-8" />
                      </div>
                    </div>
                    <div className="space-y-1 text-center">
                      <button
                        onClick={() => navigate(`/documents/${doc.id}`, { state: { doc } })}
                        className="font-semibold text-foreground hover:text-primary hover:underline truncate w-full"
                      >
                        {doc.title}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {getExtensionFromTitle(doc.title)}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${status.cls} truncate max-w-[50%]`}>
                        {status.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {new Date(doc.creationTime).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
          </>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-card rounded-xl">
            <p className="text-xs text-muted-foreground">
              Page {page} / {totalPages} — {totalCount} résultats
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
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
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Library Modal */}
      {showCreateLibraryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Library className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Nouvelle bibliothèque</h2>
              </div>
              <button
                onClick={() => {
                  setShowCreateLibraryModal(false);
                  setLibraryName('');
                  setLibraryDescription('');
                  setLibraryIsPublic(false);
                  setLibraryError('');
                  setLibraryCreateMode('manual');
                  setSelectedLibraryTemplateId('');
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateLibrary} className="p-5 space-y-4">
              <div>
                <p className="block text-sm font-medium text-foreground mb-2">Mode de création</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLibraryCreateMode('manual');
                      setLibraryError('');
                    }}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                      libraryCreateMode === 'manual'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    Manuel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLibraryCreateMode('template');
                      setLibraryError('');
                    }}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                      libraryCreateMode === 'template'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    Modèle
                  </button>
                </div>
              </div>

              {libraryCreateMode === 'template' && (
                <div className="space-y-2">
                  <label htmlFor="libraryTemplate" className="block text-sm font-medium text-foreground">
                    Modèle de bibliothèque
                  </label>
                  <select
                    id="libraryTemplate"
                    value={selectedLibraryTemplateId}
                    onChange={(e) => {
                      setSelectedLibraryTemplateId(e.target.value);
                      setLibraryError('');
                    }}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    disabled={libraryTemplatesLoading}
                  >
                    {libraryTemplates.length === 0 && <option value="">Aucun modèle disponible</option>}
                    {libraryTemplates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const tpl = libraryTemplates.find((t) => t.id === selectedLibraryTemplateId);
                    if (!tpl?.folderStructureJson) return null;
                    const nodes = parseFolderStructure(tpl.folderStructureJson);
                    if (nodes.length === 0) return null;
                    return (
                      <div className="rounded-lg border border-border bg-muted/30 p-3 max-h-48 overflow-y-auto">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Aperçu de la structure
                        </p>
                        <FolderTree nodes={nodes} />
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label htmlFor="libraryName" className="block text-sm font-medium text-foreground mb-1">
                  Nom de la bibliothèque
                </label>
                <Input
                  autoFocus
                  id="libraryName"
                  type="text"
                  value={libraryName}
                  onChange={(e) => { setLibraryName(e.target.value); setLibraryError(''); }}
                  placeholder="ex: Ressources Humaines"
                  variant="md"
                  disabled={libraryCreateMode === 'template'}
                />
                {libraryError && <p className="mt-1.5 text-xs font-medium text-red-500">{libraryError}</p>}
              </div>
              <div>
                <label htmlFor="libraryDescription" className="block text-sm font-medium text-foreground mb-1">
                  Description (optionnel)
                </label>
                <textarea
                  id="libraryDescription"
                  value={libraryDescription}
                  onChange={(e) => setLibraryDescription(e.target.value)}
                  placeholder="Décrivez l'objectif de cette bibliothèque..."
                  rows={3}
                  disabled={libraryCreateMode === 'template'}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/80"
                />
              </div>
              {/* Visibility toggle */}
              <div>
                <p className="block text-sm font-medium text-foreground mb-2">Visibilité</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLibraryIsPublic(false)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all ${
                      !libraryIsPublic
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <Lock className="h-4 w-4" /> Privée
                  </button>
                  <button
                    type="button"
                    onClick={() => setLibraryIsPublic(true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all ${
                      libraryIsPublic
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <Globe className="h-4 w-4" /> Publique
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {libraryIsPublic
                    ? 'Tous les utilisateurs connectés peuvent voir cette bibliothèque.'
                    : 'Seuls vous et les utilisateurs invités peuvent y accéder.'}
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setShowCreateLibraryModal(false);
                    setLibraryName('');
                    setLibraryDescription('');
                    setLibraryIsPublic(false);
                    setLibraryError('');
                    setLibraryCreateMode('manual');
                    setSelectedLibraryTemplateId('');
                  }}
                  variant="outline"
                  size="md"
                  disabled={submittingLibrary}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submittingLibrary}
                >
                  {submittingLibrary ? 'Création...' : libraryCreateMode === 'template' ? 'Créer depuis modèle' : 'Créer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Document From Template Modal */}
      {showTemplateDocModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <FilePlus className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Créer un document depuis un modèle</h2>
              </div>
              <button
                onClick={() => setShowTemplateDocModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInstantiateTemplateDocument} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Modèle</label>
                <select
                  value={selectedDocumentTemplateId}
                  onChange={(e) => setSelectedDocumentTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={documentTemplatesLoading}
                >
                  {documentTemplates.length === 0 && <option value="">Aucun modèle disponible</option>}
                  {documentTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Titre (optionnel)</label>
                <Input
                  value={templateDocTitle}
                  onChange={(e) => setTemplateDocTitle(e.target.value)}
                  placeholder="Si vide, le titre du modèle sera utilisé"
                  variant="md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description (optionnel)</label>
                <textarea
                  value={templateDocDescription}
                  onChange={(e) => setTemplateDocDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {Object.keys(templateMetadata).length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Métadonnées du modèle</p>
                  {Object.entries(templateMetadata).map(([key, value]) => {
                    const fieldType = getMetaFieldType(key, value);
                    return (
                      <div key={key}>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">{key}</label>
                        {fieldType === 'checkbox' ? (
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!value}
                              onChange={(e) =>
                                setTemplateMetadata((prev) => ({ ...prev, [key]: e.target.checked }))
                              }
                              className="h-4 w-4 rounded border-border accent-primary"
                            />
                            <span className="text-sm text-muted-foreground">{value ? 'Oui' : 'Non'}</span>
                          </label>
                        ) : fieldType === 'number' ? (
                          <Input
                            type="number"
                            value={value == null ? '' : String(value)}
                            onChange={(e) =>
                              setTemplateMetadata((prev) => ({
                                ...prev,
                                [key]: e.target.value === '' ? 0 : parseFloat(e.target.value),
                              }))
                            }
                            variant="md"
                          />
                        ) : fieldType === 'date' ? (
                          <Input
                            type="date"
                            value={value == null ? '' : String(value)}
                            onChange={(e) =>
                              setTemplateMetadata((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            variant="md"
                          />
                        ) : fieldType === 'textarea' ? (
                          <textarea
                            value={value == null ? '' : String(value)}
                            onChange={(e) =>
                              setTemplateMetadata((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            rows={3}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        ) : (
                          <Input
                            value={value == null ? '' : String(value)}
                            onChange={(e) =>
                              setTemplateMetadata((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            variant="md"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="md" onClick={() => setShowTemplateDocModal(false)} disabled={submittingTemplateDoc}>
                  Annuler
                </Button>
                <Button type="submit" variant="primary" size="md" disabled={submittingTemplateDoc || !selectedDocumentTemplateId}>
                  {submittingTemplateDoc ? 'Création...' : 'Créer le document'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Library Confirmation Modal */}
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
                  onClick={handleDeleteLibrary}
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

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Nouveau dossier</h2>
              </div>
              <button
                onClick={() => {
                  setShowCreateFolderModal(false);
                  setFolderName('');
                  setFolderError('');
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="p-5 space-y-4">
              <div>
                <label htmlFor="folderName" className="block text-sm font-medium text-foreground mb-1">
                  Nom du dossier
                </label>
                <Input
                  autoFocus
                  id="folderName"
                  type="text"
                  value={folderName}
                  onChange={(e) => { setFolderName(e.target.value); setFolderError(''); }}
                  placeholder="ex: Contrats 2025"
                  variant="md"
                />
                {folderError && <p className="mt-1.5 text-xs font-medium text-red-500">{folderError}</p>}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setShowCreateFolderModal(false);
                    setFolderName('');
                    setFolderError('');
                  }}
                  variant="outline"
                  size="md"
                  disabled={submittingFolder}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submittingFolder}
                >
                  {submittingFolder ? 'Création...' : 'Créer'}
                </Button>
              </div>
            </form>
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
                onClick={() => { setLibraryToShare(null); setAccessList([]); setUserSearch(''); setShareMode('users'); setTagInput(''); setTagOptions([]); setUsersListUnavailable(false); }}
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
                      const ownerId = getLibraryOwnerId(libraryToShare);
                      const isOwner = ownerId === entry.userId;
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
                  <div className="mb-3 flex items-center rounded-lg border border-border bg-muted/30 p-1">
                    <button
                      type="button"
                      onClick={() => setShareMode('users')}
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${shareMode === 'users' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Par utilisateur
                    </button>
                    <button
                      type="button"
                      onClick={() => setShareMode('tag')}
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${shareMode === 'tag' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Par étiquette
                    </button>
                  </div>

                  {shareMode === 'users' ? (
                    <>
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
                          if (usersListUnavailable) {
                            return (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                Liste des utilisateurs indisponible pour votre rôle. Utilisez "Par étiquette".
                              </p>
                            );
                          }

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
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-semibold text-foreground mb-3">
                        Partager par étiquette
                      </h3>
                      <div className="space-y-3">
                        <Input
                          type="text"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          placeholder="Ex. finance"
                          list="library-share-tag-options"
                          variant="md"
                        />
                        <datalist id="library-share-tag-options">
                          {tagOptions.map((tag) => (
                            <option key={tag} value={tag} />
                          ))}
                        </datalist>
                        <Button type="button" onClick={handleGrantAccessByTag} className="w-full">
                          Partager avec ce groupe
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Tous les utilisateurs portant cette étiquette recevront l'accès à la bibliothèque.
                        </p>
                      </div>
                      <div className="mt-4 flex-1 overflow-y-auto">
                        {tagOptions.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Aucune étiquette disponible.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {tagOptions.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => setTagInput(tag)}
                                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${tagInput.trim().toLowerCase() === tag.toLowerCase() ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
