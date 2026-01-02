import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Image, GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/utils/ThemeContext';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { X, MessageCircle, Heart, UserPlus, Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { create } from 'zustand';

interface NotificationData {
  type?: string;
  link?: string;
  chatId?: string;
  avatar?: string;
  [key: string]: any;
}

interface InAppNotificationPayload {
  title: string;
  body?: string;
  avatar?: string;
  data?: NotificationData;
}

interface InAppNotificationStore {
  notification: InAppNotificationPayload | null;
  show: (notification: InAppNotificationPayload) => void;
  hide: () => void;
}

export const useInAppNotification = create<InAppNotificationStore>((set) => ({
  notification: null,
  show: (notification: InAppNotificationPayload) => set({ notification }),
  hide: () => set({ notification: null }),
}));

export function InAppNotification() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { notification, hide } = useInAppNotification();
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        dismissNotification();
      }, 4000);
    }
  }, [notification]);

  const dismissNotification = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      hide();
    });
  };

  const handlePress = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    if (notification?.data?.link) {
      if (notification.data.link === '/chat') {
        const { useChatStore } = require('@/utils/auth');
        if (notification.data.chatId) {
          useChatStore.getState().setActiveChatId(notification.data.chatId);
        }
        useChatStore.getState().open();
      } else {
        router.push(notification.data.link);
      }
    }
    
    dismissNotification();
  };

  const getIcon = () => {
    const type = notification?.data?.type;
    const iconProps = { size: 20, color: theme.colors.primary };
    
    switch (type) {
      case 'message':
      case 'chat':
        return <MessageCircle {...iconProps} />;
      case 'like':
        return <Heart {...iconProps} fill={theme.colors.primary} />;
      case 'follow':
        return <UserPlus {...iconProps} />;
      case 'call':
        return <MessageCircle {...iconProps} />;
      default:
        return <Bell {...iconProps} />;
    }
  };

  if (!visible || !notification) return null;

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: insets.top + 8,
      left: 16,
      right: 16,
      zIndex: 9999,
    },
    notification: {
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    blurContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 12,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    content: {
      flex: 1,
    },
    title: {
      color: '#FFF',
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 2,
    },
    body: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 13,
      lineHeight: 18,
    },
    closeBtn: {
      padding: 4,
    },
  });

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateY }], opacity }
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
        <BlurView intensity={80} tint="dark" style={styles.notification}>
          <View style={styles.blurContent}>
            {notification.avatar ? (
              <Image source={{ uri: notification.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.iconContainer}>
                {getIcon()}
              </View>
            )}
            <View style={styles.content}>
              <Text style={styles.title} numberOfLines={1}>
                {notification.title || 'Notification'}
              </Text>
              {notification.body && (
                <Text style={styles.body} numberOfLines={2}>
                  {notification.body}
                </Text>
              )}
            </View>
<TouchableOpacity 
                style={styles.closeBtn} 
                onPress={(e: GestureResponderEvent) => {
                  e.stopPropagation();
                  dismissNotification();
                }}
              >
              <X size={18} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}
