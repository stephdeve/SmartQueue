/**
 * Extrait un message d'erreur sûr (toujours une chaîne) depuis une erreur axios.
 *
 * Le backend normalise ses erreurs JSON sous la forme :
 *   { error: { code, message, details } }   (ou { error: "..." } pour certains cas)
 *
 * Passer directement `error.response.data.error` à un composant qui le rend
 * (ex. <Text>{message}</Text>) provoque le crash :
 *   "Objects are not valid as a React child (found: object with keys {code, message, details})".
 * Cette fonction garantit qu'on ne manipule jamais qu'une chaîne.
 */
export function getApiErrorMessage(error: any, fallback = 'Une erreur est survenue'): string {
  const data = error?.response?.data;
  const apiError = data?.error ?? data;

  if (typeof apiError === 'string' && apiError.trim().length > 0) {
    return apiError;
  }
  if (apiError && typeof apiError.message === 'string' && apiError.message.trim().length > 0) {
    return apiError.message;
  }
  if (typeof error?.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

export default getApiErrorMessage;
