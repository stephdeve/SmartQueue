/**
 * useUnreadNotifications — compteur de notifications non lues.
 *
 * Interroge le backend au montage, puis toutes les 60 secondes.
 * Expose aussi une fonction refresh() pour forcer la mise à jour
 * (ex : après avoir ouvert l'écran notifications).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { notificationsApi } from '../api/notificationsApi';
import { useAuthStore } from '../store/authStore';

const POLL_INTERVAL_MS = 60_000; // 1 minute

export const useUnreadNotifications = () => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    const fetchCount = useCallback(async () => {
        if (!isAuthenticated) {
            setUnreadCount(0);
            return;
        }
        try {
            setIsLoading(true);
            const res = await notificationsApi.getUnreadCount();
            setUnreadCount(res.count ?? 0);
        } catch {
            // Silencieux — ne pas spammer l'utilisateur si le réseau est coupé
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated]);

    // Fetch au montage et à chaque reconnexion réseau (AppState active)
    useEffect(() => {
        if (!isAuthenticated) {
            setUnreadCount(0);
            return;
        }

        fetchCount();

        timerRef.current = setInterval(fetchCount, POLL_INTERVAL_MS);

        const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') fetchCount();
        });

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            sub.remove();
        };
    }, [isAuthenticated, fetchCount]);

    /** Appeler après avoir marqué des notifications comme lues */
    const markAllReadLocally = useCallback(() => setUnreadCount(0), []);

    return { unreadCount, isLoading, refresh: fetchCount, markAllReadLocally };
};

export default useUnreadNotifications;
