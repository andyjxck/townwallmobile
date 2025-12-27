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
    TouchableWithoutFeedback
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
    Vote,
    Music,
    Briefcase,
    X,
    Search
} from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/theme";
import { Image } from "expo-image";
import { LinearGradient } from 'expo-linear-gradient';
import { getStoredUser, logoutUser } from "../utils/user";
import { useAuthStore } from "../utils/auth";
import NotificationPanel from "./NotificationPanel";
import { ShareManager } from "./ShareManager";
import { BannerAd } from "@/components/BannerAd";
import { NativeAd } from "@/components/NativeAd";
import PostItem from "./PostItem";

export default function UniversalFeed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, spacing, borderRadius, typography, isDark } = useTheme();
  
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

    const setupRealtimeSubscriptions = async () => {
      const currentUser = await getStoredUser();
      
      let notificationSub;
      if (currentUser) {
        notificationSub = supabase
          .channel(`notifications_${currentUser.id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rnotifications', filter: `user_id=eq.${currentUser.id}` }, () => loadUnreadCount())
          .subscribe();
      }

      const postsSub = supabase
        .channel('public:rposts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rposts' }, () => fetchPosts(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rreactions' }, () => fetchPosts(true))
        .subscribe();

      return { notificationSub, postsSub };
    };

    let subs;
    setupRealtimeSubscriptions().then(s => subs = s);
    return () => {
      if (subs) {
        if (subs.notificationSub) supabase.removeChannel(subs.notificationSub);
        if (subs.postsSub) supabase.removeChannel(subs.postsSub);
      }
    };
  }, [selectedZone, selectedTag, sortBy]);

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

  const fetchFilterData = async () => {
    const [zonesRes, tagsRes] = await Promise.all([
      supabase.from('rzones').select('*').order('name'),
      supabase.from('rtags').select('*').order('name')
    ]);
    if (zonesRes.data) setZones(zonesRes.data);
    if (tagsRes.data) setTags(tagsRes.data);
  };

  const fetchPosts = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    try {
      let query = supabase.from("rposts").select(`id, title, text, created_at, user_id, zone_id, tag_id, image_url, image_urls, is_anonymous, moderation_status, is_deleted, user:rusers (username, emoji_icon, avatar_url), zone:rzones (name), tag:rtags (name), poll_id, reactions:rreactions (reaction_type, device_id)`).eq("is_deleted", false).eq("moderation_status", "approved");
      if (selectedZone) query = query.eq("zone_id", selectedZone);
      if (selectedTag) query = query.eq("tag_id", selectedTag);
      query = query.order("created_at", { ascending: sortBy === 'oldest' });
      const { data } = await query.limit(50);
      setPosts(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const handleReaction = async (postId, type) => {
    const currentUser = await getStoredUser();
    if (!currentUser) { Alert.alert("Sign In", "Please sign in to react."); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { data: existing } = await supabase.from('rreactions').select('*').eq('post_id', postId).eq('user_id', currentUser.id).eq('reaction_type', type).maybeSingle();
    if (existing) await supabase.from('rreactions').delete().eq('id', existing.id);
    else await supabase.from('rreactions').insert({ post_id: postId, user_id: currentUser.id, reaction_type: type, device_id: deviceId });
    fetchPosts(true);
  };

  const onRefresh = useCallback(() => { setRefreshing(true); fetchPosts(true); }, [selectedZone, selectedTag, sortBy]);
  useEffect(() => { fetchPosts(); }, [selectedZone, selectedTag, sortBy]);

  function SkeletonPost() {
    return (
      <View style={[styles.skeleton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.skeletonHeader}><View style={[styles.skeletonAvatar, { backgroundColor: colors.background }]} /><View style={[styles.skeletonLine, { width: 100, backgroundColor: colors.background }]} /></View>
        <View style={[styles.skeletonLine, { width: '80%', height: 20, backgroundColor: colors.background, marginTop: 12 }]} />
        <View style={[styles.skeletonLine, { width: '60%', height: 16, backgroundColor: colors.background, marginTop: 8 }]} />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={() => { setShowMenu(false); setShowFilterSort(false); }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style="light" />
        
        {/* Modern Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.push("/")} activeOpacity={0.7}>
            <View style={styles.logoContainer}>
              <LinearGradient colors={[colors.primary, colors.accent]} style={styles.logoGradient}>
                <Image source={require('../../assets/images/icon.png')} style={styles.logoIcon} contentFit="contain" />
              </LinearGradient>
              <Text style={[styles.logoText, { color: colors.text }]}>TOWN<Text style={{ color: colors.primary }}>WALL</Text></Text>
            </View>
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setShowNotifications(true)} style={[styles.iconBtn, { backgroundColor: colors.surface }]}>
              <Bell size={20} color={colors.text} />
              {unreadCount > 0 && <View style={[styles.badge, { backgroundColor: colors.danger }]} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowFilterSort(!showFilterSort); setShowMenu(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: (showFilterSort || selectedZone || selectedTag) ? colors.primary : 'transparent', borderWidth: 1 }]}>
              <ListFilter size={20} color={(showFilterSort || selectedZone || selectedTag) ? colors.primary : colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowMenu(!showMenu); setShowFilterSort(false); }} style={[styles.iconBtn, { backgroundColor: colors.surface }]}>
              <Menu size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Floating Menu */}
        {showMenu && (
          <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border, top: insets.top + 60 }]}>
            <MenuItem icon={<User size={18} color={colors.primary} />} label="MY PROFILE" onPress={() => router.push("/profile")} colors={colors} />
            <MenuItem icon={<Vote size={18} color={colors.warning} />} label="FUTURE POLLS" onPress={() => router.push("/polls")} colors={colors} />
            <MenuItem icon={<Music size={18} color={colors.secondary} />} label="LOCAL TALENT" onPress={() => router.push("/talent")} colors={colors} />
            <MenuItem icon={<Briefcase size={18} color={colors.primary} />} label="BUSINESSES" onPress={() => router.push("/businesses")} colors={colors} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MenuItem icon={<HelpCircle size={18} color={colors.textTertiary} />} label="HELP & INFO" onPress={() => router.push("/help")} colors={colors} />
            {isModerator && <MenuItem icon={<Shield size={18} color={colors.danger} />} label="MODERATION" onPress={() => router.push("/admin")} colors={colors} />}
          </View>
        )}

        {/* Filters Overlay */}
        {showFilterSort && (
          <View style={[styles.filterPanel, { backgroundColor: colors.surface, borderColor: colors.border, top: insets.top + 60 }]}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>SORT BY</Text>
            <View style={styles.sortRow}>
              {['newest', 'popular', 'oldest'].map(s => (
                <TouchableOpacity key={s} onPress={() => setSortBy(s)} style={[styles.pill, sortBy === s && { backgroundColor: colors.primary }]}>
                  <Text style={[styles.pillText, { color: sortBy === s ? '#FFF' : colors.textSecondary }]}>{s.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 12 }]} />
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>ZONES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {zones.map(z => (
                <TouchableOpacity key={z.id} onPress={() => setSelectedZone(z.id)} style={[styles.pill, selectedZone === z.id && { backgroundColor: colors.primary }]}>
                  <Text style={[styles.pillText, { color: selectedZone === z.id ? '#FFF' : colors.textSecondary }]}>{z.name.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {(selectedZone || selectedTag) && (
              <TouchableOpacity onPress={() => { setSelectedZone(null); setSelectedTag(null); }} style={styles.clearBtn}>
                <Text style={[styles.clearBtnText, { color: colors.danger }]}>CLEAR ALL FILTERS</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Feed */}
        <FlatList
          data={posts}
          renderItem={({ item, index }) => (
            <View>
              {(index === 0) && <BannerAd />}
              <PostItem item={item} deviceId={deviceId} onReaction={handleReaction} user={user} onComment={() => fetchPosts(true)} onShare={(p) => shareRef.current?.share(p)} onEdit={(p) => router.push(`/post?id=${p.id}`)} />
              {(index + 1) % 5 === 0 && <NativeAd />}
            </View>
          )}
          keyExtractor={item => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          ListEmptyComponent={loading ? <View style={{ padding: 20 }}>{[1,2,3].map(i => <SkeletonPost key={i} />)}</View> : (
            <View style={styles.empty}>
              <Search size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No posts found here.</Text>
              <TouchableOpacity onPress={() => { setSelectedZone(null); setSelectedTag(null); }} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.retryBtnText}>VIEW ALL POSTS</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        {/* Float Action Button */}
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/post"); }} style={[styles.fab, { backgroundColor: colors.primary }]}>
          <Plus size={32} color="#FFF" />
        </TouchableOpacity>

        <NotificationPanel visible={showNotifications} onClose={() => setShowNotifications(false)} />
        <ShareManager ref={shareRef} />
      </View>
    </TouchableWithoutFeedback>
  );
}

function MenuItem({ icon, label, onPress, colors }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.menuItem}>
      {icon}
      <Text style={[styles.menuText, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoGradient: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  logoIcon: { width: 24, height: 24 },
  logoText: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  badge: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: '#000' },
  dropdown: { position: 'absolute', right: 20, width: 220, borderRadius: 20, padding: 8, zIndex: 1000, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  menuText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  divider: { height: 1, marginHorizontal: 12, marginVertical: 4 },
  filterPanel: { position: 'absolute', right: 20, width: 300, borderRadius: 24, padding: 20, zIndex: 1000, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  filterLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 },
  sortRow: { flexDirection: 'row', gap: 8 },
  filterScroll: { flexDirection: 'row', marginBottom: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 8 },
  pillText: { fontSize: 11, fontWeight: '700' },
  clearBtn: { marginTop: 12, alignItems: 'center' },
  clearBtnText: { fontSize: 11, fontWeight: '800' },
  fab: { position: 'absolute', bottom: 30, right: 24, width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  skeleton: { padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  skeletonAvatar: { width: 32, height: 32, borderRadius: 16 },
  skeletonLine: { borderRadius: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 100, gap: 16 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  retryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
});
