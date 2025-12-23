import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Shield, AlertCircle, CheckCircle, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/utils/supabase';
import { getStoredUser } from '@/utils/user';
import * as Haptics from 'expo-haptics';

export default function ModerationAdmin() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [flaggedPosts, setFlaggedPosts] = useState([]);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const user = await getStoredUser();
      const { data, error } = await supabase
        .from('rusers')
        .select('is_admin')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      
      if (!data?.is_admin) {
        Alert.alert("Access Denied", "You do not have permission to view this page.");
        router.back();
        return;
      }
      
      setIsAdmin(true);
      fetchFlaggedPosts();
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const fetchFlaggedPosts = async () => {
    setLoading(true);
    try {
      // Fetch posts with moderation_status = 'flagged' or 'pending'
      const { data, error } = await supabase
        .from('rposts')
        .select(`
          *,
          rusers (username),
          rzones (name)
        `)
        .neq('moderation_status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFlaggedPosts(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (postId, action) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      let updateData = {};
      if (action === 'approve') {
        updateData = { moderation_status: 'approved', is_blurred: false };
      } else if (action === 'reject') {
        updateData = { moderation_status: 'rejected', is_blurred: true };
      }

      const { error } = await supabase
        .from('rposts')
        .update(updateData)
        .eq('id', postId);

      if (error) throw error;
      
      setFlaggedPosts(prev => prev.filter(p => p.id !== postId));
      Alert.alert("Action Taken", `Post has been ${action}d.`);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to update post status.");
    }
  };

  if (loading && !isAdmin) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#FFFFFF" size={28} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Shield color="#FBBF24" size={20} />
          <Text style={styles.headerTitle}>MODERATION</Text>
        </View>
        <TouchableOpacity onPress={fetchFlaggedPosts} style={styles.backButton}>
          <AlertCircle color="#FFFFFF" size={24} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={flaggedPosts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.postCard}>
            <View style={styles.postHeader}>
              <Text style={styles.postUser}>@{item.rusers?.username || 'Anon'}</Text>
              <Text style={styles.postZone}>{item.rzones?.name}</Text>
            </View>
            <Text style={styles.postTitle}>{item.title}</Text>
            <Text style={styles.postText} numberOfLines={3}>{item.text}</Text>
            
            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.approveButton]} 
                onPress={() => handleAction(item.id, 'approve')}
              >
                <CheckCircle size={18} color="#000000" />
                <Text style={styles.actionText}>APPROVE</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.rejectButton]} 
                onPress={() => handleAction(item.id, 'reject')}
              >
                <Trash2 size={18} color="#FFFFFF" />
                <Text style={[styles.actionText, { color: '#FFFFFF' }]}>REJECT</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <CheckCircle size={48} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyText}>Queue is clear!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  backButton: {
    padding: 5,
  },
  listContent: {
    padding: 20,
    gap: 15,
  },
  postCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  postUser: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
  },
  postZone: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontWeight: '600',
  },
  postTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  postText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#FFFFFF',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  emptyContainer: {
    paddingVertical: 100,
    alignItems: 'center',
    gap: 15,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 16,
    fontWeight: '700',
  },
});
