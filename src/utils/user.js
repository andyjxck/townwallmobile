import { supabase } from "./supabase";
import { getDeviceId } from "./deviceId";
import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_DATA_KEY = "@redditch_user_data";

export const initUser = async () => {
  try {
    const deviceId = await getDeviceId();
    
    // Check if user exists in rusers
    let { data: ruser, error } = await supabase
      .from('rusers')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (error && error.code === 'PGRST116') {
      // User doesn't exist, create anonymous user
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
    } else if (error) {
      throw error;
    }

    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(ruser));
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
  await AsyncStorage.removeItem(USER_DATA_KEY);
  await supabase.auth.signOut();
};
