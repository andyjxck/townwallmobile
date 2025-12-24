import { useState, useEffect } from "react";
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
  Share as ShareIcon
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { decode } from "base64-arraybuffer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TextInput } from "react-native-gesture-handler";
import { Share } from "react-native";

import PostItem from "../components/PostItem";
import { LinearGradient } from "expo-linear-gradient";

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ posts: 0 });
  const [replies, setReplies] = useState([]);
  const [lostFound, setLostFound] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [friendUsername, setFriendUsername] = useState("");
  const [friends, setFriends] = useState([]);
  const [personalFeed, setPersonalFeed] = useState([]);
  const [addingFriend, setAddingFriend] = useState(false);
  const [userPosts, setUserPosts] = useState([]);
  const [friendsPosts, setFriendsPosts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("posts"); // posts, friends, replies
  const [deviceId, setDeviceId] = useState(null);

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

          // Fetch Pending Requests (where current user is the friend_id)
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
              *,
              rusers (username, emoji_icon, avatar_url),
              rzones (name),
              rtags (name),
              rreactions (reaction_type, device_id)
            `)
            .in('user_id', [userData.id, ...friendIds])
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });
          
          setUserPosts(feedPosts || []);

          // Fetch Friends Only posts for the dedicated feed
          if (friendIds.length > 0) {
            const { data: frPosts } = await supabase
              .from('rposts')
              .select(`
                *,
                rusers (username, emoji_icon, avatar_url),
                rzones (name),
                rtags (name),
                rreactions (reaction_type, device_id)
              `)
              .in('user_id', friendIds)
              .eq('is_deleted', false)
              .order('created_at', { ascending: false });
            
            setFriendsPosts(frPosts || []);
          } else {
            setFriendsPosts([]);
          }

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
              rusers (username, emoji_icon, avatar_url),
              rposts (title)
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

    const handlePickImage = async () => {
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
          
          // Read the file as base64 and decode to ArrayBuffer for Supabase Storage
          const base64 = await FileSystem.readAsStringAsync(image.uri, {
            encoding: "base64",
          });
          const arrayBuffer = decode(base64);

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, arrayBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        const { error: updateError } = await supabase
          .from('rusers')
          .update({ avatar_url: publicUrl, emoji_icon: null })
          .eq('id', user.id);

        if (updateError) throw updateError;

        await initUser(); // Refresh local storage
        loadData();
      } catch (error) {
        Alert.alert("Error", "Failed to upload image. Make sure 'avatars' bucket exists.");
        console.error(error);
      } finally {
        setLoading(false);
      }
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
      await initUser(); // Refresh local storage
      loadData();
    } catch (error) {
      Alert.alert("Error", "Failed to update icon");
    }
  };

  const handleAddFriend = async () => {
    if (!friendUsername.trim()) return;
    if (friendUsername.trim() === user.username) {
      Alert.alert("Error", "You cannot add yourself as a friend.");
      return;
    }

    setAddingFriend(true);
    try {
      // Find user by username
      const { data: targetUser, error: findError } = await supabase
        .from('rusers')
        .select('id, username')
        .ilike('username', friendUsername.trim())
        .single();
      
      if (findError || !targetUser) {
        Alert.alert("Error", "User not found.");
        return;
      }

      // Check if already friends
      const { data: existing } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', user.id)
        .eq('friend_id', targetUser.id)
        .single();
      
      if (existing) {
        Alert.alert("Notice", "You are already friends with this user.");
        return;
      }

      // Send friend request
      const { error: addError } = await supabase
        .from('friends')
        .insert([
          { user_id: user.id, friend_id: targetUser.id, status: 'pending' }
        ]);
      
      if (addError) throw addError;

      Alert.alert("Success", `Friend request sent to @${targetUser.username}!`);
      setFriendUsername("");
      loadData();
    } catch (error) {
      console.error("Error adding friend:", error);
      Alert.alert("Error", "Failed to send request.");
    } finally {
      setAddingFriend(false);
    }
  };

  const handleAcceptRequest = async (requestId, requesterId) => {
    try {
      // Update existing request to accepted
      const { error: updateError } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', requestId);
      
      if (updateError) throw updateError;

      // Add reciprocal relationship
      const { error: reciprocalError } = await supabase
        .from('friends')
        .insert({
          user_id: user.id,
          friend_id: requesterId,
          status: 'accepted'
        });
      
      if (reciprocalError) {
        // If reciprocal fails (e.g. already exists), we just continue
        console.warn("Reciprocal friend entry error:", reciprocalError);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    } catch (error) {
      console.error("Error accepting request:", error);
      Alert.alert("Error", "Failed to accept request.");
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', requestId);
      
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error("Error declining request:", error);
      Alert.alert("Error", "Failed to decline request.");
    }
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
      loadData();
    } catch (error) {
      console.error("Error updating reaction:", error);
    }
  };

  const handleDeletePost = async (postId) => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post?",
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
              loadData();
            } catch (error) {
              console.error("Error deleting post:", error);
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

    const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Sign Out", 
        style: "destructive", 
        onPress: async () => {
          await logoutUser();
          router.replace("/");
        } 
      }
    ]);
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

  if (loading && !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#000000', '#000000']}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ paddingTop: insets.top, flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft color="#FFFFFF" size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PROFILE</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <LogOut color="#EF4444" size={22} />
          </TouchableOpacity>
        </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.profileSection}>
              <TouchableOpacity 
                style={styles.avatarContainer} 
                onPress={() => setShowEmojiPicker(true)}
              >
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
                ) : (
                  <Text style={styles.emojiAvatar}>{user?.emoji_icon || "👤"}</Text>
                )}
                <View style={styles.editBadge}>
                  <Camera size={12} color="#000000" />
                </View>
              </TouchableOpacity>

              <Text style={styles.username}>@{user?.username}</Text>
              
              <View style={styles.userInfoRow}>
                <Text style={styles.userStatus}>
                  {user?.supabase_uid ? "Authenticated" : "Guest"}
                </Text>
                <View style={styles.statusDot} />
                <Text style={styles.joinedText}>Joined {stats.joined || '...'}</Text>
              </View>

              {user?.is_admin && (
                <TouchableOpacity 
                  style={[styles.authButton, { backgroundColor: '#FBBF24' }]} 
                  onPress={() => router.push("/admin")}
                >
                  <Shield size={14} color="#000000" />
                  <Text style={[styles.authButtonText, { color: '#000000' }]}>MODERATION PANEL</Text>
                </TouchableOpacity>
              )}

              {!user?.supabase_uid && !user?.is_admin && (
                <TouchableOpacity 
                  style={styles.authButton} 
                  onPress={() => router.push("/auth")}
                >
                    <Text style={styles.authButtonText}>CLAIM ACCOUNT</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.posts}</Text>
                <Text style={styles.statLabel}>POSTS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.reactions}</Text>
                <Text style={styles.statLabel}>REACTIONS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{friends.length}</Text>
                <Text style={styles.statLabel}>FRIENDS</Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
              {[
                { id: 'posts', label: 'FEED' },
                { id: 'replies', label: 'MY REPLIES' },
                { id: 'friends', label: 'FRIENDS' }
              ].map(tab => (
                <TouchableOpacity 
                  key={tab.id}
                  style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {activeTab === "posts" && (
              <View style={styles.tabContentFull}>
                {userPosts.length > 0 ? (
                    userPosts.map((post) => (
                      <PostItem 
                        key={post.id}
                        item={post}
                        deviceId={deviceId}
                        onReaction={handleReaction}
                        onDelete={handleDeletePost}
                        onShare={handleShare}
                        onEdit={handleEditPost}
                        user={user}
                        onComment={() => loadData()}
                      />
                    ))
                ) : (
                  <View style={styles.emptyContainer}>
                    <MessageSquare size={40} color="rgba(255,255,255,0.1)" />
                    <Text style={styles.emptyText}>No posts in your feed yet.</Text>
                  </View>
                )}
              </View>
            )}

            {activeTab === "replies" && (
              <View style={styles.tabContent}>
                {replies.length > 0 ? (
                  replies.map((reply) => (
                    <View key={reply.id} style={styles.replyCard}>
                      <View style={styles.replyHeader}>
                        <Text style={styles.replyUser}>
                          {reply.rusers?.emoji_icon} @{reply.rusers?.username}
                        </Text>
                        <Text style={styles.replyTime}>{getTimeAgo(new Date(reply.created_at))}</Text>
                      </View>
                      <Text style={styles.replyText}>{reply.text}</Text>
                      <TouchableOpacity onPress={() => router.push(`/?postId=${reply.post_id}`)}>
                        <Text style={styles.replyTarget}>on "{reply.rposts?.title}"</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyContainer}>
                    <MessageSquare size={40} color="rgba(255,255,255,0.1)" />
                    <Text style={styles.emptyText}>No replies to your posts yet.</Text>
                  </View>
                )}
              </View>
            )}

            {activeTab === "friends" && (
              <View style={styles.tabContent}>
                <View style={styles.addFriendContainer}>
                  <View style={styles.searchInputWrapper}>
                    <Search size={16} color="rgba(255,255,255,0.4)" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Add friend by username..."
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={friendUsername}
                      onChangeText={setFriendUsername}
                      autoCapitalize="none"
                    />
                  </View>
                  <TouchableOpacity 
                    style={[styles.addButton, !friendUsername && { opacity: 0.5 }]} 
                    onPress={handleAddFriend}
                    disabled={!friendUsername || addingFriend}
                  >
                    {addingFriend ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : (
                      <UserPlus size={18} color="#000000" />
                    )}
                  </TouchableOpacity>
                </View>

                {pendingRequests.length > 0 && (
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>PENDING REQUESTS</Text>
                    {pendingRequests.map((request) => (
                      <View key={request.requestId} style={styles.friendItem}>
                        <View style={styles.friendInfo}>
                          <View style={styles.friendAvatar}>
                            {request.avatar_url ? (
                              <Image source={{ uri: request.avatar_url }} style={styles.friendImage} />
                            ) : (
                              <Text style={styles.friendEmoji}>{request.emoji_icon || "👤"}</Text>
                            )}
                          </View>
                          <Text style={styles.friendName}>@{request.username}</Text>
                        </View>
                        <View style={styles.requestActions}>
                          <TouchableOpacity 
                            style={styles.acceptButton}
                            onPress={() => handleAcceptRequest(request.requestId, request.id)}
                          >
                            <Text style={styles.acceptButtonText}>ACCEPT</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.declineButton}
                            onPress={() => handleDeclineRequest(request.requestId)}
                          >
                            <Trash2 size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>MY FRIENDS</Text>
                  {friends.length > 0 ? (
                    friends.map((friend) => (
                      <View key={friend.id} style={styles.friendItem}>
                        <View style={styles.friendInfo}>
                          <View style={styles.friendAvatar}>
                            {friend.avatar_url ? (
                              <Image source={{ uri: friend.avatar_url }} style={styles.friendImage} />
                            ) : (
                              <Text style={styles.friendEmoji}>{friend.emoji_icon || "👤"}</Text>
                            )}
                          </View>
                          <Text style={styles.friendName}>@{friend.username}</Text>
                        </View>
                        <TouchableOpacity style={styles.friendAction}>
                          <Users size={18} color="rgba(255,255,255,0.3)" />
                        </TouchableOpacity>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Users size={40} color="rgba(255,255,255,0.1)" />
                      <Text style={styles.emptyText}>Add friends to see them here!</Text>
                    </View>
                  )}
                </View>

                {friendsPosts.length > 0 && (
                  <View style={[styles.sectionContainer, { marginTop: 20 }]}>
                    <Text style={styles.sectionTitle}>FRIENDS FEED</Text>
                    <View style={{ marginHorizontal: -20 }}>
                      {friendsPosts.map((post) => (
                        <PostItem 
                          key={post.id}
                          item={post}
                          deviceId={deviceId}
                          onReaction={handleReaction}
                          onDelete={handleDeletePost}
                          onShare={handleShare}
                          user={user}
                          onComment={() => loadData()}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}



          <View style={{ height: 100 }} />
        </ScrollView>
      </View>

      {showEmojiPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Avatar</Text>
            <View style={styles.emojiGrid}>
                {EMOJIS.map((emoji) => (
                  <TouchableOpacity 
                    key={emoji} 
                    onPress={() => handleSelectEmoji(emoji)}
                    style={styles.emojiButton}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}

            </View>
            <TouchableOpacity style={styles.uploadButton} onPress={handlePickImage}>
              <Camera size={18} color="#000000" />
              <Text style={styles.uploadButtonText}>UPLOAD PHOTO</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.closeModal} 
              onPress={() => setShowEmojiPicker(false)}
            >
              <Text style={styles.closeModalText}>CANCEL</Text>
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
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
  },
  backButton: {
    padding: 5,
  },
  logoutButton: {
    padding: 5,
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 30,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  emojiAvatar: {
    fontSize: 55,
  },
  editBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "#FFFFFF",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  username: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  joinedText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    fontWeight: "600",
  },
  userStatus: {
    color: "#3B82F6",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  authButton: {
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  authButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  statsRow: {
    flexDirection: "row",
    paddingVertical: 20,
    marginBottom: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  statLabel: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 9,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: 1.5,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  tabText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  activeTabText: {
    color: "#FFFFFF",
  },
    tabContent: {
      paddingHorizontal: 20,
    },
    tabContentFull: {
      paddingHorizontal: 0,
    },
  replyCard: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  replyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  replyUser: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  replyTime: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
  },
  replyText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    lineHeight: 18,
  },
  replyTarget: {
    color: "#3B82F6",
    fontSize: 11,
    marginTop: 10,
    fontWeight: "600",
  },
  addFriendContainer: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 10,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 15,
    paddingHorizontal: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: "#FFFFFF",
    fontSize: 13,
  },
  addButton: {
    width: 40,
    height: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 12,
    borderRadius: 15,
    marginBottom: 8,
  },
  friendInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  friendImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  friendEmoji: {
    fontSize: 18,
  },
  friendName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
    friendAction: {
      padding: 8,
    },
    sectionContainer: {
      marginBottom: 20,
    },
    sectionTitle: {
      color: "rgba(255,255,255,0.2)",
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.5,
      marginBottom: 12,
    },
    requestActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    acceptButton: {
      backgroundColor: "#FFFFFF",
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    acceptButtonText: {
      color: "#000000",
      fontSize: 10,
      fontWeight: "900",
    },
    declineButton: {
      padding: 6,
    },
    emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 15,
  },
  emptyText: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 13,
    textAlign: "center",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: "#0F172A",
    width: "85%",
    borderRadius: 30,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 25,
    letterSpacing: 1,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 20,
    marginBottom: 30,
  },
  emojiButton: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 15,
  },
  emojiText: {
    fontSize: 32,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 25,
    borderRadius: 15,
    gap: 12,
    marginBottom: 20,
    width: "100%",
    justifyContent: "center",
  },
  uploadButtonText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  closeModal: {
    padding: 10,
  },
  closeModalText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
