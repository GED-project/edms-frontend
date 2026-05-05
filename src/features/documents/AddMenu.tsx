import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Upload,
  ScanLine,
  X
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { Permission } from '@/lib/auth-rbac/roles';

interface AddMenuProps {
  onUpload: () => void;
  onScan: () => void;
  onAddFolder: () => void;
}

export function AddMenu({
  onUpload,
  onScan,
  onAddFolder,
}: AddMenuProps) {
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const canUpload = hasPermission(Permission.UPLOAD_DOCUMENT);

  if (!canUpload) return null;

  return (
    <div ref={ref} className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex flex-col gap-2 rounded-xl bg-popover shadow-2xl border border-border p-2 animate-in fade-in slide-in-from-bottom-5">
          <button
            onClick={() => { setOpen(false); onUpload(); }}
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm hover:bg-accent transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Upload className="h-4 w-4" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Upload File</p>
            </div>
          </button>

          <button
            onClick={() => { setOpen(false); onScan(); }}
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm hover:bg-accent transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
              <ScanLine className="h-4 w-4" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Scan Document</p>
            </div>
          </button>

          <button
            onClick={() => { setOpen(false); onAddFolder(); }}
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm hover:bg-accent transition-colors border-t border-border mt-1 pt-3"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Plus className="h-4 w-4" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">New Folder</p>
            </div>
          </button>

        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-xl hover:bg-teal-700 hover:scale-105 transition-all"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
