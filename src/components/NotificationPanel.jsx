import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Platform,
  Dimensions
} from 'react-native';
import { X, Bell, CheckCircle, MessageSquare, Shield, Info, UserPlus, Check, X as XIcon, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchNotifications, markAsRead, markAllAsRead } from '@/utils/notifications';
import { getStoredUser } from '@/utils/user';
import { supabase } from '@/utils/supabase';
import { useTheme } from "@/utils/ThemeContext";
import { acceptFriendRequest, rejectFriendRequest } from '@/utils/friends';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';
import { MotiView, AnimatePresence } from 'moti';

const alertSound = require('../../assets/sounds/alert.mp3');

const playAlertSound = async () => {
  try {
    const { sound } = await Audio.Sound.createAsync(alertSound);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    console.log('Error playing alert sound:', error);
  }
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NotificationPanel({ visible, onClose }) {
  const { isHippie, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const wasVisible = useRef(visible);

  useEffect(() => {
    let sub;
    if (visible) {
      handleMarkAllAsRead();
      loadNotifications();
      
      const setupSubscription = async () => {
        const user = await getStoredUser();
        if (!user) return;
        
        sub = supabase
          .channel(`notification_list_${user.id}`)
          .on('postgres_changes', 
            { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'rnotifications',
              filter: `user_id=eq.${user.id}`
            }, 
            payload => {
                setNotifications(prev => [payload.new, ...prev]);
                playAlertSound();
                handleMarkAsRead(payload.new.id);
              }
          )
          .subscribe();
      };
      
      setupSubscription();
    } else if (wasVisible.current && !visible) {
      handleMarkAllAsRead();
    }
    
    wasVisible.current = visible;

    return () => {
      if (sub) supabase.removeChannel(sub);
    };
  }, [visible]);

  const loadNotifications = async () => {
    setLoading(true);
    const user = await getStoredUser();
    if (user) {
      await markAllAsRead(user.id);
      const data = await fetchNotifications(user.id);
      setNotifications(data);
    }
    setLoading(false);
  };

  const handleMarkAllAsRead = async () => {
    setNotifications(prev => prev.map(n => 
      n.type === 'friend_request' ? n : { ...n, is_read: true }
    ));
    
    const user = await getStoredUser();
    if (user) {
      await markAllAsRead(user.id);
    }
  };

  const handleMarkAsRead = async (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { success } = await markAsRead(id);
    if (success) {
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    }
  };

  const onAcceptFriend = async (notification) => {
    if (!notification.metadata?.requestId) return;
    const user = await getStoredUser();
    if (!user) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { success } = await acceptFriendRequest(
      notification.metadata.requestId,
      user.id,
      notification.metadata.senderId,
      user.username
    );
    
    if (success) {
      handleMarkAsRead(notification.id);
    }
  };

  const onRejectFriend = async (notification) => {
    if (!notification.metadata?.requestId) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { success } = await rejectFriendRequest(notification.metadata.requestId);
    
    if (success) {
      handleMarkAsRead(notification.id);
    }
  };

  const renderItem = ({ item }) => {
    let Icon = Info;
    let iconColor = isHippie ? "#93C5FD" : "#60A5FA";

    if (item.type === 'help_chat') {
      Icon = MessageSquare;
      iconColor = isHippie ? "#FDE047" : "#FBBF24";
    } else if (item.type === 'moderation') {
      Icon = Shield;
      iconColor = item.title.includes('Approved') ? (isHippie ? "#86EFAC" : "#4ADE80") : (isHippie ? "#FCA5A5" : "#EF4444");
    } else if (item.type === 'friend_request') {
      Icon = UserPlus;
      iconColor = isHippie ? "#C4B5FD" : "#A78BFA";
    }

    const isFriendRequest = item.type === 'friend_request' && !item.is_read;

    return (
      <View style={[styles.notificationItem, !item.is_read && styles.unreadItem, isHippie && styles.hippieItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center' }}
          onPress={() => handleMarkAsRead(item.id)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: isHippie ? 'rgba(255,255,255,0.1)' : `${iconColor}20` }]}>
            <Icon size={16} color={iconColor} />
          </View>
          <View style={styles.contentBox}>
            <Text style={[styles.title, isHippie && styles.hippieTitle, { color: theme.colors.text }]}>{item.title}</Text>
            <Text style={[styles.message, isHippie && styles.hippieMessage, { color: theme.colors.textSecondary }]} numberOfLines={2}>{item.message}</Text>
            <Text style={[styles.time, isHippie && styles.hippieTime, { color: theme.colors.textSecondary + '80' }]}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
          {!item.is_read && <View style={[styles.unreadDot, isHippie && { backgroundColor: '#FDE047' }]} />}
        </TouchableOpacity>
        
        {isFriendRequest && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.acceptBtn, isHippie && { backgroundColor: '#FDE047' }]} 
              onPress={() => onAcceptFriend(item)}
            >
              <Check size={14} color="#000" />
              <Text style={[styles.actionBtnText, isHippie && { color: '#000' }]}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.declineBtn, isHippie && { borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' }]} 
              onPress={() => onRejectFriend(item)}
            >
              <XIcon size={14} color="#FFF" />
              <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <AnimatePresence>
      {visible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.dropdownOverlay} 
            onPress={onClose} 
          />
          <MotiView
            from={{ translateY: -50, opacity: 0, scale: 0.95 }}
            animate={{ translateY: 0, opacity: 1, scale: 1 }}
            exit={{ translateY: -50, opacity: 0, scale: 0.95 }}
            transition={{ type: 'timing', duration: 250 }}
            style={[
              styles.dropdownWindow, 
              { 
                top: insets.top + 60,
                backgroundColor: (isHippie ? '#1a1a1a' : theme.colors.surface) + 'CC',
                borderColor: theme.colors.border,
                borderWidth: 1,
              }
            ]}
          >
            <BlurView intensity={80} tint={isHippie || theme.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>NOTIFICATIONS</Text>
              <TouchableOpacity onPress={handleMarkAllAsRead}>
                <Text style={[styles.markAllText, { color: theme.colors.primary }]}>Mark all as read</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={true}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>All caught up!</Text>
                  </View>
                }
                style={{ maxHeight: 400 }}
              />
            )}
          </MotiView>
        </View>
      )}
    </AnimatePresence>
  );
}

const styles = StyleSheet.create({
  dropdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 100,
  },
  dropdownWindow: {
    position: 'absolute',
    right: 20,
    width: Math.min(SCREEN_WIDTH - 40, 320),
    borderRadius: 20,
    padding: 15,
    zIndex: 101,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  markAllText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  centered: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 10,
    gap: 10,
  },
  notificationItem: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  hippieItem: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0,
  },
  unreadItem: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  contentBox: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  hippieTitle: {
    fontWeight: '800',
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  hippieMessage: {
    color: 'rgba(255,255,255,0.8)',
  },
  time: {
    fontSize: 10,
    fontWeight: '600',
  },
  hippieTime: {
    color: 'rgba(255,255,255,0.5)',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBBF24',
    marginLeft: 6,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
    paddingLeft: 46,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  acceptBtn: {
    backgroundColor: '#4ADE80',
  },
  declineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000',
  },
  emptyContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
