import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../utils/supabase";
import { getStoredUser, logoutUser, initUser } from "../utils/user";
import { getDeviceId } from "../utils/deviceId";
import { 
  ChevronLeft, 
  Camera, 
  LogOut, 
  MessageSquare, 
  User as UserIcon,
  Shield,
  UserPlus,
  Users,
  Trash2,
  Heart,
  Image as ImageIcon,
  Check,
  X as XIcon,
  Settings as SettingsIcon,
  Search,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { decode } from "base64-arraybuffer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TextInput } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import PostItem from "../components/PostItem";
import { ShareManager } from "../components/ShareManager";
import { useTheme } from "../utils/theme";

const { width } = Dimensions.get('window');
const EMOJIS = ["👤", "🐱", "🐶", "🦊", "🦁", "🐨", "🐸", "🐷", "🐵", "🦄", "🐲", "🤖", "👻", "👾", "👽", "💩"];

export default function Profile() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius, typography, isDark } = useTheme();
  
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ posts: 0, reactions: 0, joined: "" });
  const [replies, setReplies] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [friendUsername, setFriendUsername] = useState("");
  const [friends, setFriends] = useState([]);
  const [addingFriend, setAddingFriend] = useState(false);
  const [userPosts, setUserPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("posts");
  const [deviceId, setDeviceId] = useState(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const shareRef = useRef();

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    loadData();

    const setupRealtimeSubscriptions = async () => {
      const storedUser = await getStoredUser();
      if (!storedUser) return;

      const channel = supabase
        .channel(`profile_${storedUser.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rusers', filter: `id=eq.${storedUser.id}` }, (payload) => {
          setUser(payload.new);
          setBioText(payload.new.bio || "");
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rposts' }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rreactions' }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rcomments' }, () => loadData())
        .subscribe();

      return channel;
    };

    let sub;
    setupRealtimeSubscriptions().then(s => sub = s);
    return () => { if (sub) supabase.removeChannel(sub); };
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const storedUser = await getStoredUser();
      setCurrentUser(storedUser);
      
      let profileUserId = userId ? parseInt(userId) : storedUser?.id;
      const viewingOwnProfile = !userId || (storedUser?.id && parseInt(userId) === storedUser.id);
      setIsOwnProfile(viewingOwnProfile);
      
      let userData;
      if (viewingOwnProfile && storedUser?.id) {
        const { data: freshUser } = await supabase.from('rusers').select('*').eq('id', storedUser.id).single();
        if (freshUser) {
          userData = freshUser;
          await AsyncStorage.setItem("@redditch_user_data", JSON.stringify(freshUser));
        } else {
          userData = storedUser;
        }
      } else if (profileUserId) {
        const { data: otherUser } = await supabase.from('rusers').select('*').eq('id', profileUserId).single();
        userData = otherUser;
      }

      if (!userData && viewingOwnProfile) userData = await initUser();
      setUser(userData);
      setBioText(userData?.bio || "");

      if (userData) {
        const { count: postCount } = await supabase.from('rposts').select('*', { count: 'exact', head: true }).eq('user_id', userData.id);
        const { count: reactionCount } = await supabase.from('rreactions').select('*, rposts!inner(user_id)', { count: 'exact', head: true }).eq('rposts.user_id', userData.id);
        
        setStats({ 
          posts: postCount || 0,
          reactions: reactionCount || 0,
          joined: new Date(userData.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        });

        if (viewingOwnProfile) {
          const { data: savedData } = await supabase.from('rsaved_posts').select(`post:post_id (id, title, text, created_at, user_id, zone_id, tag_id, image_url, image_urls, media_type, is_anonymous, moderation_status, is_deleted, user:rusers!user_id (username, emoji_icon, avatar_url), zone:rzones!zone_id (name), tag:rtags!tag_id (name), poll_id, reactions:rreactions (reaction_type, device_id))`).eq('user_id', userData.id);
          setSavedPosts(savedData?.map(s => s.post).filter(p => p && !p.is_deleted) || []);

          const { data: requestsData } = await supabase.from('friends').select('id, user_id, rusers!friends_user_id_fkey(id, username, emoji_icon, avatar_url)').eq('friend_id', userData.id).eq('status', 'pending');
          setPendingRequests(requestsData?.map(r => ({ ...r.rusers, requestId: r.id })) || []);
        }

        const { data: friendData } = await supabase.from('friends').select('friend_id, rusers!friends_friend_id_fkey(id, username, emoji_icon, avatar_url)').eq('user_id', userData.id).eq('status', 'accepted');
        const friendsList = friendData?.map(f => f.rusers) || [];
        setFriends(friendsList);
        const friendIds = viewingOwnProfile ? friendsList.map(f => f.id) : [];

        const { data: feedPosts } = await supabase.from('rposts').select(`id, title, text, created_at, user_id, zone_id, tag_id, image_url, image_urls, media_type, is_anonymous, moderation_status, is_deleted, user:rusers!user_id (username, emoji_icon, avatar_url), zone:rzones!zone_id (name), tag:rtags!tag_id (name), poll_id, reactions:rreactions (reaction_type, device_id)`).in('user_id', viewingOwnProfile ? [userData.id, ...friendIds] : [userData.id]).eq('is_deleted', false).order('created_at', { ascending: false });
        setUserPosts(feedPosts || []);

        if (viewingOwnProfile) {
          const { data: userPostIds } = await supabase.from('rposts').select('id').eq('user_id', userData.id);
          if (userPostIds?.length > 0) {
            const postIds = userPostIds.map(p => p.id);
            const { data: replyData } = await supabase.from('rcomments').select(`*, user:rusers!user_id (username, emoji_icon, avatar_url), post:rposts!post_id (title)`).in('post_id', postIds).neq('user_id', userData.id).order('created_at', { ascending: false }).limit(10);
            setReplies(replyData || []);
          }
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!result.canceled) {
      setLoading(true);
      try {
        const image = result.assets[0];
        const fileName = `${user.id}_avatar_${Date.now()}.jpg`;
        const base64 = await FileSystem.readAsStringAsync(image.uri, { encoding: "base64" });
        await supabase.storage.from('avatars').upload(fileName, decode(base64), { contentType: 'image/jpeg', upsert: true });
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        await supabase.from('rusers').update({ avatar_url: publicUrl, emoji_icon: null }).eq('id', user.id);
        setShowEmojiPicker(false);
        loadData();
      } catch (error) { Alert.alert("Error", "Failed to upload avatar"); }
    }
  };

  const handlePickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.7 });
    if (!result.canceled) {
      setUploadingCover(true);
      try {
        const image = result.assets[0];
        const fileName = `${user.id}_cover_${Date.now()}.jpg`;
        const base64 = await FileSystem.readAsStringAsync(image.uri, { encoding: "base64" });
        await supabase.storage.from('covers').upload(fileName, decode(base64), { contentType: 'image/jpeg', upsert: true });
        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(fileName);
        await supabase.from('rusers').update({ cover_url: publicUrl }).eq('id', user.id);
        loadData();
      } catch (error) { Alert.alert("Error", "Failed to upload cover photo"); }
      finally { setUploadingCover(false); }
    }
  };

  const handleUpdateBio = async () => {
    if (bioText.length > 160) { Alert.alert("Error", "Bio too long"); return; }
    setEditingBio(false);
    try {
      await supabase.from('rusers').update({ bio: bioText }).eq('id', user.id);
      loadData();
    } catch (error) { Alert.alert("Error", "Failed to update bio"); }
  };

  const handleSelectEmoji = async (emoji) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await supabase.from('rusers').update({ emoji_icon: emoji, avatar_url: null }).eq('id', user.id);
      setShowEmojiPicker(false);
      loadData();
    } catch (error) { Alert.alert("Error", "Failed to update icon"); }
  };

  const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await logoutUser(); router.replace("/"); } }
    ]);
  };

  const handleReaction = async (postId, reactionType, currentlyReacted) => {
    if (!deviceId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (currentlyReacted) {
        await supabase.from('rreactions').delete().match({ post_id: postId, reaction_type: reactionType, device_id: deviceId });
      } else {
        await supabase.from('rreactions').insert({ post_id: postId, reaction_type: reactionType, device_id: deviceId });
      }
      loadData();
    } catch (error) { console.error(error); }
  };

  const renderMediaGrid = () => {
    const mediaPosts = userPosts.filter(p => p.image_url || p.image_urls?.length > 0);
    return (
      <View style={styles.mediaGrid}>
        {mediaPosts.length > 0 ? (
          mediaPosts.map((post) => (
            <TouchableOpacity key={post.id} style={[styles.mediaItem, { backgroundColor: colors.surfaceHover }]} onPress={() => router.push(`/?postId=${post.id}`)}>
              <Image source={{ uri: post.image_url || post.image_urls?.[0] }} style={styles.mediaThumb} contentFit="cover" />
              {post.media_type === 'video' && <View style={styles.mediaTypeBadge}><Camera size={12} color="#FFF" /></View>}
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <ImageIcon size={40} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No media shared yet.</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading && !user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const tabs = isOwnProfile ? [
    { id: 'posts', label: 'Feed' },
    { id: 'media', label: 'Media' },
    { id: 'replies', label: 'Replies' },
    { id: 'saved', label: 'Saved' },
    { id: 'friends', label: 'Friends' }
  ] : [
    { id: 'posts', label: 'Posts' },
    { id: 'media', label: 'Media' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Section */}
        <View style={styles.coverContainer}>
          {user?.cover_url ? (
            <Image source={{ uri: user.cover_url }} style={styles.coverImage} />
          ) : (
            <LinearGradient colors={[colors.primary, colors.background]} style={styles.coverPlaceholder} />
          )}
          
          <TouchableOpacity onPress={() => router.back()} style={[styles.headerIcon, { left: 20, top: insets.top + 10, backgroundColor: colors.overlay }]}>
            <ChevronLeft color="#FFF" size={24} />
          </TouchableOpacity>

          {isOwnProfile && (
            <View style={{ position: 'absolute', right: 20, top: insets.top + 10, flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => router.push("/settings")} style={[styles.headerIcon, { backgroundColor: colors.overlay }]}>
                <SettingsIcon color="#FFF" size={20} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={[styles.headerIcon, { backgroundColor: 'rgba(239, 68, 68, 0.5)' }]}>
                <LogOut color="#FFF" size={20} />
              </TouchableOpacity>
            </View>
          )}

          {isOwnProfile && (
            <TouchableOpacity style={[styles.editCoverButton, { backgroundColor: colors.surface }]} onPress={handlePickCover}>
              <Camera size={16} color={colors.text} />
            </TouchableOpacity>
          )}
          {uploadingCover && <ActivityIndicator style={styles.coverLoader} color="#FFF" />}
        </View>

        {/* Profile Stats & Info */}
        <View style={styles.profileContent}>
          <View style={styles.headerRow}>
            <View style={[styles.avatarWrapper, { borderColor: colors.background, backgroundColor: colors.surface }]}>
              {isOwnProfile ? (
                <TouchableOpacity onPress={() => setShowEmojiPicker(true)} style={styles.avatarTouch}>
                  {user?.avatar_url ? <Image source={{ uri: user.avatar_url }} style={styles.avatar} /> : <Text style={styles.emojiAvatar}>{user?.emoji_icon || "👤"}</Text>}
                  <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary }]}>
                    <Camera size={10} color="#FFF" />
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.avatarTouch}>
                  {user?.avatar_url ? <Image source={{ uri: user.avatar_url }} style={styles.avatar} /> : <Text style={styles.emojiAvatar}>{user?.emoji_icon || "👤"}</Text>}
                </View>
              )}
            </View>
            
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.posts}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>POSTS</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>{friends.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>FRIENDS</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.reactions}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>KARMA</Text>
              </View>
            </View>
          </View>

          <View style={styles.userInfo}>
            <View style={styles.usernameRow}>
              <Text style={[styles.username, { color: colors.text, ...typography.h3 }]}>@{user?.username}</Text>
              {user?.is_admin && (
                <View style={[styles.badge, { backgroundColor: colors.warning + '33' }]}>
                  <Shield size={12} color={colors.warning} />
                  <Text style={[styles.badgeText, { color: colors.warning }]}>MOD</Text>
                </View>
              )}
            </View>
            
            {editingBio ? (
              <View style={[styles.bioEdit, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.bioInput, { color: colors.text }]}
                  value={bioText}
                  onChangeText={setBioText}
                  multiline
                  maxLength={160}
                  autoFocus
                />
                <View style={styles.bioActions}>
                  <TouchableOpacity onPress={() => setEditingBio(false)}><XIcon size={20} color={colors.danger} /></TouchableOpacity>
                  <TouchableOpacity onPress={handleUpdateBio}><Check size={20} color={colors.success} /></TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => isOwnProfile && setEditingBio(true)} disabled={!isOwnProfile}>
                <Text style={[styles.bio, { color: colors.textSecondary }]}>
                  {user?.bio || (isOwnProfile ? "Add a bio..." : "")}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Tabs */}
          <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
            {tabs.map(tab => (
              <TouchableOpacity 
                key={tab.id} 
                style={[styles.tab, activeTab === tab.id && { borderBottomColor: colors.primary }]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabText, { color: activeTab === tab.id ? colors.primary : colors.textTertiary }]}>
                  {tab.label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {activeTab === 'posts' && userPosts.map(post => <PostItem key={post.id} item={post} deviceId={deviceId} onReaction={handleReaction} user={currentUser} onComment={loadData} />)}
            {activeTab === 'media' && renderMediaGrid()}
            {activeTab === 'replies' && replies.map(r => (
              <View key={r.id} style={[styles.replyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.replyText, { color: colors.textSecondary }]}>{r.text}</Text>
                <TouchableOpacity onPress={() => router.push(`/?postId=${r.post_id}`)}>
                  <Text style={[styles.replyLink, { color: colors.primary }]}>on "{r.post?.title}"</Text>
                </TouchableOpacity>
              </View>
            ))}
            {activeTab === 'saved' && savedPosts.map(post => <PostItem key={post.id} item={post} deviceId={deviceId} onReaction={handleReaction} user={currentUser} onComment={loadData} />)}
            {activeTab === 'friends' && (
              <View style={styles.friendsTab}>
                <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Search size={18} color={colors.textTertiary} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Find friends..."
                    placeholderTextColor={colors.textTertiary}
                    value={friendUsername}
                    onChangeText={setFriendUsername}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={handleAddFriend} disabled={addingFriend}>
                    <UserPlus size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                {friends.map(f => (
                  <TouchableOpacity key={f.id} style={styles.friendItem} onPress={() => router.push(`/profile?userId=${f.id}`)}>
                    <Text style={{ fontSize: 24 }}>{f.emoji_icon || "👤"}</Text>
                    <Text style={[styles.friendName, { color: colors.text }]}>@{f.username}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Emoji Picker Modal */}
      {showEmojiPicker && (
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text, ...typography.h3 }]}>Choose Avatar</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => handleSelectEmoji(emoji)} style={[styles.emojiBtn, { backgroundColor: colors.background }]}>
                  <Text style={styles.emojiTxt}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: colors.primary }]} onPress={handlePickAvatar}>
              <Camera size={18} color="#FFF" />
              <Text style={styles.uploadBtnText}>UPLOAD PHOTO</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowEmojiPicker(false)}>
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ShareManager ref={shareRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  coverContainer: { height: 200, width: '100%', position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%' },
  headerIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  editCoverButton: { position: 'absolute', right: 16, bottom: 16, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  coverLoader: { position: 'absolute', right: 60, bottom: 20 },
  profileContent: { flex: 1, marginTop: -40, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 },
  avatarWrapper: { width: 90, height: 90, borderRadius: 45, borderWidth: 4, overflow: 'hidden' },
  avatarTouch: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatar: { width: '100%', height: '100%' },
  emojiAvatar: { fontSize: 48 },
  avatarEditBadge: { position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 8, paddingRight: 8 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  userInfo: { marginBottom: 24 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  username: { fontWeight: '800' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  bio: { fontSize: 15, lineHeight: 20 },
  bioEdit: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 12 },
  bioInput: { fontSize: 15, minHeight: 60, textAlignVertical: 'top' },
  bioActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 16 },
  tab: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  tabContent: { flex: 1 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  mediaItem: { width: (width - 40) / 3, height: (width - 40) / 3, borderRadius: 12, overflow: 'hidden' },
  mediaThumb: { width: '100%', height: '100%' },
  mediaTypeBadge: { position: 'absolute', right: 4, top: 4, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 4 },
  replyCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  replyText: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  replyLink: { fontSize: 12, fontWeight: '700' },
  friendsTab: { gap: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  friendItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  friendName: { fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', borderRadius: 24, padding: 24, borderWidth: 1 },
  modalTitle: { textAlign: 'center', marginBottom: 24 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 24 },
  emojiBtn: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  emojiTxt: { fontSize: 24 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16, borderRadius: 16, marginBottom: 16 },
  uploadBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  closeBtn: { alignItems: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '600' },
});
