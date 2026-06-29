import 'react-native-gesture-handler';
import { View, Image, StyleSheet, ActivityIndicator, Animated as RNAnimated } from 'react-native';
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

// Custom animated loading screen using RN Animated (reliable on Android)
function AppSplash() {
  const spin = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: (t) => t, // linear
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={splashStyles.container}>
      <View style={splashStyles.logoWrap}>
        {/* Spinning green arc around the image */}
        <RNAnimated.View style={[splashStyles.ring, { transform: [{ rotate }] }]} />
        {/* Mascot image in the center */}
        <Image
          source={require('../assets/loading.png')}
          style={splashStyles.logo}
          resizeMode="contain"
        />
      </View>
      {/* Small dots loader below */}
      <ActivityIndicator
        size="small"
        color="#0a643b"
        style={{ marginTop: 24 }}
      />
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F9F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 5,
    borderColor: '#0a643b',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
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

