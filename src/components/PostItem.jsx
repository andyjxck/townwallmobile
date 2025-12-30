import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import {
    Heart,
    Star,
    Flag,
    Share as ShareIcon,
    AlertTriangle,
    X,
    User,
    Send,
    Pencil,
    Play,
    MessageCircle,
    CloudOff,
    MoreVertical,
    Trash2,
    MessageSquareOff,
    EyeOff,
    Users,
  } from "lucide-react-native";
import { useChatStore } from "../utils/auth";

import { supabase } from "../utils/supabase";
import { moderateContent } from "../utils/ai";
import { sendNotification, sendCommentNotification } from "../utils/notifications";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Video } from "expo-av";
import { getStoredUser, isOnline } from "../utils/user";
import { TextInput } from "react-native-gesture-handler";
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import PollComponent from "./PollComponent";
import { useRouter, useLocalSearchParams, usePathname } from "expo-router";
import { theme } from "../utils/theme";

export default function PostItem({ item, deviceId, onReaction, onComment, onDelete, onShare, onEdit, user, onFilterZone, onFilterTag, onModAction }) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  
  const [revealed, setRevealed] = useState(false);
  const [blurRevealed, setBlurRevealed] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnonComment, setIsAnonComment] = useState(false);
  const [userNickname, setUserNickname] = useState("");
  const [showModMenu, setShowModMenu] = useState(false);
  const [showBlurModal, setShowBlurModal] = useState(false);
  const [blurReasonInput, setBlurReasonInput] = useState("");

  const [loadingLikers, setLoadingLikers] = useState(false);
  const [likers, setLikers] = useState([]);
  const [superlikers, setSuperlikers] = useState([]);
  const [showLikersModal, setShowLikersModal] = useState(false);
    const [showSuperlikersModal, setShowSuperlikersModal] = useState(false);
    
    const [ctaLoading, setCtaLoading] = useState(false);

    const handleCTA = async () => {
      if (!user) {
        Alert.alert("Authentication Required", "Please sign in to use this feature.");
        return;
      }
      
      setCtaLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        if (item.cta_type === 'chat') {
          // One-on-one chat
          if (item.user_id === user.id) {
            Alert.alert("Note", "This is your own post!");
            return;
          }

          // Check if chat already exists
          const { data: existingChats } = await supabase
            .from('rchats')
            .select('*')
            .or(`and(user1_id.eq.${user.id},user2_id.eq.${item.user_id}),and(user1_id.eq.${item.user_id},user2_id.eq.${user.id})`)
            .eq('is_group', false);

          let chatId;
          if (existingChats && existingChats.length > 0) {
            chatId = existingChats[0].id;
          } else {
            const { data: newChat } = await supabase
              .from('rchats')
              .insert({
                user1_id: user.id,
                user2_id: item.user_id,
                initiated_by: user.id,
                status: 'pending',
                is_group: false
              })
              .select()
              .single();
            chatId = newChat.id;
          }
          
          if (chatId) {
            useChatStore.getState().setActiveChatId(chatId);
            useChatStore.getState().open();
          }
        } else if (item.cta_type === 'group' && item.cta_group_id) {
          // Join group chat
          const { data: membership } = await supabase
            .from('rchat_members')
            .select('*')
            .eq('chat_id', item.cta_group_id)
            .eq('user_id', user.id)
            .single();

          if (!membership) {
            await supabase.from('rchat_members').insert({
              chat_id: item.cta_group_id,
              user_id: user.id,
              is_admin: false
            });
          }

          useChatStore.getState().setActiveChatId(item.cta_group_id);
          useChatStore.getState().open();
        }
      } catch (e) {
        console.error(e);
        Alert.alert("Error", "Failed to process request");
      } finally {
        setCtaLoading(false);
      }
    };

    const fetchLikers = async (type) => {


    setLoadingLikers(true);
    try {
      const { data } = await supabase
        .from('rreactions')
        .select('user:rusers!user_id(id, username, emoji_icon, avatar_url, supabase_uid)')
        .eq('post_id', item.id)
        .eq('reaction_type', type);
      const users = data?.map(r => r.user).filter(Boolean) || [];
      if (type === 'helpful') setLikers(users);
      else setSuperlikers(users);
    } catch (e) { console.error(e); }
    finally { setLoadingLikers(false); }
  };

  const isVideo = item.media_type === 'video' || (item.image_url && (item.image_url.endsWith('.mp4') || item.image_url.endsWith('.mov')));

  useEffect(() => {
    if (isExpanded) fetchComments();
  }, [isExpanded, item.id]);

    const fetchComments = async () => {
      setLoadingComments(true);
      try {
        const { data } = await supabase.from('rcomments').select(`*, user:rusers (username, emoji_icon, avatar_url, nickname)`).eq('post_id', item.id).order('created_at', { ascending: true });
        setComments(data || []);
        
        const storedUser = await getStoredUser();
        if (storedUser) {
          const { data: profile } = await supabase.from('rusers').select('nickname').eq('id', storedUser.id).single();
          setUserNickname(profile?.nickname || "");
        }
      } catch (error) { console.error(error); }
      finally { setLoadingComments(false); }
    };

    const handleSendComment = async () => {
      if (!commentText.trim()) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const storedUser = await getStoredUser();
        const { data: commentData } = await supabase.from('rcomments').insert({
          post_id: item.id,
          user_id: storedUser?.id,
          text: commentText.trim(),
          device_id: deviceId,
          is_anonymous: isAnonComment,
          nickname: isAnonComment ? userNickname : null
        }).select(`*, user:rusers (username, emoji_icon, avatar_url, nickname)`).single();

      if (item.user_id && item.user_id !== storedUser?.id) {
          await sendCommentNotification({
            commenterUsername: storedUser?.username || 'Someone',
            commenterId: storedUser?.id,
            postOwnerId: item.user_id,
            postTitle: item.title,
            commentText: commentText.trim()
          });
        }

      setComments([...comments, commentData]);
      setCommentText("");
      if (onComment) onComment(item.id);
    } catch (error) { console.error(error); }
  };

  const images = item.image_urls || (item.image_url ? [item.image_url] : []);
  const reactions = item.reactions || item.rreactions || [];
  const helpfulCount = reactions.filter(r => r.reaction_type === 'helpful').length;
  const superlikeCount = reactions.filter(r => r.reaction_type === 'superlike').length;
  const fakeCount = reactions.filter(r => r.reaction_type === 'fake').length;
  
  const userReactions = {
    helpful: reactions.some(r => r.reaction_type === 'helpful' && r.device_id === deviceId),
    superlike: reactions.some(r => r.reaction_type === 'superlike' && r.device_id === deviceId),
    fake: reactions.some(r => r.reaction_type === 'fake' && r.device_id === deviceId),
  };

  const shouldBlur = fakeCount > 5 && fakeCount > helpfulCount;
  const timeAgo = getTimeAgo(new Date(item.created_at));
    const isModOrAdmin = !!(user?.is_admin || user?.is_moderator);
    const isBlurredByMod = !!(item.is_blurred && item.blur_reason);
    const isRedactedMode = !!(shouldBlur || isBlurredByMod);
    const isRevealed = !!((shouldBlur && revealed) || (isBlurredByMod && blurRevealed));
    const isCurrentlyBlurred = !!(isRedactedMode && !isRevealed);

    const handleModAction = async (action, reason = null) => {

    setShowModMenu(false);
    if (onModAction) {
      await onModAction(item.id, action, reason);
    }
  };

  const handleBlurPost = () => {
    if (!blurReasonInput.trim()) return;
    handleModAction('blur', blurReasonInput.trim());
    setShowBlurModal(false);
    setBlurReasonInput("");
  };

  return (
    <View style={[styles.container, isCurrentlyBlurred && { paddingBottom: 10, marginBottom: 10 }]}>
      {item.isPending && (
        <View style={styles.pendingBanner}>
          <CloudOff size={14} color="#92400E" />
          <Text style={styles.pendingText}>Pending - Will sync when online</Text>
        </View>
      )}
        <View style={styles.card}>
          <View style={styles.header}>
            {isRedactedMode ? (
              <View style={[styles.avatar, styles.redactedAvatar]}>
                <User size={20} color="rgba(255,255,255,0.3)" />
              </View>
            ) : (
              <TouchableOpacity 
                onPress={() => {
                  const isUserAnon = !item.user?.supabase_uid;
                  if (!item.is_anonymous && !isUserAnon) {
                    router.push(`/profile?userId=${item.user_id}`);
                  }
                }} 
                disabled={item.is_anonymous || !item.user?.supabase_uid}
              >
                {item.user?.avatar_url ? (
                  <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
                ) : (
                  <Text style={styles.emojiAvatar}>{item.user?.emoji_icon || "👤"}</Text>
                )}
              </TouchableOpacity>
            )}

          <View style={styles.headerInfo}>
            {isRedactedMode ? (
              <View style={styles.redactedHeaderContainer}>
                <View style={[styles.redactedBar, { width: 80, height: 14, marginBottom: 6 }]} />
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <View style={[styles.redactedBar, { width: 50, height: 10 }]} />
                  <View style={[styles.redactedBar, { width: 40, height: 10 }]} />
                </View>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.username}>@{item.is_anonymous ? "Anonymous" : item.user?.username}</Text>
                  {!item.is_anonymous && isOnline(item.user?.last_seen) && <View style={styles.onlineDot} />}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  <TouchableOpacity onPress={() => onFilterZone?.(item.zone_id)}>
                    <Text style={styles.metaLink}>{item.zone?.name}</Text>
                  </TouchableOpacity>
                  <Text style={styles.metaText}>•</Text>
                  {item.tag?.name && (
                    <>
                      <TouchableOpacity onPress={() => onFilterTag?.(item.tag_id)}>
                        <Text style={styles.metaLink}>{item.tag?.name}</Text>
                      </TouchableOpacity>
                      <Text style={styles.metaText}>•</Text>
                    </>
                  )}
                  <Text style={styles.metaText}>{timeAgo}</Text>
                </View>
              </>
            )}
          </View>

          {!isCurrentlyBlurred && user?.id === item.user_id && !isRedactedMode && (
            <TouchableOpacity onPress={() => onEdit?.(item)}><Pencil size={18} color={theme.colors.textSecondary} /></TouchableOpacity>
          )}
          {isModOrAdmin && (
            <TouchableOpacity onPress={() => setShowModMenu(true)} style={{ marginLeft: 8 }}>
              <MoreVertical size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity 
          onPress={() => {
            if (isCurrentlyBlurred) {
              if (shouldBlur) setRevealed(true);
              else if (isBlurredByMod) setBlurRevealed(true);
            } else if (isRedactedMode) {
              // Revealed redacted state - tapping does nothing (actions disabled)
              return;
            } else {
              setIsExpanded(!isExpanded);
            }
          }} 
          style={[styles.body, isCurrentlyBlurred && { marginBottom: 0 }]}
        >
          {isCurrentlyBlurred ? (
            <View style={styles.blurredContentWrapper}>
              {isBlurredByMod ? (
                <View style={styles.modBlurOverlay}>
                  <EyeOff size={18} color="#FFF" />
                  <Text style={styles.blurTextContent}>Post blurred: {item.blur_reason}</Text>
                  <Text style={styles.tapToRevealText}>Tap to reveal</Text>
                </View>
              ) : (
                <View style={styles.communityBlurOverlay}>
                  <AlertTriangle size={18} color={theme.colors.error} />
                  <Text style={[styles.blurText, { color: theme.colors.error }]}>Reported Content</Text>
                  <Text style={styles.tapToRevealText}>Tap to reveal</Text>
                </View>
              )}
            </View>
          ) : (
            <>
              {item.title && <Text style={[styles.title, isRedactedMode && styles.greyedOutText]}>{item.title}</Text>}
              <Text style={[styles.bodyText, isRedactedMode && styles.greyedOutText]} numberOfLines={(isExpanded || isRedactedMode) ? undefined : 4}>
                {item.text?.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ')}
              </Text>
                {item.poll_id && <PollComponent pollId={item.poll_id} />}
              </>
            )}
          </TouchableOpacity>

          {!isCurrentlyBlurred && item.cta_type && item.cta_type !== 'none' && (
            <TouchableOpacity 
              onPress={handleCTA}
              disabled={ctaLoading}
              style={[
                styles.ctaButton, 
                { backgroundColor: item.cta_type === 'chat' ? theme.colors.primary : '#4ADE80' }
              ]}
            >
              {ctaLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  {item.cta_type === 'chat' ? (
                    <MessageCircle size={18} color="#000" />
                  ) : (
                    <Users size={18} color="#000" />
                  )}
                  <Text style={styles.ctaButtonText}>
                    {item.cta_type === 'chat' ? "Chat to me" : "Join group"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {!isCurrentlyBlurred && images.length > 0 && (

          <TouchableOpacity onPress={() => setShowFullImage(true)} style={styles.mediaContainer}>
            {isVideo ? (
              <Video
                source={{ uri: images[0] }}
                style={styles.media}
                resizeMode="cover"
                shouldPlay={isExpanded}
                isLooping
                isMuted
                useNativeControls={false}
              />
            ) : (
              <Image source={{ uri: images[0] }} style={styles.media} contentFit="cover" />
            )}
          </TouchableOpacity>
        )}

        {!isCurrentlyBlurred && (
          <View style={[styles.footer, isRedactedMode && { opacity: 0.5 }]}>
            <View style={styles.actions}>
              <TouchableOpacity 
                onPress={() => !isRedactedMode && onReaction(item.id, "helpful", userReactions.helpful)} 
                style={styles.actionBtn}
                disabled={isRedactedMode}
              >
                <Heart size={20} color={userReactions.helpful ? theme.colors.error : theme.colors.textSecondary} fill={userReactions.helpful ? theme.colors.error : "transparent"} />
                <TouchableOpacity 
                  onPress={() => !isRedactedMode && fetchLikers('helpful').then(() => setShowLikersModal(true))}
                  disabled={isRedactedMode}
                >
                  <Text style={styles.actionText}>{helpfulCount}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => !isRedactedMode && onReaction(item.id, "superlike", userReactions.superlike)} 
                style={styles.actionBtn}
                disabled={isRedactedMode}
              >
                <Star size={20} color={userReactions.superlike ? "#FBBF24" : theme.colors.textSecondary} fill={userReactions.superlike ? "#FBBF24" : "transparent"} />
                <TouchableOpacity 
                  onPress={() => !isRedactedMode && fetchLikers('superlike').then(() => setShowSuperlikersModal(true))}
                  disabled={isRedactedMode}
                >
                  <Text style={styles.actionText}>{superlikeCount}</Text>
                </TouchableOpacity>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => !isRedactedMode && onShare(item)} 
                style={styles.actionBtn}
                disabled={isRedactedMode}
              >
                <ShareIcon size={20} color={theme.colors.textSecondary} />
                <Text style={styles.actionText}>{item.share_count || 0}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              onPress={() => !isRedactedMode && onReaction(item.id, "fake", userReactions.fake)}
              disabled={isRedactedMode}
            >
              <Flag size={18} color={userReactions.fake ? theme.colors.error : theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {isExpanded && !isCurrentlyBlurred && !item.comments_disabled && (
          <View style={styles.commentsSection}>
            {loadingComments ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.commentList}>
                {comments.map(c => (
                  <View key={c.id} style={styles.commentRow}>
                    <View style={styles.commentAvatarContainer}>
                      {c.is_anonymous ? (
                        <View style={[styles.miniAvatar, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                          <User size={12} color={theme.colors.textSecondary} />
                        </View>
                      ) : (
                        c.user?.avatar_url ? (
                          <Image source={{ uri: c.user.avatar_url }} style={styles.miniAvatar} />
                        ) : (
                          <Text style={styles.miniEmojiAvatar}>{c.user?.emoji_icon || "👤"}</Text>
                        )
                      )}
                    </View>
                    <View style={styles.commentContent}>
                      <View style={styles.commentBubble}>
                        <Text style={styles.commentUser}>
                          {c.is_anonymous ? (c.nickname || "Anonymous") : c.user?.username}
                        </Text>
                        <Text style={styles.commentText}>{c.text}</Text>
                      </View>
                      <Text style={styles.commentTime}>{getTimeAgo(new Date(c.created_at))}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            
            <View style={styles.inputRow}>
              <View style={styles.inputWrapper}>
                <TextInput 
                  style={styles.input} 
                  placeholder="Write a comment..." 
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={commentText} 
                  onChangeText={setCommentText}
                  multiline
                />
                <View style={styles.inputActions}>
                  <TouchableOpacity 
                    onPress={() => {
                      setIsAnonComment(!isAnonComment);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }} 
                    style={[
                      styles.anonToggleBtn,
                      isAnonComment && styles.anonToggleBtnActive
                    ]}
                  >
                    <User size={14} color={isAnonComment ? "#000" : "rgba(255,255,255,0.5)"} />
                  </TouchableOpacity>
                  {isAnonComment && (
                    <Text style={styles.anonLabel}>
                      {userNickname || "Anon"}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity 
                onPress={handleSendComment} 
                style={[styles.sendBtn, !commentText.trim() && { opacity: 0.5 }]}
                disabled={!commentText.trim()}
              >
                <Send size={18} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {isExpanded && item.comments_disabled && !isBlurredByMod && (
          <View style={styles.commentsDisabledBanner}>
            <MessageSquareOff size={16} color="rgba(255,255,255,0.5)" />
            <Text style={styles.commentsDisabledText}>Comments are disabled on this post</Text>
          </View>
        )}

        <Modal visible={showFullImage} transparent animationType="fade">
        <View style={styles.fullImageOverlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowFullImage(false)}><X color="#FFF" size={32} /></TouchableOpacity>
          {isVideo ? (
            <Video
  source={{ uri: images[0] }}
  style={styles.fullMedia}
  resizeMode="contain"
  shouldPlay
  isLooping
  useNativeControls
/>

          ) : (
            <Image source={{ uri: images[0] }} style={styles.fullMedia} contentFit="contain" />
          )}
        </View>
      </Modal>

      <Modal visible={showLikersModal || showSuperlikersModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{showSuperlikersModal ? 'Superlikes' : 'Likes'}</Text>
              <TouchableOpacity onPress={() => { setShowLikersModal(false); setShowSuperlikersModal(false); }}>
                <X color="#FFF" size={24} />
              </TouchableOpacity>
            </View>
            
            {loadingLikers ? (
              <ActivityIndicator size="large" color={theme.colors.primary} />
            ) : (
              <View>
                  {(showSuperlikersModal ? superlikers : likers).map((u, i) => (
                    <TouchableOpacity 
                      key={i} 
                      style={styles.userRow} 
                      onPress={() => { 
                        if (u.supabase_uid) {
                          setShowLikersModal(false); 
                          setShowSuperlikersModal(false); 
                          router.push(`/profile?userId=${u.id}`); 
                        }
                      }}
                      disabled={!u.supabase_uid}
                    >
                      {u.avatar_url ? (
                        <Image source={{ uri: u.avatar_url }} style={styles.userAvatar} />
                      ) : (
                        <Text style={styles.userEmoji}>{u.emoji_icon || '👤'}</Text>
                      )}
                      <Text style={styles.userName}>@{u.username}</Text>
                    </TouchableOpacity>
                  ))}
                {(showSuperlikersModal ? superlikers : likers).length === 0 && (
                  <Text style={styles.emptyText}>No reactions yet</Text>
                )}
              </View>
            )}
          </View>
          </View>
        </Modal>

        <Modal visible={showModMenu} transparent animationType="slide">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModMenu(false)}>
            <View style={styles.modMenuContent}>
              <Text style={styles.modMenuTitle}>Moderator Actions</Text>
              
              <TouchableOpacity style={styles.modMenuItem} onPress={() => { handleModAction('delete'); }}>
                <Trash2 size={20} color={theme.colors.error} />
                <Text style={[styles.modMenuText, { color: theme.colors.error }]}>Delete Post</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modMenuItem} onPress={() => { handleModAction('toggle_comments'); }}>
                <MessageSquareOff size={20} color={theme.colors.textSecondary} />
                <Text style={styles.modMenuText}>{item.comments_disabled ? 'Enable Comments' : 'Disable Comments'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modMenuItem} onPress={() => { setShowModMenu(false); setShowBlurModal(true); }}>
                <EyeOff size={20} color="#FBBF24" />
                <Text style={[styles.modMenuText, { color: '#FBBF24' }]}>Blur Post</Text>
              </TouchableOpacity>

              {item.is_blurred && (
                <TouchableOpacity style={styles.modMenuItem} onPress={() => { handleModAction('unblur'); }}>
                  <EyeOff size={20} color="#10B981" />
                  <Text style={[styles.modMenuText, { color: '#10B981' }]}>Remove Blur</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={[styles.modMenuItem, styles.modMenuCancel]} onPress={() => setShowModMenu(false)}>
                <Text style={styles.modMenuCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={showBlurModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.blurModalContent}>
              <Text style={styles.modMenuTitle}>Blur Post</Text>
              <Text style={styles.blurModalSubtitle}>Enter a reason that will be shown to users</Text>
              
              <TextInput
                style={styles.blurReasonInput}
                placeholder="Reason for blurring..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={blurReasonInput}
                onChangeText={setBlurReasonInput}
                multiline
              />
              
              <View style={styles.blurModalButtons}>
                <TouchableOpacity style={styles.blurModalCancel} onPress={() => { setShowBlurModal(false); setBlurReasonInput(""); }}>
                  <Text style={styles.blurModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.blurModalConfirm, !blurReasonInput.trim() && { opacity: 0.5 }]} 
                  onPress={handleBlurPost}
                  disabled={!blurReasonInput.trim()}
                >
                  <Text style={styles.blurModalConfirmText}>Blur Post</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

const styles = StyleSheet.create({
  container: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 20 },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', padding: 8, marginHorizontal: 15, marginBottom: 10, borderRadius: 8 },
  pendingText: { fontSize: 12, color: '#92400E' },
  card: { paddingHorizontal: 15 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  emojiAvatar: { fontSize: 30 },
  headerInfo: { flex: 1, marginLeft: 12 },
  username: { fontWeight: '700', fontSize: 15, color: '#FFF' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  metaText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  metaLink: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  body: { marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 6, color: '#FFF' },
  bodyText: { fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 22 },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginHorizontal: 15,
  },
  ctaButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
  },
  mediaContainer: { height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  media: { width: '100%', height: '100%' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  actions: { flexDirection: 'row', gap: 24 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  blurBanner: { backgroundColor: 'rgba(239,68,68,0.1)', padding: 20, borderRadius: 12, alignItems: 'center', flexDirection: 'row', gap: 10 },
  blurText: { fontWeight: 'bold' },
  fullImageOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  fullMedia: { width: '100%', height: '80%' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  userAvatar: { width: 36, height: 36, borderRadius: 18 },
  userEmoji: { fontSize: 28 },
  userName: { fontSize: 15, color: '#FFF', fontWeight: '600' },
  emptyText: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 20 },
  anonToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  anonToggleBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  anonLabel: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  commentsSection: { 
    marginTop: 15, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.05)', 
    paddingTop: 15 
  },
  commentList: {
    marginBottom: 15,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 10,
  },
  commentAvatarContainer: {
    paddingTop: 4,
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniEmojiAvatar: {
    fontSize: 18,
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
    borderRadius: 15,
    borderTopLeftRadius: 2,
  },
  commentUser: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
  },
  commentTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
    marginLeft: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    color: '#FFF',
    fontSize: 14,
    maxHeight: 100,
    paddingTop: Platform.OS === 'ios' ? 4 : 0,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 6,
  },
  sendBtn: {
    backgroundColor: theme.colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  modBlurBanner: {
    backgroundColor: '#DC2626',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 15,
  },
    modBlurText: {
      color: '#FFF',
      fontWeight: '700',
      fontSize: 14,
      flex: 1,
    },
    blurTextContent: {
      color: '#FFF',
      fontWeight: '700',
      fontSize: 14,
      textAlign: 'center',
    },
  commentsDisabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginHorizontal: 15,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
  },
    commentsDisabledText: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 13,
    },
    redactedAvatar: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    redactedHeaderContainer: {
      flex: 1,
    },
    redactedBar: {
      backgroundColor: '#000',
      borderRadius: 2,
    },
      blurredContentWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 12,
        padding: 15,
      },
    modBlurOverlay: {
      alignItems: 'center',
      gap: 8,
    },
    communityBlurOverlay: {
      alignItems: 'center',
      gap: 8,
    },
      tapToRevealText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 4,
        fontWeight: '600',
      },
      greyedOutText: {
        color: 'rgba(255,255,255,0.4)',
      },
      modMenuContent: {

    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modMenuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  modMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modMenuText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
  modMenuCancel: {
    marginTop: 10,
    borderBottomWidth: 0,
    justifyContent: 'center',
  },
  modMenuCancelText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    width: '100%',
  },
  blurModalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  blurModalSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 20,
  },
  blurReasonInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 15,
    color: '#FFF',
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  blurModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  blurModalCancel: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  blurModalCancelText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '600',
  },
  blurModalConfirm: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  blurModalConfirmText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 84600) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 84600)}d ago`;
}
