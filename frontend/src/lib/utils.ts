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
