/**
 * useAvatar — Shared hook for user avatar management.
 * Stores the avatar as a base64 data URL in localStorage, scoped per user id.
 * When the backend is ready, replace localStorage reads/writes
 * with API calls (GET /api/users/me/avatar, PUT /api/users/me/avatar).
 */
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';

const AVATAR_KEY_PREFIX = 'edms_avatar_';
const LEGACY_AVATAR_KEY = 'edms_avatar_'; // empty-user-id leftover from the old hook

// One-time migration: drop the leftover empty-id key so it can't bleed across users.
try {
  if (typeof window !== 'undefined' && window.localStorage.getItem(LEGACY_AVATAR_KEY) !== null) {
    window.localStorage.removeItem(LEGACY_AVATAR_KEY);
  }
} catch {
  /* localStorage unavailable — ignore */
}

function getAvatarKey(userId: string): string | null {
  if (!userId) return null;
  return `${AVATAR_KEY_PREFIX}${userId}`;
}

export function useAvatar() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const storageKey = getAvatarKey(userId);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (!storageKey) return null;
    return localStorage.getItem(storageKey) ?? null;
  });

  // Re-read avatar whenever the active user changes (login / logout / switch).
  useEffect(() => {
    if (!storageKey) {
      setAvatarUrl(null);
      return;
    }
    setAvatarUrl(localStorage.getItem(storageKey));
  }, [storageKey]);

  // Sync across tabs: react to storage events for our key only.
  useEffect(() => {
    if (!storageKey) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        setAvatarUrl(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  const saveAvatar = useCallback(
    (dataUrl: string) => {
      if (!storageKey) return;
      localStorage.setItem(storageKey, dataUrl);
      setAvatarUrl(dataUrl);
    },
    [storageKey]
  );

  const clearAvatar = useCallback(() => {
    if (!storageKey) return;
    localStorage.removeItem(storageKey);
    setAvatarUrl(null);
  }, [storageKey]);

  /** Returns initials fallback from fullName */
  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return { avatarUrl, saveAvatar, clearAvatar, initials };
}
