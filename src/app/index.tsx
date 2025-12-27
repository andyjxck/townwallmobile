import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { isOnboardingComplete } from "@/utils/onboarding";
import UniversalFeed from "@/components/UniversalFeed";
import { useRouter } from "expo-router";
import { initUser } from "@/utils/user";

export default function Index() {
  const router = useRouter();
  const [isComplete, setIsComplete] = useState<boolean | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      if (isComplete !== null) return;
      
      try {
        console.log("[Index] Checking onboarding state...");
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
  }, [router]);

  if (isComplete === null && !error) {
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
