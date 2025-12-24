import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Send, MessageSquare } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/utils/supabase';
import { getStoredUser } from '@/utils/user';
import * as Haptics from 'expo-haptics';

export default function HelpContact() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flatListRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const setup = async () => {
      let user = await getStoredUser();
      if (!user) {
        const { initUser } = require('@/utils/user');
        user = await initUser();
      }
      
      if (user) {
        setCurrentUser(user);
      } else {
        setLoading(false);
      }
    };
    setup();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    
    initChat();
    
    // Subscribe to new messages for this user
    const subscription = supabase
      .channel(`help_chat_${currentUser.id}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          table: 'rhelp_messages'
        }, 
        payload => {
          const newMsg = payload.new;
          // Filter in JS to ensure privacy and fix "showing up in every chat" issue
          if (newMsg.sender_id === currentUser.id || newMsg.receiver_id === currentUser.id) {
            setMessages(prev => {
              if (prev.find(m => m.id === newMsg.id)) return prev;
              
              if (newMsg.receiver_id === currentUser.id) {
                if (newMsg.status === 'resolved' || newMsg.content.includes("Please rate 1-5")) {
                  setShowRating(true);
                }
              }
              return [...prev, newMsg];
            });
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          table: 'rhelp_messages'
        },
        payload => {
          const newMsg = payload.new;
          if (newMsg.receiver_id === currentUser.id && newMsg.status === 'resolved') {
            setShowRating(true);
            initChat();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser?.id]);

  const initChat = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('rhelp_messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Check if already resolved
      if (data?.some(m => m.status === 'resolved' || m.content.includes("Please rate 1-5"))) {
        setShowRating(true);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const purgeMessages = async () => {
    if (!currentUser) return;
    try {
      await supabase
        .from('rhelp_messages')
        .delete()
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
      setMessages([]);
      setShowRating(false);
    } catch (error) {
      console.error("Error purging messages:", error);
    }
  };

  const submitReview = async () => {
    if (rating === 0) {
      Alert.alert("Rating Required", "Please select a rating from 1 to 5 stars.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('rhelp_reviews')
        .insert({
          user_id: currentUser.id,
          rating,
          comment
        });
      if (error) throw error;
      
      await purgeMessages();
      Alert.alert("Thank You", "Your feedback has been submitted and the chat has been cleared.");
      setRating(0);
      setComment('');
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not submit review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !currentUser) return;
    
    // If there's a resolved status, purge before sending new
    if (messages.some(m => m.status === 'resolved')) {
      await purgeMessages();
    }

    const text = inputText.trim();
    setInputText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { error } = await supabase
        .from('rhelp_messages')
        .insert({
          sender_id: currentUser.id,
          content: text,
          is_from_admin: false
        });

      if (error) throw error;
    } catch (error) {
      console.error(error);
      setInputText(text); // Restore text on error
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#FFFFFF" size={28} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <MessageSquare color="#60A5FA" size={20} />
          <Text style={styles.headerTitle}>CONTACT HELP</Text>
        </View>
        <TouchableOpacity 
          onPress={async () => {
            // Simulate resolution from admin
            await supabase.from('rhelp_messages').insert({
              receiver_id: currentUser.id,
              content: "Resolved. Please rate 1-5 / Leave a comment",
              is_from_admin: true,
              status: 'resolved'
            });
          }}
          style={styles.headerAction}
        >
          <Text style={styles.headerActionText}>RESOLVE</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMine = !item.is_from_admin;
          const isResolved = item.status === 'resolved';
          return (
            <View style={[
              styles.messageBubble, 
              isMine ? styles.myMessage : styles.theirMessage,
              isResolved && { borderLeftWidth: 4, borderLeftColor: '#10B981' }
            ]}>
              {!isMine && <Text style={styles.adminLabel}>ADMIN SUPPORT</Text>}
              <Text style={[styles.messageText, { color: isMine ? '#000000' : '#FFFFFF' }]}>
                {item.content}
              </Text>
              <Text style={[styles.messageTime, { color: isMine ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }]}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
        ListFooterComponent={
          showRating ? (
            <View style={styles.inChatRatingContainer}>
              <View style={styles.ratingCard}>
                <Text style={styles.ratingTitle}>HOW WAS OUR SUPPORT?</Text>
                <Text style={styles.ratingSubtitle}>Please rate your experience 1-5</Text>
                
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity 
                      key={star} 
                      onPress={() => {
                        setRating(star);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                      style={styles.starButton}
                    >
                      <Text style={[styles.starText, rating >= star && styles.starActive]}>
                        {rating >= star ? '★' : '☆'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={styles.ratingInput}
                  placeholder="Leave a comment (optional)..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                />

                <View style={styles.ratingButtons}>
                  <TouchableOpacity 
                    style={[styles.submitButton, rating === 0 && { opacity: 0.5 }]} 
                    onPress={submitReview}
                    disabled={rating === 0 || isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : (
                      <Text style={styles.submitButtonText}>SUBMIT REVIEW</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Send a message to start a conversation with our team.</Text>
          </View>
        }
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && { opacity: 0.5 }]} 
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Send size={20} color="#000000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
  headerAction: {
    padding: 5,
  },
  headerActionText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  backButton: {
    padding: 5,
  },
  chatContent: {
    padding: 20,
    gap: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 5,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  adminLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#60A5FA',
    letterSpacing: 1,
    marginBottom: 4,
  },
  inChatRatingContainer: {
    padding: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  ratingCard: {
    backgroundColor: '#111111',
    width: '100%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  ratingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  ratingSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 24,
  },
  starButton: {
    padding: 4,
  },
  starText: {
    fontSize: 40,
    color: 'rgba(255,255,255,0.1)',
  },
  starActive: {
    color: '#FBBF24',
  },
  ratingInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 15,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  ratingButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#000000',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#FFFFFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 100,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    paddingHorizontal: 40,
    fontSize: 14,
  },
});
