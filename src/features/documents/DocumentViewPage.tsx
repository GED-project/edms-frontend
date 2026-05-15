import { useState, useEffect, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Download, 
  Plus, Minus,
  Info, History, Share2,
  RotateCcw, RotateCw, FileText, ChevronLeft,
  Calendar, User, Clock, CheckCircle2,
  MoreVertical, Printer, Send, ShieldCheck, MessageSquare,
  Image as ImageIcon, Archive, Hand
} from 'lucide-react';
import { Document as DocxDocument, Packer, Paragraph, TextRun } from 'docx';
import { DocumentDto, DocumentVersionDto, DocumentState } from './document.service';
import * as docService from './document.service';
import { shareRequestService } from './share-request.service';
import { getShareableUsers, type ShareableUserDto } from '@/features/admin/admin.service';
import { getMetadataDefinitions, type MetadataDefinitionDto } from '@/features/admin/metadata.service';
import { useAuth } from '@/providers/auth-provider';
import { Permission, Role } from '@/lib/auth-rbac/roles';
import { useDebounce } from '@/lib/use-debounce';
import { toast } from 'sonner';

export function DocumentViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [doc, setDoc] = useState<DocumentDto | null>(
    (location.state as { doc?: DocumentDto } | null)?.doc ?? null
  );
  const [versions, setVersions] = useState<DocumentVersionDto[]>([]);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(!doc);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'metadata' | 'route' | 'history' | 'versions'>('metadata');
  const [metadataDefinitions, setMetadataDefinitions] = useState<MetadataDefinitionDto[]>([]);
  const [ocrText, setOcrText] = useState<string>('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string>('');
  const debouncedSearch = useDebounce('Project', 300);

  // Load document from API if not passed via navigation state
  useEffect(() => {
    if (!id) { navigate('/documents'); return; }
    if (doc) { setIsLoading(false); return; }
    docService.getDocumentPreview(id)
      .then(preview => {
        setDoc({ id: preview.id, title: preview.title, state: preview.state, clearanceLevel: 0 as any, creationTime: new Date().toISOString() });
      })
      .catch(() => {
        toast.error('Document non trouvé');
        navigate('/documents');
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  // Load file blob for viewing.
  // Holds the current active blob URL so we can revoke it when done.
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    // Reset synchronously before the async fetch so the old (potentially
    // revoked) URL never reaches the <img> element.
    setBlobUrl(null);
    setImageLoadError(false);
    let cancelled = false;

    docService.getFileBlob(id)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        // Revoke the previous URL only once we have a valid replacement.
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        blobUrlRef.current = url;
        setBlobUrl(url);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      // Do NOT revoke here — the img element may still be painting.
      // The ref-based cleanup above handles revocation.
    };
  }, [id]);

  // Revoke the active blob URL when the component unmounts.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // Load version history
  useEffect(() => {
    if (!id) return;
    docService.getVersionHistory(id).then(setVersions).catch(() => {});
  }, [id]);

  useEffect(() => {
    getMetadataDefinitions(0, 200)
      .then((result) => setMetadataDefinitions(result.items))
      .catch(() => setMetadataDefinitions([]));
  }, []);

  // Derive extension from latest stored version first, then fall back to title.
  const docExt = useMemo(() => {
    const versionExt = versions?.[0]?.extension?.replace(/^\./, '').toLowerCase();
    if (versionExt) return versionExt;

    if (!doc) return '';
    const parts = doc.title.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }, [doc, versions]);

  const [activeViewerTab, setActiveViewerTab] = useState<'original' | 'ocr'>('original');
  const hasOcr = ocrText.trim().length > 0;

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setOcrLoading(true);
    setOcrText('');
    setOcrError('');

    docService.getOcrText(id)
      .then((ocr) => {
        if (cancelled) return;
        setOcrText(ocr?.ocrText ?? '');
      })
      .catch((err: any) => {
        if (cancelled) return;
        setOcrText('');
        setOcrError(err?.response?.data?.error?.message || 'OCR non disponible pour ce document.');
      })
      .finally(() => {
        if (!cancelled) setOcrLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    setActiveViewerTab('original');
  }, [id]);

  const { hasPermission, hasRole } = useAuth();
  const isAdminOrManager = hasRole(Role.ADMIN) || hasRole(Role.MANAGER);
  const canApprove = isAdminOrManager && hasPermission(Permission.APPROVE_DOCUMENT);
  const isCreator = doc && user?.id
    ? doc.creatorId?.toLowerCase() === user.id.toLowerCase()
    : false;

  // Lifecycle action handlers
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUsers, setShareUsers] = useState<ShareableUserDto[]>([]);
  const [shareUsersLoading, setShareUsersLoading] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const [sharingWithUserId, setSharingWithUserId] = useState<string | null>(null);
  const approveButtonRef = useRef<HTMLButtonElement | null>(null);
  const approvalDeepLinkHandledRef = useRef(false);
  const isApprovalDeepLink = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('approve') === '1';
  }, [location.search]);

  useEffect(() => {
    if (!doc || approvalDeepLinkHandledRef.current || !isApprovalDeepLink) {
      return;
    }

    approvalDeepLinkHandledRef.current = true;

    if (doc.state === DocumentState.Review && canApprove) {
      setActiveSidebarTab('metadata');
      setTimeout(() => {
        approveButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        approveButtonRef.current?.focus();
      }, 120);
      toast.info('Ce document attend votre approbation.');
      return;
    }

    if (doc.state === DocumentState.Review && !canApprove) {
      toast.info("Ce document est en attente d'approbation, mais vous n'avez pas les droits pour l'approuver.");
    }
  }, [doc, canApprove, isApprovalDeepLink]);

  async function handleSubmitForReview() {
    if (!doc) return;
    setLifecycleLoading(true);
    try {
      await docService.submitForReview(doc.id);
      setDoc(prev => prev ? { ...prev, state: DocumentState.Review } : prev);
      toast.success('Document en attente d\'approbation');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Erreur lors de la soumission');
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function handleApprove() {
    if (!doc) return;
    setLifecycleLoading(true);
    try {
      await docService.approveDocument(doc.id);
      setDoc(prev => prev ? { ...prev, state: DocumentState.Approved } : prev);
      toast.success('Document approuvé');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Erreur lors de l\'approbation');
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function handleArchive() {
    if (!doc) return;
    setLifecycleLoading(true);
    try {
      await docService.archiveDocument(doc.id);
      setDoc(prev => prev ? { ...prev, state: DocumentState.Archived } : prev);
      toast.success('Document archivé');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Erreur lors de l\'archivage');
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function handleRequestAccess() {
    if (!doc || !id) return;
    setRequestingAccess(true);
    try {
      await shareRequestService.requestAccess(id);
      toast.success('Demande d\'accès envoyée. En attente d\'approbation.');
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Erreur lors de la demande d\'accès';

      if (typeof msg === 'string' && msg.toLowerCase().includes('deja acces')) {
        toast.info(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setRequestingAccess(false);
    }
  }

  async function handleOpenShareModal() {
    setShareModalOpen(true);
    setShareUsersLoading(true);
    setShareSearch('');
    try {
      const users = await getShareableUsers();
      setShareUsers(users);
    } catch {
      toast.error('Impossible de charger les utilisateurs partageables');
      setShareModalOpen(false);
    } finally {
      setShareUsersLoading(false);
    }
  }

  async function handleRequestShareForUser(targetUserId: string) {
    if (!id) return;
    setSharingWithUserId(targetUserId);
    try {
      await shareRequestService.requestAccess(id, undefined, 'read', targetUserId);
      const target = shareUsers.find((u) => u.id === targetUserId);
      toast.success(`Demande envoyee au proprietaire pour partager avec ${target?.userName ?? 'cet utilisateur'}.`);
      setShareModalOpen(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Erreur lors de la demande de partage';

      if (typeof msg === 'string' && msg.toLowerCase().includes('deja acces')) {
        toast.info(msg);
        setShareModalOpen(false);
      } else {
        toast.error(msg);
      }
    } finally {
      setSharingWithUserId(null);
    }
  }

  const viewType = useMemo(() => {
    if (!doc) return 'document';
    if (docExt === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(docExt)) return 'image';
    return 'document';
  }, [doc, docExt]);

  const dynamicMetadata = useMemo(() => {
    const raw = (doc as any)?.extraProperties as Record<string, unknown> | undefined;
    if (!raw) return [] as Array<{ label: string; value: string }>;

    return metadataDefinitions
      .map((def) => {
        const value = raw[def.name];
        if (value === null || value === undefined || String(value).trim() === '') return null;
        return { label: def.displayName, value: String(value) };
      })
      .filter((item): item is { label: string; value: string } => item !== null);
  }, [doc, metadataDefinitions]);

  if (isLoading || !doc) return null;

  const renderHighlightedDocText = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => (
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-[#fef08a] text-gray-900 rounded-sm px-0.5">{part}</mark>
          ) : <span key={i}>{part}</span>
        ))}
      </span>
    );
  };

  const handleExportOcrDocx = async () => {
    if (!hasOcr) {
      toast.error('Aucun contenu OCR disponible pour export DOCX.');
      return;
    }

    try {
      const lines = ocrText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line, index, arr) => line.length > 0 || (index > 0 && arr[index - 1].length > 0));

      const paragraphs = [
        new Paragraph({
          children: [new TextRun({ text: doc.title, bold: true, size: 30 })],
          spacing: { after: 240 },
        }),
        ...lines.map((line) =>
          new Paragraph({
            children: [new TextRun({ text: line })],
            spacing: { after: 120 },
          })
        ),
      ];

      const exportDoc = new DocxDocument({
        sections: [{ children: paragraphs }],
      });

      const blob = await Packer.toBlob(exportDoc);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${doc.title.replace(/\.[^.]+$/, '')}_ocr.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast.success('DOCX éditable téléchargé');
    } catch (err) {
      console.error('DOCX export failed', err);
      toast.error('Erreur lors de l\'export DOCX');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] -m-5 bg-background overflow-hidden border border-border rounded-xl shadow-sm">
      <Helmet>
        <title>{doc.title} — ItDoc Viewer</title>
      </Helmet>

      {/* Header Toolbar */}
      <div className="h-14 px-6 border-b border-border bg-card flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            title="Retour"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded flex items-center justify-center ${
              viewType === 'pdf' ? 'bg-red-500/10 text-red-500' : 
              viewType === 'image' ? 'bg-purple-500/10 text-purple-500' : 
              'bg-blue-500/10 text-blue-500'
            }`}>
              {viewType === 'image' ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground truncate max-w-[300px]">{doc.title}</h1>
              <p className="text-[11px] text-muted-foreground">Version {versions.length > 0 ? versions[0].versionNumber : '1'}.0</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-accent/50 rounded-lg p-1 mr-4">
            <button className="p-1.5 hover:bg-background rounded-md text-muted-foreground hover:text-foreground transition-all">
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-[11px] font-medium px-2 min-w-[45px] text-center">100%</span>
            <button className="p-1.5 hover:bg-background rounded-md text-muted-foreground hover:text-foreground transition-all">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Télécharger"
              onClick={async () => {
                try {
                  await docService.downloadDocument(doc.id, doc.title);
                  toast.success(`Téléchargement de ${doc.title}...`);
                } catch (err: any) {
                  toast.error(err?.response?.data?.error?.message || 'Erreur lors du téléchargement');
                }
              }}
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              title="Télécharger OCR (.txt)"
              onClick={async () => {
                try {
                  await docService.downloadOcrFile(doc.id, `${doc.title}_ocr.txt`);
                  toast.success('Fichier OCR téléchargé');
                } catch (err: any) {
                  toast.error(err?.response?.data?.error?.message || 'OCR indisponible pour ce document');
                }
              }}
            >
              <FileText className="h-4 w-4" />
            </button>
            <button
              className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              title="Exporter OCR en DOCX"
              onClick={handleExportOcrDocx}
            >
              <Archive className="h-4 w-4" />
            </button>
            <button className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Imprimer">
              <Printer className="h-4 w-4" />
            </button>
            <button
              className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              title="Partager"
              onClick={() => {
                if (blobUrl) {
                  void handleOpenShareModal();
                  return;
                }
                void handleRequestAccess();
              }}
            >
              <Share2 className="h-4 w-4" />
            </button>
            <div className="w-px h-6 bg-border mx-1" />
            <button className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Plus d'actions">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content: Viewer */}
        <div className="flex-1 flex flex-col bg-accent/20 overflow-hidden relative">
          
          {/* Viewer Sub-toolbar */}
          <div className="h-12 px-6 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between shrink-0">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setActiveViewerTab('original')}
                className={`text-xs font-semibold relative h-12 transition-colors ${activeViewerTab === 'original' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Document original
                {activeViewerTab === 'original' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
              </button>
              <button 
                onClick={() => setActiveViewerTab('ocr')}
                className={`text-xs font-semibold relative h-12 transition-colors ${activeViewerTab === 'ocr' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Contenu extrait (OCR)
                {activeViewerTab === 'ocr' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
              </button>
            </div>
            
            <div className="flex items-center gap-4">
               <button className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <RotateCcw className="h-3.5 w-3.5" /> Rotation L
               </button>
               <button className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <RotateCw className="h-3.5 w-3.5" /> Rotation R
               </button>
            </div>
          </div>

          {/* Viewer Area */}
          <div className="flex-1 overflow-y-auto p-10 flex justify-center bg-zinc-100 dark:bg-zinc-900/50">
             {activeViewerTab === 'ocr' ? (
                <div className="w-full max-w-[800px] bg-card p-16 shadow-xl border border-border min-h-[1000px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h1 className="text-base font-bold text-center text-foreground mb-12 uppercase tracking-widest border-b border-border pb-8">
                    Contenu Extrait (OCR)
                  </h1>
                  <div className="prose prose-zinc dark:prose-invert max-w-none text-muted-foreground leading-loose font-mono text-sm">
                    {ocrLoading
                      ? 'Chargement OCR...'
                      : hasOcr
                      ? renderHighlightedDocText(ocrText, debouncedSearch)
                      : (ocrError || 'Aucun contenu OCR disponible pour ce document.')}
                  </div>
                </div>
             ) : !blobUrl ? (
                <div className="w-full max-w-[800px] bg-card p-16 shadow-xl border border-border min-h-[400px] flex flex-col items-center justify-center gap-3 animate-in fade-in duration-500">
                  <FileText className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Chargement du document...</p>
                </div>
             ) : viewType === 'pdf' ? (
                <div className="w-full max-w-[1000px] bg-white dark:bg-zinc-800 shadow-2xl border border-border h-[calc(100vh-220px)] animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <iframe
                    src={blobUrl}
                    title={doc.title}
                    className="w-full h-full border-0"
                  />
                </div>
             ) : viewType === 'image' ? (
                imageLoadError ? (
                  <div className="w-full max-w-[900px] bg-card shadow-xl border border-border h-[calc(100vh-220px)] flex flex-col items-center justify-center p-10 gap-4 animate-in fade-in duration-500">
                    <ImageIcon className="h-14 w-14 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground text-center max-w-sm">
                      Impossible d'afficher l'image dans l'aperçu intégré.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          await docService.downloadDocument(doc.id, doc.title);
                          toast.success(`Téléchargement de ${doc.title}...`);
                        } catch (err: any) {
                          toast.error(err?.response?.data?.error?.message || 'Erreur lors du téléchargement');
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-all"
                    >
                      <Download className="h-4 w-4" />
                      Télécharger pour visualiser
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 w-full p-6 animate-in fade-in zoom-in duration-500">
                    <div className="h-full w-full rounded-xl border border-border bg-card overflow-hidden shadow-xl">
                      <img
                        src={blobUrl}
                        alt={doc.title}
                        className="w-full h-full object-contain bg-black/5 dark:bg-black/20"
                        onError={() => setImageLoadError(true)}
                      />
                    </div>
                  </div>
                )
             ) : (
                <div className="w-full max-w-[900px] bg-card shadow-xl border border-border h-[calc(100vh-220px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="px-6 py-4 border-b border-border flex items-center gap-3 shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <h1 className="text-sm font-semibold text-foreground truncate">{doc.title}</h1>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center p-10 gap-4">
                    <FileText className="h-16 w-16 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground text-center max-w-sm">
                      L'aperçu intégré n'est pas disponible pour ce type de fichier
                      {docExt ? ` (.${docExt})` : ''}.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          await docService.downloadDocument(doc.id, doc.title);
                          toast.success(`Téléchargement de ${doc.title}...`);
                        } catch (err: any) {
                          toast.error(err?.response?.data?.error?.message || 'Erreur lors du téléchargement');
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-all"
                    >
                      <Download className="h-4 w-4" />
                      Télécharger pour visualiser
                    </button>
                  </div>
                </div>
             )}
          </div>
        </div>

        {/* Right Sidebar: Metadata / Route / History */}
        <div className="w-[400px] border-l border-border bg-card flex flex-col shrink-0 z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
          {/* Tabs */}
          <div className="flex border-b border-border p-1 bg-accent/30 m-3 rounded-lg shrink-0">
             <button 
                onClick={() => setActiveSidebarTab('metadata')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${activeSidebarTab === 'metadata' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
             >
                <Info className="h-3.5 w-3.5" />
                Fiche
             </button>
             <button 
                onClick={() => setActiveSidebarTab('route')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${activeSidebarTab === 'route' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
             >
                <Send className="h-3.5 w-3.5" />
                Parcours
             </button>
             <button 
                onClick={() => setActiveSidebarTab('versions')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${activeSidebarTab === 'versions' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
             >
                <Clock className="h-3.5 w-3.5" />
                Versions
             </button>
             <button 
                onClick={() => setActiveSidebarTab('history')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${activeSidebarTab === 'history' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
             >
                <History className="h-3.5 w-3.5" />
                Historique
             </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
             {activeSidebarTab === 'metadata' && (
                <div className="p-6 space-y-8 animate-in fade-in duration-300">
                  {/* Status & Quick Actions */}
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <span className={`flex h-2.5 w-2.5 rounded-full ${
                          doc.state === DocumentState.Draft ? 'bg-zinc-400' :
                          doc.state === DocumentState.Review ? 'bg-amber-500 animate-pulse' :
                          doc.state === DocumentState.Approved ? 'bg-emerald-500' :
                          doc.state === DocumentState.Archived ? 'bg-zinc-500' : 'bg-red-500'
                        }`} />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                          {doc.state === DocumentState.Draft ? 'Brouillon' :
                          doc.state === DocumentState.Review ? 'En attente d\'approbation' :
                           doc.state === DocumentState.Approved ? 'Approuvé' :
                           doc.state === DocumentState.Archived ? 'Archivé' : 'Corbeille'}
                        </span>
                     </div>
                     <div className="flex gap-1.5">
                        {doc.state === DocumentState.Draft && isCreator && (
                          <button
                            onClick={handleSubmitForReview}
                            disabled={lifecycleLoading}
                            className="px-3 py-1.5 bg-primary/10 text-primary text-[11px] font-bold rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                          >
                            Soumettre
                          </button>
                        )}
                        {doc.state === DocumentState.Review && canApprove && (
                          <button
                            onClick={handleApprove}
                            disabled={lifecycleLoading}
                            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 text-[11px] font-bold rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                          >
                            Approuver
                          </button>
                        )}
                        {doc.state === DocumentState.Approved && canApprove && (
                          <button
                            onClick={handleArchive}
                            disabled={lifecycleLoading}
                            className="px-3 py-1.5 bg-zinc-500/10 text-zinc-600 text-[11px] font-bold rounded-lg hover:bg-zinc-500/20 transition-colors disabled:opacity-50"
                          >
                            Archiver
                          </button>
                        )}
                     </div>
                  </div>

                  {/* Form fields */}
                  <div className="grid gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nom du document</label>
                      <input 
                        type="text" 
                        value={doc.title}
                        readOnly 
                        className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Auteur</label>
                        <div className="flex items-center gap-2 bg-accent/30 border border-border rounded-lg px-3 py-2">
                           <User className="h-3.5 w-3.5 text-muted-foreground" />
                           <span className="text-sm text-foreground truncate">{doc.creatorId ? doc.creatorId.slice(0, 8) + '…' : 'N/A'}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date de création</label>
                        <div className="flex items-center gap-2 bg-accent/30 border border-border rounded-lg px-3 py-2">
                           <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                           <span className="text-sm text-foreground">{new Date(doc.creationTime).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Index</label>
                        <input 
                          type="text" 
                          value={doc.id.toUpperCase().slice(0, 8)}
                          readOnly 
                          className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Type</label>
                        <input 
                          type="text" 
                          value={docExt.toUpperCase() || 'N/A'}
                          readOnly 
                          className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Description</label>
                      <textarea 
                        rows={3}
                        value={doc.description || 'Aucune description disponible.'}
                        readOnly
                        className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Métadonnées dynamiques</label>
                      {dynamicMetadata.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucune métadonnée spécifique enregistrée.</p>
                      ) : (
                        <div className="space-y-2">
                          {dynamicMetadata.map((item) => (
                            <div key={item.label} className="rounded-lg border border-border bg-accent/20 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</p>
                              <p className="text-sm text-foreground mt-0.5 break-words">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Security Info */}
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                       <ShieldCheck className="h-4 w-4" />
                       <span className="text-xs font-bold uppercase tracking-wider">Sécurité & Accès</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                       Niveau de classification : <strong>{
                         doc.clearanceLevel === 0 ? 'Public' :
                         doc.clearanceLevel === 1 ? 'Interne' : 'Confidentiel'
                       }</strong>.
                    </p>
                    {!isCreator && !blobUrl && (
                      <button
                        onClick={handleRequestAccess}
                        disabled={requestingAccess}
                        className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                      >
                        {requestingAccess ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 dark:border-blue-400 border-t-transparent" />
                        ) : (
                          <Hand className="h-3.5 w-3.5" />
                        )}
                        Demander l'accès
                      </button>
                    )}
                    {!isCreator && !!blobUrl && (
                      <button
                        onClick={handleOpenShareModal}
                        className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg hover:bg-amber-500/20 transition-colors"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Partager avec un utilisateur
                      </button>
                    )}
                  </div>
                </div>
             )}

             {activeSidebarTab === 'route' && (
                <div className="p-6 space-y-8 animate-in fade-in duration-300">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Circuit de validation</h3>
                       <span className="px-2 py-0.5 bg-teal-500/10 text-teal-500 text-[10px] font-bold rounded">En cours</span>
                    </div>

                    <div className="relative pl-6 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                       <div className="relative">
                          <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card z-10" />
                          <div className="flex items-start justify-between">
                             <div>
                                <p className="text-xs font-bold text-foreground">Initiateur</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Sara Andrews (RH)</p>
                             </div>
                             <span className="text-[10px] text-emerald-500 font-bold uppercase">Complété</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">28/07/2025 15:10</p>
                       </div>

                       <div className="relative">
                          <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card z-10" />
                          <div className="flex items-start justify-between">
                             <div>
                                <p className="text-xs font-bold text-foreground">Vérification RH</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Jean Dupont</p>
                             </div>
                             <span className="text-[10px] text-emerald-500 font-bold uppercase">Complété</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">29/07/2025 09:30</p>
                       </div>

                       <div className="relative">
                          <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-card z-10 animate-pulse" />
                          <div className="flex items-start justify-between">
                             <div>
                                <p className="text-xs font-bold text-foreground">Approbation Direction</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Marc Lefebvre</p>
                             </div>
                             <span className="text-[10px] text-amber-500 font-bold uppercase">En cours</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">Assigné le 29/07/2025</p>
                       </div>

                       <div className="relative opacity-40">
                          <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-border border-2 border-card z-10" />
                          <div>
                             <p className="text-xs font-bold text-foreground">Archivage Système</p>
                             <p className="text-[11px] text-muted-foreground mt-0.5">Automatique</p>
                          </div>
                       </div>
                    </div>

                    <button className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                       <MessageSquare className="h-3.5 w-3.5" />
                       Ajouter un commentaire au circuit
                    </button>
                  </div>
                </div>
             )}

             {activeSidebarTab === 'versions' && (
                <div className="p-6 space-y-6 animate-in fade-in duration-300">
                   <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Versions du document</h3>
                      <span className="text-[10px] font-bold text-muted-foreground bg-accent/50 px-2 py-0.5 rounded">
                        {versions.length} versions
                      </span>
                   </div>

                   <div className="space-y-4">
                      {versions.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">Aucune version trouvée.</p>
                      ) : versions.map((v, i) => (
                         <div key={v.id} className={`p-4 rounded-2xl border transition-all ${i === 0 ? 'border-primary/30 bg-primary/5 shadow-sm' : 'border-border bg-accent/5 hover:bg-accent/10'}`}>
                            <div className="flex items-center justify-between mb-3">
                               <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-primary text-white' : 'bg-accent text-muted-foreground'}`}>
                                     v{v.versionNumber}
                                  </div>
                                  <div>
                                     <p className="text-[11px] font-bold text-foreground">Version {v.versionNumber}</p>
                                     <p className="text-[9px] text-muted-foreground">{new Date(v.creationTime).toLocaleDateString('fr-FR')} {new Date(v.creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                  </div>
                               </div>
                               {i === 0 && (
                                  <span className="text-[8px] font-black uppercase tracking-tighter bg-emerald-500 text-white px-1.5 py-0.5 rounded">Actuelle</span>
                               )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                               <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <User className="h-3 w-3" /> N/A
                               </div>
                               <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <FileText className="h-3 w-3" /> {v.extension?.toUpperCase() || '—'}
                               </div>
                            </div>
                            {i > 0 && (
                               <button 
                                 onClick={() => toast.info(`Restauration de la version ${v.versionNumber} (simulation)`)}
                                 className="w-full mt-3 py-1.5 text-[10px] font-bold text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-all"
                               >
                                  Restaurer cette version
                               </button>
                            )}
                         </div>
                      ))}
                   </div>

                   <div className="pt-4">
                      <button 
                        onClick={() => navigate(`/documents/upload?replace=${doc.id}`)}
                        className="w-full py-3 bg-accent hover:bg-accent/80 border border-border text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                         <Plus className="h-3.5 w-3.5" /> Nouvelle version
                      </button>
                   </div>
                </div>
              )}

             {activeSidebarTab === 'history' && (
                <div className="p-0 animate-in fade-in duration-300">
                  <div className="p-4 border-b border-border bg-accent/10 flex items-center justify-between">
                     <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Journal des actions</h3>
                     <span className="text-[10px] text-muted-foreground">{versions.length} versions</span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {versions.length === 0 ? (
                      <div className="p-12 text-center">
                        <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-xs text-muted-foreground">Aucun historique disponible pour ce document.</p>
                      </div>
                    ) : (
                      versions.map((v) => (
                        <div key={v.id} className="p-4 hover:bg-accent/20 transition-colors">
                           <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-muted-foreground shrink-0">
                                 <Clock className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-xs font-bold text-foreground truncate">
                                    Version {v.versionNumber} — {v.extension?.toUpperCase() || '—'}
                                 </p>
                                 <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {new Date(v.creationTime).toLocaleDateString('fr-FR')}
                                 </p>
                                 {v.fileSize > 0 && (
                                    <p className="text-[10px] bg-accent/40 rounded px-1.5 py-0.5 mt-2 text-muted-foreground inline-block">
                                       {(v.fileSize / 1024).toFixed(1)} Ko
                                    </p>
                                 )}
                              </div>
                           </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
             )}
          </div>

          {/* Footer Controls */}
          <div className="p-4 border-t border-border bg-card shrink-0">
             <div className="flex flex-col gap-2">
                {doc.state === DocumentState.Draft && isCreator && (
                  <button
                    onClick={handleSubmitForReview}
                    disabled={lifecycleLoading}
                    className="flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    Soumettre pour révision
                  </button>
                )}
                {doc.state === DocumentState.Review && canApprove && (
                  <button
                    ref={approveButtonRef}
                    onClick={handleApprove}
                    disabled={lifecycleLoading}
                    className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/10 transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approuver le document
                  </button>
                )}
                {doc.state === DocumentState.Approved && canApprove && (
                  <button
                    onClick={handleArchive}
                    disabled={lifecycleLoading}
                    className="flex items-center justify-center gap-2 py-2.5 bg-zinc-600 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                  >
                    <Archive className="h-4 w-4" />
                    Archiver le document
                  </button>
                )}
                {(doc.state === DocumentState.Archived || (doc.state !== DocumentState.Draft && doc.state !== DocumentState.Review && doc.state !== DocumentState.Approved)) && (
                  <p className="text-center text-xs text-muted-foreground py-2">Aucune action disponible pour cet état.</p>
                )}
                {doc.state === DocumentState.Draft && !isCreator && (
                  <p className="text-center text-xs text-muted-foreground py-2">Seul le créateur peut soumettre ce document.</p>
                )}
                {doc.state === DocumentState.Review && !canApprove && (
                  <p className="text-center text-xs text-muted-foreground py-2">En attente d'approbation par un manager.</p>
                )}
             </div>
          </div>
        </div>
      </div>

      {shareModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Partager ce document</h2>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <MoreVertical className="h-5 w-5 rotate-45" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                Selectionnez l'utilisateur cible. Le proprietaire recevra une demande de validation.
              </p>
              <input
                type="text"
                value={shareSearch}
                onChange={(e) => setShareSearch(e.target.value)}
                placeholder="Rechercher un utilisateur..."
                className="w-full bg-accent/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
              />

              <div className="max-h-72 overflow-y-auto space-y-1.5">
                {shareUsersLoading ? (
                  <div className="p-8 flex items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-r-transparent" />
                  </div>
                ) : (
                  (() => {
                    const term = shareSearch.trim().toLowerCase();
                    const currentUserId = user?.id?.toLowerCase();
                    const candidates = shareUsers
                      .filter((u) => u.id.toLowerCase() !== currentUserId)
                      .filter((u) => !term
                        || u.userName.toLowerCase().includes(term)
                        || (u.email && u.email.toLowerCase().includes(term))
                        || (u.name && u.name.toLowerCase().includes(term)));

                    if (candidates.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Aucun utilisateur trouve.
                        </p>
                      );
                    }

                    return candidates.slice(0, 50).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleRequestShareForUser(u.id)}
                        disabled={sharingWithUserId === u.id}
                        className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{u.userName}</p>
                          {u.email && (
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          )}
                        </div>
                        {sharingWithUserId === u.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />
                        ) : (
                          <Share2 className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ));
                  })()
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
