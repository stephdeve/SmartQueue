import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { api } from "@/api/axios";
import { disconnectEcho } from "@/api/echo";

/** Erreur transmise aux composants via rejectWithValue (le statut HTTP est conservé). */
export interface AuthError {
  status?: number;
  message: string;
  data?: any;
}

const toAuthError = (err: any, fallback: string): AuthError => ({
  status: err?.response?.status,
  message: err?.response?.data?.message || err?.message || fallback,
  data: err?.response?.data,
});

export type Role = "admin" | "agent" | "user" | "super_admin";
export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  avatar?: string;
  establishment_id?: number | null;
  pending_subscription?: any;
  created_at?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  error?: string;
}
const persistedUser = localStorage.getItem("user");
let initialUser: User | null = null;
try {
  initialUser = persistedUser ? (JSON.parse(persistedUser) as User) : null;
} catch {
  initialUser = null;
  localStorage.removeItem("user");
}
const initialState: AuthState = {
  token: localStorage.getItem("token"),
  user: initialUser,
  loading: false,
  isAuthenticated: !!localStorage.getItem("token"),
};

export const login = createAsyncThunk<
  { token: string; user: User },
  { email: string; password: string },
  { rejectValue: AuthError }
>("auth/login", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/auth/login", payload);
    return data as { token: string; user: User };
  } catch (err: any) {
    // rejectWithValue : une Error levée perd son statut HTTP à la sérialisation
    return rejectWithValue(toAuthError(err, "Login failed"));
  }
});

export const signup = createAsyncThunk<
  { token: string; user: User },
  {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    phone?: string;
  },
  { rejectValue: AuthError }
>("auth/signup", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/auth/register", payload);
    return data as { token: string; user: User };
  } catch (err: any) {
    return rejectWithValue(toAuthError(err, "Signup failed"));
  }
});

export const registerEstablishment = createAsyncThunk<
  { token: string; user: User; next_step: string },
  {
    admin_name: string;
    admin_email: string;
    admin_password: string;
    admin_password_confirmation: string;
    admin_phone?: string;
  },
  { rejectValue: AuthError }
>("auth/registerEstablishment", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post(
      "/api/onboarding/register-establishment",
      payload,
    );
    return data as { token: string; user: User; next_step: string };
  } catch (err: any) {
    return rejectWithValue(toAuthError(err, "Registration failed"));
  }
});

export const subscribe = createAsyncThunk<
  { pending_subscription: any; next_step: string; user?: User },
  { plan: string; paid: boolean },
  { rejectValue: AuthError }
>("auth/subscribe", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/onboarding/subscribe", payload);
    return data as {
      pending_subscription: any;
      next_step: string;
      user?: User;
    };
  } catch (err: any) {
    return rejectWithValue(toAuthError(err, "Subscription failed"));
  }
});

export const logout = createAsyncThunk("auth/logout", async () => {
  try {
    await api.post("/api/auth/logout");
  } catch {}
  disconnectEcho();
  return true;
});

export const refreshMe = createAsyncThunk("auth/refreshMe", async () => {
  const { data } = await api.get("/api/me");
  return data as User;
});

export const updateProfile = createAsyncThunk(
  "auth/updateProfile",
  async (payload: { name?: string; phone?: string | null; avatar?: string | null }) => {
    const { data } = await api.patch("/api/me", payload);
    return data.user as User;
  },
);

const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Token refusé par l'API (401) : purge de la session sans appel réseau
    sessionExpired: (s) => {
      s.user = null;
      s.token = null;
      s.isAuthenticated = false;
      s.loading = false;
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    },
  },
  extraReducers: (b) => {
    b.addCase(login.pending, (s) => {
      s.loading = true;
      s.error = undefined;
    });
    b.addCase(
      login.fulfilled,
      (s, a: PayloadAction<{ token: string; user: User }>) => {
        s.loading = false;
        s.user = a.payload.user;
        s.token = a.payload.token;
        s.isAuthenticated = true;
        localStorage.setItem("token", a.payload.token);
        localStorage.setItem("user", JSON.stringify(a.payload.user));
      },
    );
    b.addCase(login.rejected, (s, a) => {
      s.loading = false;
      s.error = a.payload?.message || a.error?.message || "Login failed";
    });

    b.addCase(signup.pending, (s) => {
      s.loading = true;
      s.error = undefined;
    });
    b.addCase(
      signup.fulfilled,
      (s, a: PayloadAction<{ token: string; user: User }>) => {
        s.loading = false;
        s.user = a.payload.user;
        s.token = a.payload.token;
        s.isAuthenticated = true;
        localStorage.setItem("token", a.payload.token);
        localStorage.setItem("user", JSON.stringify(a.payload.user));
      },
    );
    b.addCase(signup.rejected, (s, a) => {
      s.loading = false;
      s.error = a.payload?.message || a.error?.message || "Signup failed";
    });
    b.addCase(registerEstablishment.pending, (s) => {
      s.loading = true;
      s.error = undefined;
    });
    b.addCase(
      registerEstablishment.fulfilled,
      (
        s,
        a: PayloadAction<{ token: string; user: User; next_step: string }>,
      ) => {
        s.loading = false;
        s.user = a.payload.user;
        s.token = a.payload.token;
        s.isAuthenticated = true;
        localStorage.setItem("token", a.payload.token);
        localStorage.setItem("user", JSON.stringify(a.payload.user));
      },
    );
    b.addCase(registerEstablishment.rejected, (s, a) => {
      s.loading = false;
      s.error = a.payload?.message || a.error?.message || "Registration failed";
    });

    b.addCase(subscribe.pending, (s) => {
      s.loading = true;
      s.error = undefined;
    });
    b.addCase(
      subscribe.fulfilled,
      (
        s,
        a: PayloadAction<{
          pending_subscription: any;
          next_step: string;
          user?: User;
        }>,
      ) => {
        s.loading = false;
        if (a.payload.user) {
          s.user = a.payload.user;
          localStorage.setItem("user", JSON.stringify(a.payload.user));
        } else if (s.user) {
          s.user.pending_subscription = a.payload.pending_subscription;
          localStorage.setItem("user", JSON.stringify(s.user));
        }
      },
    );
    b.addCase(subscribe.rejected, (s, a) => {
      s.loading = false;
      s.error = a.payload?.message || a.error?.message || "Subscription failed";
    });

    b.addCase(logout.fulfilled, (s) => {
      s.user = null;
      s.token = null;
      s.isAuthenticated = false;
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    });

    b.addCase(refreshMe.pending, (s) => {
      s.loading = true;
    });
    b.addCase(refreshMe.rejected, (s) => {
      s.loading = false;
    });

    b.addCase(refreshMe.fulfilled, (s, a: PayloadAction<User>) => {
      s.loading = false;
      s.user = a.payload;
      localStorage.setItem("user", JSON.stringify(a.payload));
    });

    b.addCase(updateProfile.fulfilled, (s, a: PayloadAction<User>) => {
      s.user = a.payload;
      localStorage.setItem("user", JSON.stringify(a.payload));
    });
  },
});

export const { sessionExpired } = slice.actions;
export default slice.reducer;
