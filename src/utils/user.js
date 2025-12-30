import { supabase } from "./supabase";
import { getDeviceId } from "./deviceId";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';
import { useAuthStore, authKey } from "./auth";

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
      // If we already have a user with a password in memory, and it's from this device, skip DB call
      if (sessionUser.password && sessionUser.device_id === deviceId) {
        ruser = sessionUser;
      } else {
        // Refresh user data from DB if logged in
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
    const userData = await getStoredUser();
    
    if (userData && userData.id) {
      const dummyDeviceId = `logged_out_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await supabase
        .from('rusers')
        .update({ device_id: dummyDeviceId })
        .eq('id', userData.id);
    }

    await supabase.auth.signOut();
    
    if (Platform.OS !== 'web') {
      try {
        const isConfigured = await Purchases.isConfigured();
        if (isConfigured) {
          await Purchases.logOut();
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error("Error during logout:", e);
  }
  
  try {
    await AsyncStorage.removeItem(USER_DATA_KEY);
    await AsyncStorage.removeItem("@redditch_user_data");
    await AsyncStorage.removeItem("supabase.auth.token");
    
    if (Platform.OS === 'web') {
      localStorage.removeItem(authKey);
      localStorage.removeItem('supabase.auth.token');
    } else {
      const SecureStore = require('expo-secure-store');
      await SecureStore.deleteItemAsync(authKey);
      await SecureStore.deleteItemAsync('supabase.auth.token');
    }
  } catch (e) {
    console.error("Storage clear error:", e);
  }
  
  useAuthStore.getState().setAuth(null);
};

