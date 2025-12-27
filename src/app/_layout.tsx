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

const healthyResponse = {
  type: 'sandbox:mobile:healthcheck:response',
  healthy: true,
};

function SandboxHandler() {
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

export default function RootLayout() {
  const { initiate, isReady, auth } = useAuth();
  const colorScheme = useColorScheme();

  useEffect(() => {
    initiate();
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
      const interval = setInterval(updateLastSeen, 1000 * 60 * 5); // every 5 mins
      return () => clearInterval(interval);
    }
  }, [isReady, auth]);

  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => {
        SplashScreen.hideAsync().catch((e) => {
          console.warn("Error hiding splash screen:", e);
        });
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
        <SafeAreaProvider>
          <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
          <SandboxHandler />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding/welcome" />
            <Stack.Screen
              name="post"
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
