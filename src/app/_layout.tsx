import { useAuth } from "@/utils/auth/useAuth";
import { supabase } from "@/utils/supabase";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, memo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useColorScheme, Platform } from "react-native";
import { Toaster } from "sonner-native";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import Purchases from "react-native-purchases";
import Constants from "expo-constants";
import { ErrorBoundaryWrapper } from "../../__create/SharedErrorBoundary";

const isExpoGo = Constants.appOwnership === "expo";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      cacheTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const GlobalErrorReporter = () => {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    const errorHandler = (event: ErrorEvent) => {
      if (typeof event.preventDefault === "function") event.preventDefault();
      console.error(event.error);
    };
    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      if (typeof event.preventDefault === "function") event.preventDefault();
      console.error("Unhandled promise rejection:", event.reason);
    };
    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", unhandledRejectionHandler);
    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", unhandledRejectionHandler);
    };
  }, []);
  return null;
};

const healthyResponse = {
  type: 'sandbox:mobile:healthcheck:response',
  healthy: true,
};

function SandboxHandler() {
// ... existing SandboxHandler code ...
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'sandbox:mobile:healthcheck') {
        window.parent.postMessage(healthyResponse, '*');
      }
      if (event.data.type === 'sandbox:navigation' && event.data.pathname !== pathname) {
        router.push(event.data.pathname);
      }
    };

    window.addEventListener('message', handleMessage);
    // Immediately respond to the parent window with a healthy response
    window.parent.postMessage(healthyResponse, '*');
    window.parent.postMessage({ type: 'sandbox:mobile:ready' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [pathname, router]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    window.parent.postMessage(
      {
        type: 'sandbox:mobile:navigation',
        pathname,
      },
      '*'
    );
  }, [pathname]);

  return null;
}

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

export default function RootLayout() {
  const { initiate, isReady, auth } = useAuth();
  const colorScheme = useColorScheme();

  useEffect(() => {
    const init = async () => {
      await initiate();
      try {
        await initUser();
      } catch (e) {
        console.error("Failed to init user:", e);
      }
    };
    init();
    
    if (Platform.OS !== 'web') {
      (async () => {
        try {
          const { status } = await requestTrackingPermissionsAsync();
          if (status === 'granted') {
            console.log('Tracking permission granted');
          }
          
          if (!isExpoGo) {
            try {
              const ads = require('react-native-google-mobile-ads');
              if (ads) {
                const mobileAds = ads.default || ads;
                if (mobileAds && typeof mobileAds === 'function') {
                  await mobileAds().initialize();
                  console.log('AdMob initialized');
                }
              }
            } catch (e) {
              console.log('AdMob module failed to load, skipping');
            }
          }
        } catch (error) {
          console.warn('Initialization error:', error.message);
        }
      })();
    }
  }, [initiate]);

  useEffect(() => {
    if (isReady && auth?.id) {
      const updateLastSeen = async () => {
        try {
          await supabase
            .from('rusers')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', auth.id);
        } catch (e) {
          console.error("Error updating last seen:", e);
        }
      };
      
      updateLastSeen();
      const interval = setInterval(updateLastSeen, 1000 * 60 * 5);
      return () => clearInterval(interval);
    }
  }, [isReady, auth]);

  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ErrorBoundaryWrapper>
          <SafeAreaProvider>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
            <SandboxHandler />
            <GlobalErrorReporter />
            <Toaster />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            >
                <Stack.Screen name="index" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="onboarding/welcome" />
                <Stack.Screen name="onboarding/zones" />
                <Stack.Screen
                  name="post"
                  options={{
                    presentation: "modal",
                    animation: "slide_from_bottom",
                  }}
                />
            </Stack>
          </SafeAreaProvider>
        </ErrorBoundaryWrapper>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
