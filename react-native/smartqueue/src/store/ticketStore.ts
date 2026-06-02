import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ticketsApi, Ticket, CreateTicketData } from "../api/ticketsApi";

import { useUserStatsStore } from "./userStatsStore";

// L'overlay "ticket appelé" ne doit s'afficher que tant que l'utilisateur n'a pas
// répondu. Le backend garde status='called' après "en route" (il pose seulement
// en_route_at) ; sans ce filtre, toute resynchro/navigation rouvrait l'overlay.
const isTicketCalled = (ticket: Ticket | null | undefined): boolean =>
  ticket?.status === "called";

const getTicketStatusPriority = (status: Ticket["status"]): number => {
  switch (status) {
    case "present":
      return 0;
    case "called":
      return 1;
    case "en_route":
      return 2;
    case "waiting":
      return 3;
    case "created":
      return 4;
    case "absent":
      return 5;
    default:
      return 4;
  }
};

const sortActiveTickets = (tickets: Ticket[]): Ticket[] => {
  return [...tickets].sort((a, b) => {
    const statusDiff =
      getTicketStatusPriority(a.status) - getTicketStatusPriority(b.status);
    if (statusDiff !== 0) return statusDiff;

    const aPosition =
      typeof a.position === "number" ? a.position : Number.MAX_SAFE_INTEGER;
    const bPosition =
      typeof b.position === "number" ? b.position : Number.MAX_SAFE_INTEGER;
    if (aPosition !== bPosition) return aPosition - bPosition;

    const aEta =
      typeof a.eta_minutes === "number"
        ? a.eta_minutes
        : Number.MAX_SAFE_INTEGER;
    const bEta =
      typeof b.eta_minutes === "number"
        ? b.eta_minutes
        : Number.MAX_SAFE_INTEGER;
    if (aEta !== bEta) return aEta - bEta;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

const buildPrimaryTicketState = (tickets: Ticket[]) => {
  const sortedTickets = sortActiveTickets(tickets);
  const primaryTicket = sortedTickets.length > 0 ? sortedTickets[0] : null;

  return {
    activeTickets: sortedTickets,
    activeTicket: primaryTicket,
    position: primaryTicket?.position || 0,
    etaMinutes: primaryTicket?.eta_minutes || 0,
    isAlmostThere: primaryTicket?.position
      ? primaryTicket.position <= 2
      : false,
    isCalled: isTicketCalled(primaryTicket),
  };
};

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
  updateTicketStatus: (status: Ticket["status"]) => void;
  setWebSocketConnected: (connected: boolean) => void;
  setLastUpdate: (date: Date) => void;

  // Rappel actions
  markEnRoute: () => void;
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
          isCalled: isTicketCalled(ticket),
          isInitialized: true,
          error: null,
        });
      },

      // Définir tous les tickets actifs
      setActiveTickets: (tickets: Ticket[]) => {
        set({
          ...buildPrimaryTicketState(tickets),
          isInitialized: true,
          error: null,
        });
      },

      // Mettre à jour la position et l'ETA
      // Correction : met aussi à jour activeTicket pour que tous les composants
      // qui lisent activeTicket.position/eta_minutes voient la valeur fraîche.
      updatePosition: (position: number, etaMinutes: number) => {
        const { activeTicket, activeTickets } = get();
        const updatedTickets = sortActiveTickets(
          activeTickets.map((t) =>
            t.id === activeTicket?.id
              ? { ...t, position, eta_minutes: etaMinutes }
              : t,
          ),
        );

        set({
          ...buildPrimaryTicketState(updatedTickets),
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

      // Marquer "en route" localement : pose en_route_at sur le ticket pour que
      // l'overlay ne se rouvre plus après une resynchro/navigation (feedback
      // instantané, sans attendre le prochain fetch depuis le backend).
      markEnRoute: () => {
        const { activeTicket, activeTickets } = get();
        if (!activeTicket) {
          set({ isCalled: false, lastUpdate: new Date() });
          return;
        }
        const enRouteAt = new Date().toISOString();
        const updatedTicket = {
          ...activeTicket,
          status: "en_route" as const,
          en_route_at: enRouteAt,
        };
        set({
          activeTicket: updatedTicket,
          activeTickets: activeTickets.map((t) =>
            t.id === activeTicket.id
              ? { ...t, status: "en_route" as const, en_route_at: enRouteAt }
              : t,
          ),
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
          const nextTickets = [...activeTickets, ticketData];

          set({
            ...buildPrimaryTicketState(nextTickets),
            isLoading: false,
            error: null,
            lastUpdate: new Date(),
          });

          // Record stats for gamification
          const statsStore = useUserStatsStore.getState();
          statsStore.recordTicketCreated({
            service_id: ticketData.service_id,
            establishment_id: ticketData.establishment_id,
            lat: ticketData.establishment?.lat
              ? Number(ticketData.establishment.lat)
              : undefined,
            lng: ticketData.establishment?.lng
              ? Number(ticketData.establishment.lng)
              : undefined,
          });

          return ticketData;
        } catch (error: any) {
          const errorMessage =
            error.response?.data?.message ||
            "Erreur lors de la création du ticket";
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
          const { activeTickets } = get();
          const updatedTickets = activeTickets.filter((t) => t.id !== ticketId);

          set({
            ...buildPrimaryTicketState(updatedTickets),
            lastUpdate: new Date(),
          });

          // Record cancellation in stats
          const statsStore = useUserStatsStore.getState();
          statsStore.recordTicketCancelled();

          set({ isLoading: false });
        } catch (error: any) {
          const errorMessage =
            error.response?.data?.message ||
            "Erreur lors de l'annulation du ticket";
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

          const { activeTickets } = get();
          const updatedTickets = sortActiveTickets(
            activeTickets.map((ticket) =>
              ticket.id === updatedTicket.id ? updatedTicket : ticket,
            ),
          );

          set({
            ...buildPrimaryTicketState(updatedTickets),
            isLoading: false,
            error: null,
            lastUpdate: new Date(),
          });
        } catch (error: any) {
          const errorMessage =
            error.response?.data?.message ||
            "Erreur lors du rafraîchissement du ticket";
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
          console.log(
            "[ticketStore] fetchActiveTicket got tickets:",
            tickets.length,
          );

          if (tickets.length > 0) {
            const currentState = get();
            const localTicketsById = new Map(
              currentState.activeTickets.map((ticket) => [ticket.id, ticket]),
            );

            const mergedTickets = tickets.map((ticket) => {
              const localTicket = localTicketsById.get(ticket.id);
              return {
                ...ticket,
                en_route_at:
                  ticket.en_route_at ?? localTicket?.en_route_at ?? null,
              };
            });

            const primaryTicket =
              buildPrimaryTicketState(mergedTickets).activeTicket;
            console.log(
              "[ticketStore] firstTicket:",
              JSON.stringify(primaryTicket).substring(0, 300),
            );

            set({
              ...buildPrimaryTicketState(mergedTickets),
              isLoading: false,
              isInitialized: true,
              error: null,
              lastUpdate: new Date(),
            });
          } else {
            console.log("[ticketStore] No active tickets");
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
          console.log("[ticketStore] fetchActiveTicket error:", error);
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
          const errorMessage =
            error.response?.data?.message ||
            "Erreur lors de la récupération du ticket";
          set({
            isLoading: false,
            isInitialized: true,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Mettre à jour le statut du ticket (feedback instantané ; une
      // re-synchronisation complète via fetchActiveTicket suit côté socket).
      updateTicketStatus: (status: Ticket["status"]) => {
        const { activeTicket, activeTickets } = get();

        if (activeTicket) {
          // Un nouvel appel (status 'called') réinitialise en_route_at pour rouvrir
          // l'overlay ; sinon on conserve la valeur existante.
          const updatedTicket: Ticket = {
            ...activeTicket,
            status,
            en_route_at: status === "called" ? null : activeTicket.en_route_at,
          };

          const updatedTickets = sortActiveTickets(
            activeTickets.map((t) =>
              t.id === activeTicket.id
                ? {
                    ...t,
                    status: updatedTicket.status,
                    en_route_at: updatedTicket.en_route_at,
                  }
                : t,
            ),
          );

          set({
            ...buildPrimaryTicketState(updatedTickets),
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
      name: "ticket-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist ticket data - always fetch fresh from backend
      // This prevents showing stale data from previous user sessions
      partialize: (state) => ({
        // Only persist non-user-specific data if needed
        // activeTicket, position, etc. are NOT persisted
      }),
    },
  ),
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
    markEnRoute: actions.markEnRoute,
    setRecalled: actions.setRecalled,
    resetRecall: actions.resetRecall,
    setCountdownExpiry: actions.setCountdownExpiry,
    setDeferred: actions.setDeferred,
    resetDeferred: actions.resetDeferred,

    // Computed properties (reactive because they depend on reactive state)
    hasActiveTicket: activeTicket !== null,
    ticketNumber: activeTicket?.number || "",
    serviceName: activeTicket?.service?.name || "",
    establishmentName: activeTicket?.establishment?.name || "",
    ticketStatus: activeTicket?.status || "created",
    peopleAhead: Math.max(0, position - 1),
    progressPercentage:
      position > 0 ? Math.max(0, (1 - position / 10) * 100) : 100,
    timeAgo: lastUpdate
      ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000 / 60)
      : 0,
  };
};

export default useTicketStore;
