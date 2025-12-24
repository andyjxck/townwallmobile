import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  Modal, 
  ActivityIndicator 
} from 'react-native';
import { X, Bell, CheckCircle, MessageSquare, Shield, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchNotifications, markAsRead } from '@/utils/notifications';
import { getStoredUser } from '@/utils/user';
import * as Haptics from 'expo-haptics';

export default function NotificationPanel({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible]);

  const loadNotifications = async () => {
    setLoading(true);
    const user = await getStoredUser();
    if (user) {
      const data = await fetchNotifications(user.id);
      setNotifications(data);
    }
    setLoading(false);
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

  const renderItem = ({ item }) => {
    let Icon = Info;
    let iconColor = "#60A5FA";

    if (item.type === 'help_chat') {
      Icon = MessageSquare;
      iconColor = "#FBBF24";
    } else if (item.type === 'moderation') {
      Icon = Shield;
      iconColor = item.title.includes('Approved') ? "#4ADE80" : "#EF4444";
    }

    return (
      <TouchableOpacity 
        style={[styles.notificationItem, !item.is_read && styles.unreadItem]}
        onPress={() => handleMarkAsRead(item.id)}
      >
        <View style={[styles.iconBox, { backgroundColor: `${iconColor}20` }]}>
          <Icon size={18} color={iconColor} />
        </View>
        <View style={styles.contentBox}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        {!item.is_read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Bell size={24} color="#FBBF24" />
              <Text style={styles.headerTitle}>NOTIFICATIONS</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Bell size={48} color="rgba(255,255,255,0.05)" />
                  <Text style={styles.emptyText}>All caught up!</Text>
                </View>
              }
            />
          )}
        </View>
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
    gap: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  closeButton: {
    padding: 5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 40,
    gap: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  unreadItem: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  contentBox: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  time: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBBF24',
    marginLeft: 10,
  },
  emptyContainer: {
    paddingVertical: 100,
    alignItems: 'center',
    gap: 15,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 16,
    fontWeight: '700',
  },
});
