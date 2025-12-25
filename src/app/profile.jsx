import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/utils/supabase";
import { getStoredUser, logoutUser, initUser } from "@/utils/user";
import { getDeviceId } from "@/utils/deviceId";
import { 
  ChevronLeft, 
  Camera, 
  LogOut, 
  MessageSquare, 
  Clock, 
  Search,
  User as UserIcon,
  Shield,
  UserPlus,
  Users,
  Trash2,
  Heart,
  Share as ShareIcon,
  Edit2,
  Image as ImageIcon,
  Check,
  X as XIcon
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { decode } from "base64-arraybuffer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TextInput } from "react-native-gesture-handler";
import { Share } from "react-native";

import PostItem from "../components/PostItem";
import { LinearGradient } from "expo-linear-gradient";
import { ShareManager } from "../components/ShareManager";
import { BannerAd } from "@/components/BannerAd";

const { width } = Dimensions.get('window');
const EMOJIS = ["👤", "🐱", "🐶", "🦊", "🦁", "🐨", "🐸", "🐷", "🐵", "🦄", "🐲", "🤖", "👻", "👾", "👽", "💩"];

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ posts: 0, reactions: 0, joined: "" });
  const [replies, setReplies] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [friendUsername, setFriendUsername] = useState("");
  const [friends, setFriends] = useState([]);
  const [addingFriend, setAddingFriend] = useState(false);
  const [userPosts, setUserPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [friendsPosts, setFriendsPosts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("posts"); // posts, media, replies, saved, friends
  const [deviceId, setDeviceId] = useState(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const shareRef = useRef();

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      let userData = await getStoredUser();
      
      if (userData?.id) {
        const { data: freshUser, error } = await supabase
          .from('rusers')
          .select('*')
          .eq('id', userData.id)
          .single();
        
        if (freshUser && !error) {
          userData = freshUser;
          await AsyncStorage.setItem("@redditch_user_data", JSON.stringify(freshUser));
        }
      }

      if (!userData) {
        userData = await initUser();
      }
      
      setUser(userData);
      setBioText(userData?.bio || "");

      if (userData) {
        // Fetch stats
        const { count: postCount } = await supabase
          .from('rposts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userData.id);
        
        const { count: reactionCount } = await supabase
          .from('rreactions')
          .select('*, rposts!inner(user_id)', { count: 'exact', head: true })
          .eq('rposts.user_id', userData.id);
        
        setStats({ 
          posts: postCount || 0,
          reactions: reactionCount || 0,
          joined: new Date(userData.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        });

        // Fetch Saved Posts
        const { data: savedData } = await supabase
          .from('rsaved_posts')
          .select(`
            post:post_id (
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
              user:rusers!user_id (username, emoji_icon, avatar_url),
              zone:rzones!zone_id (name),
              tag:rtags!tag_id (name),
              reactions:rreactions (reaction_type, device_id)
            )
          `)
          .eq('user_id', userData.id);
        
        setSavedPosts(savedData?.map(s => s.post).filter(p => p && !p.is_deleted) || []);

        // Fetch Pending Requests
        const { data: requestsData } = await supabase
          .from('friends')
          .select('id, user_id, rusers!friends_user_id_fkey(id, username, emoji_icon, avatar_url)')
          .eq('friend_id', userData.id)
          .eq('status', 'pending');
        
        setPendingRequests(requestsData?.map(r => ({ ...r.rusers, requestId: r.id })) || []);

        // Fetch Friends
        const { data: friendData } = await supabase
          .from('friends')
          .select('friend_id, rusers!friends_friend_id_fkey(id, username, emoji_icon, avatar_url)')
          .eq('user_id', userData.id)
          .eq('status', 'accepted');
        
        const friendsList = friendData?.map(f => f.rusers) || [];
        setFriends(friendsList);
        const friendIds = friendsList.map(f => f.id);

        // Fetch user's own posts AND friends' posts
        const { data: feedPosts } = await supabase
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
            media_type,
            is_anonymous, 
            moderation_status,
            is_deleted,
            user:rusers!user_id (username, emoji_icon, avatar_url),
            zone:rzones!zone_id (name),
            tag:rtags!tag_id (name),
            reactions:rreactions (reaction_type, device_id)
          `)
          .in('user_id', [userData.id, ...friendIds])
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });
        
        setUserPosts(feedPosts || []);

        // Fetch replies to user's posts
        const { data: userPostIds } = await supabase
          .from('rposts')
          .select('id')
          .eq('user_id', userData.id);
        
        if (userPostIds && userPostIds.length > 0) {
          const postIds = userPostIds.map(p => p.id);
          const { data: replyData } = await supabase
            .from('rcomments')
            .select(`
              *,
              user:rusers!user_id (username, emoji_icon, avatar_url),
              post:rposts!post_id (title)
            `)
            .in('post_id', postIds)
            .neq('user_id', userData.id)
            .order('created_at', { ascending: false })
            .limit(10);
          
          setReplies(replyData || []);
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setLoading(true);
      try {
        const image = result.assets[0];
        const fileName = `${user.id}_avatar_${Date.now()}.jpg`;
        const base64 = await FileSystem.readAsStringAsync(image.uri, { encoding: "base64" });
        const arrayBuffer = decode(base64);

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

        const { error: updateError } = await supabase
          .from('rusers')
          .update({ avatar_url: publicUrl, emoji_icon: null })
          .eq('id', user.id);

        if (updateError) throw updateError;
        setShowEmojiPicker(false);
        loadData();
        } catch (error) {
          console.error("Avatar upload error:", error);
          Alert.alert("Error", `Failed to upload avatar: ${error.message || 'Unknown error'}`);
        }
    }
  };

  const handlePickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });

    if (!result.canceled) {
      setUploadingCover(true);
      try {
        const image = result.assets[0];
        const fileName = `${user.id}_cover_${Date.now()}.jpg`;
        const base64 = await FileSystem.readAsStringAsync(image.uri, { encoding: "base64" });
        const arrayBuffer = decode(base64);

        const { error: uploadError } = await supabase.storage
          .from('covers')
          .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

        if (uploadError) {
          // Attempt to create bucket if it doesn't exist (though SQL tool should have handled it if I added it)
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(fileName);

        const { error: updateError } = await supabase
          .from('rusers')
          .update({ cover_url: publicUrl })
          .eq('id', user.id);

        if (updateError) throw updateError;
        loadData();
        } catch (error) {
          console.error("Cover upload error:", error);
          Alert.alert("Error", `Failed to upload cover photo: ${error.message || 'Unknown error'}. Make sure 'covers' bucket exists.`);
        }
    }
  };

  const handleUpdateBio = async () => {
    if (bioText.length > 160) {
      Alert.alert("Error", "Bio too long (max 160 chars)");
      return;
    }
    setEditingBio(false);
    try {
      const { error } = await supabase
        .from('rusers')
        .update({ bio: bioText })
        .eq('id', user.id);
      if (error) throw error;
      loadData();
    } catch (error) {
      Alert.alert("Error", "Failed to update bio");
    }
  };

  const handleSelectEmoji = async (emoji) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { error } = await supabase
        .from('rusers')
        .update({ emoji_icon: emoji, avatar_url: null })
        .eq('id', user.id);
      if (error) throw error;
      setShowEmojiPicker(false);
      loadData();
    } catch (error) {
      Alert.alert("Error", "Failed to update icon");
    }
  };

  const handleAddFriend = async () => {
    if (!friendUsername.trim()) return;
    if (friendUsername.trim().toLowerCase() === user.username.toLowerCase()) {
      Alert.alert("Error", "You cannot add yourself.");
      return;
    }
    setAddingFriend(true);
    try {
      const { data: targetUser } = await supabase
        .from('rusers')
        .select('id, username')
        .ilike('username', friendUsername.trim())
        .single();
      
      if (!targetUser) {
        Alert.alert("Error", "User not found.");
        return;
      }

      const { data: existing } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${user.id})`)
        .single();
      
      if (existing) {
        Alert.alert("Notice", "Friendship already exists or is pending.");
        return;
      }

      const { error: addError } = await supabase
        .from('friends')
        .insert([{ user_id: user.id, friend_id: targetUser.id, status: 'pending' }]);
      
      if (addError) throw addError;
      Alert.alert("Success", "Friend request sent!");
      setFriendUsername("");
      loadData();
    } catch (error) {
      Alert.alert("Error", "Failed to send request.");
    } finally {
      setAddingFriend(false);
    }
  };

  const handleAcceptRequest = async (requestId, requesterId) => {
    try {
      await supabase.from('friends').update({ status: 'accepted' }).eq('id', requestId);
      await supabase.from('friends').insert({ user_id: user.id, friend_id: requesterId, status: 'accepted' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    } catch (error) {
      Alert.alert("Error", "Failed to accept request.");
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      await supabase.from('friends').delete().eq('id', requestId);
      loadData();
    } catch (error) {
      Alert.alert("Error", "Failed to decline request.");
    }
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
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeletePost = async (postId) => {
    Alert.alert("Delete Post", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive",
        onPress: async () => {
          await supabase.from('rposts').update({ is_deleted: true }).eq('id', postId);
          loadData();
        }
      }
    ]);
  };

  const handleEditPost = (post) => router.push(`/post?id=${post.id}`);
  const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await logoutUser(); router.replace("/"); } }
    ]);
  };

  const handleShare = async (post) => shareRef.current?.share(post);

  const renderMediaGrid = () => {
    const mediaPosts = userPosts.filter(p => p.image_url || p.image_urls?.length > 0);
    return (
      <View style={styles.mediaGrid}>
        {mediaPosts.length > 0 ? (
          mediaPosts.map((post) => (
            <TouchableOpacity 
              key={post.id} 
              style={styles.mediaItem}
              onPress={() => router.push(`/?postId=${post.id}`)}
            >
              <Image source={{ uri: post.image_url || post.image_urls?.[0] }} style={styles.mediaThumb} />
              {post.media_type === 'video' && (
                <View style={styles.mediaTypeBadge}>
                  <Camera size={12} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <ImageIcon size={40} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyText}>No media shared yet.</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading && !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0F172A', '#000', '#000']} style={StyleSheet.absoluteFill} />
      
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[2]}>
        {/* Cover Photo */}
        <View style={styles.coverContainer}>
          {user?.cover_url ? (
            <Image source={{ uri: user.cover_url }} style={styles.coverImage} />
          ) : (
            <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.coverPlaceholder} />
          )}
          <TouchableOpacity style={styles.editCoverButton} onPress={handlePickCover}>
            <Camera size={16} color="#000" />
          </TouchableOpacity>
          {uploadingCover && <ActivityIndicator style={styles.coverLoader} color="#FFF" />}
          
          <TouchableOpacity onPress={() => router.back()} style={[styles.headerIcon, { left: 20, top: insets.top + 10 }]}>
            <ChevronLeft color="#FFF" size={24} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={[styles.headerIcon, { right: 20, top: insets.top + 10 }]}>
            <LogOut color="#EF4444" size={20} />
          </TouchableOpacity>
        </View>

        {/* Profile Info Overlay */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity style={styles.mainAvatarContainer} onPress={() => setShowEmojiPicker(true)}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.mainAvatar} />
              ) : (
                <Text style={styles.mainEmojiAvatar}>{user?.emoji_icon || "👤"}</Text>
              )}
              <View style={styles.avatarEditBadge}>
                <Camera size={12} color="#000" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.nameSection}>
            <Text style={styles.mainUsername}>@{user?.username}</Text>
            <View style={styles.badgeRow}>
              <Text style={styles.userStatusBadge}>{user?.supabase_uid ? "PRO" : "GUEST"}</Text>
              {user?.is_admin && (
                <TouchableOpacity onPress={() => router.push("/admin")} style={styles.adminBadge}>
                  <Shield size={10} color="#000" />
                  <Text style={styles.adminBadgeText}>MOD</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {editingBio ? (
            <View style={styles.bioEditContainer}>
              <TextInput
                style={styles.bioInput}
                value={bioText}
                onChangeText={setBioText}
                placeholder="Write a bio..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                maxLength={160}
                autoFocus
              />
              <View style={styles.bioEditActions}>
                <TouchableOpacity onPress={() => setEditingBio(false)} style={styles.bioActionBtn}>
                  <XIcon size={16} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleUpdateBio} style={[styles.bioActionBtn, { backgroundColor: '#FFF' }]}>
                  <Check size={16} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.bioContainer} onPress={() => setEditingBio(true)}>
              <Text style={styles.bioText} numberOfLines={3}>
                {user?.bio || "Tap to add a bio..."}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.mainStatsRow}>
            <View style={styles.mainStatBox}>
              <Text style={styles.mainStatVal}>{stats.posts}</Text>
              <Text style={styles.mainStatLab}>POSTS</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.mainStatBox}>
              <Text style={styles.mainStatVal}>{friends.length}</Text>
              <Text style={styles.mainStatLab}>FRIENDS</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.mainStatBox}>
              <Text style={styles.mainStatVal}>{stats.reactions}</Text>
              <Text style={styles.mainStatLab}>KARMA</Text>
            </View>
          </View>
        </View>

        {/* Sticky Tabs */}
        <View style={styles.stickyTabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            {[
              { id: 'posts', label: 'Feed' },
              { id: 'media', label: 'Media' },
              { id: 'replies', label: 'Replies' },
              { id: 'saved', label: 'Saved' },
              { id: 'friends', label: 'Friends' }
            ].map(tab => (
              <TouchableOpacity 
                key={tab.id}
                style={[styles.tabItem, activeTab === tab.id && styles.activeTabItem]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabLabel, activeTab === tab.id && styles.activeTabLabel]}>{tab.label.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

          {/* Tab Content */}
          <View style={styles.contentArea}>
            {activeTab === 'posts' && (
              userPosts.length > 0 ? (
                userPosts.map((post, index) => (
                  <View key={post.id}>
                    <PostItem 
                      item={post} 
                      deviceId={deviceId} 
                      onReaction={handleReaction} 
                      onDelete={handleDeletePost} 
                      onShare={handleShare} 
                      onEdit={handleEditPost} 
                      user={user} 
                      onComment={loadData} 
                    />
                    {(index + 1) % 5 === 0 && (
                      <View style={{ marginBottom: 10 }}>
                        <NativeAd />
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <MessageSquare size={40} color="rgba(255,255,255,0.1)" />
                  <Text style={styles.emptyText}>No posts yet.</Text>
                </View>
              )
            )}


          {activeTab === 'media' && renderMediaGrid()}

          {activeTab === 'replies' && (
            <View style={{ paddingHorizontal: 20 }}>
              {replies.length > 0 ? (
                replies.map(reply => (
                  <View key={reply.id} style={styles.replyCard}>
                    <View style={styles.replyHeader}>
                      <Text style={styles.replyUser}>{reply.user?.emoji_icon} @{reply.user?.username}</Text>
                      <Text style={styles.replyTime}>{getTimeAgo(new Date(reply.created_at))}</Text>
                    </View>
                    <Text style={styles.replyText}>{reply.text}</Text>
                    <TouchableOpacity onPress={() => router.push(`/?postId=${reply.post_id}`)}>
                      <Text style={styles.replyTarget}>on "{reply.post?.title}"</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <MessageSquare size={40} color="rgba(255,255,255,0.1)" />
                  <Text style={styles.emptyText}>No replies yet.</Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'saved' && (
            savedPosts.length > 0 ? (
              savedPosts.map(post => (
                <PostItem key={post.id} item={post} deviceId={deviceId} onReaction={handleReaction} onDelete={handleDeletePost} onShare={handleShare} onEdit={handleEditPost} user={user} onComment={loadData} />
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Heart size={40} color="rgba(255,255,255,0.1)" />
                <Text style={styles.emptyText}>Nothing saved.</Text>
              </View>
            )
          )}

          {activeTab === 'friends' && (
            <View style={{ paddingHorizontal: 20 }}>
              <View style={styles.friendSearchRow}>
                <View style={styles.fInputWrap}>
                  <Search size={16} color="rgba(255,255,255,0.4)" />
                  <TextInput
                    style={styles.fInput}
                    placeholder="Find friends..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={friendUsername}
                    onChangeText={setFriendUsername}
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity style={[styles.fAddBtn, !friendUsername && { opacity: 0.5 }]} onPress={handleAddFriend} disabled={!friendUsername || addingFriend}>
                  {addingFriend ? <ActivityIndicator size="small" color="#000" /> : <UserPlus size={18} color="#000" />}
                </TouchableOpacity>
              </View>

              {pendingRequests.length > 0 && (
                <View style={styles.fSection}>
                  <Text style={styles.fSectionTitle}>PENDING</Text>
                  {pendingRequests.map(req => (
                    <View key={req.requestId} style={styles.fItem}>
                      <View style={styles.fInfo}>
                        <View style={styles.fAvatar}>{req.avatar_url ? <Image source={{ uri: req.avatar_url }} style={styles.fImg} /> : <Text style={styles.fEmoji}>{req.emoji_icon || "👤"}</Text>}</View>
                        <Text style={styles.fName}>@{req.username}</Text>
                      </View>
                      <View style={styles.fActions}>
                        <TouchableOpacity style={styles.fAcceptBtn} onPress={() => handleAcceptRequest(req.requestId, req.id)}><Text style={styles.fAcceptText}>ACCEPT</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeclineRequest(req.requestId)}><Trash2 size={16} color="#EF4444" /></TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.fSection}>
                <Text style={styles.fSectionTitle}>MY FRIENDS ({friends.length})</Text>
                {friends.length > 0 ? (
                  friends.map(f => (
                    <View key={f.id} style={styles.fItem}>
                      <View style={styles.fInfo}>
                        <View style={styles.fAvatar}>{f.avatar_url ? <Image source={{ uri: f.avatar_url }} style={styles.fImg} /> : <Text style={styles.fEmoji}>{f.emoji_icon || "👤"}</Text>}</View>
                        <Text style={styles.fName}>@{f.username}</Text>
                      </View>
                      <Users size={16} color="rgba(255,255,255,0.2)" />
                    </View>
                  ))
                ) : (
                  <Text style={styles.fEmpty}>No friends yet.</Text>
                )}
              </View>
            </View>
          )}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      <ShareManager ref={shareRef} />

      {showEmojiPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Avatar</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => handleSelectEmoji(emoji)} style={styles.emojiBtn}>
                  <Text style={styles.emojiTxt}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.uploadBtn} onPress={handlePickAvatar}>
              <Camera size={18} color="#000" />
              <Text style={styles.uploadBtnText}>UPLOAD PHOTO</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowEmojiPicker(false)}>
              <Text style={styles.modalCloseText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "NOW";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}M`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}H`;
  return `${Math.floor(seconds / 86400)}D`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  loadingContainer: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  
  // Cover Section
  coverContainer: { height: 180, width: '100%', position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%' },
  editCoverButton: { position: 'absolute', right: 15, bottom: 15, backgroundColor: '#FFF', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 },
  coverLoader: { position: 'absolute', right: 55, bottom: 20 },
  headerIcon: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.5)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  // Profile Header
  profileHeader: { paddingHorizontal: 20, marginTop: -50, marginBottom: 20 },
  avatarWrapper: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#000', backgroundColor: '#000', overflow: 'hidden' },
  mainAvatarContainer: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E293B' },
  mainAvatar: { width: '100%', height: '100%' },
  mainEmojiAvatar: { fontSize: 50 },
  avatarEditBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: '#FFF', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  nameSection: { marginTop: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mainUsername: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  badgeRow: { flexDirection: 'row', gap: 8 },
  userStatusBadge: { color: '#3B82F6', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FBBF24', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4 },
  adminBadgeText: { color: '#000', fontSize: 9, fontWeight: '900' },

  bioContainer: { marginTop: 12, paddingVertical: 4 },
  bioText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 20 },
  bioEditContainer: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 },
  bioInput: { color: '#FFF', fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
  bioEditActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  bioActionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },

  mainStatsRow: { flexDirection: 'row', marginTop: 20, paddingVertical: 15, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  mainStatBox: { flex: 1, alignItems: 'center' },
  mainStatVal: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  mainStatLab: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', marginTop: 2 },
  divider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' },

  // Tabs
  stickyTabContainer: { backgroundColor: '#000', paddingVertical: 10, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  tabsScroll: { paddingHorizontal: 20, gap: 15 },
  tabItem: { paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTabItem: { borderBottomColor: '#FFF' },
  tabLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '900' },
  activeTabLabel: { color: '#FFF' },

  // Media Grid
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 2 },
  mediaItem: { width: width / 3 - 4, height: width / 3 - 4, margin: 2, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1E293B' },
  mediaThumb: { width: '100%', height: '100%' },
  mediaTypeBadge: { position: 'absolute', right: 5, top: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 4 },

  // Replies
  replyCard: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 15, padding: 15, marginBottom: 12 },
  replyHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  replyUser: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  replyTime: { color: "rgba(255,255,255,0.3)", fontSize: 10 },
  replyText: { color: "rgba(255,255,255,0.8)", fontSize: 14, lineHeight: 18 },
  replyTarget: { color: "#3B82F6", fontSize: 11, marginTop: 10, fontWeight: "600" },

  // Friends
  friendSearchRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  fInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12, gap: 10 },
  fInput: { flex: 1, height: 44, color: '#FFF', fontSize: 14 },
  fAddBtn: { width: 44, height: 44, backgroundColor: '#FFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  fSection: { marginBottom: 20 },
  fSectionTitle: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  fItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 12, marginBottom: 8 },
  fInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  fImg: { width: '100%', height: '100%' },
  fEmoji: { fontSize: 18 },
  fName: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  fActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fAcceptBtn: { backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  fAcceptText: { color: '#000', fontSize: 10, fontWeight: '900' },
  fEmpty: { color: 'rgba(255,255,255,0.2)', fontSize: 12, fontStyle: 'italic' },

  // Common
  emptyContainer: { alignItems: "center", paddingVertical: 60, gap: 15 },
  emptyText: { color: "rgba(255,255,255,0.2)", fontSize: 14 },

  // Modal
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "#0F172A", width: "85%", borderRadius: 25, padding: 25, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  modalTitle: { color: "#FFF", fontSize: 20, fontWeight: "900", marginBottom: 20 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 15, marginBottom: 25 },
  emojiBtn: { width: 55, height: 55, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12 },
  emojiTxt: { fontSize: 28 },
  uploadBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", paddingVertical: 14, paddingHorizontal: 25, borderRadius: 12, gap: 12, marginBottom: 15, width: "100%", justifyContent: "center" },
  uploadBtnText: { color: "#000", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  modalClose: { padding: 10 },
  modalCloseText: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "800" },
});
