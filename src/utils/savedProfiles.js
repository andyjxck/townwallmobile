import * as SecureStore from 'expo-secure-store';

const SAVED_PROFILES_KEY = 'townwall_saved_profiles';

export const getSavedProfiles = async () => {
  try {
    const profilesJson = await SecureStore.getItemAsync(SAVED_PROFILES_KEY);
    return profilesJson ? JSON.parse(profilesJson) : [];
  } catch (error) {
    console.error('Error getting saved profiles:', error);
    return [];
  }
};

export const saveProfile = async (profile) => {
  try {
    const profiles = await getSavedProfiles();
    const existingIndex = profiles.findIndex(p => p.username === profile.username);
    
    let newProfile;
    if (existingIndex > -1) {
      // Merge with existing profile
      const oldProfile = profiles[existingIndex];
      newProfile = {
        ...oldProfile,
        ...profile,
        // Ensure core fields are mapped correctly
        username: profile.username || oldProfile.username,
        password: profile.password || oldProfile.password,
        name: profile.username || oldProfile.username,
        emoji: profile.emoji_icon || profile.emoji || oldProfile.emoji || '👤',
        avatar_url: profile.avatar_url !== undefined ? profile.avatar_url : oldProfile.avatar_url,
        lastLogin: new Date().toISOString(),
      };
    } else {
      newProfile = {
        username: profile.username,
        password: profile.password,
        name: profile.username,
        emoji: profile.emoji_icon || '👤',
        avatar_url: profile.avatar_url || null,
        lastLogin: new Date().toISOString(),
      };
    }

    if (existingIndex > -1) {
      profiles[existingIndex] = newProfile;
    } else {
      profiles.push(newProfile);
    }

    await SecureStore.setItemAsync(SAVED_PROFILES_KEY, JSON.stringify(profiles));
    return true;
  } catch (error) {
    console.error('Error saving profile:', error);
    return false;
  }
};

export const removeProfile = async (username) => {
  try {
    const profiles = await getSavedProfiles();
    const filteredProfiles = profiles.filter(p => p.username !== username);
    await SecureStore.setItemAsync(SAVED_PROFILES_KEY, JSON.stringify(filteredProfiles));
    return true;
  } catch (error) {
    console.error('Error removing profile:', error);
    return false;
  }
};
