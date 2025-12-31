import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Send, Sparkles, X, Maximize2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { supabase } from '@/utils/supabase';
import { getStoredUser } from '@/utils/user';
import { getAIAssistantResponse, expandImage } from '@/utils/ai';
import { sendNotification } from '@/utils/notifications';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from "@/utils/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import { useLocationStore } from '@/utils/locationStore';

export default function HelpContact() {
  const { isHippie } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
    const flatListRef = useRef(null);
    const inputRef = useRef(null);
    const isSendingRef = useRef(false);
    const subRef = useRef(null);
    const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [isExpanding, setIsExpanding] = useState(false);

    const handleMessageAction = async (message) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const isMine = !message.is_from_admin;
      const content = message.content;
      
      // Clean content from image tags for copying
      const cleanText = content.replace(/\[TOWNY_IMAGE:.+?\]/g, '').trim();

      Alert.alert(
        "Message Actions",
        null,
        [
          {
            text: "Copy Text",
            onPress: async () => {
              if (cleanText) {
                await Clipboard.setStringAsync(cleanText);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            }
          },
          {
            text: "Share",
            onPress: async () => {
              try {
                await Share.share({
                  message: cleanText || "Shared from Towny",
                });
              } catch (e) {
                console.error("Share error:", e);
              }
            }
          },
          {
            text: "Report Message",
            style: "destructive",
            onPress: async () => {
              try {
                await supabase.from('feedback').insert({
                  userid: currentUser.id,
                  feedback: `[REPORT] Message ID: ${message.id} Content: ${content}`
                });
                Alert.alert("Reported", "Thank you for reporting. Our team will review this message.");
              } catch (e) {
                console.error("Report error:", e);
              }
            }
          },
          {
            text: "Cancel",
            style: "cancel"
          }
        ]
      );
    };

    const { city_name, zone_name, feedView } = useLocationStore();

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
    
    if (subRef.current) supabase.removeChannel(subRef.current);
    
    const subscription = supabase
      .channel(`help_chat_${currentUser.id}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          table: 'rhelp_messages'
        }, 
        payload => {
          const newMsg = payload.new;
          if (Number(newMsg.sender_id) === Number(currentUser.id) || Number(newMsg.receiver_id) === Number(currentUser.id)) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              
              const optimisticIdx = prev.findIndex(m => 
                m.sender_id === newMsg.sender_id && 
                m.content === newMsg.content && 
                m.id > 1000000000000
              );

              if (optimisticIdx !== -1) {
                const newMessages = [...prev];
                newMessages[optimisticIdx] = newMsg;
                return newMessages;
              } else {
                return [...prev, newMsg];
              }
            });

            if (Number(newMsg.receiver_id) === Number(currentUser.id)) {
              if (newMsg.status === 'resolved' || newMsg.content.includes("Please rate 1-5")) {
                setShowRating(true);
              }
            }
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
          if (Number(newMsg.receiver_id) === Number(currentUser.id) && newMsg.status === 'resolved') {
            setShowRating(true);
            initChat();
          }
        }
      )
      .subscribe();

    subRef.current = subscription;

    return () => {
      if (subRef.current) supabase.removeChannel(subRef.current);
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
            if (!inputText.trim() || !currentUser || isSendingRef.current) return;
            
            if (messages.some(m => m.status === 'resolved')) {
              await purgeMessages();
            }
      
            const text = inputText.trim();
            isSendingRef.current = true;
            setInputText('');
            if (inputRef.current) {
              inputRef.current.clear();
              if (Platform.OS !== 'web') {
                inputRef.current.setNativeProps({ text: '' });
              }
            }
            
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  
      const tempId = Date.now();
      const tempMsg = {
        id: tempId,
        sender_id: currentUser.id,
        content: text,
        is_from_admin: false,
        created_at: new Date().toISOString(),
        status: 'open'
      };
      setMessages(prev => [...prev, tempMsg]);
  
        try {
          setIsTyping(true);
          const { data: realMsg, error } = await supabase
            .from('rhelp_messages')
            .insert({
              sender_id: currentUser.id,
              content: text,
              is_from_admin: false
            })
            .select()
            .single();
    
          if (error) throw error;
    
          if (realMsg) {
            setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m));
          }
    
          const isOvertaken = messages.some(m => m.status === 'overtaken');
          if (isOvertaken) {
            console.log("Chat overtaken by agent. AI suppressed.");
            setIsTyping(false);
            return;
          }
    
            const history = messages.slice(-10).map(m => {
              let cleanContent = m.content;
              try {
                if (m.content.trim().startsWith('{') && m.content.trim().endsWith('}')) {
                  const parsed = JSON.parse(m.content);
                  if (parsed.text) cleanContent = parsed.text;
                }
              } catch (e) {}
              
              return {
                role: m.is_from_admin ? 'assistant' : 'user',
                content: cleanContent
              };
            });
    
          const aiResponse = await getAIAssistantResponse(text, history, {
            city_name,
            zone_name,
            feedView,
            username: currentUser?.username
          });
  
          let messageContent = typeof aiResponse === 'string' ? aiResponse : aiResponse.text;
          
          // Double check JSON in the UI side just in case
          try {
            if (messageContent.trim().startsWith('{') && messageContent.trim().endsWith('}')) {
              const parsed = JSON.parse(messageContent);
              if (parsed.text) messageContent = parsed.text;
            }
          } catch (e) {}

          const imageUrl = typeof aiResponse === 'object' ? aiResponse.imageUrl : null;
          
          if (imageUrl) {
            messageContent = messageContent + `\n[TOWNY_IMAGE:${imageUrl}]`;
          }

          await supabase
            .from('rhelp_messages')
            .insert({
              receiver_id: currentUser.id,
              content: messageContent,
              is_from_admin: true
            });
                
                const { sendHelpMessageNotification } = require('@/utils/notifications');
                await sendHelpMessageNotification({
                  senderId: 'assistant',
                  senderUsername: 'Towny',
                  receiverId: currentUser.id,
                  isFromAdmin: true,
                  messageContent: typeof aiResponse === 'string' ? aiResponse : aiResponse.text
                });
      
            } catch (error) {
              console.error("Error in handleSend:", error);
              setInputText(text);
              setMessages(prev => prev.filter(m => m.id !== tempId));
              Alert.alert("Error", "Message could not be sent.");
            } finally {
              isSendingRef.current = false;
              setIsTyping(false);
            }
        };

    const handleExpandImage = async () => {
      if (!selectedImage || isExpanding) return;
      
      setIsExpanding(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      try {
        const expandedUrl = await expandImage(selectedImage);
        if (expandedUrl) {
          setSelectedImage(null);
          const messageContent = `I've expanded that image for you!\n[TOWNY_IMAGE:${expandedUrl}]`;
          
          await supabase
            .from('rhelp_messages')
            .insert({
              receiver_id: currentUser.id,
              content: messageContent,
              is_from_admin: true
            });
            
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Alert.alert("Expansion Failed", "Towny couldn't expand this image right now.");
        }
      } catch (error) {
        console.error("Expansion error:", error);
        Alert.alert("Error", "Something went wrong while expanding the image.");
      } finally {
        setIsExpanding(false);
      }
    };

    const handleKeyPress = (e) => {
      if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
        if (Platform.OS === 'web') {
          e.preventDefault();
        }
        handleSend();
      }
    };

      const renderMessageContent = (content, isMine) => {
        let displayContent = content;
        let displayImageUrl = null;
  
        // Try parsing as JSON first (safety for corrupted history)
        try {
          if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
            const parsed = JSON.parse(content);
            if (parsed.text) displayContent = parsed.text;
            if (parsed.imageUrl) displayImageUrl = parsed.imageUrl;
          }
        } catch (e) {
          // Not JSON, continue
        }
  
        const imageMatch = displayContent.match(/\[TOWNY_IMAGE:(.+?)\]/);
        
        if (imageMatch || displayImageUrl) {
          const imageUrl = displayImageUrl || imageMatch[1];
          const textContent = imageMatch 
            ? displayContent.replace(/\[TOWNY_IMAGE:.+?\]/, '').trim()
            : displayContent;
          
          return (
            <View>
              {textContent ? (
                <Text style={[styles.messageText, { color: isMine ? '#000000' : '#FFFFFF' }]}>
                  {textContent}
                </Text>
              ) : null}
              <TouchableOpacity 
                activeOpacity={0.9} 
                onPress={() => {
                  setSelectedImage(imageUrl);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.generatedImage}
                  contentFit="cover"
                />
              </TouchableOpacity>
            </View>
          );
        }
        
        return (
          <Text style={[styles.messageText, { color: isMine ? '#000000' : '#FFFFFF' }]}>
            {displayContent}
          </Text>
        );
      };



  return (
    <View style={[styles.container, isHippie && { backgroundColor: 'transparent' }]}>
      {!isHippie && (
        <LinearGradient
          colors={['#0F172A', '#000000', '#000000']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={{ paddingTop: insets.top, flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft color="#FFFFFF" size={28} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Sparkles size={18} color="#FBBF24" />
            <Text style={styles.headerTitle}>TOWNY</Text>
          </View>
          <TouchableOpacity 
            onPress={async () => {
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
                  styles.messageWrapper,
                  isMine ? styles.myMessageWrapper : styles.theirMessageWrapper
                ]}>
                    {!isMine && (
                      <View style={styles.assistantAvatar}>
                        <Sparkles size={12} color="#FBBF24" />
                      </View>
                    )}
                    <TouchableOpacity 
                      activeOpacity={0.8}
                      onLongPress={() => handleMessageAction(item)}
                      delayLongPress={500}
                      style={[
                        styles.messageBubble, 
                        isMine ? styles.myMessage : styles.theirMessage,
                        isResolved && { borderLeftWidth: 4, borderLeftColor: '#10B981' }
                      ]}
                    >
                        {!isMine && <Text style={styles.adminLabel}>TOWNY</Text>}
                      {renderMessageContent(item.content, isMine)}
                    <View style={styles.messageFooter}>
                      <Text style={[styles.messageTime, { color: isMine ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)' }]}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            }}
          ListFooterComponent={
            <View>
              {isTyping && (
                <View style={[styles.messageWrapper, styles.theirMessageWrapper]}>
                  <View style={styles.assistantAvatar}>
                    <Sparkles size={12} color="#FBBF24" />
                  </View>
                  <View style={[styles.messageBubble, styles.theirMessage, { width: 60, alignItems: 'center' }]}>
                    <ActivityIndicator size="small" color="#FBBF24" />
                  </View>
                </View>
              )}
              {showRating && (
                <View style={styles.inChatRatingContainer}>
                  <View style={styles.ratingCard}>
                    <Text style={styles.ratingTitle}>HOW WAS TOWNY?</Text>
                    
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
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Sparkles size={48} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyTitle}>Hey! I'm Towny</Text>
              <Text style={styles.emptyText}>Chat with me about anything - ask questions, roleplay, get creative, or just hang out. I can even generate images for you!</Text>
            </View>
          }
        />

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Talk to Towny..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={inputText}
                  onChangeText={setInputText}
                  onKeyPress={handleKeyPress}
                  multiline
                  blurOnSubmit={false}
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

      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill}>
          <TouchableOpacity 
            style={styles.modalCloseOverlay}
            activeOpacity={1}
            onPress={() => setSelectedImage(null)}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setSelectedImage(null)}
              >
                <X color="#FFFFFF" size={24} />
              </TouchableOpacity>
              
              <Image 
                source={{ uri: selectedImage }}
                style={styles.modalImage}
                contentFit="contain"
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.expandButton, isExpanding && styles.expandButtonDisabled]}
                  onPress={handleExpandImage}
                  disabled={isExpanding}
                >
                  {isExpanding ? (
                    <ActivityIndicator color="#000000" size="small" />
                  ) : (
                    <>
                      <Maximize2 size={20} color="#000000" />
                      <Text style={styles.expandButtonText}>AI EXPAND</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </BlurView>
      </Modal>
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
      gap: 20,
    },
    messageWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginVertical: 4,
    },
    myMessageWrapper: {
      justifyContent: 'flex-end',
    },
    theirMessageWrapper: {
      justifyContent: 'flex-start',
    },
    assistantAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(251,191,36,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
      borderWidth: 1,
      borderColor: 'rgba(251,191,36,0.3)',
    },
    messageBubble: {
      maxWidth: '85%',
      padding: 18,
      borderRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    myMessage: {
      backgroundColor: '#FFFFFF',
      borderBottomRightRadius: 4,
    },
    theirMessage: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
    },
    messageText: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '500',
    },
    messageFooter: {
      marginTop: 8,
      alignItems: 'flex-end',
    },
    messageTime: {
      fontSize: 9,
      fontWeight: '700',
    },
    adminLabel: {
      fontSize: 9,
      fontWeight: '900',
      color: '#FBBF24',
      letterSpacing: 1.5,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    generatedImage: {
      width: '100%',
      height: 250,
      borderRadius: 16,
      marginTop: 12,
    },
    inChatRatingContainer: {
      padding: 20,
      marginTop: 20,
    },
    ratingCard: {
      backgroundColor: 'rgba(255,255,255,0.03)',
      width: '100%',
      borderRadius: 30,
      padding: 30,
      alignItems: 'center',
    },
    ratingTitle: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 2,
      textAlign: 'center',
    },
    starsContainer: {
      flexDirection: 'row',
      gap: 15,
      marginVertical: 30,
    },
    starButton: {
      padding: 5,
    },
    starText: {
      fontSize: 44,
      color: 'rgba(255,255,255,0.05)',
    },
    starActive: {
      color: '#FBBF24',
    },
    ratingInput: {
      width: '100%',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 15,
      padding: 20,
      color: '#FFFFFF',
      fontSize: 15,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    ratingButtons: {
      width: '100%',
      marginTop: 30,
    },
    submitButton: {
      backgroundColor: '#FFFFFF',
      paddingVertical: 18,
      borderRadius: 15,
      alignItems: 'center',
    },
    submitButtonText: {
      color: '#000000',
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 2,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 15,
      gap: 15,
      backgroundColor: 'transparent',
    },
    input: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 12,
      color: '#FFFFFF',
      fontSize: 15,
      maxHeight: 120,
    },
    sendButton: {
      backgroundColor: '#FBBF24',
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
    emptyTitle: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '700',
      marginTop: 20,
      marginBottom: 10,
    },
      emptyText: {
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        paddingHorizontal: 40,
        fontSize: 15,
        lineHeight: 22,
      },
      modalCloseOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
      },
      modalContent: {
        width: '90%',
        height: '80%',
        justifyContent: 'center',
        alignItems: 'center',
      },
      modalCloseButton: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
      },
      modalImage: {
        width: '100%',
        height: '70%',
        borderRadius: 20,
      },
      modalActions: {
        marginTop: 30,
        width: '100%',
        alignItems: 'center',
      },
      expandButton: {
        backgroundColor: '#FBBF24',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 25,
        paddingVertical: 15,
        borderRadius: 30,
        gap: 10,
      },
      expandButtonDisabled: {
        opacity: 0.7,
      },
      expandButtonText: {
        color: '#000000',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 2,
      },
    });

