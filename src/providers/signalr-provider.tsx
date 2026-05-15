/**
 * SignalR Hub Provider — manages the connection to EDMSHub.
 *
 * Connects to /signalr-hubs/edms (proxied to https://localhost:44324/signalr-hubs/edms)
 * and exposes the connection + a hook to subscribe to notifications.
 *
 * Usage:
 *   <SignalRProvider> wraps the app (inside AuthProvider so tokens are available).
 *   useSignalR() returns { isConnected, lastNotification }.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { getAccessToken } from '@/lib/api.client';
import { getCurrentTenantCode } from '@/lib/tenant';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HubNotification {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  targetUrl?: string;
}

interface SignalRContextType {
  isConnected: boolean;
  lastNotification: HubNotification | null;
}

function normalizeApprovalTargetUrl(
  title: string,
  message: string,
  targetUrl?: string,
): string | undefined {
  if (!targetUrl) return targetUrl;

  const looksLikeApproval = /approb/i.test(title) || /approb/i.test(message);
  const isDocumentRoute = /^\/documents\/[a-f0-9-]+(\?.*)?$/i.test(targetUrl);

  if (!looksLikeApproval || !isDocumentRoute) {
    return targetUrl;
  }

  try {
    const [path, query = ''] = targetUrl.split('?');
    const params = new URLSearchParams(query);
    if (!params.has('approve')) {
      params.set('approve', '1');
    }
    const nextQuery = params.toString();
    return nextQuery ? `${path}?${nextQuery}` : path;
  } catch {
    return targetUrl;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SignalRContext = createContext<SignalRContextType>({
  isConnected: false,
  lastNotification: null,
});

export function useSignalR(): SignalRContextType {
  return useContext(SignalRContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface SignalRProviderProps {
  /** Only connect when authenticated (pass `!!user`). */
  enabled: boolean;
  children: React.ReactNode;
}

const NEGOTIATE_FAILURE_LIMIT = 3;
const NEGOTIATE_COOLDOWN_MS = 60_000;

type HubFailureState = {
  consecutiveNegotiationFailures: number;
  pauseUntilTs: number;
  pauseToastShown: boolean;
};

function isNegotiation500Error(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();
  return (
    normalized.includes('failed to complete negotiation')
    && normalized.includes("status code '500'")
  );
}

export function SignalRProvider({ enabled, children }: SignalRProviderProps) {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<HubNotification | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const hubFailureRef = useRef<HubFailureState>({
    consecutiveNegotiationFailures: 0,
    pauseUntilTs: 0,
    pauseToastShown: false,
  });

  const resetFailureState = useCallback(() => {
    hubFailureRef.current.consecutiveNegotiationFailures = 0;
    hubFailureRef.current.pauseUntilTs = 0;
    hubFailureRef.current.pauseToastShown = false;
  }, []);

  const trackStartFailure = useCallback((error: unknown) => {
    if (!isNegotiation500Error(error)) {
      return;
    }

    const state = hubFailureRef.current;
    state.consecutiveNegotiationFailures += 1;

    if (state.consecutiveNegotiationFailures >= NEGOTIATE_FAILURE_LIMIT) {
      state.pauseUntilTs = Date.now() + NEGOTIATE_COOLDOWN_MS;

      if (!state.pauseToastShown) {
        toast.warning('Connexion temps réel temporairement suspendue', {
          description: 'Le serveur de notifications répond en erreur. Nouvelle tentative dans 1 minute.',
        });
        state.pauseToastShown = true;
      }
    }
  }, []);

  const getNextRetryDelay = useCallback((retryContext: signalR.RetryContext): number | null => {
    const state = hubFailureRef.current;

    if (Date.now() < state.pauseUntilTs) {
      return null;
    }

    if (isNegotiation500Error(retryContext.retryReason)) {
      state.consecutiveNegotiationFailures += 1;

      if (state.consecutiveNegotiationFailures >= NEGOTIATE_FAILURE_LIMIT) {
        state.pauseUntilTs = Date.now() + NEGOTIATE_COOLDOWN_MS;

        if (!state.pauseToastShown) {
          toast.warning('Connexion temps réel temporairement suspendue', {
            description: 'Le serveur de notifications répond en erreur. Nouvelle tentative dans 1 minute.',
          });
          state.pauseToastShown = true;
        }

        return null;
      }
    }

    const retryDelays = [0, 2000, 5000, 10000, 30000];
    return retryDelays[retryContext.previousRetryCount] ?? null;
  }, []);

  const connect = useCallback(async () => {
    if (connectionRef.current) return; // already connecting/connected

    const failureState = hubFailureRef.current;
    if (Date.now() < failureState.pauseUntilTs) {
      return;
    }

    if (failureState.pauseUntilTs > 0 && Date.now() >= failureState.pauseUntilTs) {
      resetFailureState();
    }

    const token = getAccessToken();
    if (!token) {
      return;
    }

    const tenant = getCurrentTenantCode();
    // WebSocket upgrades cannot carry custom headers, so the tenant must be
    // forwarded as a query parameter that ABP's QueryStringTenantResolveContributor
    // picks up. Without this the hub runs in host scope while the access token
    // belongs to the sub-tenant, causing negotiate to return 500.
    const hubUrl = tenant
      ? `/signalr-hubs/edms?__tenant=${encodeURIComponent(tenant)}`
      : '/signalr-hubs/edms';

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => getAccessToken() ?? '',
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: getNextRetryDelay,
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('ReceiveNotification', (title: string, message: string, type: string, targetUrl?: string) => {
      const normalizedTargetUrl = normalizeApprovalTargetUrl(title, message, targetUrl);
      const notification: HubNotification = {
        title,
        message,
        type: (type as HubNotification['type']) || 'info',
        targetUrl: normalizedTargetUrl,
      };
      setLastNotification(notification);

      // Show as toast
      const toastFn =
        type === 'success' ? toast.success :
        type === 'warning' ? toast.warning :
        type === 'error'   ? toast.error   :
        toast.info;

      toastFn(title, {
        description: message,
        action: normalizedTargetUrl
          ? {
              label: 'Ouvrir',
              onClick: () => navigate(normalizedTargetUrl),
            }
          : undefined,
      });
    });

    connection.onreconnecting(() => setIsConnected(false));
    connection.onreconnected(() => {
      setIsConnected(true);
      resetFailureState();
    });
    connection.onclose(() => {
      setIsConnected(false);
      connectionRef.current = null;
    });

    try {
      connectionRef.current = connection;
      await connection.start();
      setIsConnected(true);
      resetFailureState();
    } catch (error: unknown) {
      // Backend may not be running; fail silently
      trackStartFailure(error);
      await connection.stop().catch(() => undefined);
      connectionRef.current = null;
    }
  }, [getNextRetryDelay, navigate, resetFailureState, trackStartFailure]);

  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      await connectionRef.current.stop();
      connectionRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }
    return () => {
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return (
    <SignalRContext.Provider value={{ isConnected, lastNotification }}>
      {children}
    </SignalRContext.Provider>
  );
}
