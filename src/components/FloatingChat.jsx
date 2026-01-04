import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
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
import { MessageCircle, X, Send, ChevronLeft, MoreHorizontal, User, Users, Check, CheckCheck, Settings, Plus, UserPlus, Mic, MicOff, Phone as PhoneIcon, PhoneOff as PhoneOffIcon, PhoneIncoming, PhoneOutgoing, Phone, Volume2, VolumeX, Image as ImageIcon, Video as VideoIcon, Film, Play, Maximize2, Camera, Sparkles, Trash2, Square, Pause, LogOut, Flag, Edit, RefreshCw } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { supabase } from '../utils/supabase';
import { getStoredUser, isOnline } from '../utils/user';
import { theme } from '../utils/theme';
import { sendNotification, sendMessageNotification, sendCallNotification } from '../utils/notifications';
import { useChatStore, useAuthStore } from '../utils/auth';
import * as ImagePicker from 'expo-image-picker';
import { Video, useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Accelerometer } from 'expo-sensors';
import Constants from 'expo-constants';
import { File as FileSystemNext } from 'expo-file-system/next';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { expandImage } from '../utils/ai';
import Markdown from 'react-native-markdown-display';
const { width, height } = Dimensions.get('window');
const SOUNDS = {
  ringing: require('../../assets/sounds/ringtone.mp3'),
  connect: require('../../assets/sounds/alert.mp3'),
  disconnect: require('../../assets/sounds/alert.mp3'),
};
const EMOJIS = ['👥','🔥','🚀','🎮','🎵','📸','🎥','💬','✨','🧠','💡','🫶'];

const isExpoGo = Constants.appOwnership === 'expo';

let createAgoraRtcEngine, ChannelProfileType, ClientRoleType, AudioProfileType, AudioScenarioType;
if (!isExpoGo) {
  const agora = require('react-native-agora');
  createAgoraRtcEngine = agora.createAgoraRtcEngine;
  ChannelProfileType = agora.ChannelProfileType;
  ClientRoleType = agora.ClientRoleType;
  AudioProfileType = agora.AudioProfileType;
  AudioScenarioType = agora.AudioScenarioType;
}

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID;

// Helper for generating numeric UID from string hash
if (!String.prototype.hashCode) {
  String.prototype.hashCode = function() {
    let hash = 0;
    for (let i = 0; i < this.length; i++) {
      const char = this.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };
}

export default function FloatingChat() {
    const {
  isOpen,
  open: setOpen,
  close: setClose,
  activeChatId,
  setActiveChatId,
  pendingCallUserId,
} = useChatStore();
const { auth: user } = useAuthStore();
const [activeChat, setActiveChat] = useState(null);
const presenceChannelRef = useRef(null);
const { setAuth } = useAuthStore();
const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [chats, setChats] = useState([]);
  const [userNicknames, setUserNicknames] = useState({});
  const [showChatList, setShowChatList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
    const [showNewGroupModal, setShowNewGroupModal] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [groupIcon, setGroupIcon] = useState('👥');
    const [groupAvatarUrl, setGroupAvatarUrl] = useState(null);
    const [showGroupIconPicker, setShowGroupIconPicker] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recording, setRecording] = useState(null);
  const recordingTimerRef = useRef(null);


  const [searchUsers, setSearchUsers] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [pendingMedia, setPendingMedia] = useState(null);
  const [activeAudioUrl, setActiveAudioUrl] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [showMediaMenu, setShowMediaMenu] = useState(false);
    const [showNicknameModal, setShowNicknameModal] = useState(false);
    const [showGroupRenameModal, setShowGroupRenameModal] = useState(false);
    const [groupRenameValue, setGroupRenameValue] = useState('');
    const [nicknameToEdit, setNicknameToEdit] = useState(null);
  const [nicknameValue, setNicknameValue] = useState('');
  
    const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const [chatPresence, setChatPresence] = useState({});

  const [activeCall, setActiveCall] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(false);
    const [isNear, setIsNear] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef(null);
    const soundObjects = useRef({});
    const loadingSounds = useRef({});
    
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(height)).current;
    const flatListRef = useRef(null);
    const isSendingRef = useRef(false);
    const inputRef = useRef(null);
    const callSubRef = useRef(null);

    useEffect(() => {
      if (pendingCallUserId && user && chats.length > 0 && !activeCall) {
      const chat = chats.find(c => 
        !c.is_group && (c.user1_id === pendingCallUserId || c.user2_id === pendingCallUserId)
      );
      if (chat) {
        if (activeChatId !== chat.id) {
          setActiveChatId(chat.id);
        } else {
          // Chat already active, trigger call
          startCall();
          // Clear pending call so it doesn't trigger again
          useChatStore.setState({ pendingCallUserId: null });
        }
      }
    }
  }, [pendingCallUserId, user, chats, activeChatId, activeCall]);
useEffect(() => {
  if (!user) return;

  const channel = supabase.channel(`online-users:${Constants.expoConfig?.slug || 'app'}`, {
  config: {
    presence: {
      key: user.id,
    },
  },
});


  // Store ref so we can clean up on logout too
  presenceChannelRef.current = channel;

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const onlineMap = {};

      Object.keys(state).forEach((userId) => {
        onlineMap[userId] = true;
      });

      setOnlineUsers(onlineMap);
    })
    .on('presence', { event: 'join' }, ({ key }) => {
      setOnlineUsers((prev) => ({
        ...prev,
        [key]: true,
      }));
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      setOnlineUsers((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Presence track failed:', e);
        }
      }
    });

  return () => {
    // Safe cleanup — prevents ghost users
    if (channel && channel.state === 'joined') {
      try {
        channel.untrack();
      } catch (e) {
        // already untracked or channel closing
      }
    }

    supabase.removeChannel(channel);

    if (presenceChannelRef.current === channel) {
      presenceChannelRef.current = null;
    }
  };
}, [user]);

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

  
    useEffect(() => {
      if (isOpen) {
        loadUserAndChats();
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: height,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [isOpen]);
    
    const playSound = async (type) => {
      try {
        // If already loading this sound, don't start another one
        if (loadingSounds.current[type]) return;

        // If sound already exists, stop and unload it first
        if (soundObjects.current[type]) {
          try {
            await soundObjects.current[type].stopAsync();
            await soundObjects.current[type].unloadAsync();
          } catch (e) {
            console.warn(`Error cleaning up sound ${type} before replay:`, e);
          }
          delete soundObjects.current[type];
        }

        loadingSounds.current[type] = true;
        const { sound } = await Audio.Sound.createAsync(
          SOUNDS[type],
          { shouldPlay: true, isLooping: type === 'ringing' }
        );
        soundObjects.current[type] = sound;
        delete loadingSounds.current[type];
      } catch (error) {
        delete loadingSounds.current[type];
        console.error('Error playing sound:', error);
      }
    };

    const stopSound = async (type) => {
      try {
        if (soundObjects.current[type]) {
          const sound = soundObjects.current[type];
          delete soundObjects.current[type]; // Delete reference first to prevent race conditions
          await sound.stopAsync();
          await sound.unloadAsync();
        }
      } catch (error) {
        console.error('Error stopping sound:', error);
      }
    };

    // Stop all sounds on unmount
    useEffect(() => {
      return () => {
        const types = Object.keys(soundObjects.current);
        types.forEach(type => {
          stopSound(type).catch(err => console.warn(`Error stopping sound ${type} on unmount:`, err));
        });
      };
    }, []);

    const startCallTimer = () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    };

    useEffect(() => {
      if (activeCall?.status === 'ringing') {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      } else {
        pulseAnim.setValue(1);
      }
    }, [activeCall?.status]);

    useEffect(() => {
      if (!user) return;

      const channel = supabase
        .channel('rcalls')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'rcalls',
          },
          async (payload) => {
            if (payload.new.caller_id !== user.id) {
              const { data: participants } = await supabase
                .from('rcall_participants')
                .select('*')
                .eq('call_id', payload.new.id);
              
              const isParticipant = payload.new.is_group_call 
                ? (await supabase.from('rchat_members').select('*').eq('chat_id', payload.new.chat_id).eq('user_id', user.id)).data?.length > 0
                : payload.new.caller_id !== user.id;

              if (isParticipant) {
                const { data: chat } = await supabase
                  .from('rchats')
                  .select(`*, user1:rusers!user1_id(id, username, emoji_icon, avatar_url), user2:rusers!user2_id(id, username, emoji_icon, avatar_url)`)
                  .eq('id', payload.new.chat_id)
                  .single();
                
                setActiveCall({ ...payload.new, chat, isOutgoing: false });
                playSound('ringing');
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rcalls',
          },
          (payload) => {
            if (activeCall && activeCall.id === payload.new.id) {
              if (payload.new.status === 'ended' || payload.new.status === 'declined') {
                stopSound('ringing');
                playSound('disconnect');
                endCallUI();
              } else if (payload.new.status === 'active') {
                stopSound('ringing');
                if (activeCall.status !== 'active') {
                  playSound('connect');
                  startCallTimer();
                }
                setActiveCall(prev => ({ ...prev, ...payload.new }));
              }
            }
          }
        )
        .subscribe();

      callSubRef.current = channel;

      return () => {
        if (callSubRef.current) {
          supabase.removeChannel(callSubRef.current);
        }
      };
    }, [user, activeCall?.id]);

      const endCallUI = () => {
        stopSound('ringing');
        setActiveCall(null);
        setIsMuted(false);
        setCallDuration(0);
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current);
          callTimerRef.current = null;
        }
        
        // Reset audio mode
        Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: true,
        }).catch(err => console.error('Error resetting audio mode:', err));

        loadUserAndChats();
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

    useEffect(() => {
      // Initialize audio mode to use speaker
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      }).catch(err => console.error('Error initializing audio mode:', err));

      loadUserAndChats();
      
const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    if (presenceChannelRef.current) {
      try {
        presenceChannelRef.current.untrack();
      } catch (e) {}

      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    setOnlineUsers({});
  }

  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
    loadUserAndChats();
  }
});


    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loadUserAndChats = async () => {
    const storedUser = await getStoredUser();
    setAuth(storedUser);
    if (!storedUser) return;

    const { data: regularChats } = await supabase
      .from('rchats')
      .select(`*, user1:rusers!user1_id(id, username, emoji_icon, avatar_url, last_seen), user2:rusers!user2_id(id, username, emoji_icon, avatar_url, last_seen)`)
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

    // Fetch nicknames for the current user
    const { data: nicknamesData } = await supabase
      .from('rnicknames')
      .select('user_id, nickname')
      .eq('created_by', storedUser.id);
    
    const nicknameMap = {};
    if (nicknamesData) {
      nicknamesData.forEach(n => {
        nicknameMap[n.user_id] = n.nickname;
      });
    }
    setUserNicknames(nicknameMap);

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

  const handleRefreshChats = async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadUserAndChats();
    setIsRefreshing(false);
  };

  const handleStatusUpdate = async (chatId, newStatus) => {
    try {
      await supabase.from('rchats').update({ status: newStatus }).eq('id', chatId);
      Haptics.notificationAsync(newStatus === 'accepted' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      
      if (newStatus === 'rejected') {
        setActiveChat(null);
      } else if (newStatus === 'accepted' && activeChat?.id === chatId) {
        setActiveChat(prev => ({ ...prev, status: 'accepted' }));
      }
      
      loadUserAndChats();
    } catch (error) { console.error(error); }
  };

  const messageChannelRef = useRef(null);

  useEffect(() => {
    if (activeChat?.id) {
      loadMessages(activeChat.id, activeChat.is_group);
      markAllAsRead(activeChat.id);
      
      if (activeChat.is_group) {
        loadGroupMembers(activeChat.id);
      }

      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
      }

      const channel = supabase
        .channel(`chat-messages-${activeChat.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'rmessages',
            filter: `chat_id=eq.${activeChat.id}`,
          },
          async (payload) => {
            const newMsg = payload.new;
            if (newMsg.sender_id !== user?.id) {
                const { data: msgWithSender } = await supabase
                  .from('rmessages')
                  .select('*, sender:rusers(id, username, emoji_icon, avatar_url)')
                  .eq('id', newMsg.id)
                  .single();
              
              if (msgWithSender) {
                setMessages(prev => [...prev, msgWithSender]);
                setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
                markAllAsRead(activeChat.id);
              }
            }
          }
        )
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const pMap = {};
          Object.keys(state).forEach(uid => {
            if (uid !== user.id) {
              pMap[uid] = state[uid][0];
            }
          });
          setChatPresence(pMap);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              user_id: user.id,
              is_typing: false,
              is_recording: false,
            });
          }
        });

      messageChannelRef.current = channel;
    }

    return () => {
      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }
    };
  }, [activeChat?.id, user?.id]);

  useEffect(() => {
    if (!messageChannelRef.current || !user) return;

    messageChannelRef.current.track({
      user_id: user.id,
      is_typing: isTyping,
      is_recording: isRecording,
    });
  }, [isTyping, isRecording]);

  const handleInputChange = (text) => {
    setInputText(text);
    
    if (text.trim().length > 0) {
      if (!isTyping) setIsTyping(true);
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 2000);
    } else {
      if (isTyping) setIsTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const PresenceIndicator = () => {
    const presenceArray = Object.values(chatPresence);
    const typingUsers = presenceArray.filter(p => p.is_typing);
    const recordingUsers = presenceArray.filter(p => p.is_recording);

    if (typingUsers.length === 0 && recordingUsers.length === 0) return null;

    const getUsername = (uid) => {
      if (activeChat?.is_group) {
        return groupMembers.find(m => m.user_id === uid)?.user?.username || 'Someone';
      } else {
        const other = getOtherUser(activeChat);
        return other?.username || 'Someone';
      }
    };

    let text = '';
    if (recordingUsers.length > 0) {
      const names = recordingUsers.map(u => getUsername(u.user_id));
      text = `${names.join(', ')} ${names.length > 1 ? 'are' : 'is'} recording audio...`;
    } else if (typingUsers.length > 0) {
      const names = typingUsers.map(u => getUsername(u.user_id));
      text = `${names.join(', ')} ${names.length > 1 ? 'are' : 'is'} typing...`;
    }

    return (
      <View style={styles.presenceIndicator}>
        <Text style={styles.presenceIndicatorText}>{text}</Text>
      </View>
    );
  };

  const loadGroupMembers = async (chatId) => {
    const { data } = await supabase
      .from('rchat_members')
      .select('*, user:rusers(*)')
      .eq('chat_id', chatId);
    setGroupMembers(data || []);
  };

    const handleGroupRename = async () => {
      const newName = groupRenameValue.trim();
      if (newName && activeChat) {
        try {
          await supabase.from('rchats').update({ group_name: newName }).eq('id', activeChat.id);
          setActiveChat(prev => ({ ...prev, group_name: newName }));
          setShowGroupRenameModal(false);
          loadUserAndChats();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          console.error('Error renaming group:', error);
          Alert.alert('Error', 'Failed to rename group');
        }
      }
    };

    const handleSaveNickname = async () => {
    if (!nicknameToEdit || !user) return;
    
    try {
      const nickname = nicknameValue.trim();
      if (nickname === '') {
        await supabase.from('rnicknames').delete().eq('user_id', nicknameToEdit.id).eq('created_by', user.id);
      } else {
        await supabase.from('rnicknames').upsert({
          user_id: nicknameToEdit.id,
          created_by: user.id,
          nickname: nickname
        });
      }
      setShowNicknameModal(false);
      loadUserAndChats();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error setting nickname:', err);
      Alert.alert('Error', 'Failed to save nickname');
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeChat?.is_group || !user) return;
    
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${activeChat.group_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('rchat_members')
                .delete()
                .eq('chat_id', activeChat.id)
                .eq('user_id', user.id);

                  await supabase.from('rmessages').insert({
                    chat_id: activeChat.id,
                    sender_id: user.id,
                    text: `${user.username || 'Someone'} left the group`,
                    is_system: true
                  });

              await supabase.from('rchats').update({
                last_message: `${user.username || 'Someone'} left the group`,
                last_message_at: new Date().toISOString()
              }).eq('id', activeChat.id);

              setShowGroupInfo(false);
              setActiveChat(null);
              setShowChatList(true);
              loadUserAndChats();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Error leaving group:', error);
              Alert.alert('Error', 'Failed to leave group');
            }
          }
        }
      ]
    );
  };

  const handleReportChat = async () => {
    Alert.alert(
      'Report Chat',
      'Are you sure you want to report this chat for inappropriate content?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('rreports').insert({
                reporter_id: user.id,
                chat_id: activeChat.id,
                report_type: 'chat',
                reason: 'User reported via chat'
              });
              setShowGroupInfo(false);
              Alert.alert('Reported', 'Thank you for your report. We will review it shortly.');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Error reporting chat:', error);
              Alert.alert('Error', 'Failed to submit report');
            }
          }
        }
      ]
    );
  };

  const loadMessages = async (chatId, isGroup = false) => {
    if (!chatId) return;
    setLoading(true);
    
    let query = supabase
      .from('rmessages')
      .select('*, sender:rusers(id, username, emoji_icon, avatar_url)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    
    if (isGroup && user?.id) {
      const { data: memberData } = await supabase
        .from('rchat_members')
        .select('created_at')
        .eq('chat_id', chatId)
        .eq('user_id', user.id)
        .single();
      
      if (memberData?.created_at) {
        query = query.gte('created_at', memberData.created_at);
      }
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Error loading messages:', error);
    }
    setMessages(data || []);
    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission denied', 'Please allow microphone access to record voice messages.');
        return;
      }
   // Guard FIRST — prevents double recording
if (isRecording || recordingTimerRef.current) return;
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: true,
        });

 

const { recording } = await Audio.Recording.createAsync(
  Audio.RecordingOptionsPresets.HIGH_QUALITY
);

setRecording(recording);
setIsRecording(true);
setRecordingDuration(0);


recordingTimerRef.current = setInterval(() => {
  setRecordingDuration(prev => {
    if (prev >= 150) {
      stopRecording();
      return prev;
    }
    return prev + 1;
  });
}, 1000);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

const stopRecording = async () => {
  setIsRecording(false);

  if (recordingTimerRef.current) {
    clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }

  if (!recording) return;

  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    // Reset audio mode to playback-only (speaker)
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setIsUploading(true);
    const audioUrl = await uploadMedia(uri, 'audio');
    if (audioUrl) {
      await handleSendMessage(null, audioUrl, 'audio');
    }
  } catch (err) {
    console.error('Failed to stop recording', err);
  } finally {
    setIsUploading(false);
  }
};


 const cancelRecording = async () => {
  setIsRecording(false);

  if (recordingTimerRef.current) {
    clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }

  if (!recording) return;

  try {
    await recording.stopAndUnloadAsync();
    setRecording(null);

    // Reset audio mode to playback-only (speaker)
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (err) {
    console.error('Failed to cancel recording', err);
  }
};


    const uploadMedia = async (uri, type) => {
      try {
        const file = new FileSystemNext(uri);
        const bytes = await file.bytes();
        const extension = type === 'video' ? 'mp4' : (type === 'audio' ? 'm4a' : 'jpg');
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
        const filePath = `${user.id}/${fileName}`;

        const { data, error } = await supabase.storage
          .from('chat_media')
          .upload(filePath, bytes, {
            contentType: type === 'video' ? 'video/mp4' : (type === 'audio' ? 'audio/m4a' : 'image/jpeg'),
            cacheControl: '3600'
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('chat_media')
          .getPublicUrl(filePath);

        return publicUrl;
      } catch (error) {
        console.error('Error uploading media:', error);
        Alert.alert('Upload Error', 'Failed to upload media. Please try again.');
        return null;
      }
    };

  const handlePickMedia = async (type) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled) {
        setPendingMedia({ uri: result.assets[0].uri, type });
      }
    } catch (error) {
      console.error('Error picking media:', error);
    }
  };

    const handleExpandImage = async () => {
    if (!fullscreenMedia || fullscreenMedia.type !== 'image' || isExpanding) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsExpanding(true);
    
    try {
      const expandedUrl = await expandImage(fullscreenMedia.url);
      if (expandedUrl) {
        await handleSendMessage("I expanded this for you!", expandedUrl, 'image');
        setFullscreenMedia(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', 'Failed to expand image.');
      }
    } catch (error) {
      console.error('Expansion error:', error);
      Alert.alert('Error', 'An error occurred during expansion.');
    } finally {
      setIsExpanding(false);
    }
  };

  const handleSendMessage = async (textOverride = null, mediaUrl = null, mediaType = null) => {
    const text = textOverride !== null ? textOverride : inputText.trim();
    
    let finalMediaUrl = mediaUrl;
    let finalMediaType = mediaType;

    // If we have pending media and no explicit media was passed
    if (!finalMediaUrl && pendingMedia) {
      setIsUploading(true);
      finalMediaUrl = await uploadMedia(pendingMedia.uri, pendingMedia.type);
      finalMediaType = pendingMedia.type;
      setPendingMedia(null);
      setIsUploading(false);
    }

    if (!text && !finalMediaUrl || !activeChat || isSendingRef.current) return;
    
    // Clear immediately to prevent double-send and show responsiveness
    if (!mediaUrl && !pendingMedia) {
      isSendingRef.current = true;
      setInputText('');
      if (inputRef.current) {
        inputRef.current.clear();
        // Force clear for native
        if (Platform.OS !== 'web') {
          inputRef.current.setNativeProps({ text: '' });
        }
      }
    } else if (pendingMedia) {
      // Clear input if sending with media
      setInputText('');
      if (inputRef.current) inputRef.current.clear();
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
          const { data, error } = await supabase
            .from('rmessages')
            .insert({
              chat_id: activeChat.id,
              sender_id: user.id,
              text: text || '',
              media_url: finalMediaUrl,
              media_type: finalMediaType
            }).select('*, sender:rusers(id, username, emoji_icon, avatar_url)').single();

        if (error) throw error;

          if (data) {
            setMessages(prev => [...prev, data]);
            setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
          const mediaPrefix = (finalMediaType === 'audio' || finalMediaType === 'image') ? 'an' : 'a';
          const mediaMessageText = `Sent ${mediaPrefix} ${finalMediaType}`;

          const newLastMessage = finalMediaUrl ? mediaMessageText : text;
            const newLastMessageAt = new Date().toISOString();
            
            await supabase.from('rchats').update({
              last_message: newLastMessage,
              last_message_at: newLastMessageAt
            }).eq('id', activeChat.id);
            
            setChats(prevChats => {
              const updated = prevChats.map(c => 
                c.id === activeChat.id 
                  ? { ...c, last_message: newLastMessage, last_message_at: newLastMessageAt }
                  : c
              );
              return updated.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
            });

          const notificationText = finalMediaUrl ? mediaMessageText : text;

        if (activeChat.is_group) {
          const otherMembers = groupMembers.filter(m => m.user_id !== user.id);
          for (const member of otherMembers) {
            await sendMessageNotification({
              senderId: user.id,
              receiverId: member.user_id,
              senderUsername: user.username,
              messageText: `[${activeChat.group_name}] ${notificationText}`
            });
          }
        } else {
          const otherUser = getOtherUser(activeChat);
          if (otherUser) {
            await sendMessageNotification({
              senderId: user.id,
              receiverId: otherUser.id,
              senderUsername: user.username,
              messageText: notificationText
            });
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      if (!mediaUrl) {
        isSendingRef.current = false;
      }
    }
  };

    const handleKeyPress = (e) => {
      if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
        if (Platform.OS === 'web') {
          e.preventDefault();
        }
        handleSendMessage();
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
      const otherUser = chat.user1_id === user.id ? chat.user2 : chat.user1;
      if (otherUser && userNicknames[otherUser.id]) {
        return { ...otherUser, nickname: userNicknames[otherUser.id] };
      }
      return otherUser;
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
      
      if (activeChat.is_group) {
          for (const member of groupMembers) {
            if (member.user_id !== user.id) {
              await sendCallNotification({
                callerId: user.id,
                callerUsername: user.username,
                receiverId: member.user_id,
                callId: call.id,
                chatId: activeChat.id
              });
            }
          }
        } else {
          const otherUser = getOtherUser(activeChat);
          if (otherUser) {
            await sendCallNotification({
              callerId: user.id,
              callerUsername: user.username,
              receiverId: otherUser.id,
              callId: call.id,
              chatId: activeChat.id
            });
          }
        }
    }
  };

    const agoraEngine = useRef(null);
    const [isJoined, setIsJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [remoteUsers, setRemoteUsers] = useState([]);
    const [debugStatus, setDebugStatus] = useState('');

    // Refs to avoid stale closures in event handlers
    const isMutedRef = useRef(isMuted);
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

    const setupAgora = async () => {
      if (isExpoGo || !user?.id || !activeCall?.id) {
        console.log('Agora setup skipped: Expo Go or No user/call ID');
        return;
      }
      
      try {
        setIsJoining(true);
        setDebugStatus('Requesting permissions...');
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          setDebugStatus('Permission denied');
          Alert.alert('Permission Denied', 'Microphone access is required for calls.');
          setIsJoining(false);
          return;
        }

        if (!agoraEngine.current) {
          setDebugStatus('Initializing engine...');
          agoraEngine.current = createAgoraRtcEngine();
          agoraEngine.current.initialize({
            appId: AGORA_APP_ID,
            channelProfile: ChannelProfileType.ChannelProfileCommunication,
          });

          agoraEngine.current.registerEventHandler({
            onJoinChannelSuccess: (connection, elapsed) => {
              console.log('[DEBUG-CALL] Successfully joined channel:', connection.channelId, 'UID:', connection.localUid);
              setIsJoined(true);
              setIsJoining(false);
              setDebugStatus('Joined successfully');
              
              // Apply initial mute state
              if (agoraEngine.current) {
                agoraEngine.current.muteLocalAudioStream(isMutedRef.current);
              }
            },
            onUserJoined: (connection, remoteUid) => {
              console.log('[DEBUG-CALL] Remote user joined:', remoteUid);
              setRemoteUsers(prev => [...prev, remoteUid]);
              if (agoraEngine.current) {
                agoraEngine.current.muteRemoteAudioStream(remoteUid, false);
              }
            },
            onUserOffline: (connection, remoteUid) => {
              console.log('[DEBUG-CALL] Remote user offline:', remoteUid);
              setRemoteUsers(prev => prev.filter(id => id !== remoteUid));
            },
            onLeaveChannel: (connection, stats) => {
              console.log('[DEBUG-CALL] Left channel');
              setIsJoined(false);
              setIsJoining(false);
              setRemoteUsers([]);
              setDebugStatus('Left channel');
            },
            onError: (err, msg) => {
              console.error('[DEBUG-CALL] Agora Error:', err, msg);
              setDebugStatus(`Error: ${err}`);
            }
          });
        }

        setDebugStatus('Configuring audio...');
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: true,
          shouldRouteAudioToReceiverIOS: false,
          interruptionModeIOS: 1, // DoNotMix
          interruptionModeAndroid: 1, // DoNotMix
        });

        await agoraEngine.current.enableAudio();
        await agoraEngine.current.setEnableSpeakerphone(true);
        await agoraEngine.current.setDefaultAudioRouteToSpeakerphone(true);
        
        // Use Communication profile settings
        await agoraEngine.current.setAudioProfile(
          AudioProfileType.AudioProfileDefault,
          AudioScenarioType.AudioScenarioDefault
        );
        
        setDebugStatus('Fetching token...');
        const uid = hashCode(user.id) % 1000000;
        const { data, error } = await supabase.functions.invoke('agora-token', {
          body: {
            channelName: activeCall.id,
            uid: uid,
            role: 'publisher'
          }
        });

        if (error || !data?.token) {
          console.error('Token error:', error || 'No token');
          setDebugStatus('Token failed');
          Alert.alert('Call Error', 'Failed to secure call connection.');
          setIsJoining(false);
          return;
        }

        setDebugStatus('Joining channel...');
        await agoraEngine.current.joinChannel(data.token, activeCall.id, uid, {});
      } catch (e) {
        console.error('Agora setup error:', e);
        setDebugStatus('Setup failed');
        setIsJoining(false);
      }
    };

    const hashCode = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    };


    const leaveAgora = async () => {
      if (isExpoGo) return;
      try {
        if (agoraEngine.current) {
       await agoraEngine.current.disableAudio();
await agoraEngine.current.leaveChannel();
await agoraEngine.current.release();
agoraEngine.current = null;

        }
      } catch (e) {
        console.error('Agora leave error:', e);
      }
    };

    const answerCall = async () => {
      if (!activeCall) return;
      
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
    
    // Send system message
    await supabase.from('rmessages').insert({
      chat_id: activeCall.chat_id,
      sender_id: user.id,
      text: 'Missed call',
      is_system: true
    });

    await supabase.from('rchats').update({
      last_message: 'Missed call',
      last_message_at: new Date().toISOString()
    }).eq('id', activeCall.chat_id);

    stopSound('ringing');
    playSound('disconnect');
    endCallUI();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const endCall = async () => {
    if (!activeCall) return;
    
    const wasActive = activeCall.status === 'active';
    const durationText = formatCallDuration(callDuration);
    
    await supabase.from('rcalls').update({ 
      status: 'ended',
      ended_at: new Date().toISOString()
    }).eq('id', activeCall.id);
    
    await supabase.from('rcall_participants').update({
      left_at: new Date().toISOString()
    }).eq('call_id', activeCall.id).eq('user_id', user.id);

    // Send system message
    await supabase.from('rmessages').insert({
      chat_id: activeCall.chat_id,
      sender_id: user.id,
      text: wasActive ? `Voice call ${durationText}` : 'Missed call',
      is_system: true
    });

    await supabase.from('rchats').update({
      last_message: wasActive ? `Voice call ${durationText}` : 'Missed call',
      last_message_at: new Date().toISOString()
    }).eq('id', activeCall.chat_id);
    
    endCallUI();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const toggleMute = () => {
  const next = !isMuted;
  setIsMuted(next);

 if (agoraEngine.current && isJoined) {
  agoraEngine.current.muteLocalAudioStream(next);
}


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

  const handleSelectGroupEmoji = (emoji) => {
    setGroupIcon(emoji);
    setGroupAvatarUrl(null);
    setShowGroupIconPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

    const handlePickGroupAvatar = async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        try {
          const image = result.assets[0];
          const fileName = `group_avatar_${Date.now()}.jpg`;
          const file = new FileSystemNext(image.uri);
          const bytes = await file.bytes();
          await supabase.storage.from('avatars').upload(fileName, bytes, { contentType: 'image/jpeg', upsert: true });
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
          
          setGroupAvatarUrl(publicUrl);
          setGroupIcon(null);
          setShowGroupIconPicker(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
          console.error('Error uploading group avatar:', error);
          Alert.alert('Error', 'Failed to upload avatar');
        }
      }
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
        group_icon: groupAvatarUrl || groupIcon || '👥',
        status: 'accepted',
        owner_id: user.id
      })
      .select()
      .single();

    if (chat) {
      const members = [user.id, ...selectedUsers.map(u => u.id)];
      await supabase.from('rchat_members').insert(
        members.map((userId, index) => ({
          chat_id: chat.id,
          user_id: userId,
          is_admin: userId === user.id,
          is_owner: userId === user.id
        }))
      );

        await supabase.from('rmessages').insert({
          chat_id: chat.id,
          sender_id: user.id,
          text: `${user.username || 'Someone'} created the group`,
          is_system: true
        });

      await supabase.from('rchats').update({
        last_message: `${user.username || 'Someone'} created the group`,
        last_message_at: new Date().toISOString()
      }).eq('id', chat.id);

      setShowNewGroupModal(false);
      setGroupName('');
      setGroupIcon('👥');
      setGroupAvatarUrl(null);
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

        const FullscreenMediaModal = () => {
          if (!fullscreenMedia) return null;
          
          return (
            <Modal visible={true} transparent animationType="fade">
              <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill}>
                <View style={styles.fullscreenHeader}>
                  <TouchableOpacity 
                    style={styles.fullscreenIconBtn} 
                    onPress={() => setFullscreenMedia(null)}
                  >
                    <X size={28} color="#FFF" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.fullscreenContent}>
                  {fullscreenMedia.type === 'video' ? (
                    <FullscreenVideoPlayer url={fullscreenMedia.url} />
                  ) : (
                    <Image 
                      source={{ uri: fullscreenMedia.url }} 
                      style={styles.fullscreenImage} 
                      contentFit="contain"
                    />
                  )}
                </View>
              </BlurView>
            </Modal>
          );
        };
        FullscreenMediaModal.displayName = 'FullscreenMediaModal';

    const MediaPreview = ({ url, type, isMyMessage }) => {
      if (type === 'audio') {
        return <AudioPlayer url={url} isMyMessage={isMyMessage} />;
      }

      return (
        <TouchableOpacity 
          style={styles.mediaPreviewContainer}
          onPress={() => setFullscreenMedia({ url, type })}
          activeOpacity={0.9}
        >
          {type === 'video' ? (
            <VideoPreview url={url} isMyMessage={isMyMessage} />
          ) : (
            <Image source={{ uri: url }} style={styles.mediaPreview} contentFit="cover" />
          )}
        </TouchableOpacity>
      );
    };
    MediaPreview.displayName = 'MediaPreview';

  const FullscreenVideoPlayer = ({ url }) => {
    const player = useVideoPlayer(url, (player) => {
      player.loop = true;
      player.play();
    });

    return (
      <VideoView
        style={styles.fullscreenVideo}
        player={player}
        allowsFullscreen
        allowsPictureInPicture
      />
    );
  };

  const VideoPreview = ({ url }) => {
    const player = useVideoPlayer(url, (player) => {
      player.muted = true;
      player.loop = true;
      player.play();
    });

    return (
      <View style={styles.videoPreviewWrapper}>
        <VideoView
          style={styles.mediaPreview}
          player={player}
          contentFit="cover"
          nativeControls={false}
        />
        <View style={styles.videoOverlay}>
          <Play size={24} color="#FFF" fill="#FFF" />
        </View>
      </View>
    );
  };

  const AudioPlayer = ({ url, isMyMessage }) => {
    const player = useAudioPlayer(url);
    const status = useAudioPlayerStatus(player);

    useEffect(() => {
      if (activeAudioUrl && activeAudioUrl !== url && status.playing) {
        player.pause();
      }
    }, [activeAudioUrl, status.playing]);

    useEffect(() => {
      if (status.finished && activeAudioUrl === url) {
        setActiveAudioUrl(null);
      }
    }, [status.finished]);
    
    const togglePlayback = () => {
      if (status.playing) {
        player.pause();
      } else {
        setActiveAudioUrl(url);
        player.play();
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const formatTime = (ms) => {
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
      <View style={[styles.audioPlayer, { backgroundColor: isMyMessage ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]}>
        <TouchableOpacity onPress={togglePlayback} style={styles.audioPlayBtn}>
          {status.playing ? (
            <Pause size={20} color={isMyMessage ? "#000" : "#FFF"} fill={isMyMessage ? "#000" : "#FFF"} />
          ) : (
            <Play size={20} color={isMyMessage ? "#000" : "#FFF"} fill={isMyMessage ? "#000" : "#FFF"} />
          )}
        </TouchableOpacity>
        
        <Slider
          style={styles.audioSlider}
          minimumValue={0}
          maximumValue={status.duration || 1}
          value={status.currentTime || 0}
          onSlidingComplete={(value) => player.seekTo(value)}
          minimumTrackTintColor={isMyMessage ? "#000" : theme.colors.primary}
          maximumTrackTintColor={isMyMessage ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)"}
          thumbTintColor={isMyMessage ? "#000" : theme.colors.primary}
        />
        
        <Text style={[styles.audioTime, { color: isMyMessage ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' }]}>
          {formatTime(status.currentTime || 0)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
        <FullscreenMediaModal />
        {!isOpen && isVisible && (
          <View style={styles.fixedBubbleContainer}>
            <View style={styles.bubbleContainer}>
              <TouchableOpacity onPress={toggleChat} activeOpacity={0.8}>
                <View style={[styles.bubble, hasUnread && styles.bubbleUnread]}>
                  <MessageCircle color={hasUnread ? "#FFF" : "#000"} size={28} />
                  {hasUnread && (
                    <View style={styles.bubbleBadge}>
                      <Text style={styles.bubbleBadgeText}>{totalUnreadCount > 99 ? '99+' : totalUnreadCount}</Text>
                    </View>
                  )}
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
                  
                      {activeCall.status === 'active' && isExpoGo && (
                        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', padding: 40, zIndex: 100 }]}>
                          <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: 24, borderRadius: 24, alignItems: 'center' }}>
                            <PhoneOffIcon size={48} color={theme.colors.primary} style={{ marginBottom: 16 }} />
                            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
                              Not Supported in Expo Go
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: 14 }}>
                              Voice calls require a native build. Please use a development or production build.
                            </Text>
                            <TouchableOpacity 
                              onPress={endCall}
                              style={{ marginTop: 24, backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
                            >
                              <Text style={{ color: '#000', fontWeight: 'bold' }}>Close</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {activeCall.status === 'active' && !isExpoGo && !AGORA_APP_ID && (
                      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', padding: 40, zIndex: 100 }]}>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: 24, borderRadius: 24, alignItems: 'center' }}>
                          <PhoneOffIcon size={48} color={theme.colors.primary} style={{ marginBottom: 16 }} />
                          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
                            Agora Not Configured
                          </Text>
                          <Text style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: 14 }}>
                            Please add EXPO_PUBLIC_AGORA_APP_ID to your environment variables.
                          </Text>
                          <TouchableOpacity 
                            onPress={endCall}
                            style={{ marginTop: 24, backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
                          >
                            <Text style={{ color: '#000', fontWeight: 'bold' }}>Close</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
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
                      {activeCall.chat.group_icon?.startsWith('http') ? (
                        <Image source={{ uri: activeCall.chat.group_icon }} style={styles.callAvatarImg} />
                      ) : (
                        <Text style={styles.callEmoji}>{activeCall.chat.group_icon || '👥'}</Text>
                      )}
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
                    {activeCall.status === 'active' && !isJoined && (
                      <View style={{ alignItems: 'center', marginTop: 8 }}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                        <Text style={[styles.callStatusText, { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }]}>
                          {isJoining ? 'Connecting to channel...' : 'Preparing connection...'}
                        </Text>
                        {debugStatus ? (
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>
                            {debugStatus}
                          </Text>
                        ) : null}
                      </View>
                    )}
                    {activeCall.status === 'active' && isJoined && remoteUsers.length === 0 && (
                      <View style={{ alignItems: 'center', marginTop: 8 }}>
                        <Text style={[styles.callStatusText, { color: '#F87171', fontSize: 12 }]}>
                          Waiting for other user to connect...
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>
                          Channel: {activeCall.id.split('-')[0]}...
                        </Text>
                        <TouchableOpacity 
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            leaveAgora().then(() => setupAgora());
                          }}
                          style={{ marginTop: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }}
                        >
                          <Text style={{ color: '#FFF', fontSize: 12 }}>Reconnect</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {activeCall.status === 'active' && isJoined && remoteUsers.length > 0 && (
                      <Text style={[styles.callStatusText, { color: '#4ADE80', fontSize: 12, marginTop: 8 }]}>
                        Voice Connected ({remoteUsers.length} remote)
                      </Text>
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
                      
                        <TouchableOpacity onPress={async () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: !next,
      staysActiveInBackground: true,
      shouldRouteAudioToReceiverIOS: !next,
      interruptionModeIOS: 1, // DoNotMix
      interruptionModeAndroid: 1, // DoNotMix
    });

    if (agoraEngine.current) {
      await agoraEngine.current.setEnableSpeakerphone(next);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}}
 style={styles.callBtn}>
                        <View style={[styles.iconCircle, isSpeakerOn && { backgroundColor: theme.colors.primary }]}>
                          <Volume2 size={24} color={isSpeakerOn ? "#000" : "#FFF"} />
                        </View>
                        <Text style={styles.callBtnLabel}>{isSpeakerOn ? 'Speaker On' : 'Speaker Off'}</Text>
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
                
                  {isNear && (
                    <View style={styles.proximityOverlay} />
                  )}
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
              
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' }}>
                  <TouchableOpacity 
                    onPress={() => setShowGroupIconPicker(true)}
                    style={[styles.modalInput, { width: 60, height: 60, padding: 0, justifyContent: 'center', alignItems: 'center', marginBottom: 0 }]}
                  >
                    {groupAvatarUrl ? (
                      <Image source={{ uri: groupAvatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    ) : (
                      <Text style={{ fontSize: 32 }}>{groupIcon || '👥'}</Text>
                    )}
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.modalInput, { flex: 1, height: 60, marginBottom: 0 }]}
                    placeholder="Group Name"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={groupName}
                    onChangeText={setGroupName}
                  />
                </View>

            
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

              <Modal visible={showGroupIconPicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalContent, { backgroundColor: '#0F172A' }]}>
                    <Text style={[styles.modalTitle, { color: '#FFF', textAlign: 'center', marginBottom: 20 }]}>Choose Group Icon</Text>
                    <View style={styles.emojiGrid}>
                      {EMOJIS.map(emoji => (
                        <TouchableOpacity key={emoji} onPress={() => handleSelectGroupEmoji(emoji)} style={styles.emojiItem}>
                          <Text style={styles.emojiText}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity onPress={handlePickGroupAvatar} style={[styles.photoBtn, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                      <Camera size={20} color="#FFF" />
                      <Text style={[styles.photoBtnText, { color: '#FFF' }]}>upload image</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowGroupIconPicker(false)} style={styles.closeBtn}>
                      <Text style={styles.closeBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
              </View>
            </View>
          </Modal>


        <Modal visible={showGroupInfo} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Group Info</Text>
                <TouchableOpacity onPress={() => setShowGroupInfo(false)}>
                  <X size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

              {activeChat?.is_group && (
                <>
                  <View style={styles.groupInfoHeader}>
                    <View style={styles.groupInfoIcon}>
                      {activeChat.group_icon?.startsWith('http') ? (
                        <Image source={{ uri: activeChat.group_icon }} style={styles.groupInfoAvatar} />
                      ) : (
                        <Text style={styles.groupInfoEmoji}>{activeChat.group_icon || '👥'}</Text>
                      )}
                    </View>
                    <Text style={styles.groupInfoName}>{activeChat.group_name}</Text>
                    <Text style={styles.groupInfoCount}>{groupMembers.length} members</Text>
                  </View>

                    <Text style={styles.sectionTitle}>Members</Text>
                    <ScrollView style={styles.membersList}>
                      {groupMembers.map((member) => {
                        const isOwner = activeChat?.owner_id === member.user_id || member.is_owner;
                        const currentUserIsOwner = activeChat?.owner_id === user?.id || groupMembers.find(m => m.user_id === user?.id)?.is_owner;
                        const currentUserIsAdmin = groupMembers.find(m => m.user_id === user?.id)?.is_admin;
                        const canManage = currentUserIsOwner && member.user_id !== user?.id;
                        
                        return (
                        <TouchableOpacity 
                          key={member.id} 
                          style={styles.memberItem}
                          onPress={() => {
                            if (member.user?.id) {
                              setShowGroupInfo(false);
                              setClose();
                              router.push(`/profile?userId=${member.user.id}`);
                            }
                          }}
                          onLongPress={() => {
                            if (canManage) {
                              Alert.alert(
                                `Manage @${member.user?.username}`,
                                'Choose an action',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  { 
                                    text: member.is_admin ? 'Demote from Admin' : 'Promote to Admin', 
                                    onPress: async () => {
                                      await supabase.from('rchat_members').update({ is_admin: !member.is_admin }).eq('id', member.id);
                                      loadGroupMembers(activeChat.id);
                                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                    }
                                  },
                                  { 
                                    text: 'Kick from Group', 
                                    style: 'destructive',
                                      onPress: async () => {
                                        await supabase.from('rchat_members').delete().eq('id', member.id);
                                          await supabase.from('rmessages').insert({
                                            chat_id: activeChat.id,
                                            sender_id: user.id,
                                            text: `${member.user?.username || 'Someone'} was removed from the group`,
                                            is_system: true
                                          });
                                        loadGroupMembers(activeChat.id);
                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                      }
                                    },
                                ]
                              );
                            }
                          }}
                        >
                          {member.user?.avatar_url ? (
                            <Image source={{ uri: member.user.avatar_url }} style={styles.memberAvatar} />
                          ) : (
                            <View style={styles.memberEmojiBg}>
                              <Text style={styles.memberEmoji}>{member.user?.emoji_icon || '👤'}</Text>
                            </View>
                          )}
                          <View style={styles.memberInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.memberName}>@{member.user?.username}</Text>
                              {isOwner && <View style={styles.ownerBadge}><Text style={styles.ownerBadgeText}>Owner</Text></View>}
                              {member.is_admin && !isOwner && <Text style={styles.adminBadge}>Admin</Text>}
                            </View>
                          </View>
                          {member.user_id === user?.id && <Text style={styles.youBadge}>You</Text>}
                        </TouchableOpacity>
                      );
                      })}
                    </ScrollView>

                  <View style={styles.groupActions}>
                      {(activeChat?.owner_id === user?.id || groupMembers.find(m => m.user_id === user?.id)?.is_owner) && (
                        <>
                            <TouchableOpacity style={styles.groupActionBtn} onPress={() => {
                              setGroupRenameValue(activeChat?.group_name || '');
                              setShowGroupRenameModal(true);
                            }}>
                              <Settings size={20} color={theme.colors.primary} />
                              <Text style={[styles.groupActionText, { color: theme.colors.primary }]}>Change Group Name</Text>
                            </TouchableOpacity>
                          <TouchableOpacity style={styles.groupActionBtn} onPress={() => {
                            Alert.alert(
                              'Close Group',
                              'This will permanently delete the group and all messages. Are you sure?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Delete Group',
                                  style: 'destructive',
                                  onPress: async () => {
                                    await supabase.from('rmessages').delete().eq('chat_id', activeChat.id);
                                    await supabase.from('rchat_members').delete().eq('chat_id', activeChat.id);
                                    await supabase.from('rchats').delete().eq('id', activeChat.id);
                                    setShowGroupInfo(false);
                                    setActiveChat(null);
                                    setShowChatList(true);
                                    loadUserAndChats();
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                  }
                                }
                              ]
                            );
                          }}>
                            <Trash2 size={20} color="#EF4444" />
                            <Text style={[styles.groupActionText, { color: '#EF4444' }]}>Delete Group</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity style={styles.groupActionBtn} onPress={handleLeaveGroup}>
                      <LogOut size={20} color="#EF4444" />
                      <Text style={[styles.groupActionText, { color: '#EF4444' }]}>Leave Group</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.groupActionBtn} onPress={handleReportChat}>
                      <Flag size={20} color="#F59E0B" />
                      <Text style={[styles.groupActionText, { color: '#F59E0B' }]}>Report Chat</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
          </Modal>


          <Modal visible={showGroupRenameModal} animationType="fade" transparent>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: '#0F172A', padding: 24 }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { textAlign: 'left', marginBottom: 0 }]}>Rename Group</Text>
                  <TouchableOpacity onPress={() => setShowGroupRenameModal(false)}>
                    <X size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>
                
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginVertical: 16 }}>
                  Enter a new name for the group chat.
                </Text>
  
                <TextInput
                  style={[styles.modalInput, { backgroundColor: 'rgba(255,255,255,0.05)', color: '#FFF', fontSize: 18, height: 50, marginBottom: 24 }]}
                  placeholder="Group name..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={groupRenameValue}
                  onChangeText={setGroupRenameValue}
                  autoFocus
                />
  
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity 
                    onPress={() => setShowGroupRenameModal(false)}
                    style={[styles.createGroupBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}
                  >
                    <Text style={[styles.createGroupBtnText, { color: '#FFF' }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={handleGroupRename}
                    style={[styles.createGroupBtn, { flex: 1, backgroundColor: theme.colors.primary }]}
                  >
                    <Text style={[styles.createGroupBtnText, { color: '#000' }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal visible={showNicknameModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: '#0F172A', padding: 24 }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { textAlign: 'left', marginBottom: 0 }]}>Set Nickname</Text>
                <TouchableOpacity onPress={() => setShowNicknameModal(false)}>
                  <X size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
              
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginVertical: 16 }}>
                Nickname for @{nicknameToEdit?.username} is only visible to you.
              </Text>

              <TextInput
                style={[styles.modalInput, { backgroundColor: 'rgba(255,255,255,0.05)', color: '#FFF', fontSize: 18, height: 50, marginBottom: 24 }]}
                placeholder="Enter nickname..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={nicknameValue}
                onChangeText={setNicknameValue}
                autoFocus
                autoCapitalize="words"
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  onPress={() => setShowNicknameModal(false)}
                  style={[styles.createGroupBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}
                >
                  <Text style={[styles.createGroupBtnText, { color: '#FFF' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleSaveNickname}
                  style={[styles.createGroupBtn, { flex: 1, backgroundColor: theme.colors.primary }]}
                >
                  <Text style={[styles.createGroupBtnText, { color: '#000' }]}>Save</Text>
                </TouchableOpacity>
              </View>
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
                    <TouchableOpacity onPress={handleRefreshChats} style={styles.iconBtn} disabled={isRefreshing}>
                      <RefreshCw size={20} color="#FFF" style={isRefreshing ? { opacity: 0.5 } : undefined} />
                    </TouchableOpacity>
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
                        <TouchableOpacity style={styles.headerUserInfo} onPress={() => setShowGroupInfo(true)}>
                          <View style={styles.headerEmojiBg}>
                            {activeChat.group_icon?.startsWith('http') ? (
                              <Image source={{ uri: activeChat.group_icon }} style={styles.headerAvatar} />
                            ) : (
                              <Text style={styles.headerEmoji}>{activeChat.group_icon || '👥'}</Text>
                            )}
                          </View>
                          <View>
                            <Text style={styles.headerTitle}>{activeChat.group_name}</Text>
                            <Text style={styles.onlineStatusText}>{groupMembers.length} members</Text>
                          </View>
                        </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.headerUserInfo}
                        onPress={() => {
                          const other = getOtherUser(activeChat);
                            if (other) {
                              setClose();
                              router.push(`/profile?userId=${other.id}`);
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
                              {(onlineUsers[getOtherUser(activeChat)?.id] || isOnline(getOtherUser(activeChat)?.last_seen)) && <View style={styles.headerStatusDot} />}
                            </View>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Text style={styles.headerTitle} numberOfLines={1}>
                                    {getOtherUser(activeChat)?.nickname || `@${getOtherUser(activeChat)?.username}`}
                                  </Text>
                                  <TouchableOpacity onPress={(e) => {
                                    e.stopPropagation();
                                    const other = getOtherUser(activeChat);
                                    setNicknameToEdit(other);
                                    setNicknameValue(other.nickname || '');
                                    setShowNicknameModal(true);
                                  }}>
                                    <Edit size={14} color="rgba(255,255,255,0.4)" />
                                  </TouchableOpacity>
                                </View>
                              <Text style={styles.onlineStatusText}>
                                {(onlineUsers[getOtherUser(activeChat)?.id] || isOnline(getOtherUser(activeChat)?.last_seen)) ? 'Online' : 'Offline'}
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
                      <Text style={styles.settingDesc}>Allow others to see when you&apos;ve read their messages</Text>
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
                    const userIsOnline = !isGroup && (onlineUsers[otherUser?.id] || isOnline(otherUser?.last_seen));
                    const isPending = item.status === 'pending';
                    
                    return (
                      <TouchableOpacity onPress={() => selectChat(item)} style={styles.chatListItem}>
                          <View style={styles.avatarWrapper}>
                            {isGroup ? (
                              <View style={styles.listEmojiBg}>
                                {item.group_icon?.startsWith('http') ? (
                                  <Image source={{ uri: item.group_icon }} style={styles.listAvatar} />
                                ) : (
                                  <Text style={styles.listEmoji}>{item.group_icon || '👥'}</Text>
                                )}
                              </View>
                            ) : otherUser?.avatar_url ? (
                            <Image source={{ uri: otherUser.avatar_url }} style={styles.listAvatar} />
                          ) : (
                            <View style={styles.listEmojiBg}>
                              <Text style={styles.listEmoji}>{otherUser?.emoji_icon || "👤"}</Text>
                            </View>
                          )}
                          {userIsOnline && <View style={styles.statusDot} />}
                        </View>
                      <View style={styles.chatInfo}>
                        <View style={styles.chatInfoTop}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.chatName}>
                                {isGroup ? item.group_name : (otherUser?.nickname || `@${otherUser?.username}`)}
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
                                if (item.is_system) {
                                  return (
                                    <View style={styles.systemMessageContainer}>
                                      <View style={styles.systemMessageLine} />
                                      <Text style={styles.systemMessageText}>{item.text}</Text>
                                      <View style={styles.systemMessageLine} />
                                    </View>
                                  );
                                }

                              const isMyMessage = item.sender_id === user?.id;
                            
                          return (
                            <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.theirMessage, item.media_url && styles.mediaMessage]}>
                            {activeChat?.is_group && !isMyMessage && (
                              <TouchableOpacity onPress={() => {
                                if (item.sender?.id) {
                                  setClose();
                                  router.push(`/profile?userId=${item.sender.id}`);
                                }
                              }}>
                                <Text style={styles.senderName}>@{item.sender?.username}</Text>
                              </TouchableOpacity>
                            )}
                            
                            {item.media_url && (
                              <MediaPreview url={item.media_url} type={item.media_type} isMyMessage={isMyMessage} />
                            )}

                              {item.text ? (
                                <Markdown style={{
                                  body: {
                                    color: isMyMessage ? '#000' : '#FFF',
                                    fontSize: 16,
                                    lineHeight: 24,
                                    fontWeight: '500',
                                  },
                                  strong: {
                                    fontWeight: 'bold',
                                  },
                                  em: {
                                    fontStyle: 'italic',
                                  },
                                  paragraph: {
                                    marginTop: 0,
                                    marginBottom: 0,
                                  }
                                }}>
                                  {item.text}
                                </Markdown>
                              ) : null}


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
                    
                    <PresenceIndicator />
                    
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
                            {showMediaMenu && (
                              <View style={styles.mediaMenu}>
                                <TouchableOpacity 
                                  onPress={() => {
                                    handlePickMedia('image');
                                    setShowMediaMenu(false);
                                  }} 
                                  style={styles.mediaMenuItem}
                                >
                                  <View style={[styles.mediaMenuIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                                    <ImageIcon size={20} color="#3B82F6" />
                                  </View>
                                  <Text style={styles.mediaMenuText}>Photo</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                  onPress={() => {
                                    handlePickMedia('video');
                                    setShowMediaMenu(false);
                                  }} 
                                  style={styles.mediaMenuItem}
                                >
                                  <View style={[styles.mediaMenuIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                                    <VideoIcon size={20} color="#10B981" />
                                  </View>
                                  <Text style={styles.mediaMenuText}>Video</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                            {pendingMedia && (
                            <View style={styles.pendingMediaContainer}>
                              <Image source={{ uri: pendingMedia.uri }} style={styles.pendingMediaPreview} contentFit="cover" />
                              <TouchableOpacity 
                                style={styles.removePendingMedia} 
                                onPress={() => setPendingMedia(null)}
                              >
                                <X size={14} color="#FFF" />
                              </TouchableOpacity>
                              <View style={styles.pendingMediaType}>
                                {pendingMedia.type === 'video' ? <VideoIcon size={12} color="#FFF" /> : <ImageIcon size={12} color="#FFF" />}
                              </View>
                            </View>
                          )}
                          {isUploading && (
                          <View style={styles.uploadingIndicator}>
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                            <Text style={styles.uploadingText}>Uploading...</Text>
                          </View>
                        )}
                        
                        {isRecording ? (
                          <View style={styles.recordingContainer}>
                            <View style={styles.recordingInfo}>
                              <Animated.View style={[styles.recordingDot, { opacity: pulseAnim }]} />
                              <Text style={styles.recordingTime}>{formatCallDuration(recordingDuration)}</Text>
                            </View>
                            <View style={styles.recordingActions}>
                              <TouchableOpacity onPress={cancelRecording} style={styles.cancelRecordingBtn}>
                                <Trash2 size={20} color="#EF4444" />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={stopRecording} style={styles.stopRecordingBtn}>
                                <LinearGradient
                                  colors={[theme.colors.primary, '#4ADE80']}
                                  style={styles.sendIconBg}
                                >
                                  <Send size={18} color="#000" />
                                </LinearGradient>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                            <View style={styles.inputWrapper}>
                              <View style={styles.attachmentButtons}>
                                <TouchableOpacity 
                                  onPress={() => setShowMediaMenu(!showMediaMenu)} 
                                  style={styles.attachBtn}
                                  disabled={isUploading}
                                >
                                  <Plus size={20} color={showMediaMenu ? theme.colors.primary : "rgba(255,255,255,0.6)"} />
                                </TouchableOpacity>
                              </View>
  
                              <TextInput
                                ref={inputRef}
                                style={styles.input}
                                placeholder={activeChat?.status === 'pending' && !activeChat?.is_group ? "Waiting for approval..." : "Type a message..."}
                                value={inputText}
                                onChangeText={handleInputChange}
                                onKeyPress={handleKeyPress}
                                onSubmitEditing={() => handleSendMessage()}
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                multiline
                                blurOnSubmit={false}
                                editable={!isUploading && (activeChat?.status === 'accepted' || activeChat?.initiated_by === user?.id || activeChat?.is_group)}
                              />
  
                            {inputText.trim() ? (
                              <TouchableOpacity 
                                onPress={() => handleSendMessage()} 
                                style={styles.sendBtn}
                              >
                                <LinearGradient
                                  colors={[theme.colors.primary, '#4ADE80']}
                                  style={styles.sendIconBg}
                                >
                                  <Send size={18} color="#000" />
                                </LinearGradient>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity 
                                onPress={startRecording} 
                                style={styles.sendBtn}
                                disabled={isUploading || (activeChat?.status === 'pending' && activeChat?.initiated_by === user?.id && !activeChat?.is_group)}
                              >
                                <View style={[styles.sendIconBg, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                                  <Mic size={18} color="#FFF" />
                                </View>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
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
    bottom: 30,
    left: 20,
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
    overflow: 'hidden',
    backgroundColor: theme.colors.primary,
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
    systemMessageContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      paddingHorizontal: 20,
      marginVertical: 16,
    },
    systemMessageLine: {
      flex: 1,
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    systemMessageText: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
      marginHorizontal: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
  attachmentButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 8,
    gap: 8,
    alignSelf: 'center',
  },
  attachBtn: {
    padding: 4,
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
  },
  uploadingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
    mediaMessage: {
      padding: 0,
      borderRadius: 22,
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    pendingMediaContainer: {
      position: 'relative',
      width: 80,
      height: 80,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      overflow: 'hidden',
    },
    pendingMediaPreview: {
      width: '100%',
      height: '100%',
    },
    removePendingMedia: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    pendingMediaType: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
  mediaPreviewContainer: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 4,
  },
  videoPreviewWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
    fullscreenHeader: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 60 : 40,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      zIndex: 10,
    },
    fullscreenIconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    aiExpandBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 6,
    },
    aiExpandBtnDisabled: {
      opacity: 0.7,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    aiExpandText: {
      color: '#000',
      fontSize: 14,
      fontWeight: 'bold',
    },
    fullscreenContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: width,
    height: height * 0.8,
  },
  fullscreenVideo: {
    width: width,
    height: height * 0.8,
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
    proximityOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000',
      zIndex: 10000,
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
    emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15, marginBottom: 20 },
    emojiItem: { padding: 5 },
    emojiText: { fontSize: 32 },
    photoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, borderRadius: 10, marginBottom: 10 },
    photoBtnText: { fontWeight: 'bold' },
    closeBtn: { padding: 15, alignItems: 'center' },
      closeBtnText: { color: '#ef4444', fontWeight: 'bold' },
      audioPlayer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 16,
        width: width * 0.65,
        marginBottom: 4,
      },
      audioPlayBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
      },
      audioSlider: {
        flex: 1,
        height: 40,
        marginHorizontal: 8,
      },
      audioTime: {
        fontSize: 12,
        fontWeight: '600',
        minWidth: 35,
      },
      recordingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 8,
        height: 52,
      },
      recordingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      },
      recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#EF4444',
      },
      recordingTime: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
      },
      recordingActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
      },
    cancelRecordingBtn: {
      padding: 4,
    },
    stopRecordingBtn: {
      padding: 0,
    },
    groupInfoHeader: {
      alignItems: 'center',
      marginBottom: 24,
    },
    groupInfoIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(255,255,255,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
      overflow: 'hidden',
    },
    groupInfoAvatar: {
      width: 80,
      height: 80,
    },
    groupInfoEmoji: {
      fontSize: 40,
    },
    groupInfoName: {
      color: '#FFF',
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 4,
    },
    groupInfoCount: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 14,
    },
    sectionTitle: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: 12,
      letterSpacing: 1,
    },
    membersList: {
      maxHeight: 250,
      marginBottom: 20,
    },
    memberItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      marginBottom: 4,
      backgroundColor: 'rgba(255,255,255,0.03)',
    },
    memberAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    memberEmojiBg: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    memberEmoji: {
      fontSize: 22,
    },
    memberInfo: {
      flex: 1,
      marginLeft: 12,
    },
    memberName: {
      color: '#FFF',
      fontSize: 15,
      fontWeight: '600',
    },
    adminBadge: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
    ownerBadge: {
      backgroundColor: '#F59E0B',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    ownerBadgeText: {
      color: '#000',
      fontSize: 10,
      fontWeight: '700',
    },
    youBadge: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 12,
      fontWeight: '600',
    },
    groupActions: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)',
      paddingTop: 16,
      gap: 8,
    },
    groupActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.03)',
    },
      groupActionText: {
        fontSize: 15,
        fontWeight: '600',
      },
      mediaMenu: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 100 : 76,
        left: 16,
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 8,
        flexDirection: 'row',
        gap: 8,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        zIndex: 1000,
      },
      mediaMenuItem: {
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 6,
      },
      mediaMenuIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
      },
        mediaMenuText: {
          color: '#FFF',
          fontSize: 12,
          fontWeight: '600',
        },
        presenceIndicator: {
          paddingHorizontal: 20,
          paddingVertical: 8,
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
        },
        presenceIndicatorText: {
          color: theme.colors.primary,
          fontSize: 12,
          fontWeight: '600',
          fontStyle: 'italic',
        },
      });

