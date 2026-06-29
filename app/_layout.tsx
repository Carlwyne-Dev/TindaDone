import 'react-native-gesture-handler';
import { View, Image, Dimensions, StyleSheet, ActivityIndicator } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';
import { isActivated, getTrialStatus } from '../lib/license';
import { 
  Audio, 
  InterruptionModeAndroid, 
  InterruptionModeIOS 
} from 'expo-av';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  FadeIn,
} from 'react-native-reanimated';

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';

import { useColorScheme } from '../components/useColorScheme';
import { Theme } from '../constants/Theme';
import { SettingsProvider } from '../context/SettingsContext';
import { TintinProvider } from '../context/TintinContext';
import { TintinMascot } from '../components/TintinMascot';
import { syncActivationStatus } from '../lib/license';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// Custom animated loading screen
function AppSplash() {
  const rotation = useSharedValue(0);
  const rotation2 = useSharedValue(0);

  useEffect(() => {
    // Main spinner — clockwise
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );
    // Background track — slightly slower, opposite direction
    rotation2.value = withRepeat(
      withTiming(-360, { duration: 1800, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const spinStyle2 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation2.value}deg` }],
  }));

  return (
    <View style={splashStyles.container}>
      <Animated.View entering={FadeIn.duration(400)} style={splashStyles.logoWrap}>
        {/* Slow faint outer track */}
        <Animated.View style={[splashStyles.outerRing, spinStyle2]} />
        {/* Fast solid loading arc encircling the image */}
        <Animated.View style={[splashStyles.ring, spinStyle]} />
        {/* Mascot image in the center */}
        <Image
          source={require('../assets/loading.png')}
          style={splashStyles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 4,
    borderColor: Theme.colors.primary,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  outerRing: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 2,
    borderColor: Theme.colors.primary + '33',
    borderTopColor: 'transparent',
  },
  logo: {
    width: 110,
    height: 110,
  },
});

export default function RootLayout() {
  const appStartTime = useRef(Date.now()).current;
  const [loaded, error] = useFonts({
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
    'PlusJakartaSans-ExtraBold': PlusJakartaSans_800ExtraBold,
    'Manrope-Regular': Manrope_400Regular,
    'Manrope-Medium': Manrope_500Medium,
    'Manrope-SemiBold': Manrope_600SemiBold,
    'Manrope-Bold': Manrope_700Bold,
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // ⏱️ Minimum splash duration: 2.5 seconds for a premium feel
      const MIN_SPLASH_MS = 2500;
      const elapsed = Date.now() - appStartTime;
      const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);

      setTimeout(() => {
        SplashScreen.hideAsync();
      }, remaining);

      syncActivationStatus();
      Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        playThroughEarpieceAndroid: false,
      }).catch(err => console.error("Audio mode error:", err));
    }
  }, [loaded]);

  if (!loaded) {
    return <AppSplash />;
  }

  return (
    <SettingsProvider>
      <TintinProvider>
        <View style={{ flex: 1, backgroundColor: Theme.colors.background }}>
          <RootLayoutNav />
          <TintinMascot />
        </View>
      </TintinProvider>
    </SettingsProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const [canEnter, setCanEnter] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const activated = await isActivated();
      if (activated) {
        setCanEnter(true);
        return;
      }
      const trial = await getTrialStatus();
      setCanEnter(trial.active);
    };
    checkAccess();
  }, []);

  if (canEnter === null) return <AppSplash />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" backgroundColor={Theme.colors.background} translucent={false} />
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ 
          contentStyle: { backgroundColor: Theme.colors.background }, 
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 220,
        }}>
          <Stack.Screen name="activate" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sales-history" options={{ headerShown: false }} />
          <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="transaction/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="history" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

