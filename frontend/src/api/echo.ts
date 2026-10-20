/**
 * Laravel Echo (temps réel)
 * Fournit une instance singleton d'Echo configurée pour Pusher.
 * - Authentification Bearer via header Authorization (Sanctum)
 * - Paramètres lus depuis import.meta.env (Vite)
 * - Utilisé pour écouter les événements: TicketCalled, ServiceStatsUpdated, etc.
 */
import Echo from "laravel-echo";
import Pusher from "pusher-js";

// Create a singleton Echo instance configured for Bearer auth with Sanctum token
let echoInstance: any = null;

// Objet d'en-têtes partagé avec pusher-js (même référence) : mis à jour à chaque
// appel pour que l'auth des canaux utilise le token courant, et non celui présent
// lors de la création du singleton (null avant connexion, ou ancien compte).
const authHeaders: Record<string, string> = {};

function readToken(): string | null {
  return typeof window !== "undefined" &&
    (window as any).localStorage &&
    typeof (window as any).localStorage.getItem === "function"
    ? (window as any).localStorage.getItem("token")
    : null;
}

export function getEcho(): any {
  const token = readToken();
  authHeaders.Authorization = token ? `Bearer ${token}` : "";
  if (echoInstance) return echoInstance;
  const key =
    import.meta.env.VITE_REVERB_APP_KEY || import.meta.env.VITE_PUSHER_KEY;
  const host =
    import.meta.env.VITE_REVERB_HOST ||
    import.meta.env.VITE_PUSHER_HOST ||
    window.location.hostname;
  const port =
    Number(import.meta.env.VITE_REVERB_PORT) ||
    Number(import.meta.env.VITE_PUSHER_PORT) ||
    6001;
  const scheme = (import.meta.env.VITE_REVERB_SCHEME ||
    (import.meta.env.VITE_PUSHER_FORCE_TLS === "true"
      ? "https"
      : "http")) as string;
  const forceTLS =
    scheme === "https" || import.meta.env.VITE_REVERB_SCHEME === "https";

  (window as any).Pusher = Pusher;
  echoInstance = new Echo({
    broadcaster: "pusher", // Reverb parle le protocole Pusher
    key,
    cluster:
      import.meta.env.VITE_REVERB_CLUSTER ||
      import.meta.env.VITE_PUSHER_CLUSTER,
    wsHost: host,
    // Ne pas passer le port quand c'est le port par défaut (80 pour ws, 443 pour wss)
    // pusher-js ajoute "/:PORT/" dans le chemin URL quand le port est explicitément défini
    // Ex: wssPort=443 -> wss://host/:443/app/key  (incorrect)
    // Solution: passer undefined pour les ports standard -> wss://host/app/key  (correct)
    wsPort: !forceTLS && port !== 80 ? port : undefined,
    wssPort: forceTLS && port !== 443 ? port : undefined,
    forceTLS,
    disableStats: true,
    enabledTransports: ["ws", "wss"],
    authEndpoint: `${import.meta.env.VITE_API_BASE_URL || ""}/api/broadcasting/auth`,
    auth: { headers: authHeaders },
  });
  return echoInstance;
}

/** À appeler à la déconnexion : ferme la socket et oublie les abonnements. */
export function disconnectEcho(): void {
  if (!echoInstance) return;
  try {
    echoInstance.disconnect();
  } catch (_) {
    // socket déjà fermée
  }
  echoInstance = null;
}
