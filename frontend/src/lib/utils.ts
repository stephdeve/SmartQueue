import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combine plusieurs classes CSS en une seule chaîne
 * @param inputs - Classes CSS à combiner
 * @returns Chaîne de classes CSS fusionnées
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un nombre avec des espaces comme séparateurs de milliers
 * @param num - Nombre à formater
 * @returns Chaîne formatée
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}

/**
 * Formate une date au format local
 * @param date - Date à formater
 * @param options - Options de formatage
 * @returns Date formatée
 */
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
): string {
  return new Date(date).toLocaleDateString('fr-FR', options);
}

/**
 * Génère un identifiant unique
 * @returns Identifiant unique
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Vérifie si la valeur est vide
 * @param value - Valeur à vérifier
 * @returns Vrai si la valeur est vide
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

/**
 * Date locale au format AAAA-MM-JJ (toISOString() donnerait la date UTC :
 * la veille entre minuit et 1 h au Bénin).
 */
export function localDateString(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Lit une date renvoyée par l'API ("2026-10-20 10:00:00" ou ISO 8601).
 * Safari refuse le format avec espace : il est converti en ISO.
 */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(value) ? value.replace(' ', 'T') : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Variation en % entre deux valeurs (null si la période de référence est vide). */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Déclenche le téléchargement d'un fichier reçu de l'API (réponse "blob"). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
