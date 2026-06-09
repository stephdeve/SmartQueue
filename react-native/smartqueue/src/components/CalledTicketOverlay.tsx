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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  formatDistance,
  formatTravelTime,
  DistanceInfo,
} from "../utils/distance";
import { useThemeColors } from "../hooks/useThemeColors";

interface CalledTicketOverlayProps {
  visible: boolean;
  counterNumber?: string;
  distanceInfo: DistanceInfo | null;
  countdownSeconds: number;
  hasRecalled: boolean;
  isSwapped?: boolean;
  gracePeriodExpiresAt?: string | null;
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
  countdownSeconds,
  hasRecalled,
  isSwapped = false,
  gracePeriodExpiresAt,
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
  // Correction: utiliser `number` au lieu de `NodeJS.Timeout`
  const soundIntervalRef = useRef<number | null>(null);

  // Sonnerie périodique
  const playRingtone = useCallback(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (Platform.OS === "ios") {
      Vibration.vibrate([0, 500, 200, 500, 200, 500, 200, 500, 200, 500]);
    } else {
      Vibration.vibrate([0, 800, 400, 800, 400, 800, 400, 800, 400, 800]);
    }
  }, [visible]);

  // Sonnerie périodique
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

  // Animation d'entrée
  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } else {
      scaleAnim.setValue(0.95);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  // Arrêter la vibration quand le composant se démonte ou que visible change
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

  const isExpired = countdownSeconds <= 0;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: colors.danger }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          <View style={{ paddingTop: Platform.OS === "ios" ? 60 : 40, paddingHorizontal: 20 }}>
            <View style={{ alignItems: "center" }}>
              <Animated.View style={{ opacity: flashAnim }}>
                <View style={[styles.iconCircle, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
                  <Ionicons name="notifications" size={40} color="#FFF" />
                </View>
              </Animated.View>
              <Text style={styles.title}>C'est votre tour !</Text>
              {counterNumber && (
                <View style={[styles.counterBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                  <Text style={styles.counterText}>Guichet {counterNumber}</Text>
                </View>
              )}
            </View>

            <View style={styles.countdownContainer}>
              {isExpired ? (
                <View style={styles.expiredBox}>
                  <Text style={styles.expiredTitle}>Délai expiré</Text>
                  <Text style={styles.expiredSub}>Ticket marqué absent</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.countdownLabel}>Temps restant</Text>
                  <Text style={[styles.countdownValue, { opacity: countdownSeconds <= 60 ? flashAnim : 1 }]}>
                    {formatCountdown(countdownSeconds)}
                  </Text>
                </>
              )}
            </View>
          </View>

          {distanceInfo && !isExpired && (
            <View style={[styles.distanceBox, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
              <View style={styles.distanceRow}>
                <View style={styles.distanceItem}>
                  <Ionicons name="location-outline" size={16} color="#FFF" />
                  <Text style={styles.distanceValue}>{formatDistance(distanceInfo.kilometers)}</Text>
                  <Text style={styles.distanceLabel}>Distance</Text>
                </View>
                <View style={styles.distanceDivider} />
                <View style={styles.distanceItem}>
                  <Ionicons name="walk-outline" size={16} color="#FFF" />
                  <Text style={styles.distanceValue}>{formatTravelTime(distanceInfo.travelTimes.walking)}</Text>
                  <Text style={styles.distanceLabel}>À pied</Text>
                </View>
                <View style={styles.distanceDivider} />
                <View style={styles.distanceItem}>
                  <Ionicons name="car-outline" size={16} color="#FFF" />
                  <Text style={styles.distanceValue}>{formatTravelTime(distanceInfo.travelTimes.car)}</Text>
                  <Text style={styles.distanceLabel}>Voiture</Text>
                </View>
                <View style={styles.distanceDivider} />
                <View style={styles.distanceItem}>
                  <Ionicons name="bicycle-outline" size={16} color="#FFF" />
                  <Text style={styles.distanceValue}>{getMotorcycleTime() || "--"}</Text>
                  <Text style={styles.distanceLabel}>Moto</Text>
                </View>
              </View>
            </View>
          )}

          {!isExpired && (
            <View style={styles.buttonsContainer}>
              <TouchableOpacity style={[styles.btn, styles.btnSuccess]} onPress={handleEnRoutePress} activeOpacity={0.8}>
                <Ionicons name="walk-outline" size={18} color="#FFF" />
                <Text style={styles.btnText}>Je suis en route</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handlePresentPress} activeOpacity={0.8}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                <Text style={styles.btnText}>Je suis présent</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, isSwapped ? styles.btnDisabled : styles.btnWarning]}
                onPress={handleDeferPress}
                disabled={isSwapped}
                activeOpacity={0.8}
              >
                <Ionicons name={isSwapped ? "checkmark-circle" : "swap-horizontal"} size={18} color="#FFF" />
                <Text style={styles.btnText}>{isSwapped ? "Différé" : "Je laisse passer un autre"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnOutline, hasRecalled && styles.btnOutlineDisabled]}
                onPress={handleRecallPress}
                disabled={hasRecalled}
                activeOpacity={0.8}
              >
                <Ionicons name={hasRecalled ? "checkmark-circle" : "refresh-outline"} size={18} color="#FFF" />
                <Text style={styles.btnText}>{hasRecalled ? "Rappelé" : "Rappelle-moi"}</Text>
              </TouchableOpacity>

              {gracePeriodExpiresAt && <Text style={styles.graceText}>⏱️ Période de grâce</Text>}
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
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    marginTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 8,
  },
  counterBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 18,
  },
  counterText: {
    color: "#FFF",
    fontSize: 30,
    fontWeight: "700",
  },
  countdownContainer: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  countdownLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginBottom: 4,
  },
  countdownValue: {
    fontSize: 80,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 2,
  },
  expiredBox: {
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
  },
  expiredTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  expiredSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 4,
  },
  distanceBox: {
    marginHorizontal: 20,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
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
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 2,
  },
  distanceLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
  },
  distanceDivider: {
    width: 1,
    height: 25,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
    gap: 10,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
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
  btnWarning: {
    backgroundColor: "#F59E0B",
  },
  btnDisabled: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  btnOutline: {
    backgroundColor: "transparent",
    borderWidth: 0.5,
    borderColor: "#FFF",
  },
  btnOutlineDisabled: {
    borderColor: "rgba(255,255,255,0.3)",
  },
  btnDanger: {
    backgroundColor: "#EF4444",
  },
  graceText: {
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    marginTop: 6,
  },
});

export default CalledTicketOverlay;