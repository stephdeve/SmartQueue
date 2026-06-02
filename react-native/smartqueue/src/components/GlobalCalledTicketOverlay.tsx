import React, { useCallback, useState } from "react";
import { CalledTicketOverlay } from "./CalledTicketOverlay";
import { useTicket, useTicketStore } from "../store/ticketStore";
import { useDistanceTracking } from "../hooks/useDistanceTracking";
import axiosClient from "../api/axiosClient";
import { getApiErrorMessage } from "../utils/errors";
import { useRouter } from "expo-router";

/**
 * Global overlay that appears on ANY tab when the user's ticket is called.
 * Placed in the tab layout so it works from every screen.
 */
interface GlobalCalledTicketOverlayProps {
  showSuccess: (
    title: string,
    message: string,
    buttonText?: string,
    onPress?: () => void,
  ) => void;
  showError: (
    title: string,
    message: string,
    buttonText?: string,
    onPress?: () => void,
  ) => void;
  showWarning: (
    title: string,
    message: string,
    buttonText?: string,
    onPress?: () => void,
  ) => void;
}

export const GlobalCalledTicketOverlay: React.FC<
  GlobalCalledTicketOverlayProps
> = ({ showSuccess, showError, showWarning }) => {
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
    markPresent,
  } = useTicket();

  const router = useRouter();
  const [countdownSeconds, setCountdownSeconds] = useState(600);

  const effectiveTicketId = activeTicket?.id || null;

  // Distance tracking for the overlay
  const hasValidCoordinates =
    activeTicket?.establishment &&
    (activeTicket.establishment as any)?.lat != null &&
    (activeTicket.establishment as any)?.lng != null;

  const { distanceInfo } = useDistanceTracking({
    targetCoordinates: hasValidCoordinates
      ? {
          latitude: (activeTicket!.establishment as any).lat,
          longitude: (activeTicket!.establishment as any).lng,
        }
      : null,
    enabled: hasValidCoordinates && !!activeTicket,
  });

  // Handle "Je suis en route" - confirm presence
  const handleEnRoute = useCallback(async () => {
    if (!effectiveTicketId) return;

    try {
      const payload: { estimated_travel_minutes?: number } = {};
      const rawTravel = distanceInfo?.travelTimes?.car;
      if (typeof rawTravel === "number" && Number.isFinite(rawTravel)) {
        // Borné sur [1,60] car le backend valide integer|min:1|max:60.
        payload.estimated_travel_minutes = Math.min(
          60,
          Math.max(1, Math.round(rawTravel)),
        );
      }
      const response = await axiosClient.post(
        `/tickets/${effectiveTicketId}/en-route`,
        payload,
      );

      // Persister en_route_at depuis la réponse backend dans le store pour que
      // le flag soit fiable dès maintenant et survive au prochain resync.
      const updatedTicket = response.data?.data || response.data;
      if (updatedTicket?.en_route_at) {
        const s = useTicketStore.getState();
        if (s.activeTicket?.id === effectiveTicketId) {
          useTicketStore.setState({
            activeTicket: {
              ...s.activeTicket,
              status: "en_route",
              en_route_at: updatedTicket.en_route_at,
              en_route_expires_at: updatedTicket.en_route_expires_at,
              response_received_at: updatedTicket.response_received_at,
            },
            activeTickets: s.activeTickets.map((t: any) =>
              t.id === effectiveTicketId
                ? {
                    ...t,
                    status: "en_route",
                    en_route_at: updatedTicket.en_route_at,
                    en_route_expires_at: updatedTicket.en_route_expires_at,
                    response_received_at: updatedTicket.response_received_at,
                  }
                : t,
            ),
          });
        }
      }

      // Mémorise la réponse localement pour que l'overlay ne se rouvre pas après
      // une resynchro/navigation (le backend garde status='called').
      markEnRoute();
      showSuccess(
        "Confirmation",
        "L'agent a été notifié que vous êtes en route",
      );
    } catch (error: any) {
      showError("Erreur", getApiErrorMessage(error, "Impossible de confirmer"));
    }
  }, [
    effectiveTicketId,
    distanceInfo,
    markEnRoute,
    showSuccess,
    showError,
    fetchActiveTicket,
  ]);

  // Handle "Je suis en route" - ensure we sync server state after optimistic update
  const handleEnRouteAndSync = useCallback(async () => {
    // Call the original handler and then fetch a fresh ticket state
    await handleEnRoute();
    try {
      await fetchActiveTicket();
    } catch (err) {
      console.warn(
        "[GlobalCalledTicketOverlay] fetchActiveTicket after en-route failed",
        err,
      );
    }
  }, [handleEnRoute, fetchActiveTicket]);

  // Handle "Je suis déjà là"
  // → ferme le ticket directement (auto-servi) : l'agent n'a plus rien à faire.
  const handlePresent = useCallback(async () => {
    if (!effectiveTicketId) return;

    try {
      // POST /tickets/{id}/present → backend met status='closed' + broadcast agent
      await axiosClient.post(`/tickets/${effectiveTicketId}/present`);

      // 1. Mettre à jour le store local immédiatement (pas d'attente serveur)
      const s = useTicketStore.getState();
      if (s.activeTicket?.id === effectiveTicketId) {
        useTicketStore.setState({
          activeTicket: {
            ...s.activeTicket,
            status: "closed",
            closed_at: new Date().toISOString(),
          },
          activeTickets: s.activeTickets.map((t: any) =>
            t.id === effectiveTicketId
              ? { ...t, status: "closed", closed_at: new Date().toISOString() }
              : t,
          ),
        });
      }

      // 2. Fermer l'overlay
      clearCalled();
      resetRecall();
      resetDeferred();

      // 3. Succès + navigation vers l'accueil après confirmation
      showSuccess(
        "Ticket clos ✔",
        "Vous êtes marqué comme servi. Merci de votre visite !",
        "OK",
        () => {
          // Vider le ticket actif et retourner à l\'accueil
          useTicketStore.setState({ activeTicket: null, activeTickets: [] });
          router.replace("/(tabs)");
        },
      );
    } catch (error: any) {
      showError(
        "Erreur",
        getApiErrorMessage(error, "Impossible de confirmer la présence"),
      );
    }
  }, [
    effectiveTicketId,
    clearCalled,
    resetRecall,
    resetDeferred,
    showSuccess,
    showError,
    router,
  ]);

  // Handle "Me rappeler"
  const handleRecall = useCallback(async () => {
    if (!effectiveTicketId || hasRecalled) return;

    try {
      const response = await axiosClient.post(
        `/tickets/${effectiveTicketId}/request-recall`,
      );
      setRecalled();
      setCountdownSeconds(
        Math.max(0, Math.floor(Number(response.data.countdown_seconds || 600))),
      );
      showSuccess(
        "Rappel demandé",
        "Un nouveau compte à rebours de 10 minutes a été accordé. Vous ne pouvez plus demander de rappel.",
      );
    } catch (error: any) {
      const errorMsg = getApiErrorMessage(error, "");
      // If backend says already used, sync the local state
      if (
        errorMsg.includes("déjà été utilisé") ||
        errorMsg.includes("already been used")
      ) {
        setRecalled();
      }
      console.log("Recall error:", errorMsg);
    }
  }, [effectiveTicketId, hasRecalled, setRecalled, showSuccess]);

  // Handle "Laisser passer" (defer)
  const handleDefer = useCallback(async () => {
    if (!effectiveTicketId) return;

    try {
      const response = await axiosClient.post(
        `/tickets/${effectiveTicketId}/defer`,
      );
      if (response.data.success) {
        setDeferred(); // Mark as deferred so button becomes disabled
        showSuccess(
          "Position échangée",
          response.data.message || "Votre position a été échangée avec succès",
          "OK",
          () => {
            clearCalled(); // Dismiss overlay after user clicks OK
          },
        );
        await fetchActiveTicket();
      } else {
        showWarning(
          "Information",
          response.data.message || "Impossible d'échanger la position",
        );
      }
    } catch (error: any) {
      showError(
        "Erreur",
        getApiErrorMessage(error, "Impossible d'échanger la position"),
      );
    }
  }, [
    effectiveTicketId,
    fetchActiveTicket,
    clearCalled,
    setDeferred,
    showError,
    showSuccess,
    showWarning,
  ]);

  // Handle dismiss (expired / take new ticket)
  const handleDismiss = useCallback(async () => {
    clearCalled();
    resetRecall();
    resetDeferred();
    try {
      await fetchActiveTicket();
    } catch (err) {
      console.warn(
        "[GlobalCalledTicketOverlay] fetchActiveTicket on dismiss failed",
        err,
      );
    }
    router.replace("/(tabs)");
  }, [clearCalled, resetRecall, resetDeferred, router, fetchActiveTicket]);

  // Poll countdown endpoint while overlay is visible to keep timer aligned
  React.useEffect(() => {
    let interval: any = null;

    const fetchCountdown = async () => {
      if (!effectiveTicketId) return;
      try {
        const response = await axiosClient.get(
          `/tickets/${effectiveTicketId}/countdown`,
        );
        const data = response.data;
        if (data?.countdown_seconds != null) {
          setCountdownSeconds(
            Math.max(0, Math.floor(Number(data.countdown_seconds))),
          );
        }
        // If backend reports ticket is no longer in called state, refresh and close overlay
        if (data && !data.is_called) {
          // Sync full ticket state and close overlay
          await fetchActiveTicket();
          clearCalled();
          return;
        }
      } catch (error: any) {
        console.warn(
          "[GlobalCalledTicketOverlay] countdown fetch error",
          error?.message,
        );
      }
    };

    if (isCalled && effectiveTicketId) {
      // Immediate fetch
      fetchCountdown();
      // Poll every 5 seconds
      interval = setInterval(fetchCountdown, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCalled, effectiveTicketId, fetchActiveTicket, clearCalled]);

  return (
    <CalledTicketOverlay
      visible={isCalled}
      counterNumber={counterNumber || undefined}
      distanceInfo={distanceInfo}
      countdownSeconds={countdownSeconds}
      hasRecalled={hasRecalled}
      isSwapped={hasDeferred}
      onEnRoute={handleEnRouteAndSync}
      onPresent={handlePresent}
      onRecall={handleRecall}
      onDefer={handleDefer}
      onDismiss={handleDismiss}
    />
  );
};

export default GlobalCalledTicketOverlay;
