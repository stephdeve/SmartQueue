import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useTicket, useTicketStore } from "../../store/ticketStore";
import { useDistanceTracking } from "../../hooks/useDistanceTracking";
import { useSmartNotifications } from "../../hooks/useSmartNotifications";
import { useUserStatsStore } from "../../store/userStatsStore";
import { formatDistance, formatTravelTime } from "../../utils/distance";
import { useCustomAlert } from "../../hooks/useCustomAlert";
import { useThemeColors } from "../../hooks/useThemeColors";
import axiosClient from "../../api/axiosClient";
import { getApiErrorMessage } from "../../utils/errors";
import { useOfflineStore } from "../../store/offlineStore";
import CustomBottomSheet from "../../components/ui/BottomSheet";

const { width } = Dimensions.get("window");

const fmtTimeAgo = (date: Date): string => {
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `il y a ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min}min`;
  return `il y a ${Math.floor(min / 60)}h`;
};

// Composant de statut compact - Version avec fond opaque
const LiveStatusBadge: React.FC<{
  status: string;
  isCalled: boolean;
  colors: any;
}> = ({ status, isCalled, colors }) => {
  const getConfig = () => {
    if (status === "present")
      return { label: "Présent", icon: "checkmark-circle", color: colors.success };
    if (status === "en_route")
      return { label: "En route", icon: "walk", color: colors.warning };
    if (isCalled)
      return { label: "Appelé", icon: "notifications", color: colors.danger };
    return { label: "En attente", icon: "time", color: colors.primary };
  };

  const config = getConfig();

  return (
    <View style={[
      styles.statusBadge,
      {
        backgroundColor: colors.surface + "CC",
        borderColor: config.color,
      }
    ]}>
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text style={[styles.statusBadgeText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
};

// Badge Live pour le header - Version avec fond plein
const LiveIndicator: React.FC<{ colors: any }> = ({ colors }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View style={[
      styles.liveIndicator,
      {
        backgroundColor: colors.danger,
        transform: [{ scale: pulseAnim }],
      }
    ]}>
      <View style={[styles.liveDot, { backgroundColor: "#FFF" }]} />
      <Text style={styles.liveIndicatorText}>LIVE</Text>
      <Ionicons name="radio" size={10} color="#FFF" />
    </Animated.View>
  );
};

// Composant d'info compact
const CompactInfoRow: React.FC<{
  icon: string;
  label: string;
  value: string;
  color: string;
  colors: any;
}> = ({ icon, label, value, color, colors }) => (
  <View style={[styles.compactInfoRow, { backgroundColor: colors.surfaceSecondary }]}>
    <View style={[styles.compactInfoIcon, { backgroundColor: color + "15" }]}>
      <Ionicons name={icon as any} size={16} color={color} />
    </View>
    <View style={styles.compactInfoContent}>
      <Text style={[styles.compactInfoLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.compactInfoValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  </View>
);

// Composant distance avec icônes
const DistanceCard: React.FC<{
  distanceInfo: any;
  colors: any;
  departureInfo: any;
}> = ({ distanceInfo, colors, departureInfo }) => {
  const travelModes = [
    {
      icon: "walk-outline",
      label: "À pied",
      time: distanceInfo?.travelTimes?.walking,
      color: colors.success
    },
    {
      icon: "car-outline",
      label: "Voiture",
      time: distanceInfo?.travelTimes?.car,
      color: colors.primary
    },
    {
      icon: "bicycle-outline",
      label: "Moto",
      time: distanceInfo?.travelTimes?.bicycle || (distanceInfo?.travelTimes?.car ? distanceInfo.travelTimes.car * 0.7 : null),
      color: colors.warning
    },
  ];

  return (
    <View style={[styles.distanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.distanceCardHeader}>
        <View style={styles.distanceTitleContainer}>
          <Ionicons name="navigate-circle" size={20} color={colors.primary} />
          <Text style={[styles.distanceCardTitle, { color: colors.textPrimary }]}>
            Distance & durée
          </Text>
        </View>
        <View style={[styles.distanceBadge, { backgroundColor: colors.primary + "10" }]}>
          <Text style={[styles.distanceBadgeText, { color: colors.primary }]}>
            {formatDistance(distanceInfo?.kilometers || 0)}
          </Text>
        </View>
      </View>

      <View style={styles.travelModesGrid}>
        {travelModes.map((mode, index) => (
          <View key={index} style={styles.travelModeItem}>
            <View style={[styles.travelModeIcon, { backgroundColor: mode.color + "15" }]}>
              <Ionicons name={mode.icon as any} size={24} color={mode.color} />
            </View>
            <Text style={[styles.travelModeLabel, { color: colors.textSecondary }]}>
              {mode.label}
            </Text>
            <Text style={[styles.travelModeTime, { color: mode.color }]}>
              {mode.time ? formatTravelTime(mode.time) : "—"}
            </Text>
          </View>
        ))}
      </View>

      {departureInfo && (
        <View style={[styles.departureAlert, { backgroundColor: colors.warning + "10" }]}>
          <Ionicons
            name={departureInfo.shouldLeaveNow ? "warning" : "time-outline"}
            size={16}
            color={colors.warning}
          />
          <Text style={[styles.departureAlertText, { color: colors.textSecondary }]}>
            {departureInfo.shouldLeaveNow
              ? "Partez immédiatement !"
              : `Partez dans ${Math.ceil(departureInfo.leaveIn)} min`}
          </Text>
        </View>
      )}
    </View>
  );
};

// ── Timeline ─────────────────────────────────────────────────────────────────
interface TimelineEntry {
  id: number;
  type: "served" | "position" | "info";
  message: string;
  timestamp: Date;
}

const QueueTimeline: React.FC<{
  entries: TimelineEntry[];
  colors: any;
}> = ({ entries, colors }) => {
  if (entries.length === 0) return null;

  return (
    <View style={[styles.timelineCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.timelineHeader}>
        <View style={[styles.timelineHeaderDot, { backgroundColor: colors.success }]} />
        <Text style={[styles.timelineTitle, { color: colors.textPrimary }]}>Activité en direct</Text>
      </View>
      {entries.slice(0, 5).map((entry, index) => {
        const dotColor =
          entry.type === "served" ? colors.success :
            entry.type === "position" ? colors.warning : colors.primary;
        return (
          <View key={entry.id} style={styles.timelineEntry}>
            <View style={styles.timelineDotCol}>
              <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
              {index < entries.length - 1 && (
                <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
              )}
            </View>
            <View style={styles.timelineContent}>
              <Text style={[styles.timelineMsg, { color: colors.textPrimary }]}>
                {entry.message}
              </Text>
              <Text style={[styles.timelineTime, { color: colors.textTertiary }]}>
                {fmtTimeAgo(entry.timestamp)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ── Position Circle ──────────────────────────────────────────────────────────
const PositionCircle: React.FC<{
  position: number;
  maxPosition: number;
  isSoon: boolean;
  isCalled: boolean;
  isEnRoute: boolean;
  isPresent: boolean;
  color: string;
  colors: any;
}> = ({ position, maxPosition, isSoon, isCalled, isEnRoute, isPresent, color, colors }) => {
  const size = 110;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = maxPosition > 0 ? Math.min(1, (maxPosition - position) / maxPosition) : 0;
  const offset = circumference - progress * circumference;

  if (isCalled) {
    return (
      <View style={{ alignItems: "center", width: size }}>
        <View style={[styles.posCircleInner, { borderColor: colors.danger + "30" }]}>
          <Ionicons name="notifications" size={36} color={colors.danger} />
        </View>
        <Text style={[styles.posCircleStatus, { color: colors.danger }]}>Appelé</Text>
      </View>
    );
  }
  if (isPresent) {
    return (
      <View style={{ alignItems: "center", width: size }}>
        <View style={[styles.posCircleInner, { borderColor: colors.success + "30" }]}>
          <Ionicons name="checkmark-circle" size={36} color={colors.success} />
        </View>
        <Text style={[styles.posCircleStatus, { color: colors.success }]}>Présent</Text>
      </View>
    );
  }
  if (isEnRoute) {
    return (
      <View style={{ alignItems: "center", width: size }}>
        <View style={[styles.posCircleInner, { borderColor: colors.warning + "30" }]}>
          <Ionicons name="walk" size={36} color={colors.warning} />
        </View>
        <Text style={[styles.posCircleStatus, { color: colors.warning }]}>En route</Text>
      </View>
    );
  }

  return (
    <View style={styles.posCircleOuter}>
      <View style={[styles.posCircleWrap, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {progress > 0 && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </Svg>
        <View style={styles.posCircleCenter}>
          <Text style={[styles.posCircleValue, { color }]}>{position}</Text>
          <Text style={[styles.posCircleLabel, { color: colors.textTertiary }]}>position</Text>
        </View>
      </View>
      {isSoon && (
        <View style={[styles.posSoonBadge, { backgroundColor: colors.warning }]}>
          <Text style={styles.posSoonText}>⚡ Bientôt</Text>
        </View>
      )}
    </View>
  );
};


const SMART_TIPS = [
  { icon: "analytics-outline", title: "Affluence", text: "Heure d'affluence : modérée en ce moment" },
  { icon: "timer-outline", title: "Attente", text: "Temps d'attente moyen : 12 min" },
  { icon: "location-outline", title: "Astuce", text: "Activez la localisation pour être prévenu à l'avance" },
  { icon: "flash-outline", title: "Notification", text: "Gardez votre téléphone déverrouillé pour ne pas manquer votre tour" },
  { icon: "walk-outline", title: "Déplacement", text: "Préparez votre départ pour arriver à l'heure" },
  { icon: "cellular-outline", title: "Réseau", text: "Le Wi-Fi de l'établissement est disponible" },
];

// Carousel de tips à défilement automatique
const SmartTipsCarousel: React.FC<{ colors: any }> = ({ colors }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoRotate = useCallback(() => {
    intervalRef.current = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex((prev) => (prev + 1) % SMART_TIPS.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);
  }, [fadeAnim]);

  useEffect(() => {
    startAutoRotate();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startAutoRotate]);

  const tip = SMART_TIPS[currentIndex];

  return (
    <View style={[styles.tipsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.tipsRow}>
        <View style={[styles.tipsIconBox, { backgroundColor: colors.primary + "18" }]}>
          <Ionicons name={tip.icon as any} size={20} color={colors.primary} />
        </View>
        <Animated.View style={[styles.tipsContent, { opacity: fadeAnim }]}>
          <Text style={[styles.tipsTitle, { color: colors.textTertiary }]}>{tip.title}</Text>
          <Text style={[styles.tipsText, { color: colors.textPrimary }]}>{tip.text}</Text>
        </Animated.View>
      </View>
      <View style={styles.tipsDots}>
        {SMART_TIPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.tipsDot,
              { backgroundColor: i === currentIndex ? colors.primary : colors.textTertiary + "30" },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

// Particules de confettis pour l'écran "C'est votre tour"
interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  animY: Animated.Value;
  animRotate: Animated.Value;
  animScale: Animated.Value;
}

const CONFETTI_COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF6BDB", "#FF9F43", "#A29BFE"];

const ConfettiParticles: React.FC = () => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const items: Particle[] = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * width * 0.8 - width * 0.4,
      y: -300 - Math.random() * 600,
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 0.8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      animY: new Animated.Value(-100 - Math.random() * 500),
      animRotate: new Animated.Value(0),
      animScale: new Animated.Value(0),
    }));
    setParticles(items);

    Animated.stagger(
      40,
      items.map((p) =>
        Animated.parallel([
          Animated.timing(p.animY, {
            toValue: 800 + Math.random() * 400,
            duration: 2500 + Math.random() * 2000,
            useNativeDriver: true,
          }),
          Animated.timing(p.animRotate, {
            toValue: 1,
            duration: 2000 + Math.random() * 1500,
            useNativeDriver: true,
          }),
          Animated.spring(p.animScale, {
            toValue: p.scale,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
      ),
    ).start();

    return () => {
      items.forEach((p) => {
        p.animY.stopAnimation();
        p.animRotate.stopAnimation();
        p.animScale.stopAnimation();
      });
    };
  }, []);

  return (
    <View style={styles.confettiContainer} pointerEvents="none">
      {particles.map((p) => (
        <Animated.View
          key={p.id}
          style={[
            styles.confettiPiece,
            {
              backgroundColor: p.color,
              transform: [
                { translateX: p.x },
                { translateY: p.animY },
                {
                  rotate: p.animRotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", `${p.rotation}deg`],
                  }),
                },
                { scale: p.animScale },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

interface LiveTicketScreenProps {
  ticketId?: string;
}

export const LiveTicketScreen: React.FC<LiveTicketScreenProps> = ({
  ticketId,
}) => {
  const colors = useThemeColors();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const lastSyncAt = useOfflineStore((s) => s.lastSyncAt);

  const lastSyncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const {
    activeTicket,
    activeTickets,
    position,
    etaMinutes,
    isAlmostThere,
    isCalled,
    cancelTicket,
    hasActiveTicket,
    hasRecalled,
    counterNumber,
    setRecalled,
    markAsCalled,
    clearCalled,
    fetchActiveTicket,
    markEnRoute,
  } = useTicket();

  const { AlertComponent, showError, showSuccess, showWarning } =
    useCustomAlert();

  useFocusEffect(
    useCallback(() => {
      const state = useTicketStore.getState();
      if (state.isCalled && state.activeTicket?.en_route_at) {
        return;
      }
      fetchActiveTicket().catch((err) =>
        console.error("Error fetching ticket:", err),
      );
    }, [fetchActiveTicket]),
  );

  // ── Son & vibreur quand appelé ────────────────────────────────────────────
  const soundRef = useRef<Audio.Sound | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  // Déclarés avant les effets qui les lisent dans leurs dépendances (sinon
  // ReferenceError « before initialization » au premier rendu sous Hermes)
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    if (isCalled && soundEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      Audio.Sound.createAsync(
        { uri: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg" },
        { shouldPlay: true, volume: 0.8 },
      )
        .then(({ sound }) => {
          soundRef.current = sound;
        })
        .catch(() => { });
    }
    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => { });
        soundRef.current.unloadAsync().catch(() => { });
        soundRef.current = null;
      }
    };
  }, [isCalled, soundEnabled]);

  // ── Countdown du rappel ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isCalled || countdownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isCalled, countdownSeconds]);

  const effectiveTicketId = useMemo(() => {
    const propId = ticketId ? Number(ticketId) : null;
    if (propId && !isNaN(propId)) return propId;
    return activeTicket?.id || null;
  }, [ticketId, activeTicket?.id]);

  // Ticket à afficher : celui identifié par ticketId (peut être secondaire), ou le ticket primaire
  const displayTicket = useMemo(() => {
    if (!effectiveTicketId) return activeTicket;
    return activeTickets.find(t => t.id === effectiveTicketId) ?? activeTicket;
  }, [effectiveTicketId, activeTickets, activeTicket]);

  const displayPosition = displayTicket?.position ?? position;
  const displayEta = displayTicket?.eta_minutes ?? etaMinutes;
  const isDisplayCalled = displayTicket?.status === "called";

  const hasValidCoordinates =
    displayTicket?.establishment &&
    (displayTicket.establishment as any)?.lat !== null &&
    (displayTicket.establishment as any)?.lat !== undefined &&
    (displayTicket.establishment as any)?.lng !== null &&
    (displayTicket.establishment as any)?.lng !== undefined;

  const { distanceInfo, hasPermission: hasLocationPermission } =
    useDistanceTracking({
      targetCoordinates: hasValidCoordinates
        ? {
          latitude: (displayTicket!.establishment as any).lat,
          longitude: (displayTicket!.establishment as any).lng,
        }
        : null,
      enabled: hasValidCoordinates && !!displayTicket,
    });

  const { lastAlert, departureInfo, journeyProgress } = useSmartNotifications({
    enabled: hasActiveTicket,
  });

  const { recordTicketCompleted, recordPresenceConfirmed, recordArrival } =
    useUserStatsStore();

  const didCancelRef = useRef(false);

  // ── Timeline ──────────────────────────────────────────────────────────────
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const prevPositionRef = useRef<number>(displayPosition);

  useEffect(() => {
    const prev = prevPositionRef.current;
    if (prev !== displayPosition && displayPosition > 0 && displayPosition < prev) {
      const served = prev - displayPosition;
      setTimelineEntries((prevEntries) =>
        [
          {
            id: Date.now() + Math.random(),
            type: "served" as const,
            message: `${served} personne${served > 1 ? "s" : ""} appelée${served > 1 ? "s" : ""} avant vous`,
            timestamp: new Date(),
          },
          ...prevEntries,
        ].slice(0, 10),
      );
    }
    prevPositionRef.current = displayPosition;
  }, [displayPosition]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      showError(
        "Erreur",
        getApiErrorMessage(error, "Impossible d'envoyer le rappel"),
      );
    }
  }, [effectiveTicketId, hasRecalled, setRecalled, showError]);

  const handleEnRoute = useCallback(async () => {
    if (!effectiveTicketId) return;

    try {
      const payload: { estimated_travel_minutes?: number } = {};
      const rawTravel = distanceInfo?.travelTimes?.car;
      if (typeof rawTravel === "number" && Number.isFinite(rawTravel)) {
        payload.estimated_travel_minutes = Math.min(
          60,
          Math.max(1, Math.round(rawTravel)),
        );
      }
      await axiosClient.post(`/tickets/${effectiveTicketId}/en-route`, payload);
      markEnRoute();
      await fetchActiveTicket();
      showSuccess("Confirmation", "L'agent a été notifié");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      showError("Erreur", getApiErrorMessage(error, "Impossible de confirmer"));
    }
  }, [effectiveTicketId, distanceInfo, markEnRoute, fetchActiveTicket, showSuccess, showError]);

  const handleDefer = useCallback(async () => {
    if (!effectiveTicketId) return;

    try {
      const response = await axiosClient.post(
        `/tickets/${effectiveTicketId}/defer`,
      );
      if (response.data.success) {
        showSuccess("Position échangée", "Votre position a été échangée");
        clearCalled();
        await fetchActiveTicket();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        showWarning("Information", response.data.message || "Impossible d'échanger");
      }
    } catch (error: any) {
      showError("Erreur", getApiErrorMessage(error, "Impossible d'échanger"));
    }
  }, [effectiveTicketId, fetchActiveTicket, clearCalled, showError, showSuccess, showWarning]);

  const handleCancelTicket = useCallback(() => {
    showWarning(
      "Quitter la file ?",
      "Vous perdrez votre place dans la file d'attente.",
      "Quitter",
      async () => {
        try {
          didCancelRef.current = true;
          await cancelTicket(effectiveTicketId!);
          router.back();
        } catch (error: any) {
          showError("Erreur", error?.response?.data?.message || "Impossible d'annuler");
        }
      },
      "Annuler",
    );
  }, [effectiveTicketId, cancelTicket, showWarning, showError]);

  const isTicketPresent = displayTicket?.status === "present";
  const isTicketEnRoute = displayTicket?.status === "en_route";
  const isTicketCalledState = isDisplayCalled || (isCalled && displayTicket?.id === activeTicket?.id);

  // Rendu principal
  const renderHeader = () => (
    <LinearGradient
      colors={[colors.primary, colors.secondary]}
      style={styles.header}
    >
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: "rgba(0,0,0,0.3)" }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>

        {/* Badge LIVE amélioré */}
        <LiveIndicator colors={colors} />

        {/* Status Badge amélioré avec fond opaque */}
        <LiveStatusBadge
          status={displayTicket?.status || "waiting"}
          isCalled={isTicketCalledState}
          colors={colors}
        />
      </View>

      <View style={styles.headerMain}>
        <Text style={styles.ticketLabel}>Ticket en cours</Text>
        <Text style={styles.ticketNumberHeader}>
          #{displayTicket?.number || "---"}
        </Text>
      </View>
    </LinearGradient>
  );

  const renderPositionCard = () => {
    const isSpecialStatus = isTicketCalledState || isTicketPresent || isTicketEnRoute;
    const displayTitle = isSpecialStatus
      ? "Statut"
      : isOnline
        ? "Position dans la file"
        : "Position estimée (hors ligne)";
    const maxPos = Math.max(displayPosition, 3);
    const positionColor =
      isSpecialStatus ? colors.primary :
        displayPosition <= 2 ? colors.danger :
          displayPosition <= 5 ? colors.warning : colors.primary;

    const isSoon = isOnline && !isSpecialStatus && displayPosition > 0 && displayPosition <= 3;

    return (
      <View style={[styles.positionCard, { backgroundColor: colors.surface, borderColor: isOnline ? colors.border : '#F97316' }]}>
        {/* Badge hors ligne */}
        {!isOnline && (
          <View style={[styles.offlineBadge, { backgroundColor: '#FFF7ED' }]}>
            <Ionicons name="cloud-offline-outline" size={12} color="#EA580C" />
            <Text style={styles.offlineBadgeText}>
              Hors ligne{lastSyncLabel ? ` — Synchro : ${lastSyncLabel}` : ''}
            </Text>
          </View>
        )}

        <View style={styles.positionCardBody}>
          <PositionCircle
            position={displayPosition}
            maxPosition={maxPos}
            isSoon={isSoon}
            isCalled={isTicketCalledState}
            isEnRoute={isTicketEnRoute}
            isPresent={isTicketPresent}
            color={positionColor}
            colors={colors}
          />

          <View style={styles.positionInfoCol}>
            {!isSpecialStatus && (
              <>
                <Text style={[styles.posInfoTitle, { color: colors.textPrimary }]}>
                  {isOnline ? "Temps estimé" : "Estimation"}
                </Text>
                <Text style={[styles.posInfoEta, { color: positionColor }]}>
                  {displayEta} min
                </Text>
                {displayPosition > 0 && (
                  <Text style={[styles.posInfoPeople, { color: colors.textTertiary }]}>
                    {displayPosition - 1} personne{(displayPosition - 1) > 1 ? "s" : ""} devant vous
                  </Text>
                )}
              </>
            )}

            {isTicketCalledState && (
              <View style={styles.posStatusInfo}>
                <Text style={[styles.posInfoTitle, { color: colors.danger }]}>Présentez-vous</Text>
                <Text style={[styles.posInfoDesc, { color: colors.textSecondary }]}>
                  Guichet #{counterNumber || "N/A"}
                </Text>
              </View>
            )}
            {isTicketPresent && (
              <View style={styles.posStatusInfo}>
                <Text style={[styles.posInfoTitle, { color: colors.success }]}>Priorité conservée</Text>
                <Text style={[styles.posInfoDesc, { color: colors.textSecondary }]}>
                  Vous êtes en cours de service
                </Text>
              </View>
            )}
            {isTicketEnRoute && (
              <View style={styles.posStatusInfo}>
                <Text style={[styles.posInfoTitle, { color: colors.warning }]}>En attente d’arrivée</Text>
                <Text style={[styles.posInfoDesc, { color: colors.textSecondary }]}>
                  L’agent a été notifié
                </Text>
              </View>
            )}

            {isSoon && !isSpecialStatus && (
              <View style={[styles.posSoonInline, { backgroundColor: colors.warning + "15" }]}>
                <Ionicons name="flash" size={14} color={colors.warning} />
                <Text style={[styles.posSoonInlineText, { color: colors.warning }]}>Bientôt votre tour</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderActionButtons = () => (
    <View style={styles.actionButtonsContainer}>
      <TouchableOpacity
        style={[styles.navButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/navigation" as any)}
        activeOpacity={0.8}
      >
        <Ionicons name="navigate-circle" size={24} color="#FFF" />
        <Text style={styles.navButtonText}>Ouvrir navigation</Text>
      </TouchableOpacity>

      {/* Avertissement hors ligne */}
      {!isOnline && (
        <View style={[styles.offlineActionsNote, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
          <Ionicons name="cloud-offline-outline" size={14} color="#EA580C" />
          <Text style={[styles.offlineActionsNoteText, { color: '#C2410C' }]}>
            Actions indisponibles hors ligne
          </Text>
        </View>
      )}

      <View style={styles.iconButtonsRow}>
        <TouchableOpacity
          style={[
            styles.iconButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            !isOnline && styles.iconButtonDisabled,
          ]}
          onPress={isOnline ? handleRecall : undefined}
          activeOpacity={isOnline ? 0.7 : 1}
        >
          <Ionicons name="repeat" size={22} color={isOnline ? colors.warning : colors.textTertiary} />
          <Text style={[styles.iconButtonLabel, { color: isOnline ? colors.textSecondary : colors.textTertiary }]}>Rappel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.iconButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            !isOnline && styles.iconButtonDisabled,
          ]}
          onPress={isOnline ? handleDefer : undefined}
          activeOpacity={isOnline ? 0.7 : 1}
        >
          <Ionicons name="swap-horizontal" size={22} color={isOnline ? colors.secondary : colors.textTertiary} />
          <Text style={[styles.iconButtonLabel, { color: isOnline ? colors.textSecondary : colors.textTertiary }]}>Échanger</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.iconButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            !isOnline && styles.iconButtonDisabled,
          ]}
          onPress={isOnline ? handleCancelTicket : undefined}
          activeOpacity={isOnline ? 0.7 : 1}
        >
          <Ionicons name="close-circle" size={22} color={isOnline ? colors.danger : colors.textTertiary} />
          <Text style={[styles.iconButtonLabel, { color: isOnline ? colors.danger : colors.textTertiary }]}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCalledOverlay = () => {
    if (!isCalled) return null;

    const showCountdown = hasRecalled && countdownSeconds > 0;
    const countdownLabel = showCountdown
      ? `${Math.floor(countdownSeconds / 60)}:${String(countdownSeconds % 60).padStart(2, "0")}`
      : null;

    return (
      <Animated.View
        style={[
          styles.calledOverlay,
          { opacity: fadeAnim }
        ]}
      >
        <ConfettiParticles />
        <LinearGradient
          colors={[colors.danger, colors.danger + "CC"]}
          style={styles.calledCard}
        >
          <View style={styles.calledIconContainer}>
            <Ionicons name="notifications-circle" size={80} color="#FFF" />
          </View>
          <Text style={styles.calledTitle}>C’est votre tour !</Text>
          <Text style={styles.calledSubtitle}>
            Guichet #{counterNumber || "N/A"}
          </Text>

          {countdownLabel && (
            <Text style={styles.calledCountdown}>
              Rappel auto dans {countdownLabel}
            </Text>
          )}

          <TouchableOpacity
            style={styles.calledButton}
            onPress={handleEnRoute}
          >
            <Text style={styles.calledButtonText}>
              {countdownLabel ? `Je suis en route (${countdownLabel})` : "Je suis en route"}
            </Text>
          </TouchableOpacity>

          <View style={styles.calledActions}>
            <TouchableOpacity
              style={[styles.calledSecondaryBtn, { borderColor: "rgba(255,255,255,0.3)" }]}
              onPress={() => setSoundEnabled((prev) => !prev)}
            >
              <Ionicons
                name={soundEnabled ? "volume-high" : "volume-mute"}
                size={20}
                color="#FFF"
              />
              <Text style={styles.calledSecondaryBtnText}>
                {soundEnabled ? "Son activé" : "Son coupé"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.calledSecondaryBtn, { borderColor: "rgba(255,255,255,0.3)" }]}
              onPress={handleDefer}
            >
              <Ionicons name="time-outline" size={20} color="#FFF" />
              <Text style={styles.calledSecondaryBtnText}>Reporter</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {renderPositionCard()}

          {/* Carte Distance avec icônes - uniquement si en attente */}
          {!isTicketCalledState && !isTicketPresent && hasValidCoordinates && distanceInfo && hasLocationPermission ? (
            <DistanceCard
              distanceInfo={distanceInfo}
              colors={colors}
              departureInfo={departureInfo}
            />
          ) : (!isTicketCalledState && !isTicketPresent) && (
            <View style={[styles.noLocationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="location-outline" size={32} color={colors.textTertiary} />
              <Text style={[styles.noLocationText, { color: colors.textSecondary }]}>
                Position GPS non disponible
              </Text>
              <Text style={[styles.noLocationSubtext, { color: colors.textTertiary }]}>
                Activez la localisation pour voir les temps de trajet
              </Text>
            </View>
          )}

          {renderActionButtons()}

          {/* Timeline activité */}
          {!isTicketCalledState && !isTicketPresent && timelineEntries.length > 0 && (
            <QueueTimeline entries={timelineEntries} colors={colors} />
          )}

          {/* Infos supplémentaires */}
          {!isTicketCalledState && !isTicketPresent && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setSheetVisible(true)}
              style={[styles.infoTriggerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.infoTriggerLeft}>
                <View style={[styles.infoTriggerIcon, { backgroundColor: colors.primary + "15" }]}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.infoTriggerTitle, { color: colors.textPrimary }]}>
                    Détails de la file
                  </Text>
                  <Text style={[styles.infoTriggerSub, { color: colors.textTertiary }]}>
                    Établissement, service, priorité…
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-up" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}

          {/* Smart Tips */}
          {!isTicketCalledState && !isTicketPresent && (
            <SmartTipsCarousel colors={colors} />
          )}
        </Animated.View>
      </ScrollView>

      {renderCalledOverlay()}

      {/* Modal Détails */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSheetVisible(false)}
        />
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHandle} />
          <View style={styles.sheetContent}>
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
              Détails de la file
            </Text>
            <View style={styles.compactInfoGrid}>
              <CompactInfoRow
                icon="business-outline"
                label="Établissement"
                value={displayTicket?.establishment?.name || "---"}
                color={colors.primary}
                colors={colors}
              />
              <CompactInfoRow
                icon="briefcase-outline"
                label="Service"
                value={displayTicket?.service?.name || "---"}
                color={colors.success}
                colors={colors}
              />
              <CompactInfoRow
                icon="ribbon-outline"
                label="Priorité"
                value={
                  displayTicket?.priority === 'vip' ? '⭐ VIP' :
                  displayTicket?.priority === 'high' ? '🔥 Prioritaire' :
                  '📋 Normal'
                }
                color={
                  displayTicket?.priority === 'vip' ? colors.danger :
                  displayTicket?.priority === 'high' ? colors.warning :
                  colors.textSecondary
                }
                colors={colors}
              />
              <CompactInfoRow
                icon="calendar-outline"
                label="Créé le"
                value={displayTicket?.created_at ? new Date(displayTicket.created_at).toLocaleTimeString() : "---"}
                color={colors.secondary}
                colors={colors}
              />
            </View>
          </View>
        </View>
      </Modal>

      {AlertComponent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMain: {
    alignItems: "center",
  },
  ticketLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
    fontWeight: "500",
  },
  ticketNumberHeader: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Status Badge amélioré
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 20,
    gap: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  // Live Indicator amélioré
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveIndicatorText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  // Position Card
  positionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  positionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  positionCardTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  positionNumberBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  positionNumberText: {
    fontSize: 18,
    fontWeight: "800",
  },
  progressBarContainer: {
    marginBottom: 16,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  positionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  etaInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  etaText: {
    fontSize: 13,
  },
  soonBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  soonText: {
    fontSize: 11,
    fontWeight: "600",
  },
  specialStatusMessage: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  specialStatusMessageText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Distance Card
  distanceCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  distanceCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  distanceTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  distanceCardTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  distanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  travelModesGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  travelModeItem: {
    alignItems: "center",
    flex: 1,
  },
  travelModeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  travelModeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  travelModeTime: {
    fontSize: 14,
    fontWeight: "700",
  },
  departureAlert: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  departureAlertText: {
    fontSize: 13,
    flex: 1,
  },
  // No Location
  noLocationCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  noLocationText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 4,
  },
  noLocationSubtext: {
    fontSize: 12,
    textAlign: "center",
  },
  // Action Buttons
  actionButtonsContainer: {
    marginBottom: 20,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  navButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  iconButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconButtonLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 6,
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  // Offline styles
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  offlineBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EA580C',
  },
  offlineActionsNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  offlineActionsNoteText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Compact Info Grid
  compactInfoGrid: {
    gap: 12,
    marginTop: 8,
  },
  compactInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  compactInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  compactInfoContent: {
    flex: 1,
  },
  compactInfoLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  compactInfoValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  // Called Overlay
  calledOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  calledCard: {
    width: width * 0.85,
    borderRadius: 32,
    padding: 32,
    alignItems: "center",
  },
  calledIconContainer: {
    marginBottom: 20,
  },
  calledTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 8,
  },
  calledSubtitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 24,
  },
  calledButton: {
    backgroundColor: "#FFF",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
    width: "100%",
    alignItems: "center",
  },
  calledButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EF4444",
  },
  // ── Position Circle ──────────────────────────────────────────────────────
  posCircleOuter: {
    alignItems: "center",
  },
  posCircleWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  posCircleInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  posCircleCenter: {
    position: "absolute",
    alignItems: "center",
  },
  posCircleValue: {
    fontSize: 28,
    fontWeight: "800",
  },
  posCircleLabel: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: -2,
  },
  posCircleStatus: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  posSoonBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 10,
  },
  posSoonText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  // ── Position Card body ───────────────────────────────────────────────────
  positionCardBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  positionInfoCol: {
    flex: 1,
    gap: 4,
  },
  posInfoTitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  posInfoEta: {
    fontSize: 26,
    fontWeight: "800",
  },
  posInfoPeople: {
    fontSize: 12,
    marginTop: 2,
  },
  posStatusInfo: {
    gap: 2,
  },
  posInfoDesc: {
    fontSize: 12,
  },
  posSoonInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  posSoonInlineText: {
    fontSize: 11,
    fontWeight: "600",
  },
  // ── Timeline ─────────────────────────────────────────────────────────────
  timelineCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  timelineHeaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  timelineEntry: {
    flexDirection: "row",
    gap: 10,
    minHeight: 36,
  },
  timelineDotCol: {
    width: 12,
    alignItems: "center",
    paddingTop: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 10,
  },
  timelineMsg: {
    fontSize: 13,
    lineHeight: 18,
  },
  timelineTime: {
    fontSize: 11,
    marginTop: 1,
  },
  // ── Smart Tips ────────────────────────────────────────────────────────────
  tipsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  tipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tipsIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 2,
  },
  tipsText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tipsDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  tipsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // ── Confetti ─────────────────────────────────────────────────────────────
  confettiContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  confettiPiece: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 2,
    top: "50%",
    left: "50%",
  },
  // ── Called Overlay enhancements ──────────────────────────────────────────
  calledCountdown: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 20,
  },
  calledActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  calledSecondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  calledSecondaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFF",
  },
  // ── Info Trigger (ouvre le bottom sheet) ─────────────────────────────────
  infoTriggerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  infoTriggerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoTriggerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTriggerTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoTriggerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  // ── Modal ──────────────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 40,
    maxHeight: "60%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CCC",
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
});

export default LiveTicketScreen;