import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ticketsApi, TicketStats } from '../api/ticketsApi';

// Badge types
export type BadgeType = 
  | 'FIRST_TICKET'           // Premier ticket pris
  | 'REGULAR_USER'           // 10 tickets
  | 'QUEUE_MASTER'           // 50 tickets
  | 'QUEUE_LEGEND'           // 100 tickets
  | 'TIME_SAVER_BRONZE'      // 1h économisée
  | 'TIME_SAVER_SILVER'      // 5h économisée
  | 'TIME_SAVER_GOLD'        // 10h économisée
  | 'TIME_SAVER_PLATINUM'    // 24h économisée
  | 'EARLY_BIRD'             // 5 tickets avant 8h
  | 'NIGHT_OWL'              // 5 tickets après 18h
  | 'MULTI_SERVICE'          // 5 services différents
  | 'LOYAL_CUSTOMER'         // 10x même établissement
  | 'QUICK_RESPONSE'         // Confirmé présence < 2min
  | 'PERFECT_TIMING'         // Arrivé pile au bon moment
  | 'WEEKEND_WARRIOR';       // 3 tickets weekend

export interface Badge {
  type: BadgeType;
  name: string;
  description: string;
  icon: string; // Ionicons name
  color: string;
  unlockedAt?: Date;
  progress: number; // 0-100
  maxProgress: number;
}

export interface UserStats {
  // Time saved (calculated vs traditional queue waiting)
  totalTimeSavedMinutes: number;
  
  // Distance traveled
  totalDistanceKm: number;
  
  // Tickets
  totalTicketsCreated: number;
  totalTicketsCompleted: number;
  totalTicketsCancelled: number;
  
  // Establishments & Services
  uniqueEstablishmentsVisited: number[];
  uniqueServicesUsed: number[];
  favoriteEstablishmentId?: number;
  
  // Timing patterns
  earlyBirdCount: number; // Tickets before 8am
  nightOwlCount: number; // Tickets after 6pm
  weekendTickets: number;
  perfectTimingCount: number; // Arrived exactly on time
  
  // Engagement
  perfectResponseCount: number; // Confirmed presence quickly
  streakDays: number; // Consecutive days using app
  lastUsedDate?: Date;
  
  // History for charts
  weeklyActivity: number[]; // Last 7 days ticket count
  monthlyStats: {
    month: string;
    tickets: number;
    timeSaved: number;
  }[];
}

interface UserStatsState extends UserStats {
  // State
  isLoading: boolean;
  error: string | null;
  badges: Badge[];
  
  // Computed
  currentLevel: number;
  xpPoints: number;
  nextLevelXp: number;
  
  // Actions
  recordTicketCreated: (ticket: { service_id: number; establishment_id: number; lat?: number; lng?: number }) => void;
  recordTicketCompleted: (ticket: { id: number; eta_minutes: number; wait_time_actual?: number }) => void;
  recordTicketCancelled: () => void;
  recordPresenceConfirmed: (responseTimeSeconds: number) => void;
  recordArrival: (accuracy: 'early' | 'perfect' | 'late') => void;
  recordDistanceTraveled: (km: number) => void;
  checkAndUnlockBadges: () => void;
  loadStatsFromBackend: () => Promise<void>;
  syncStatsToBackend: () => Promise<void>;
  getRankTitle: () => string;
}

// Badge definitions
const BADGE_DEFINITIONS: Omit<Badge, 'progress' | 'unlockedAt'>[] = [
  {
    type: 'FIRST_TICKET',
    name: 'Premier Pas',
    description: 'Votre premier ticket SmartQueue',
    icon: 'footsteps',
    color: '#10B981',
    maxProgress: 1,
  },
  {
    type: 'REGULAR_USER',
    name: 'Utilisateur Régulier',
    description: '10 tickets créés',
    icon: 'calendar',
    color: '#3B82F6',
    maxProgress: 10,
  },
  {
    type: 'QUEUE_MASTER',
    name: 'Maître de File',
    description: '50 tickets créés',
    icon: 'trophy',
    color: '#8B5CF6',
    maxProgress: 50,
  },
  {
    type: 'QUEUE_LEGEND',
    name: 'Légende des Files',
    description: '100 tickets créés',
    icon: 'crown',
    color: '#F59E0B',
    maxProgress: 100,
  },
  {
    type: 'TIME_SAVER_BRONZE',
    name: 'Économiste Bronze',
    description: '1 heure économisée',
    icon: 'hourglass',
    color: '#CD7F32',
    maxProgress: 60,
  },
  {
    type: 'TIME_SAVER_SILVER',
    name: 'Économiste Argent',
    description: '5 heures économisées',
    icon: 'hourglass',
    color: '#C0C0C0',
    maxProgress: 300,
  },
  {
    type: 'TIME_SAVER_GOLD',
    name: 'Économiste Or',
    description: '10 heures économisées',
    icon: 'hourglass',
    color: '#FFD700',
    maxProgress: 600,
  },
  {
    type: 'TIME_SAVER_PLATINUM',
    name: 'Économiste Platine',
    description: '24 heures économisées',
    icon: 'hourglass',
    color: '#E5E4E2',
    maxProgress: 1440,
  },
  {
    type: 'EARLY_BIRD',
    name: 'Lève-tôt',
    description: '5 tickets avant 8h',
    icon: 'sunny',
    color: '#F97316',
    maxProgress: 5,
  },
  {
    type: 'NIGHT_OWL',
    name: 'Couche-tard',
    description: '5 tickets après 18h',
    icon: 'moon',
    color: '#6366F1',
    maxProgress: 5,
  },
  {
    type: 'MULTI_SERVICE',
    name: 'Multi-Services',
    description: '5 services différents utilisés',
    icon: 'apps',
    color: '#14B8A6',
    maxProgress: 5,
  },
  {
    type: 'LOYAL_CUSTOMER',
    name: 'Client Fidèle',
    description: '10 visites au même établissement',
    icon: 'heart',
    color: '#EC4899',
    maxProgress: 10,
  },
  {
    type: 'QUICK_RESPONSE',
    name: 'Réactif',
    description: 'Confirmé présence en moins de 2 min',
    icon: 'flash',
    color: '#06B6D4',
    maxProgress: 5,
  },
  {
    type: 'PERFECT_TIMING',
    name: 'Timing Parfait',
    description: 'Arrivé pile au bon moment',
    icon: 'time',
    color: '#84CC16',
    maxProgress: 10,
  },
  {
    type: 'WEEKEND_WARRIOR',
    name: 'Guerrier du Weekend',
    description: '3 tickets le weekend',
    icon: 'game-controller',
    color: '#A855F7',
    maxProgress: 3,
  },
];

// Calculate XP based on stats
const calculateXP = (stats: UserStats): number => {
  let xp = 0;
  xp += stats.totalTicketsCreated * 10;
  xp += stats.totalTicketsCompleted * 20;
  xp += Math.floor(stats.totalTimeSavedMinutes / 10) * 5;
  xp += stats.uniqueEstablishmentsVisited.length * 50;
  xp += stats.perfectTimingCount * 15;
  xp += stats.perfectResponseCount * 10;
  return xp;
};

// Calculate level from XP
const calculateLevel = (xp: number): { level: number; nextLevelXp: number } => {
  let level = 1;
  let required = 100;
  
  while (xp >= required && level < 50) {
    xp -= required;
    level++;
    required = Math.floor(required * 1.2);
  }
  
  return { level, nextLevelXp: required };
};

// Get rank title
const getRankTitle = (level: number): string => {
  if (level < 5) return 'Débutant';
  if (level < 10) return 'Habitué';
  if (level < 15) return 'Expert';
  if (level < 20) return 'Maître';
  if (level < 30) return 'Légende';
  return 'Immortel';
};

const initialStats: UserStats = {
  totalTimeSavedMinutes: 0,
  totalDistanceKm: 0,
  totalTicketsCreated: 0,
  totalTicketsCompleted: 0,
  totalTicketsCancelled: 0,
  uniqueEstablishmentsVisited: [],
  uniqueServicesUsed: [],
  earlyBirdCount: 0,
  nightOwlCount: 0,
  weekendTickets: 0,
  perfectTimingCount: 0,
  perfectResponseCount: 0,
  streakDays: 0,
  weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
  monthlyStats: [],
};

export const useUserStatsStore = create<UserStatsState>()(
  persist(
    (set, get) => ({
      ...initialStats,
      isLoading: false,
      error: null,
      badges: BADGE_DEFINITIONS.map(b => ({ ...b, progress: 0 })),
      currentLevel: 1,
      xpPoints: 0,
      nextLevelXp: 100,

      recordTicketCreated: (ticket) => {
        console.log('[UserStats] Recording ticket created:', ticket);
        const state = get();
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        const isWeekend = day === 0 || day === 6;

        // Update weekly activity
        const weeklyActivity = [...state.weeklyActivity];
        weeklyActivity[6]++; // Today is at index 6

        // Check early bird / night owl
        let earlyBirdCount = state.earlyBirdCount;
        let nightOwlCount = state.nightOwlCount;
        let weekendTickets = state.weekendTickets;

        if (hour < 8) earlyBirdCount++;
        if (hour >= 18) nightOwlCount++;
        if (isWeekend) weekendTickets++;

        // Update unique establishments/services
        const uniqueEstablishments = new Set(state.uniqueEstablishmentsVisited);
        uniqueEstablishments.add(ticket.establishment_id);
        
        const uniqueServices = new Set(state.uniqueServicesUsed);
        uniqueServices.add(ticket.service_id);

        // Update streak
        const today = now.toDateString();
        const lastDate = state.lastUsedDate?.toDateString();
        let streakDays = state.streakDays;
        
        if (lastDate !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          
          if (lastDate === yesterday.toDateString()) {
            streakDays++;
          } else {
            streakDays = 1;
          }
        }

        const newStats = {
          ...state,
          totalTicketsCreated: state.totalTicketsCreated + 1,
          uniqueEstablishmentsVisited: Array.from(uniqueEstablishments),
          uniqueServicesUsed: Array.from(uniqueServices),
          earlyBirdCount,
          nightOwlCount,
          weekendTickets,
          streakDays,
          lastUsedDate: now,
          weeklyActivity,
        };

        const xp = calculateXP(newStats);
        const { level, nextLevelXp } = calculateLevel(xp);

        set({
          ...newStats,
          xpPoints: xp,
          currentLevel: level,
          nextLevelXp,
        });

        console.log('[UserStats] Updated after creation - Level:', level, 'XP:', xp, 'Tickets:', newStats.totalTicketsCreated);

        get().checkAndUnlockBadges();
      },

      recordTicketCompleted: (ticket) => {
        const state = get();
        
        // Estimate time saved: traditional wait (position * avg 5 min) vs actual
        const estimatedTraditionalWait = ticket.eta_minutes * 1.5; // Usually longer
        const timeSaved = Math.max(0, estimatedTraditionalWait - (ticket.wait_time_actual || 0));

        const newStats = {
          ...state,
          totalTicketsCompleted: state.totalTicketsCompleted + 1,
          totalTimeSavedMinutes: state.totalTimeSavedMinutes + timeSaved,
        };

        const xp = calculateXP(newStats);
        const { level, nextLevelXp } = calculateLevel(xp);

        set({
          ...newStats,
          xpPoints: xp,
          currentLevel: level,
          nextLevelXp,
        });

        get().checkAndUnlockBadges();
      },

      recordTicketCancelled: () => {
        const state = get();
        set({
          totalTicketsCancelled: state.totalTicketsCancelled + 1,
        });
      },

      recordPresenceConfirmed: (responseTimeSeconds) => {
        const state = get();
        let perfectResponseCount = state.perfectResponseCount;
        
        if (responseTimeSeconds < 120) { // Less than 2 minutes
          perfectResponseCount++;
        }

        const newStats = {
          ...state,
          perfectResponseCount,
        };

        set(newStats);
        get().checkAndUnlockBadges();
      },

      recordArrival: (accuracy) => {
        const state = get();
        
        if (accuracy === 'perfect') {
          set({
            perfectTimingCount: state.perfectTimingCount + 1,
          });
          get().checkAndUnlockBadges();
        }
      },

      recordDistanceTraveled: (km) => {
        const state = get();
        set({
          totalDistanceKm: state.totalDistanceKm + km,
        });
      },

      checkAndUnlockBadges: () => {
        const state = get();
        const newBadges = state.badges.map(badge => {
          let progress = 0;

          switch (badge.type) {
            case 'FIRST_TICKET':
              progress = Math.min(badge.maxProgress, state.totalTicketsCreated);
              break;
            case 'REGULAR_USER':
              progress = Math.min(badge.maxProgress, state.totalTicketsCreated);
              break;
            case 'QUEUE_MASTER':
              progress = Math.min(badge.maxProgress, state.totalTicketsCreated);
              break;
            case 'QUEUE_LEGEND':
              progress = Math.min(badge.maxProgress, state.totalTicketsCreated);
              break;
            case 'TIME_SAVER_BRONZE':
            case 'TIME_SAVER_SILVER':
            case 'TIME_SAVER_GOLD':
            case 'TIME_SAVER_PLATINUM':
              progress = Math.min(badge.maxProgress, state.totalTimeSavedMinutes);
              break;
            case 'EARLY_BIRD':
              progress = Math.min(badge.maxProgress, state.earlyBirdCount);
              break;
            case 'NIGHT_OWL':
              progress = Math.min(badge.maxProgress, state.nightOwlCount);
              break;
            case 'MULTI_SERVICE':
              progress = Math.min(badge.maxProgress, state.uniqueServicesUsed.length);
              break;
            case 'LOYAL_CUSTOMER':
              // Count max visits to single establishment
              progress = badge.progress; // Simplified
              break;
            case 'QUICK_RESPONSE':
              progress = Math.min(badge.maxProgress, state.perfectResponseCount);
              break;
            case 'PERFECT_TIMING':
              progress = Math.min(badge.maxProgress, state.perfectTimingCount);
              break;
            case 'WEEKEND_WARRIOR':
              progress = Math.min(badge.maxProgress, state.weekendTickets);
              break;
          }

          const isNewlyUnlocked = progress >= badge.maxProgress && !badge.unlockedAt;

          return {
            ...badge,
            progress,
            unlockedAt: isNewlyUnlocked ? new Date() : badge.unlockedAt,
          };
        });

        set({ badges: newBadges });
      },

      loadStatsFromBackend: async () => {
        set({ isLoading: true, error: null });
        try {
          const stats = await ticketsApi.getTicketStats();
          // Merge with local stats
          set({
            isLoading: false,
            totalTicketsCreated: stats.total_tickets,
          });
        } catch (error) {
          set({ isLoading: false, error: 'Failed to load stats' });
        }
      },

      syncStatsToBackend: async () => {
        // Future: sync to backend
      },

      getRankTitle: () => {
        return getRankTitle(get().currentLevel);
      },
    }),
    {
      name: 'user-stats',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useUserStatsStore;
