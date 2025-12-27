import { App } from 'expo-router/build/qualified-entry';
import React, { memo, useEffect } from 'react';
import { Platform } from 'react-native';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { ErrorBoundaryWrapper } from './__create/SharedErrorBoundary';
import { Toaster } from 'sonner-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Purchases from 'react-native-purchases';
import './global.css';

// Initialize RevenueCat as early as possible
const initRevenueCat = async () => {
  if (Platform.OS === 'web') return;
  try {
    const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
    if (apiKey) {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      await Purchases.configure({ apiKey });
      console.log('RevenueCat initialized');
    }
  } catch (error) {
    console.warn('RevenueCat initialization skipped:', error.message);
  }
};

initRevenueCat();

const GlobalErrorReporter = () => {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    const errorHandler = (event: ErrorEvent) => {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      console.error(event.error);
    };
    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      console.error('Unhandled promise rejection:', event.reason);
    };
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);
    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
    };
  }, []);
  return null;
};

const Wrapper = memo(() => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundaryWrapper>
        <App />
        <GlobalErrorReporter />
        <Toaster />
      </ErrorBoundaryWrapper>
    </GestureHandlerRootView>
  );
});

const CreateApp = () => {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    (async () => {
      try {
        const { status } = await requestTrackingPermissionsAsync();
        if (status === 'granted') {
          console.log('Tracking permission granted');
        }
        
        // Dynamically require to avoid startup crash if module is missing
        const ads = require('react-native-google-mobile-ads');
        if (ads) {
          const mobileAds = ads.default || ads;
          if (mobileAds && typeof mobileAds === 'function') {
            await mobileAds().initialize();
            console.log('AdMob initialized');
          }
        }
      } catch (error) {
        console.warn('AdMob initialization skipped:', error.message);
      }
    })();
  }, []);

  return <Wrapper />;
};

export default CreateApp;
