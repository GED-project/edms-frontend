import { useState, useRef } from 'react';
import { X, ScanLine, CheckCircle2, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface ScanDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (name: string, text: string) => void;
}

type ScanPhase = 'idle' | 'scanning' | 'processing' | 'done';

const MOCK_OCR_TEXTS = [
  `CONTRAT DE PRESTATION DE SERVICES\n\nEntre les soussignés:\n- Société ITCOMP SAS, représentée par M. Ahmed Dupont\n- Prestataire: Tech Solutions SARL\n\nObjet: Développement d'une application web\nDurée: 6 mois à compter du 01/06/2025\nMontant: 45,000 EUR HT\n\nSigné le 15 mai 2025`,
  `RAPPORT D'AUDIT INTERNE Q2 2025\n\nDépartement: Finance\nAuditeur: Claire Martin\nDate: 20 avril 2025\n\nConclusions:\n- Conformité réglementaire: 94%\n- Risques identifiés: 3 (niveau moyen)\n- Recommandations: mise à jour des procédures de validation\n\nStatut: Approuvé`,
  `BON DE COMMANDE #BC-2025-0892\n\nFournisseur: Office Pro Distribution\nDate: 03 mai 2025\nRéférence: BC-2025-0892\n\nArticles commandés:\n- 10x Écrans 27 pouces: 4,500 EUR\n- 5x Claviers ergonomiques: 450 EUR\nTotal TTC: 5,940 EUR`,
];

export function ScanDocumentModal({ isOpen, onClose, onScanSuccess }: ScanDocumentModalProps) {
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [docName, setDocName] = useState('');
  const videoRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setPhase('idle');
    setProgress(0);
    setOcrText('');
    setDocName('');
  };

  const handleStartScan = async () => {
    setPhase('scanning');
    setProgress(0);

    // Simulate camera scanning
    for (let i = 0; i <= 60; i += 10) {
      await new Promise((r) => setTimeout(r, 200));
      setProgress(i);
    }

    setPhase('processing');

    // Simulate OCR processing
    for (let i = 60; i <= 100; i += 8) {
      await new Promise((r) => setTimeout(r, 150));
      setProgress(Math.min(i, 100));
    }

    const randomText = MOCK_OCR_TEXTS[Math.floor(Math.random() * MOCK_OCR_TEXTS.length)];
    const firstLine = randomText.split('\n')[0].trim();
    setOcrText(randomText);
    setDocName(firstLine.substring(0, 40));
    setPhase('done');
  };

  const handleConfirm = () => {
    if (!docName.trim()) {
      toast.error('Veuillez saisir un nom pour le document.');
      return;
    }
    onScanSuccess(docName, ocrText);
    toast.success(`Document "${docName}" ajouté à la bibliothèque.`);
    onClose();
    handleReset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10">
              <ScanLine className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Scanner un document</h2>
              <p className="text-xs text-muted-foreground">Reconnaissance optique de caractères (OCR)</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Camera / Scanner preview */}
          <div
            ref={videoRef}
            className={`relative w-full aspect-video rounded-xl border-2 overflow-hidden transition-all ${
              phase === 'idle' ? 'border-dashed border-border bg-muted/30' : 'border-purple-500/40 bg-zinc-950'
            }`}
          >
            {phase === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10">
                  <ScanLine className="h-8 w-8 text-purple-400" />
                </div>
                <p className="text-sm text-muted-foreground">Positionnez votre document dans le cadre</p>
                <p className="text-xs text-muted-foreground/60">Simulateur OCR — Demo</p>
              </div>
            )}

            {(phase === 'scanning' || phase === 'processing') && (
              <>
                {/* Simulated scanner view */}
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-zinc-950 flex items-center justify-center">
                  <div className="w-3/4 h-3/4 border-2 border-purple-500/60 rounded relative">
                    {/* Scanning line animation */}
                    <div
                      className="absolute left-0 right-0 h-0.5 bg-purple-400 shadow-[0_0_8px_2px_rgba(168,85,247,0.6)] transition-all duration-300"
                      style={{ top: `${(progress / 100) * 100}%` }}
                    />
                    {/* Corner decorations */}
                    {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                      <div key={i} className={`absolute ${pos} w-4 h-4 border-purple-400`}
                        style={{
                          borderTopWidth: i < 2 ? '2px' : 0,
                          borderBottomWidth: i >= 2 ? '2px' : 0,
                          borderLeftWidth: i % 2 === 0 ? '2px' : 0,
                          borderRightWidth: i % 2 === 1 ? '2px' : 0,
                        }}
                      />
                    ))}
                  </div>
                </div>
                {/* Progress */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-2">
                  <div className="flex items-center justify-between text-xs text-purple-300 mb-1">
                    <span>{phase === 'scanning' ? 'Numérisation...' : 'Traitement OCR...'}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1 w-full bg-purple-950 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-400 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </>
            )}

            {phase === 'done' && (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/30">
                <div className="text-center space-y-2">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
                  <p className="text-emerald-300 font-medium">Scan terminé avec succès</p>
                  <p className="text-xs text-emerald-400/70">{ocrText.length} caractères extraits</p>
                </div>
              </div>
            )}
          </div>

          {/* OCR Result */}
          {phase === 'done' && (
            <div className="space-y-4">
              {/* Document name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Nom du document</label>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                    id="scan-doc-name"
                  />
                </div>
              </div>

              {/* Extracted text */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Texte extrait (OCR)</label>
                <div className="rounded-lg border border-border bg-muted/20 p-4 font-mono text-xs text-foreground/80 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {ocrText}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4 bg-muted/20">
          <button onClick={() => { onClose(); handleReset(); }} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Annuler
          </button>
          <div className="flex gap-2">
            {phase === 'done' && (
              <button onClick={handleReset} className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />
                Recommencer
              </button>
            )}
            {phase === 'idle' && (
              <button
                id="start-scan-btn"
                onClick={handleStartScan}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors shadow-sm"
              >
                <ScanLine className="h-4 w-4" />
                Démarrer le scan
              </button>
            )}
            {phase === 'done' && (
              <button
                id="confirm-scan-btn"
                onClick={handleConfirm}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                Ajouter à la bibliothèque
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
