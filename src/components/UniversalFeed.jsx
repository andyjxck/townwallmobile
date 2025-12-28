import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
    Plus,
    Menu,
    Shield,
    HelpCircle,
    Bell,
    ListFilter,
    User,
    Search,
    Star,
    Briefcase,
    Vote,
    WifiOff,
    CloudUpload,
    MessageCircle,
} from "lucide-react-native";
import { Image } from "expo-image";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import * as Haptics from "expo-haptics";
import { theme } from "../utils/theme";
import { getStoredUser } from "../utils/user";
import { useAuthStore, useChatStore } from "../utils/auth";
import NotificationPanel from "./NotificationPanel";
import { ShareManager } from "./ShareManager";
import { BannerAd } from "@/components/BannerAd";
import PostItem from "./PostItem";
import { subscribeToUnreadCount, sendNotification, sendReactionNotification } from "../utils/notifications";
import { offlineStorage, syncService, subscribeToNetworkChanges, checkNetworkStatus } from "../utils/offline";

export default function UniversalFeed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [posts, setPosts] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  
  const [selectedZone, setSelectedZone] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [showMenu, setShowMenu] = useState(false);
  const [showFilterSort, setShowFilterSort] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const user = useAuthStore(state => state.auth);
  const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const shareRef = useRef();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  
  const postsWithAds = useMemo(() => {
    const offlinePosts = pendingPosts.map(p => ({
      ...p,
      isPending: true,
      user: null,
      zone: null,
      tag: null,
      reactions: [],
    }));
    return [...offlinePosts, ...posts];
  }, [posts, pendingPosts]);

    useEffect(() => {
    getDeviceId().then(setDeviceId);
    fetchZones();
    checkModerator();
    loadPendingPosts();
    checkNetworkStatus().then(setIsOnline);

    const unsubscribeNetwork = subscribeToNetworkChanges(async (online) => {
      setIsOnline(online);
      if (online) {
        await syncPendingPosts();
      }
    });

    const postsSub = supabase
      .channel('public:rposts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rposts' }, () => fetchPosts(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rreactions' }, () => fetchPosts(true))
      .subscribe();

    return () => { 
      supabase.removeChannel(postsSub); 
      unsubscribeNetwork();
    };
  }, [selectedZone, sortBy]);

  const loadPendingPosts = async () => {
    const pending = await offlineStorage.getPendingPosts();
    setPendingPosts(pending);
  };

  const syncPendingPosts = async () => {
    const pending = await offlineStorage.getPendingPosts();
    if (pending.length === 0) return;
    
    setSyncing(true);
    const { synced, failed } = await syncService.syncPendingPosts();
    setSyncing(false);
    
    if (synced > 0) {
      await loadPendingPosts();
      await fetchPosts(true);
      Alert.alert("Synced", `${synced} post(s) uploaded successfully.`);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeToUnreadCount(user.id, (count) => {
      setUnreadCount(count);
    });
    return () => unsubscribe();
  }, [user?.id]);

  const loadUnreadCount = async () => {
    const user = await getStoredUser();
    if (user) {
      const { count } = await supabase.from('rnotifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
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

  const fetchZones = async () => {
    const { data } = await supabase.from('rzones').select('*').order('name');
    if (data) setZones(data);
  };

  const fetchPosts = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    try {
      let query = supabase.from("rposts").select(`id, title, text, created_at, user_id, zone_id, tag_id, image_url, image_urls, is_anonymous, moderation_status, is_deleted, is_blurred, blur_reason, comments_disabled, user:rusers (username, emoji_icon, avatar_url, last_seen), zone:rzones (name), tag:rtags (name), poll_id, reactions:rreactions (reaction_type, device_id)`).eq("is_deleted", false).eq("moderation_status", "approved");
      if (selectedZone) query = query.eq("zone_id", selectedZone);
      query = query.order("created_at", { ascending: sortBy === 'oldest' });
      const { data } = await query.limit(50);
      setPosts(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const handleModAction = async (postId, action, reason = null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (action === 'delete') {
        await supabase.from('rposts').update({ is_deleted: true }).eq('id', postId);
        Alert.alert("Success", "Post deleted");
      } else if (action === 'toggle_comments') {
        const post = posts.find(p => p.id === postId);
        await supabase.from('rposts').update({ comments_disabled: !post?.comments_disabled }).eq('id', postId);
        Alert.alert("Success", post?.comments_disabled ? "Comments enabled" : "Comments disabled");
      } else if (action === 'blur') {
        await supabase.from('rposts').update({ is_blurred: true, blur_reason: reason }).eq('id', postId);
        Alert.alert("Success", "Post blurred");
      } else if (action === 'unblur') {
        await supabase.from('rposts').update({ is_blurred: false, blur_reason: null }).eq('id', postId);
        Alert.alert("Success", "Blur removed");
      }
      fetchPosts(true);
    } catch (e) { 
      console.error(e); 
      Alert.alert("Error", "Failed to perform action");
    }
  };

  const handleReaction = async (postId, type, currentlyReacted) => {
    if (!deviceId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (currentlyReacted) {
        await supabase.from('rreactions').delete().match({ post_id: postId, reaction_type: type, device_id: deviceId });
      } else {
        const { data: reactionData } = await supabase.from('rreactions').insert({ 
          post_id: postId, 
          reaction_type: type, 
          device_id: deviceId,
          user_id: user?.id 
        }).select('*, post:rposts(user_id, title)').single();

          if (reactionData?.post?.user_id && reactionData.post.user_id !== user?.id) {
            await sendReactionNotification({
              reactorUsername: user?.username || 'Someone',
              reactorId: user?.id,
              postOwnerId: reactionData.post.user_id,
              postTitle: reactionData.post.title,
              reactionType: type
            });
          }
      }
      fetchPosts(true);
    } catch (e) { console.error(e); }
  };

  const onRefresh = useCallback(() => { 
    setRefreshing(true); 
    loadPendingPosts();
    if (isOnline) syncPendingPosts();
    fetchPosts(true); 
  }, [selectedZone, sortBy, isOnline]);
  useEffect(() => { fetchPosts(); }, [selectedZone, sortBy]);

    const [logoClicks, setLogoClicks] = useState(0);

    const handleLogoClick = () => {
        const newClicks = logoClicks + 1;
        setLogoClicks(newClicks);
        if (newClicks >= 15) {
            setLogoClicks(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.push("/secret-hippie");
        } else if (newClicks > 5) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={handleLogoClick} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image source={require("../../assets/images/icon.png")} style={{ width: 32, height: 32 }} contentFit="contain" />
          </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowFilterSort(true)} style={styles.headerIcon}>
            <ListFilter color={theme.colors.text} size={24} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowNotifications(true)} style={styles.headerIcon}>
            <Bell color={theme.colors.text} size={24} />
            {unreadCount > 0 && <View style={[styles.badge, { backgroundColor: theme.colors.error }]} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.headerIcon}>
            <Menu color={theme.colors.text} size={24} />
          </TouchableOpacity>
        </View>
      </View>

        {showMenu && (
            <View style={[styles.menu, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <TouchableOpacity onPress={() => { setShowMenu(false); useChatStore.getState().open(); }} style={styles.menuItem}><MessageCircle size={20} color={theme.colors.text} /><Text style={styles.menuText}>Chat</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowMenu(false); router.push("/profile"); }} style={styles.menuItem}><User size={20} color={theme.colors.text} /><Text style={styles.menuText}>Profile</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowMenu(false); router.push("/talent"); }} style={styles.menuItem}><Star size={20} color={theme.colors.text} /><Text style={styles.menuText}>Local Talent</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowMenu(false); router.push("/businesses"); }} style={styles.menuItem}><Briefcase size={20} color={theme.colors.text} /><Text style={styles.menuText}>Local Business</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowMenu(false); router.push("/polls"); }} style={styles.menuItem}><Vote size={20} color={theme.colors.text} /><Text style={styles.menuText}>Polls & Features</Text></TouchableOpacity>
            {isModerator && <TouchableOpacity onPress={() => { setShowMenu(false); router.push("/admin"); }} style={styles.menuItem}><Shield size={20} color={theme.colors.error} /><Text style={styles.menuText}>Admin</Text></TouchableOpacity>}
            <TouchableOpacity onPress={() => { setShowMenu(false); router.push("/help"); }} style={styles.menuItem}><HelpCircle size={20} color={theme.colors.text} /><Text style={styles.menuText}>Help</Text></TouchableOpacity>
          </View>
        )}

        {!isOnline && (
          <View style={styles.offlineBanner}>
            <WifiOff size={14} color="#92400E" />
            <Text style={styles.offlineBannerText}>You're offline</Text>
          </View>
        )}

        {pendingPosts.length > 0 && isOnline && (
          <TouchableOpacity onPress={syncPendingPosts} disabled={syncing} style={styles.syncBanner}>
            {syncing ? (
              <ActivityIndicator size="small" color="#1E40AF" />
            ) : (
              <CloudUpload size={14} color="#1E40AF" />
            )}
            <Text style={styles.syncBannerText}>
              {syncing ? 'Syncing...' : `${pendingPosts.length} pending post(s) - Tap to sync`}
            </Text>
          </TouchableOpacity>
        )}

        <FlatList
          data={postsWithAds}
            renderItem={({ item, index }) => {
              return (
                <View>
                  {index === 0 && <BannerAd />}
                  <PostItem 
                    item={item} 
                    deviceId={deviceId} 
                    onReaction={handleReaction} 
                    user={{ ...user, is_admin: isModerator, is_moderator: isModerator }} 
                    onComment={() => fetchPosts(true)} 
                    onShare={(p) => shareRef.current?.share(p)} 
                    onEdit={(p) => router.push(`/post?id=${p.id}`)}
                    onFilterZone={(zoneId) => setSelectedZone(zoneId)}
                    onFilterTag={() => {}}
                    onModAction={handleModAction}
                  />
                </View>
              );
            }}
          keyExtractor={item => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : <View style={styles.empty}><Text style={styles.emptyText}>No posts found</Text></View>}
        />

        <TouchableOpacity onPress={() => router.push("/post")} style={[styles.fab, { backgroundColor: theme.colors.primary }]}>
          <Plus color="#000" size={30} />
        </TouchableOpacity>

      <Modal visible={showFilterSort} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={styles.modalTitle}>Filters & Sorting</Text>
            <Text style={styles.label}>Sort By</Text>
            <View style={styles.row}>
                {['newest', 'oldest'].map(s => (
                  <TouchableOpacity key={s} onPress={() => setSortBy(s)} style={[styles.pill, sortBy === s && { backgroundColor: theme.colors.primary }]}><Text style={[styles.pillText, sortBy === s && { color: '#000' }]}>{s}</Text></TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Zone</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
                <TouchableOpacity onPress={() => setSelectedZone(null)} style={[styles.pill, !selectedZone && { backgroundColor: theme.colors.primary }]}><Text style={[styles.pillText, !selectedZone && { color: '#000' }]}>All</Text></TouchableOpacity>
                {zones.map(z => (
                  <TouchableOpacity key={z.id} onPress={() => setSelectedZone(z.id)} style={[styles.pill, selectedZone === z.id && { backgroundColor: theme.colors.primary }]}><Text style={[styles.pillText, selectedZone === z.id && { color: '#000' }]}>{z.name}</Text></TouchableOpacity>
                ))}
              </ScrollView>
            <TouchableOpacity onPress={() => setShowFilterSort(false)} style={[styles.closeBtn, { backgroundColor: theme.colors.primary }]}><Text style={styles.closeBtnText}>Apply</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <NotificationPanel visible={showNotifications} onClose={() => setShowNotifications(false)} />
      <ShareManager ref={shareRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  logo: { fontSize: 24, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', gap: 15 },
  headerIcon: { position: 'relative' },
  badge: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#FFF' },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', padding: 10, paddingHorizontal: 20 },
  offlineBannerText: { fontSize: 13, color: '#92400E' },
  syncBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DBEAFE', padding: 10, paddingHorizontal: 20 },
  syncBannerText: { fontSize: 13, color: '#1E40AF' },
  filterBar: { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  filterScroll: { paddingHorizontal: 15, gap: 8 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)' },
  filterPillActive: { backgroundColor: theme.colors.primary },
  filterPillText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' },
  filterPillTextActive: { color: '#000' },
  filterDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 },
  menu: { position: 'absolute', top: 100, right: 20, width: 180, borderRadius: 10, padding: 10, zIndex: 100, borderWidth: 1, elevation: 5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  menuText: { fontSize: 16, color: theme.colors.text },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', marginTop: 15, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  pill: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EEE' },
  pillText: { fontSize: 14 },
  closeBtn: { marginTop: 30, padding: 15, borderRadius: 10, alignItems: 'center' },
    closeBtnText: { color: '#000', fontWeight: 'bold' },
});
