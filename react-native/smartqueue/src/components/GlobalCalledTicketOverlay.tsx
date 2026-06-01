import React, { useCallback, useState } from 'react';
import { CalledTicketOverlay } from './CalledTicketOverlay';
import { useTicket } from '../store/ticketStore';
import { useDistanceTracking } from '../hooks/useDistanceTracking';
import axiosClient from '../api/axiosClient';
import { getApiErrorMessage } from '../utils/errors';
import { useRouter } from 'expo-router';

/**
 * Global overlay that appears on ANY tab when the user's ticket is called.
 * Placed in the tab layout so it works from every screen.
 */
interface GlobalCalledTicketOverlayProps {
  showSuccess: (title: string, message: string, buttonText?: string, onPress?: () => void) => void;
  showError: (title: string, message: string, buttonText?: string, onPress?: () => void) => void;
  showWarning: (title: string, message: string, buttonText?: string, onPress?: () => void) => void;
}

export const GlobalCalledTicketOverlay: React.FC<GlobalCalledTicketOverlayProps> = ({
  showSuccess,
  showError,
  showWarning,
}) => {
  const {
    activeTicket,
    isCalled,
    hasRecalled,
    hasDeferred,
    counterNumber,
    clearCalled,
    setRecalled,
    resetRecall,
    setDeferred,
    resetDeferred,
    fetchActiveTicket,
    markEnRoute,
  } = useTicket();

  const router = useRouter();
  const [countdownSeconds, setCountdownSeconds] = useState(600);

  const effectiveTicketId = activeTicket?.id || null;

  // Distance tracking for the overlay
  const hasValidCoordinates = activeTicket?.establishment &&
    (activeTicket.establishment as any)?.lat != null &&
    (activeTicket.establishment as any)?.lng != null;

  const { distanceInfo } = useDistanceTracking({
    targetCoordinates: hasValidCoordinates ? {
      latitude: (activeTicket!.establishment as any).lat,
      longitude: (activeTicket!.establishment as any).lng,
    } : null,
    enabled: hasValidCoordinates && !!activeTicket,
  });

  // Handle "Je suis en route" - confirm presence
  const handleEnRoute = useCallback(async () => {
    if (!effectiveTicketId) return;

    try {
      const payload: { estimated_travel_minutes?: number } = {};
      const rawTravel = distanceInfo?.travelTimes?.car;
      if (typeof rawTravel === 'number' && Number.isFinite(rawTravel)) {
        // Borné sur [1,60] car le backend valide integer|min:1|max:60.
        payload.estimated_travel_minutes = Math.min(60, Math.max(1, Math.round(rawTravel)));
      }
      const response = await axiosClient.post(`/tickets/${effectiveTicketId}/en-route`, payload);

      // Persister en_route_at depuis la réponse backend dans le store pour que
      // le flag soit fiable dès maintenant et survive au prochain resync.
      const updatedTicket = response.data?.data || response.data;
      if (updatedTicket?.en_route_at) {
        const { useTicketStore: store } = require('../store/ticketStore');
        const s = store.getState();
        if (s.activeTicket?.id === effectiveTicketId) {
          store.setState({
            activeTicket: { ...s.activeTicket, en_route_at: updatedTicket.en_route_at },
            activeTickets: s.activeTickets.map((t: any) =>
              t.id === effectiveTicketId
                ? { ...t, en_route_at: updatedTicket.en_route_at }
                : t,
            ),
          });
        }
      }

      // Mémorise la réponse localement pour que l'overlay ne se rouvre pas après
      // une resynchro/navigation (le backend garde status='called').
      markEnRoute();
      showSuccess('Confirmation', 'L\'agent a été notifié que vous êtes en route');
    } catch (error: any) {
      showError('Erreur', getApiErrorMessage(error, 'Impossible de confirmer'));
    }
  }, [effectiveTicketId, distanceInfo, markEnRoute, showSuccess, showError]);

  // Handle "Me rappeler"
  const handleRecall = useCallback(async () => {
    if (!effectiveTicketId || hasRecalled) return;

    try {
      const response = await axiosClient.post(`/tickets/${effectiveTicketId}/request-recall`);
      setRecalled();
      setCountdownSeconds(response.data.countdown_seconds || 600);
      showSuccess('Rappel demandé', 'Un nouveau compte à rebours de 10 minutes a été accordé. Vous ne pouvez plus demander de rappel.');
    } catch (error: any) {
      const errorMsg = getApiErrorMessage(error, '');
      // If backend says already used, sync the local state
      if (errorMsg.includes('déjà été utilisé') || errorMsg.includes('already been used')) {
        setRecalled();
      }
      console.log('Recall error:', errorMsg);
    }
  }, [effectiveTicketId, hasRecalled, setRecalled, showSuccess]);

  // Handle "Laisser passer" (defer)
  const handleDefer = useCallback(async () => {
    if (!effectiveTicketId) return;

    try {
      const response = await axiosClient.post(`/tickets/${effectiveTicketId}/defer`);
      if (response.data.success) {
        setDeferred(); // Mark as deferred so button becomes disabled
        showSuccess('Position échangée', response.data.message || 'Votre position a été échangée avec succès', 'OK', () => {
          clearCalled(); // Dismiss overlay after user clicks OK
        });
        await fetchActiveTicket();
      } else {
        showWarning('Information', response.data.message || 'Impossible d\'échanger la position');
      }
    } catch (error: any) {
      showError('Erreur', getApiErrorMessage(error, 'Impossible d\'échanger la position'));
    }
  }, [effectiveTicketId, fetchActiveTicket, clearCalled, setDeferred, showError, showSuccess, showWarning]);

  // Handle dismiss (expired / take new ticket)
  const handleDismiss = useCallback(() => {
    clearCalled();
    resetRecall();
    resetDeferred();
    router.replace('/(tabs)');
  }, [clearCalled, resetRecall, resetDeferred, router]);

  return (
    <CalledTicketOverlay
      visible={isCalled}
      counterNumber={counterNumber || undefined}
      distanceInfo={distanceInfo}
      countdownSeconds={countdownSeconds}
      hasRecalled={hasRecalled}
      isSwapped={hasDeferred}
      onEnRoute={handleEnRoute}
      onRecall={handleRecall}
      onDefer={handleDefer}
      onDismiss={handleDismiss}
    />
  );
};

export default GlobalCalledTicketOverlay;
