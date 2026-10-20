import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  useWindowDimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  useAnimatedScrollHandler,
  SharedValue,
} from 'react-native-reanimated';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useSettings } from '../../store/settingsStore';
import { Theme } from '../../theme';

interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  image: string;
  color: string;
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Gagnez du Temps',
    description: 'Ne faites plus la queue physiquement. Rejoignez des files d\'attente virtuelles instantanément.',
    image: '/Users/bestbeedev/.gemini/antigravity/brain/e909e1b7-bd64-4663-b7a7-2dc90c643127/onboarding_welcome_1773191481722.png',
    color: '#2563EB',
  },
  {
    id: '2',
    title: 'Scannez & Rejoignez',
    description: 'Scannez simplement le code QR de l\'établissement pour obtenir votre ticket numérique.',
    image: '/Users/bestbeedev/.gemini/antigravity/brain/e909e1b7-bd64-4663-b7a7-2dc90c643127/onboarding_scan_1773191502573.png',
    color: '#10B981',
  },
  {
    id: '3',
    title: 'Suivi en Temps Réel',
    description: 'Suivez votre position en direct et recevez une notification lorsqu\'il est temps de vous présenter.',
    image: '/Users/bestbeedev/.gemini/antigravity/brain/e909e1b7-bd64-4663-b7a7-2dc90c643127/onboarding_live_1773191531012.png',
    color: '#F59E0B',
  },
];

// Point de pagination : composant dédié pour que useAnimatedStyle soit appelé au
// niveau d'un composant (et non dans le callback d'un .map())
const PaginationDot = ({
  index,
  scrollX,
  windowWidth,
  activeColor,
}: {
  index: number;
  scrollX: SharedValue<number>;
  windowWidth: number;
  activeColor: string;
}) => {
  const animatedDotStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      [(index - 1) * windowWidth, index * windowWidth, (index + 1) * windowWidth],
      [0.4, 1, 0.4],
      'clamp'
    );
    const scale = interpolate(
      scrollX.value,
      [(index - 1) * windowWidth, index * windowWidth, (index + 1) * windowWidth],
      [0.8, 1.2, 0.8],
      'clamp'
    );
    return {
      opacity,
      transform: [{ scale }],
      backgroundColor: activeColor,
    };
  });

  return <Animated.View style={[styles.dot, animatedDotStyle]} />;
};

export const OnboardingScreen = () => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const colors = useThemeColors();
  const { setOnboardingCompleted } = useSettings();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      await setOnboardingCompleted(true);
      router.replace('/(tabs)');
    }
  };

  const handleSkip = async () => {
    await setOnboardingCompleted(true);
    router.replace('/(tabs)');
  };

  const renderItem = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    return (
      <View style={[styles.slide, { width: windowWidth }]}>
        <View style={styles.imageContainer}>
          <Image
            source={item.image}
            style={[styles.image, { width: windowWidth * 0.85, height: windowWidth * 0.85 }]}
            contentFit="contain"
            transition={500}
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity 
        style={styles.skipButton} 
        onPress={handleSkip}
        activeOpacity={0.7}
      >
        <Text style={[styles.skipText, { color: colors.textSecondary }]}>Passer</Text>
      </TouchableOpacity>

      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => {
          setCurrentIndex(Math.round(event.nativeEvent.contentOffset.x / windowWidth));
        }}
      />

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <PaginationDot
              key={index}
              index={index}
              scrollX={scrollX}
              windowWidth={windowWidth}
              activeColor={index === currentIndex ? colors.primary : '#D1D5DB'}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === slides.length - 1 ? 'Commencer' : 'Continuer'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomDecorator} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  imageContainer: {
    flex: 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  image: {
    // shadow logic simplified for performance in pager
  },
  textContainer: {
    flex: 0.4,
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto',
  },
  description: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Roboto',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 50,
  },
  pagination: {
    flexDirection: 'row',
  },
  dot: {
    height: 10,
    width: 10,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 30,
    zIndex: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomDecorator: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#3B82F6',
    opacity: 0.05,
  }
});

export default OnboardingScreen;
