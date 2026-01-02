import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  Modal, 
  ActivityIndicator,
  Platform
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
  import HippieBackground from '@/components/HippieBackground';
  import { Audio } from 'expo-av';

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


export default function NotificationPanel({ visible, onClose }) {
  const { isHippie } = useTheme();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const wasVisible = useRef(visible);

    useEffect(() => {
      let sub;
      if (visible) {
        handleMarkAllAsRead();
        loadNotifications();
        
        // Real-time subscription for the notification list
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
                  // Play alert sound when notification is received
                  playAlertSound();
                  // Automatically mark new notifications as read if panel is open
                  handleMarkAsRead(payload.new.id);
                }
            )
            .subscribe();
        };
        
        setupSubscription();
      } else if (wasVisible.current && !visible) {
        // Panel was just closed
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
      // Mark as read in DB before fetching to ensure we get "read" status
      await markAllAsRead(user.id);
      const data = await fetchNotifications(user.id);
      setNotifications(data);
    }
    setLoading(false);
  };

  const handleMarkAllAsRead = async () => {
    // Optimistically update local state
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

      const ItemWrapper = isHippie ? (({ children }) => (
        <BlurView intensity={20} tint="light" style={styles.hippieItemWrapper}>
          {children}
        </BlurView>
      )) : View;

      return (
        <View style={[styles.notificationItem, !item.is_read && styles.unreadItem, isHippie && styles.hippieItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => handleMarkAsRead(item.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: isHippie ? 'rgba(255,255,255,0.1)' : `${iconColor}20` }]}>
              <Icon size={18} color={iconColor} />
            </View>
            <View style={styles.contentBox}>
              <Text style={[styles.title, isHippie && styles.hippieTitle]}>{item.title}</Text>
              <Text style={[styles.message, isHippie && styles.hippieMessage]} numberOfLines={2}>{item.message}</Text>
              <Text style={[styles.time, isHippie && styles.hippieTime]}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            {!item.is_read && <View style={[styles.unreadDot, isHippie && { backgroundColor: '#FDE047' }]} />}
          </TouchableOpacity>
          
          {isFriendRequest && (
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.acceptBtn, isHippie && { backgroundColor: '#FDE047' }]} 
                onPress={() => onAcceptFriend(item)}
              >
                <Check size={16} color={isHippie ? "#000" : "#000"} />
                <Text style={[styles.actionBtnText, isHippie && { color: '#000' }]}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.declineBtn, isHippie && { borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' }]} 
                onPress={() => onRejectFriend(item)}
              >
                <XIcon size={16} color={isHippie ? "#FFF" : "#FFF"} />
                <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    };

    const MainContent = () => (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.bellIconContainer, isHippie && styles.hippieBellContainer]}>
              <Bell size={24} color={isHippie ? "#FDE047" : "#FBBF24"} />
            </View>
            <View>
              <Text style={[styles.headerTitle, isHippie && styles.hippieHeaderTitle]}>NOTIFICATIONS</Text>
              <TouchableOpacity onPress={handleMarkAllAsRead} activeOpacity={0.6}>
                <Text style={[styles.markAllText, isHippie && styles.hippieMarkAllText]}>Mark all as read</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.6}>
            <BlurView intensity={isHippie ? 40 : 0} tint="dark" style={styles.closeIconWrapper}>
              <X size={24} color="#FFFFFF" />
            </BlurView>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={isHippie ? "#FDE047" : "#FFFFFF"} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconContainer, isHippie && { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                  <Bell size={48} color={isHippie ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)"} />
                </View>
                <Text style={[styles.emptyText, isHippie && styles.hippieEmptyText]}>All caught up!</Text>
                <Text style={styles.emptySubtext}>We'll let you know when something happens.</Text>
              </View>
            }
          />
        )}
      </View>
    );

    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
        <View style={[styles.overlay, isHippie && { backgroundColor: 'transparent' }]}>
          {isHippie ? (
            <HippieBackground>
              <MainContent />
            </HippieBackground>
          ) : (
            <MainContent />
          )}
        </View>
      </Modal>
    );
  }

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: '#000000',
    },
    container: {
      flex: 1,
      paddingHorizontal: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 30,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 15,
    },
    bellIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(251, 191, 36, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    hippieBellContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: 1,
    },
    hippieHeaderTitle: {
      letterSpacing: 3,
      fontWeight: '800',
    },
    markAllText: {
      color: '#FBBF24',
      fontSize: 12,
      fontWeight: 'bold',
      marginTop: 2,
    },
    hippieMarkAllText: {
      color: '#FDE047',
      opacity: 0.8,
    },
    closeButton: {
      borderRadius: 20,
      overflow: 'hidden',
    },
    closeIconWrapper: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      paddingBottom: 40,
      gap: 16,
    },
    notificationItem: {
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
    },
    hippieItem: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
    },
    unreadItem: {
      backgroundColor: 'rgba(255,255,255,0.07)',
      borderColor: 'rgba(251, 191, 36, 0.2)',
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    contentBox: {
      flex: 1,
    },
    title: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 3,
    },
    hippieTitle: {
      fontWeight: '800',
    },
    message: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 14,
      lineHeight: 19,
      marginBottom: 6,
    },
    hippieMessage: {
      color: 'rgba(255,255,255,0.8)',
    },
    time: {
      color: 'rgba(255,255,255,0.3)',
      fontSize: 12,
      fontWeight: '600',
    },
    hippieTime: {
      color: 'rgba(255,255,255,0.5)',
    },
    unreadDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#FBBF24',
      marginLeft: 10,
    },
    actionButtons: {
      flexDirection: 'row',
      marginTop: 15,
      gap: 10,
      paddingLeft: 58,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
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
      fontSize: 13,
      fontWeight: 'bold',
      color: '#000',
    },
    emptyContainer: {
      paddingVertical: 120,
      alignItems: 'center',
      gap: 20,
    },
    emptyIconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: 'rgba(255,255,255,0.02)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    emptyText: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '800',
    },
    hippieEmptyText: {
      letterSpacing: 2,
    },
    emptySubtext: {
      color: 'rgba(255,255,255,0.3)',
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: 40,
    },
  });

