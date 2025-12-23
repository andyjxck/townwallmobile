import { useEffect, useState } from "react";
import { isOnboardingComplete } from "@/utils/onboarding";
import UniversalFeed from "@/components/UniversalFeed";
import Welcome from "./onboarding/welcome";
import { initUser } from "@/utils/user";

export default function Index() {
  const [isComplete, setIsComplete] = useState(null);

  useEffect(() => {
    initUser();
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
