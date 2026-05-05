/**
 * useAvatar — Shared hook for user avatar management.
 * Stores the avatar as a base64 data URL in localStorage.
 * When the backend is ready, replace localStorage reads/writes
 * with API calls (GET /api/users/me/avatar, PUT /api/users/me/avatar).
 */
import { useState, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';

const AVATAR_KEY_PREFIX = 'edms_avatar_';

function getAvatarKey(userId: string) {
  return `${AVATAR_KEY_PREFIX}${userId}`;
}

export function useAvatar() {
  const { user } = useAuth();

  const stored = user
    ? localStorage.getItem(getAvatarKey(user.id)) ?? null
    : null;

  const [avatarUrl, setAvatarUrl] = useState<string | null>(stored);

  const saveAvatar = useCallback(
    (dataUrl: string) => {
      if (!user) return;
      localStorage.setItem(getAvatarKey(user.id), dataUrl);
      setAvatarUrl(dataUrl);
    },
    [user]
  );

  const clearAvatar = useCallback(() => {
    if (!user) return;
    localStorage.removeItem(getAvatarKey(user.id));
    setAvatarUrl(null);
  }, [user]);

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
