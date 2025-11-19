import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { api } from '@/api/axios'

export type Role = 'admin' | 'agent' | 'user'
export interface User { id: number; name: string; email: string; phone?: string | null; role: Role }

interface AuthState { token: string | null; user: User | null; loading: boolean; error?: string }
const persistedUser = localStorage.getItem('user')
let initialUser: User | null = null
try { initialUser = persistedUser ? JSON.parse(persistedUser) as User : null } catch { initialUser = null; localStorage.removeItem('user') }
const initialState: AuthState = {
  token: localStorage.getItem('token'),
  user: initialUser,
  loading: false,
}

export const login = createAsyncThunk('auth/login', async (payload: { email: string; password: string }) => {
  try {
    const { data } = await api.post('/api/auth/login', payload)
    return data as { token: string; user: User }
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || 'Login failed'
    // Use rejectWithValue to pass a controlled message to the reducer
    throw new Error(msg)
  }
})

export const logout = createAsyncThunk('auth/logout', async () => {
  try { await api.post('/api/auth/logout') } catch {}
  return true
})

const slice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(login.pending, (s) => { s.loading = true; s.error = undefined })
    b.addCase(login.fulfilled, (s, a: PayloadAction<{ token: string; user: User }>) => {
      s.loading = false; s.user = a.payload.user; s.token = a.payload.token
      localStorage.setItem('token', a.payload.token)
      localStorage.setItem('user', JSON.stringify(a.payload.user))
    })
    b.addCase(login.rejected, (s, a: any) => { s.loading = false; s.error = a?.error?.message || 'Login failed' })

    b.addCase(logout.fulfilled, (s) => {
      s.user = null; s.token = null
      localStorage.removeItem('token'); localStorage.removeItem('user')
    })
  }
})

export default slice.reducer
