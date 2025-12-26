import { supabase } from "./supabase";
import { getDeviceId } from "./deviceId";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases from 'react-native-purchases';
import { useAuthStore } from "./auth/store";

const USER_DATA_KEY = "@redditch_user_data";

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
    if (ruser?.id && process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY) {
      try {
        await Purchases.logIn(ruser.id.toString());
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

export const getStoredUser = async () => {
  const data = await AsyncStorage.getItem(USER_DATA_KEY);
  return data ? JSON.parse(data) : null;
};

export const logoutUser = async () => {
  try {
    const userData = await getStoredUser();
    if (userData && userData.id) {
      // Disassociate this device from the user on logout
      // so the next initUser creates a fresh anonymous profile
      await supabase
        .from('rusers')
        .update({ device_id: null })
        .eq('id', userData.id);
    }
    // Logout from RevenueCat
    await Purchases.logOut();
  } catch (e) {
    console.error("Error during logout:", e);
  }
  await AsyncStorage.removeItem(USER_DATA_KEY);
  useAuthStore.getState().setAuth(null);
};
