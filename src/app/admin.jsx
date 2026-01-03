import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, ScrollView, TextInput, Dimensions, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { 
  ChevronLeft, 
  Shield, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Trash2, 
  Star, 
  Briefcase, 
  MessageSquare, 
  Bot, 
  Flag,
  Send,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  BarChart2,
  Undo,
  UserCheck
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/utils/supabase';
import { getStoredUser } from '@/utils/user';
import { sendNotification } from '@/utils/notifications';
import { useTheme } from "@/utils/ThemeContext";
import * as Haptics from 'expo-haptics';
import { LinearGradient } from "expo-linear-gradient";

export default function ModerationAdmin() {
  const { isHippie } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('talent');
  const [data, setData] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [expandedChatId, setExpandedChatId] = useState(null);
  const [transcripts, setTranscripts] = useState({});
  const [replyText, setReplyText] = useState('');
    const [aiFilter, setAiFilter] = useState('held');
    const [overrideItem, setOverrideItem] = useState(null);
    const [overrideReason, setOverrideReason] = useState('');
    const [pollModalItem, setPollModalItem] = useState(null);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['Yes', 'No', 'Maybe later']);
    const [overrideMode, setOverrideMode] = useState(null);
    const [repairing, setRepairing] = useState(false);

    const TABS = [

      { id: 'talent', label: 'TALENT', icon: Star },
      { id: 'help', label: 'HELP CHATS', icon: MessageSquare },
      { id: 'votes', label: 'VOTES', icon: CheckCircle },
      { id: 'business', label: 'BUSINESS', icon: Briefcase },
      { id: 'ai', label: 'AI LOGS', icon: Bot },
      { id: 'news', label: 'FAKE NEWS', icon: Flag },
      { id: 'reports', label: 'REPORTS', icon: AlertCircle },
    ];

  if (isSuperAdmin) {
      TABS.push({ id: 'logs', label: 'ADMIN LOGS', icon: Shield });
      TABS.push({ id: 'analytics', label: 'ANALYTICS', icon: BarChart2 });
      TABS.push({ id: 'repair', label: 'REPAIR DB', icon: RefreshCw });
    }


  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [activeTab, isAdmin, aiFilter]);

  const checkAdminStatus = async () => {
    try {
      const user = await getStoredUser();
      if (!user) {
        router.replace('/auth');
        return;
      }
      const { data: userData, error } = await supabase
        .from('rusers')
        .select('is_admin, is_moderator, username')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      
      if (!userData?.is_admin && !userData?.is_moderator) {
        Alert.alert("Access Denied", "You do not have permission to view this page.");
        router.back();
        return;
      }
      
      setIsAdmin(true); 
      if (userData.username === 'andysocial') {
        setIsSuperAdmin(true);
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const handleRepairDatabase = async (auto = false) => {
    if (repairing) return;
    setRepairing(true);
    try {
      const { error } = await supabase.rpc('repair_database_schema');
      if (error) throw error;
      
      if (!auto) {
        Alert.alert("Success", "Database schema has been repaired. All necessary tables have been verified.");
        fetchData();
      }
      return true;
    } catch (error) {
      console.error("Repair failed:", error);
      if (!auto) Alert.alert("Error", "Failed to repair database. Please try again.");
      return false;
    } finally {
      setRepairing(false);
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
      } else if (activeTab === 'votes') {
        const { data: votes, error } = await supabase
          .from('rfeature_suggestions')
          .select(`*, rusers(username)`)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (error) throw error;
        result = votes;
      } else if (activeTab === 'help') {
        const { data: help, error } = await supabase
          .from('rhelp_messages')
          .select(`*, rusers!rhelp_messages_sender_id_fkey(username)`)
          .order('created_at', { ascending: false });
        if (error) throw error;
        
        const uniqueChats = [];
        const seenUsers = new Set();
        help.forEach(msg => {
          const userId = msg.is_from_admin ? msg.receiver_id : msg.sender_id;
          if (!seenUsers.has(userId)) {
            // Find if this specific chat is overtaken
            const isOvertaken = help.some(m => 
              (m.sender_id === userId || m.receiver_id === userId) && 
              m.status === 'overtaken'
            );
            uniqueChats.push({ ...msg, display_user_id: userId, is_overtaken: isOvertaken });
            seenUsers.add(userId);
          }
        });
        result = uniqueChats;
      } else if (activeTab === 'ai') {
        let query = supabase
          .from('rposts')
          .select(`*, rusers(username), rzones(name)`)
          .order('created_at', { ascending: false });
        
        if (aiFilter === 'approved') query = query.eq('moderation_status', 'approved');
        else if (aiFilter === 'rejected') query = query.eq('moderation_status', 'rejected');
        else query = query.eq('moderation_status', 'held');

        const { data: ai, error } = await query;
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
} else if (activeTab === 'reports') {
            const { data: reports, error } = await supabase
              .from('rmoderation_logs')
              .select(`*`)
              .eq('action', 'report')
              .order('created_at', { ascending: false });
            if (error) throw error;
            result = reports;
        } else if (activeTab === 'logs' && isSuperAdmin) {
        const { data: logsData, error } = await supabase
          .from('rmoderation_logs')
          .select(`*, moderator:rusers!rmoderation_logs_moderator_id_fkey(username)`)
          .order('created_at', { ascending: false });
        if (error) throw error;
        result = logsData;
        } else if (activeTab === 'analytics' && isSuperAdmin) {
          const [users, posts, reactions, comments] = await Promise.all([
            supabase.from('rusers').select('id', { count: 'exact', head: true }),
            supabase.from('rposts').select('id', { count: 'exact', head: true }),
            supabase.from('rreactions').select('id', { count: 'exact', head: true }),
            supabase.from('rcomments').select('id', { count: 'exact', head: true })
          ]);
          setAnalytics({
            users: users.count,
            posts: posts.count,
            reactions: reactions.count,
            comments: comments.count
          });
          result = [];
        } else if (activeTab === 'repair') {
          result = [];
        }
        setData(result || []);
      } catch (error) {
        console.error(error);
        if (error.code === '42P01') {
          // Table missing
          const repaired = await handleRepairDatabase(true);
          if (repaired) fetchData();
        } else {
          Alert.alert("Error", "Failed to fetch data.");
        }
      } finally {
        setLoading(false);
      }
    };


  const handleRestorePost = async (log) => {
    if (log.target_type !== 'post') return;
    
    Alert.alert(
      "Restore Post",
      "Are you sure you want to restore this post?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Restore", 
          onPress: async () => {
    try {
      const admin = await getStoredUser();
      const { error } = await supabase
        .from('rposts')
        .update({ is_deleted: false, deletion_reason: null, deleted_by: null })
        .eq('id', log.target_id);
      
      if (error) throw error;
      
      try {
        await supabase.from('rmoderation_logs').insert({
          moderator_id: admin.id,
          target_id: log.target_id,
          target_type: 'post',
          action: 'restore_post',
          reason: 'Restored by super admin'
        });
      } catch (logError) {
        console.warn("Moderation log failed:", logError);
      }

      Alert.alert("Success", "Post has been restored.");
              fetchData();
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "Failed to restore post.");
            }
          }
        }
      ]
    );
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
      } else if (activeTab === 'votes') {
        if (action === 'approve') {
          setPollModalItem(itemId);
          const suggestion = data.find(i => i.id === itemId);
          setPollQuestion(suggestion?.suggestion_text || '');
          return; // Modal will handle the rest
        }
        table = 'rfeature_suggestions';
        updateData = { status: 'rejected' };
      } else if (activeTab === 'ai' || activeTab === 'news') {
        table = 'rposts';
        updateData = { 
          moderation_status: action === 'approve' ? 'approved' : 'rejected',
          is_blurred: action === 'reject',
          is_deleted: action === 'reject'
        };
      } else if (activeTab === 'reports') {
        const report = data.find(i => i.id === itemId);
        if (!report) throw new Error("Report not found");

        if (action === 'approve') {
          if (report.target_type === 'user') {
            await supabase.from('rusers').update({ is_banned: true }).eq('id', report.target_id);
          } else if (report.target_type === 'post') {
            await supabase.from('rposts').update({ is_deleted: true, deletion_reason: report.reason }).eq('id', report.target_id);
          }
          table = 'rmoderation_logs';
          updateData = { action: 'report_approved' };
        } else {
          table = 'rmoderation_logs';
          updateData = { action: 'report_rejected' };
        }
      }

      const { error } = await supabase.from(table).update(updateData).eq('id', itemId);
      if (error) throw error;
      
      setData(prev => prev.filter(p => p.id !== itemId));
      Alert.alert("Success", `Item has been ${action}d.`);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Action failed.");
    }
  };

  const handleOvertake = async (userId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const admin = await getStoredUser();
      const { error } = await supabase.from('rhelp_messages').insert({
        sender_id: admin.id,
        receiver_id: userId,
        content: "A real agent has joined the chat.",
        is_from_admin: true,
        status: 'overtaken'
      });
      if (error) throw error;
      
      Alert.alert("Success", "You have overtaken this chat. AI responses are now disabled.");
      fetchData();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Overtake failed.");
    }
  };

  const handleReply = async (userId) => {
    if (!replyText.trim()) return;
    try {
      const admin = await getStoredUser();
      const { error } = await supabase.from('rhelp_messages').insert({
        sender_id: admin.id,
        receiver_id: userId,
        content: replyText.trim(),
        is_from_admin: true
      });
      if (error) throw error;
      
      try {
        // Notify the user
        const { sendHelpMessageNotification } = require('@/utils/notifications');
        await sendHelpMessageNotification({
          senderId: admin.id,
          senderUsername: 'Admin',
          receiverId: userId,
          isFromAdmin: true,
          messageContent: replyText.trim()
        });
      } catch (notifError) {
        console.warn("Notification failed:", notifError);
      }
      
      setReplyText('');
      setExpandedChatId(null);
      Alert.alert("Success", "Reply sent.");
      fetchData();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Reply failed.");
    }
  };

  const handleResolve = async (userId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const admin = await getStoredUser();
      const { error } = await supabase.from('rhelp_messages').insert({
        sender_id: admin.id,
        receiver_id: userId,
        content: "This chat has been resolved. Please rate your experience 1-5 / Leave a comment.",
        is_from_admin: true,
        status: 'resolved'
      });
      if (error) throw error;
      
      try {
        const { sendHelpMessageNotification } = require('@/utils/notifications');
        await sendHelpMessageNotification({
          senderId: admin.id,
          senderUsername: 'Admin',
          receiverId: userId,
          isFromAdmin: true,
          messageContent: "Your support chat has been resolved."
        });
      } catch (notifError) {
        console.warn("Notification failed:", notifError);
      }

      setExpandedChatId(null);
      Alert.alert("Resolved", "The chat has been marked as resolved.");
      fetchData();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to resolve chat.");
    }
  };

  const handleOverridePost = async () => {
      if (!overrideReason.trim()) {
        Alert.alert("Reason Required", "Please provide a reason for overriding.");
        return;
      }

      try {
        const user = await getStoredUser();
        const { error } = await supabase
          .from('rposts')
          .update({ 
            moderation_status: 'approved',
            is_blurred: false,
            is_deleted: false
          })
          .eq('id', overrideItem.id);
        
        if (error) throw error;

        try {
          await supabase.from('rmoderation_logs').insert({
            moderator_id: user.id,
            target_id: overrideItem.id,
            target_type: 'post',
            action: 'override_approve',
            reason: `Override: ${overrideReason.trim()}`
          });
        } catch (logError) {
          console.warn("Moderation log failed:", logError);
        }

        setData(prev => prev.filter(p => p.id !== overrideItem.id));
        setOverrideItem(null);
        setOverrideReason('');
        setOverrideMode(null);
        Alert.alert("Success", "Post has been approved and posted.");
      } catch (error) {
        console.error(error);
        if (error.code === '42P01') {
          const repaired = await handleRepairDatabase(true);
          if (repaired) handleOverridePost();
        } else {
          Alert.alert("Error", "Failed to approve post.");
        }
      }
    };

  const handleOverrideDelete = async () => {
    if (!overrideReason.trim()) {
      Alert.alert("Reason Required", "Please provide a reason for overriding.");
      return;
    }

    try {
      const user = await getStoredUser();
      const { error } = await supabase
        .from('rposts')
        .update({ 
          is_deleted: true, 
          deletion_reason: overrideReason.trim(), 
          moderation_status: 'rejected' 
        })
        .eq('id', overrideItem.id);
      
      if (error) throw error;

      try {
        await supabase.from('rmoderation_logs').insert({
          moderator_id: user.id,
          target_id: overrideItem.id,
          target_type: 'post',
          action: 'delete_post',
          reason: `Override: ${overrideReason.trim()}`
        });
      } catch (logError) {
        console.warn("Moderation log failed:", logError);
      }

        setData(prev => prev.filter(p => p.id !== overrideItem.id));
        setOverrideItem(null);
        setOverrideReason('');
        setOverrideMode(null);
          Alert.alert("Success", "Post has been deleted.");
        } catch (error) {
        console.error(error);
        if (error.code === '42P01') {
          const repaired = await handleRepairDatabase(true);
          if (repaired) handleOverrideDelete();
        } else {
          Alert.alert("Error", "Failed to delete post.");
        }
      }
    };


  const handleCreatePollFromSuggestion = async () => {
    if (!pollQuestion.trim() || pollOptions.some(o => !o.trim())) {
      Alert.alert("Incomplete", "Please provide a question and all options.");
      return;
    }

    try {
      const user = await getStoredUser();
      
      // 1. Create the poll
      const { data: poll, error: pollError } = await supabase
        .from('rpolls')
        .insert({
          question: pollQuestion.trim(),
          is_active: true
        })
        .select()
        .single();

      if (pollError) throw pollError;

      // 2. Create options
      const optionsToInsert = pollOptions.map(o => ({
        poll_id: poll.id,
        option_text: o.trim()
      }));

      const { error: optionsError } = await supabase
        .from('rpoll_options')
        .insert(optionsToInsert);

      if (optionsError) throw optionsError;

      // 3. Mark suggestion as approved
      const { error: suggestionError } = await supabase
        .from('rfeature_suggestions')
        .update({ status: 'approved' })
        .eq('id', pollModalItem);

      if (suggestionError) throw suggestionError;

      Alert.alert("Success", "Poll created and suggestion approved!");
      setData(prev => prev.filter(p => p.id !== pollModalItem));
      setPollModalItem(null);
      setPollQuestion('');
      setPollOptions(['Yes', 'No', 'Maybe later']);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to complete operation.");
    }
  };

  const updatePollOption = (text, index) => {
    const newOptions = [...pollOptions];
    newOptions[index] = text;
    setPollOptions(newOptions);
  };

  const fetchTranscript = async (userId) => {
    try {
      const { data: messages, error } = await supabase
        .from('rhelp_messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setTranscripts(prev => ({ ...prev, [userId]: messages }));
    } catch (error) {
      console.error(error);
    }
  };

  const renderItem = ({ item }) => {
    if (activeTab === 'logs') {
      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.logAction}>{item.action.toUpperCase().replace('_', ' ')}</Text>
            <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
          <View style={styles.contentPadding}>
            <Text style={styles.logDetail}>Moderator: @{item.moderator?.username}</Text>
            <Text style={styles.logDetail}>Target: {item.target_type} (ID: {item.target_id})</Text>
            <Text style={styles.logReason}>Reason: {item.reason}</Text>
            
            {item.action === 'delete_post' && item.target_type === 'post' && (
              <TouchableOpacity 
                style={styles.restoreButton}
                onPress={() => handleRestorePost(item)}
              >
                <Undo size={16} color="#4ADE80" />
                <Text style={styles.restoreText}>RESTORE POST</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    if (activeTab === 'analytics') return null;

    const Icon = TABS.find(t => t.id === activeTab)?.icon || Shield;
    
    if (activeTab === 'reports') {
      const metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
      return (
        <TouchableOpacity 
          style={styles.card}
          onPress={() => {
            if (item.target_type === 'user') {
              router.push(`/profile?userId=${item.target_id}`);
            } else if (item.target_type === 'post') {
              router.push(`/post?id=${item.target_id}`);
            }
          }}
        >
          <View style={styles.cardHeader}>
            <View style={styles.userRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#EF4444' }]}>
                <AlertCircle size={14} color="#FFFFFF" />
              </View>
              <Text style={styles.username}>
                {item.target_type === 'user' ? `User Report` : `Post Report`}
              </Text>
            </View>
            <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>

          <View style={styles.contentPadding}>
            <Text style={styles.reportTarget}>
              {item.target_type === 'user' ? `@${metadata?.username || 'Unknown User'}` : `Post #${item.target_id}`}
            </Text>
            <Text style={styles.description}>Reason: {item.reason}</Text>
            {metadata?.reported_by && (
              <Text style={styles.reportedBy}>Reported by user #{metadata.reported_by}</Text>
            )}
            <Text style={styles.tapToView}>Tap to view {item.target_type}</Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.approveButton]} 
              onPress={(e) => { e.stopPropagation(); handleAction(item.id, 'approve'); }}
            >
              <CheckCircle size={18} color="#000000" />
              <Text style={styles.actionText}>{item.target_type === 'user' ? 'BAN USER' : 'DELETE POST'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.rejectButton]} 
              onPress={(e) => { e.stopPropagation(); handleAction(item.id, 'reject'); }}
            >
              <XCircle size={18} color="#FFFFFF" />
              <Text style={[styles.actionText, { color: '#FFFFFF' }]}>DISMISS</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    }

    if (activeTab === 'help') {
      const isExpanded = expandedChatId === item.display_user_id;
      const transcript = transcripts[item.display_user_id] || [];

      return (
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.cardHeader}
            onPress={() => {
              if (!isExpanded) fetchTranscript(item.display_user_id);
              setExpandedChatId(isExpanded ? null : item.display_user_id);
            }}
          >
            <View style={styles.userRow}>
              <View style={[styles.iconContainer, item.is_overtaken && { backgroundColor: '#4ADE80' }]}>
                {item.is_overtaken ? <UserCheck size={14} color="#000" /> : <MessageSquare size={14} color="#FFF" />}
              </View>
              <Text style={styles.username}>@{item.rusers?.username || 'user_' + item.display_user_id}</Text>
              {item.is_overtaken && <View style={styles.overtakenBadge}><Text style={styles.overtakenBadgeText}>AGENT JOINED</Text></View>}
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
              {isExpanded ? <ChevronUp size={20} color="rgba(255,255,255,0.4)" /> : <ChevronDown size={20} color="rgba(255,255,255,0.4)" />}
            </View>
          </TouchableOpacity>

          <View style={styles.contentPadding}>
            <Text style={styles.description} numberOfLines={isExpanded ? undefined : 2}>
              {item.content}
            </Text>
            
            {isExpanded && (
              <View style={styles.transcriptContainer}>
                <View style={styles.transcriptLine} />
                {transcript.map((msg) => (
                  <View key={msg.id} style={[styles.transcriptMsg, msg.is_from_admin ? styles.adminMsg : styles.userMsg]}>
                    <Text style={styles.transcriptText}>{msg.content}</Text>
                    <Text style={styles.transcriptTime}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                ))}

                {item.is_overtaken ? (
                  <View>
                    <TouchableOpacity 
                      style={[styles.overtakeButton, { backgroundColor: '#10B981', marginBottom: 10 }]} 
                      onPress={() => handleResolve(item.display_user_id)}
                    >
                      <CheckCircle size={18} color="#000" />
                      <Text style={styles.overtakeButtonText}>RESOLVE CHAT</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.replyContainer}>
                      <TextInput
                        style={styles.replyInput}
                        placeholder="Type your response as an agent..."
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        value={replyText}
                        onChangeText={setReplyText}
                        multiline
                      />
                      <TouchableOpacity style={styles.sendButtonSmall} onPress={() => handleReply(item.display_user_id)}>
                        <Send size={18} color="#000" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.overtakeButton} onPress={() => handleOvertake(item.display_user_id)}>
                    <UserCheck size={18} color="#000" />
                    <Text style={styles.overtakeButtonText}>OVERTAKE CHAT FROM AI</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.userRow}>
            <View style={styles.iconContainer}>
              <Icon size={14} color="#FFFFFF" />
            </View>
            <Text style={styles.username}>@{item.metadata?.username || item.rusers?.username || 'unknown'}</Text>
          </View>
          <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>

        <View style={styles.contentPadding}>
          {item.title && <Text style={styles.title}>{item.title}</Text>}
          {item.name && <Text style={styles.title}>{item.name}</Text>}
          <Text style={styles.description}>{item.reason || item.suggestion_text || item.text || item.description || item.content}</Text>
          {activeTab === 'ai' && item.moderation_reason && (
            <View style={styles.aiReasonContainer}>
              <Bot size={12} color="#4ADE80" />
              <Text style={styles.aiReasonText}>AI REASON: {item.moderation_reason}</Text>
            </View>
          )}
        </View>

        <View style={styles.actionRow}>
            {activeTab === 'ai' && aiFilter === 'held' && (
              <>
                <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => handleAction(item.id, 'reject')}>
                  <XCircle size={18} color="#FFFFFF" />
                  <Text style={[styles.actionText, { color: '#FFFFFF' }]}>REJECT</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => handleAction(item.id, 'approve')}>
                  <CheckCircle size={18} color="#000000" />
                  <Text style={styles.actionText}>APPROVE</Text>
                </TouchableOpacity>
              </>
            )}
            {activeTab === 'ai' && aiFilter === 'approved' && (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#F59E0B', flex: 1 }]} 
                onPress={() => {
                  setOverrideItem(item);
                  setOverrideReason('');
                  setOverrideMode('delete');
                }}
              >
                <Trash2 size={18} color="#000" />
                <Text style={[styles.actionText, { color: '#000' }]}>OVERRIDE - DELETE POST</Text>
              </TouchableOpacity>
            )}
            {activeTab === 'ai' && aiFilter === 'rejected' && (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#4ADE80', flex: 1 }]} 
                onPress={() => {
                  setOverrideItem(item);
                  setOverrideReason('');
                  setOverrideMode('post');
                }}
              >
                <CheckCircle size={18} color="#000" />
                <Text style={[styles.actionText, { color: '#000' }]}>OVERRIDE - POST IT</Text>
              </TouchableOpacity>
            )}
              {activeTab !== 'ai' && (
                <>
                  <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => handleAction(item.id, 'approve')}>
                    <CheckCircle size={18} color="#000000" />
                    <Text style={styles.actionText}>APPROVE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => handleAction(item.id, 'reject')}>
                    <XCircle size={18} color="#FFFFFF" />
                    <Text style={[styles.actionText, { color: '#FFFFFF' }]}>REJECT</Text>
                  </TouchableOpacity>
                </>
              )}
          </View>
      </View>
    );
  };

  if (!isAdmin) return null;

  return (
    <View style={[styles.container, isHippie && { backgroundColor: 'transparent' }]}>
      {!isHippie && <LinearGradient colors={['#0F172A', '#000000', '#000000']} style={StyleSheet.absoluteFill} />}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ paddingTop: insets.top, flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft color="#FFFFFF" size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isSuperAdmin ? 'SUPER ADMIN' : 'MODERATION'}</Text>
          <TouchableOpacity onPress={fetchData} style={styles.backButton}>
            <RefreshCw color="#FFFFFF" size={24} />
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
                  <Icon size={14} color={isActive ? '#000000' : 'rgba(255,255,255,0.4)'} />
                  <Text style={[styles.tabText, isActive && styles.activeTabText]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {activeTab === 'ai' && (
          <View style={styles.aiFilterContainer}>
            {['held', 'approved', 'rejected'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.aiFilterButton, aiFilter === filter && styles.aiFilterButtonActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setAiFilter(filter);
                }}
              >
                <Text style={[styles.aiFilterText, aiFilter === filter && styles.aiFilterTextActive]}>
                  {filter.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'analytics' && analytics ? (
          <ScrollView style={styles.analyticsScroll}>
            <View style={styles.analyticsGrid}>
              <View style={styles.statCard}><Text style={styles.statValue}>{analytics.users}</Text><Text style={styles.statLabel}>USERS</Text></View>
              <View style={styles.statCard}><Text style={styles.statValue}>{analytics.posts}</Text><Text style={styles.statLabel}>POSTS</Text></View>
              <View style={styles.statCard}><Text style={styles.statValue}>{analytics.reactions}</Text><Text style={styles.statLabel}>REACTIONS</Text></View>
              <View style={styles.statCard}><Text style={styles.statValue}>{analytics.comments}</Text><Text style={styles.statLabel}>COMMENTS</Text></View>
            </View>
          </ScrollView>
        ) : activeTab === 'repair' ? (
          <View style={styles.repairContainer}>
            <View style={styles.repairIconContainer}>
              <RefreshCw size={64} color="#4ADE80" />
            </View>
            <Text style={styles.repairTitle}>DATABASE REPAIR</Text>
            <Text style={styles.repairDesc}>
              This will verify and recreate any missing database tables (rposts, rusers, rmoderation_logs, etc.) while preserving existing data.
            </Text>
            <TouchableOpacity 
              style={[styles.repairButton, repairing && { opacity: 0.5 }]} 
              onPress={() => handleRepairDatabase()}
              disabled={repairing}
            >
              {repairing ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <RefreshCw size={20} color="#000" />
                  <Text style={styles.repairButtonText}>RUN REPAIR SCRIPT</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.centered}><ActivityIndicator color="#FFFFFF" /></View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item, index) => item.id?.toString() || index.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={renderItem}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <CheckCircle size={48} color="rgba(255,255,255,0.1)" />
                <Text style={styles.emptyText}>QUEUE IS CLEAR</Text>
              </View>
            }
          />
        )}

        <Modal
            visible={!!overrideItem}
            transparent={true}
            animationType="fade"
            onRequestClose={() => { setOverrideItem(null); setOverrideMode(null); }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {overrideMode === 'delete' ? 'OVERRIDE & DELETE' : 'OVERRIDE & POST'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {overrideMode === 'delete' 
                    ? 'Please provide a reason for deleting this approved post.' 
                    : 'Please provide a reason for posting this rejected content.'}
                </Text>
                
                <TextInput
                  style={styles.modalInput}
                  placeholder={overrideMode === 'delete' ? "Reason for deletion..." : "Reason for approving..."}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={overrideReason}
                  onChangeText={setOverrideReason}
                  multiline
                  numberOfLines={4}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]} 
                    onPress={() => { setOverrideItem(null); setOverrideMode(null); }}
                  >
                    <Text style={styles.cancelButtonText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, overrideMode === 'delete' ? styles.confirmButton : { backgroundColor: '#4ADE80' }]} 
                    onPress={overrideMode === 'delete' ? handleOverrideDelete : handleOverridePost}
                  >
                    <Text style={[styles.confirmButtonText, overrideMode === 'post' && { color: '#000' }]}>
                      {overrideMode === 'delete' ? 'DELETE POST' : 'POST IT'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            </Modal>

          <Modal
            visible={!!pollModalItem}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setPollModalItem(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>POLL TEMPLATE</Text>
                <Text style={styles.modalSubtitle}>Create a structured vote for this feature suggestion.</Text>
                
                <Text style={styles.label}>QUESTION</Text>
                <TextInput
                  style={[styles.modalInput, { minHeight: 60, marginBottom: 15 }]}
                  placeholder="Poll Question..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                  multiline
                />

                <Text style={styles.label}>OPTIONS</Text>
                {pollOptions.map((opt, idx) => (
                  <TextInput
                    key={idx}
                    style={[styles.modalInput, { minHeight: 45, marginBottom: 10, paddingVertical: 10 }]}
                    placeholder={`Option ${idx + 1}`}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={opt}
                    onChangeText={(text) => updatePollOption(text, idx)}
                  />
                ))}

                <View style={[styles.modalButtons, { marginTop: 10 }]}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]} 
                    onPress={() => setPollModalItem(null)}
                  >
                    <Text style={styles.cancelButtonText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, { backgroundColor: '#4ADE80' }]} 
                    onPress={handleCreatePollFromSuggestion}
                  >
                    <Text style={[styles.confirmButtonText, { color: '#000' }]}>APPROVE & CREATE POLL</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  backButton: { padding: 5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tabContainer: { paddingVertical: 10 },
  tabScroll: { paddingHorizontal: 20, gap: 12 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.05)', gap: 8 },
  activeTab: { backgroundColor: '#FFFFFF' },
  tabText: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  activeTabText: { color: '#000000' },
  listContent: { paddingBottom: 40 },
  card: { backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconContainer: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.1)', alignItems: 'center', justifyContent: 'center' },
  username: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  date: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '700' },
  contentPadding: { paddingHorizontal: 20, paddingBottom: 20 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  description: { color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 22 },
  actionRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.02)' },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  approveButton: { backgroundColor: '#FFFFFF' },
  rejectButton: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  actionText: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  emptyContainer: { paddingVertical: 150, alignItems: 'center', gap: 20 },
  emptyText: { color: 'rgba(255,255,255,0.2)', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  logAction: { color: '#F59E0B', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  logDetail: { color: '#FFFFFF', fontSize: 13, marginBottom: 4 },
  logReason: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontStyle: 'italic', marginTop: 8 },
  restoreButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(74, 222, 128, 0.1)', borderWidth: 1, borderColor: 'rgba(74, 222, 128, 0.2)', alignSelf: 'flex-start' },
  restoreText: { color: '#4ADE80', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  analyticsScroll: { flex: 1, padding: 20 },
  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  statCard: { width: (Dimensions.get('window').width - 55) / 2, backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 4 },
  aiReasonContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, padding: 10, backgroundColor: 'rgba(74, 222, 128, 0.05)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(74, 222, 128, 0.1)' },
  aiReasonText: { color: '#4ADE80', fontSize: 11, fontWeight: '700', flex: 1 },
  aiFilterContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 15, gap: 10 },
  aiFilterButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  aiFilterButtonActive: { backgroundColor: '#4ADE80', borderColor: '#4ADE80' },
  aiFilterText: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  aiFilterTextActive: { color: '#000000' },
  overtakeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#4ADE80', paddingVertical: 12, borderRadius: 12, marginTop: 15 },
  overtakeButtonText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  overtakenBadge: { backgroundColor: '#4ADE80', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  overtakenBadgeText: { color: '#000', fontSize: 8, fontWeight: '900' },
  transcriptContainer: { marginTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 15 },
  transcriptMsg: { padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '90%' },
  userMsg: { backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start' },
  adminMsg: { backgroundColor: 'rgba(74, 222, 128, 0.1)', alignSelf: 'flex-end' },
  transcriptText: { color: '#FFF', fontSize: 13 },
  transcriptTime: { color: 'rgba(255,255,255,0.3)', fontSize: 9, alignSelf: 'flex-end', marginTop: 4 },
  replyContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15 },
    replyInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10, color: '#FFF', fontSize: 14, maxHeight: 100 },
    sendButtonSmall: { backgroundColor: '#FFF', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#1E293B', width: '100%', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
    modalSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 20 },
    modalInput: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 15, color: '#FFFFFF', fontSize: 15, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 20 },
    modalButtons: { flexDirection: 'row', gap: 12 },
    modalButton: { flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: 'rgba(255,255,255,0.05)' },
    confirmButton: { backgroundColor: '#EF4444' },
    cancelButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
      confirmButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
      repairContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
      repairIconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(74, 222, 128, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
      repairTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: 2, marginBottom: 16 },
      repairDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    repairButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4ADE80', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 40, gap: 12 },
    repairButtonText: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
    reportTarget: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 6 },
    reportedBy: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8 },
    tapToView: { color: '#4ADE80', fontSize: 11, fontWeight: '700', marginTop: 12, letterSpacing: 1 },
    label: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }
  });

