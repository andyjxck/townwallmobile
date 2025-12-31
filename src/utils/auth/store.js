import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const authKey = `${process.env.EXPO_PUBLIC_PROJECT_GROUP_ID}-jwt`;

/**
 * This store manages the authentication state of the application.
 */
export const useAuthStore = create((set) => ({
  isReady: false,
  auth: null,
  setAuth: (auth) => {
    if (auth) {
      if (Platform.OS === 'web') {
        localStorage.setItem(authKey, JSON.stringify(auth));
      } else {
        SecureStore.setItemAsync(authKey, JSON.stringify(auth));
      }
    } else {
      if (Platform.OS === 'web') {
        localStorage.removeItem(authKey);
      } else {
        SecureStore.deleteItemAsync(authKey);
      }
    }
    set({ auth });
  },
}));

/**
 * This store manages the state of the authentication modal.
 */
export const useAuthModal = create((set) => ({
  isOpen: false,
  mode: 'signup',
  open: (options) => set({ isOpen: true, mode: options?.mode || 'signup' }),
  close: () => set({ isOpen: false }),
}));

/**
 * This store manages the state of the chat visibility and active chat.
 */
export const useChatStore = create((set) => ({
  isOpen: false,
  activeChatId: null,
  pendingCallUserId: null,
  pendingCallAction: null, // 'accept' or 'decline'
  open: (chatId = null) => set({ isOpen: true, activeChatId: chatId }),
  close: () => set({ isOpen: false, activeChatId: null, pendingCallUserId: null, pendingCallAction: null }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setActiveChatId: (id) => set({ activeChatId: id }),
  setPendingCallUserId: (userId) => set({ pendingCallUserId: userId, isOpen: true }),
  setPendingCallAction: (action) => set({ pendingCallAction: action, isOpen: true }),
}));