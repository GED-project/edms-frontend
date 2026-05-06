import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Access Token stored in memory (not localStorage) to mitigate XSS.
let _accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  _accessToken = token;
};

export const getAccessToken = () => _accessToken;

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur de requêtes : ajoute l'Access Token et le token XSRF s'ils sont présents
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // ABP anti-forgery: lire le cookie XSRF-TOKEN et l'envoyer dans l'en-tête
    const xsrfToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('XSRF-TOKEN='))
      ?.split('=')[1];
    if (xsrfToken && config.headers) {
      config.headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrfToken);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// File d'attente pour bloquer les requêtes le temps du rafraîchissement
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  failedQueue = [];
};

// Extendre le type pour rajouter la propriété _retry personnalisée
interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Intercepteur de réponses : Gère l'erreur 401 et le Refresh Token
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig;

    // Si on reçoit une 401 et qu'on n'a pas déjà essayé de rafraîchir
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      // On ne veut pas intercepter une erreur 401 venant des endpoints de login ou de refresh eux-mêmes
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/connect/token') // Endpoint commun pour ABP / OpenIddict
    ) {
      if (isRefreshing) {
        // Une requête de refresh est déjà en cours, on met celle-ci en file d'attente
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // ABP OpenIddict refresh: POST /connect/token with grant_type=refresh_token
        // The refresh_token is read from the in-memory store set at login time.
        const storedRefreshToken = sessionStorage.getItem('edms_refresh_token');
        if (!storedRefreshToken) throw new Error('No refresh token available');

        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', storedRefreshToken);
        params.append('client_id', import.meta.env.VITE_OIDC_CLIENT_ID || 'GedProject_Vue');
        params.append('scope', import.meta.env.VITE_OIDC_SCOPE || 'openid profile email GedProject');

        const response = await axios.post(
          `${import.meta.env.VITE_AUTH_URL || ''}/connect/token`,
          params,
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const newAccessToken: string = response.data.access_token;
        const newRefreshToken: string | undefined = response.data.refresh_token;

        setAccessToken(newAccessToken);
        if (newRefreshToken) sessionStorage.setItem('edms_refresh_token', newRefreshToken);

        originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;
        processQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        setAccessToken(null);
        sessionStorage.removeItem('edms_refresh_token');
        window.location.href = '/auth/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
