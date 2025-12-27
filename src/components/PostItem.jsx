import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  Trash2,
  Pencil,
  Play,
  MessageCircle,
} from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import { moderateContent } from "../utils/ai";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from 'expo-video';
import { getStoredUser } from "../utils/user";
import { TextInput } from "react-native-gesture-handler";
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import PollComponent from "./PollComponent";
import { useRouter, useLocalSearchParams, usePathname } from "expo-router";
import { useTheme, getTagColor } from "../utils/theme";

export default function PostItem({ item, deviceId, onReaction, onComment, onDelete, onMute, onShare, onEdit, user }) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const { colors, spacing, borderRadius, typography } = useTheme();
  
  const [revealed, setRevealed] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReactorsList, setShowReactorsList] = useState(false);
  const [reactorsListType, setReactorsListType] = useState(null);
  const [reactorsList, setReactorsList] = useState([]);
  const [loadingReactors, setLoadingReactors] = useState(false);
  const [shareCount, setShareCount] = useState(0);
  const flatListRef = useRef(null);

  const isVideo = item.media_type === 'video' || (item.image_url && (item.image_url.endsWith('.mp4') || item.image_url.endsWith('.mov')));
  
  const videoPlayer = useVideoPlayer(item.image_url, (player) => {
    player.loop = true;
  });

  useEffect(() => {
    let sub;
    if (isExpanded) {
      fetchComments();
      sub = supabase
        .channel(`post_comments_${item.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'rcomments', 
          filter: `post_id=eq.${item.id}` 
        }, () => {
          fetchComments();
        })
        .subscribe();
    }
    return () => {
      if (sub) supabase.removeChannel(sub);
    };
  }, [isExpanded, item.id]);

  useEffect(() => {
    checkIfSaved();
    fetchShareCount();
    const sharesSub = supabase
      .channel(`post_shares_${item.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rshares',
        filter: `post_id=eq.${item.id}`
      }, () => {
        fetchShareCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sharesSub);
    };
  }, [item.id, user?.id]);

  const checkIfSaved = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('rsaved_posts')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', item.id)
      .maybeSingle();
    setIsSaved(!!data);
  };

  const fetchShareCount = async () => {
    const { count } = await supabase
      .from('rshares')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', item.id);
    setShareCount(count || 0);
  };

  const fetchReactorsList = async (type) => {
    setLoadingReactors(true);
    setReactorsListType(type);
    setShowReactorsList(true);
    try {
      const { data } = await supabase
        .from('rreactions')
        .select('user_id, rusers!rreactions_user_id_fkey(id, username, emoji_icon, avatar_url)')
        .eq('post_id', item.id)
        .eq('reaction_type', type);
      setReactorsList(data?.map(r => r.rusers).filter(Boolean) || []);
    } catch (error) {
      console.error("Error fetching reactors:", error);
    } finally {
      setLoadingReactors(false);
    }
  };

  const navigateToProfile = (userId) => {
    if (!userId) return;
    if (pathname === '/profile' && params.userId === String(userId)) return;
    if (pathname === '/profile' && !params.userId && user?.id === userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/profile?userId=${userId}`);
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const { data } = await supabase
        .from('rcomments')
        .select(`*, user:rusers (username, emoji_icon, avatar_url)`)
        .eq('post_id', item.id)
        .order('created_at', { ascending: true });
      setComments(data || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const storedUser = await getStoredUser();
      const { data: userData } = await supabase.from('rusers').select('is_muted').eq('id', storedUser?.id).single();
      if (userData?.is_muted) {
        alert("Your account is muted.");
        return;
      }
      
      const moderation = await moderateContent(commentText.trim());
      if (moderation.status === 'rejected') {
        alert(`Rejected: ${moderation.reason}`);
        return;
      }

      const { data, error } = await supabase
        .from('rcomments')
        .insert({
          post_id: item.id,
          user_id: storedUser?.id,
          text: commentText.trim(),
          device_id: deviceId,
          moderation_status: moderation.status,
          moderation_reason: moderation.reason,
        })
        .select(`*, user:rusers (username, emoji_icon, avatar_url)`)
        .single();
      
      if (error) throw error;
      setComments([...comments, data]);
      setCommentText("");
      if (onComment) onComment(item.id);
    } catch (error) {
      console.error("Error sending comment:", error);
    }
  };

  const images = item.image_urls || (item.image_url ? [item.image_url] : []);
  const hasMultipleImages = images.length > 1 && !isVideo;

  useEffect(() => {
    if (showFullImage && flatListRef.current && hasMultipleImages) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: currentImageIndex, animated: false });
      }, 100);
    }
  }, [showFullImage]);

  useEffect(() => {
    if (!hasMultipleImages || showFullImage || isVideo) return;
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [hasMultipleImages, images.length, showFullImage, isVideo]);

  const reactions = item.reactions || item.rreactions || [];
  const helpfulCount = reactions.filter(r => r.reaction_type === 'helpful').length;
  const seenCount = reactions.filter(r => r.reaction_type === 'seen').length;
  const fakeCount = reactions.filter(r => r.reaction_type === 'fake').length;
  
  const userReactions = {
    helpful: reactions.some(r => r.reaction_type === 'helpful' && r.device_id === deviceId),
    seen: reactions.some(r => r.reaction_type === 'seen' && r.device_id === deviceId),
    fake: reactions.some(r => r.reaction_type === 'fake' && r.device_id === deviceId),
  };

  const shouldBlur = fakeCount > 5 && fakeCount > (helpfulCount + seenCount);
  const timeAgo = getTimeAgo(new Date(item.created_at));
  const tagBg = item.tag?.name ? getTagColor(item.tag.name, colors) : colors.tagGeneral;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {shouldBlur && !revealed ? (
        <TouchableOpacity
          onPress={() => {
            setRevealed(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          activeOpacity={0.8}
          style={[styles.blurBanner, { backgroundColor: colors.danger + '1A', borderColor: colors.danger + '33' }]}
        >
          <AlertTriangle size={18} color={colors.danger} />
          <Text style={[styles.blurText, { color: colors.danger }]}>
            Reported as misleading. Tap to reveal.
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => !item.is_anonymous && item.user_id && navigateToProfile(item.user_id)}
              disabled={item.is_anonymous || !item.user_id}
              activeOpacity={0.7}
              style={styles.avatarContainer}
            >
              {!item.is_anonymous && (item.user?.avatar_url || item.user?.emoji_icon) ? (
                item.user?.avatar_url ? (
                  <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
                ) : (
                  <Text style={styles.emojiAvatar}>{item.user.emoji_icon}</Text>
                )
              ) : (
                <View style={[styles.defaultAvatar, { backgroundColor: colors.background }]}>
                  <User size={16} color={colors.textSecondary} />
                </View>
              )}
            </TouchableOpacity>
            
            <View style={styles.headerInfo}>
              <View style={styles.metaRow}>
                <TouchableOpacity 
                  onPress={() => !item.is_anonymous && item.user_id && navigateToProfile(item.user_id)}
                  disabled={item.is_anonymous || !item.user_id}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.username, { color: colors.text }]}>
                    {!item.is_anonymous && item.user?.username ? item.user.username : "Anonymous"}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.dot, { color: colors.textTertiary }]}>•</Text>
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{timeAgo}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.zoneText, { color: colors.primary }]}>{item.zone?.name}</Text>
                {item.tag?.name && (
                  <>
                    <Text style={[styles.dot, { color: colors.textTertiary }]}>•</Text>
                    <View style={[styles.tagPill, { backgroundColor: tagBg }]}>
                      <Text style={[styles.tagLabel, { color: colors.textSecondary }]}>#{item.tag.name}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {(user?.id === item.user_id || user?.is_admin || user?.is_moderator) && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onEdit(item);
                }}
                style={styles.editButton}
              >
                <Pencil size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            onPress={() => setIsExpanded(!isExpanded)} 
            activeOpacity={0.8}
            style={styles.bodyContainer}
          >
            <Text style={[styles.title, { color: colors.text, ...typography.h3 }]}>
              {item.title || "Untitled Post"}
            </Text>
            
            {isExpanded ? (
              <View style={styles.htmlContainer}>
                <RenderHtml
                  contentWidth={width - 64}
                  source={{ html: item.text }}
                  tagsStyles={{
                    body: { color: colors.text, fontSize: 15, lineHeight: 22 },
                    p: { marginBottom: 12 },
                    img: { borderRadius: borderRadius.md, marginVertical: 12 }
                  }}
                />
              </View>
            ) : (
              <Text style={[styles.bodyText, { color: colors.textSecondary }]} numberOfLines={3}>
                {item.text.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim()}
              </Text>
            )}
            
            {item.poll_id && <PollComponent pollId={item.poll_id} />}
          </TouchableOpacity>

          {images.length > 0 && (
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowFullImage(true);
              }}
              activeOpacity={0.9}
              style={[styles.mediaContainer, { borderRadius: borderRadius.xl }]}
            >
              {isVideo ? (
                <View style={[styles.videoPreview, { backgroundColor: colors.background }]}>
                  <VideoView
                    player={videoPlayer}
                    style={styles.fullMedia}
                    contentFit="cover"
                    nativeControls={false}
                  />
                  <View style={styles.playOverlay}>
                    <Play size={24} color="#FFF" fill="#FFF" />
                  </View>
                </View>
              ) : (
                <Image
                  source={{ uri: images[currentImageIndex] }}
                  style={styles.fullMedia}
                  contentFit="cover"
                />
              )}
              {hasMultipleImages && (
                <View style={[styles.imageCountPill, { borderRadius: borderRadius.full }]}>
                  <Text style={styles.imageCountText}>{currentImageIndex + 1}/{images.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <View style={[styles.footer, { borderTopColor: colors.separator }]}>
            <View style={styles.actionGroup}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onReaction(item.id, "helpful", userReactions.helpful);
                }}
                style={[styles.reactionButton, userReactions.helpful && { backgroundColor: colors.reactionActive }]}
              >
                <Heart
                  size={20}
                  color={userReactions.helpful ? colors.secondary : colors.textTertiary}
                  fill={userReactions.helpful ? colors.secondary : "transparent"}
                />
                <Text style={[styles.reactionCount, { color: userReactions.helpful ? colors.text : colors.textSecondary }]}>
                  {helpfulCount || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsExpanded(!isExpanded)}
                style={styles.reactionButton}
              >
                <MessageCircle size={20} color={colors.textTertiary} />
                <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>
                  {comments.length || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onShare(item)}
                style={styles.reactionButton}
              >
                <ShareIcon size={20} color={colors.textTertiary} />
                <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>
                  {shareCount || 0}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onReaction(item.id, "fake", userReactions.fake);
              }}
              style={styles.reportButton}
            >
              <Flag size={18} color={userReactions.fake ? colors.danger : colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isExpanded && (
        <View style={[styles.expandedContent, { backgroundColor: colors.background }]}>
          <Text style={[styles.commentsTitle, { color: colors.textSecondary }]}>COMMENTS</Text>
          
          {loadingComments ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.commentsList}>
              {comments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <Text style={{ fontSize: 16 }}>{c.user?.emoji_icon || "👤"}</Text>
                    <Text style={[styles.commentUser, { color: colors.text }]}>@{c.user?.username}</Text>
                  </View>
                  <Text style={[styles.commentText, { color: colors.textSecondary }]}>{c.text}</Text>
                </View>
              ))}
              {comments.length === 0 && (
                <Text style={[styles.noComments, { color: colors.textTertiary }]}>No comments yet.</Text>
              )}
            </View>
          )}

          <View style={[styles.commentInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.commentInput, { color: colors.text }]}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textTertiary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity 
              onPress={handleSendComment}
              disabled={!commentText.trim()}
              style={[styles.sendButton, { backgroundColor: commentText.trim() ? colors.primary : colors.separator }]}
            >
              <Send size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={showFullImage} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setShowFullImage(false)}>
            <X color="#FFF" size={32} />
          </TouchableOpacity>
          {isVideo ? (
            <VideoView player={videoPlayer} style={styles.fullModalMedia} contentFit="contain" nativeControls />
          ) : (
            <Image source={{ uri: images[currentImageIndex] }} style={styles.fullModalMedia} contentFit="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  contentWrapper: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  emojiAvatar: {
    fontSize: 28,
  },
  defaultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
  },
  dot: {
    marginHorizontal: 6,
    fontSize: 12,
  },
  metaText: {
    fontSize: 13,
  },
  zoneText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  editButton: {
    padding: 8,
  },
  bodyContainer: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  mediaContainer: {
    height: 240,
    width: '100%',
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  fullMedia: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -24 }, { translateY: -24 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCountPill: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  imageCountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  reactionCount: {
    fontSize: 14,
    fontWeight: '700',
  },
  reportButton: {
    padding: 8,
  },
  expandedContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  commentsTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  commentsList: {
    gap: 16,
    marginBottom: 16,
  },
  commentItem: {
    gap: 4,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '700',
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 26,
  },
  noComments: {
    textAlign: 'center',
    paddingVertical: 12,
    fontSize: 14,
  },
  commentInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 24,
    borderWidth: 1,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 12,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  fullModalMedia: {
    width: '100%',
    height: '80%',
  },
  blurBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  blurText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "NOW";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
