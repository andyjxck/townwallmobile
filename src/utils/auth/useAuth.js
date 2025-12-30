import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { Modal, View, Platform } from 'react-native';
import { useAuthModal, useAuthStore, authKey } from './store';
import { logoutUser, initUser } from '../user';


/**
 * This hook provides authentication functionality.
 * It may be easier to use the `useAuthModal` or `useRequireAuth` hooks
 * instead as those will also handle showing authentication to the user
 * directly.
 */
export const useAuth = () => {
  const { isReady, auth, setAuth } = useAuthStore();
  const { isOpen, close, open } = useAuthModal();

    const initiate = useCallback(() => {
      if (Platform.OS === 'web') {
        // Fallback for web since SecureStore is not natively supported
        return new Promise((resolve) => {
          try {
            const auth = localStorage.getItem(authKey);
            useAuthStore.setState({
              auth: auth ? JSON.parse(auth) : null,
              isReady: true,
            });
            resolve();
          } catch (e) {
            useAuthStore.setState({ auth: null, isReady: true });
            resolve();
          }
        });
      }

      return SecureStore.getItemAsync(authKey)
        .then((auth) => {
          useAuthStore.setState({
            auth: auth ? JSON.parse(auth) : null,
            isReady: true,
          });
        })
        .catch((error) => {
          console.error("Error retrieving auth state:", error);
          useAuthStore.setState({
            auth: null,
            isReady: true,
          });
        });
    }, []);

  useEffect(() => {}, []);

  const signIn = useCallback(() => {
    open({ mode: 'signin' });
  }, [open]);
  const signUp = useCallback(() => {
    open({ mode: 'signup' });
  }, [open]);

  const signOut = useCallback(async () => {
    try {
      await logoutUser();
      // Small delay to ensure DB updates propagate before re-initializing
      if (Platform.OS !== 'web') {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      await initUser();
    } catch (e) {
      console.error("Sign out error:", e);
    } finally {
      close();
    }
  }, [close]);

  return {
    isReady,
    isAuthenticated: isReady ? !!auth : null,
    signIn,
    signOut,
    signUp,
    auth,
    setAuth,
    initiate,
  };
};

/**
 * This hook will automatically open the authentication modal if the user is not authenticated.
 */
export const useRequireAuth = (options) => {
  const { isAuthenticated, isReady } = useAuth();
  const { open } = useAuthModal();

  useEffect(() => {
    if (!isAuthenticated && isReady) {
      open({ mode: options?.mode });
    }
  }, [isAuthenticated, open, options?.mode, isReady]);
};

export default useAuth;