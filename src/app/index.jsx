import { useEffect, useState } from "react";
import { isOnboardingComplete } from "@/utils/onboarding";
import UniversalFeed from "@/components/UniversalFeed";
import Welcome from "./onboarding/welcome";

export default function Index() {
  const [isComplete, setIsComplete] = useState(null);

  useEffect(() => {
    isOnboardingComplete().then(setIsComplete);
  }, []);

  if (isComplete === null) {
    return null;
  }

  if (isComplete) {
    return <UniversalFeed />;
  }

  return <Welcome />;
}
