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
    TextInput as RNTextInput,
    ScrollView,
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
      Vote,
      ListFilter,
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
  function SkeletonPost() {
    return (
      <View style={styles.skeletonContainer}>
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
  const [showFilterSort, setShowFilterSort] = useState(false);
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

    const setupNotificationSubscription = async () => {
      const currentUser = await getStoredUser();
      if (!currentUser) return;

      const subscription = supabase
        .channel(`notifications_${currentUser.id}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'rnotifications',
            filter: `user_id=eq.${currentUser.id}`
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
      setLastError(null);
    } catch (err) {
      console.error("Fetch catch:", err);
      setLastError(err?.message || "Unknown error");
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleReaction = async (postId, type) => {
    const currentUser = await getStoredUser();
    if (!currentUser) {
      Alert.alert("Sign In", "Please sign in to react to posts.");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const { data: existing } = await supabase
        .from('rreactions')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .eq('reaction_type', type)
        .maybeSingle();

      if (existing) {
        await supabase.from('rreactions').delete().eq('id', existing.id);
      } else {
        await supabase.from('rreactions').insert({
          post_id: postId,
          user_id: currentUser.id,
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

  const [moderationTarget, setModerationTarget] = useState(null); 
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
        const { error: postError } = await supabase
          .from('rposts')
          .update({ is_deleted: true })
          .eq('id', moderationTarget.id);
        
        if (postError) throw postError;

        await supabase.from('rmoderation_logs').insert({
          moderator_id: admin.id,
          target_id: moderationTarget.id,
          target_type: 'post',
          action: 'delete_post',
          reason: moderationReason,
        });

      } else if (moderationTarget.type === 'user') {
        const { error: userError } = await supabase
          .from('rusers')
          .update({ is_muted: true })
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
    shareRef.current?.open(post);
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
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowFilterSort(!showFilterSort);
                setShowMenu(false);
              }} 
              style={styles.iconButton}
            >
              <ListFilter size={24} color={showFilterSort || selectedZone || selectedTag ? "#FFFFFF" : "rgba(255,255,255,0.4)"} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                setShowMenu(!showMenu);
                setShowFilterSort(false);
              }} 
              style={styles.iconButton}
            >
              <Menu size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {showMenu && (
          <View style={[styles.dropdownContainer, { top: 55 }]}>
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
              onPress={() => { setShowMenu(false); router.push("/polls"); }}
            >
              <Vote size={18} color="#FBBF24" />
              <Text style={styles.dropdownText}>FUTURE FEATURES</Text>
            </TouchableOpacity>

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

        {showFilterSort && (
          <View style={[styles.filterSortDropdown, { top: 55 }]}>
            <View style={styles.dropdownHeader}>
              <Text style={[styles.dropdownLabel, { color: '#FFFFFF' }]}>SORT BY</Text>
            </View>
            <View style={styles.sortOptionsRow}>
              {['newest', 'popular', 'oldest'].map(option => (
                <TouchableOpacity 
                  key={option}
                  onPress={() => {
                    setSortBy(option);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[styles.sortOptionPill, sortBy === option && styles.activeSortPill]}
                >
                  <Text style={[styles.sortOptionText, sortBy === option && styles.activeSortOptionText]}>
                    {option.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.dropdownDivider} />

            <View style={styles.dropdownHeader}>
              <Text style={[styles.dropdownLabel, { color: '#FFFFFF' }]}>ZONE</Text>
              {selectedZone && (
                <TouchableOpacity onPress={() => setSelectedZone(null)}>
                  <Text style={styles.clearText}>CLEAR</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dropdownScroll}>
              {zones.map(zone => (
                <TouchableOpacity 
                  key={zone.id} 
                  onPress={() => {
                    setSelectedZone(zone.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[styles.filterPill, selectedZone === zone.id && styles.activeFilterPill]}
                >
                  <Text style={[styles.filterText, selectedZone === zone.id && styles.activeFilterText]}>
                    {zone.name.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.dropdownDivider} />

            <View style={styles.dropdownHeader}>
              <Text style={[styles.dropdownLabel, { color: '#FFFFFF' }]}>HASHTAGS</Text>
              {selectedTag && (
                <TouchableOpacity onPress={() => setSelectedTag(null)}>
                  <Text style={styles.clearText}>CLEAR</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dropdownScroll}>
              {tags.map(tag => (
                <TouchableOpacity 
                  key={tag.id} 
                  onPress={() => {
                    setSelectedTag(tag.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[styles.filterPill, selectedTag === tag.id && styles.activeFilterPill]}
                >
                  <Text style={[styles.filterText, selectedTag === tag.id && styles.activeFilterText]}>
                    #{tag.name.toUpperCase().replace(/\s+/g, '')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {(selectedZone || selectedTag) && (
              <TouchableOpacity 
                style={styles.applyButton} 
                onPress={() => setShowFilterSort(false)}
              >
                <Text style={styles.applyButtonText}>CLOSE</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
              {(index + 1) % 5 === 0 && <NativeAd />}
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
            
            <RNTextInput
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
  dropdownDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 8,
  },
  filterPill: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 10,
  },
  filterText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '700',
  },
  activeFilterPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  activeFilterText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 1,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
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
  filterSortDropdown: {
    position: 'absolute',
    right: 20,
    width: 280,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 15,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dropdownLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  sortOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 5,
  },
  sortOptionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeSortPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sortOptionText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
  },
  activeSortOptionText: {
    color: '#FFFFFF',
  },
  clearText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
  },
  dropdownScroll: {
    gap: 10,
    paddingRight: 10,
  },
  applyButton: {
    marginTop: 15,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
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
