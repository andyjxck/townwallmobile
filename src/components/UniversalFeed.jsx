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
    } from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/theme";
import { Image } from "expo-image";
import { getStoredUser, logoutUser } from "../utils/user";
import { useAuthStore } from "../utils/auth/store";
import { TextInput } from "react-native-gesture-handler";
import NotificationPanel from "./NotificationPanel";
import { fetchNotifications } from "@/utils/notifications";
import { LinearGradient } from "expo-linear-gradient";

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
  const [isModerator, setIsModerator] = useState(false);
  const user = useAuthStore(state => state.auth);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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

  const handleMuteUser = async (userId) => {
    Alert.alert(
      "Mute User",
      "Are you sure you want to mute this user? They will no longer be able to post.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Mute", 
          style: "destructive",
          onPress: async () => {
            try {
              const admin = await getStoredUser();
              const { error } = await supabase
                .from('rusers')
                .update({ 
                  is_muted: true,
                  muted_at: new Date().toISOString(),
                  muted_by: admin.supabase_uid
                })
                .eq('id', userId);
              
              if (error) throw error;
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Success", "User has been muted.");
            } catch (error) {
              console.error("Error muting user:", error);
              Alert.alert("Error", "Failed to mute user.");
            }
          }
        }
      ]
    );
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
          `)
          .eq('is_deleted', false);

      if (selectedZone) query = query.eq('zone_id', selectedZone);
      if (selectedTag) query = query.eq('tag_id', selectedTag);

      if (sortBy === 'popular') {
        // We'll sort in memory since rreactions is a join
        const { data, error } = await query;
        if (error) throw error;
        const sorted = (data || []).sort((a, b) => {
          const countA = (a.rreactions || []).length;
          const countB = (b.rreactions || []).length;
          return countB - countA;
        });
        setPosts(sorted);
      } else {
        query = query.order('created_at', { ascending: sortBy === 'oldest' });
        const { data, error } = await query;
        if (error) throw error;
        setPosts(data || []);
      }
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

  const handleDeletePost = async (postId) => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('rposts')
                .update({ is_deleted: true })
                .eq('id', postId);
              
              if (error) throw error;
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              fetchPosts();
            } catch (error) {
              console.error("Error deleting post:", error);
              Alert.alert("Error", "Failed to delete post. Please try again.");
            }
          }
        }
      ]
    );
  };

    const handleEditPost = (post) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/post?id=${post.id}`);
    };

    const handleShare = async (post) => {
      try {
        const result = await Share.share({
          message: `${post.title}\n\n${post.text}\n\nShared from Town Wall`,
          url: `${process.env.EXPO_PUBLIC_APP_URL}/post/${post.id}`
        });
        if (result.action === Share.sharedAction) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        console.error("Error sharing post:", error);
      }
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
              <Text style={[styles.logo, { color: '#FFFFFF' }]}>TOWN WALL</Text>
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
          <FlatList
            data={[1, 2, 3, 4, 5]}
            renderItem={() => <SkeletonPost />}
            keyExtractor={i => i.toString()}
          />
        </View>
      ) : (
        <FlatList
          data={posts}
            renderItem={({ item }) => (
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
