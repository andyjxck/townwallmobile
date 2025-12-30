import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocationState } from './locationStore';

const ONBOARDING_COMPLETE_KEY = '@onboarding_complete';

export const isOnboardingComplete = async () => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    if (value !== 'true') return false;
    
    const locationState = getLocationState();
    return locationState.isLocationSet && locationState.city_id !== null;
  } catch (e) {
    return false;
  }
};

export const setOnboardingComplete = async (complete = true) => {
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, complete ? 'true' : 'false');
  } catch (e) {
    console.error('Error setting onboarding complete:', e);
  }
};

export const resetOnboarding = async () => {
  try {
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  } catch (e) {
    console.error('Error resetting onboarding:', e);
  }
};
