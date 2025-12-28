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
} from "lucide-react-native";
import { supabase } from "../utils/supabase";
import { moderateContent } from "../utils/ai";
import { sendNotification, sendCommentNotification } from "../utils/notifications";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from 'expo-video';
import { getStoredUser, isOnline } from "../utils/user";
import { TextInput } from "react-native-gesture-handler";
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import PollComponent from "./PollComponent";
import { useRouter, useLocalSearchParams, usePathname } from "expo-router";
import { theme } from "../utils/theme";

export default function PostItem({ item, deviceId, onReaction, onComment, onDelete, onShare, onEdit, user, onFilterZone, onFilterTag }) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  
  const [revealed, setRevealed] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnonComment, setIsAnonComment] = useState(false);
  const [userNickname, setUserNickname] = useState("");

  const [loadingLikers, setLoadingLikers] = useState(false);
  const [likers, setLikers] = useState([]);
  const [superlikers, setSuperlikers] = useState([]);
  const [showLikersModal, setShowLikersModal] = useState(false);
    const [showSuperlikersModal, setShowSuperlikersModal] = useState(false);
  
    const fetchLikers = async (type) => {

    setLoadingLikers(true);
    try {
      const { data } = await supabase
        .from('rreactions')
        .select('user:rusers!user_id(id, username, emoji_icon, avatar_url)')
        .eq('post_id', item.id)
        .eq('reaction_type', type);
      const users = data?.map(r => r.user).filter(Boolean) || [];
      if (type === 'helpful') setLikers(users);
      else setSuperlikers(users);
    } catch (e) { console.error(e); }
    finally { setLoadingLikers(false); }
  };

  const isVideo = item.media_type === 'video' || (item.image_url && (item.image_url.endsWith('.mp4') || item.image_url.endsWith('.mov')));
  const videoPlayer = useVideoPlayer(item.image_url, (player) => { player.loop = true; });

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

  return (
    <View style={styles.container}>
      {item.isPending && (
        <View style={styles.pendingBanner}>
          <CloudOff size={14} color="#92400E" />
          <Text style={styles.pendingText}>Pending - Will sync when online</Text>
        </View>
      )}
      {shouldBlur && !revealed ? (
        <TouchableOpacity onPress={() => setRevealed(true)} style={styles.blurBanner}>
          <AlertTriangle size={18} color={theme.colors.error} />
          <Text style={[styles.blurText, { color: theme.colors.error }]}>Reported Content. Tap to reveal.</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.card}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => !item.is_anonymous && router.push(`/profile?userId=${item.user_id}`)} disabled={item.is_anonymous}>
                {item.user?.avatar_url ? (
                  <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
                ) : (
                  <Text style={styles.emojiAvatar}>{item.user?.emoji_icon || "👤"}</Text>
                )}
              </TouchableOpacity>
              <View style={styles.headerInfo}>
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
                </View>
              {user?.id === item.user_id && (
                <TouchableOpacity onPress={() => onEdit?.(item)}><Pencil size={18} color={theme.colors.textSecondary} /></TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={styles.body}>
              {item.title && <Text style={styles.title}>{item.title}</Text>}
              <Text style={styles.bodyText} numberOfLines={isExpanded ? undefined : 4}>
                {item.text?.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ')}
              </Text>
              {item.poll_id && <PollComponent pollId={item.poll_id} />}
            </TouchableOpacity>

            {images.length > 0 && (
              <TouchableOpacity onPress={() => setShowFullImage(true)} style={styles.mediaContainer}>
                {isVideo ? (
                  <VideoView player={videoPlayer} style={styles.media} contentFit="cover" nativeControls={false} />
                ) : (
                  <Image source={{ uri: images[0] }} style={styles.media} contentFit="cover" />
                )}
              </TouchableOpacity>
            )}

            <View style={styles.footer}>
              <View style={styles.actions}>
                <TouchableOpacity 
                  onPress={() => onReaction(item.id, "helpful", userReactions.helpful)} 
                  style={styles.actionBtn}
                >
                  <Heart size={20} color={userReactions.helpful ? theme.colors.error : theme.colors.textSecondary} fill={userReactions.helpful ? theme.colors.error : "transparent"} />
                  <TouchableOpacity onPress={() => { fetchLikers('helpful'); setShowLikersModal(true); }}>
                    <Text style={styles.actionText}>{helpfulCount}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => onReaction(item.id, "superlike", userReactions.superlike)} 
                  style={styles.actionBtn}
                >
                  <Star size={20} color={userReactions.superlike ? "#FBBF24" : theme.colors.textSecondary} fill={userReactions.superlike ? "#FBBF24" : "transparent"} />
                  <TouchableOpacity onPress={() => { fetchLikers('superlike'); setShowSuperlikersModal(true); }}>
                    <Text style={styles.actionText}>{superlikeCount}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => onShare(item)} style={styles.actionBtn}>
                  <ShareIcon size={20} color={theme.colors.textSecondary} />
                  <Text style={styles.actionText}>{item.share_count || 0}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => onReaction(item.id, "fake", userReactions.fake)}>
                <Flag size={18} color={userReactions.fake ? theme.colors.error : theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {isExpanded && (
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
      )}

      <Modal visible={showFullImage} transparent animationType="fade">
        <View style={styles.fullImageOverlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowFullImage(false)}><X color="#FFF" size={32} /></TouchableOpacity>
          {isVideo ? (
            <VideoView player={videoPlayer} style={styles.fullMedia} contentFit="contain" nativeControls />
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
                  <TouchableOpacity key={i} style={styles.userRow} onPress={() => { setShowLikersModal(false); setShowSuperlikersModal(false); router.push(`/profile?userId=${u.id}`); }}>
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
});

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 84600) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 84600)}d ago`;
}
