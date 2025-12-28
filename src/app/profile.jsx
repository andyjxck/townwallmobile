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
  TextInput as RNTextInput,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../utils/supabase";
import { getStoredUser, logoutUser, initUser, isOnline } from "../utils/user";
import { getDeviceId } from "../utils/deviceId";
import { 
  ChevronLeft, 
  Camera, 
  LogOut, 
  User as UserIcon,
  Shield,
  UserPlus,
  Trash2,
  Image as ImageIcon,
  Check,
  X as XIcon,
  Settings as SettingsIcon,
  Search,
  Pencil,
  MessageCircle,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { decode } from "base64-arraybuffer";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import PostItem from "../components/PostItem";
import { ShareManager } from "../components/ShareManager";
import { theme } from "../utils/theme";

const { width } = Dimensions.get('window');
const EMOJIS = ["👤", "🐱", "🐶", "🦊", "🦁", "🐨", "🐸", "🐷", "🐵", "🦄", "🐲", "🤖", "👻", "👾", "👽", "💩"];

export default function Profile() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.userId;
  const insets = useSafeAreaInsets();
  
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
    const [editingUsername, setEditingUsername] = useState(false);
    const [editingNickname, setEditingNickname] = useState(false);
    const [bioText, setBioText] = useState("");
    const [usernameText, setUsernameText] = useState("");
    const [nicknameText, setNicknameText] = useState("");
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
      setUsernameText(userData?.username || "");
      setNicknameText(userData?.nickname || "");

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

  const handleUpdateBio = async () => {
    if (bioText.length > 160) { Alert.alert("Error", "Bio too long"); return; }
    setEditingBio(false);
    try {
      await supabase.from('rusers').update({ bio: bioText }).eq('id', user.id);
      loadData();
    } catch (error) { Alert.alert("Error", "Failed to update bio"); }
  };

  const handleUpdateUsername = async () => {
    if (usernameText.length < 3) { Alert.alert("Error", "Username too short"); return; }
    if (user.last_username_change) {
      const lastChange = new Date(user.last_username_change);
      const diff = (new Date() - lastChange) / (1000 * 60 * 60 * 24);
      if (diff < 30) {
        Alert.alert("Error", `You can only change your username once every 30 days. Try again in ${Math.ceil(30 - diff)} days.`);
        return;
      }
    }
    try {
      const { data: existing } = await supabase.from('rusers').select('id').eq('username', usernameText).neq('id', user.id).single();
      if (existing) { Alert.alert("Error", "Username taken"); return; }
      
      await supabase.from('rusers').update({ 
        username: usernameText, 
        last_username_change: new Date().toISOString() 
      }).eq('id', user.id);
      setEditingUsername(false);
      loadData();
    } catch (error) { Alert.alert("Error", "Failed to update username"); }
  };

  const handleUpdateNickname = async () => {
    if (nicknameText.length < 2) { Alert.alert("Error", "Nickname too short"); return; }
    if (user.last_nickname_change) {
      const lastChange = new Date(user.last_nickname_change);
      const diff = (new Date() - lastChange) / (1000 * 60 * 60 * 24);
      if (diff < 30) {
        Alert.alert("Error", `You can only change your nickname once every 30 days. Try again in ${Math.ceil(30 - diff)} days.`);
        return;
      }
    }
    try {
      await supabase.from('rusers').update({ 
        nickname: nicknameText, 
        last_nickname_change: new Date().toISOString() 
      }).eq('id', user.id);
      setEditingNickname(false);
      loadData();
    } catch (error) { Alert.alert("Error", "Failed to update nickname"); }
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

  const handleAddFriend = async () => {
    if (!friendUsername) return;
    setAddingFriend(true);
    try {
      const { data: friendUser, error: findError } = await supabase.from('rusers').select('id').eq('username', friendUsername).single();
      if (findError || !friendUser) throw new Error("User not found");
      if (friendUser.id === user.id) throw new Error("You can't add yourself");
      
      const { data: existing } = await supabase.from('friends').select('*').match({ user_id: user.id, friend_id: friendUser.id }).single();
      if (existing) throw new Error("Friend request already sent or accepted");

      await supabase.from('friends').insert({ user_id: user.id, friend_id: friendUser.id, status: 'pending' });
      Alert.alert("Success", "Friend request sent!");
      setFriendUsername("");
    } catch (error) { Alert.alert("Error", error.message); }
    finally { setAddingFriend(false); }
  };

  const handleAcceptFriend = async (requestId, friendId) => {
    try {
      await supabase.from('friends').update({ status: 'accepted' }).eq('id', requestId);
      await supabase.from('friends').insert({ user_id: user.id, friend_id: friendId, status: 'accepted' });
      loadData();
    } catch (error) { Alert.alert("Error", "Failed to accept request"); }
  };

  const handleRejectFriend = async (requestId) => {
    try {
      await supabase.from('friends').delete().eq('id', requestId);
      loadData();
    } catch (error) { Alert.alert("Error", "Failed to reject request"); }
  };

  const handleMessageUser = async () => {
    try {
      const storedUser = await getStoredUser();
      if (!storedUser) return;
      
      // Check if chat exists
      const { data: existing } = await supabase
        .from('rchats')
        .select('id')
        .or(`and(user1_id.eq.${storedUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${storedUser.id})`)
        .single();
      
      if (existing) {
        // Chat exists, the floating bubble will pick it up or we can trigger it
        Alert.alert("Chat", "You already have a chat with this user. Click the chat bubble to continue.");
      } else {
        await supabase.from('rchats').insert({
          user1_id: Math.min(storedUser.id, user.id),
          user2_id: Math.max(storedUser.id, user.id),
          last_message: "Chat started"
        });
        Alert.alert("Success", "Chat started! Click the bubble to message.");
      }
    } catch (error) { console.error(error); }
  };

  if (loading && !user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <ChevronLeft color={theme.colors.text} size={28} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Profile</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {isOwnProfile && (
              <TouchableOpacity onPress={() => router.push("/settings")} style={styles.headerIcon}>
                <SettingsIcon color={theme.colors.text} size={24} />
              </TouchableOpacity>
            )}
            {isOwnProfile && (
              user?.supabase_uid ? (
                <TouchableOpacity onPress={handleLogout} style={styles.headerIcon}>
                  <LogOut color={theme.colors.error} size={24} />
                </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => router.push("/auth")} style={styles.headerIcon}>
                    <UserPlus color={theme.colors.primary} size={24} />
                  </TouchableOpacity>
                )
            )}
            {!isOwnProfile && <View style={{ width: 40 }} />}
          </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileInfo}>
            <View style={styles.avatarSection}>
              <TouchableOpacity 
                onPress={() => isOwnProfile && setShowEmojiPicker(true)} 
                disabled={!isOwnProfile}
                style={[styles.avatarContainer, { backgroundColor: theme.colors.surface }]}
              >
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
                ) : (
                  <Text style={styles.avatarEmoji}>{user?.emoji_icon || "👤"}</Text>
                )}
                {isOwnProfile && (
                    <View style={[styles.editBadge, { backgroundColor: '#000' }]}>
                      <ImageIcon size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.nameSection}>
                {editingUsername ? (
                  <View style={styles.editRow}>
                    <RNTextInput
                      style={[styles.usernameInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                      value={usernameText}
                      onChangeText={setUsernameText}
                      autoCapitalize="none"
                      autoFocus
                    />
                    <TouchableOpacity onPress={handleUpdateUsername} style={styles.saveIcon}><Check size={20} color={theme.colors.success} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingUsername(false)} style={styles.saveIcon}><XIcon size={20} color={theme.colors.error} /></TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => isOwnProfile && setEditingUsername(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.username, { color: theme.colors.text }]}>@{user?.username}</Text>
                    {isOwnProfile && <Pencil size={14} color={theme.colors.textSecondary} />}
                  </TouchableOpacity>
                )}
                {isOnline(user?.last_seen) && <View style={styles.onlineDot} />}
              </View>

              <View style={styles.nicknameSection}>
                {editingNickname ? (
                  <View style={styles.editRow}>
                    <RNTextInput
                      style={[styles.usernameInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                      value={nicknameText}
                      onChangeText={setNicknameText}
                      placeholder="Set nickname..."
                      autoFocus
                    />
                    <TouchableOpacity onPress={handleUpdateNickname} style={styles.saveIcon}><Check size={20} color={theme.colors.success} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingNickname(false)} style={styles.saveIcon}><XIcon size={20} color={theme.colors.error} /></TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => isOwnProfile && setEditingNickname(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.nickname, { color: theme.colors.textSecondary }]}>
                      {user?.nickname ? `${user.nickname}` : (isOwnProfile ? "Set nickname" : "")}
                    </Text>
                    {isOwnProfile && <Pencil size={12} color={theme.colors.textSecondary} />}
                  </TouchableOpacity>
                )}
              </View>

              {user?.is_admin && (
                <TouchableOpacity onPress={() => router.push('/admin')} style={styles.adminBadge}>
                  <Shield size={12} color="#FFF" />
                  <Text style={styles.adminText}>MOD</Text>
                </TouchableOpacity>
              )}

              {editingBio ? (
                <View style={styles.bioEditContainer}>
                  <RNTextInput
                    style={[styles.bioInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    value={bioText}
                    onChangeText={setBioText}
                    multiline
                    maxLength={160}
                    placeholder="Tell us about yourself..."
                  />
                <View style={styles.bioButtons}>
                  <TouchableOpacity onPress={() => setEditingBio(false)} style={styles.bioCancel}><Text style={styles.bioCancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleUpdateBio} style={[styles.bioSave, { backgroundColor: theme.colors.primary }]}><Text style={styles.bioSaveText}>Save</Text></TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => isOwnProfile && setEditingBio(true)} disabled={!isOwnProfile}>
                <Text style={[styles.bio, { color: theme.colors.textSecondary }]}>
                  {user?.bio || (isOwnProfile ? "Tap to add a bio..." : "")}
                </Text>
              </TouchableOpacity>
            )}
          </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}><Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.posts}</Text><Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Posts</Text></View>
                <View style={styles.statItem}><Text style={[styles.statValue, { color: theme.colors.text }]}>{friends.length}</Text><Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Friends</Text></View>
              </View>

                {!isOwnProfile && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity 
                      onPress={handleMessageUser} 
                      style={styles.messageBtn}
                    >
                      <LinearGradient
                        colors={[theme.colors.primary, '#4ADE80']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.messageBtnGradient}
                      >
                        <MessageCircle size={20} color="#000" />
                        <Text style={styles.messageBtnText}>Message</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}


            <View style={styles.tabBar}>
              <TouchableOpacity onPress={() => setActiveTab("posts")} style={[styles.tab, activeTab === "posts" && { borderBottomColor: theme.colors.primary }]}><Text style={[styles.tabText, { color: activeTab === "posts" ? theme.colors.primary : theme.colors.textSecondary }]}>FEED</Text></TouchableOpacity>
              {isOwnProfile && <TouchableOpacity onPress={() => setActiveTab("starred")} style={[styles.tab, activeTab === "starred" && { borderBottomColor: theme.colors.primary }]}><Text style={[styles.tabText, { color: activeTab === "starred" ? theme.colors.primary : theme.colors.textSecondary }]}>STARRED</Text></TouchableOpacity>}
              {isOwnProfile && <TouchableOpacity onPress={() => setActiveTab("friends")} style={[styles.tab, activeTab === "friends" && { borderBottomColor: theme.colors.primary }]}><Text style={[styles.tabText, { color: activeTab === "friends" ? theme.colors.primary : theme.colors.textSecondary }]}>FRIENDS</Text></TouchableOpacity>}
            </View>

            <View style={styles.tabContent}>
              {activeTab === "posts" && (
                userPosts.length > 0 ? (
                  userPosts.map(post => <PostItem key={post.id} item={post} deviceId={deviceId} onReaction={handleReaction} user={currentUser} onComment={loadData} />)
                ) : (
                  <View style={styles.emptyContainer}><Text style={styles.emptyText}>No posts yet</Text></View>
                )
              )}
              {activeTab === "starred" && (
                savedPosts.length > 0 ? (
                  savedPosts.map(post => <PostItem key={post.id} item={post} deviceId={deviceId} onReaction={handleReaction} user={currentUser} onComment={loadData} />)
                ) : (
                  <View style={styles.emptyContainer}><Text style={styles.emptyText}>No starred posts</Text></View>
                )
              )}
              {activeTab === "friends" && (
                <View style={styles.friendsContainer}>
                  <View style={styles.addFriendSection}>
                    <RNTextInput
                      style={[styles.friendInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                      placeholder="Add by username..."
                      value={friendUsername}
                      onChangeText={setFriendUsername}
                      autoCapitalize="none"
                    />
                  <TouchableOpacity 
                      onPress={handleAddFriend} 
                      disabled={addingFriend}
                      style={[styles.addBtn, { backgroundColor: '#000' }]}
                    >
                      <UserPlus color="#FFF" size={20} />
                    </TouchableOpacity>
                </View>

                {pendingRequests.length > 0 && (
                  <View style={styles.requestsSection}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Pending Requests</Text>
                    {pendingRequests.map(r => (
                      <View key={r.id} style={styles.requestItem}>
                        <Text style={{ fontSize: 24 }}>{r.emoji_icon || "👤"}</Text>
                        <Text style={[styles.requestName, { color: theme.colors.text }]}>@{r.username}</Text>
                        <View style={styles.requestBtns}>
                          <TouchableOpacity onPress={() => handleAcceptFriend(r.requestId, r.id)} style={[styles.acceptBtn, { backgroundColor: theme.colors.success }]}><Check color="#FFF" size={16} /></TouchableOpacity>
                          <TouchableOpacity onPress={() => handleRejectFriend(r.requestId)} style={[styles.rejectBtn, { backgroundColor: theme.colors.error }]}><XIcon color="#FFF" size={16} /></TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 20 }]}>Friends ({friends.length})</Text>
                  {friends.map(f => (
                    <TouchableOpacity key={f.id} style={styles.friendItem} onPress={() => router.push(`/profile?userId=${f.id}`)}>
                      <View style={styles.friendAvatarContainer}>
                        <Text style={{ fontSize: 24 }}>{f.emoji_icon || "👤"}</Text>
                        {isOnline(f.last_seen) && <View style={styles.friendOnlineDot} />}
                      </View>
                      <Text style={[styles.friendName, { color: theme.colors.text }]}>@{f.username}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}
          </View>
        </View>
        </ScrollView>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            You've been on the wall since {stats.joined}
          </Text>
        </View>

        {showEmojiPicker && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Choose Icon</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => handleSelectEmoji(emoji)} style={styles.emojiItem}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={handlePickAvatar} style={[styles.photoBtn, { backgroundColor: theme.colors.surface }]}><Camera size={20} color={theme.colors.text} /><Text style={[styles.photoBtnText, { color: theme.colors.text }]}>upload image</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowEmojiPicker(false)} style={styles.closeBtn}><Text style={styles.closeBtnText}>Cancel</Text></TouchableOpacity>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  headerIcon: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  profileInfo: { paddingHorizontal: 16, paddingTop: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 16, position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarEmoji: { fontSize: 60 },
  editBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF' },
  photoActions: { width: '100%', alignItems: 'center', marginBottom: 20 },
  nameSection: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  username: { fontSize: 24, fontWeight: 'bold' },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', marginLeft: 4 },
  adminBadge: { backgroundColor: '#6366f1', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', marginTop: 4 },
  adminText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  usernameInput: { borderBottomWidth: 1, fontSize: 18, paddingVertical: 4, minWidth: 150 },
  saveIcon: { padding: 4 },
  nicknameSection: { marginBottom: 12 },
  nickname: { fontSize: 16, fontWeight: '500' },
  bio: { fontSize: 16, textAlign: 'center', paddingHorizontal: 20 },
  bioEditContainer: { width: '100%', gap: 10 },
  bioInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, minHeight: 80, textAlignVertical: 'top' },
  bioButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  bioCancel: { padding: 10 },
  bioCancelText: { color: '#ef4444' },
  bioSave: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  bioSaveText: { color: '#FFF', fontWeight: 'bold' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, marginBottom: 20 },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: 'bold' },
    statLabel: { fontSize: 12 },
    tabBar: { flexDirection: 'row', marginBottom: 10 },
    tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabText: { fontWeight: 'bold', fontSize: 13 },
    tabContent: { flex: 1, paddingBottom: 40 },
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#94a3b8' },
    friendsContainer: { padding: 10 },
    addFriendSection: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    friendInput: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 },
    addBtn: { width: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
    requestItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    requestName: { flex: 1, fontWeight: 'bold' },
    requestBtns: { flexDirection: 'row', gap: 8 },
    acceptBtn: { padding: 8, borderRadius: 8 },
    rejectBtn: { padding: 8, borderRadius: 8 },
    friendItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    friendAvatarContainer: { position: 'relative' },
    friendOnlineDot: { position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', borderWidth: 1, borderColor: '#000' },
    friendName: { fontWeight: 'bold' },
    footer: { paddingVertical: 30, alignItems: 'center' },
    footerText: { fontSize: 12, fontWeight: '600' },
    actionRow: { paddingVertical: 10, alignItems: 'center', width: '100%', paddingHorizontal: 20 },
    messageBtn: { width: '100%', borderRadius: 25, overflow: 'hidden' },
    messageBtnGradient: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'center', 
      paddingVertical: 12,
      gap: 10 
    },
    messageBtnText: { fontWeight: 'bold', fontSize: 16, color: '#000' },
    modalOverlay: { 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.8)', 
      justifyContent: 'center', 
      alignItems: 'center',
      zIndex: 1000
    },
  modalContent: { width: '80%', padding: 20, borderRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15, marginBottom: 20 },
  emojiItem: { padding: 5 },
  emojiText: { fontSize: 32 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, borderRadius: 10, marginBottom: 10 },
  photoBtnText: { fontWeight: 'bold' },
  closeBtn: { padding: 15, alignItems: 'center' },
  closeBtnText: { color: '#ef4444', fontWeight: 'bold' },
});
