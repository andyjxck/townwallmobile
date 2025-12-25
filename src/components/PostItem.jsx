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
  } from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import { moderateContent } from "../utils/ai";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { getStoredUser } from "../utils/user";
import { TextInput } from "react-native-gesture-handler";

export default function PostItem({ item, deviceId, onReaction, onComment, onDelete, onMute, onShare, onEdit, user }) {
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (expanded) {
      fetchComments();
    }
  }, [expanded]);

  const fetchComments = async () => {
    setLoadingComments(true);
      try {
        const { data } = await supabase
          .from('rcomments')
          .select(`
            *,
            user:user_id (username, emoji_icon, avatar_url)
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
        const user = await getStoredUser();
        
        // Check if muted
        const { data: userData } = await supabase
          .from('rusers')
          .select('is_muted')
          .eq('id', user?.id)
          .single();
        
        if (userData?.is_muted) {
          alert("Your account is muted. You cannot reply at this time.");
          return;
        }
        
        // AI Moderation
        const moderation = await moderateContent(commentText.trim());
        if (moderation.status === 'rejected') {
          alert(`Your comment was rejected by our AI moderator: ${moderation.reason}`);
          return;
        }

        const { data, error } = await supabase
          .from('rcomments')
          .insert({
            post_id: item.id,
            user_id: user?.id,
            text: commentText.trim(),
            device_id: deviceId,
            moderation_status: moderation.status,
            moderation_reason: moderation.reason,
          })
          .select(`
            *,
            rusers (username, emoji_icon, avatar_url)
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
  const hasMultipleImages = images.length > 1;

  useEffect(() => {
    if (showFullImage && flatListRef.current && hasMultipleImages) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: currentImageIndex, animated: false });
      }, 100);
    }
  }, [showFullImage]);

  useEffect(() => {
    if (!hasMultipleImages || showFullImage) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [hasMultipleImages, images.length, showFullImage]);

  const reactions = item.rreactions || [];
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
  const fullDate = new Date(item.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

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
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setExpanded(!expanded);
              }}
              activeOpacity={0.8}
              style={{ flex: 1 }}
            >
                <View style={[styles.postHeader, { gap: 8 }]}>
                  {!item.is_anonymous && (item.user?.avatar_url || item.user?.emoji_icon || item.rusers?.avatar_url || item.rusers?.emoji_icon) ? (
                    (item.user?.avatar_url || item.rusers?.avatar_url) ? (
                      <Image 
                        source={{ uri: item.user?.avatar_url || item.rusers?.avatar_url }} 
                        style={{ width: 24, height: 24, borderRadius: 12 }} 
                      />
                    ) : (
                      <Text style={{ fontSize: 16 }}>{item.user?.emoji_icon || item.rusers?.emoji_icon}</Text>
                    )
                  ) : (
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                      <User size={14} color="rgba(255,255,255,0.4)" />
                    </View>
                  )}
                  
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.zoneText, { color: '#FFFFFF' }]}>
                        {!item.is_anonymous && (item.user?.username || item.rusers?.username) ? (item.user?.username || item.rusers?.username) : "Anonymous"}
                      </Text>
                      <Text style={[styles.timeText, { color: 'rgba(255, 255, 255, 0.3)' }]}>
                        · {item.zone?.name || item.rzones?.name}
                      </Text>
                      <Text style={[styles.timeText, { color: 'rgba(255, 255, 255, 0.3)' }]}>
                        · {timeAgo}
                      </Text>
                    </View>
                    {(item.tag?.name || item.rtags?.name) && (
                      <Text style={[styles.tagText, { color: 'rgba(255, 255, 255, 0.3)', marginTop: 1 }]}>
                        #{(item.tag?.name || item.rtags?.name).replace(/\s+/g, '')}
                      </Text>
                    )}
                  </View>
                </View>

              <Text style={[styles.postTitle, { color: '#FFFFFF', opacity: shouldBlur ? 0.6 : 1 }]}>
                {item.title || "Untitled Post"}
              </Text>
            </TouchableOpacity>

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
                  <Image
                    source={{ uri: images[currentImageIndex] }}
                    style={{ width: 80, height: 80, borderRadius: 8 }}
                    contentFit="cover"
                  />
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

          {expanded && (
            <View style={styles.expandedContent}>
              <Text style={[styles.postBody, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                {item.text}
              </Text>
              
              <View style={styles.postFooter}>
                <Text style={[styles.footerText, { color: 'rgba(255, 255, 255, 0.4)' }]}>
                  Posted by {!item.is_anonymous && item.rusers?.username ? item.rusers.username : "Anonymous"}
                </Text>
                <Text style={[styles.footerText, { color: 'rgba(255, 255, 255, 0.4)' }]}>
                  {fullDate}
                </Text>
              </View>

              <View style={styles.commentsSection}>
                <Text style={styles.commentsHeader}>REPLIES</Text>
                {loadingComments ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.2)" />
                ) : comments.length > 0 ? (
                  comments.map((c) => (
                    <View key={c.id} style={styles.commentItem}>
                      <Text style={styles.commentUser}>
                        {c.rusers?.emoji_icon} @{c.rusers?.username || "Anon"}
                      </Text>
                      <Text style={styles.commentText}>{c.text}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noComments}>No replies yet. Be the first!</Text>
                )}

                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Write a reply..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                  />
                  <TouchableOpacity 
                    style={styles.sendButton} 
                    onPress={handleSendComment}
                    disabled={!commentText.trim()}
                  >
                    <Send size={18} color={commentText.trim() ? "#FFFFFF" : "rgba(255,255,255,0.2)"} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <Modal visible={showFullImage} transparent animationType="fade">
            <View style={styles.fullImageContainer}>
              <TouchableOpacity 
                style={styles.closeImageButton}
                onPress={() => setShowFullImage(false)}
              >
                <X color="#FFFFFF" size={32} />
              </TouchableOpacity>

              {hasMultipleImages ? (
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
                  
                  <View style={styles.navOverlay}>
                    <TouchableOpacity 
                      style={[styles.navButton, currentImageIndex === 0 && { opacity: 0 }]}
                      disabled={currentImageIndex === 0}
                      onPress={() => {
                        const newIndex = Math.max(0, currentImageIndex - 1);
                        setCurrentImageIndex(newIndex);
                        flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
                      }}
                    >
                      <ChevronLeft color="#FFFFFF" size={40} />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.navButton, currentImageIndex === images.length - 1 && { opacity: 0 }]}
                      disabled={currentImageIndex === images.length - 1}
                      onPress={() => {
                        const newIndex = Math.min(images.length - 1, currentImageIndex + 1);
                        setCurrentImageIndex(newIndex);
                        flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
                      }}
                    >
                      <ChevronRight color="#FFFFFF" size={40} />
                    </TouchableOpacity>
                  </View>

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
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => onReaction(item.id, "helpful", userReactions.helpful)}
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
          onPress={() => onReaction(item.id, "seen", userReactions.seen)}
          style={styles.actionButton}
        >
          <Star
            size={18}
            color={userReactions.seen ? "#F59E0B" : "rgba(255,255,255,0.4)"}
            fill={userReactions.seen ? "#F59E0B" : "transparent"}
          />
          <Text style={[styles.actionCount, { color: userReactions.seen ? "#F59E0B" : "rgba(255,255,255,0.4)" }]}>
            {seenCount || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onReaction(item.id, "fake", userReactions.fake)}
          style={styles.actionButton}
        >
          <Flag
            size={18}
            color={userReactions.fake ? "#EF4444" : "rgba(255,255,255,0.4)"}
            fill={userReactions.fake ? "#EF4444" : "transparent"}
          />
          <Text style={[styles.actionCount, { color: userReactions.fake ? "#EF4444" : "rgba(255,255,255,0.4)" }]}>
            {fakeCount || 0}
          </Text>
        </TouchableOpacity>

        {(user?.id === item.user_id || user?.is_admin || user?.is_moderator) && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onDelete(item.id);
            }}
            style={styles.actionButton}
          >
            <Trash2 size={18} color={user?.id === item.user_id ? "rgba(239, 68, 68, 0.4)" : "#EF4444"} />
          </TouchableOpacity>
        )}

        {user?.id === item.user_id && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onEdit(item);
            }}
            style={styles.actionButton}
          >
            <Pencil size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}

        {(user?.is_admin || user?.is_moderator) && user?.id !== item.user_id && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onMute(item.user_id);
            }}
            style={styles.actionButton}
          >
            <VolumeX size={18} color="#F59E0B" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => onShare(item)}
          style={styles.actionButton}
        >
          <ShareIcon size={18} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>
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
