import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Bell, Heart, MessageCircle, UserPlus, AtSign } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { router } from 'expo-router';
import { useChatStore, useFeedHighlightStore } from '@/utils/auth';

interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
}

interface InAppNotificationStore {
  visible: boolean;
  notification: NotificationData | null;
  show: (notification: NotificationData) => void;
  hide: () => void;
}

export const useInAppNotification = create<InAppNotificationStore>((set) => ({
  visible: false,
  notification: null,
  show: (notification) => {
    set({ visible: true, notification });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  hide: () => set({ visible: false, notification: null }),
}));

const { width } = Dimensions.get('window');

const getNotificationIcon = (type?: string) => {
  switch (type) {
    case 'like':
    case 'post_like':
    case 'comment_like':
      return Heart;
    case 'comment':
    case 'reply':
      return MessageCircle;
    case 'follow':
    case 'follow_request':
      return UserPlus;
    case 'mention':
      return AtSign;
    case 'message':
    case 'dm':
      return MessageCircle;
    default:
      return Bell;
  }
};

const getIconColor = (type?: string) => {
  switch (type) {
    case 'like':
    case 'post_like':
    case 'comment_like':
      return '#ef4444';
    case 'comment':
    case 'reply':
      return '#3b82f6';
    case 'follow':
    case 'follow_request':
      return '#22c55e';
    case 'mention':
      return '#f59e0b';
    case 'message':
    case 'dm':
      return '#8b5cf6';
    default:
      return '#6366f1';
  }
};

export function InAppNotification() {
  const insets = useSafeAreaInsets();
  const { visible, notification, hide } = useInAppNotification();
  const chatStore = useChatStore();
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
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

      const timeout = setTimeout(() => {
        hideNotification();
      }, 4000);

      return () => clearTimeout(timeout);
    }
  }, [visible]);

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      hide();
    });
  };

  const handlePress = () => {
    if (!notification?.data) {
      hideNotification();
      return;
    }

    const { type, link, post_id, comment_id, user_id, conversation_id, sender_id } = notification.data;

    hideNotification();

      setTimeout(() => {
        if (link) {
          router.push(link as any);
          return;
        }

        switch (type) {
          case 'like':
          case 'post_like':
          case 'comment':
          case 'reply':
          case 'mention':
          case 'comment_like':
            if (post_id) {
              useFeedHighlightStore.getState().setHighlightedPost(post_id);
              router.replace('/');
            }
            break;
          case 'follow':
          case 'follow_request':
            if (user_id) {
              router.push({ pathname: '/profile', params: { id: user_id } } as any);
            }
            break;
        case 'message':
        case 'dm':
          if (conversation_id) {
            chatStore.open(conversation_id);
          } else if (sender_id) {
            chatStore.open(sender_id);
          }
          break;
        default:
          break;
      }
    }, 250);
  };

  if (!visible || !notification) return null;

  const IconComponent = getNotificationIcon(notification.data?.type);
  const iconColor = getIconColor(notification.data?.type);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 10,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity 
        style={styles.content} 
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}30` }]}>
          <IconComponent size={20} color={iconColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {notification.body}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={(e) => {
            e.stopPropagation();
            hideNotification();
          }} 
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={18} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
  },
  content: {
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  body: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    padding: 8,
    marginLeft: 8,
  },
});

export default InAppNotification;
