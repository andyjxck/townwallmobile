import { useEffect, useState } from "react";
import { isOnboardingComplete } from "@/utils/onboarding";
import UniversalFeed from "@/components/UniversalFeed";
import Welcome from "./onboarding/welcome";
import { initUser } from "@/utils/user";

export default function Index() {
  const [isComplete, setIsComplete] = useState(null);

  useEffect(() => {
    const setup = async () => {
      try {
        await initUser();
        const complete = await isOnboardingComplete();
        setIsComplete(complete);
      } catch (error) {
        console.error("Error in setup:", error);
        setIsComplete(false); // Default to false if check fails
      }
    };
    setup();
  }, []);

  if (isComplete === null) {
    return null;
  }

  if (isComplete) {
    return <UniversalFeed />;
  }

  return <Welcome />;
}
