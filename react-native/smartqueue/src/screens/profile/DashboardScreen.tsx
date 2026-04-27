import React, { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useUserStatsStore, Badge } from "../../store/userStatsStore";
import { LinearGradient } from "expo-linear-gradient";
import "../../../global.css";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}j ${remainingHours}h` : `${days}j`;
};

const StatCard: React.FC<{
  icon: string;
  value: string;
  label: string;
  color: string;
  colors: any;
}> = ({ icon, value, label, color, colors }) => (
  <View
    style={[
      styles.statCard,
      { backgroundColor: colors.surface, borderColor: colors.border },
    ]}
  >
    <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
      <Ionicons name={icon as any} size={24} color={color} />
    </View>
    <Text style={[styles.statValue, { color: colors.textPrimary }]}>
      {value}
    </Text>
    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
      {label}
    </Text>
  </View>
);

const BadgeItem: React.FC<{ badge: Badge; colors: any }> = ({
  badge,
  colors,
}) => {
  const isUnlocked = !!badge.unlockedAt;
  const progress = Math.min(100, (badge.progress / badge.maxProgress) * 100);

  return (
    <View
      style={[
        styles.badgeItem,
        {
          backgroundColor: isUnlocked ? badge.color + "15" : colors.surface,
          borderColor: isUnlocked ? badge.color : colors.border,
          opacity: isUnlocked ? 1 : 0.6,
        },
      ]}
    >
      <View
        style={[
          styles.badgeIcon,
          { backgroundColor: isUnlocked ? badge.color : colors.textTertiary },
        ]}
      >
        <Ionicons
          name={badge.icon as any}
          size={24}
          color={isUnlocked ? "#FFFFFF" : colors.textTertiary}
        />
      </View>
      <View style={styles.badgeInfo}>
        <Text
          style={[
            styles.badgeName,
            { color: isUnlocked ? badge.color : colors.textSecondary },
          ]}
        >
          {badge.name}
        </Text>
        <Text
          style={[styles.badgeDesc, { color: colors.textTertiary }]}
          numberOfLines={1}
        >
          {badge.description}
        </Text>
        {!isUnlocked && (
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress}%`,
                    backgroundColor: badge.color,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.textTertiary }]}>
              {badge.progress}/{badge.maxProgress}
            </Text>
          </View>
        )}
        {isUnlocked && (
          <View style={styles.unlockedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={badge.color} />
            <Text style={[styles.unlockedText, { color: badge.color }]}>
              Débloqué !
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const WeeklyChart: React.FC<{ data: number[]; colors: any }> = ({
  data,
  colors,
}) => {
  const max = Math.max(...data, 1);
  const days = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <View style={styles.chartContainer}>
      <Text style={[styles.chartTitle, { color: colors.textSecondary }]}
        >Activité cette semaine</Text
      >
      <View style={styles.chartBars}>
        {data.map((value, index) => (
          <View key={index} style={styles.chartBarContainer}>
            <View
              style={[
                styles.chartBar,
                {
                  height: `${(value / max) * 100}%`,
                  backgroundColor:
                    value > 0 ? colors.primary : colors.surfaceSecondary,
                  minHeight: value > 0 ? 4 : 2,
                },
              ]}
            />
            <Text style={[styles.chartDay, { color: colors.textTertiary }]}>
              {days[index]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export const DashboardScreen: React.FC = () => {
  const colors = useThemeColors();
  const {
    currentLevel,
    xpPoints,
    nextLevelXp,
    totalTimeSavedMinutes,
    totalTicketsCreated,
    totalTicketsCompleted,
    totalDistanceKm,
    uniqueEstablishmentsVisited,
    badges,
    streakDays,
    weeklyActivity,
    getRankTitle,
    loadStatsFromBackend,
  } = useUserStatsStore();

  useFocusEffect(
    useCallback(() => {
      console.log('[Dashboard] Screen focused - refreshing stats');
      loadStatsFromBackend();
    }, [loadStatsFromBackend])
  );

  const rankTitle = getRankTitle();
  const xpProgress = Math.min(100, (xpPoints / nextLevelXp) * 100);
  const unlockedBadges = badges.filter((b) => b.unlockedAt);
  const lockedBadges = badges.filter((b) => !b.unlockedAt);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={[colors.primary, colors.primary + "80"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.levelCard}
        >
          <View style={styles.levelInfo}>
            <Text style={styles.levelNumber}>Niveau {currentLevel}</Text>
            <Text style={styles.rankTitle}>{rankTitle}</Text>
            <View style={styles.xpContainer}>
              <View style={styles.xpBar}>
                <View
                  style={[
                    styles.xpFill,
                    { width: `${xpProgress}%`, backgroundColor: "#FFFFFF" },
                  ]}
                />
              </View>
              <Text style={styles.xpText}>
                {xpPoints} / {nextLevelXp} XP
              </Text>
            </View>
          </View>
          <View style={styles.levelBadge}>
            <Ionicons name="trophy" size={40} color="#FFFFFF" />
          </View>
        </LinearGradient>

        {/* Streak */}
        {streakDays > 1 && (
          <View
            style={[
              styles.streakBanner,
              { backgroundColor: colors.warning + "20" },
            ]}
          >
            <Ionicons name="flame" size={20} color={colors.warning} />
            <Text style={[styles.streakText, { color: colors.warning }]}>
              Série de {streakDays} jours ! 🔥
            </Text>
          </View>
        )}
      </View>

      {/* Main Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="hourglass"
          value={formatDuration(totalTimeSavedMinutes)}
          label="Temps économisé"
          color="#10B981"
          colors={colors}
        />
        <StatCard
          icon="ticket"
          value={String(totalTicketsCreated)}
          label="Tickets créés"
          color="#3B82F6"
          colors={colors}
        />
        <StatCard
          icon="checkmark-circle"
          value={String(totalTicketsCompleted)}
          label="Complétés"
          color="#8B5CF6"
          colors={colors}
        />
        <StatCard
          icon="navigate"
          value={`${Math.round(totalDistanceKm * 10) / 10} km`}
          label="Distance parcourue"
          color="#F59E0B"
          colors={colors}
        />
      </View>

      {/* Weekly Chart */}
      <WeeklyChart data={weeklyActivity} colors={colors} />

      {/* Establishments */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Ionicons name="business" size={20} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Établissements visités
          </Text>
        </View>
        <Text style={[styles.sectionValue, { color: colors.primary }]}>
          {uniqueEstablishmentsVisited.length}
        </Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          établissements différents
        </Text>
      </View>

      {/* Badges Section */}
      <View style={styles.badgesSection}>
        <View style={styles.badgesHeader}>
          <Text style={[styles.badgesTitle, { color: colors.textPrimary }]}>
            Badges
          </Text>
          <Text style={[styles.badgesCount, { color: colors.textSecondary }]}>
            {unlockedBadges.length} / {badges.length}
          </Text>
        </View>

        {/* Unlocked Badges */}
        {unlockedBadges.length > 0 && (
          <View style={styles.badgesList}>
            <Text style={[styles.badgesSubtitle, { color: colors.success }]}>
              Débloqués
            </Text>
            {unlockedBadges.map((badge) => (
              <BadgeItem key={badge.type} badge={badge} colors={colors} />
            ))}
          </View>
        )}

        {/* Locked Badges */}
        {lockedBadges.length > 0 && (
          <View style={styles.badgesList}>
            <Text style={[styles.badgesSubtitle, { color: colors.textTertiary }]}>
              En cours
            </Text>
            {lockedBadges.slice(0, 3).map((badge) => (
              <BadgeItem key={badge.type} badge={badge} colors={colors} />
            ))}
            {lockedBadges.length > 3 && (
              <TouchableOpacity
                style={styles.moreBadgesButton}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.moreBadgesText,
                    { color: colors.primary },
                  ]}
                >
                  Voir les {lockedBadges.length - 3} autres badges
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderRadius: 20,
  },
  levelInfo: {
    flex: 1,
  },
  levelNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  rankTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 4,
  },
  xpContainer: {
    marginTop: 12,
  },
  xpBar: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 4,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    borderRadius: 4,
  },
  xpText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  levelBadge: {
    width: 60,
    height: 60,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  streakBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  streakText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    gap: 12,
  },
  statCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  chartContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  chartBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 80,
  },
  chartBarContainer: {
    alignItems: "center",
    flex: 1,
  },
  chartBar: {
    width: 24,
    borderRadius: 4,
  },
  chartDay: {
    fontSize: 12,
    marginTop: 6,
  },
  sectionCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  sectionValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  sectionDesc: {
    fontSize: 12,
    marginLeft: 8,
  },
  badgesSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  badgesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  badgesTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  badgesCount: {
    fontSize: 14,
  },
  badgesList: {
    marginBottom: 16,
  },
  badgesSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  badgeItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: "700",
  },
  badgeDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 6,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    marginTop: 2,
  },
  unlockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  unlockedText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  moreBadgesButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  moreBadgesText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default DashboardScreen;
