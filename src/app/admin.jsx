import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { 
  ChevronLeft, 
  Shield, 
  AlertCircle, 
  CheckCircle, 
  Trash2, 
  Star, 
  Briefcase, 
  MessageSquare, 
  Bot, 
  Flag 
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/utils/supabase';
import { getStoredUser } from '@/utils/user';
import * as Haptics from 'expo-haptics';

const TABS = [
  { id: 'talent', label: 'TALENT', icon: Star },
  { id: 'help', label: 'HELP CHATS', icon: MessageSquare },
  { id: 'business', label: 'BUSINESS', icon: Briefcase },
  { id: 'ai', label: 'AI HELD', icon: Bot },
  { id: 'news', label: 'FAKE NEWS', icon: Flag },
];

export default function ModerationAdmin() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('talent');
  const [data, setData] = useState([]);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [activeTab, isAdmin]);

  const checkAdminStatus = async () => {
    try {
      const user = await getStoredUser();
      const { data: userData, error } = await supabase
        .from('rusers')
        .select('is_admin')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      
      if (!userData?.is_admin) {
        Alert.alert("Access Denied", "You do not have permission to view this page.");
        router.back();
        return;
      }
      
      setIsAdmin(true);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let result = [];
      if (activeTab === 'talent') {
        const { data: talent, error } = await supabase
          .from('rtalent')
          .select(`*, rusers(username)`)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (error) throw error;
        result = talent;
      } else if (activeTab === 'business') {
        const { data: business, error } = await supabase
          .from('rbusinesses')
          .select(`*, rusers(username)`)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (error) throw error;
        result = business;
      } else if (activeTab === 'help') {
        const { data: help, error } = await supabase
          .from('rhelp_messages')
          .select(`*, rusers!rhelp_messages_sender_id_fkey(username)`)
          .order('created_at', { ascending: false });
        if (error) throw error;
        result = help;
      } else if (activeTab === 'ai') {
        const { data: ai, error } = await supabase
          .from('rposts')
          .select(`*, rusers(username), rzones(name)`)
          .eq('moderation_status', 'held')
          .order('created_at', { ascending: false });
        if (error) throw error;
        result = ai;
      } else if (activeTab === 'news') {
        const { data: news, error } = await supabase
          .from('rposts')
          .select(`*, rusers(username), rzones(name)`)
          .eq('moderation_status', 'flagged')
          .order('created_at', { ascending: false });
        if (error) throw error;
        result = news;
      }
      setData(result || []);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to fetch moderation data.");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (itemId, action) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      let table = '';
      let updateData = {};
      
      if (activeTab === 'talent') {
        table = 'rtalent';
        updateData = { status: action === 'approve' ? 'approved' : 'rejected' };
      } else if (activeTab === 'business') {
        table = 'rbusinesses';
        updateData = { status: action === 'approve' ? 'approved' : 'rejected' };
      } else if (activeTab === 'ai' || activeTab === 'news') {
        table = 'rposts';
        updateData = { 
          moderation_status: action === 'approve' ? 'approved' : 'rejected',
          is_blurred: action === 'reject'
        };
      } else if (activeTab === 'help') {
        if (action === 'reject') {
          const { error } = await supabase.from('rhelp_messages').delete().eq('id', itemId);
          if (error) throw error;
          setData(prev => prev.filter(p => p.id !== itemId));
          return;
        }
        return;
      }

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', itemId);

      if (error) throw error;
      
      setData(prev => prev.filter(p => p.id !== itemId));
      Alert.alert("Success", `Item has been ${action}d.`);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to perform action.");
    }
  };

  const renderItem = ({ item }) => {
    const Icon = TABS.find(t => t.id === activeTab)?.icon || Shield;
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.userRow}>
            <View style={styles.iconContainer}>
              <Icon size={14} color="#FBBF24" />
            </View>
            <Text style={styles.username}>@{item.rusers?.username || 'unknown'}</Text>
          </View>
          <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>

        {activeTab === 'talent' && (
          <>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.subtitle}>{item.category} • {item.platform}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </>
        )}

        {activeTab === 'business' && (
          <>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.subtitle}>{item.category}</Text>
            <Text style={styles.description}>{item.description}</Text>
            {item.website && <Text style={styles.link}>{item.website}</Text>}
          </>
        )}

        {activeTab === 'help' && (
          <Text style={styles.messageContent}>{item.content}</Text>
        )}

        {(activeTab === 'ai' || activeTab === 'news') && (
          <>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.zone}>{item.rzones?.name}</Text>
            <Text style={styles.description}>{item.text}</Text>
          </>
        )}

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
    );
  };

  if (!isAdmin) return null;

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
        <TouchableOpacity onPress={fetchData} style={styles.backButton}>
          <AlertCircle color="#FFFFFF" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity 
                key={tab.id}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab(tab.id);
                }}
              >
                <Icon size={16} color={isActive ? '#000000' : 'rgba(255,255,255,0.4)'} />
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <CheckCircle size={48} color="rgba(255,255,255,0.1)" />
              <Text style={styles.emptyText}>Queue is clear!</Text>
            </View>
          }
        />
      )}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
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
  tabContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tabScroll: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#FBBF24',
  },
  tabText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '800',
  },
  activeTabText: {
    color: '#000000',
  },
  listContent: {
    padding: 20,
    gap: 15,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '700',
  },
  date: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  description: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  zone: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  messageContent: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  link: {
    color: '#60A5FA',
    fontSize: 13,
    textDecorationLine: 'underline',
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
