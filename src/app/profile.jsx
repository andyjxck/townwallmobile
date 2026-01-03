import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
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
        Bell,
        UserCheck,
        Phone,
        ShieldAlert,
        MoreVertical,
      } from "lucide-react-native";
  import AsyncStorage from "@react-native-async-storage/async-storage";
  import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { File as FileSystemNext } from "expo-file-system/next";
import * as Haptics from "expo-haptics";
  import { decode } from "base64-arraybuffer";
  import { LinearGradient } from "expo-linear-gradient";
  import { useSafeAreaInsets } from "react-native-safe-area-context";
  import { Image } from "expo-image";
  import PostItem from "../components/PostItem";
  import { ShareManager } from "../components/ShareManager";
  import { theme } from "../utils/theme";
  import { useTheme } from "@/utils/ThemeContext";
  import { sendFriendRequestNotification, sendFriendAcceptedNotification } from "../utils/notifications";
  import { getSavedProfiles, saveProfile, removeProfile } from "../utils/savedProfiles";
  import { useAuth, useAuthStore, useChatStore } from "../utils/auth";
  import { acceptFriendRequest, rejectFriendRequest, fetchPendingRequests } from "../utils/friends";


const { width } = Dimensions.get('window');
const EMOJIS = ["👤", "🐱", "🐶", "🦊", "🦁", "🐨", "🐸", "🐷", "🐵", "🦄", "🐲", "🤖", "👻", "👾", "👽", "💩"];

  export default function Profile() {
    const { isHippie } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams();
    const userId = params.userId;
    const insets = useSafeAreaInsets();
    const { signOut } = useAuth();

  
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ posts: 0, reactions: 0, joined: "" });
  const [replies, setReplies] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [friendUsername, setFriendUsername] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [friends, setFriends] = useState([]);
    const [addingFriend, setAddingFriend] = useState(false);
    const [friendshipStatus, setFriendshipStatus] = useState(null); // { status: 'pending'|'accepted', isRequester: boolean }
    const [userPosts, setUserPosts] = useState([]);
    const [showRequestsModal, setShowRequestsModal] = useState(false);

    const [savedPosts, setSavedPosts] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [activeTab, setActiveTab] = useState("posts");
    const [deviceId, setDeviceId] = useState(null);
    const [editingBio, setEditingBio] = useState(false);
    const [editingUsername, setEditingUsername] = useState(false);
    const [editingNickname, setEditingNickname] = useState(false);
    const [showNicknameModal, setShowNicknameModal] = useState(false);
    const [bioText, setBioText] = useState("");
    const [usernameText, setUsernameText] = useState("");
    const [nicknameText, setNicknameText] = useState("");
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [reportingUser, setReportingUser] = useState(null);
    const shareRef = useRef();

  useEffect(() => {
    if (activeTab !== 'friends' || !friendUsername || friendUsername.length < 2) {
      setSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      setSearching(true);
      try {
        const { data } = await supabase
          .from('rusers')
          .select('id, username, nickname, avatar_url, emoji_icon')
          .ilike('username', `%${friendUsername}%`)
          .limit(10);
        
        // Filter out current user and existing friends
        const friendIds = friends.map(f => f.id);
        const filtered = data?.filter(u => u.id !== currentUser?.id && !friendIds.includes(u.id)) || [];
        setSearchResults(filtered);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setSearching(false);
      }
    };

    const timer = setTimeout(searchUsers, 500);
    return () => clearTimeout(timer);
  }, [friendUsername, activeTab, friends]);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    loadData();

    const setupRealtimeSubscriptions = async () => {
      const storedUser = useAuthStore.getState().auth;
      if (!storedUser) return;

      const channel = supabase
        .channel(`profile_${storedUser.id}_${userId || 'self'}`)
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'rusers', 
          filter: `id=eq.${userId || storedUser.id}` 
        }, (payload) => {
          setUser(payload.new);
          if (isOwnProfile) {
            setBioText(payload.new.bio || "");
            setUsernameText(payload.new.username || "");
            setNicknameText(payload.new.nickname || "");
          }
        })
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'friends',
          filter: `user_id=eq.${storedUser.id}`
        }, () => loadData())
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'friends',
          filter: `friend_id=eq.${storedUser.id}`
        }, () => loadData())
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
      const storedUser = useAuthStore.getState().auth;
      setCurrentUser(storedUser);
      
      let profileUserId = userId ? parseInt(userId) : storedUser?.id;
      const viewingOwnProfile = !userId || (storedUser?.id && parseInt(userId) === storedUser.id);
      setIsOwnProfile(viewingOwnProfile);
      
        let userData;
        if (viewingOwnProfile && storedUser?.id) {
          const { data: freshUser } = await supabase.from('rusers').select('*').eq('id', storedUser.id).single();
          if (freshUser) {
            userData = freshUser;
            // Only sync store and storage if data actually changed to avoid re-render loops
            const hasChanged = JSON.stringify(freshUser) !== JSON.stringify(storedUser);
            if (hasChanged) {
              useAuthStore.getState().setAuth(freshUser);
              await AsyncStorage.setItem("@redditch_user_data", JSON.stringify(freshUser));
            }
          } else {
            userData = storedUser;
          }
        } else if (profileUserId) {

        const { data: otherUser } = await supabase.from('rusers').select('*').eq('id', profileUserId).single();
        userData = otherUser;
      }

        if (!userData && viewingOwnProfile) userData = await initUser();
        
          // Prevent viewing other anon profiles
          if (userData && !userData.password && !viewingOwnProfile) {
            Alert.alert("Private Profile", "Anonymous profiles are private and cannot be visited.");
            router.back();
            return;
          }

          setUser(userData);
          setBioText(userData?.bio || "");
          setUsernameText(userData?.username || "");
          setNicknameText(userData?.nickname || "");

          if (userData) {
            if (!viewingOwnProfile && storedUser?.id) {
              // Check friendship status with current user
              const { data: relList } = await supabase
                .from('friends')
                .select('*')
                .or(`and(user_id.eq.${storedUser.id},friend_id.eq.${userData.id}),and(user_id.eq.${userData.id},friend_id.eq.${storedUser.id})`);
              
              const rel = relList?.find(r => r.user_id === storedUser.id) || relList?.[0];
            
            if (rel) {
              setFriendshipStatus({
                id: rel.id,
                status: rel.status,
                isRequester: rel.user_id === storedUser.id
              });
            } else {
              setFriendshipStatus(null);
            }
          }

        const { count: postCount } = await supabase.from('rposts').select('*', { count: 'exact', head: true }).eq('user_id', userData.id);
        const { count: reactionCount } = await supabase.from('rreactions').select('*, rposts!inner(user_id)', { count: 'exact', head: true }).eq('rposts.user_id', userData.id);
        
        setStats({ 
          posts: postCount || 0,
          reactions: reactionCount || 0,
          joined: new Date(userData.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        });

          if (viewingOwnProfile) {
            const { data: savedData } = await supabase.from('rsaved_posts').select(`post:post_id (id, title, text, created_at, user_id, zone_id, tag_id, image_url, image_urls, media_type, cta_type, cta_group_id, is_anonymous, moderation_status, is_deleted, user:rusers!user_id (username, emoji_icon, avatar_url), zone:rzones!zone_id (name), tag:rtags!tag_id (name), poll_id, reactions:rreactions (reaction_type, device_id))`).eq('user_id', userData.id);
            setSavedPosts(savedData?.map(s => s.post).filter(p => p && !p.is_deleted) || []);

            const requests = await fetchPendingRequests(userData.id);
            setPendingRequests(requests);
          }


        const { data: friendData } = await supabase.from('friends').select('friend_id, rusers!friends_friend_id_fkey(id, username, emoji_icon, avatar_url)').eq('user_id', userData.id).eq('status', 'accepted');
        const friendsList = friendData?.map(f => f.rusers) || [];
        setFriends(friendsList);
        const friendIds = viewingOwnProfile ? friendsList.map(f => f.id) : [];

        let feedPosts = [];
          if (viewingOwnProfile) {
            const { data: ownPosts } = await supabase.from('rposts').select(`id, title, text, created_at, user_id, zone_id, tag_id, image_url, image_urls, media_type, cta_type, cta_group_id, is_anonymous, moderation_status, is_deleted, user:rusers!user_id (username, emoji_icon, avatar_url), zone:rzones!zone_id (name), tag:rtags!tag_id (name), poll_id, reactions:rreactions (reaction_type, device_id)`).eq('user_id', userData.id).eq('is_deleted', false).in('moderation_status', ['approved', 'held']).order('created_at', { ascending: false });
            
            const { data: friendPosts } = friendIds.length > 0 
              ? await supabase.from('rposts').select(`id, title, text, created_at, user_id, zone_id, tag_id, image_url, image_urls, media_type, cta_type, cta_group_id, is_anonymous, moderation_status, is_deleted, user:rusers!user_id (username, emoji_icon, avatar_url), zone:rzones!zone_id (name), tag:rtags!tag_id (name), poll_id, reactions:rreactions (reaction_type, device_id)`).in('user_id', friendIds).eq('is_deleted', false).eq('moderation_status', 'approved').order('created_at', { ascending: false })
              : { data: [] };
            
            feedPosts = [...(ownPosts || []), ...(friendPosts || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          } else {
            const { data: posts } = await supabase.from('rposts').select(`id, title, text, created_at, user_id, zone_id, tag_id, image_url, image_urls, media_type, cta_type, cta_group_id, is_anonymous, moderation_status, is_deleted, user:rusers!user_id (username, emoji_icon, avatar_url), zone:rzones!zone_id (name), tag:rtags!tag_id (name), poll_id, reactions:rreactions (reaction_type, device_id)`).eq('user_id', userData.id).eq('is_deleted', false).eq('moderation_status', 'approved').order('created_at', { ascending: false });
            feedPosts = posts || [];
          }
          setUserPosts(feedPosts);

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
          const file = new FileSystemNext(image.uri);
          const bytes = await file.bytes();
          await supabase.storage.from('avatars').upload(fileName, bytes, { contentType: 'image/jpeg', upsert: true });
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            await supabase.from('rusers').update({ avatar_url: publicUrl, emoji_icon: null }).eq('id', user.id);
            await saveProfile({ username: user.username, avatar_url: publicUrl, emoji_icon: null });
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
      await saveProfile({ username: user.username, emoji_icon: emoji, avatar_url: null });
      setShowEmojiPicker(false);
      loadData();
    } catch (error) { Alert.alert("Error", "Failed to update icon"); }
  };

  const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
        await signOut();
        router.replace("/");
      }}
    ]);
  };

  const handleReaction = async (postId, reactionType, currentlyReacted) => {
    if (!deviceId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (currentlyReacted) {
        await supabase.from('rreactions').delete().match({ post_id: postId, reaction_type: reactionType, device_id: deviceId });
      } else {
        const { data: reactionData } = await supabase.from('rreactions').insert({ 
          post_id: postId, 
          reaction_type: reactionType, 
          device_id: deviceId,
          user_id: currentUser?.id 
        }).select('*, post:rposts(user_id, title)').single();

        if (reactionData?.post?.user_id && reactionData.post.user_id !== currentUser?.id) {
          await sendNotification({
            userId: reactionData.post.user_id,
            title: `New ${reactionType === 'helpful' ? 'Like' : 'Superlike'}!`,
            message: `@${currentUser?.username || 'Someone'} ${reactionType === 'helpful' ? 'liked' : 'superliked'} your post: "${reactionData.post.title || 'Untitled'}"`,
            type: 'reaction',
            link: `/post?id=${postId}`
          });
        }
      }
      loadData();
    } catch (error) { console.error(error); }
  };

  const handleAddFriend = async (targetUser = null) => {
    const target = targetUser || (friendUsername ? { username: friendUsername } : null);
    if (!target) return;

    if (!currentUser?.password && !currentUser?.supabase_uid) {
      Alert.alert("Join the Wall", "Please sign up to add friends!");
      return;
    }
    setAddingFriend(true);
    try {
      let friendUser = target.id ? target : null;
      
      if (!friendUser) {
        const { data, error: findError } = await supabase.from('rusers').select('id, username').eq('username', target.username).single();
        if (findError || !data) throw new Error("User not found");
        friendUser = data;
      }

      const myId = currentUser?.id || user.id;
      if (friendUser.id === myId) throw new Error("You can't add yourself");
      
      const { data: existing } = await supabase.from('friends').select('*').match({ user_id: myId, friend_id: friendUser.id }).single();
      if (existing) throw new Error("Friend request already sent or accepted");

      const { data: newRel, error: insertError } = await supabase.from('friends').insert({ user_id: myId, friend_id: friendUser.id, status: 'pending' }).select().single();
      if (insertError) throw insertError;
      
      await sendFriendRequestNotification({
        senderId: myId,
        senderUsername: user.username,
        receiverId: friendUser.id,
        requestId: newRel.id
      });
      
      Alert.alert("Success", `Friend request sent to @${friendUser.username}!`);
      setFriendUsername("");
      setSearchResults([]);
    } catch (error) { Alert.alert("Error", error.message); }
    finally { setAddingFriend(false); }
  };

  const handleAcceptFriend = async (requestId, friendId) => {
    try {
      await supabase.from('friends').update({ status: 'accepted' }).eq('id', requestId);
      await supabase.from('friends').insert({ user_id: currentUser.id, friend_id: user.id, status: 'accepted' });
      
      await sendFriendAcceptedNotification({
        acceptorId: currentUser.id,
        acceptorUsername: currentUser.username,
        requesterId: user.id
      });
      
      loadData();
    } catch (error) { Alert.alert("Error", "Failed to accept request"); }
  };

  const handleRejectFriend = async (requestId) => {
    try {
      await supabase.from('friends').delete().eq('id', requestId);
      loadData();
    } catch (error) { Alert.alert("Error", "Failed to reject request"); }
  };

    const handleActionFriend = async () => {
      if (!currentUser || !user) return;
      setAddingFriend(true);
      try {
        if (currentUser.id === user.id) {
          Alert.alert("Error", "You can't add yourself");
          return;
        }
        if (!friendshipStatus) {
          // Send request
          const { data: newRel, error } = await supabase.from('friends').insert({ 
            user_id: currentUser.id, 
            friend_id: user.id, 
            status: 'pending' 
          }).select().single();
          
          if (error) throw error;
          
          await sendFriendRequestNotification({
            senderId: currentUser.id,
            senderUsername: currentUser.username,
            receiverId: user.id,
            requestId: newRel.id
          });
          
          setFriendshipStatus({ id: newRel.id, status: 'pending', isRequester: true });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (friendshipStatus.status === 'pending') {
          if (friendshipStatus.isRequester) {
            // Cancel request
            await supabase.from('friends').delete().eq('id', friendshipStatus.id);
            setFriendshipStatus(null);
          } else {
            // Accept request
            await handleAcceptFriend(friendshipStatus.id, user.id);
          }
        }
      } catch (error) {
        Alert.alert("Error", error.message);
      } finally {
        setAddingFriend(false);
      }
    };

    const handleMessageUser = async (targetUser = null) => {
      const target = targetUser || user;
      if (!target) return;

      try {
        const storedUser = useAuthStore.getState().auth;
        if (!storedUser) return;
        
        // Check if chat exists
        const { data: existing } = await supabase
          .from('rchats')
          .select('id, status')
          .or(`and(user1_id.eq.${storedUser.id},user2_id.eq.${target.id}),and(user1_id.eq.${target.id},user2_id.eq.${storedUser.id})`)
          .single();
        
            if (existing) {
              if (existing.status === 'rejected') {
                Alert.alert("Error", "You cannot message this user.");
                return;
              }
              
              // If it's pending, check if they are friends now
              if (existing.status === 'pending') {
                const { data: friendship } = await supabase
                  .from('friends')
                  .select('id')
                  .match({ user_id: storedUser.id, friend_id: target.id, status: 'accepted' })
                  .single();
                
                if (friendship) {
                  await supabase.from('rchats').update({ status: 'accepted' }).eq('id', existing.id);
                }
              }

              useChatStore.getState().open(existing.id);
            } else {
            // Check if they are friends
            const { data: friendship } = await supabase
              .from('friends')
              .select('id')
              .or(`and(user_id.eq.${storedUser.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${storedUser.id})`)
              .eq('status', 'accepted')
              .single();

            const status = friendship ? 'accepted' : 'pending';

            const { data: newChat } = await supabase.from('rchats').insert({
              user1_id: Math.min(storedUser.id, target.id),
              user2_id: Math.max(storedUser.id, target.id),
              last_message: status === 'pending' ? "Chat Request" : "Chat started",
              status: status,
              initiated_by: storedUser.id
            }).select().single();

            if (newChat) {
              useChatStore.getState().open(newChat.id);
              if (status === 'pending') {
                Alert.alert("Request Sent", "Message request sent! They'll need to approve it before you can chat.");
              }
            }
          }
      } catch (error) { console.error(error); }
    };

    const handleCallUser = async (targetUser) => {
      Alert.alert("Call?", `Do you want to call @${targetUser.username}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Call", onPress: async () => {
          try {
            const storedUser = useAuthStore.getState().auth;
            if (!storedUser) return;
            
            // 1. Find or create chat
            const { data: existing } = await supabase
              .from('rchats')
              .select('id, status')
              .or(`and(user1_id.eq.${storedUser.id},user2_id.eq.${targetUser.id}),and(user1_id.eq.${targetUser.id},user2_id.eq.${storedUser.id})`)
              .single();
            
            let chatId;
            if (existing) {
              chatId = existing.id;
              // Ensure it's accepted if they are friends
              if (existing.status === 'pending') {
                await supabase.from('rchats').update({ status: 'accepted' }).eq('id', chatId);
              }
            } else {
              const { data: newChat } = await supabase.from('rchats').insert({
                user1_id: Math.min(storedUser.id, targetUser.id),
                user2_id: Math.max(storedUser.id, targetUser.id),
                status: 'accepted',
                initiated_by: storedUser.id
              }).select().single();
              chatId = newChat.id;
            }

            // 2. Open chat and signal call
            useChatStore.getState().open(chatId);
            useChatStore.getState().setPendingCallUserId(targetUser.id);
          } catch (error) {
            console.error(error);
          }
        }}
      ]);
    };

    const handleRemoveFriend = async (targetUser) => {
      Alert.alert("Remove Friend", `Are you sure you want to remove @${targetUser.username} from your friends?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: async () => {
          try {
            const storedUser = useAuthStore.getState().auth;
            await supabase.from('friends')
              .delete()
              .or(`and(user_id.eq.${storedUser.id},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${storedUser.id})`);
            loadData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.error(error);
          }
        }}
      ]);
    };

    const handleReportUser = async (targetUser) => {
      setReportingUser(targetUser);
      setReportReason("");
      setShowReportModal(true);
    };

    const submitReport = async (targetUser, reason) => {
      try {
        const storedUser = useAuthStore.getState().auth;
        await supabase.from('rmoderation_logs').insert({
          target_id: targetUser.id,
          target_type: 'user',
          action: 'report',
          reason: reason,
          metadata: { reported_by: storedUser.id, username: targetUser.username }
        });
        setShowReportModal(false);
        setReportingUser(null);
        Alert.alert("Thank you", "Your report has been submitted for review.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.error(error);
        Alert.alert("Error", "Failed to submit report.");
      }
    };

    const handleMoreActions = (friend) => {
      Alert.alert(
        `@${friend.username}`,
        null,
        [
          { text: "Report User", onPress: () => handleReportUser(friend) },
          { text: "Remove Friend", style: "destructive", onPress: () => handleRemoveFriend(friend) },
          { text: "Cancel", style: "cancel" }
        ]
      );
    };

    const handleModAction = async (postId, action, reason = null) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        if (action === 'delete') {
          await supabase.from('rposts').update({ is_deleted: true }).eq('id', postId);
          Alert.alert("Success", "Post deleted");
        } else if (action === 'toggle_comments') {
          const post = userPosts.find(p => p.id === postId) || savedPosts.find(p => p.id === postId);
          await supabase.from('rposts').update({ comments_disabled: !post?.comments_disabled }).eq('id', postId);
          Alert.alert("Success", post?.comments_disabled ? "Comments enabled" : "Comments disabled");
        } else if (action === 'blur') {
          await supabase.from('rposts').update({ is_blurred: true, blur_reason: reason }).eq('id', postId);
          Alert.alert("Success", "Post blurred");
        } else if (action === 'unblur') {
          await supabase.from('rposts').update({ is_blurred: false, blur_reason: null }).eq('id', postId);
          Alert.alert("Success", "Blur removed");
        }
        loadData();
      } catch (e) { 
        console.error(e); 
        Alert.alert("Error", "Failed to perform action");
      }
    };

    if (loading && !user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isHippie ? 'transparent' : theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isHippie ? 'transparent' : theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <ChevronLeft color={theme.colors.text} size={28} />
        </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Profile</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {isOwnProfile && (
                <TouchableOpacity onPress={() => setShowRequestsModal(true)} style={styles.headerIcon}>
                  <Bell color={pendingRequests.length > 0 ? theme.colors.primary : theme.colors.text} size={24} />
                  {pendingRequests.length > 0 && (
                    <View style={[styles.requestBadge, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.requestBadgeText}>{pendingRequests.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              {isOwnProfile && (
                <TouchableOpacity onPress={() => router.push("/settings")} style={styles.headerIcon}>
                  <SettingsIcon color={theme.colors.text} size={24} />
                </TouchableOpacity>
              )}

              {isOwnProfile && (
                user?.password ? (
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
                  <TouchableOpacity onPress={() => isOwnProfile && setShowNicknameModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.nickname, { color: theme.colors.textSecondary }]}>
                      {user?.nickname ? `${user.nickname}` : (isOwnProfile ? "Set nickname" : "")}
                    </Text>
                    {isOwnProfile && <Pencil size={12} color={theme.colors.textSecondary} />}
                  </TouchableOpacity>
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
                            onPress={() => {
                              if (!currentUser?.password && !currentUser?.supabase_uid) {
                                Alert.alert("Join the Wall", "Please sign up to message other users!");
                                return;
                              }
                              handleMessageUser();
                            }} 
                            style={[styles.messageBtn, { flex: 1 }]}
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

                            <TouchableOpacity 
                              onPress={() => {
                                if (!currentUser?.password && !currentUser?.supabase_uid) {
                                  Alert.alert("Join the Wall", "Please sign up to add friends!");
                                  return;
                                }
                                handleActionFriend();
                              }} 
                              disabled={addingFriend || friendshipStatus?.status === 'accepted'}
                              style={[styles.messageBtn, { flex: 1, marginLeft: 10 }]}
                            >
                            <LinearGradient
                              colors={['#818CF8', '#C084FC']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[
                                styles.messageBtnGradient,
                                (addingFriend || friendshipStatus?.status === 'accepted') && { opacity: 0.7 }
                              ]}
                            >
                              {addingFriend ? (
                                <ActivityIndicator size="small" color="#000" />
                              ) : (
                                <>
                                  {friendshipStatus?.status === 'accepted' ? (
                                    <Check size={20} color="#000" />
                                  ) : (
                                    <UserPlus size={20} color="#000" />
                                  )}
                                  <Text style={styles.messageBtnText}>
                                    {friendshipStatus ? (
                                      friendshipStatus.status === 'accepted' ? 'Friends' :
                                      friendshipStatus.isRequester ? 'Requested' : 'Accept'
                                    ) : 'Add Friend'}
                                  </Text>
                                </>
                              )}
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
                  userPosts.map(post => <PostItem key={post.id} item={post} deviceId={deviceId} onReaction={handleReaction} user={currentUser} onComment={loadData} onModAction={handleModAction} />)
                ) : (
                  <View style={styles.emptyContainer}><Text style={styles.emptyText}>No posts yet</Text></View>
                )
              )}
              {activeTab === "starred" && (
                savedPosts.length > 0 ? (
                  savedPosts.map(post => <PostItem key={post.id} item={post} deviceId={deviceId} onReaction={handleReaction} user={currentUser} onComment={loadData} onModAction={handleModAction} />)
                ) : (
                  <View style={styles.emptyContainer}><Text style={styles.emptyText}>No starred posts</Text></View>
                )
              )}
                {activeTab === "friends" && (
                  <View style={styles.friendsContainer}>
                    <View style={styles.addFriendSection}>
                      <View style={{ flex: 1, position: 'relative' }}>
                        <RNTextInput
                          style={[styles.friendInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                          placeholder="Search for friends..."
                          value={friendUsername}
                          onChangeText={setFriendUsername}
                          autoCapitalize="none"
                        />
                        {searching && (
                          <ActivityIndicator size="small" color={theme.colors.primary} style={{ position: 'absolute', right: 12, top: 12 }} />
                        )}
                      </View>
                      {!searchResults.length && (
                        <TouchableOpacity 
                          onPress={() => handleAddFriend()} 
                          disabled={addingFriend || !friendUsername}
                          style={[styles.addBtn, { backgroundColor: '#000', opacity: (!friendUsername || addingFriend) ? 0.5 : 1 }]}
                        >
                          <UserPlus color="#FFF" size={20} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {searchResults.length > 0 && (
                      <View style={[styles.resultsSection, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.resultsTitle, { color: theme.colors.textSecondary }]}>Search Results</Text>
                        {searchResults.map(result => (
                          <View key={result.id} style={[styles.resultItem, { borderBottomColor: theme.colors.border }]}>
                            <TouchableOpacity 
                              style={styles.resultInfo}
                              onPress={() => router.push(`/profile?userId=${result.id}`)}
                            >
                              {result.avatar_url ? (
                                <Image source={{ uri: result.avatar_url }} style={styles.resultAvatar} />
                              ) : (
                                <Text style={styles.resultEmoji}>{result.emoji_icon || "👤"}</Text>
                              )}
                              <View>
                                <Text style={[styles.resultUsername, { color: theme.colors.text }]}>@{result.username}</Text>
                                <Text style={[styles.resultNickname, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                                  {result.nickname || 'No nickname'}
                                </Text>
                              </View>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              onPress={() => handleAddFriend(result)}
                              style={[styles.resultAddBtn, { backgroundColor: theme.colors.primary }]}
                            >
                              <UserPlus color="#000" size={16} />
                              <Text style={styles.resultAddText}>Add</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

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
                    <View key={f.id} style={styles.friendItem}>
                      <TouchableOpacity 
                        style={[styles.friendInfo, { flex: 1 }]} 
                        onPress={() => router.push(`/profile?userId=${f.id}`)}
                      >
                        <View style={styles.friendAvatarContainer}>
                          {f.avatar_url ? (
                            <Image source={{ uri: f.avatar_url }} style={styles.friendAvatar} />
                          ) : (
                            <Text style={{ fontSize: 24 }}>{f.emoji_icon || "👤"}</Text>
                          )}
                          {isOnline(f.last_seen) && <View style={styles.friendOnlineDot} />}
                        </View>
                        <Text style={[styles.friendName, { color: theme.colors.text }]} numberOfLines={1}>@{f.username}</Text>
                      </TouchableOpacity>
                      
                      <View style={styles.friendActions}>
                        <TouchableOpacity onPress={() => handleMessageUser(f)} style={styles.friendActionBtn}>
                          <MessageCircle size={20} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleCallUser(f)} style={styles.friendActionBtn}>
                          <Phone size={20} color={theme.colors.success} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleMoreActions(f)} style={styles.friendActionBtn}>
                          <MoreVertical size={20} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>
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

        <Modal visible={showEmojiPicker} transparent animationType="fade">
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
        </Modal>

        <ShareManager ref={shareRef} />
  
          <Modal visible={showRequestsModal} animationType="fade" transparent={true} onRequestClose={() => setShowRequestsModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.colors.background, maxHeight: '80%' }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.colors.text, marginBottom: 0 }]}>Friend Requests</Text>
                  <TouchableOpacity onPress={() => setShowRequestsModal(false)}>
                    <XIcon color={theme.colors.text} size={24} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={{ marginTop: 20 }}>
                  {pendingRequests.length > 0 ? (
                    pendingRequests.map(r => (
                      <View key={r.requestId} style={[styles.requestItem, { borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: 12 }]}>
                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
                          onPress={() => {
                            setShowRequestsModal(false);
                            router.push(`/profile?userId=${r.id}`);
                          }}
                        >
                          {r.avatar_url ? (
                            <Image source={{ uri: r.avatar_url }} style={styles.resultAvatar} />
                          ) : (
                            <Text style={{ fontSize: 32 }}>{r.emoji_icon || "👤"}</Text>
                          )}
                          <View>
                            <Text style={[styles.requestName, { color: theme.colors.text }]}>@{r.username}</Text>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>wants to be friends</Text>
                          </View>
                        </TouchableOpacity>
                        <View style={styles.requestBtns}>
                          <TouchableOpacity 
                            onPress={async () => {
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              const { success } = await acceptFriendRequest(r.requestId, user.id, r.id, user.username);
                              if (success) loadData();
                            }} 
                            style={[styles.acceptBtn, { backgroundColor: theme.colors.success }]}
                          >
                            <Check color="#000" size={18} />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            onPress={async () => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              const { success } = await rejectFriendRequest(r.requestId);
                              if (success) loadData();
                            }} 
                            style={[styles.rejectBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, borderColor: '#ef4444' }]}
                          >
                            <XIcon color="#ef4444" size={18} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
                      <UserCheck size={48} color={theme.colors.textSecondary} opacity={0.2} />
                      <Text style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>No pending requests</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>

          <Modal visible={showNicknameModal} animationType="fade" transparent={true} onRequestClose={() => setShowNicknameModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: '#1E293B', padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={[styles.modalTitle, { color: '#FFF', textAlign: 'left' }]}>Set Nickname</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>This is how you will appear to others on the wall.</Text>
                <RNTextInput
                  style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 15, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 }}
                  placeholder="Enter nickname..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={nicknameText}
                  onChangeText={setNicknameText}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => setShowNicknameModal(false)} style={{ flex: 1, padding: 15, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }}>
                    <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleUpdateNickname} style={{ flex: 1, padding: 15, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: 'center' }}>
                    <Text style={{ color: '#000', fontWeight: 'bold' }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal visible={showReportModal} animationType="fade" transparent={true} onRequestClose={() => setShowReportModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: '#1E293B', padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={[styles.modalTitle, { color: '#FFF', textAlign: 'left' }]}>Report @{reportingUser?.username}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>Please provide a reason for reporting this user. Our moderation team will review it.</Text>
                <RNTextInput
                  style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 15, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20, minHeight: 100, textAlignVertical: 'top' }}
                  placeholder="Reason for reporting..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={reportReason}
                  onChangeText={setReportReason}
                  multiline
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => setShowReportModal(false)} style={{ flex: 1, padding: 15, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }}>
                    <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => submitReport(reportingUser, reportReason)} style={{ flex: 1, padding: 15, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center' }}>
                    <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Report</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
      </View>
    );
  }


const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
    headerIcon: { padding: 8, position: 'relative' },
    requestBadge: {
      position: 'absolute',
      right: 4,
      top: 4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    requestBadgeText: {
      color: '#000',
      fontSize: 10,
      fontWeight: 'bold',
    },
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
    resultsSection: { padding: 12, borderRadius: 15, marginBottom: 20 },
    resultsTitle: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
    resultItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
    resultInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    resultAvatar: { width: 44, height: 44, borderRadius: 22 },
    resultEmoji: { fontSize: 28, width: 44, textAlign: 'center' },
    resultUsername: { fontWeight: 'bold', fontSize: 15 },
    resultNickname: { fontSize: 13 },
    resultAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    resultAddText: { fontWeight: 'bold', fontSize: 13, color: '#000' },
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
      friendItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
      friendInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
      friendAvatar: { width: 44, height: 44, borderRadius: 22 },
      friendAvatarContainer: { position: 'relative' },
      friendOnlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#000' },
      friendName: { fontWeight: 'bold', fontSize: 15 },
      friendActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
      friendActionBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
    footer: { paddingVertical: 30, alignItems: 'center' },
    footerText: { fontSize: 12, fontWeight: '600' },
    actionRow: { flexDirection: 'row', paddingVertical: 10, alignItems: 'center', width: '100%', paddingHorizontal: 20 },
    messageBtn: { borderRadius: 25, overflow: 'hidden' },
    messageBtnGradient: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'center', 
      paddingVertical: 12,
      gap: 10 
    },
      messageBtnText: { fontWeight: 'bold', fontSize: 16, color: '#000' },
      actionBtn: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        paddingVertical: 12, 
        borderRadius: 25, 
        gap: 10,
        marginLeft: 10
      },
      actionBtnText: { fontWeight: 'bold', fontSize: 16 },
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
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15, marginBottom: 20 },
  emojiItem: { padding: 5 },
  emojiText: { fontSize: 32 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, borderRadius: 10, marginBottom: 10 },
  photoBtnText: { fontWeight: 'bold' },
  closeBtn: { padding: 15, alignItems: 'center' },
  closeBtnText: { color: '#ef4444', fontWeight: 'bold' },
});
