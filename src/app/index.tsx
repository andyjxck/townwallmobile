import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { isOnboardingComplete, setOnboardingComplete } from "@/utils/onboarding";
import UniversalFeed from "@/components/UniversalFeed";
import { useRouter } from "expo-router";
import { initUser } from "@/utils/user";
import { useAuth } from "@/utils/auth/useAuth";

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isReady: authReady } = useAuth();
  const [isComplete, setIsComplete] = useState<boolean | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      if (isComplete !== null || !authReady) return;
      
      try {
        // If authenticated, we skip onboarding
        if (isAuthenticated) {
          await setOnboardingComplete(true);
          if (mounted) {
            setIsComplete(true);
          }
          return;
        }

        const complete = await isOnboardingComplete();
        if (mounted) {
          setIsComplete(complete);
          if (!complete) {
            router.replace("/onboarding/welcome");
          }
        }
      } catch (err) {
        console.error("[Index] Error in setup:", err);
        if (mounted) {
          setError(true);
          setIsComplete(false);
          router.replace("/onboarding/welcome");
        }
      }
    };
    setup();
    return () => { mounted = false; };
  }, [router, authReady, isAuthenticated]);

  if ((isComplete === null || !authReady) && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (isComplete) {
    return <UniversalFeed />;
  }

  return null;
}
