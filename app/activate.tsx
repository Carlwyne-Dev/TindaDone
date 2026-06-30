import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  generateDeviceCode, 
  validateActivationKey, 
  saveActivation, 
  getTrialStatus, 
  startTrial,
  syncTrialWithServer,
  isRevoked,
  TrialStatus 
} from '../lib/license';
import { getBusinessSettings, saveBusinessSettings } from '../lib/storage';
import { Theme } from '../constants/Theme';
import { CheckCircle2, Lock, Play, Clock, AlertTriangle, Copy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

export default function ActivateScreen() {
  const router = useRouter();
  const [deviceCode, setDeviceCode] = useState('');
  const [activationKey, setActivationKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [trial, setTrial] = useState<TrialStatus | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingSuccessType, setPendingSuccessType] = useState<'trial' | 'key' | null>(null);
  
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(40)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const init = async () => {
      const code = await generateDeviceCode();
      const settings = await getBusinessSettings();
      if (settings.ownerName) setOwnerName(settings.ownerName);

      setLoading(true);
      
      // 🔄 AUTO-RECOVERY CHECK
      // Check if this device is already activated on the server (e.g. after a Restore)
      try {
        const PRODUCTION_URL = 'https://tinda-done.vercel.app';
        const res = await fetch(`${PRODUCTION_URL}/api/check-status?deviceId=${code}`);
        if (res.ok) {
          const data = await res.json();
          if (data.activated && !data.revoked) {
            console.log('[License] Auto-recovery triggered. Unlocking...');
            await saveActivation(); // Re-activate locally
            router.replace('/(tabs)/sell');
            return;
          }
        }
      } catch (e) {
        console.log('[License] Auto-recovery check skipped (Offline)');
      }

      await syncTrialWithServer();
      
      const isRev = await isRevoked();
      setRevoked(isRev);

      const status = await getTrialStatus();
      setDeviceCode(code);
      setTrial(status);
      setLoading(false);
    };
    init();
  }, []);

  const shake = () => {
    Vibration.vibrate(400);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const showNotification = (msg: string) => {
    setError(msg);
    setShowToast(true);
    
    Animated.parallel([
      Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, tension: 50 }),
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastAnim, { toValue: 20, duration: 300, useNativeDriver: true }),
        Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setShowToast(false));
    }, 3000);
  };

  const persistOwnerName = async () => {
    try {
      const settings = await getBusinessSettings();
      await saveBusinessSettings({ ...settings, ownerName: ownerName.trim() });
    } catch (e) {
      console.error('Failed to save owner name to settings:', e);
    }
  };

  const copyDeviceCode = async () => {
    await Clipboard.setStringAsync(deviceCode);
    showNotification('Device ID copied to clipboard!');
  };

  const handleActivate = async () => {
    if (activationKey.trim().length < 8) {
      showNotification('Please enter a valid activation key.');
      shake();
      return;
    }
    
    // For Activation: Validate KEY first, then ask NAME
    setVerifying(true);
    const valid = await validateActivationKey(deviceCode, activationKey);
    if (valid) {
      setPendingSuccessType('key');
      setShowNameModal(true);
      setVerifying(false);
    } else {
      shake();
      showNotification('Invalid key. Contact your seller.');
      setVerifying(false);
    }
  };

  const handleStartTrial = () => {
    // For Trial: Ask NAME first, then Handshake
    setPendingSuccessType('trial');
    setShowNameModal(true);
  };

  const handleFinalizeOnboarding = async () => {
    if (!ownerName.trim()) {
      Vibration.vibrate();
      shake();
      return;
    }
    
    setVerifying(true);
    try {
      if (pendingSuccessType === 'trial') {
        // TRIAL Handshake with the REAL name now
        const result = await startTrial(ownerName.trim());
        if (!result.success) {
          showNotification(result.error || 'Connection error. Try Again.');
          setVerifying(false);
          return;
        }
      } else {
        // ACTIVATION Persistence
        await saveActivation(activationKey, ownerName.trim());
      }

      // Save locally to Settings
      await persistOwnerName();
      
      setShowNameModal(false);
      router.replace('/(tabs)/sell');
    } catch (e) {
      showNotification('Error saving registration.');
    }
    setVerifying(false);
  };

  const formatKeyInput = (text: string) => {
    setActivationKey(text.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  if (revoked) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFDAD6', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
          <AlertTriangle size={40} color="#BA1A1A" />
        </View>
        <Text style={{ fontFamily: Theme.typography.headlineBlack, fontSize: 28, color: '#BA1A1A', textAlign: 'center', marginBottom: 16 }}>Access Revoked</Text>
        <Text style={{ fontFamily: Theme.typography.body, fontSize: 16, color: Theme.colors.onSurfaceVariant, textAlign: 'center', lineHeight: 24, marginBottom: 32 }}>
          Your access to TindaDone has been revoked. If you believe this is a mistake, please contact the administrator.
        </Text>
        <View style={{ backgroundColor: Theme.colors.surfaceVariant, padding: 16, borderRadius: 16, width: '100%', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontFamily: Theme.typography.body, fontSize: 14, color: Theme.colors.onSurfaceVariant, marginBottom: 4 }}>Call or Text</Text>
          <Text style={{ fontFamily: Theme.typography.headlineBlack, fontSize: 20, color: Theme.colors.onSurface }}>09949704783</Text>
        </View>
        <TouchableOpacity 
          style={{ backgroundColor: Theme.colors.surfaceVariant, padding: 16, borderRadius: 16, width: '100%', alignItems: 'center' }}
          onPress={() => Linking.openURL('https://www.facebook.com/crlwyn')}
          activeOpacity={0.7}
        >
          <Text style={{ fontFamily: Theme.typography.body, fontSize: 14, color: Theme.colors.onSurfaceVariant, marginBottom: 4 }}>Facebook</Text>
          <Text style={{ fontFamily: Theme.typography.bodyBold, fontSize: 16, color: Theme.colors.primary, textAlign: 'center' }}>facebook.com/crlwyn</Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: Theme.typography.body, fontSize: 12, color: Theme.colors.outline, textAlign: 'center', marginTop: 40 }}>
          Device ID: {deviceCode}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandArea}>
          <View style={styles.logoPill}>
            <Lock size={32} color="#FFF" strokeWidth={2.5} />
          </View>
          <Text style={styles.appName}>TindaDone</Text>
        </View>

        <View style={styles.textGroup}>
          <Text style={styles.title}>Unlock Full Suite</Text>
          <Text style={styles.subtitle}>Unlock permanent access to all boutique tools</Text>
        </View>
        
        {trial?.active && (
          <View style={[styles.statusPill, { backgroundColor: Theme.colors.secondaryContainer }]}>
            <Clock size={16} color={Theme.colors.secondary} />
            <Text style={[styles.statusText, { color: Theme.colors.onSecondaryContainer }]}>
              Trial Active: {trial.daysLeft} days remaining
            </Text>
          </View>
        )}

        {trial?.expired && (
          <View style={[styles.statusPill, { backgroundColor: '#FFDAD6' }]}>
            <AlertTriangle size={16} color="#BA1A1A" />
            <Text style={[styles.statusText, { color: '#410002' }]}>
              Free Trial Expired! Activation Required.
            </Text>
          </View>
        )}

        <View style={styles.certCard}>
          <Text style={styles.certLabel}>DEVICE CERTIFICATE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
            <Text style={[styles.certValue, { marginTop: 0 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{deviceCode}</Text>
            <TouchableOpacity onPress={copyDeviceCode} style={{ marginLeft: 10, padding: 8, backgroundColor: Theme.colors.surfaceVariant, borderRadius: 8 }}>
              <Copy size={20} color={Theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          <Text style={styles.certHint}>Provide this certificate to your official seller to buy the app.</Text>
        </View>

        <View style={styles.inputSuite}>
          <Text style={styles.inputLabel}>ACTIVATION KEY</Text>
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <TextInput
              style={[styles.keyInput, error === 'Please enter a valid activation key.' ? styles.keyInputError : null]}
              placeholder="XXXX-XXXX-XXXX"
              placeholderTextColor={Theme.colors.outlineVariant}
              value={activationKey}
              onChangeText={formatKeyInput}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              maxLength={15}
              keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
              textContentType="none"
            />
          </Animated.View>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, verifying && { opacity: 0.7 }]}
          onPress={handleActivate}
          disabled={verifying}
          activeOpacity={0.8}
        >
          {verifying ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <CheckCircle2 size={20} color="#FFF" strokeWidth={2.5} />
              <Text style={styles.primaryBtnText}>Activate Full Version</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.subtitle, { marginTop: 30, marginBottom: 15, color: Theme.colors.outline }]}>
          Not ready to buy? Scroll down to start a free trial!
        </Text>

        <View style={styles.divider} />

        {/* Trial Options */}
        {trial?.notStarted && (
          <TouchableOpacity 
            style={[styles.secondaryBtn, verifying && { opacity: 0.7 }]} 
            onPress={handleStartTrial}
            disabled={verifying}
            activeOpacity={0.7}
          >
            {verifying ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator color={Theme.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.secondaryBtnText}>Connecting...</Text>
              </View>
            ) : (
              <>
                <Play size={18} color={Theme.colors.primary} />
                <Text style={styles.secondaryBtnText}>Start 7-Day Free Trial</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {trial?.active && (
          <TouchableOpacity 
            style={styles.secondaryBtn} 
            onPress={() => router.replace('/(tabs)/sell')}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>Enter Dashboard</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.footer}>
          Permanent activation keeps all your data safe forever.
        </Text>
      </ScrollView>

      {showNameModal && (
        <View style={styles.modalOverlay}>
          <Animated.View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <CheckCircle2 size={32} color="#FFF" />
            </View>
            <Text style={styles.modalTitle}>Perfect!</Text>
            <Text style={styles.modalSub}>
              {pendingSuccessType === 'key' ? 'License verified' : 'Trial access granted'}. 
              What should we call you?
            </Text>

            <View style={[styles.inputSuite, { marginBottom: 24 }]}>
              <Text style={styles.inputLabel}>YOUR NAME</Text>
              <TextInput
                style={[styles.keyInput, { fontSize: 18, textAlign: 'center', letterSpacing: 0, paddingHorizontal: 20 }]}
                placeholder="e.g. Maria, Juan, Aling Nena"
                placeholderTextColor={Theme.colors.outlineVariant}
                value={ownerName}
                onChangeText={setOwnerName}
                autoFocus
              />
            </View>

            <TouchableOpacity 
              style={styles.primaryBtn} 
              onPress={handleFinalizeOnboarding}
              disabled={verifying}
              activeOpacity={0.8}
            >
              {verifying ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Start Managing</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* Boutique Toast */}
      {showToast && (
        <Animated.View style={[
          styles.toastBox, 
          { 
            opacity: toastOpacity,
            transform: [{ translateY: toastAnim }]
          }
        ]}>
          <AlertTriangle size={18} color="#FFF" />
          <Text style={styles.toastText}>{error}</Text>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    alignItems: 'center',
    padding: 24,
    paddingTop: '15%',
    paddingBottom: 120,
  },
  brandArea: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoPill: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  appName: {
    fontFamily: Theme.typography.headlineBlack,
    fontSize: 22,
    color: Theme.colors.onSurface,
    letterSpacing: 0.5,
  },
  textGroup: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontFamily: Theme.typography.headlineBlack,
    fontSize: 28,
    color: Theme.colors.onSurface,
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: Theme.typography.bodySemiBold,
    fontSize: 14,
    color: Theme.colors.outline,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 32,
    gap: 10,
  },
  statusText: {
    fontFamily: Theme.typography.bodyBold,
    fontSize: 13,
  },
  certCard: {
    width: '100%',
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 32,
    padding: 28,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  certLabel: {
    fontFamily: Theme.typography.bodyBold,
    fontSize: 10,
    color: Theme.colors.primary,
    letterSpacing: 2,
    marginBottom: 12,
  },
  certValue: {
    fontFamily: Theme.typography.headlineBlack,
    fontSize: 26,
    color: Theme.colors.onSurface,
    letterSpacing: 1.5,
    marginBottom: 8,
    flexShrink: 1,
  },
  certHint: {
    fontFamily: Theme.typography.bodyMedium,
    fontSize: 11,
    color: Theme.colors.outline,
    textAlign: 'center',
  },
  inputSuite: {
    width: '100%',
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: Theme.typography.bodyBold,
    fontSize: 11,
    color: Theme.colors.primary,
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  keyInput: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 20,
    height: 72,
    fontFamily: Theme.typography.headlineBlack,
    fontSize: 24,
    color: Theme.colors.onSurface,
    textAlign: 'center',
    letterSpacing: 4,
    borderWidth: 2,
    borderColor: Theme.colors.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  keyInputError: {
    borderColor: Theme.colors.tertiary,
    backgroundColor: Theme.colors.tertiary + '05',
  },
  divider: {
    height: 1,
    width: '60%',
    backgroundColor: Theme.colors.outlineVariant,
    marginVertical: 32,
    opacity: 0.5,
  },
  toastBox: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: Theme.colors.tertiary,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  toastText: {
    fontFamily: Theme.typography.bodyBold,
    fontSize: 14,
    color: '#FFF',
    flex: 1,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: Theme.colors.primary,
    borderRadius: 24,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryBtnText: {
    fontFamily: Theme.typography.headlineBlack,
    fontSize: 18,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    width: '100%',
    height: 64,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    gap: 12,
  },
  secondaryBtnText: {
    fontFamily: Theme.typography.headlineBlack,
    fontSize: 16,
    color: Theme.colors.primary,
    letterSpacing: 0.5,
  },
  footer: {
    fontFamily: Theme.typography.bodyMedium,
    fontSize: 12,
    color: Theme.colors.outline,
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 40,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 20,
  },
  modalIcon: {
    width: 80, height: 80, borderRadius: 28,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: Theme.typography.headlineBlack,
    fontSize: 28,
    color: Theme.colors.onSurface,
    marginBottom: 12,
    letterSpacing: -1,
  },
  modalSub: {
    fontFamily: Theme.typography.bodySemiBold,
    fontSize: 15,
    color: Theme.colors.outline,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
  },
});
