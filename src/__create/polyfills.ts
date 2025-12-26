import updatedFetch from './fetch';
import * as Crypto from 'expo-crypto';
import bcrypt from 'bcryptjs';

// @ts-ignore
global.fetch = updatedFetch;

// Polyfill for bcryptjs random fallback in React Native
bcrypt.setRandomFallback((len) => {
  const array = Crypto.getRandomValues(new Uint8Array(len));
  return Array.from(array);
});
