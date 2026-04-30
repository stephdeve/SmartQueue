import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ticketsApi, Ticket, CreateTicketData } from '../api/ticketsApi';
import { shallow } from 'zustand/shallow';
import { useUserStatsStore } from './userStatsStore';

// Types pour le store de tickets
export interface TicketState {
  // État du ticket actif (principal - pour compatibilité)
  activeTicket: Ticket | null;
  activeTickets: Ticket[]; // Tous les tickets actifs
  position: number;
  etaMinutes: number;
  isAlmostThere: boolean;
  isCalled: boolean;
  
  // Rappel (seconde chance)
  hasRecalled: boolean;
  countdownExpiry: Date | null;
  
  // Defer (laisser passer)
  hasDeferred: boolean;
  counterNumber: string | null;
  
  // État de connexion WebSocket
  isConnected: boolean;
  lastUpdate: Date | null;
  
  // État de chargement
  isLoading: boolean;
  isInitialized: boolean; // True once we've fetched from backend
  error: string | null;
  
  // Actions
  setActiveTicket: (ticket: Ticket | null) => void;
  setActiveTickets: (tickets: Ticket[]) => void;
  updatePosition: (position: number, etaMinutes: number) => void;
  markAsCalled: (counterNumber?: string) => void;
  clearCalled: () => void;
  markAsAlmostThere: () => void;
  clearActiveTicket: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  createTicket: (data: CreateTicketData) => Promise<Ticket>;
  cancelTicket: (ticketId: number) => Promise<void>;
  refreshActiveTicket: () => Promise<void>;
  fetchActiveTicket: () => Promise<void>;
  updateTicketStatus: (status: Ticket['status']) => void;
  setWebSocketConnected: (connected: boolean) => void;
  setLastUpdate: (date: Date) => void;
  
  // Rappel actions
  setRecalled: () => void;
  resetRecall: () => void;
  setCountdownExpiry: (expiry: Date | null) => void;
  
  // Defer actions
  setDeferred: () => void;
  resetDeferred: () => void;
}

// Store de tickets avec Zustand
export const useTicketStore = create<TicketState>()(
  persist(
    (set, get) => ({
      // État initial
      activeTicket: null,
      activeTickets: [],
      position: 0,
      etaMinutes: 0,
      isAlmostThere: false,
      isCalled: false,
      hasRecalled: false,
      countdownExpiry: null,
      counterNumber: null,
      hasDeferred: false,
      isConnected: false,
      lastUpdate: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      // Définir le ticket actif
      setActiveTicket: (ticket: Ticket | null) => {
        set({
          activeTicket: ticket,
          position: ticket?.position || 0,
          etaMinutes: ticket?.eta_minutes || 0,
          isAlmostThere: ticket?.position ? ticket.position <= 2 : false,
          isCalled: ticket?.status === 'called',
          isInitialized: true,
          error: null,
        });
      },

      // Définir tous les tickets actifs
      setActiveTickets: (tickets: Ticket[]) => {
        const firstTicket = tickets.length > 0 ? tickets[0] : null;
        set({
          activeTickets: tickets,
          activeTicket: firstTicket,
          position: firstTicket?.position || 0,
          etaMinutes: firstTicket?.eta_minutes || 0,
          isAlmostThere: firstTicket?.position ? firstTicket.position <= 2 : false,
          isCalled: firstTicket?.status === 'called',
          isInitialized: true,
          error: null,
        });
      },

      // Mettre à jour la position et l'ETA
      updatePosition: (position: number, etaMinutes: number) => {
        const { isCalled } = get();
        
        set({
          position,
          etaMinutes,
          isAlmostThere: !isCalled && position <= 2,
          lastUpdate: new Date(),
        });
      },

      // Marquer comme appelé
      markAsCalled: (counterNumber?: string) => {
        // Set countdown expiry to 10 minutes from now
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        set({
          isCalled: true,
          isAlmostThere: false,
          counterNumber: counterNumber || null,
          countdownExpiry: expiry,
          lastUpdate: new Date(),
        });
      },

      // Effacer l'état appelé (fermer l'overlay)
      clearCalled: () => {
        set({
          isCalled: false,
          lastUpdate: new Date(),
        });
      },

      // Marquer comme "presque ton tour"
      markAsAlmostThere: () => {
        set({
          isAlmostThere: true,
          lastUpdate: new Date(),
        });
      },

      // Effacer le ticket actif
      clearActiveTicket: () => {
        set({
          activeTicket: null,
          activeTickets: [],
          position: 0,
          etaMinutes: 0,
          isAlmostThere: false,
          isCalled: false,
          hasRecalled: false,
          countdownExpiry: null,
          counterNumber: null,
          error: null,
        });
      },

      // Définir l'état de chargement
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      // Définir l'erreur
      setError: (error: string | null) => {
        set({ error });
      },

      // Créer un nouveau ticket
      createTicket: async (data: CreateTicketData) => {
        set({ isLoading: true, error: null });

        try {
          const ticket = await ticketsApi.createTicket(data);

          // Handle API response that may be wrapped in {data: {...}}
          const ticketData = (ticket as any)?.data || ticket;
          
          const { activeTickets } = get();

          set({
            activeTicket: ticketData,
            activeTickets: [...activeTickets, ticketData],
            position: ticketData.position || 0,
            etaMinutes: ticketData.eta_minutes || 0,
            isAlmostThere: ticketData.position ? ticketData.position <= 2 : false,
            isCalled: ticketData.status === 'called',
            isLoading: false,
            error: null,
            lastUpdate: new Date(),
          });

          // Record stats for gamification
          const statsStore = useUserStatsStore.getState();
          statsStore.recordTicketCreated({
            service_id: ticketData.service_id,
            establishment_id: ticketData.establishment_id,
            lat: ticketData.establishment?.lat ? Number(ticketData.establishment.lat) : undefined,
            lng: ticketData.establishment?.lng ? Number(ticketData.establishment.lng) : undefined,
          });

          return ticketData;
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || 'Erreur lors de la création du ticket';
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Annuler un ticket
      cancelTicket: async (ticketId: number) => {
        set({ isLoading: true, error: null });

        try {
          await ticketsApi.cancelTicket(ticketId);

          // Effacer le ticket actif si c'est celui qu'on annule
          const { activeTicket, activeTickets } = get();
          if (activeTicket?.id === ticketId) {
            // Remove cancelled ticket from activeTickets array
            const updatedTickets = activeTickets.filter(t => t.id !== ticketId);
            set({
              activeTicket: updatedTickets.length > 0 ? updatedTickets[0] : null,
              activeTickets: updatedTickets,
              position: 0,
              etaMinutes: 0,
              isAlmostThere: false,
              isCalled: false,
              lastUpdate: new Date(),
            });
          } else {
            // Just remove from activeTickets if not the current active one
            const updatedTickets = activeTickets.filter(t => t.id !== ticketId);
            set({
              activeTickets: updatedTickets,
              lastUpdate: new Date(),
            });
          }

          // Record cancellation in stats
          const statsStore = useUserStatsStore.getState();
          statsStore.recordTicketCancelled();

          set({ isLoading: false });
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || 'Erreur lors de l\'annulation du ticket';
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Rafraîchir le ticket actif
      refreshActiveTicket: async () => {
        const { activeTicket } = get();
        
        if (!activeTicket) {
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const updatedTicket = await ticketsApi.getTicket(activeTicket.id);
          
          set({
            activeTicket: updatedTicket,
            position: updatedTicket.position,
            etaMinutes: updatedTicket.eta_minutes,
            isAlmostThere: updatedTicket.position <= 2,
            isCalled: updatedTicket.status === 'called',
            isLoading: false,
            error: null,
            lastUpdate: new Date(),
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || 'Erreur lors du rafraîchissement du ticket';
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Récupérer le ticket actif depuis le backend (pas seulement rafraîchir)
      fetchActiveTicket: async () => {
        set({ isLoading: true, error: null });

        try {
          const tickets = await ticketsApi.getMyActiveTickets();
          console.log('[ticketStore] fetchActiveTicket got tickets:', tickets.length);
          
          if (tickets.length > 0) {
            const firstTicket = tickets[0];
            console.log('[ticketStore] firstTicket:', JSON.stringify(firstTicket).substring(0, 300));
            set({
              activeTickets: tickets,
              activeTicket: firstTicket,
              position: firstTicket.position || 0,
              etaMinutes: firstTicket.eta_minutes || 0,
              isAlmostThere: firstTicket.position ? firstTicket.position <= 2 : false,
              isCalled: firstTicket.status === 'called',
              isLoading: false,
              isInitialized: true,
              error: null,
              lastUpdate: new Date(),
            });
          } else {
            console.log('[ticketStore] No active tickets');
            // Pas de ticket actif
            set({
              activeTickets: [],
              activeTicket: null,
              position: 0,
              etaMinutes: 0,
              isAlmostThere: false,
              isCalled: false,
              isLoading: false,
              isInitialized: true,
              error: null,
              lastUpdate: new Date(),
            });
          }
        } catch (error: any) {
          console.log('[ticketStore] fetchActiveTicket error:', error);
          // 404 = pas de ticket actif, ce n'est pas une erreur
          if (error.response?.status === 404) {
            set({
              activeTickets: [],
              activeTicket: null,
              position: 0,
              etaMinutes: 0,
              isAlmostThere: false,
              isCalled: false,
              isLoading: false,
              isInitialized: true,
              error: null,
              lastUpdate: new Date(),
            });
            return;
          }
          const errorMessage = error.response?.data?.message || 'Erreur lors de la récupération du ticket';
          set({
            isLoading: false,
            isInitialized: true,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Mettre à jour le statut du ticket
      updateTicketStatus: (status: Ticket['status']) => {
        const { activeTicket } = get();
        
        if (activeTicket) {
          const updatedTicket = { ...activeTicket, status };
          
          set({
            activeTicket: updatedTicket,
            isCalled: status === 'called',
            lastUpdate: new Date(),
          });
        }
      },

      setWebSocketConnected: (connected: boolean) => {
        set({ isConnected: connected });
      },

      setLastUpdate: (date: Date) => {
        set({ lastUpdate: date });
      },

      // Rappel actions
      setRecalled: () => {
        // Reset countdown to another 3 minutes
        const expiry = new Date(Date.now() + 3 * 60 * 1000);
        set({
          hasRecalled: true,
          countdownExpiry: expiry,
        });
      },

      resetRecall: () => {
        set({
          hasRecalled: false,
          countdownExpiry: null,
        });
      },

      setCountdownExpiry: (expiry: Date | null) => {
        set({ countdownExpiry: expiry });
      },

      // Defer actions
      setDeferred: () => {
        set({ hasDeferred: true });
      },

      resetDeferred: () => {
        set({ hasDeferred: false });
      },
    }),
    {
      name: 'ticket-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist ticket data - always fetch fresh from backend
      // This prevents showing stale data from previous user sessions
      partialize: (state) => ({
        // Only persist non-user-specific data if needed
        // activeTicket, position, etc. are NOT persisted
      }),
    }
  )
);

// Hooks personnalisés pour le store de tickets
export const useTicket = () => {
  // Use individual selectors for proper reactivity
  const activeTicket = useTicketStore((state) => state.activeTicket);
  const activeTickets = useTicketStore((state) => state.activeTickets);
  const position = useTicketStore((state) => state.position);
  const etaMinutes = useTicketStore((state) => state.etaMinutes);
  const isAlmostThere = useTicketStore((state) => state.isAlmostThere);
  const isCalled = useTicketStore((state) => state.isCalled);
  const hasRecalled = useTicketStore((state) => state.hasRecalled);
  const hasDeferred = useTicketStore((state) => state.hasDeferred);
  const countdownExpiry = useTicketStore((state) => state.countdownExpiry);
  const counterNumber = useTicketStore((state) => state.counterNumber);
  const isConnected = useTicketStore((state) => state.isConnected);
  const lastUpdate = useTicketStore((state) => state.lastUpdate);
  const isLoading = useTicketStore((state) => state.isLoading);
  const isInitialized = useTicketStore((state) => state.isInitialized);
  const error = useTicketStore((state) => state.error);
  
  // Actions - use getState() to avoid subscription
  const actions = useTicketStore.getState();
  
  return {
    // État
    activeTicket,
    activeTickets,
    position,
    etaMinutes,
    isAlmostThere,
    isCalled,
    hasRecalled,
    hasDeferred,
    countdownExpiry,
    counterNumber,
    isConnected,
    lastUpdate,
    isLoading,
    isInitialized,
    error,
    
    // Actions
    setActiveTicket: actions.setActiveTicket,
    setActiveTickets: actions.setActiveTickets,
    updatePosition: actions.updatePosition,
    markAsCalled: actions.markAsCalled,
    clearCalled: actions.clearCalled,
    markAsAlmostThere: actions.markAsAlmostThere,
    clearActiveTicket: actions.clearActiveTicket,
    setLoading: actions.setLoading,
    setError: actions.setError,
    createTicket: actions.createTicket,
    cancelTicket: actions.cancelTicket,
    refreshActiveTicket: actions.refreshActiveTicket,
    fetchActiveTicket: actions.fetchActiveTicket,
    updateTicketStatus: actions.updateTicketStatus,
    setWebSocketConnected: actions.setWebSocketConnected,
    setLastUpdate: actions.setLastUpdate,
    setRecalled: actions.setRecalled,
    resetRecall: actions.resetRecall,
    setCountdownExpiry: actions.setCountdownExpiry,
    setDeferred: actions.setDeferred,
    resetDeferred: actions.resetDeferred,
    
    // Computed properties (reactive because they depend on reactive state)
    hasActiveTicket: activeTicket !== null,
    ticketNumber: activeTicket?.number || '',
    serviceName: activeTicket?.service?.name || '',
    establishmentName: activeTicket?.establishment?.name || '',
    ticketStatus: activeTicket?.status || 'created',
    peopleAhead: Math.max(0, position - 1),
    progressPercentage: position > 0 ? Math.max(0, (1 - position / 10) * 100) : 100,
    timeAgo: lastUpdate 
      ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000 / 60) 
      : 0,
  };
};

export default useTicketStore;
