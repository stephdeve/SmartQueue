import { configureStore } from '@reduxjs/toolkit'
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import auth, { sessionExpired } from './authSlice'

export const store = configureStore({ reducer: { auth } })

// Émis par l'intercepteur axios sur 401 : sans purge du store, /login (token encore
// présent en mémoire) renvoyait vers /dashboard, qui renvoyait vers /login, etc.
if (typeof window !== 'undefined') {
  window.addEventListener('auth:expired', () => store.dispatch(sessionExpired()))
}

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
