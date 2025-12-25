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
import { NativeAd } from "@/components/NativeAd";
import PostItem from "./PostItem";

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
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showZones, setShowZones] = useState(false);
    const [showTags, setShowTags] = useState(false);
    const [isModerator, setIsModerator] = useState(false);
    const [lastError, setLastError] = useState(null);
    const user = useAuthStore(state => state.auth);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const shareRef = useRef();

    useEffect(() => {
      const delayDebounceFn = setTimeout(() => {
        if (showSearch) fetchPosts();
      }, 500);

      return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

  const fetchPosts = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    setLastError(null);

    try {
      let query = supabase
        .from("rposts")
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
          media_type,
          is_anonymous,
          moderation_status,
          is_deleted,
          user:rusers (username, emoji_icon, avatar_url),
          zone:rzones (name),
          tag:rtags (name),
          reactions:rreactions (reaction_type, device_id)
        `)
        .eq("is_deleted", false)
        .eq("moderation_status", "approved");

      if (selectedZone !== null && selectedZone !== undefined) query = query.eq("zone_id", selectedZone);
      if (selectedTag !== null && selectedTag !== undefined) query = query.eq("tag_id", selectedTag);
      
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,text.ilike.%${searchQuery}%`);
      }

      if (sortBy === 'popular') {
        query = query.order("created_at", { ascending: false });
      } else if (sortBy === 'oldest') {
        query = query.order("created_at", { ascending: true });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query.limit(50);

      if (error) {
        setLastError(error.message);
        setPosts([]);
        return;
      }

      setPosts(data || []);
    } catch (err) {
      console.error("Fetch catch:", err);
      setLastError(err?.message || "Unknown error");
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setupNotificationSubscription = async () => {
    const user = await getStoredUser();
    if (!user) return null;
    
    const channel = supabase
      .channel('public:rnotifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'rnotifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        loadUnreadCount();
      })
      .subscribe();
      
    return channel;
  };

  useEffect(() => {
    fetchPosts();
    loadUnreadCount();
    checkModerator();
    fetchFilterData();
    getDeviceId().then(setDeviceId);

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

  const handleReaction = async (postId, reactionType) => {
    if (!deviceId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { data: existing } = await supabase
        .from("rreactions")
        .select("id")
        .eq("post_id", postId)
        .eq("device_id", deviceId)
        .eq("reaction_type", reactionType)
        .maybeSingle();

      if (existing) {
        await supabase.from("rreactions").delete().eq("id", existing.id);
      } else {
        await supabase.from("rreactions").insert({
          post_id: postId,
          device_id: deviceId,
          reaction_type: reactionType,
        });
      }
      fetchPosts(true);
    } catch (err) {
      console.error("Reaction error:", err);
    }
  };

  const handleMuteUser = async (targetUserId) => {
    if (!isModerator) return;
    Alert.alert(
      "Mute User",
      "Are you sure you want to mute this user? They will not be able to post or comment.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Mute", 
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('rusers')
                .update({ is_muted: true })
                .eq('id', targetUserId);
              if (error) throw error;
              alert("User muted successfully");
            } catch (err) {
              alert("Error muting user: " + err.message);
            }
          }
        }
      ]
    );
  };

  const handleDeletePost = async (postId) => {
    if (!isModerator) return;
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
              fetchPosts(true);
            } catch (err) {
              alert("Error deleting post: " + err.message);
            }
          }
        }
      ]
    );
  };

  if (loading && !refreshing && posts.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>THE WALL</Text>
        </View>
        <FlatList
          data={[1,2,3,4]}
          renderItem={() => <SkeletonPost />}
          keyExtractor={i => i.toString()}
          contentContainerStyle={styles.listContent}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => setShowMenu(true)}
          >
            <Menu size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>THE WALL</Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Search size={22} color={showSearch ? colors.primary : colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setShowNotifications(true)}
          >
            <Bell size={22} color={colors.text} />
            {unreadCount > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
        </View>
      </View>

      {showSearch && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search size={18} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search the wall..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <X size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { id: 'zones', icon: LayoutGrid, label: selectedZone ? zones.find(z => z.id === selectedZone)?.name : 'All Zones' },
            { id: 'tags', icon: Hash, label: selectedTag ? tags.find(t => t.id === selectedTag)?.name : 'All Tags' },
            { id: 'sort', icon: ArrowUpDown, label: sortBy.charAt(0).toUpperCase() + sortBy.slice(1) },
          ]}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.filterChip,
                (item.id === 'zones' && selectedZone) || (item.id === 'tags' && selectedTag) ? styles.activeChip : null
              ]}
              onPress={() => {
                if (item.id === 'zones') setShowZones(true);
                if (item.id === 'tags') setShowTags(true);
                if (item.id === 'sort') {
                  const options = ['newest', 'popular', 'oldest'];
                  const next = options[(options.indexOf(sortBy) + 1) % options.length];
                  setSortBy(next);
                  fetchPosts(true);
                }
              }}
            >
              <item.icon size={14} color={((item.id === 'zones' && selectedZone) || (item.id === 'tags' && selectedTag)) ? '#000' : 'rgba(255,255,255,0.6)'} />
              <Text style={[
                styles.filterLabel,
                ((item.id === 'zones' && selectedZone) || (item.id === 'tags' && selectedTag)) ? styles.activeLabel : null
              ]}>{item.label}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
        />
      </View>

      {lastError && (
        <View style={styles.errorContainer}>
          <AlertTriangle size={20} color="#EF4444" />
          <Text style={styles.errorText}>{lastError}</Text>
          <TouchableOpacity onPress={() => fetchPosts()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={posts}
        renderItem={({ item, index }) => (
          <View>
            <PostItem 
              item={item} 
              deviceId={deviceId}
              user={user}
              onReaction={(postId, type) => handleReaction(postId, type)}
              onComment={() => fetchPosts(true)}
              onDelete={(id) => handleDeletePost(id)}
              onMute={(id) => handleMuteUser(id)}
              onShare={(p) => shareRef.current?.open(p)}
            />
            {index % 5 === 2 && <NativeAd />}
          </View>
        )}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPosts(true)}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>No posts found</Text>
              {(selectedZone || selectedTag || searchQuery) && (
                <TouchableOpacity 
                  style={styles.clearButton}
                  onPress={() => {
                    setSelectedZone(null);
                    setSelectedTag(null);
                    setSearchQuery("");
                    fetchPosts(true);
                  }}
                >
                  <Text style={{ color: colors.primary }}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />

      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/post")}
      >
        <Plus size={30} color="#000" />
      </TouchableOpacity>

      {/* Side Menu */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity 
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={[styles.menuContent, { backgroundColor: '#0F172A' }]}>
            <View style={[styles.menuHeader, { paddingTop: insets.top + 20 }]}>
              {user ? (
                <TouchableOpacity 
                  style={styles.profileSection}
                  onPress={() => {
                    setShowMenu(false);
                    router.push("/profile");
                  }}
                >
                  {user.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.menuAvatar} />
                  ) : (
                    <View style={styles.menuAvatarPlaceholder}>
                      <Text style={{ fontSize: 24 }}>{user.emoji_icon || '👤'}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.menuUsername}>{user.username}</Text>
                    <Text style={styles.menuViewProfile}>View Profile</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.loginButton}
                  onPress={() => {
                    setShowMenu(false);
                    router.push("/auth");
                  }}
                >
                  <Text style={styles.loginButtonText}>Login / Sign Up</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.menuItems}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  router.push("/businesses");
                }}
              >
                <Briefcase size={22} color="#FFF" />
                <Text style={styles.menuItemText}>Local Businesses</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  router.push("/talent");
                }}
              >
                <Star size={22} color="#FFF" />
                <Text style={styles.menuItemText}>Local Talent</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  router.push("/councillor");
                }}
              >
                <User size={22} color="#FFF" />
                <Text style={styles.menuItemText}>Contact Councillor</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  router.push("/settings");
                }}
              >
                <Settings size={22} color="#FFF" />
                <Text style={styles.menuItemText}>Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  router.push("/help");
                }}
              >
                <HelpCircle size={22} color="#FFF" />
                <Text style={styles.menuItemText}>Help & Support</Text>
              </TouchableOpacity>

              {user && (
                <TouchableOpacity 
                  style={[styles.menuItem, { marginTop: 20 }]}
                  onPress={async () => {
                    await logoutUser();
                    setShowMenu(false);
                  }}
                >
                  <X size={22} color="#EF4444" />
                  <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Logout</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.menuFooter}>
              <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>TownWall v1.0.0</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Zones Modal */}
      <Modal visible={showZones} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>SELECT ZONE</Text>
              <TouchableOpacity onPress={() => setShowZones(false)}>
                <X color="#FFF" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: null, name: 'All Zones' }, ...zones]}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.modalItem, selectedZone === item.id && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedZone(item.id);
                    setShowZones(false);
                    fetchPosts(true);
                  }}
                >
                  <Text style={[styles.modalItemText, selectedZone === item.id && styles.modalItemTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={i => (i.id || 'all').toString()}
            />
          </View>
        </View>
      </Modal>

      {/* Tags Modal */}
      <Modal visible={showTags} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>SELECT TAG</Text>
              <TouchableOpacity onPress={() => setShowTags(false)}>
                <X color="#FFF" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: null, name: 'All Tags' }, ...tags]}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.modalItem, selectedTag === item.id && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedTag(item.id);
                    setShowTags(false);
                    fetchPosts(true);
                  }}
                >
                  <Text style={[styles.modalItemText, selectedTag === item.id && styles.modalItemTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={i => (i.id || 'all').toString()}
            />
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
      
      <ShareManager ref={shareRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -1,
  },
  headerActions: {
    flexDirection: "row",
    gap: 15,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#000',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 45,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
  },
  filterContainer: {
    marginBottom: 15,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeChip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  filterLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
  activeLabel: {
    color: '#000',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  postContainer: {
    marginBottom: 20,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: '#EF4444',
    fontSize: 13,
  },
  retryText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  menuContent: {
    width: '80%',
    height: '100%',
    padding: 20,
  },
  menuHeader: {
    marginBottom: 30,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  menuAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  menuAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuUsername: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  menuViewProfile: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  loginButton: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#000',
    fontWeight: '800',
  },
  menuItems: {
    gap: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 15,
  },
  menuItemText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 10,
  },
  menuFooter: {
    position: 'absolute',
    bottom: 40,
    left: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalItemActive: {
    borderBottomColor: '#FFF',
  },
  modalItemText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },
  modalItemTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  clearButton: {
    marginTop: 15,
    padding: 10,
  },
});

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "NOW";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}M`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}H`;
  return `${Math.floor(seconds / 86400)}D`;
}
