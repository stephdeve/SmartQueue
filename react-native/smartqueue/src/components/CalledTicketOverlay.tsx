import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Vibration,
  Platform,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  formatDistance,
  formatTravelTime,
  DistanceInfo,
} from "../utils/distance";
import { useThemeColors } from "../hooks/useThemeColors";

const { width, height } = Dimensions.get("window");

interface CalledTicketOverlayProps {
  visible: boolean;
  counterNumber?: string;
  ticketNumber?: string;
  ticketServiceName?: string;
  distanceInfo: DistanceInfo | null;
  countdownSeconds: number;
  countdownReady?: boolean;
  callTimeoutMinutes?: number | null;
  hasRecalled: boolean;
  isSwapped?: boolean;
  gracePeriodExpiresAt?: string | null;
  absentLevel?: number;
  maxCallAttempts?: number;
  onEnRoute: () => void;
  onPresent?: () => Promise<void> | void;
  onRecall: () => Promise<void>;
  onDefer: () => void;
  onDismiss: () => void;
}

export const CalledTicketOverlay: React.FC<CalledTicketOverlayProps> = ({
  visible,
  counterNumber,
  distanceInfo,
  ticketNumber,
  ticketServiceName,
  countdownSeconds,
  countdownReady = true,
  callTimeoutMinutes,
  hasRecalled,
  isSwapped = false,
  gracePeriodExpiresAt,
  absentLevel = 0,
  maxCallAttempts = 2,
  onEnRoute,
  onPresent,
  onRecall,
  onDefer,
  onDismiss,
}) => {
  const colors = useThemeColors();
  const flashAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playRingtone = useCallback(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (Platform.OS === "ios") {
      Vibration.vibrate([0, 500, 200, 500, 200, 500, 200, 500, 200, 500]);
    } else {
      Vibration.vibrate([0, 800, 400, 800, 400, 800, 400, 800, 400, 800]);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
      return;
    }

    playRingtone();
    soundIntervalRef.current = setInterval(() => {
      if (visible) playRingtone();
    }, 10000);

    return () => {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
    };
  }, [visible, playRingtone]);

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } else {
      scaleAnim.setValue(0.95);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
      }
      Vibration.cancel();
    };
  }, []);

  const formatCountdown = (seconds: number): string => {
    const total = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEnRoutePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
    Vibration.cancel();
    onEnRoute();
  };

  const handlePresentPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
    Vibration.cancel();
    try {
      const res = onPresent && onPresent();
      if (res && typeof (res as any).then === "function") await res;
    } catch (err) { console.log("handlePresent error:", err); }
  };

  const handleRecallPress = async () => {
    if (hasRecalled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await onRecall();
  };

  const handleDeferPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDefer();
  };

  const handleDismissPress = () => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
    Vibration.cancel();
    onDismiss();
  };

  const getMotorcycleTime = () => {
    if (!distanceInfo?.travelTimes?.car) return null;
    return formatTravelTime(Math.round(distanceInfo.travelTimes.car * 0.7));
  };

  if (!visible) return null;

  const isExpired = countdownReady && countdownSeconds <= 0;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: colors.danger }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          <View style={{ paddingTop: Platform.OS === "ios" ? 50 : 30, paddingHorizontal: 16, flex: 1 }}>
            {/* Header avec icône et titre */}
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <Animated.View style={{ opacity: flashAnim }}>
                <View style={[styles.iconCircle, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
                  <Ionicons name="notifications" size={36} color="#FFF" />
                </View>
              </Animated.View>
              <Text style={styles.title}>{absentLevel > 0 ? "Dernier appel. Si vous ne vous présentez pas avant la fin du délai, votre ticket sera définitivement clôturé." : "C'est votre tour. Veuillez vous présenter avant la fin du délai."}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
                <View style={[styles.counterBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                  <Text style={styles.counterText}>Appel {absentLevel + 1}/{maxCallAttempts}</Text>
                </View>
                {counterNumber && (
                  <View style={[styles.counterBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                    <Text style={styles.counterText}>Guichet {counterNumber}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Infos ticket compactes */}
            <View style={[styles.ticketCompactCard, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
              <View style={styles.ticketCompactRow}>
                <View style={styles.serviceCompact}>
                  <Text style={styles.serviceLabel}>Service concerné</Text>
                  <Text style={styles.serviceValue} numberOfLines={1}>
                    {ticketServiceName || "Service"}
                  </Text>
                </View>
                <View style={styles.dividerVertical} />
                <View style={styles.numberCompact}>
                  <Text style={styles.ticketLabel}>Ticket Concerné</Text>
                  <Text style={styles.ticketValue}>{ticketNumber || "---"}</Text>
                </View>
              </View>
            </View>

            {/* Timer */}
            <View style={styles.timerArea}>
              {!countdownReady ? (
                <View style={[styles.expiredBox, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
                  <Text style={styles.expiredTitle}>Chargement...</Text>
                  <Text style={styles.expiredSub}>Synchronisation du délai en cours</Text>
                </View>
              ) : isExpired ? (
                <View style={styles.expiredBox}>
                  <Text style={styles.expiredTitle}>Délai expiré</Text>
                  <Text style={styles.expiredSub}>{(absentLevel + 1) >= maxCallAttempts ? "Votre ticket a été clôturé suite à plusieurs absences. Vous devez prendre un nouveau ticket." : "Vous ne vous êtes pas présenté à temps. Votre ticket a été marqué absent mais peut encore être rappelé."}</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.countdownLabel}>Temps restant pour vous présenter</Text>
                  <Animated.Text style={[styles.countdownValue, { opacity: countdownSeconds <= 60 ? flashAnim : 1 }]}>
                    {formatCountdown(countdownSeconds)}
                  </Animated.Text>
                  {callTimeoutMinutes != null && (
                    <Text style={styles.timeoutInfo}>Délai configuré : {callTimeoutMinutes} min</Text>
                  )}
                  {countdownSeconds <= 60 && countdownSeconds > 0 && (
                    <View style={styles.urgentBanner}>
                      <Ionicons name="warning" size={13} color="#FFF" />
                      <Text style={styles.urgentText}>{(absentLevel + 1) >= maxCallAttempts ? "Dernier appel — présentez-vous immédiatement ou votre ticket sera définitivement clôturé." : "Répondez maintenant ou votre ticket sera marqué absent."}</Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Distance et transports - compact */}
            {distanceInfo && !isExpired && (
              <View style={[styles.distanceCompactBox, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
                <View style={styles.distanceRow}>
                  <View style={styles.distanceItem}>
                    <Ionicons name="location-outline" size={14} color="#FFF" />
                    <Text style={styles.distanceValue}>{formatDistance(distanceInfo.kilometers)}</Text>
                    <Text style={styles.distanceLabel}>Distance</Text>
                  </View>
                  <View style={styles.distanceDivider} />
                  <View style={styles.distanceItem}>
                    <Ionicons name="walk-outline" size={14} color="#FFF" />
                    <Text style={styles.distanceValue}>{formatTravelTime(distanceInfo.travelTimes.walking)}</Text>
                    <Text style={styles.distanceLabel}>À pied</Text>
                  </View>
                  <View style={styles.distanceDivider} />
                  <View style={styles.distanceItem}>
                    <Ionicons name="car-outline" size={14} color="#FFF" />
                    <Text style={styles.distanceValue}>{formatTravelTime(distanceInfo.travelTimes.car)}</Text>
                    <Text style={styles.distanceLabel}>Voiture</Text>
                  </View>
                  <View style={styles.distanceDivider} />
                  <View style={styles.distanceItem}>
                    <Ionicons name="bicycle-outline" size={14} color="#FFF" />
                    <Text style={styles.distanceValue}>{getMotorcycleTime() || "--"}</Text>
                    <Text style={styles.distanceLabel}>Moto</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Boutons */}
            {!isExpired && (
              <View style={styles.buttonsContainer}>
                <TouchableOpacity style={[styles.btn, styles.btnSuccess]} onPress={handleEnRoutePress} activeOpacity={0.8}>
                  <Ionicons name="walk-outline" size={18} color="#FFF" />
                  <Text style={styles.btnText}>Je suis en route</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handlePresentPress} activeOpacity={0.8}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                  <Text style={styles.btnText}>Je suis Présent</Text>
                </TouchableOpacity>

                <View style={styles.rowButtons}>
                  <TouchableOpacity
                    style={[styles.btnSmall, isSwapped && styles.btnDisabled]}
                    onPress={handleDeferPress}
                    disabled={isSwapped}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={isSwapped ? "checkmark-circle" : "swap-horizontal"} size={16} color="#FFF" />
                    <Text style={styles.btnSmallText}>{isSwapped ? "Différé" : "Je laisse passer"}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnSmall, hasRecalled && styles.btnDisabled]}
                    onPress={handleRecallPress}
                    disabled={hasRecalled}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={hasRecalled ? "checkmark-circle" : "refresh-outline"} size={16} color="#FFF" />
                    <Text style={styles.btnSmallText}>{hasRecalled ? "Rappelé" : "Rappeler"}</Text>
                  </TouchableOpacity>
                </View>

                {gracePeriodExpiresAt && (
                  <Text style={styles.graceText}>⏱️ Période de grâce</Text>
                )}
              </View>
            )}

            {isExpired && (
              <View style={styles.buttonsContainer}>
                <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleDismissPress} activeOpacity={0.8}>
                  <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                  <Text style={styles.btnText}>Nouveau ticket</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    marginTop: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 6,
    textAlign: "center",
  },
  counterBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 18,
  },
  counterText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  ticketCompactCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  ticketCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:"space-between",
  },
  serviceCompact: {
    flex: 1,
  },
  serviceLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "500",
    marginBottom: 2,
  },
  serviceValue: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
  },
  numberCompact: {
    flex: 1,
    alignItems: "center",
  },
  ticketLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "500",
    marginBottom: 2,
  },
  ticketValue: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "800",
  },
  dividerVertical: {
    width: 1,
    height: 35,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 12,
  },
  timerArea: {
    alignItems: "center",
    marginBottom: 16,
  },
  countdownLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginBottom: 2,
  },
  countdownValue: {
    fontSize: 80,
    fontWeight: "800",
    color: "#FFF",
  },
  timeoutInfo: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    marginTop: 4,
  },
  urgentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 8,
  },
  urgentText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  expiredBox: {
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
  },
  expiredTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  expiredSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 2,
  },
  distanceCompactBox: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  distanceRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  distanceItem: {
    alignItems: "center",
    flex: 1,
  },
  distanceValue: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
    marginBottom: 1,
  },
  distanceLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
  },
  distanceDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  buttonsContainer: {
    marginTop: "auto",
    gap: 8,
    paddingBottom: Platform.OS === "ios" ? 20 : 18,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 10,
    gap: 8,
  },
  btnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  btnSuccess: {
    backgroundColor: "#22C55E",
  },
  btnPrimary: {
    backgroundColor: "#3B82F6",
  },
  btnDanger: {
    backgroundColor: "#EF4444",
  },
  rowButtons: {
    flexDirection: "row",
    gap: 10,
  },
  btnSmall: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  btnDisabled: {
    backgroundColor: "rgba(255,255,255,0.08)",
    opacity: 0.7,
  },
  btnSmallText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  graceText: {
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    marginTop: 4,
  },
});

export default CalledTicketOverlay;