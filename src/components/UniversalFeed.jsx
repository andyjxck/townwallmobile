import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
    ActivityIndicator,
    StyleSheet,
    Modal,
    Dimensions,
  } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  Plus,
  Settings,
  ArrowUp,
  ArrowDown,
  Search,
    ThumbsUp,
    Eye,
    Flag,
    AlertTriangle,
    X,
    ChevronLeft,
    ChevronRight,
    User,
    Send,
    Menu,
    Music,
    Briefcase,
    Shield,
    HelpCircle,
    MessageCircle,
  } from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/theme";
import { Image } from "expo-image";
import { getStoredUser } from "../utils/user";
import { TextInput } from "react-native-gesture-handler";

function PostItem({ item, deviceId, onReaction, onComment }) {
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
          rusers (username, emoji_icon, avatar_url)
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
      const { data, error } = await supabase
        .from('rcomments')
        .insert({
          post_id: item.id,
          user_id: user?.id,
          text: commentText.trim(),
          device_id: deviceId
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
      // Small delay to ensure FlatList is mounted
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
            Potentially misleading content. Tap to reveal.
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
                  {!item.is_anonymous && (item.rusers?.avatar_url || item.rusers?.emoji_icon) ? (
                    item.rusers.avatar_url ? (
                      <Image 
                        source={{ uri: item.rusers.avatar_url }} 
                        style={{ width: 24, height: 24, borderRadius: 12 }} 
                      />
                    ) : (
                      <Text style={{ fontSize: 16 }}>{item.rusers.emoji_icon}</Text>
                    )
                  ) : (
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                      <User size={14} color="rgba(255,255,255,0.4)" />
                    </View>
                  )}
                  
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.zoneText, { color: '#FFFFFF' }]}>
                        {!item.is_anonymous && item.rusers?.username ? item.rusers.username : "Anonymous"}
                      </Text>
                      <Text style={[styles.timeText, { color: 'rgba(255, 255, 255, 0.3)' }]}>
                        · {item.rzones?.name}
                      </Text>
                      <Text style={[styles.timeText, { color: 'rgba(255, 255, 255, 0.3)' }]}>
                        · {timeAgo}
                      </Text>
                    </View>
                    {item.rtags?.name && (
                      <Text style={[styles.tagText, { color: 'rgba(255, 255, 255, 0.3)', marginTop: 1 }]}>
                        #{item.rtags.name.replace(/\s+/g, '')}
                      </Text>
                    )}
                  </View>
                </View>

                <Text style={[styles.postTitle, { color: '#FFFFFF', opacity: shouldBlur ? 0.6 : 1 }]}>
                  {item.title || "Untitled Post"}
                </Text>
              </TouchableOpacity>

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

                {/* Comments Section */}
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
                    
                    {/* Navigation Arrows */}
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

                    {/* Pagination Dots */}
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

      {/* Action Row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => onReaction(item.id, "helpful", userReactions.helpful)}
          style={styles.actionButton}
        >
          <ThumbsUp
            size={18}
            color={userReactions.helpful ? "#4ADE80" : "rgba(255,255,255,0.4)"}
            fill={userReactions.helpful ? "#4ADE80" : "transparent"}
          />
          <Text style={[styles.actionCount, { color: userReactions.helpful ? "#4ADE80" : "rgba(255,255,255,0.4)" }]}>
            {helpfulCount || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onReaction(item.id, "seen", userReactions.seen)}
          style={styles.actionButton}
        >
          <Eye
            size={18}
            color={userReactions.seen ? "#60A5FA" : "rgba(255,255,255,0.4)"}
            fill={userReactions.seen ? "#60A5FA" : "transparent"}
          />
          <Text style={[styles.actionCount, { color: userReactions.seen ? "#60A5FA" : "rgba(255,255,255,0.4)" }]}>
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
      </View>
    </View>
  );
}

export default function UniversalFeed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const [posts, setPosts] = useState([]);
  const [zones, setZones] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [showMenu, setShowMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    fetchFilterData();
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const user = await getStoredUser();
    if (user) {
      const { data } = await supabase.from('rusers').select('is_admin').eq('id', user.id).single();
      setIsAdmin(!!data?.is_admin);
    }
  };

  const fetchFilterData = async () => {
    const { data: zData } = await supabase.from('rzones').select('*').order('name');
    const { data: tData } = await supabase.from('rtags').select('*').order('name');
    setZones(zData || []);
    setTags(tData || []);
  };

  const fetchPosts = useCallback(async () => {
    try {
        let query = supabase
          .from('rposts')
          .select(`
            *,
            rtags (name),
            rzones (name),
            rusers (username, emoji_icon, avatar_url),
            rreactions (reaction_type, device_id)
          `);

      if (selectedZone) query = query.eq('zone_id', selectedZone);
      if (selectedTag) query = query.eq('tag_id', selectedTag);

      query = query.order('created_at', { ascending: sortBy === 'oldest' });

      const { data, error } = await query;
      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedZone, selectedTag, sortBy]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  const handleReaction = async (postId, reactionType, currentlyReacted) => {
    if (!deviceId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (currentlyReacted) {
        await supabase
          .from('rreactions')
          .delete()
          .match({ post_id: postId, reaction_type: reactionType, device_id: deviceId });
      } else {
        await supabase
          .from('rreactions')
          .insert({ post_id: postId, reaction_type: reactionType, device_id: deviceId });
      }

      fetchPosts();
    } catch (error) {
      console.error("Error updating reaction:", error);
    }
  };

  const clearFilters = () => {
    setSelectedZone(null);
    setSelectedTag(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <StatusBar style="light" />
      
        <View style={{ paddingTop: insets.top }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.iconButton}>
              <Menu size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={[styles.logo, { color: '#FFFFFF' }]}>REDDITCH'D</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity 
                  style={styles.iconButton}
                  onPress={() => router.push("/profile")}
                >
                  <User size={22} color="#FFFFFF" />
                </TouchableOpacity>
              <TouchableOpacity 
                style={styles.iconButton}
                onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSortBy(s => s === 'newest' ? 'oldest' : 'newest');
              }}
            >
              {sortBy === 'newest' ? (
                <ArrowDown size={20} color="#FFFFFF" />
              ) : (
                <ArrowUp size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => router.push("/settings")}
            >
              <Settings size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.filterSection}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
            data={[{ id: null, name: 'ALL ZONES' }, ...zones]}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedZone(item.id)}
                style={styles.filterPill}
              >
                <Text style={[
                  styles.filterText,
                  { color: selectedZone === item.id ? '#FFFFFF' : 'rgba(255,255,255,0.4)', 
                    fontWeight: selectedZone === item.id ? '800' : '400' }
                ]}>
                  {item.name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            )}
            keyExtractor={item => `zone-${item.id}`}
          />

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.filterList, { marginTop: 4 }]}
            data={[{ id: null, name: 'EVERYTHING' }, ...tags]}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedTag(item.id)}
                style={styles.filterPill}
              >
                <Text style={[
                  styles.filterText,
                  { color: selectedTag === item.id ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                    fontWeight: selectedTag === item.id ? '800' : '400',
                    fontSize: 11 }
                ]}>
                  #{item.name.toUpperCase().replace(/\s+/g, '')}
                </Text>
              </TouchableOpacity>
            )}
            keyExtractor={item => `tag-${item.id}`}
          />
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={({ item }) => (
            <PostItem 
              item={item} 
              deviceId={deviceId} 
              onReaction={handleReaction} 
            />
          )}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFFFFF"
            />
          }
          contentContainerStyle={{ 
            paddingBottom: insets.bottom + 100,
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Search size={40} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
              <Text style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                No posts found.
              </Text>
              <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>CLEAR FILTERS</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/post");
        }}
        activeOpacity={0.9}
        style={styles.fab}
      >
        <Plus size={32} color="#000000" strokeWidth={3} />
      </TouchableOpacity>

      {/* Services Menu Modal */}
      <Modal
        visible={showMenu}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMenu(false)}
      >
        <View style={styles.menuOverlay}>
          <View style={[styles.menuContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>SERVICES</Text>
              <TouchableOpacity onPress={() => setShowMenu(false)} style={styles.menuCloseButton}>
                <X size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.menuGrid}>
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => { setShowMenu(false); router.push("/talent"); }}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
                  <Music size={24} color="#A855F7" />
                </View>
                <Text style={styles.menuItemLabel}>Local Talent</Text>
                <Text style={styles.menuItemPrice}>£0.99</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => { setShowMenu(false); router.push("/businesses"); }}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <Briefcase size={24} color="#3B82F6" />
                </View>
                <Text style={styles.menuItemLabel}>Businesses</Text>
                <Text style={styles.menuItemPrice}>£3.99</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => { setShowMenu(false); router.push("/councillor"); }}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <MessageCircle size={24} color="#F59E0B" />
                </View>
                <Text style={styles.menuItemLabel}>Councillor</Text>
                <Text style={styles.menuItemStatus}>SOON</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => { setShowMenu(false); router.push("/help"); }}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <HelpCircle size={24} color="#10B981" />
                </View>
                <Text style={styles.menuItemLabel}>Help / Contact</Text>
              </TouchableOpacity>

              {isAdmin && (
                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => { setShowMenu(false); router.push("/admin"); }}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <Shield size={24} color="#EF4444" />
                  </View>
                  <Text style={styles.menuItemLabel}>Moderation</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.menuFooter}>
              <Text style={styles.menuFooterText}>REDDITCH'D v1.0.0</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  logo: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  iconButton: {
    padding: 5,
  },
  filterSection: {
    paddingBottom: 10,
  },
  filterList: {
    paddingHorizontal: 20,
    gap: 15,
  },
  filterPill: {
    paddingVertical: 5,
  },
  filterText: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  postContainer: {
    paddingHorizontal: 20,
    paddingVertical: 18,
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
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionCount: {
    fontSize: 14,
    fontWeight: "600",
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 100,
    alignItems: "center",
  },
  clearButton: {
    marginTop: 20,
    padding: 10,
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
  fab: {
    position: "absolute",
    bottom: 35,
    right: 25,
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#FFFFFF',
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
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
    menuOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.95)',
    },
    menuContent: {
      flex: 1,
      paddingHorizontal: 30,
    },
    menuHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 40,
    },
    menuTitle: {
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: 4,
    },
    menuCloseButton: {
      padding: 5,
    },
    menuGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 20,
    },
    menuItem: {
      width: (Dimensions.get('window').width - 80) / 2,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    menuIconContainer: {
      width: 50,
      height: 50,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    menuItemLabel: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
    },
    menuItemPrice: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
    menuItemStatus: {
      color: '#F59E0B',
      fontSize: 10,
      fontWeight: '900',
      marginTop: 4,
    },
    menuFooter: {
      position: 'absolute',
      bottom: 50,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    menuFooterText: {
      color: 'rgba(255,255,255,0.2)',
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 2,
    },
  });

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "NOW";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}M`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}H`;
  return `${Math.floor(seconds / 86400)}D`;
}
