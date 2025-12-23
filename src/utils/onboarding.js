import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "@redditch_onboarding_complete";
const HOME_ZONE_KEY = "@redditch_home_zone";

export const isOnboardingComplete = async () => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === "true";
  } catch (error) {
    console.error("Error checking onboarding:", error);
    return false;
  }
};

export const completeOnboarding = async (homeZoneId) => {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    if (homeZoneId) {
      await AsyncStorage.setItem(HOME_ZONE_KEY, homeZoneId.toString());
    }
  } catch (error) {
    console.error("Error completing onboarding:", error);
  }
};

export const getHomeZone = async () => {
  try {
    const value = await AsyncStorage.getItem(HOME_ZONE_KEY);
    return value ? parseInt(value, 10) : null;
  } catch (error) {
    console.error("Error getting home zone:", error);
    return null;
  }
};
