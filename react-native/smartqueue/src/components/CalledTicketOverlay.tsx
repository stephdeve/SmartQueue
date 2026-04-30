import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatDistance, formatTravelTime, DistanceInfo } from '../utils/distance';
import { useThemeColors } from '../hooks/useThemeColors';

interface CalledTicketOverlayProps {
  visible: boolean;
  counterNumber?: string;
  distanceInfo: DistanceInfo | null;
  countdownSeconds: number; // Default 600 (10 minutes)
  hasRecalled: boolean;
  isSwapped?: boolean; // If ticket was already swapped/deferred
  gracePeriodExpiresAt?: string | null;
  onEnRoute: () => void;
  onRecall: () => Promise<void>;
  onDefer: () => void; // New callback for defer action
  onDismiss: () => void;
}

export const CalledTicketOverlay: React.FC<CalledTicketOverlayProps> = ({
  visible,
  counterNumber,
  distanceInfo,
  countdownSeconds = 180,
  hasRecalled,
  isSwapped = false,
  gracePeriodExpiresAt,
  onEnRoute,
  onRecall,
  onDefer,
  onDismiss,
}) => {
  const colors = useThemeColors();
  const [timeRemaining, setTimeRemaining] = useState(countdownSeconds);
  const [isExpired, setIsExpired] = useState(false);
  const [isRecallLoading, setIsRecallLoading] = useState(false);
  const flashAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Countdown timer
  useEffect(() => {
    if (!visible || isExpired) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, isExpired]);

  // Reset when visibility changes
  useEffect(() => {
    if (visible) {
      setTimeRemaining(countdownSeconds);
      setIsExpired(false);
    }
  }, [visible, countdownSeconds]);

  // Flash animation for urgency
  useEffect(() => {
    if (visible && timeRemaining <= 60 && timeRemaining > 0) {
      const flash = Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, {
            toValue: 0.5,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(flashAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      flash.start();
      return () => flash.stop();
    }
  }, [visible, timeRemaining, flashAnim]);

  // Haptic feedback when called
  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // Vibrate pattern
      const pattern = [0, 500, 200, 500, 200, 500];
      Vibration.vibrate(Platform.OS === 'ios' ? [0, 500, 200, 500] : pattern);
    }
  }, [visible]);

  // Format countdown as MM:SS
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle "I'm on my way" button
  const handleEnRoute = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onEnRoute();
  };

  // Handle "Recall me" button
  const handleRecall = async () => {
    if (hasRecalled || isRecallLoading) return;
    setIsRecallLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await onRecall();
    // Reset countdown after recall
    setTimeRemaining(countdownSeconds);
    setIsRecallLoading(false);
  };

  // Handle "Defer" button - swap position with next person
  const handleDefer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDefer();
  };

  // Format grace period time remaining
  const getGracePeriodText = () => {
    if (!gracePeriodExpiresAt) return null;
    const expires = new Date(gracePeriodExpiresAt);
    const now = new Date();
    const hoursLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60));
    return `${hoursLeft}h restantes`;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent
      onRequestClose={() => {}} // Prevent back button dismiss on Android
    >
      <View style={{ flex: 1, backgroundColor: colors.danger }}>
        {/* Header */}
        <View className="pt-16 px-6 items-center">
          <Animated.View style={{ opacity: flashAnim }}>
            <View className="w-24 h-24 rounded-full items-center justify-center mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <Ionicons name="notifications" size={48} color="#FFFFFF" />
            </View>
          </Animated.View>
          
          <Text className="text-white text-3xl font-bold text-center mb-2">
            C&apos;est votre tour !
          </Text>
          
          {counterNumber && (
            <View className="px-6 py-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <Text className="text-white text-lg font-bold">
                Guichet N° {counterNumber}
              </Text>
            </View>
          )}
        </View>

        {/* Countdown */}
        <View className="items-center mt-8">
          {isExpired ? (
            <View className="px-8 py-4 rounded-2xl" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
              <Text className="text-white text-2xl font-bold text-center">
                Délai expiré
              </Text>
              <Text className="text-white/80 text-center mt-1">
                Votre ticket a été marqué absent
              </Text>
            </View>
          ) : (
            <>
              <Text className="text-white/80 text-lg mb-2">Temps restant</Text>
              <Animated.Text 
                className="text-white text-7xl font-black"
                style={{ opacity: flashAnim }}
              >
                {formatCountdown(timeRemaining)}
              </Animated.Text>
            </>
          )}
        </View>

        {/* Distance Info */}
        {distanceInfo && !isExpired && (
          <View className="mx-6 mt-6 rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <View className="flex-row items-center justify-center mb-3">
              <Ionicons name="location" size={20} color="#FFFFFF" />
              <Text className="text-white font-bold ml-2">Distance actuelle</Text>
            </View>
            <View className="flex-row mt-4 justify-around">
              <View className="items-center">
                <Ionicons name="navigate" size={18} color="#FFFFFF" />
                <Text className="text-white font-bold mt-1">
                  {formatDistance(distanceInfo.kilometers)}
                </Text>
              </View>
              <View className="items-center">
                <Ionicons name="car" size={18} color="#FFFFFF" />
                <Text className="text-white font-bold mt-1">
                  {formatTravelTime(distanceInfo.travelTimes.car)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {!isExpired && (
          <View className="flex-1 justify-end pb-12 px-6">
            {/* "I'm on my way" button */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                className="h-16 rounded-2xl flex-row items-center justify-center mb-4"
                style={{ backgroundColor: '#FFFFFF' }}
                onPress={handleEnRoute}
                activeOpacity={0.8}
              >
                <Ionicons name="walk" size={24} color={colors.danger} />
                <Text className="font-bold text-lg ml-2" style={{ color: colors.danger }}>
                  Je suis en route
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* "Defer" button - swap position with next person - FILLED style */}
            <TouchableOpacity
              className="h-16 rounded-2xl flex-row items-center justify-center mb-4"
              style={{
                backgroundColor: isSwapped ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)',
              }}
              onPress={handleDefer}
              disabled={isSwapped}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isSwapped ? "checkmark-circle" : "swap-horizontal"}
                size={24}
                color={isSwapped ? "rgba(255,255,255,0.5)" : "#FFFFFF"}
              />
              <Text
                className="font-bold text-lg ml-2"
                style={{ color: isSwapped ? 'rgba(255,255,255,0.5)' : '#FFFFFF' }}
              >
                {isSwapped ? 'Déjà différé' : 'Laisser passer'}
              </Text>
            </TouchableOpacity>

            {/* "Recall me" button - OUTLINE style */}
            <TouchableOpacity
              className="h-16 rounded-2xl flex-row items-center justify-center border-2 mb-4"
              style={{
                backgroundColor: hasRecalled ? 'rgba(0,0,0,0.3)' : 'transparent',
                borderColor: hasRecalled ? 'rgba(255,255,255,0.3)' : '#FFFFFF',
              }}
              onPress={handleRecall}
              disabled={hasRecalled || isRecallLoading}
              activeOpacity={0.8}
            >
              <Ionicons
                name={hasRecalled ? "checkmark-circle" : "refresh"}
                size={24}
                color={hasRecalled ? "rgba(255,255,255,0.6)" : "#FFFFFF"}
              />
              <Text
                className="font-bold text-lg ml-2"
                style={{ color: hasRecalled ? 'rgba(255,255,255,0.6)' : '#FFFFFF' }}
              >
                {hasRecalled ? 'Rappel déjà utilisé' : 'Me rappeler'}
              </Text>
            </TouchableOpacity>

            {/* Grace period info */}
            {gracePeriodExpiresAt && (
              <Text className="text-white/60 text-center text-sm mt-4">
                Période de grâce: {getGracePeriodText()}
              </Text>
            )}


            {/* Info text */}
            <Text className="text-white/60 text-center text-sm mt-4">
              {hasRecalled 
                ? 'Le rappel ne peut être utilisé qu\'une seule fois'
                : 'Un rappel vous sera envoyé par SMS et notification'
              }
            </Text>
          </View>
        )}

        {/* Expired state - Get new ticket */}
        {isExpired && (
          <View className="flex-1 justify-end pb-12 px-6">
            <TouchableOpacity
              className="h-16 rounded-2xl flex-row items-center justify-center"
              style={{ backgroundColor: '#FFFFFF' }}
              onPress={onDismiss}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={24} color={colors.danger} />
              <Text className="font-bold text-lg ml-2" style={{ color: colors.danger }}>
                Prendre un nouveau ticket
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default CalledTicketOverlay;
