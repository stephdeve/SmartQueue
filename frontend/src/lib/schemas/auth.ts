/**
 * Schémas de validation Zod pour l'authentification
 * Basés sur les règles de validation du backend Laravel
 */
import { z } from 'zod'

// Schéma pour l'inscription (RegisterRequest)
export const signupSchema = z.object({
  name: z
    .string()
    .min(1, 'Le nom est requis')
    .max(120, 'Le nom ne doit pas dépasser 120 caractères'),
  email: z
    .string()
    .min(1, 'L\'email est requis')
    .email('L\'email n\'est pas valide')
    .max(190, 'L\'email ne doit pas dépasser 190 caractères'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .max(255, 'Le mot de passe ne doit pas dépasser 255 caractères'),
  password_confirmation: z
    .string()
    .min(1, 'La confirmation du mot de passe est requise'),
  phone: z
    .string()
    .max(32, 'Le téléphone ne doit pas dépasser 32 caractères')
    .optional()
    .or(z.literal('')),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['password_confirmation'],
})

// Schéma pour la connexion (LoginRequest)
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'L\'email est requis')
    .email('L\'email n\'est pas valide'),
  password: z
    .string()
    .min(1, 'Le mot de passe est requis'),
})

// Schéma pour l'inscription établissement (OnboardingRegisterEstablishmentRequest)
export const registerEstablishmentSchema = z.object({
  admin_name: z
    .string()
    .min(1, 'Le nom de l\'administrateur est requis')
    .max(120, 'Le nom ne doit pas dépasser 120 caractères'),
  admin_email: z
    .string()
    .min(1, 'L\'email de l\'administrateur est requis')
    .email('L\'email n\'est pas valide')
    .max(190, 'L\'email ne doit pas dépasser 190 caractères'),
  admin_password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .max(255, 'Le mot de passe ne doit pas dépasser 255 caractères'),
  admin_password_confirmation: z
    .string()
    .min(1, 'La confirmation du mot de passe est requise'),
  admin_phone: z
    .string()
    .max(32, 'Le téléphone ne doit pas dépasser 32 caractères')
    .optional()
    .or(z.literal('')),
  
  // Champs de l'établissement (vides pour l'inscription, remplis plus tard)
  establishment_name: z
    .string()
    .max(160, 'Le nom ne doit pas dépasser 160 caractères')
    .optional(),
  establishment_address: z
    .string()
    .optional(),
  establishment_lat: z
    .number()
    .min(-90, 'La latitude doit être entre -90 et 90')
    .max(90, 'La latitude doit être entre -90 et 90')
    .optional(),
  establishment_lng: z
    .number()
    .min(-180, 'La longitude doit être entre -180 et 180')
    .max(180, 'La longitude doit être entre -180 et 180')
    .optional(),
  establishment_open_at: z
    .string()
    .optional(),
  establishment_close_at: z
    .string()
    .optional(),
}).refine((data) => data.admin_password === data.admin_password_confirmation, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['admin_password_confirmation'],
})

// Schéma pour la souscription (onboarding/subscribe)
export const subscribeSchema = z.object({
  plan: z
    .string()
    .min(1, 'Le plan est requis')
    .max(32, 'Le plan ne doit pas dépasser 32 caractères'),
  billing_cycle: z.enum(['month', 'year']).optional(),
})

// Types dérivés des schémas
export type SignupFormData = z.infer<typeof signupSchema>
export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterEstablishmentFormData = z.infer<typeof registerEstablishmentSchema>
export type SubscribeFormData = z.infer<typeof subscribeSchema>

// Types pour les données du formulaire (avec champs optionnels pour le formulaire)
export type SignupFormState = Partial<SignupFormData>
export type RegisterEstablishmentFormState = Partial<RegisterEstablishmentFormData>

// Réponses API
export interface AuthResponse {
  user: {
    id: number
    name: string
    email: string
    phone?: string | null
    role: 'admin' | 'agent' | 'user' | 'super_admin'
    establishment_id?: number | null
    pending_subscription?: any
  }
  token: string
}

export interface OnboardingResponse extends AuthResponse {
  next_step: 'subscription' | 'create_establishment'
}

export interface SubscribeResponse {
  pending_subscription: {
    status: 'active' | 'trial' | 'past_due' | 'canceled'
    plan: string
    paid_at: string
    source: string
  }
  next_step: 'create_establishment'
}
