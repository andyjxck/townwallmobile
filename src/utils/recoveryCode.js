import { supabase } from './supabase';
import bcrypt from 'bcryptjs';

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
