import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Dimensions, 
  TextInput, 

  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Switch,
  Modal,
  ScrollView,
  Alert
} from 'react-native';
import { MessageCircle, X, Send, ChevronLeft, MoreHorizontal, User, Users, Check, CheckCheck, Settings, Plus, UserPlus, Mic, MicOff, Phone as PhoneIcon, PhoneOff as PhoneOffIcon, PhoneIncoming, PhoneOutgoing, Phone } from 'lucide-react-native';
import { supabase } from '../utils/supabase';
import { getStoredUser } from '../utils/user';
import { theme } from '../utils/theme';
import { sendNotification, sendMessageNotification } from '../utils/notifications';
import { useChatStore } from '../utils/auth';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
// LiveKit imports are handled dynamically to prevent crashes in environments without native modules
let LiveKitRoom, useLocalParticipant, AudioSession;

const isExpoGo = Constants.appOwnership === "expo";

if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    const lk = require('@livekit/react-native');
    LiveKitRoom = lk.LiveKitRoom;
    useLocalParticipant = lk.useLocalParticipant;
    AudioSession = lk.AudioSession;
  } catch (e) {
    console.log('LiveKit native modules not available');
  }
}

const SOUNDS = {
  ringing: 'https://assets.mixkit.co/sfx/preview/mixkit-phone-ringing-bell-586.mp3',
  connect: 'https://assets.mixkit.co/sfx/preview/mixkit-positive-interface-click-1112.mp3',
  disconnect: 'https://assets.mixkit.co/sfx/preview/mixkit-modern-click-box-check-1120.mp3',
  mute: 'https://assets.mixkit.co/sfx/preview/mixkit-interface-click-1126.mp3',
};

import { ThemeProvider, useTheme } from "@/utils/ThemeContext";

const { width, height } = Dimensions.get('window');

export default function FloatingChat() {
  const { isHippie } = useTheme();
  const router = useRouter();
  const { isOpen, activeChatId, open: setOpen, close: setClose, toggle: toggleChatGlobal, setActiveChatId } = useChatStore();
  const [activeChat, setActiveChat] = useState(null);
  const activeChatRef = useRef(null);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Sync activeChat with activeChatId from store
  useEffect(() => {
    if (activeChatId) {
      const chat = chats.find(c => c.id === activeChatId);
      if (chat) {
        setActiveChat(chat);
        setShowChatList(false);
      }
    } else if (isOpen && !activeChat && !showSettings) {
      // If we're open but have no active chat, show the list
      setShowChatList(true);
    }
  }, [activeChatId, chats, isOpen]);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [showChatList, setShowChatList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchUsers, setSearchUsers] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  
    const [activeCall, setActiveCall] = useState(null);
    const [callToken, setCallToken] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef(null);
  const soundObjects = useRef({});
  
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(height)).current;

  const flatListRef = useRef();

  const fetchCallToken = async (roomName) => {
    try {
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: { identity: user.username, roomName }
      });
      if (error) throw error;
      return data.token;
    } catch (error) {
      console.error('Error fetching call token:', error);
      return null;
    }
  };

    const LiveKitRoomContent = ({ onConnected }) => {
      if (!useLocalParticipant || !AudioSession) return null;
      
      const { localParticipant } = useLocalParticipant();

    
    useEffect(() => {
      const startSession = async () => {
        await AudioSession.startAudioSession();
        if (onConnected) onConnected();
      };
      startSession();
      return () => {
        AudioSession.stopAudioSession();
      };
    }, []);

    useEffect(() => {
      if (localParticipant) {
        localParticipant.setMicrophoneEnabled(!isMuted);
      }
    }, [isMuted, localParticipant]);

    return null;
  };

  useEffect(() => {
    if (activeCall?.status === 'ringing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
        ])
      ).start();
      playSound('ringing', true);
    } else {
      pulseAnim.setValue(1);
      stopSound('ringing');
      if (activeCall?.status === 'active') {
        playSound('connect');
      }
    }
  }, [activeCall?.status]);

  const playSound = async (name, loop = false) => {
    try {
      if (soundObjects.current[name]) {
        await soundObjects.current[name].unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: SOUNDS[name] },
        { shouldPlay: true, isLooping: loop }
      );
      soundObjects.current[name] = sound;
    } catch (error) {
      console.log('Error playing sound:', error);
    }
  };

  const stopSound = async (name) => {
    try {
      if (soundObjects.current[name]) {
        await soundObjects.current[name].stopAsync();
        await soundObjects.current[name].unloadAsync();
        soundObjects.current[name] = null;
      }
    } catch (error) {
      console.log('Error stopping sound:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true })
      ]).start();
      loadUserAndChats();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true })
      ]).start();
    }
  }, [isOpen]);

  useEffect(() => {
    loadUserAndChats();
    
    let presenceChannel;
    let chatSub;
    let callSub;
    let currentUserId = null;

    const setupPresence = async (currentUser) => {
      presenceChannel = supabase.channel('online-users');
      
      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const online = {};
          Object.values(state).forEach(presences => {
            presences.forEach(p => {
              online[p.user_id] = true;
            });
          });
          setOnlineUsers(online);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({ user_id: currentUser.id });
          }
        });
    };

    const setupChatSubscription = async () => {
      const storedUser = await getStoredUser();
      if (!storedUser) return;
      
      currentUserId = storedUser.id;
      setUser(storedUser);
      setReadReceiptsEnabled(storedUser.read_receipts_enabled !== false);
      setupPresence(storedUser);

      chatSub = supabase
        .channel(`chat_messages_${storedUser.id}_${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rmessages' }, async (payload) => {
          const newMessage = payload.new;
          
          const { data: chatData } = await supabase
            .from('rchats')
            .select('user1_id, user2_id, is_group')
            .eq('id', newMessage.chat_id)
            .single();
          
          if (!chatData) return;
          
          let isMyChat = false;
          if (chatData.is_group) {
            const { data: memberData } = await supabase
              .from('rchat_members')
              .select('id')
              .eq('chat_id', newMessage.chat_id)
              .eq('user_id', currentUserId)
              .single();
            isMyChat = !!memberData;
          } else {
            isMyChat = chatData.user1_id === currentUserId || chatData.user2_id === currentUserId;
          }
          
          if (!isMyChat) return;
          
          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
          
          setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
          
          if (newMessage.sender_id !== currentUserId) {
            setIsVisible(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadUserAndChats();

            if (activeChatRef.current?.id === newMessage.chat_id) {
              markAllAsRead(newMessage.chat_id);
            }
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rmessages' }, (payload) => {
          setMessages(prev => prev.map(msg => msg.id === payload.new.id ? payload.new : msg));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rchats' }, () => {
          loadUserAndChats();
        })
        .subscribe();

      callSub = supabase
        .channel(`calls_${storedUser.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rcalls' }, async (payload) => {
          if (payload.eventType === 'INSERT') {
            const call = payload.new;
            if (call.caller_id !== currentUserId && call.status === 'ringing') {
              const { data: chatData } = await supabase
                .from('rchats')
                .select('*, user1:rusers!user1_id(*), user2:rusers!user2_id(*)')
                .eq('id', call.chat_id)
                .single();
              
              if (chatData) {
                const isMyChat = chatData.user1_id === currentUserId || chatData.user2_id === currentUserId;
                if (isMyChat) {
                  setActiveCall({ ...call, chat: chatData });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                }
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'ended' || payload.new.status === 'declined') {
              if (activeCall?.id === payload.new.id) {
                endCallUI();
              }
            } else if (payload.new.status === 'active' && activeCall?.id === payload.new.id) {
              setActiveCall(prev => ({ ...prev, status: 'active' }));
              startCallTimer();
            }
          }
        })
        .subscribe();
    };

    setupChatSubscription();

    return () => { 
      if (chatSub) supabase.removeChannel(chatSub); 
      if (presenceChannel) supabase.removeChannel(presenceChannel);
      if (callSub) supabase.removeChannel(callSub);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, []);

  const startCallTimer = () => {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const endCallUI = () => {
    setActiveCall(null);
    setCallToken(null);
    setIsMuted(false);
    setCallDuration(0);
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const markAllAsRead = async (chatId) => {
    if (!user) return;
    await supabase
      .from('rmessages')
      .update({ is_read: true })
      .eq('chat_id', chatId)
      .neq('sender_id', user.id);
  };

  const toggleReadReceipts = async (value) => {
    setReadReceiptsEnabled(value);
    await supabase.from('rusers').update({ read_receipts_enabled: value }).eq('id', user.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const loadUserAndChats = async () => {
    const storedUser = await getStoredUser();
    setUser(storedUser);
    if (!storedUser) return;

    const { data: regularChats } = await supabase
      .from('rchats')
      .select(`*, user1:rusers!user1_id(id, username, emoji_icon, avatar_url), user2:rusers!user2_id(id, username, emoji_icon, avatar_url)`)
      .or(`user1_id.eq.${storedUser.id},user2_id.eq.${storedUser.id}`)
      .eq('is_group', false)
      .order('last_message_at', { ascending: false });
    
    const { data: memberChats } = await supabase
      .from('rchat_members')
      .select('chat_id')
      .eq('user_id', storedUser.id);
    
    let groupChats = [];
    if (memberChats && memberChats.length > 0) {
      const groupChatIds = memberChats.map(m => m.chat_id);
      const { data: groupData } = await supabase
        .from('rchats')
        .select('*')
        .in('id', groupChatIds)
        .eq('is_group', true)
        .order('last_message_at', { ascending: false });
      
      if (groupData) {
        for (const gc of groupData) {
          const { data: members } = await supabase
            .from('rchat_members')
            .select('*, user:rusers(*)')
            .eq('chat_id', gc.id);
          gc.members = members || [];
        }
        groupChats = groupData;
      }
    }

    const allChats = [...(regularChats || []), ...groupChats];
    const filteredChats = allChats.filter(c => c.status !== 'rejected');

    const chatsWithUnread = await Promise.all(filteredChats.map(async (chat) => {
      const { count } = await supabase
        .from('rmessages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chat.id)
        .eq('is_read', false)
        .neq('sender_id', storedUser.id);
      return { ...chat, unread_count: count || 0 };
    }));
    
    chatsWithUnread.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    
    const total = chatsWithUnread.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    setTotalUnreadCount(total);
    setChats(chatsWithUnread);
  };

  const handleStatusUpdate = async (chatId, newStatus) => {
    try {
      await supabase.from('rchats').update({ status: newStatus }).eq('id', chatId);
      Haptics.notificationAsync(newStatus === 'accepted' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      if (newStatus === 'rejected') setActiveChat(null);
      loadUserAndChats();
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    if (activeChat?.id) {
      loadMessages(activeChat.id);
      markAllAsRead(activeChat.id);
      
      if (activeChat.is_group) {
        loadGroupMembers(activeChat.id);
      }
    }
  }, [activeChat?.id]);

  const loadGroupMembers = async (chatId) => {
    const { data } = await supabase
      .from('rchat_members')
      .select('*, user:rusers(*)')
      .eq('chat_id', chatId);
    setGroupMembers(data || []);
  };

  const loadMessages = async (chatId) => {
    if (!chatId) return;
    setLoading(true);
    const { data } = await supabase
      .from('rmessages')
      .select('*, sender:rusers(id, username, emoji_icon, avatar_url)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChat) return;
    const text = inputText.trim();
    setInputText('');
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { data } = await supabase
      .from('rmessages')
      .insert({
        chat_id: activeChat.id,
        sender_id: user.id,
        text
      }).select().single();

    if (data) {
      await supabase.from('rchats').update({
        last_message: text,
        last_message_at: new Date().toISOString()
      }).eq('id', activeChat.id);

      if (activeChat.is_group) {
        const otherMembers = groupMembers.filter(m => m.user_id !== user.id);
        for (const member of otherMembers) {
          await sendMessageNotification({
            senderId: user.id,
            receiverId: member.user_id,
            senderUsername: user.username,
            messageText: `[${activeChat.group_name}] ${text}`
          });
        }
      } else {
        const otherUser = getOtherUser(activeChat);
        if (otherUser) {
          await sendMessageNotification({
            senderId: user.id,
            receiverId: otherUser.id,
            senderUsername: user.username,
            messageText: text
          });
        }
      }
    }
  };

  const handleKeyPress = ({ nativeEvent }) => {
    if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
      nativeEvent.preventDefault?.();
      handleSendMessage();
      return true;
    }
  };

  const selectChat = (chat) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveChat(chat);
    setActiveChatId(chat.id);
    setShowChatList(false);
  };

  const toggleChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isOpen) {
      setShowChatList(true);
      setOpen();
    } else {
      setClose();
    }
  };

  const getOtherUser = (chat) => {
    if (!chat || !user) return null;
    return chat.user1_id === user.id ? chat.user2 : chat.user1;
  };

  const startCall = async (isGroupCall = false) => {
    if (!activeChat) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    const { data: call, error } = await supabase
      .from('rcalls')
      .insert({
        chat_id: activeChat.id,
        caller_id: user.id,
        status: 'ringing',
        call_type: 'audio',
        is_group_call: isGroupCall
      })
      .select()
      .single();

    if (call) {
      await supabase.from('rcall_participants').insert({
        call_id: call.id,
        user_id: user.id
      });

      setActiveCall({ ...call, chat: activeChat, isOutgoing: true });
      
      const token = await fetchCallToken(call.id);
      if (token) {
        setCallToken(token);
      } else {
        Alert.alert('Error', 'Failed to start call engine');
        endCall();
        return;
      }
      
      if (activeChat.is_group) {
        for (const member of groupMembers) {
          if (member.user_id !== user.id) {
            await sendNotification({
              userId: member.user_id,
              type: 'call',
              title: `${user.username} is calling`,
              content: `Incoming ${isGroupCall ? 'group ' : ''}audio call from ${activeChat.group_name}`,
              senderId: user.id
            });
          }
        }
      } else {
        const otherUser = getOtherUser(activeChat);
        if (otherUser) {
          await sendNotification({
            userId: otherUser.id,
            type: 'call',
            title: `${user.username} is calling`,
            content: 'Incoming audio call',
            senderId: user.id
          });
        }
      }
    }
  };

    const answerCall = async () => {
      if (!activeCall) return;
      
      const token = await fetchCallToken(activeCall.id);
      if (token) {
        setCallToken(token);
      } else {
        Alert.alert('Error', 'Failed to join call engine');
        declineCall();
        return;
      }

      await supabase.from('rcalls').update({ status: 'active' }).eq('id', activeCall.id);
    await supabase.from('rcall_participants').insert({
      call_id: activeCall.id,
      user_id: user.id
    });
    
    stopSound('ringing');
    playSound('connect');
    setActiveCall(prev => ({ ...prev, status: 'active' }));
    startCallTimer();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const declineCall = async () => {
    if (!activeCall) return;
    
    await supabase.from('rcalls').update({ 
      status: 'declined',
      ended_at: new Date().toISOString()
    }).eq('id', activeCall.id);
    
    stopSound('ringing');
    playSound('disconnect');
    endCallUI();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const endCall = async () => {
    if (!activeCall) return;
    
    await supabase.from('rcalls').update({ 
      status: 'ended',
      ended_at: new Date().toISOString()
    }).eq('id', activeCall.id);
    
    await supabase.from('rcall_participants').update({
      left_at: new Date().toISOString()
    }).eq('call_id', activeCall.id).eq('user_id', user.id);
    
    playSound('disconnect');
    endCallUI();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    playSound('mute');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const searchForUsers = async (query) => {
    if (!query.trim()) {
      setUserSearchResults([]);
      return;
    }
    
    const { data } = await supabase
      .from('rusers')
      .select('id, username, emoji_icon, avatar_url')
      .ilike('username', `%${query}%`)
      .neq('id', user.id)
      .limit(10);
    
    setUserSearchResults(data || []);
  };

  const createGroupChat = async () => {
    if (!groupName.trim() || selectedUsers.length < 2) {
      Alert.alert('Error', 'Please enter a group name and select at least 2 members');
      return;
    }

    const { data: chat, error } = await supabase
      .from('rchats')
      .insert({
        is_group: true,
        group_name: groupName.trim(),
        group_icon: '👥',
        status: 'accepted'
      })
      .select()
      .single();

    if (chat) {
      const members = [user.id, ...selectedUsers.map(u => u.id)];
      await supabase.from('rchat_members').insert(
        members.map((userId, index) => ({
          chat_id: chat.id,
          user_id: userId,
          is_admin: userId === user.id
        }))
      );

      setShowNewGroupModal(false);
      setGroupName('');
      setSelectedUsers([]);
      loadUserAndChats();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const toggleUserSelection = (selectedUser) => {
    if (selectedUsers.some(u => u.id === selectedUser.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== selectedUser.id));
    } else {
      setSelectedUsers([...selectedUsers, selectedUser]);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!user || (!isVisible && !isOpen)) return null;

  const hasUnread = totalUnreadCount > 0;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {!isOpen && isVisible && hasUnread && (
        <View style={styles.fixedBubbleContainer}>
          <View style={styles.bubbleContainer}>
            <TouchableOpacity onPress={toggleChat} activeOpacity={0.8}>
              <View style={[styles.bubble, styles.bubbleUnread]}>
                <MessageCircle color="#FFF" size={28} />
                <View style={styles.bubbleBadge}>
                  <Text style={styles.bubbleBadgeText}>{totalUnreadCount > 99 ? '99+' : totalUnreadCount}</Text>
                </View>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsVisible(false);
              }} 
              style={styles.closeBubbleBtn}
            >
              <X size={14} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      )}

        {activeCall && (
          <Modal visible={true} animationType="fade" transparent>
            <View style={styles.callOverlay}>
              <BlurView intensity={100} style={StyleSheet.absoluteFill} tint="dark" />
              
              {callToken && (
                <LiveKitRoom
                  serverUrl={process.env.EXPO_PUBLIC_LIVEKIT_URL}
                  token={callToken}
                  connect={true}
                  audio={true}
                  video={false}
                >
                  <LiveKitRoomContent />
                </LiveKitRoom>
              )}

              {/* Background decorative elements */}
            <View style={[styles.callBgCircle, { top: -100, left: -50, backgroundColor: theme.colors.primary + '20' }]} />
            <View style={[styles.callBgCircle, { bottom: -100, right: -50, backgroundColor: '#4ADE8020' }]} />

            <View style={styles.callContent}>
              <Animated.View style={[
                styles.callAvatarLarge,
                { transform: [{ scale: pulseAnim }] },
                activeCall.status === 'ringing' && styles.callAvatarRinging
              ]}>
                {activeCall.chat?.is_group ? (
                  <View style={styles.callEmojiBg}>
                    <Text style={styles.callEmoji}>{activeCall.chat.group_icon || '👥'}</Text>
                  </View>
                ) : getOtherUser(activeCall.chat)?.avatar_url ? (
                  <Image source={{ uri: getOtherUser(activeCall.chat).avatar_url }} style={styles.callAvatarImg} />
                ) : (
                  <View style={styles.callEmojiBg}>
                    <Text style={styles.callEmoji}>{getOtherUser(activeCall.chat)?.emoji_icon || '👤'}</Text>
                  </View>
                )}
              </Animated.View>

              <Text style={styles.callName}>
                {activeCall.chat?.is_group ? activeCall.chat.group_name : `@${getOtherUser(activeCall.chat)?.username}`}
              </Text>
              
              <View style={styles.callStatusContainer}>
                {activeCall.status === 'ringing' ? (
                  <Text style={styles.callStatusText}>
                    {activeCall.isOutgoing ? 'Calling...' : 'Incoming call'}
                  </Text>
                ) : (
                  <View style={styles.callDurationContainer}>
                    <View style={styles.activeDot} />
                    <Text style={styles.callDurationText}>{formatCallDuration(callDuration)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.callActions}>
                {activeCall.status === 'ringing' && !activeCall.isOutgoing ? (
                  <View style={styles.incomingActions}>
                    <TouchableOpacity onPress={declineCall} style={[styles.callBtn, styles.callBtnDecline]}>
                      <PhoneOffIcon size={32} color="#FFF" />
                      <Text style={styles.callBtnLabel}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={answerCall} style={[styles.callBtn, styles.callBtnAnswer]}>
                      <PhoneIcon size={32} color="#FFF" />
                      <Text style={styles.callBtnLabel}>Answer</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.activeActions}>
                    <TouchableOpacity onPress={toggleMute} style={[styles.callBtn, isMuted && styles.callBtnMuted]}>
                      <View style={styles.iconCircle}>
                        {isMuted ? <MicOff size={24} color="#FFF" /> : <Mic size={24} color="#FFF" />}
                      </View>
                      <Text style={styles.callBtnLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
                    </TouchableOpacity>
                    
                      <TouchableOpacity onPress={endCall} style={[styles.callBtn, styles.callBtnEnd]}>
                        <View style={[styles.iconCircle, { backgroundColor: '#EF4444' }]}>
                          <PhoneOffIcon size={28} color="#FFF" />
                        </View>
                        <Text style={styles.callBtnLabel}>End</Text>
                      </TouchableOpacity>
                    </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={showNewGroupModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Group Chat</Text>
              <TouchableOpacity onPress={() => setShowNewGroupModal(false)}>
                <X size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Group Name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={groupName}
              onChangeText={setGroupName}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Search users to add..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={searchUsers}
              onChangeText={(text) => {
                setSearchUsers(text);
                searchForUsers(text);
              }}
            />
            
            {selectedUsers.length > 0 && (
              <View style={styles.selectedUsers}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedUsers.map(u => (
                    <TouchableOpacity key={u.id} onPress={() => toggleUserSelection(u)} style={styles.selectedChip}>
                      <Text style={styles.selectedChipText}>@{u.username}</Text>
                      <X size={14} color="#000" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            
            <ScrollView style={styles.userSearchResults}>
              {userSearchResults.map(u => (
                <TouchableOpacity 
                  key={u.id} 
                  onPress={() => toggleUserSelection(u)}
                  style={[styles.userSearchItem, selectedUsers.some(s => s.id === u.id) && styles.userSearchItemSelected]}
                >
                  {u.avatar_url ? (
                    <Image source={{ uri: u.avatar_url }} style={styles.searchAvatar} />
                  ) : (
                    <View style={styles.searchEmojiBg}>
                      <Text style={styles.searchEmoji}>{u.emoji_icon || '👤'}</Text>
                    </View>
                  )}
                  <Text style={styles.searchUsername}>@{u.username}</Text>
                  {selectedUsers.some(s => s.id === u.id) && <Check size={20} color={theme.colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity 
              onPress={createGroupChat}
              style={[styles.createGroupBtn, (!groupName.trim() || selectedUsers.length < 2) && { opacity: 0.5 }]}
              disabled={!groupName.trim() || selectedUsers.length < 2}
            >
              <Text style={styles.createGroupBtnText}>Create Group ({selectedUsers.length + 1} members)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isOpen && (
        <Animated.View style={[styles.chatOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => setClose()}
          >
          </TouchableOpacity>
          
            <Animated.View style={[styles.chatWindow, { transform: [{ translateY: slideAnim }] }]}>
              <View style={styles.chatHeader}>

              {showSettings ? (
                <View style={styles.headerNav}>
                  <TouchableOpacity onPress={() => setShowSettings(false)} style={styles.iconBtn}>
                    <ChevronLeft size={24} color="#FFF" />
                  </TouchableOpacity>
                  <Text style={styles.headerTitle}>Settings</Text>
                </View>
              ) : showChatList ? (
                <View style={styles.headerNav}>
                  <Text style={styles.headerTitle}>Messages</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => setShowNewGroupModal(true)} style={styles.iconBtn}>
                      <Users size={20} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.iconBtn}>
                      <Settings size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.headerNav}>
                  <TouchableOpacity onPress={() => setShowChatList(true)} style={styles.iconBtn}>
                    <ChevronLeft size={24} color="#FFF" />
                  </TouchableOpacity>
                  {activeChat?.is_group ? (
                    <View style={styles.headerUserInfo}>
                      <View style={styles.headerEmojiBg}>
                        <Text style={styles.headerEmoji}>{activeChat.group_icon || '👥'}</Text>
                      </View>
                      <View>
                        <Text style={styles.headerTitle}>{activeChat.group_name}</Text>
                        <Text style={styles.onlineStatusText}>{groupMembers.length} members</Text>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.headerUserInfo}
                        onPress={() => {
                          const other = getOtherUser(activeChat);
                          if (other) {
                            setClose();
                            router.push(`/profile?username=${other.username}`);
                          }
                        }}
                      >
                        <View style={styles.avatarWrapper}>
                          {getOtherUser(activeChat)?.avatar_url ? (
                            <Image source={{ uri: getOtherUser(activeChat).avatar_url }} style={styles.headerAvatar} />
                          ) : (
                            <View style={styles.headerEmojiBg}>
                              <Text style={styles.headerEmoji}>{getOtherUser(activeChat)?.emoji_icon || "👤"}</Text>
                            </View>
                          )}
                          {onlineUsers[getOtherUser(activeChat)?.id] && <View style={styles.headerStatusDot} />}
                        </View>
                        <View>
                          <Text style={styles.headerTitle}>
                            @{getOtherUser(activeChat)?.username}
                          </Text>
                          <Text style={styles.onlineStatusText}>
                            {onlineUsers[getOtherUser(activeChat)?.id] ? 'Online' : 'Offline'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    {activeChat && (activeChat.status === 'accepted' || activeChat.is_group) && (
                      <TouchableOpacity onPress={() => startCall(activeChat.is_group)} style={styles.iconBtn}>
                        <Phone size={20} color="#FFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <TouchableOpacity onPress={() => setClose()} style={styles.iconBtn}>
                  <X size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

            {showSettings ? (
              <View style={styles.settingsContent}>
                <View style={styles.settingRow}>
                  <View>
                    <Text style={styles.settingLabel}>Read Receipts</Text>
                    <Text style={styles.settingDesc}>Allow others to see when you've read their messages</Text>
                  </View>
                  <Switch 
                    value={readReceiptsEnabled}
                    onValueChange={toggleReadReceipts}
                    trackColor={{ false: '#334155', true: theme.colors.primary }}
                  />
                </View>
              </View>
            ) : showChatList ? (
              <FlatList
                data={chats}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                  const isGroup = item.is_group;
                  const otherUser = !isGroup ? getOtherUser(item) : null;
                  const isOnline = !isGroup && onlineUsers[otherUser?.id];
                  const isPending = item.status === 'pending';
                  
                  return (
                    <TouchableOpacity onPress={() => selectChat(item)} style={styles.chatListItem}>
                      <View style={styles.avatarWrapper}>
                        {isGroup ? (
                          <View style={styles.listEmojiBg}>
                            <Text style={styles.listEmoji}>{item.group_icon || '👥'}</Text>
                          </View>
                        ) : otherUser?.avatar_url ? (
                          <Image source={{ uri: otherUser.avatar_url }} style={styles.listAvatar} />
                        ) : (
                          <View style={styles.listEmojiBg}>
                            <Text style={styles.listEmoji}>{otherUser?.emoji_icon || "👤"}</Text>
                          </View>
                        )}
                        {isOnline && <View style={styles.statusDot} />}
                      </View>
                      <View style={styles.chatInfo}>
                        <View style={styles.chatInfoTop}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.chatName}>
                              {isGroup ? item.group_name : `@${otherUser?.username}`}
                            </Text>
                            {isGroup && <Users size={12} color="rgba(255,255,255,0.4)" />}
                            {isPending && (
                              <View style={styles.pendingBadge}>
                                <Text style={styles.pendingBadgeText}>Request</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.chatTime}>
                            {item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={styles.chatLastMsg} numberOfLines={1}>{item.last_message}</Text>
                          {item.unread_count > 0 && (
                            <View style={styles.listUnreadBadge}>
                              <Text style={styles.listUnreadText}>{item.unread_count}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <MessageCircle size={48} color="rgba(255,255,255,0.1)" />
                    <Text style={styles.emptyText}>No messages yet</Text>
                  </View>
                }
              />
            ) : (
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color={theme.colors.primary} />
                  </View>
                ) : (
                  <>
                  <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => {
                      const isMyMessage = item.sender_id === user?.id;
                      return (
                        <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.theirMessage]}>
                          {activeChat?.is_group && !isMyMessage && (
                            <Text style={styles.senderName}>@{item.sender?.username}</Text>
                          )}
                          <Text style={[styles.messageText, { color: isMyMessage ? '#000' : '#FFF' }]}>
                            {item.text}
                          </Text>
                          <View style={styles.msgFooter}>
                            <Text style={[styles.msgTime, { color: isMyMessage ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }]}>
                              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            {isMyMessage && (
                              <View style={styles.readStatus}>
                                {item.is_read ? (
                                  <CheckCheck size={14} color="rgba(0,0,0,0.5)" />
                                ) : (
                                  <Check size={14} color="rgba(0,0,0,0.5)" />
                                )}
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    }}
                    style={styles.messagesList}
                    contentContainerStyle={{ padding: 16 }}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                  />
                  
                  {activeChat?.status === 'pending' && activeChat.initiated_by !== user?.id && !activeChat.is_group && (
                    <View style={styles.requestActions}>
                      <Text style={styles.requestText}>Do you want to let @{getOtherUser(activeChat)?.username} message you?</Text>
                      <View style={styles.requestButtons}>
                        <TouchableOpacity 
                          onPress={() => handleStatusUpdate(activeChat.id, 'rejected')} 
                          style={[styles.requestBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]}
                        >
                          <Text style={[styles.requestBtnText, { color: '#EF4444' }]}>Deny</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => handleStatusUpdate(activeChat.id, 'accepted')} 
                          style={[styles.requestBtn, { backgroundColor: theme.colors.primary }]}
                        >
                          <Text style={[styles.requestBtnText, { color: '#000' }]}>Approve</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  </>
                )}
                {(!activeChat || activeChat.status === 'accepted' || activeChat.initiated_by === user?.id || activeChat.is_group) && (
                  <View style={styles.inputContainer}>
                    <View style={styles.inputWrapper}>
                            <TextInput
                              style={styles.input}
                              placeholder={activeChat?.status === 'pending' && !activeChat?.is_group ? "Waiting for approval..." : "Type a message..."}
                              value={inputText}
                              onChangeText={setInputText}
                              onKeyPress={handleKeyPress}
                              onSubmitEditing={handleSendMessage}
                              placeholderTextColor="rgba(255,255,255,0.3)"
                              multiline
                              blurOnSubmit={false}
                              returnKeyType="send"
                              editable={activeChat?.status === 'accepted' || activeChat?.initiated_by === user?.id || activeChat?.is_group}
                            />
                      <TouchableOpacity 
                        onPress={handleSendMessage} 
                        style={[styles.sendBtn, (!inputText.trim() || (activeChat?.status === 'pending' && activeChat?.initiated_by === user?.id && !activeChat?.is_group)) && { opacity: 0.5 }]}
                        disabled={!inputText.trim() || (activeChat?.status === 'pending' && activeChat?.initiated_by === user?.id && !activeChat?.is_group)}
                      >
                        <LinearGradient
                          colors={[theme.colors.primary, '#4ADE80']}
                          style={styles.sendIconBg}
                        >
                          <Send size={18} color="#000" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </KeyboardAvoidingView>
            )}
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}
  
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  fixedBubbleContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  bubbleContainer: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  bubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
    bubbleUnread: {
      backgroundColor: '#EF4444',
      borderColor: '#EF4444',
    },
    bubbleBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: '#FFF',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#EF4444',
    },
    bubbleBadgeText: {
      color: '#EF4444',
      fontSize: 10,
      fontWeight: 'bold',
    },
  closeBubbleBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  chatOverlay: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  chatWindow: {
    flex: 1,
    backgroundColor: '#0F172A',
    width: width,
    height: height,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0F172A',
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerEmojiBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 22,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  onlineStatusText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -2,
  },
  headerStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  iconBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  settingsContent: {
    padding: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 16,
  },
  settingLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  settingDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    maxWidth: width * 0.6,
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  avatarWrapper: {
    position: 'relative',
  },
  listAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  listEmojiBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listEmoji: {
    fontSize: 28,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  chatInfo: {
    marginLeft: 16,
    flex: 1,
  },
  chatInfoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  chatTime: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
  },
  chatLastMsg: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    flex: 1,
  },
  listUnreadBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  listUnreadText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pendingBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: 'bold',
  },
  messagesList: {
    flex: 1,
  },
  messageBubble: {
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 22,
    marginBottom: 10,
    maxWidth: '85%',
    position: 'relative',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  msgTime: {
    fontSize: 10,
  },
  readStatus: {
    marginLeft: 2,
  },
  requestActions: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  requestText: {
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  requestButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  requestBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  requestBtnText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  inputContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    minHeight: 40,
    maxHeight: 100,
    paddingTop: 10,
    paddingBottom: 10,
  },
  sendBtn: {
    padding: 4,
  },
  sendIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  callOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  callBgCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  callContent: {
    alignItems: 'center',
    width: '100%',
    padding: 20,
  },
  callAvatarLarge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  callAvatarRinging: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  callAvatarImg: {
    width: 140,
    height: 140,
  },
  callEmojiBg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  callEmoji: {
    fontSize: 64,
  },
  callName: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  callStatusContainer: {
    marginBottom: 60,
    height: 30,
    justifyContent: 'center',
  },
  callStatusText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
  },
  callDurationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  callDurationText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  callActions: {
    width: '100%',
    paddingHorizontal: 20,
  },
  incomingActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  activeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
  },
  callBtn: {
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callBtnAnswer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  callBtnDecline: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  callBtnEnd: {
    alignItems: 'center',
    gap: 12,
  },
  callBtnMuted: {
    opacity: 0.8,
  },
  callBtnLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectedUsers: {
    marginBottom: 12,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 6,
  },
  selectedChipText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 13,
  },
  userSearchResults: {
    maxHeight: 200,
    marginBottom: 16,
  },
  userSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  userSearchItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  searchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  searchEmojiBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchEmoji: {
    fontSize: 20,
  },
  searchUsername: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  createGroupBtn: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createGroupBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
});
