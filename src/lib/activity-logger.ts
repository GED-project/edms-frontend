/**
 * Activity Logger — shared singleton service.
 * Logs real user actions to localStorage and broadcasts updates
 * via a BroadcastChannel so the ActivityPage re-renders in real-time.
 */

export type ActionType =
  | 'upload'
  | 'delete'
  | 'share'
  | 'approve'
  | 'reject'
  | 'view'
  | 'edit'
  | 'download'
  | 'restore'
  | 'archive'
  | 'move'
  | 'tag'
  | 'version_restore'
  | 'scan'
  | 'cloud_import'
  | 'create_folder'
  | 'rename_folder'
  | 'bulk_delete'
  | 'bulk_tag'
  | 'bulk_move'
  | 'bulk_archive'
  | 'bulk_share'
  | 'expiry_set';

export interface ActivityEntry {
  id: string;
  action: ActionType;
  documentName: string;
  user: string;
  date: string; // ISO string
  details?: string;
}

const STORAGE_KEY = 'edms_activity_log_v1';
const CHANNEL_NAME = 'edms_activity_channel';

// Max entries to keep in localStorage
const MAX_ENTRIES = 500;

function loadEntries(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: ActivityEntry[]): void {
  // Trim to avoid unbounded growth
  const trimmed = entries.slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export const activityLogger = {
  /** Log a single user action */
  log(
    action: ActionType,
    documentName: string,
    userName: string,
    details?: string
  ): ActivityEntry {
    const entry: ActivityEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      action,
      documentName,
      user: userName,
      date: new Date().toISOString(),
      details,
    };

    const entries = loadEntries();
    entries.unshift(entry);
    saveEntries(entries);

    // Notify other tabs / same-tab listeners
    try {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.postMessage({ type: 'new_entry', entry });
      bc.close();
    } catch {
      // BroadcastChannel not supported in very old browsers — safe to ignore
    }

    return entry;
  },

  /** Get all entries (most recent first) */
  getAll(): ActivityEntry[] {
    return loadEntries();
  },

  /** Subscribe to new log entries (returns an unsubscribe function) */
  subscribe(callback: (entry: ActivityEntry) => void): () => void {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const entries = JSON.parse(e.newValue) as ActivityEntry[];
          if (entries.length > 0) callback(entries[0]);
        } catch {
          /* noop */
        }
      }
    };
    window.addEventListener('storage', handler);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (e) => {
        if (e.data?.type === 'new_entry') callback(e.data.entry);
      };
    } catch {
      /* noop */
    }

    return () => {
      window.removeEventListener('storage', handler);
      bc?.close();
    };
  },

  /** Seed mock historical data when the log is empty (first run) */
  seedIfEmpty(mockData: ActivityEntry[]): void {
    const existing = loadEntries();
    if (existing.length === 0) {
      saveEntries(mockData.slice(0, MAX_ENTRIES));
    }
  },
};
