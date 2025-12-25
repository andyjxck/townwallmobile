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
    Alert,
    Share,
    } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  ArrowUpDown,
  Plus,
  Settings,
  ArrowUp,
  ArrowDown,
  Search,
    Heart,
    Star,
    Flag,
    Share as ShareIcon,
    AlertTriangle,
    Zap,
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
      Bell,
      Trash2,
      LayoutGrid,
      Hash,
    } from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/theme";
import { Image } from "expo-image";
import { LinearGradient } from 'expo-linear-gradient';
import { getStoredUser, logoutUser } from "../utils/user";
import { useAuthStore } from "../utils/auth/store";
import { TextInput } from "react-native-gesture-handler";
import NotificationPanel from "./NotificationPanel";
import { fetchNotifications } from "@/utils/notifications";
import { ShareManager } from "./ShareManager";
import { BannerAd } from "@/components/BannerAd";
import PostItem from "./PostItem";

function SkeletonPost() {
  return (
    <View style={[styles.postContainer, { opacity: 0.5 }]}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <View style={[styles.postHeader, { gap: 8 }]}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <View style={{ height: 12, width: 100, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4 }} />
          </View>
          <View style={{ height: 20, width: '80%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginTop: 8 }} />
          <View style={{ height: 20, width: '60%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginTop: 4 }} />
        </View>
        <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' }} />
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
    const [showZones, setShowZones] = useState(false);
    const [showTags, setShowTags] = useState(false);
    const [isModerator, setIsModerator] = useState(false);
  const user = useAuthStore(state => state.auth);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const shareRef = useRef();

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    fetchFilterData();
    checkModerator();
    loadUnreadCount();

    // Subscribe to new notifications for the current user
    const setupNotificationSubscription = async () => {
      if (!user) return;

      const subscription = supabase
        .channel(`notifications_${user.id}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'rnotifications',
            filter: `user_id=eq.${user.id}`
          }, 
          () => {
            loadUnreadCount();
          }
        )
        .subscribe();

      return subscription;
    };

    let sub;
    setupNotificationSubscription().then(s => sub = s);

    return () => {
      if (sub) supabase.removeChannel(sub);
    };
  }, []);

  const loadUnreadCount = async () => {
    const user = await getStoredUser();
    if (user) {
      const { count } = await supabase
        .from('rnotifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    }
  };

  const checkModerator = async () => {
    const user = await getStoredUser();
    if (user) {
      const { data } = await supabase.from('rusers').select('is_admin, is_moderator').eq('id', user.id).single();
      setIsModerator(!!data?.is_admin || !!data?.is_moderator);
    }
  };

  const fetchFilterData = async () => {
    try {
      const [zonesRes, tagsRes] = await Promise.all([
        supabase.from('rzones').select('*').order('name'),
        supabase.from('rtags').select('*').order('name')
      ]);
      if (zonesRes.data) setZones(zonesRes.data);
      if (tagsRes.data) setTags(tagsRes.data);
    } catch (error) {
      console.error("Error fetching filter data:", error);
    }
  };

    const [lastError, setLastError] = useState(null);

    const fetchPosts = async (isRefreshing = false) => {
      if (!isRefreshing) setLoading(true);
      setLastError(null);
          try {
              // Use explicit join hints to resolve ambiguity and force LEFT JOINS
              let query = supabase
                .from('rposts')
                .select(`
                  id, 
                  title, 
                  text, 
                  created_at, 
                  user_id, 
                  zone_id, 
                  tag_id, 
                  image_url, 
                  image_urls, 
                  is_anonymous, 
                  moderation_status,
                  is_deleted,
                  user:rusers!user_id (username, emoji_icon, avatar_url),
                  zone:rzones!zone_id (name),
                  tag:rtags!tag_id (name),
                  reactions:rreactions (reaction_type, device_id)
                `)
                .eq('is_deleted', false)
                .eq('moderation_status', 'approved');

          if (selectedZone !== null && selectedZone !== undefined) {
            query = query.eq('zone_id', selectedZone);
          }
          if (selectedTag !== null && selectedTag !== undefined) {
            query = query.eq('tag_id', selectedTag);
          }

        if (sortBy === 'oldest') {
          query = query.order('created_at', { ascending: true });
        } else {
          query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query.limit(50);
        
        if (error) {
          console.error("Feed error:", error);
                  // Try an absolute bare-bones fallback if the complex one fails
                  const { data: fallback, error: fbError } = await supabase
                    .from('rposts')
                    .select(`
                      id, title, text, created_at, user_id, zone_id, tag_id, image_url, image_urls, is_anonymous,
                      user:rusers!user_id (username, emoji_icon, avatar_url),
                      zone:rzones!zone_id (name),
                      tag:rtags!tag_id (name)
                    `)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false })
                .limit(20);
          
          if (fallback && !fbError) {
            setPosts(fallback);
            setLastError(`Note: Showing simplified feed (${error.message})`);
          } else {
            console.error("Fallback error:", fbError);
            setLastError(fbError?.message || error.message);
            setPosts([]);
          }
        } else {
          setPosts(data || []);
          setLastError(null);
        }
      } catch (err) {
        console.error("Fetch catch:", err);
        setLastError(err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

  const handleReaction = async (postId, type) => {
    if (!user) {
      Alert.alert("Sign In", "Please sign in to react to posts.");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const { data: existing } = await supabase
        .from('rreactions')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        if (existing.reaction_type === type) {
          await supabase.from('rreactions').delete().eq('id', existing.id);
        } else {
          await supabase.from('rreactions').update({ reaction_type: type }).eq('id', existing.id);
        }
      } else {
        await supabase.from('rreactions').insert({
          post_id: postId,
          user_id: user.id,
          reaction_type: type,
          device_id: deviceId
        });
      }

      fetchPosts(true);
    } catch (error) {
      console.error("Error reacting:", error);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts(true);
  }, [selectedZone, selectedTag, sortBy]);

  useEffect(() => {
    fetchPosts();
  }, [selectedZone, selectedTag, sortBy]);

    const [moderationTarget, setModerationTarget] = useState(null); // { type: 'post' | 'user', id: string, data?: any }
    const [moderationReason, setModerationReason] = useState("");
    const [showModerationModal, setShowModerationModal] = useState(false);

    const handleMuteUser = async (userId) => {
      setModerationTarget({ type: 'user', id: userId });
      setModerationReason("");
      setShowModerationModal(true);
    };

    const handleDeletePost = async (postId) => {
      const post = posts.find(p => p.id === postId);
      setModerationTarget({ type: 'post', id: postId, data: post });
      setModerationReason("");
      setShowModerationModal(true);
    };

    const submitModeration = async () => {
      if (!moderationReason.trim()) {
        Alert.alert("Reason Required", "Please provide a reason for this action.");
        return;
      }

      try {
        const admin = await getStoredUser();
        if (moderationTarget.type === 'post') {
          // Soft delete post and log
          const { error: postError } = await supabase
            .from('rposts')
            .update({ 
              is_deleted: true,
              deletion_reason: moderationReason,
              deleted_by: admin.supabase_uid
            })
            .eq('id', moderationTarget.id);
          
          if (postError) throw postError;

          await supabase.from('rmoderation_logs').insert({
            moderator_id: admin.id,
            target_id: moderationTarget.id,
            target_type: 'post',
            action: 'delete_post',
            reason: moderationReason,
            metadata: moderationTarget.data
          });

        } else if (moderationTarget.type === 'user') {
          // Mute user and log
          const { error: userError } = await supabase
            .from('rusers')
            .update({ 
              is_muted: true,
              muted_at: new Date().toISOString(),
              muted_by: admin.supabase_uid,
              mute_reason: moderationReason
            })
            .eq('id', moderationTarget.id);
          
          if (userError) throw userError;

          await supabase.from('rmoderation_logs').insert({
            moderator_id: admin.id,
            target_id: moderationTarget.id,
            target_type: 'user',
            action: 'mute_user',
            reason: moderationReason
          });
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowModerationModal(false);
        fetchPosts();
        Alert.alert("Success", "Action completed and logged.");
      } catch (error) {
        console.error("Error in moderation action:", error);
        Alert.alert("Error", "Failed to complete action.");
      }
    };


    const handleEditPost = (post) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/post?id=${post.id}`);
    };

    const handleShare = async (post) => {
      shareRef.current?.share(post);
    };

    const clearFilters = () => {
    setSelectedZone(null);
    setSelectedTag(null);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#000000', '#000000']}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar style="light" />
      
        <View style={{ paddingTop: insets.top }}>
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                <Image 
                  source={require('../../assets/images/icon.png')} 
                  style={{ width: 32, height: 32, borderRadius: 8 }}
                  contentFit="contain"
                />
                <TouchableOpacity 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowZones(!showZones);
                    setShowTags(false);
                  }}
                  style={{ padding: 4 }}
                >
                  <LayoutGrid size={22} color={showZones ? "#FFFFFF" : "rgba(255,255,255,0.4)"} />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowTags(!showTags);
                    setShowZones(false);
                  }}
                  style={{ padding: 4 }}
                >
                  <Hash size={22} color={showTags ? "#FFFFFF" : "rgba(255,255,255,0.4)"} />
                </TouchableOpacity>
              </View>
                <View style={styles.headerActions}>
                  <TouchableOpacity 
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSortBy(s => {
                        if (s === 'newest') return 'popular';
                        if (s === 'popular') return 'oldest';
                        return 'newest';
                      });
                    }} 
                    style={styles.iconButton}
                  >
                    {sortBy === 'popular' ? (
                      <Zap size={20} color="#F59E0B" />
                    ) : (
                      <ArrowUpDown size={20} color={sortBy === 'newest' ? "#FFFFFF" : "rgba(255,255,255,0.4)"} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.iconButton}>
                    <Menu size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
            </View>

          {/* Dropdown Menu */}
          {showMenu && (
            <View style={[styles.dropdownContainer, { top: insets.top + 55 }]}>
                <TouchableOpacity 
                  style={styles.dropdownItem} 
                  onPress={() => { setShowMenu(false); router.push("/profile"); }}
                >
                  {user?.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={{ width: 18, height: 18, borderRadius: 9 }} />
                  ) : user?.emoji_icon ? (
                    <Text style={{ fontSize: 16 }}>{user.emoji_icon}</Text>
                  ) : (
                    <User size={18} color="#FFFFFF" />
                  )}
                  <Text style={styles.dropdownText}>PROFILE</Text>
                </TouchableOpacity>

                {user?.supabase_uid ? (
                  <TouchableOpacity 
                    style={styles.dropdownItem} 
                    onPress={() => { setShowMenu(false); logoutUser(); }}
                  >
                    <User size={18} color="#EF4444" />
                    <Text style={[styles.dropdownText, { color: '#EF4444' }]}>SIGN OUT</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={styles.dropdownItem} 
                    onPress={() => { setShowMenu(false); router.push("/auth?mode=login"); }}
                  >
                    <User size={18} color="#4ADE80" />
                    <Text style={[styles.dropdownText, { color: '#4ADE80' }]}>SIGN IN</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.dropdownDivider} />

              <TouchableOpacity 
                style={styles.dropdownItem} 
                onPress={() => { setShowMenu(false); router.push("/talent"); }}
              >
                <Music size={18} color="#A855F7" />
                <Text style={styles.dropdownText}>LOCAL TALENT</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.dropdownItem} 
                onPress={() => { setShowMenu(false); router.push("/businesses"); }}
              >
                <Briefcase size={18} color="#3B82F6" />
                <Text style={styles.dropdownText}>BUSINESSES</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.dropdownItem} 
                onPress={() => { setShowMenu(false); router.push("/help"); }}
              >
                <HelpCircle size={18} color="#10B981" />
                <Text style={styles.dropdownText}>HELP / CONTACT</Text>
              </TouchableOpacity>

                {isModerator && (
                  <TouchableOpacity 
                    style={styles.dropdownItem} 
                    onPress={() => { setShowMenu(false); router.push("/admin"); }}
                  >
                    <Shield size={18} color="#EF4444" />
                    <Text style={styles.dropdownText}>MODERATION</Text>
                  </TouchableOpacity>
                )}
            </View>
          )}

          <View style={styles.filterSection}>
            {showZones && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
              </View>
            )}

            {showTags && (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.filterList, { marginTop: showZones ? 4 : 0 }]}
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
            )}
          </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <FlatList
            data={[1, 2, 3, 4, 5]}
            renderItem={() => <SkeletonPost />}
            keyExtractor={i => i.toString()}
          />
        </View>
      ) : (
        <FlatList
          ListHeaderComponent={<BannerAd />}
          renderItem={({ item, index }) => (
            <View>
                  <PostItem 
                    item={item} 
                    deviceId={deviceId} 
                    onReaction={handleReaction} 
                    onDelete={handleDeletePost}
                    onMute={handleMuteUser}
                    onShare={handleShare}
                    onEdit={handleEditPost}
                    user={user}
                  />
                </View>
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
            ListFooterComponent={null}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Search size={40} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
                <Text style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                  No posts found. {lastError ? `\n\nError: ${lastError}` : ''}
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

        <ShareManager ref={shareRef} />

        <Modal
          visible={showModerationModal}
          transparent
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.moderationCard}>
              <Text style={styles.moderationTitle}>
                {moderationTarget?.type === 'post' ? 'DELETE POST' : 'MUTE USER'}
              </Text>
              <Text style={styles.moderationSubtitle}>
                Please provide a reason for this action. This will be recorded in the admin logs.
              </Text>
              
              <TextInput
                style={styles.reasonInput}
                placeholder="Reason (e.g. Spam, Harassment, Misleading content)"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={moderationReason}
                onChangeText={setModerationReason}
                multiline
                numberOfLines={4}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  onPress={() => setShowModerationModal(false)}
                  style={[styles.modalButton, { backgroundColor: 'rgba(255,255,255,0.05)' }]}
                >
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={submitModeration}
                  style={[styles.modalButton, { backgroundColor: '#EF4444' }]}
                >
                  <Text style={styles.modalButtonText}>CONFIRM</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

          <NotificationPanel 
            visible={showNotifications} 
            onClose={() => {
              setShowNotifications(false);
              loadUnreadCount();
            }} 
          />

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
    position: 'relative',
  },
    dropdownContainer: {
      position: 'absolute',
      right: 20,
      width: 220,
      backgroundColor: '#0F172A',
      borderRadius: 20,
      padding: 8,
      zIndex: 1000,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.6,
      shadowRadius: 30,
      elevation: 20,
    },

  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  dropdownText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  dropdownBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#111111',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 8,
  },
  badge: {
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: '#EF4444',
      borderRadius: 10,
      minWidth: 16,
      height: 16,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: '#000000',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 8,
      fontWeight: '900',
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
      paddingVertical: 20,
      backgroundColor: 'rgba(255,255,255,0.02)',
      marginBottom: 1,
      position: 'relative',
    },
    deleteButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 10,
      padding: 8,
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
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    moderationCard: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: '#1E293B',
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    moderationTitle: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 2,
      marginBottom: 8,
    },
    moderationSubtitle: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 20,
    },
    reasonInput: {
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderRadius: 12,
      padding: 16,
      color: '#FFFFFF',
      fontSize: 16,
      textAlignVertical: 'top',
      minHeight: 100,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    modalButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 1,
    },
  });

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "NOW";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}M`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}H`;
  return `${Math.floor(seconds / 86400)}D`;
}
