import axiosClient from './axiosClient';

// Types pour les établissements
export interface Establishment {
  id: number;
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  open_at: string;
  close_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  services?: Service[];
  services_count?: number;
  crowd_level?: 'low' | 'moderate' | 'high';
  crowd_trend?: 'up' | 'down' | 'stable';
  avg_wait_min?: number;
  people_waiting?: number;
  open_now?: boolean;
  is_favorited?: boolean;
}

export interface Service {
  id: number;
  establishment_id: number;
  name: string;
  avg_service_time_minutes: number;
  status: 'open' | 'closed';
  priority_support: boolean;
  capacity: number;
  people_waiting?: number;
  agents_count?: number;
  created_at: string;
  updated_at: string;
}

export interface EstablishmentsParams {
  lat?: number;
  lng?: number;
  radius?: number;
  type?: string;
  category?: string;
  q?: string; // search query
}

export interface HourlyDataPoint {
  hour: number;
  count: number;
}

export interface PeakHours {
  high: number[];
  medium: number[];
  low: number[];
}

export interface AffluenceData {
  level: 'low' | 'medium' | 'high';
  people: number;
  eta_avg: number;
  hourly_data: HourlyDataPoint[];
  peak_hours: PeakHours;
}

export interface ServiceReview {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  user: { id: number; name: string } | null;
}

export interface ServiceReviewsResponse {
  reviews: ServiceReview[];
  avg_rating: number;
  total: number;
  distribution: Record<number, number>;
  has_more: boolean;
}

export interface EstablishmentStatus {
  crowd_level: 'low' | 'moderate' | 'high';
  active_tickets: number;
  avg_wait_min: number;
  open_now: boolean;
  hours: {
    open_at: string;
    close_at: string;
  };
}

// Utility to calculate distance between two points (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const p = 0.017453292519943295; // Math.PI / 180
  const c = Math.cos;
  const a = 0.5 - c((lat2 - lat1) * p) / 2 +
    c(lat1 * p) * c(lat2 * p) *
    (1 - c((lon2 - lon1) * p)) / 2;
  return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
};

// Fonctions API pour les établissements
export const establishmentsApi = {
  // Lister les établissements avec filtres et fallback intelligent
  getEstablishments: async (params: EstablishmentsParams = {}): Promise<Establishment[]> => {
    let lastError: any = null;
    const maxRetries = 3;
    let retryCount = 0;
    
    // Helper function to make request with retry
    // Réponse paginée Laravel ({ data, links, meta }) ou tableau brut
    const makeRequest = async (requestParams: EstablishmentsParams, attempt: number): Promise<any> => {
      try {
        const response = await axiosClient.get('/establishments', { params: requestParams });
        return response.data;
      } catch (error: any) {
        // Retry on network errors (ECONNABORTED, ETIMEDOUT, Network Error)
        const isNetworkError = !error.response && (
          error.code === 'ECONNABORTED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ERR_NETWORK' ||
          error.message?.includes('Network Error')
        );
        
        if (isNetworkError && attempt < maxRetries) {
          console.warn(`Network error on attempt ${attempt}, retrying in ${attempt * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          return makeRequest(requestParams, attempt + 1);
        }
        throw error;
      }
    };
    
    // Try 1: With all params
    try {
      return await makeRequest(params, 1);
    } catch (error: any) {
      lastError = error;
      console.warn('Establishments fetch attempt 1 failed:', error.response?.status, error.code, error.message);
      
      // Try 2: Without geo params (fallback for SQLite distance calculation issues)
      if (params.lat && params.lng) {
        try {
          const { lat, lng, radius, ...otherParams } = params;
          const data = await makeRequest(otherParams, 1);
          const establishments = Array.isArray(data) ? data : data.data || [];

          // Sort by distance client-side
          return establishments.sort((a: Establishment, b: Establishment) => {
            const distA = calculateDistance(params.lat!, params.lng!, Number(a.lat) || 0, Number(a.lng) || 0);
            const distB = calculateDistance(params.lat!, params.lng!, Number(b.lat) || 0, Number(b.lng) || 0);
            return distA - distB;
          });
        } catch (fallbackError: any) {
          lastError = fallbackError;
          console.warn('Establishments fetch attempt 2 (no geo) failed:', fallbackError.code, fallbackError.message);
        }
      }
      
      // Try 3: Minimal request (just fetch all, no params)
      try {
        const data = await makeRequest({}, 1);
        const establishments = Array.isArray(data) ? data : data.data || [];
        console.log('Establishments fetch attempt 3 (minimal) succeeded:', establishments.length, 'items');
        return establishments;
      } catch (minimalError: any) {
        console.error('All establishment fetch attempts failed:', minimalError.code, minimalError.message);
        throw lastError || minimalError;
      }
    }
  },

  // Alias pour le mobile (nearby)
  getNearbyEstablishments: async (params: EstablishmentsParams): Promise<Establishment[]> => {
    try {
      const response = await axiosClient.get('/establishments/nearby', { params });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 500 && params.lat && params.lng) {
        return establishmentsApi.getEstablishments(params);
      }
      throw error;
    }
  },

  // Rechercher des établissements
  searchEstablishments: async (query: string): Promise<Establishment[]> => {
    const response = await axiosClient.get('/establishments/search', { params: { q: query } });
    return response.data;
  },

  // Obtenir les détails d'un établissement
  getEstablishment: async (id: number): Promise<Establishment> => {
    const response = await axiosClient.get(`/establishments/${id}`);
    return response.data;
  },

  // Obtenir les services d'un établissement
  getEstablishmentServices: async (establishmentId: number): Promise<Service[]> => {
    const response = await axiosClient.get(`/establishments/${establishmentId}/services`);
    return response.data;
  },

  // Obtenir un service spécifique
  getService: async (id: number): Promise<Service> => {
    const response = await axiosClient.get(`/services/${id}`);
    return response.data;
  },

  // Obtenir l'affluence d'un service
  getServiceAffluence: async (serviceId: number): Promise<AffluenceData> => {
    const response = await axiosClient.get(`/services/${serviceId}/affluence`);
    return response.data;
  },

  // Obtenir les avis publics d'un service
  getServiceReviews: async (serviceId: number): Promise<ServiceReviewsResponse> => {
    const response = await axiosClient.get(`/services/${serviceId}/reviews`);
    return response.data;
  },

  // Obtenir les recommandations pour un service
  getServiceRecommendations: async (serviceId: number): Promise<any[]> => {
    const response = await axiosClient.get(`/services/${serviceId}/recommendations`);
    return response.data;
  },

  // Obtenir les établissements par catégorie
  getEstablishmentsByCategory: async (category: string, params: EstablishmentsParams = {}): Promise<Establishment[]> => {
    const response = await axiosClient.get('/establishments', {
      params: { ...params, category }
    });
    return response.data;
  },

};

export default establishmentsApi;
