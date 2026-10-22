import axiosClient, { saveTokens, clearTokens } from "./axiosClient";

// Types pour l'authentification
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  phone?: string;
  password: string;
  password_confirmation: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    created_at: string;
    updated_at: string;
  };
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  services?: any[];
  counters?: any[];
  created_at: string;
  updated_at: string;
}

export interface DeviceData {
  device_id?: string;
  platform: string;
  token: string; // FCM token
}

export interface GoogleAuthData {
  id_token: string;
  access_token?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

// Fonctions API d'authentification
export const authApi = {
  // Connexion
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    console.log(
      "[authApi] login - sending credentials:",
      JSON.stringify({ email: credentials.email, password: "***" }),
    );
    console.log("[authApi] login - endpoint: POST /auth/login");

    try {
      const response = await axiosClient.post("/auth/login", credentials);
      console.log("[authApi] login - response status:", response.status);
      console.log(
        "[authApi] login - FULL response data:",
        JSON.stringify(response.data, null, 2),
      );
      console.log("[authApi] login - user role:", response.data?.user?.role);
      console.log(
        "[authApi] login - user services:",
        JSON.stringify(response.data?.user?.services),
      );

      const authData = response.data;

      // Sauvegarder les tokens
      await saveTokens(authData);
      console.log("[authApi] login - token saved successfully");

      return authData;
    } catch (error: any) {
      console.log("[authApi] login - error:", error.message);
      console.log(
        "[authApi] login - error response:",
        JSON.stringify(error.response?.data),
      );
      console.log("[authApi] login - error status:", error.response?.status);
      throw error;
    }
  },

  // Inscription
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await axiosClient.post("/auth/register", data);
    const authData = response.data;

    // Sauvegarder les tokens
    await saveTokens(authData);

    return authData;
  },

  // Déconnexion
  logout: async (): Promise<void> => {
    try {
      await axiosClient.post("/auth/logout");
    } catch (error) {
      // Même si la déconnexion côté serveur échoue, on clear les tokens locaux
      console.warn("Logout API call failed:", error);
    } finally {
      await clearTokens();
    }
  },

  // Obtenir le profil utilisateur courant
  me: async (): Promise<User> => {
    const response = await axiosClient.get("/me");
    return response.data;
  },

  // Enregistrer un appareil pour les notifications push
  registerDevice: async (deviceData: DeviceData): Promise<void> => {
    await axiosClient.post("/auth/devices/register", deviceData);
  },

  // Désenregistrer le token push courant
  unregisterCurrentDevice: async (fcmToken: string): Promise<void> => {
    await axiosClient.delete("/auth/devices/current", {
      data: { fcm_token: fcmToken },
    });
  },

  // Demander un reset de mot de passe
  forgotPassword: async (email: string): Promise<void> => {
    await axiosClient.post("/auth/forgot", { email });
  },

  // Réinitialiser le mot de passe
  resetPassword: async (
    token: string,
    email: string,
    password: string,
    password_confirmation: string,
  ): Promise<void> => {
    await axiosClient.post("/auth/reset", {
      token,
      email,
      password,
      password_confirmation,
    });
  },

  // Connexion avec Google
  googleLogin: async (googleData: GoogleAuthData): Promise<AuthResponse> => {
    console.log("[authApi] googleLogin - sending id_token");

    try {
      const response = await axiosClient.post("/auth/google", {
        id_token: googleData.id_token,
        access_token: googleData.access_token,
      });
      console.log("[authApi] googleLogin - response status:", response.status);

      const authData = response.data;

      // Sauvegarder les tokens
      await saveTokens(authData);
      console.log("[authApi] googleLogin - token saved successfully");

      return authData;
    } catch (error: any) {
      console.log("[authApi] googleLogin - error:", error.message);
      console.log(
        "[authApi] googleLogin - error response:",
        JSON.stringify(error.response?.data),
      );
      throw error;
    }
  },

  // Inscription avec Google
  googleRegister: async (
    googleData: GoogleAuthData,
    phone?: string,
  ): Promise<AuthResponse> => {
    console.log("[authApi] googleRegister - sending id_token");

    try {
      const response = await axiosClient.post("/auth/google/register", {
        id_token: googleData.id_token,
        access_token: googleData.access_token,
        phone,
      });
      console.log(
        "[authApi] googleRegister - response status:",
        response.status,
      );

      const authData = response.data;

      // Sauvegarder les tokens
      await saveTokens(authData);
      console.log("[authApi] googleRegister - token saved successfully");

      return authData;
    } catch (error: any) {
      console.log("[authApi] googleRegister - error:", error.message);
      console.log(
        "[authApi] googleRegister - error response:",
        JSON.stringify(error.response?.data),
      );
      throw error;
    }
  },
};

export default authApi;
