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
  Share,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Heart,
  Star,
  Flag,
  Share as ShareIcon,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Send,
  Trash2,
  VolumeX,
  Pencil,
  Bookmark,
  Play,
} from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import { moderateContent } from "../utils/ai";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from 'expo-video';
import { getStoredUser } from "../utils/user";
import { TextInput } from "react-native-gesture-handler";

export default function PostItem({ item, deviceId, onReaction, onComment, onDelete, onMute, onShare, onEdit, user }) {
  const [showComments, setShowComments] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const flatListRef = useRef(null);

  const isVideo = item.media_type === 'video' || (item.image_url && (item.image_url.endsWith('.mp4') || item.image_url.endsWith('.mov')));
  
  const videoPlayer = useVideoPlayer(item.image_url, (player) => {
    player.loop = true;
  });

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments]);

  useEffect(() => {
    checkIfSaved();
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

  const handleSave = async () => {
    if (!user?.id) {
      alert("Please log in to save posts.");
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const originalState = isSaved;
    setIsSaved(!originalState);

    try {
      if (originalState) {
        await supabase
          .from('rsaved_posts')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', item.id);
      } else {
        await supabase
          .from('rsaved_posts')
          .insert({ user_id: user.id, post_id: item.id });
      }
    } catch (error) {
      console.error("Error saving post:", error);
      setIsSaved(originalState);
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const { data } = await supabase
        .from('rcomments')
        .select(`
          *,
          user:rusers (username, emoji_icon, avatar_url)
        `)
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
      
      const { data: userData } = await supabase
        .from('rusers')
        .select('is_muted')
        .eq('id', storedUser?.id)
        .single();
      
      if (userData?.is_muted) {
        alert("Your account is muted. You cannot reply at this time.");
        return;
      }
      
      const moderation = await moderateContent(commentText.trim());
      if (moderation.status === 'rejected') {
        alert(`Your comment was rejected by our AI moderator: ${moderation.reason}`);
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
        .select(`
          *,
          user:rusers (username, emoji_icon, avatar_url)
        `)
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
    }, 2000);

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
  
  return (
    <View style={styles.postContainer}>
      {shouldBlur && !revealed ? (
        <TouchableOpacity
          onPress={() => {
            setRevealed(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          activeOpacity={0.8}
          style={styles.blurBanner}
        >
          <AlertTriangle size={16} color="#EF4444" />
          <Text style={styles.blurText}>
            Reported as misleading by the community. Tap to reveal.
          </Text>
        </TouchableOpacity>
      ) : (
        <View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <View style={[styles.postHeader, { gap: 8 }]}>
                {!item.is_anonymous && (item.user?.avatar_url || item.user?.emoji_icon) ? (
                  item.user?.avatar_url ? (
                    <Image 
                      source={{ uri: item.user.avatar_url }} 
                      style={{ width: 24, height: 24, borderRadius: 12 }} 
                    />
                  ) : (
                    <Text style={{ fontSize: 16 }}>{item.user.emoji_icon}</Text>
                  )
                ) : (
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                    <User size={14} color="rgba(255,255,255,0.4)" />
                  </View>
                )}
                
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.zoneText, { color: '#FFFFFF' }]}>
                      {!item.is_anonymous && item.user?.username ? item.user.username : "Anonymous"}
                    </Text>
                    <Text style={[styles.timeText, { color: 'rgba(255, 255, 255, 0.3)' }]}>
                      · {item.zone?.name}
                    </Text>
                    <Text style={[styles.timeText, { color: 'rgba(255, 255, 255, 0.3)' }]}>
                      · {timeAgo}
                    </Text>
                  </View>
                  {item.tag?.name && (
                    <Text style={[styles.tagText, { color: 'rgba(255, 255, 255, 0.3)', marginTop: 1 }]}>
                      #{item.tag.name.replace(/\s+/g, '')}
                    </Text>
                  )}
                </View>
              </View>

              <Text style={[styles.postTitle, { color: '#FFFFFF', opacity: shouldBlur ? 0.6 : 1 }]}>
                {item.title || "Untitled Post"}
              </Text>
              
              <Text style={[styles.postBody, { color: 'rgba(255, 255, 255, 0.8)', marginTop: 8 }]} numberOfLines={3}>
                {item.text}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              {images.length > 0 && (
                <TouchableOpacity 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowFullImage(true);
                  }}
                  activeOpacity={0.9}
                  style={{ position: 'relative' }}
                >
                  {isVideo ? (
                    <View style={{ width: 80, height: 110, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' }}>
                      <VideoView
                        player={videoPlayer}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        nativeControls={false}
                      />
                      <View style={{ position: 'absolute', top: '50%', left: '50%', transform: [{translateX: -10}, {translateY: -10}], backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: 4 }}>
                        <Play size={12} color="#FFF" fill="#FFF" />
                      </View>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: images[currentImageIndex] }}
                      style={{ width: 80, height: 80, borderRadius: 8 }}
                      contentFit="cover"
                    />
                  )}
                  {hasMultipleImages && (
                    <View style={{
                      position: 'absolute',
                      bottom: 4,
                      right: 4,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      paddingHorizontal: 4,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '700' }}>
                        {currentImageIndex + 1}/{images.length}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onReaction(item.id, "helpful", userReactions.helpful);
          }}
          style={styles.actionButton}
        >
          <Heart
            size={18}
            color={userReactions.helpful ? "#F43F5E" : "rgba(255,255,255,0.4)"}
            fill={userReactions.helpful ? "#F43F5E" : "transparent"}
          />
          <Text style={[styles.actionCount, { color: userReactions.helpful ? "#F43F5E" : "rgba(255,255,255,0.4)" }]}>
            {helpfulCount || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowComments(true);
          }}
          style={styles.actionButton}
        >
          <Star
            size={18}
            color="rgba(255,255,255,0.4)"
          />
          <Text style={[styles.actionCount, { color: "rgba(255,255,255,0.4)" }]}>
            REPLY
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSave}
          style={styles.actionButton}
        >
          <Bookmark
            size={18}
            color={isSaved ? "#3B82F6" : "rgba(255,255,255,0.4)"}
            fill={isSaved ? "#3B82F6" : "transparent"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onShare(item)}
          style={styles.actionButton}
        >
          <ShareIcon size={18} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>

        {(user?.id === item.user_id || user?.is_admin || user?.is_moderator) && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onDelete(item.id);
            }}
            style={styles.actionButton}
          >
            <Trash2 size={18} color="rgba(239, 68, 68, 0.4)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Full Screen Image/Video Modal */}
      <Modal visible={showFullImage} transparent animationType="fade">
        <View style={styles.fullImageContainer}>
          <TouchableOpacity 
            style={styles.closeImageButton}
            onPress={() => setShowFullImage(false)}
          >
            <X color="#FFFFFF" size={32} />
          </TouchableOpacity>

          {isVideo ? (
            <VideoView
              player={videoPlayer}
              style={{ width: '100%', height: '80%' }}
              contentFit="contain"
              nativeControls
            />
          ) : hasMultipleImages ? (
            <>
              <FlatList
                ref={flatListRef}
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                  setCurrentImageIndex(index);
                }}
                getItemLayout={(_, index) => ({
                  length: Dimensions.get('window').width,
                  offset: Dimensions.get('window').width * index,
                  index,
                })}
                renderItem={({ item: imgUri }) => (
                  <View style={{ width: Dimensions.get('window').width, height: '100%', justifyContent: 'center' }}>
                    <Image
                      source={{ uri: imgUri }}
                      style={styles.fullImage}
                      contentFit="contain"
                    />
                  </View>
                )}
                keyExtractor={(i) => i}
              />
              <View style={styles.paginationDots}>
                {images.map((_, i) => (
                  <View 
                    key={i} 
                    style={[
                      styles.dot, 
                      { backgroundColor: i === currentImageIndex ? '#FFFFFF' : 'rgba(255,255,255,0.3)' }
                    ]} 
                  />
                ))}
              </View>
            </>
          ) : (
            <Image
              source={{ uri: images[0] }}
              style={styles.fullImage}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>

      {/* Comments / Replies Modal */}
      <Modal visible={showComments} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.commentsModal}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 20 }}>
                <Text style={styles.modalTitle}>REPLIES</Text>
                <TouchableOpacity onPress={() => setShowComments(false)}>
                  <X size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={comments}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
              ListHeaderComponent={() => (
                <View style={{ marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>{item.title}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>{item.text}</Text>
                </View>
              )}
              renderItem={({ item: c }) => (
                <View style={styles.commentItem}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 16 }}>{c.user?.emoji_icon || "👤"}</Text>
                    <Text style={styles.commentUser}>@{c.user?.username || "Anon"}</Text>
                  </View>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              )}
              ListEmptyComponent={() => (
                loadingComments ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.noComments}>No replies yet. Be the first!</Text>
                )
              )}
            />

            <View style={styles.modalInputContainer}>
              <TextInput
                style={styles.modalInput}
                placeholder="Write a reply..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity 
                style={styles.modalSendButton} 
                onPress={handleSendComment}
                disabled={!commentText.trim()}
              >
                <Send size={20} color={commentText.trim() ? "#FFF" : "rgba(255,255,255,0.2)"} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "NOW";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}M`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}H`;
  return `${Math.floor(seconds / 86400)}D`;
}

const styles = StyleSheet.create({
  postContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 1,
    position: 'relative',
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  zoneText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 11,
    marginLeft: 4,
  },
  tagText: {
    fontSize: 11,
    marginLeft: 4,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  postBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionCount: {
    fontSize: 12,
    fontWeight: "800",
  },
  blurBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    marginBottom: 8,
    gap: 10,
  },
  blurText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
  },
  commentItem: {
    marginBottom: 16,
  },
  commentUser: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  commentText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  noComments: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  fullImageContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageButton: {
    position: 'absolute',
    top: 50,
    right: 25,
    zIndex: 10,
    padding: 10,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  paginationDots: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  commentsModal: {
    backgroundColor: '#0F172A',
    height: '80%',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginBottom: 15,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 15,
    gap: 12,
  },
  modalInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    maxHeight: 100,
  },
  modalSendButton: {
    padding: 5,
  },
});


function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "NOW";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}M`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}H`;
  return `${Math.floor(seconds / 86400)}D`;
}

const styles = StyleSheet.create({
  postContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 1,
    position: 'relative',
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  zoneText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 11,
    marginLeft: 4,
  },
  tagText: {
    fontSize: 11,
    marginLeft: 4,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  expandedContent: {
    marginTop: 12,
  },
  postBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionCount: {
    fontSize: 13,
    fontWeight: "800",
  },
  blurBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    marginBottom: 8,
    gap: 10,
  },
  blurText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
  },
  commentsSection: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  commentsHeader: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 15,
  },
  commentItem: {
    marginBottom: 12,
  },
  commentUser: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  commentText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 18,
  },
  noComments: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 15,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    gap: 10,
  },
  commentInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    maxHeight: 80,
    paddingTop: 4,
  },
  sendButton: {
    padding: 4,
  },
  fullImageContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageButton: {
    position: 'absolute',
    top: 50,
    right: 25,
    zIndex: 10,
    padding: 10,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  navOverlay: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    pointerEvents: 'box-none',
  },
  navButton: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 25,
    padding: 5,
  },
  paginationDots: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
