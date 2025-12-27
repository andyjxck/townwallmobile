import { supabase } from './supabase';
import bcrypt from 'bcryptjs';
import * as Crypto from 'expo-crypto';

// Polyfill for bcryptjs in React Native/Expo
if (typeof global.crypto !== 'object') {
  global.crypto = {};
}
if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = (array) => {
    const randomBytes = Crypto.getRandomBytes(array.length);
    for (let i = 0; i < array.length; i++) {
      array[i] = randomBytes[i];
    }
    return array;
  };
}

export const generateRecoveryCodes = (count = 10) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
};

export const storeRecoveryCodes = async (userId, codes) => {
  const salt = bcrypt.genSaltSync(10);
  const hashes = codes.map(code => ({
    user_id: userId,
    code_hash: bcrypt.hashSync(code, salt),
    used: false
  }));

  const { error } = await supabase
    .from('recovery_codes')
    .insert(hashes);

    if (error) throw error;
  };

  export const getRecoveryCodesStatus = async (userId) => {
    const { data, error } = await supabase
      .from('recovery_codes')
      .select('id, used, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  };

  export const verifyRecoveryCode = async (username, code) => {
    try {
      // 1. Find user by username
      const { data: user, error: userError } = await supabase
        .from('rusers')
        .select('id')
        .ilike('username', username.trim())
        .single();

      if (userError || !user) return { success: false, message: "User not found" };

      // 2. Get all unused recovery codes for this user
      const { data: codes, error: codesError } = await supabase
        .from('recovery_codes')
        .select('*')
        .eq('user_id', user.id)
        .eq('used', false);

      if (codesError || !codes || codes.length === 0) {
        return { success: false, message: "No valid recovery codes found" };
      }

      // 3. Compare provided code with stored hashes
      let matchedCode = null;
      for (const storedCode of codes) {
        if (bcrypt.compareSync(code.trim().toUpperCase(), storedCode.code_hash)) {
          matchedCode = storedCode;
          break;
        }
      }

      if (!matchedCode) return { success: false, message: "Invalid recovery code" };

      // 4. Mark code as used
      const { error: updateError } = await supabase
        .from('recovery_codes')
        .update({ 
          used: true, 
          used_at: new Date().toISOString() 
        })
        .eq('id', matchedCode.id);

      if (updateError) throw updateError;

      // 5. Get the full user object for login
      const { data: fullUser } = await supabase
        .from('rusers')
        .select('*')
        .eq('id', user.id)
        .single();

      return { success: true, user: fullUser };
    } catch (error) {
      console.error("Recovery verification error:", error);
      return { success: false, message: "Something went wrong during verification" };
    }
  };
