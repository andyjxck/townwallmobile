import { useAuth } from "@/utils/auth/useAuth";
import { supabase } from "@/utils/supabase";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

SplashScreen.preventAutoHideAsync();

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
      SplashScreen.hideAsync().catch((e) => {
        console.warn("Error hiding splash screen:", e);
      });
    }
  }, [isReady]);

  // Safety fallback to hide splash screen after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            >
              <Stack.Screen name="index" />
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
        </GestureHandlerRootView>
      </QueryClientProvider>
    );
  }
