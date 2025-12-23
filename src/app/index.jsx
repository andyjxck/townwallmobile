import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { isOnboardingComplete } from "@/utils/onboarding";

export default function Index() {
  const [isComplete, setIsComplete] = useState(null);

  useEffect(() => {
    isOnboardingComplete().then(setIsComplete);
  }, []);

  if (isComplete === null) {
    return null;
  }

  if (isComplete) {
    return <Redirect href="/(tabs)/central" />;
  }

  return <Redirect href="/onboarding/welcome" />;
}
