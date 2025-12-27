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
    Plus,
    Menu,
    Shield,
    HelpCircle,
    Bell,
    ListFilter,
    User,
    Search,
} from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import * as Haptics from "expo-haptics";
import { theme } from "../utils/theme";
import { getStoredUser } from "../utils/user";
import { useAuthStore } from "../utils/auth";
import NotificationPanel from "./NotificationPanel";
import { ShareManager } from "./ShareManager";
import { BannerAd } from "@/components/BannerAd";
import { NativeAd } from "@/components/NativeAd";
import PostItem from "./PostItem";

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

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    fetchZones();
    checkModerator();
    loadUnreadCount();

    const postsSub = supabase
      .channel('public:rposts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rposts' }, () => fetchPosts(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rreactions' }, () => fetchPosts(true))
      .subscribe();

    return () => { supabase.removeChannel(postsSub); };
  }, [selectedZone, sortBy]);

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
      let query = supabase.from("rposts").select(`id, title, text, created_at, user_id, zone_id, tag_id, image_url, image_urls, is_anonymous, moderation_status, is_deleted, user:rusers (username, emoji_icon, avatar_url), zone:rzones (name), tag:rtags (name), poll_id, reactions:rreactions (reaction_type, device_id)`).eq("is_deleted", false).eq("moderation_status", "approved");
      if (selectedZone) query = query.eq("zone_id", selectedZone);
      query = query.order("created_at", { ascending: sortBy === 'oldest' });
      const { data } = await query.limit(50);
      setPosts(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const handleReaction = async (postId, type, currentlyReacted) => {
    if (!deviceId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentlyReacted) {
      await supabase.from('rreactions').delete().match({ post_id: postId, reaction_type: type, device_id: deviceId });
    } else {
      await supabase.from('rreactions').insert({ post_id: postId, reaction_type: type, device_id: deviceId });
    }
    fetchPosts(true);
  };

  const onRefresh = useCallback(() => { setRefreshing(true); fetchPosts(true); }, [selectedZone, sortBy]);
  useEffect(() => { fetchPosts(); }, [selectedZone, sortBy]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={[styles.logo, { color: theme.colors.primary }]}>TownWall</Text>
        <View style={styles.headerActions}>
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
          <TouchableOpacity onPress={() => { setShowMenu(false); router.push("/profile"); }} style={styles.menuItem}><User size={20} color={theme.colors.text} /><Text style={styles.menuText}>Profile</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowMenu(false); setShowFilterSort(true); }} style={styles.menuItem}><ListFilter size={20} color={theme.colors.text} /><Text style={styles.menuText}>Filters</Text></TouchableOpacity>
          {isModerator && <TouchableOpacity onPress={() => { setShowMenu(false); router.push("/admin"); }} style={styles.menuItem}><Shield size={20} color={theme.colors.error} /><Text style={styles.menuText}>Admin</Text></TouchableOpacity>}
          <TouchableOpacity onPress={() => { setShowMenu(false); router.push("/help"); }} style={styles.menuItem}><HelpCircle size={20} color={theme.colors.text} /><Text style={styles.menuText}>Help</Text></TouchableOpacity>
        </View>
      )}

      <FlatList
        data={posts}
        renderItem={({ item, index }) => (
          <View>
            {index === 0 && <BannerAd />}
            <PostItem item={item} deviceId={deviceId} onReaction={handleReaction} user={user} onComment={() => fetchPosts(true)} onShare={(p) => shareRef.current?.share(p)} onEdit={(p) => router.push(`/post?id=${p.id}`)} />
            {(index + 1) % 5 === 0 && <NativeAd />}
          </View>
        )}
        keyExtractor={item => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : <View style={styles.empty}><Text style={styles.emptyText}>No posts found</Text></View>}
      />

      <TouchableOpacity onPress={() => router.push("/post")} style={[styles.fab, { backgroundColor: theme.colors.primary }]}>
        <Plus color="#FFF" size={30} />
      </TouchableOpacity>

      <Modal visible={showFilterSort} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={styles.modalTitle}>Filters & Sorting</Text>
            <Text style={styles.label}>Sort By</Text>
            <View style={styles.row}>
              {['newest', 'oldest'].map(s => (
                <TouchableOpacity key={s} onPress={() => setSortBy(s)} style={[styles.pill, sortBy === s && { backgroundColor: theme.colors.primary }]}><Text style={[styles.pillText, sortBy === s && { color: '#FFF' }]}>{s}</Text></TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Zone</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
              <TouchableOpacity onPress={() => setSelectedZone(null)} style={[styles.pill, !selectedZone && { backgroundColor: theme.colors.primary }]}><Text style={[styles.pillText, !selectedZone && { color: '#FFF' }]}>All</Text></TouchableOpacity>
              {zones.map(z => (
                <TouchableOpacity key={z.id} onPress={() => setSelectedZone(z.id)} style={[styles.pill, selectedZone === z.id && { backgroundColor: theme.colors.primary }]}><Text style={[styles.pillText, selectedZone === z.id && { color: '#FFF' }]}>{z.name}</Text></TouchableOpacity>
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
  menu: { position: 'absolute', top: 100, right: 20, width: 180, borderRadius: 10, padding: 10, zIndex: 100, borderWidth: 1, elevation: 5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  menuText: { fontSize: 16 },
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
  closeBtnText: { color: '#FFF', fontWeight: 'bold' },
});
