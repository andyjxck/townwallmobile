import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  PanResponder, 
  Dimensions, 
  TextInput, 
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard
} from 'react-native';
import { MessageCircle, X, Send, ChevronLeft, MoreHorizontal, User } from 'lucide-react-native';
import { supabase } from '../utils/supabase';
import { getStoredUser } from '../utils/user';
import { theme } from '../utils/theme';
import { sendNotification } from '../utils/notifications';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [showChatList, setShowChatList] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const pan = useRef(new Animated.ValueXY({ x: width - 80, y: height - 150 })).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const flatListRef = useRef();

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const toX = pan.x._value > width / 2 ? width - 80 : 20;
        Animated.spring(pan, {
          toValue: { x: toX, y: pan.y._value },
          useNativeDriver: false,
          tension: 80,
          friction: 10
        }).start();
      },
    })
  ).current;

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
    
    const chatSub = supabase
      .channel('public:rmessages_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rmessages' }, (payload) => {
        if (activeChat && payload.new.chat_id === activeChat.id) {
          setMessages(prev => [...prev, payload.new]);
          setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        }
        loadUserAndChats();
      })
      .subscribe();

    return () => { supabase.removeChannel(chatSub); };
  }, [activeChat]);

  const loadUserAndChats = async () => {
    const storedUser = await getStoredUser();
    if (!storedUser) return;
    setUser(storedUser);

    const { data } = await supabase
      .from('rchats')
      .select(`*, user1:rusers!user1_id(id, username, emoji_icon, avatar_url), user2:rusers!user2_id(id, username, emoji_icon, avatar_url)`)
      .or(`user1_id.eq.${storedUser.id},user2_id.eq.${storedUser.id}`)
      .order('last_message_at', { ascending: false });
    
    setChats(data || []);
  };

  const loadMessages = async (chatId) => {
    setLoading(true);
    const { data } = await supabase
      .from('rmessages')
      .select('*')
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

        // Send notification to the other user
        const otherUser = getOtherUser(activeChat);
        if (otherUser) {
          await sendNotification({
            userId: otherUser.id,
            title: `@${user.username} sent you a message`,
            message: text,
            type: 'help_chat'
          });
        }
      }
    };

    const handleKeyPress = ({ nativeEvent }) => {
      if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
        handleSendMessage();
      }
    };

  const selectChat = (chat) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveChat(chat);
    setShowChatList(false);
    loadMessages(chat.id);
  };

  const toggleChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isOpen) {
      setShowChatList(true);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const getOtherUser = (chat) => {
    if (!chat || !user) return null;
    return chat.user1_id === user.id ? chat.user2 : chat.user1;
  };

  if (chats.length === 0 && !isOpen) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {!isOpen && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[pan.getLayout(), styles.bubbleWrapper]}
        >
          <TouchableOpacity onPress={toggleChat} activeOpacity={0.8}>
            <LinearGradient
              colors={[theme.colors.primary, '#4ADE80']}
              style={styles.bubble}
            >
              <MessageCircle color="#000" size={28} />
              {chats.some(c => c.unread_count > 0) && <View style={styles.unreadBadge} />}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}

      {isOpen && (
        <Animated.View style={[styles.chatOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => setIsOpen(false)}
          >
            <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          
          <Animated.View style={[styles.chatWindow, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.chatHeader}>
              {showChatList ? (
                <Text style={styles.headerTitle}>Messages</Text>
              ) : (
                <View style={styles.headerNav}>
                  <TouchableOpacity onPress={() => setShowChatList(true)} style={styles.iconBtn}>
                    <ChevronLeft size={24} color="#FFF" />
                  </TouchableOpacity>
                  <View style={styles.headerUserInfo}>
                    {getOtherUser(activeChat)?.avatar_url ? (
                      <Image source={{ uri: getOtherUser(activeChat).avatar_url }} style={styles.headerAvatar} />
                    ) : (
                      <View style={styles.headerEmojiBg}>
                        <Text style={styles.headerEmoji}>{getOtherUser(activeChat)?.emoji_icon || "👤"}</Text>
                      </View>
                    )}
                    <Text style={styles.headerTitle}>
                      @{getOtherUser(activeChat)?.username}
                    </Text>
                  </View>
                </View>
              )}
              <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.iconBtn}>
                <X size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {showChatList ? (
              <FlatList
                data={chats}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                  const otherUser = getOtherUser(item);
                  return (
                    <TouchableOpacity onPress={() => selectChat(item)} style={styles.chatListItem}>
                      <View style={styles.avatarWrapper}>
                        {otherUser?.avatar_url ? (
                          <Image source={{ uri: otherUser.avatar_url }} style={styles.listAvatar} />
                        ) : (
                          <View style={styles.listEmojiBg}>
                            <Text style={styles.listEmoji}>{otherUser?.emoji_icon || "👤"}</Text>
                          </View>
                        )}
                        <View style={styles.statusDot} />
                      </View>
                      <View style={styles.chatInfo}>
                        <View style={styles.chatInfoTop}>
                          <Text style={styles.chatName}>@{otherUser?.username}</Text>
                          <Text style={styles.chatTime}>
                            {item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </Text>
                        </View>
                        <Text style={styles.chatLastMsg} numberOfLines={1}>{item.last_message}</Text>
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
                  <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                      <View style={[
                        styles.messageBubble, 
                        item.sender_id === user?.id ? styles.myMessage : styles.theirMessage
                      ]}>
                        <Text style={[
                          styles.messageText, 
                          { color: item.sender_id === user?.id ? '#000' : '#FFF' }
                        ]}>
                          {item.text}
                        </Text>
                        <Text style={[
                          styles.msgTime,
                          { color: item.sender_id === user?.id ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }
                        ]}>
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}
                    style={styles.messagesList}
                    contentContainerStyle={{ padding: 16 }}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                  />
                )}
                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.input}
                          placeholder="Type a message..."
                          value={inputText}
                          onChangeText={setInputText}
                          onKeyPress={handleKeyPress}
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          multiline
                          blurOnSubmit={false}
                        />
                    <TouchableOpacity 
                      onPress={handleSendMessage} 
                      style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
                      disabled={!inputText.trim()}
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
  bubbleWrapper: {
    width: 64,
    height: 64,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  bubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    borderWidth: 3,
    borderColor: '#000',
  },
  chatOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  chatWindow: {
    width: width * 0.92,
    height: height * 0.65,
    backgroundColor: '#1E293B',
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerEmojiBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 18,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    borderColor: '#1E293B',
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
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  msgTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
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
});
