import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Stockage de l'Access Token en mémoire pour mitiger les attaques XSS.
// Le Refresh Token, lui, devra idéalement être géré par le backend via des cookies HttpOnly.
let _accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  _accessToken = token;
};

export const getAccessToken = () => _accessToken;

// Création de l'instance Axios
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // Important pour l'envoi des cookies HttpOnly (ex: Refresh Token) avec chaque requête
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur de requêtes : ajoute l'Access Token s'il est présent
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
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
        // On demande un nouveau token.
        // On utilise axios natif ici pour ne pas repasser par nos intercepteurs.
        // NOTE: Si ABP est utilisé, la route exacte dépendra de la config (ex: POST /connect/token avec grant_type=refresh_token)
        const response = await axios.post(
          `${apiClient.defaults.baseURL}/auth/refresh`, // À adapter selon le backend (ex: ABP -> /connect/token)
          {}, // Le Refresh Token est censé passer via un cookie HttpOnly avec `withCredentials: true`
          { withCredentials: true }
        );

        // Adaptez "access_token" selon la réponse de votre backend (ABP renvoie "access_token")
        const newToken = response.data.access_token || response.data.token;
        setAccessToken(newToken);
        
        // Mettre à jour le header de la requête originale avec le nouveau token
        originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
        
        processQueue(null, newToken);
        
        // Relancer la requête initiale
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        // Si le refresh échoue, le Refresh Token est expiré. On déconnecte l'utilisateur.
        setAccessToken(null);
        // Redirection vers le login (ou déclencher un state global de déconnexion)
        window.location.href = '/auth/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
