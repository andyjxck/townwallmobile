import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, ScrollView, TextInput } from 'react-native';
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
  Flag,
  Send,
  ChevronDown,
  ChevronUp
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/utils/supabase';
import { getStoredUser } from '@/utils/user';
import { sendNotification } from '@/utils/notifications';
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
  const [expandedChatId, setExpandedChatId] = useState(null);
  const [transcripts, setTranscripts] = useState({});
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);

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
          .eq('is_from_admin', false)
          .order('created_at', { ascending: false });
        if (error) throw error;
        
        // Group by user to show "chats"
        const uniqueChats = [];
        const seenUsers = new Set();
        help.forEach(msg => {
          if (!seenUsers.has(msg.sender_id)) {
            uniqueChats.push(msg);
            seenUsers.add(msg.sender_id);
          }
        });
        result = uniqueChats;
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

  const fetchTranscript = async (userId) => {
    try {
      const { data: messages, error } = await supabase
        .from('rhelp_messages')
        .select(`*, rusers!rhelp_messages_sender_id_fkey(username)`)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setTranscripts(prev => ({ ...prev, [userId]: messages }));
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to fetch transcript.");
    }
  };

  const handleSendReply = async (userId) => {
    if (!replyText.trim()) return;
    
    try {
      const admin = await getStoredUser();
      const { error } = await supabase
        .from('rhelp_messages')
        .insert({
          sender_id: admin.id,
          receiver_id: userId,
          content: replyText,
          is_from_admin: true
        });

      if (error) throw error;
      
      await sendNotification({
        userId: userId,
        title: 'Support Message',
        message: `Admin replied: ${replyText.substring(0, 50)}${replyText.length > 50 ? '...' : ''}`,
        type: 'help_chat',
        link: '/support'
      });

      setReplyText('');
      fetchTranscript(userId);
      Alert.alert("Success", "Reply sent.");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to send reply.");
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
      
      const item = data.find(i => i.id === itemId);
      if (item && item.user_id) {
        let title = '';
        let message = '';
        
        if (activeTab === 'talent') {
          title = action === 'approve' ? 'Talent Approved' : 'Talent Rejected';
          message = action === 'approve' ? `Your talent "${item.name}" has been approved!` : `Your talent "${item.name}" was not approved.`;
        } else if (activeTab === 'business') {
          title = action === 'approve' ? 'Business Approved' : 'Business Rejected';
          message = action === 'approve' ? `Your business "${item.name}" has been approved!` : `Your business "${item.name}" was not approved.`;
        } else {
          title = action === 'approve' ? 'Post Approved' : 'Post Rejected';
          message = action === 'approve' ? `Your post has been approved!` : `Your post was rejected for violating guidelines.`;
        }

        await sendNotification({
          userId: item.user_id,
          title,
          message,
          type: 'moderation',
          link: '/profile'
        });
      }

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
          <View>
            <Text style={styles.messageContent}>{item.content}</Text>
            
            <View style={styles.helpActions}>
              <TouchableOpacity 
                style={styles.transcriptButton}
                onPress={() => {
                  if (expandedChatId === item.sender_id) {
                    setExpandedChatId(null);
                  } else {
                    setExpandedChatId(item.sender_id);
                    fetchTranscript(item.sender_id);
                  }
                }}
              >
                <Text style={styles.transcriptButtonText}>
                  {expandedChatId === item.sender_id ? 'HIDE TRANSCRIPT' : 'SHOW TRANSCRIPT'}
                </Text>
                {expandedChatId === item.sender_id ? <ChevronUp size={16} color="#FBBF24" /> : <ChevronDown size={16} color="#FBBF24" />}
              </TouchableOpacity>
            </View>

            {expandedChatId === item.sender_id && (
              <View style={styles.transcriptContainer}>
                {transcripts[item.sender_id]?.map((msg) => (
                  <View key={msg.id} style={[
                    styles.transcriptMessage,
                    msg.is_from_admin ? styles.adminMessage : styles.userMessage
                  ]}>
                    <Text style={styles.transcriptSender}>
                      {msg.is_from_admin ? 'Admin' : `@${msg.rusers?.username}`}
                    </Text>
                    <Text style={styles.transcriptText}>{msg.content}</Text>
                    <Text style={styles.transcriptTime}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))}
                
                <View style={styles.replyBox}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Type a reply..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={replyText}
                    onChangeText={setReplyText}
                    multiline
                  />
                  <TouchableOpacity 
                    style={styles.sendButton}
                    onPress={() => handleSendReply(item.sender_id)}
                  >
                    <Send size={20} color="#000000" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {(activeTab === 'ai' || activeTab === 'news') && (
          <>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.zone}>{item.rzones?.name}</Text>
            <Text style={styles.description}>{item.text}</Text>
          </>
        )}

        {activeTab !== 'help' && (
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
        )}
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
  helpActions: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  transcriptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  transcriptButtonText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  transcriptContainer: {
    marginTop: 10,
    padding: 15,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  transcriptMessage: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    maxWidth: '90%',
  },
  userMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  adminMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  transcriptSender: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  transcriptText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  transcriptTime: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.2)',
    marginTop: 4,
    textAlign: 'right',
  },
  replyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  replyInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
    maxHeight: 80,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
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
