import axiosClient from "./axiosClient";
import { Establishment, Service } from "./establishmentsApi";

// Types pour les tickets
export interface Ticket {
  id: number;
  user_id: number;
  service_id: number;
  counter_id?: number;
  number: string;
  status:
    | "created"
    | "waiting"
    | "called"
    | "en_route"
    | "present"
    | "served"
    | "closed"
    | "absent"
    | "expired"
    | "dismissed";
  priority: number;
  position: number | null;
  eta_minutes: number | null;
  queue_length?: number;
  called_at?: string;
  closed_at?: string;
  absent_at?: string;
  en_route_at?: string | null;
  present_at?: string | null;
  response_received_at?: string | null;
  en_route_expires_at?: string | null;
  estimated_travel_minutes?: number | null;
  last_distance_m?: number;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
  service?: Service;
  establishment?: Establishment;
}

export interface CreateTicketData {
  establishment_id: number;
  service_id: number;
  user_id?: number;
  from_qr?: boolean;
  lat?: number;
  lng?: number;
}

export interface UpdateTicketData {
  action?: "cancel" | "mark_absent" | "priority";
  priority?: number;
}

export interface TicketHistoryParams {
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
  status?: string;
  establishment_id?: number;
}

export interface TicketHistoryResponse {
  data: Ticket[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface TicketStats {
  total_tickets: number;
  avg_wait_time: number;
  success_rate: number;
  favorite_establishments: Establishment[];
  saved_stats?: {
    totalTicketsCreated?: number;
    perfectTimingCount?: number;
    quickResponseCount?: number;
    weekendTickets?: number;
    currentXp?: number;
    currentLevel?: number;
  };
}

// Fonctions API pour les tickets
export const ticketsApi = {
  // Créer un nouveau ticket
  createTicket: async (data: CreateTicketData): Promise<Ticket> => {
    // Backend only needs service_id, not establishment_id
    const payload = {
      service_id: data.service_id,
      from_qr: data.from_qr !== undefined ? String(data.from_qr) : undefined,
      lat: data.lat,
      lng: data.lng,
    };
    console.log(
      "[ticketsApi] createTicket - payload:",
      JSON.stringify(payload),
    );

    try {
      const response = await axiosClient.post("/tickets", payload);
      console.log(
        "[ticketsApi] createTicket - success:",
        response.status,
        JSON.stringify(response.data),
      );
      // API may return {data: {...}} or just {...}
      const ticket = response.data?.data || response.data;
      return ticket;
    } catch (error: any) {
      console.log(
        "[ticketsApi] createTicket - error:",
        error.response?.status,
        JSON.stringify(error.response?.data),
      );
      throw error;
    }
  },

  // Obtenir le ticket actif de l'utilisateur
  getActiveTicket: async (): Promise<Ticket | null> => {
    try {
      const response = await axiosClient.get("/tickets/active");
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Alias pour le mobile (me) - returns array of active tickets
  getMyActiveTickets: async (): Promise<Ticket[]> => {
    try {
      const response = await axiosClient.get("/tickets/me");

      // Debug: log full response to see all fields
      console.log(
        "[ticketsApi] FULL response data:",
        JSON.stringify(response.data),
      );

      // Laravel Resource Collection returns: {data: [...]} or {data: {...}} for single item
      let tickets = response.data?.data || response.data || [];

      // Handle case where backend returns a single ticket object instead of array
      if (
        !Array.isArray(tickets) &&
        typeof tickets === "object" &&
        tickets !== null
      ) {
        // Single ticket object - wrap it in array
        if (tickets.id) {
          console.log(
            "[ticketsApi] Single ticket object detected, wrapping in array",
          );
          console.log(
            "[ticketsApi] Establishment lat/lng:",
            (tickets as any).establishment?.lat,
            (tickets as any).establishment?.lng,
          );
          tickets = [tickets];
        } else {
          // Maybe nested differently
          tickets = tickets.data || [];
        }
      }

      console.log(
        "[ticketsApi] parsed tickets:",
        Array.isArray(tickets),
        tickets.length,
        tickets[0]?.id,
      );
      return Array.isArray(tickets) ? tickets : [];
    } catch (error: any) {
      console.log(
        "[ticketsApi] getMyActiveTickets error:",
        error.response?.status,
        error.message,
      );
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  },

  // Get single active ticket (first one for backward compat)
  getMyActiveTicket: async (): Promise<Ticket | null> => {
    try {
      const response = await axiosClient.get("/tickets/me");
      const tickets = response.data?.data || response.data || [];
      const ticketList = Array.isArray(tickets) ? tickets : [];
      return ticketList.length > 0 ? ticketList[0] : null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Obtenir les détails d'un ticket
  getTicket: async (ticketId: number): Promise<Ticket> => {
    const response = await axiosClient.get(`/tickets/${ticketId}`);
    return response.data;
  },

  // Mettre à jour un ticket (annuler, marquer absent, etc.)
  updateTicket: async (
    ticketId: number,
    data: UpdateTicketData,
  ): Promise<Ticket> => {
    const response = await axiosClient.patch(`/tickets/${ticketId}`, data);
    return response.data;
  },

  // Annuler un ticket
  cancelTicket: async (ticketId: number): Promise<Ticket> => {
    const response = await axiosClient.patch(`/tickets/${ticketId}`, {
      action: "cancel",
    });
    return response.data;
  },

  // Marquer un ticket comme absent
  markTicketAbsent: async (ticketId: number): Promise<Ticket> => {
    const response = await axiosClient.patch(`/tickets/${ticketId}`, {
      action: "mark_absent",
    });
    return response.data;
  },

  // Définir la priorité d'un ticket
  setTicketPriority: async (
    ticketId: number,
    priority: number,
  ): Promise<Ticket> => {
    const response = await axiosClient.patch(`/tickets/${ticketId}`, {
      action: "priority",
      priority,
    });
    return response.data;
  },

  // Obtenir l'historique des tickets
  getTicketHistory: async (
    params: TicketHistoryParams = {},
  ): Promise<TicketHistoryResponse> => {
    console.log(
      "[ticketsApi] getTicketHistory - params:",
      JSON.stringify(params),
    );
    const response = await axiosClient.get("/tickets/history", { params });
    console.log(
      "[ticketsApi] getTicketHistory - raw response:",
      JSON.stringify(response.data).substring(0, 1000),
    );
    console.log(
      "[ticketsApi] getTicketHistory - data array:",
      response.data.data
        ? "exists, length: " + response.data.data.length
        : "no data key",
    );
    // Laravel Resource collection returns: {data: [...], meta: {pagination info}}
    const result = {
      data: response.data.data || response.data,
      pagination: response.data.meta ||
        response.data.pagination || {
          current_page: 1,
          last_page: 1,
          per_page: 20,
          total: 0,
        },
    };
    console.log(
      "[ticketsApi] getTicketHistory - result data length:",
      result.data?.length || 0,
    );
    return result;
  },

  // Obtenir les statistiques des tickets de l'utilisateur
  getTicketStats: async (): Promise<TicketStats> => {
    const response = await axiosClient.get("/user/stats");
    return response.data;
  },

  // Sync user stats to backend
  syncUserStats: async (stats: {
    totalTicketsCreated: number;
    perfectTimingCount: number;
    quickResponseCount: number;
    weekendTickets: number;
    currentXp: number;
    currentLevel: number;
  }): Promise<void> => {
    await axiosClient.post("/user/stats", stats);
  },

  // Obtenir les tickets récents
  getRecentTickets: async (limit: number = 5): Promise<Ticket[]> => {
    const response = await axiosClient.get("/tickets/recent", {
      params: { limit },
    });
    return response.data;
  },

  // Rejoindre à nouveau la file (créer un nouveau ticket pour le même service)
  rejoinQueue: async (serviceId: number): Promise<Ticket> => {
    const response = await axiosClient.post("/tickets/rejoin", {
      service_id: serviceId,
    });
    return response.data;
  },

  // Obtenir le temps d'attente estimé pour un service
  getEstimatedWaitTime: async (
    serviceId: number,
  ): Promise<{
    avg_wait_min: number;
    people_waiting: number;
    peak_hours: string[];
  }> => {
    const response = await axiosClient.get(`/services/${serviceId}/wait-time`);
    return response.data;
  },

  // Signaler sa présence (mise à jour de la position GPS)
  checkIn: async (
    ticketId: number,
    lat: number,
    lng: number,
  ): Promise<{
    distance_m: number;
    is_within_range: boolean;
  }> => {
    const response = await axiosClient.post(`/tickets/${ticketId}/checkin`, {
      lat,
      lng,
    });
    return response.data;
  },

  // Notifier que le ticket a été présenté au guichet
  presentTicket: async (
    ticketId: number,
    counterId: number,
  ): Promise<Ticket> => {
    const response = await axiosClient.post(`/tickets/${ticketId}/present`, {
      counter_id: counterId,
    });
    return response.data;
  },

  // Obtenir le QR code du ticket
  getTicketQR: async (
    ticketId: number,
  ): Promise<{
    qr_code: string;
    ticket_number: string;
    service_name: string;
    establishment_name: string;
  }> => {
    const response = await axiosClient.get(`/tickets/${ticketId}/qr`);
    return response.data;
  },
};

export default ticketsApi;
