/**
 * Axios instance
 * Configure une instance Axios avec:
 * - baseURL: VITE_API_BASE_URL (proxy/valeur fournie par Vite)
 * - Intercepteur request: ajoute l'en-tête Authorization Bearer <token>
 * - Intercepteur response: redirige vers /login si 401
 */
import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/";
export const api = axios.create({ baseURL });

// Injecte le token Sanctum dans chaque requête sortante
api.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" && (window as any).localStorage?.getItem
      ? (window as any).localStorage.getItem("token")
      : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Gestion centralisée des erreurs d'authentification
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || "";
    const data = err?.response?.data;

    // Le backend renvoie { error: { code, message, details } } pour les erreurs HTTP
    // et de validation ; les écrans lisent `data.message` → normalisation unique ici.
    if (data && typeof data === "object" && !data.message && data.error?.message) {
      data.message = data.error.message;
      if (data.error.details && !data.errors) data.errors = data.error.details;
    }

    // Log pour debug
    if (status === 404 || status === 403) {
      console.error(`[API Error ${status}] ${url}`, data);
    }

    // Si la réponse est du HTML au lieu de JSON
    if (typeof data === "string" && data.startsWith("<!")) {
      console.error(
        `[API HTML Response] ${url} - Server returned HTML instead of JSON`,
      );
      err.message = `Erreur serveur (${status}): l'API a retourné du HTML au lieu de JSON`;
    }

    if (status === 401 && !url.includes("/api/auth/login")) {
      if (
        typeof window !== "undefined" &&
        (window as any).localStorage?.removeItem
      ) {
        (window as any).localStorage.removeItem("token");
        (window as any).localStorage.removeItem("user");
      }
      // Purge du store Redux (écouté dans store/index.ts)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:expired"));
      }
      // Use history API instead of location.href to avoid full page reload
      if (typeof window !== "undefined") {
        window.history.pushState({}, "", "/login");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
    return Promise.reject(err);
  },
);
