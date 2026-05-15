import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import * as docService from './document.service';
import type { DocumentDto, TagDto, DocumentVersionDto, TrashItemDto } from './document.service';

export interface UseDocumentsOptions {
  folderId?: string | null;
  libId?: string | null;
  showTrash?: boolean;
  sharedOnly?: boolean;
  reviewOnly?: boolean;
  searchQuery?: string;
  statusFilter?: string;
  departmentFilter?: string;
  selectedTags?: string[];
  tagMode?: 'AND' | 'OR';
  skipCount?: number;
  maxResultCount?: number;
  sorting?: string;
}

export interface UseDocumentsResult {
  documents: DocumentDto[];
  trashItems: TrashItemDto[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createDocument: (input: docService.CreateDocumentInput, file: File) => Promise<DocumentDto | null>;
  deleteDocument: (id: string) => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  restoreFromTrash: (id: string) => Promise<void>;
  hardDelete: (id: string) => Promise<void>;
  renameDocument: (id: string, newName: string) => Promise<void>;
  moveDocument: (id: string, targetFolderId: string | null) => Promise<void>;
  addTag: (documentId: string, tagName: string) => Promise<TagDto | null>;
  removeTag: (documentId: string, tagName: string) => Promise<void>;
  getVersionHistory: (documentId: string) => Promise<DocumentVersionDto[]>;
  addNewVersion: (documentId: string, file: File) => Promise<DocumentVersionDto | null>;
  downloadDocument: (id: string, filename: string, versionNumber?: number) => Promise<void>;
  downloadOcrFile: (id: string, filename?: string) => Promise<void>;
}

export function useDocuments(options: UseDocumentsOptions = {}): UseDocumentsResult {
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItemDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    showTrash = false,
    sharedOnly = false,
    reviewOnly = false,
    folderId,
    libId,
    searchQuery,
    selectedTags,
    tagMode,
    skipCount = 0,
    maxResultCount = 50,
    sorting,
  } = options;

  // Fetch documents from API
  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (showTrash) {
        // Fetch trash items
        const items = await docService.getTrashItems();
        setTrashItems(items);
        setTotalCount(items.length);
      } else {
        // Fetch regular documents with filters
        const result = await docService.getDocuments({
          skipCount,
          maxResultCount,
          sorting,
          title: searchQuery,
          folderId: folderId ?? undefined,
          libraryId: libId ?? undefined,
          sharedOnly,
          reviewOnly,
          tags: selectedTags && selectedTags.length > 0 ? selectedTags : undefined,
          filterMode: tagMode === 'AND' ? docService.TagFilterMode.And : docService.TagFilterMode.Or,
        });
        
        setDocuments(result.items);
        setTotalCount(result.totalCount);
      }
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Erreur lors du chargement des documents';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [showTrash, sharedOnly, reviewOnly, folderId, libId, skipCount, maxResultCount, sorting, searchQuery, selectedTags, tagMode]);

  // Initial fetch and refetch on dependency changes
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Create document
  const createDocument = async (
    input: docService.CreateDocumentInput,
    file: File
  ): Promise<DocumentDto | null> => {
    try {
      const doc = await docService.createDocument(input, file, (pct) => {
        // Progress callback - could be used to show upload progress
        console.log(`Upload progress: ${pct}%`);
      });
      toast.success(`Document "${doc.title}" créé avec succès`);
      await fetchDocuments(); // Refresh list
      return doc;
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Erreur lors de la création du document';
      toast.error(message);
      return null;
    }
  };

  // Delete document (soft delete)
  const deleteDocument = async (id: string): Promise<void> => {
    try {
      await docService.deleteDocument(id);
      toast.success('Document supprimé');
      await fetchDocuments();
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Erreur lors de la suppression';
      toast.error(message);
      throw err;
    }
  };

  // Move to trash
  const moveToTrash = async (id: string): Promise<void> => {
    try {
      await docService.moveToTrash(id);
      toast.success('Document déplacé vers la corbeille');
      await fetchDocuments();
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Erreur lors du déplacement vers la corbeille';
      toast.error(message);
      throw err;
    }
  };

  // Restore from trash
  const restoreFromTrash = async (id: string): Promise<void> => {
    try {
      await docService.restoreFromTrash(id);
      toast.success('Document restauré');
      await fetchDocuments();
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Erreur lors de la restauration';
      toast.error(message);
      throw err;
    }
  };

  // Hard delete (permanent)
  const hardDelete = async (id: string): Promise<void> => {
    try {
      await docService.hardDelete(id);
      toast.success('Document supprimé définitivement');
      await fetchDocuments();
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Erreur lors de la suppression définitive';
      toast.error(message);
      throw err;
    }
  };

  // Rename document
  const renameDocument = async (id: string, newName: string): Promise<void> => {
    try {
      await docService.renameDocument(id, newName);
      toast.success(`Document renommé en "${newName}"`);
      await fetchDocuments();
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Erreur lors du renommage';
      toast.error(message);
      throw err;
    }
  };

  // Move document to folder
  const moveDocument = async (id: string, targetFolderId: string | null): Promise<void> => {
    try {
      await docService.moveDocument(id, targetFolderId);
      toast.success('Document déplacé');
      await fetchDocuments();
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Erreur lors du déplacement';
      toast.error(message);
      throw err;
    }
  };

  // Add tag
  const addTag = async (documentId: string, tagName: string): Promise<TagDto | null> => {
    try {
      const tag = await docService.addTag(documentId, tagName);
      toast.success(`Tag "${tagName}" ajouté`);
      await fetchDocuments();
      return tag;
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Erreur lors de l\'ajout du tag';
      toast.error(message);
      return null;
    }
  };

  // Remove tag
  const removeTag = async (documentId: string, tagName: string): Promise<void> => {
    try {
      await docService.removeTag(documentId, tagName);
      toast.success(`Tag "${tagName}" retiré`);
      await fetchDocuments();
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Erreur lors du retrait du tag';
      toast.error(message);
      throw err;
    }
  };

  // Get version history
  const getVersionHistory = async (documentId: string): Promise<DocumentVersionDto[]> => {
    try {
      return await docService.getVersionHistory(documentId);
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Erreur lors du chargement de l\'historique';
      toast.error(message);
      return [];
    }
  };

  // Add new version
  const addNewVersion = async (
    documentId: string,
    file: File
  ): Promise<DocumentVersionDto | null> => {
    try {
      const version = await docService.addNewVersion(documentId, file, (pct) => {
        console.log(`Upload progress: ${pct}%`);
      });
      toast.success('Nouvelle version ajoutée');
      await fetchDocuments();
      return version;
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Erreur lors de l\'ajout de la version';
      toast.error(message);
      return null;
    }
  };

  // Download document
  const downloadDocument = async (
    id: string,
    filename: string,
    versionNumber?: number
  ): Promise<void> => {
    try {
      await docService.downloadDocument(id, filename, versionNumber);
      toast.success(`Téléchargement de ${filename}...`);
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Erreur lors du téléchargement';
      toast.error(message);
      throw err;
    }
  };

  // Download OCR text file
  const downloadOcrFile = async (
    id: string,
    filename?: string,
  ): Promise<void> => {
    try {
      await docService.downloadOcrFile(id, filename);
      toast.success('Téléchargement du fichier OCR...');
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'OCR indisponible pour ce document';
      toast.error(message);
      throw err;
    }
  };

  return {
    documents,
    trashItems,
    totalCount,
    isLoading,
    error,
    refetch: fetchDocuments,
    createDocument,
    deleteDocument,
    moveToTrash,
    restoreFromTrash,
    hardDelete,
    renameDocument,
    moveDocument,
    addTag,
    removeTag,
    getVersionHistory,
    addNewVersion,
    downloadDocument,
    downloadOcrFile,
  };
}
