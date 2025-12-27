import * as Crypto from 'expo-crypto';
import bcrypt from 'bcryptjs';
import { supabase } from './supabase';

const CODE_LENGTH = 12;
const CODE_COUNT = 10;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;
const RATE_LIMIT_WINDOW_MINUTES = 15;

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateSingleCode() {
  const randomBytes = Crypto.getRandomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[randomBytes[i] % CHARSET.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

export function generateRecoveryCodes() {
  const codes = [];
  for (let i = 0; i < CODE_COUNT; i++) {
    codes.push(generateSingleCode());
  }
  return codes;
}

export function hashRecoveryCode(code) {
  const normalizedCode = code.replace(/-/g, '').toUpperCase();
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(normalizedCode, salt);
}

export function verifyRecoveryCode(code, hash) {
  const normalizedCode = code.replace(/-/g, '').toUpperCase();
  return bcrypt.compareSync(normalizedCode, hash);
}

export async function storeRecoveryCodes(userId, codes) {
  await supabase.from('recovery_codes').delete().eq('user_id', userId);
  
  const hashedCodes = codes.map(code => ({
    user_id: userId,
    code_hash: hashRecoveryCode(code),
    used: false,
    used_at: null
  }));
  
  const { error } = await supabase.from('recovery_codes').insert(hashedCodes);
  if (error) throw error;
  
  return true;
}

export async function getUnusedCodeCount(userId) {
  const { count, error } = await supabase
    .from('recovery_codes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('used', false);
  
  if (error) throw error;
  return count || 0;
}

export async function checkRateLimitAndLockout(username) {
  const { data: user } = await supabase
    .from('rusers')
    .select('id, recovery_lockout_until, recovery_attempt_count')
    .eq('username', username)
    .single();
  
  if (!user) {
    return { allowed: false, reason: 'invalid' };
  }
  
  if (user.recovery_lockout_until) {
    const lockoutTime = new Date(user.recovery_lockout_until);
    if (lockoutTime > new Date()) {
      const minutesLeft = Math.ceil((lockoutTime - new Date()) / 60000);
      return { allowed: false, reason: 'locked', minutesLeft };
    }
  }
  
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60000).toISOString();
  const { count } = await supabase
    .from('recovery_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('username', username)
    .eq('success', false)
    .gte('attempted_at', windowStart);
  
  if (count >= MAX_ATTEMPTS) {
    const lockoutUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
    await supabase
      .from('rusers')
      .update({ recovery_lockout_until: lockoutUntil })
      .eq('id', user.id);
    
    return { allowed: false, reason: 'locked', minutesLeft: LOCKOUT_MINUTES };
  }
  
  return { allowed: true, userId: user.id };
}

export async function recordAttempt(username, success) {
  await supabase.from('recovery_attempts').insert({
    username,
    success,
    attempted_at: new Date().toISOString()
  });
  
  if (success) {
    await supabase
      .from('rusers')
      .update({ 
        recovery_lockout_until: null,
        recovery_attempt_count: 0 
      })
      .eq('username', username);
  }
}

export async function validateRecoveryCode(username, code) {
  const rateCheck = await checkRateLimitAndLockout(username);
  if (!rateCheck.allowed) {
    return { valid: false, reason: rateCheck.reason, minutesLeft: rateCheck.minutesLeft };
  }
  
  const { data: codes, error } = await supabase
    .from('recovery_codes')
    .select('id, code_hash')
    .eq('user_id', rateCheck.userId)
    .eq('used', false);
  
  if (error || !codes?.length) {
    await recordAttempt(username, false);
    return { valid: false, reason: 'invalid' };
  }
  
  for (const storedCode of codes) {
    if (verifyRecoveryCode(code, storedCode.code_hash)) {
      await supabase
        .from('recovery_codes')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', storedCode.id);
      
      await recordAttempt(username, true);
      
      const remainingCount = await getUnusedCodeCount(rateCheck.userId);
      
      return { 
        valid: true, 
        userId: rateCheck.userId,
        remainingCodes: remainingCount,
        needsRegeneration: remainingCount === 0
      };
    }
  }
  
  await recordAttempt(username, false);
  return { valid: false, reason: 'invalid' };
}

export async function resetPassword(userId, newPassword) {
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(newPassword, salt);
  
  const { error } = await supabase
    .from('rusers')
    .update({ password: hashedPassword })
    .eq('id', userId);
  
  if (error) throw error;
  return true;
}

export async function invalidateAllSessions(userId) {
  return true;
}

export async function regenerateCodesAfterExhaustion(userId) {
  const codes = generateRecoveryCodes();
  await storeRecoveryCodes(userId, codes);
  return codes;
}
