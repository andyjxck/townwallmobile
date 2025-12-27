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
  Platform
} from 'react-native';
import { MessageCircle, X, Send, User } from 'lucide-react-native';
import { supabase } from '../utils/supabase';
import { getStoredUser } from '../utils/user';
import { theme } from '../utils/theme';
import { Image } from 'expo-image';

const { width, height } = Dimensions.get('window');

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [showChatList, setShowChatList] = useState(false);
  
  const pan = useRef(new Animated.ValueXY({ x: width - 80, y: height - 150 })).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        // Snap to edges
        const toX = pan.x._value > width / 2 ? width - 80 : 10;
        Animated.spring(pan, {
          toValue: { x: toX, y: pan.y._value },
          useNativeDriver: false
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    loadUserAndChats();
    
    const chatSub = supabase
      .channel('public:rmessages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rmessages' }, (payload) => {
        if (activeChat && payload.new.chat_id === activeChat.id) {
          setMessages(prev => [...prev, payload.new]);
        }
        loadUserAndChats(); // Refresh chat list for unread/last message
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
    const { data } = await supabase
      .from('rmessages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChat) return;
    const text = inputText.trim();
    setInputText('');
    
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
    }
  };

  const selectChat = (chat) => {
    setActiveChat(chat);
    setShowChatList(false);
    setIsOpen(true);
    loadMessages(chat.id);
  };

  if (chats.length === 0 && !isOpen) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {!isOpen && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[pan.getLayout(), styles.bubble]}
        >
          <TouchableOpacity onPress={() => { setShowChatList(true); setIsOpen(true); }} style={styles.bubbleTouch}>
            <MessageCircle color="#FFF" size={30} />
            {chats.some(c => c.unread_count > 0) && <View style={styles.unreadBadge} />}
          </TouchableOpacity>
        </Animated.View>
      )}

      {isOpen && (
        <View style={styles.chatWindow}>
          <View style={[styles.chatHeader, { backgroundColor: theme.colors.surface }]}>
            {showChatList ? (
              <Text style={styles.headerTitle}>Messages</Text>
            ) : (
              <View style={styles.headerUserInfo}>
                <TouchableOpacity onPress={() => setShowChatList(true)} style={styles.backBtn}>
                  <X size={20} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                  @{activeChat.user1_id === user.id ? activeChat.user2?.username : activeChat.user1?.username}
                </Text>
              </View>
            )}
            <TouchableOpacity onPress={() => setIsOpen(false)}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {showChatList ? (
            <FlatList
              data={chats}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const otherUser = item.user1_id === user.id ? item.user2 : item.user1;
                return (
                  <TouchableOpacity onPress={() => selectChat(item)} style={styles.chatItem}>
                    {otherUser?.avatar_url ? (
                      <Image source={{ uri: otherUser.avatar_url }} style={styles.chatAvatar} />
                    ) : (
                      <Text style={styles.chatEmoji}>{otherUser?.emoji_icon || "👤"}</Text>
                    )}
                    <View style={styles.chatInfo}>
                      <Text style={styles.chatName}>@{otherUser?.username}</Text>
                      <Text style={styles.chatLastMsg} numberOfLines={1}>{item.last_message}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              style={styles.list}
            />
          ) : (
            <>
              <FlatList
                data={messages}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.messageBubble, item.sender_id === user.id ? styles.myMessage : styles.theirMessage]}>
                    <Text style={[styles.messageText, { color: item.sender_id === user.id ? '#000' : '#FFF' }]}>{item.text}</Text>
                  </View>
                )}
                style={styles.list}
                contentContainerStyle={{ padding: 10 }}
              />
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
                <View style={styles.inputArea}>
                  <TextInput
                    style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    placeholder="Type a message..."
                    value={inputText}
                    onChangeText={setInputText}
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                  <TouchableOpacity onPress={handleSendMessage} style={styles.sendBtn}>
                    <Send size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </>
          )}
        </View>
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
  bubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  bubbleTouch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: theme.colors.error,
    borderWidth: 2,
    borderColor: '#000',
  },
  chatWindow: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    left: 20,
    height: height * 0.5,
    backgroundColor: '#111',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 20,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  chatEmoji: {
    fontSize: 24,
  },
  chatInfo: {
    marginLeft: 15,
    flex: 1,
  },
  chatName: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  chatLastMsg: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 15,
    marginBottom: 8,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 2,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#333',
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: 14,
  },
  inputArea: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: '#111',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  sendBtn: {
    padding: 5,
  },
});
