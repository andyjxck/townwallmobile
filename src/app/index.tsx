import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { isOnboardingComplete } from "@/utils/onboarding";
import UniversalFeed from "@/components/UniversalFeed";
import { Redirect } from "expo-router";
import { initUser } from "@/utils/user";

export default function Index() {
  const [isComplete, setIsComplete] = useState<boolean | null>(null);
  const [error, setError] = useState<boolean>(false);

    useEffect(() => {
      let mounted = true;
      const setup = async () => {
        if (isComplete !== null) return; // Prevent double execution
        
        try {
          console.log("[Index] Starting setup...");
          // If we already have a user in the store, we might not need to initUser again
          // but initUser handles anonymous creation too.
          await initUser();
          const complete = await isOnboardingComplete();
          if (mounted) {
            setIsComplete(complete);
          }
        } catch (err) {
        console.error("[Index] Error in setup:", err);
        if (mounted) {
          setError(true);
          setIsComplete(false); 
        }
      }
    };
    setup();
    return () => { mounted = false; };
  }, []);

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

  // Use Redirect for a cleaner onboarding flow
  return <Redirect href="/onboarding/welcome" />;
}
