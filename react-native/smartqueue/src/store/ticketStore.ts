import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ticketsApi, Ticket, CreateTicketData } from "../api/ticketsApi";

import { useUserStatsStore } from "./userStatsStore";
import { useOfflineStore } from "./offlineStore";

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

// Filtrer les tickets terminés ou absents
const filterActiveTickets = (tickets: Ticket[]): Ticket[] => {
  return tickets.filter(ticket =>
    ticket.status !== 'absent' &&
    ticket.status !== 'closed' &&
    ticket.status !== 'served'
  );
};

const buildPrimaryTicketState = (tickets: Ticket[]) => {
  // Ne garder que les tickets actifs (status différent de 'absent')
  const activeTickets = filterActiveTickets(tickets);
  const sortedTickets = sortActiveTickets(activeTickets);
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
  activeTickets: Ticket[];
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
  isInitialized: boolean;
  error: string | null;

  // Actions
  setActiveTicket: (ticket: Ticket | null) => void;
  setActiveTickets: (tickets: Ticket[]) => void;
  updatePosition: (position: number, etaMinutes: number, ticketId?: number) => void;
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
  updateTicketStatus: (status: Ticket["status"], ticketId?: number) => void;
  setWebSocketConnected: (connected: boolean) => void;
  setLastUpdate: (date: Date) => void;
  removeExpiredTicket: (ticketId: number) => void;

  // Rappel actions
  markEnRoute: () => void;
  markPresent: () => void;
  setRecalled: () => void;
  resetRecall: () => void;
  setCountdownExpiry: (expiry: Date | null) => void;

  // Defer actions
  setDeferred: () => void;
  resetDeferred: () => void;

  // Évaluation post-service
  pendingReviewTicket: { id: number; serviceName: string } | null;
  setPendingReviewTicket: (ticket: { id: number; serviceName: string } | null) => void;
}

// Store de tickets avec Zustand
export const useTicketStore = create<TicketState>()(
  persist(
    (set, get) => ({
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
      pendingReviewTicket: null,

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

      setActiveTickets: (tickets: Ticket[]) => {
        set({
          ...buildPrimaryTicketState(tickets),
          isInitialized: true,
          error: null,
        });
      },

      updatePosition: (position: number, etaMinutes: number, ticketId?: number) => {
        const { activeTicket, activeTickets } = get();
        const targetId = ticketId ?? activeTicket?.id;
        const updatedTickets = sortActiveTickets(
          activeTickets.map((t) =>
            t.id === targetId
              ? { ...t, position, eta_minutes: etaMinutes }
              : t,
          ),
        );

        set({
          ...buildPrimaryTicketState(updatedTickets),
          lastUpdate: new Date(),
        });
      },

      markAsCalled: (counterNumber?: string) => {
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        set({
          isCalled: true,
          isAlmostThere: false,
          counterNumber: counterNumber || null,
          countdownExpiry: expiry,
          lastUpdate: new Date(),
        });
      },

      clearCalled: () => {
        set({
          isCalled: false,
          lastUpdate: new Date(),
        });
      },

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

      markPresent: () => {
        const { activeTicket, activeTickets } = get();
        if (!activeTicket) {
          set({ isCalled: false, lastUpdate: new Date() });
          return;
        }
        const presentAt = new Date().toISOString();
        const updatedTicket = {
          ...activeTicket,
          status: "present" as const,
          present_at: presentAt,
          response_received_at: presentAt,
        };
        set({
          activeTicket: updatedTicket,
          activeTickets: activeTickets.map((t) =>
            t.id === activeTicket.id
              ? {
                  ...t,
                  status: "present" as const,
                  present_at: presentAt,
                  response_received_at: presentAt,
                }
              : t,
          ),
          isCalled: false,
          lastUpdate: new Date(),
        });
      },

      markAsAlmostThere: () => {
        set({
          isAlmostThere: true,
          lastUpdate: new Date(),
        });
      },

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

      removeExpiredTicket: (ticketId: number) => {
        const { activeTickets } = get();
        const updatedTickets = activeTickets.filter(t => t.id !== ticketId);
        
        set({
          ...buildPrimaryTicketState(updatedTickets),
          lastUpdate: new Date(),
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      createTicket: async (data: CreateTicketData) => {
        set({ isLoading: true, error: null });

        try {
          const ticket = await ticketsApi.createTicket(data);
          const ticketData = (ticket as any)?.data || ticket;

          const { activeTickets } = get();
          const nextTickets = [...activeTickets, ticketData];

          set({
            ...buildPrimaryTicketState(nextTickets),
            isLoading: false,
            error: null,
            lastUpdate: new Date(),
          });

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

      cancelTicket: async (ticketId: number) => {
        set({ isLoading: true, error: null });

        try {
          await ticketsApi.cancelTicket(ticketId);

          const { activeTickets } = get();
          const updatedTickets = activeTickets.filter((t) => t.id !== ticketId);

          set({
            ...buildPrimaryTicketState(updatedTickets),
            lastUpdate: new Date(),
          });

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

      fetchActiveTicket: async () => {
        set({ isLoading: true, error: null });

        try {
          const tickets = await ticketsApi.getMyActiveTickets();
          console.log("[ticketStore] fetchActiveTicket got tickets:", tickets.length);

          const activeOnly = tickets.filter(t =>
            t.status !== 'absent' && t.status !== 'closed' && t.status !== 'served'
          );
          
          if (activeOnly.length > 0) {
            const currentState = get();
            const localTicketsById = new Map(
              currentState.activeTickets.map((ticket) => [ticket.id, ticket]),
            );

            const mergedTickets = activeOnly.map((ticket) => {
              const localTicket = localTicketsById.get(ticket.id);
              return {
                ...ticket,
                en_route_at:
                  ticket.en_route_at ?? localTicket?.en_route_at ?? null,
              };
            });

            set({
              ...buildPrimaryTicketState(mergedTickets),
              isLoading: false,
              isInitialized: true,
              error: null,
              lastUpdate: new Date(),
            });
            useOfflineStore.getState().setLastSyncAt(new Date().toISOString());
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
            useOfflineStore.getState().setLastSyncAt(new Date().toISOString());
          }
        } catch (error: any) {
          console.log("[ticketStore] fetchActiveTicket error:", error);

          if (!error.response) {
            set({ isLoading: false, isInitialized: true, error: null });
            return;
          }

          if (error.response.status === 404) {
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
            useOfflineStore.getState().setLastSyncAt(new Date().toISOString());
            return;
          }

          const errorMessage =
            error.response?.data?.message ||
            "Erreur lors de la récupération du ticket";
          set({ isLoading: false, isInitialized: true, error: errorMessage });
          throw error;
        }
      },

      updateTicketStatus: (status: Ticket["status"], ticketId?: number) => {
        const { activeTicket, activeTickets } = get();
        const targetId = ticketId ?? activeTicket?.id;
        if (!targetId) return;

        if (status === 'absent') {
          const updatedTickets = activeTickets.filter(t => t.id !== targetId);
          set({
            ...buildPrimaryTicketState(updatedTickets),
            lastUpdate: new Date(),
          });
          return;
        }

        const updatedTickets = sortActiveTickets(
          activeTickets.map((t) => {
            if (t.id !== targetId) return t;
            return {
              ...t,
              status,
              en_route_at: status === "called" ? null : t.en_route_at,
            };
          }),
        );

        const updates: Partial<TicketState> = {
          ...buildPrimaryTicketState(updatedTickets),
          lastUpdate: new Date(),
        };

        const targetTicket = activeTickets.find(t => t.id === targetId);
        if ((status === 'closed' || status === 'served') && targetTicket) {
          updates.pendingReviewTicket = {
            id: targetTicket.id,
            serviceName: (targetTicket as any).service?.name ?? "Service",
          };
        }

        set(updates);
      },

      setWebSocketConnected: (connected: boolean) => {
        set({ isConnected: connected });
      },

      setLastUpdate: (date: Date) => {
        set({ lastUpdate: date });
      },

      setRecalled: () => {
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

      setDeferred: () => {
        set({ hasDeferred: true });
      },

      resetDeferred: () => {
        set({ hasDeferred: false });
      },

      setPendingReviewTicket: (ticket) => {
        set({ pendingReviewTicket: ticket });
      },
    }),
    {
      name: "ticket-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeTickets: state.activeTickets,
        activeTicket: state.activeTicket,
        position: state.position,
        etaMinutes: state.etaMinutes,
      }),
    },
  ),
);

export const useTicket = () => {
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
  const pendingReviewTicket = useTicketStore((state) => state.pendingReviewTicket);

  const actions = useTicketStore.getState();

  return {
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
    pendingReviewTicket,

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
    markPresent: actions.markPresent,
    setRecalled: actions.setRecalled,
    resetRecall: actions.resetRecall,
    setCountdownExpiry: actions.setCountdownExpiry,
    setDeferred: actions.setDeferred,
    resetDeferred: actions.resetDeferred,
    setPendingReviewTicket: actions.setPendingReviewTicket,
    removeExpiredTicket: actions.removeExpiredTicket,

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