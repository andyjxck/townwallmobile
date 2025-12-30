import { supabase } from "./supabase";
import { getDeviceId } from "./deviceId";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';
import { useAuthStore } from "./auth";

const USER_DATA_KEY = "@redditch_user_data";

export const mergeAnonDataToUser = async (anonUserId, targetUserId) => {
  try {
    await supabase.from('rposts').update({ user_id: targetUserId }).eq('user_id', anonUserId);
    await supabase.from('rcomments').update({ user_id: targetUserId }).eq('user_id', anonUserId);
    await supabase.from('rnotifications').update({ user_id: targetUserId }).eq('user_id', anonUserId);
    await supabase.from('rmessages').update({ sender_id: targetUserId }).eq('sender_id', anonUserId);
    await supabase.from('rhelp_messages').update({ sender_id: targetUserId }).eq('sender_id', anonUserId);
    await supabase.from('rshares').update({ user_id: targetUserId }).eq('user_id', anonUserId);
    await supabase.from('rsaved_posts').update({ user_id: targetUserId }).eq('user_id', anonUserId);
    await supabase.from('rreactions').update({ user_id: targetUserId }).eq('user_id', anonUserId);
    await supabase.from('rfeature_suggestions').update({ user_id: targetUserId }).eq('user_id', anonUserId);
    await supabase.from('rhelp_reviews').update({ user_id: targetUserId }).eq('user_id', anonUserId);
    await supabase.from('rtalent').update({ user_id: targetUserId }).eq('user_id', anonUserId);
    await supabase.from('rbusinesses').update({ user_id: targetUserId }).eq('user_id', anonUserId);
    await supabase.from('rchat_members').update({ user_id: targetUserId }).eq('user_id', anonUserId);
    await supabase.from('rcall_participants').update({ user_id: targetUserId }).eq('user_id', anonUserId);
    await supabase.from('rchats').update({ user1_id: targetUserId }).eq('user1_id', anonUserId);
    await supabase.from('rchats').update({ user2_id: targetUserId }).eq('user2_id', anonUserId);
    await supabase.from('rpoll_votes').update({ user_id: targetUserId }).eq('user_id', anonUserId);
    await supabase.from('recovery_codes').delete().eq('user_id', anonUserId);
    return true;
  } catch (error) {
    console.error("Error merging anon data:", error);
    return false;
  }
};

export const checkAnonHasData = async (anonUserId) => {
  const { count: postsCount } = await supabase.from('rposts').select('*', { count: 'exact', head: true }).eq('user_id', anonUserId);
  const { count: commentsCount } = await supabase.from('rcomments').select('*', { count: 'exact', head: true }).eq('user_id', anonUserId);
  const { count: messagesCount } = await supabase.from('rmessages').select('*', { count: 'exact', head: true }).eq('sender_id', anonUserId);
  const { count: helpMessagesCount } = await supabase.from('rhelp_messages').select('*', { count: 'exact', head: true }).eq('sender_id', anonUserId);
  return (postsCount || 0) + (commentsCount || 0) + (messagesCount || 0) + (helpMessagesCount || 0) > 0;
};

export const initUser = async () => {
  try {
    const deviceId = await getDeviceId();
    
    // Check if we have a stored session user
    const { auth: sessionUser } = useAuthStore.getState();
    let ruser = null;

    if (sessionUser && sessionUser.id) {
      // 1. Refresh user data from DB if logged in
      const { data: userById } = await supabase
        .from('rusers')
        .select('*')
        .eq('id', sessionUser.id)
        .single();
      
      if (userById) {
        ruser = userById;
        // Update device_id to current device if it changed
        if (ruser.device_id !== deviceId) {
          await supabase.from('rusers').update({ device_id: deviceId }).eq('id', ruser.id);
          ruser.device_id = deviceId;
        }
      }
    }

    if (!ruser) {
      // 2. Try to find by device_id (for anonymous users)
      const { data: userByDevice } = await supabase
        .from('rusers')
        .select('*')
        .eq('device_id', deviceId)
        .single();
      
      if (userByDevice) {
        ruser = userByDevice;
      }
    }

    if (!ruser) {
      // 3. Still nothing? Create anonymous user
      const { data: newUser, error: createError } = await supabase
        .from('rusers')
        .insert({ 
          device_id: deviceId,
          username: `Anon${Math.floor(Math.random() * 10000)}`,
          emoji_icon: '👤'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      ruser = newUser;
    }

// Sync with RevenueCat
const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
if (ruser?.id && apiKey && Platform.OS !== 'web') {
try {
const isConfigured = await Purchases.isConfigured();
if (isConfigured) {
await Purchases.logIn(ruser.id.toString());
}
} catch (e) {
console.error("RevenueCat login error:", e);
}
}


    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(ruser));
    
    // Update global auth store
    useAuthStore.getState().setAuth(ruser);

    return ruser;
  } catch (error) {
    console.error("Error initializing user:", error);
    return null;
  }
};

export const isOnline = (lastSeen) => {
  if (!lastSeen) return false;
  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  return (now - lastSeenDate) < 1000 * 60 * 5; // 5 minutes
};

export const getStoredUser = async () => {
  // First check the memory store
  const { auth } = useAuthStore.getState();
  if (auth) return auth;
  
  // Fallback to AsyncStorage
  const data = await AsyncStorage.getItem(USER_DATA_KEY);
  return data ? JSON.parse(data) : null;
};

export const logoutUser = async () => {
  try {
    // 1. Get current user data before clearing
    const userData = await getStoredUser();
    
    // 2. Clear Supabase Auth session first
    await supabase.auth.signOut();
    
    if (userData && userData.id) {
      // 3. Disassociate this device from the user in the DB
      // This is crucial so the next initUser creates a fresh anonymous profile
      await supabase
        .from('rusers')
        .update({ device_id: null })
        .eq('id', userData.id);
    }
    
    // 4. Logout from RevenueCat
    if (Platform.OS !== 'web') {
      try {
        const isConfigured = await Purchases.isConfigured();
        if (isConfigured) {
          await Purchases.logOut();
        }
      } catch (e) {
        // Ignore if not configured
      }
    }
  } catch (e) {
    console.error("Error during logout:", e);
  }
  
  // 5. Clear all local storage and memory store
  try {
    await AsyncStorage.removeItem(USER_DATA_KEY);
    if (Platform.OS === 'web') {
      localStorage.removeItem(authKey);
    } else {
      const { authKey } = require('./auth/store');
      const SecureStore = require('expo-secure-store');
      await SecureStore.deleteItemAsync(authKey);
    }
  } catch (e) {
    console.error("Storage clear error:", e);
  }
  
  useAuthStore.getState().setAuth(null);
};

