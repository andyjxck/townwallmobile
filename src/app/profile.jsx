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
  Users
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { decode } from "base64-arraybuffer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TextInput } from "react-native-gesture-handler";

const EMOJIS = ["👤", "🦊", "🐯", "🐼", "🦁", "🐨", "🐸", "🤖", "👻", "👽"];

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
  const [activeTab, setActiveTab] = useState("personal"); // personal, replies, lostfound

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      let userData = await getStoredUser();
      
      // Always fetch latest from DB to ensure is_admin is up to date
      if (userData?.id) {
        const { data: freshUser, error } = await supabase
          .from('rusers')
          .select('*')
          .eq('id', userData.id)
          .single();
        
        if (freshUser && !error) {
          userData = freshUser;
          // Update storage
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
        
        setStats({ posts: postCount || 0 });

        // Fetch Friends
        const { data: friendData } = await supabase
          .from('friends')
          .select('friend_id, rusers!friends_friend_id_fkey(id, username, emoji_icon, avatar_url)')
          .eq('user_id', userData.id)
          .eq('status', 'accepted');
        
        const friendsList = friendData?.map(f => f.rusers) || [];
        setFriends(friendsList);

        // Fetch Personal Feed (Self + Friends)
        const userIds = [userData.id, ...friendsList.map(f => f.id)];
        
        const { data: feedPosts } = await supabase
          .from('rposts')
          .select(`
            *,
            rusers (username, emoji_icon, avatar_url),
            rzones (name),
            rtags (name)
          `)
          .in('user_id', userIds)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(20);
        
        // Also fetch replies for these users to include in the personal feed
        const { data: feedReplies } = await supabase
          .from('rcomments')
          .select(`
            *,
            rusers (username, emoji_icon, avatar_url),
            rposts (title, id)
          `)
          .in('user_id', userIds)
          .order('created_at', { ascending: false })
          .limit(20);

        // Combine and sort
        const combined = [
          ...(feedPosts || []).map(p => ({ ...p, type: 'post' })),
          ...(feedReplies || []).map(r => ({ ...r, type: 'reply' }))
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        setPersonalFeed(combined);

        // Fetch replies to user's posts
        const { data: userPosts } = await supabase
          .from('rposts')
          .select('id')
          .eq('user_id', userData.id);
        
        if (userPosts && userPosts.length > 0) {
          const postIds = userPosts.map(p => p.id);
          const { data: replyData } = await supabase
            .from('rcomments')
            .select(`
              *,
              rusers (username, emoji_icon, avatar_url),
              rposts (title)
            `)
            .in('post_id', postIds)
            .neq('user_id', userData.id) // Don't show own comments as replies
            .order('created_at', { ascending: false })
            .limit(5);
          
          setReplies(replyData || []);
        }

        // Fetch active lost & found posts
        const { data: lfData } = await supabase
          .from('rposts')
          .select('*')
          .eq('user_id', userData.id)
          .eq('tag_id', 3) // Lost & Found
          .order('created_at', { ascending: false });
        
        setLostFound(lfData || []);
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

      // Add friend
      const { error: addError } = await supabase
        .from('friends')
        .insert([
          { user_id: user.id, friend_id: targetUser.id, status: 'accepted' },
          { user_id: targetUser.id, friend_id: user.id, status: 'accepted' } // Reciprocal for simplicity
        ]);
      
      if (addError) throw addError;

      Alert.alert("Success", `Added @${targetUser.username} as a friend!`);
      setFriendUsername("");
      loadData();
    } catch (error) {
      console.error("Error adding friend:", error);
      Alert.alert("Error", "Failed to add friend.");
    } finally {
      setAddingFriend(false);
    }
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
            <Text style={styles.userStatus}>
              {user?.supabase_uid ? "Authenticated Account" : "Anonymous User"}
            </Text>

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
                  <Text style={styles.authButtonText}>SIGN IN / CLAIM ACCOUNT</Text>
              </TouchableOpacity>
            )}
          </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.posts}</Text>
                <Text style={styles.statLabel}>POSTS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{friends.length}</Text>
                <Text style={styles.statLabel}>FRIENDS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{replies.length}</Text>
                <Text style={styles.statLabel}>REPLIES</Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tab, activeTab === "personal" && styles.activeTab]}
                onPress={() => setActiveTab("personal")}
              >
                <Text style={[styles.tabText, activeTab === "personal" && styles.activeTabText]}>PERSONAL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, activeTab === "replies" && styles.activeTab]}
                onPress={() => setActiveTab("replies")}
              >
                <Text style={[styles.tabText, activeTab === "replies" && styles.activeTabText]}>REPLIES</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, activeTab === "lostfound" && styles.activeTab]}
                onPress={() => setActiveTab("lostfound")}
              >
                <Text style={[styles.tabText, activeTab === "lostfound" && styles.activeTabText]}>MY L&F</Text>
              </TouchableOpacity>
            </View>

            {activeTab === "personal" && (
              <View style={styles.personalSection}>
                {/* Add Friend Row */}
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

                {/* Friends "Stories" Row */}
                {friends.length > 0 && (
                  <View style={styles.storiesContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
                      <TouchableOpacity style={styles.storyItem}>
                        <View style={[styles.storyAvatar, styles.myStory]}>
                          <Text style={styles.storyEmoji}>{user?.emoji_icon || "👤"}</Text>
                        </View>
                        <Text style={styles.storyName}>You</Text>
                      </TouchableOpacity>
                      {friends.map((friend) => (
                        <TouchableOpacity key={friend.id} style={styles.storyItem}>
                          <View style={styles.storyAvatar}>
                            {friend.avatar_url ? (
                              <Image source={{ uri: friend.avatar_url }} style={styles.storyImage} />
                            ) : (
                              <Text style={styles.storyEmoji}>{friend.emoji_icon || "👤"}</Text>
                            )}
                          </View>
                          <Text style={styles.storyName}>{friend.username}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Personal Feed */}
                <View style={styles.feedList}>
                  {personalFeed.length > 0 ? (
                    personalFeed.map((item, index) => (
                      <TouchableOpacity 
                        key={`${item.type}-${item.id}`} 
                        style={styles.feedItem}
                        onPress={() => item.type === 'post' ? router.push(`/?postId=${item.id}`) : router.push(`/?postId=${item.post_id}`)}
                      >
                        <View style={styles.feedItemHeader}>
                          <View style={styles.feedUser}>
                            {item.rusers?.avatar_url ? (
                              <Image source={{ uri: item.rusers.avatar_url }} style={styles.feedAvatar} />
                            ) : (
                              <Text style={styles.feedEmoji}>{item.rusers?.emoji_icon || "👤"}</Text>
                            )}
                            <View>
                              <Text style={styles.feedUsername}>@{item.rusers?.username}</Text>
                              <Text style={styles.feedMeta}>
                                {item.type === 'post' ? 'Posted' : 'Replied'} · {getTimeAgo(new Date(item.created_at))}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Text style={styles.feedText} numberOfLines={3}>{item.text}</Text>
                        {item.type === 'reply' && (
                          <View style={styles.replyContext}>
                            <Text style={styles.replyContextText}>on "{item.rposts?.title}"</Text>
                          </View>
                        )}
                        {item.image_url && (
                          <Image source={{ uri: item.image_url }} style={styles.feedImage} />
                        )}
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyFeed}>
                      <Users size={40} color="rgba(255,255,255,0.1)" />
                      <Text style={styles.emptyText}>Add friends to see their posts and replies here!</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {activeTab === "replies" && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MessageSquare size={18} color="#FFFFFF" />
                  <Text style={styles.sectionTitle}>RECENT REPLIES TO YOU</Text>
                </View>
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
                      <Text style={styles.replyTarget}>on "{reply.rposts?.title}"</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No replies yet.</Text>
                )}
              </View>
            )}

            {activeTab === "lostfound" && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Search size={18} color="#FFFFFF" />
                  <Text style={styles.sectionTitle}>MY LOST & FOUND</Text>
                </View>
                {lostFound.length > 0 ? (
                  lostFound.map((post) => (
                    <TouchableOpacity 
                      key={post.id} 
                      style={styles.postCard}
                      onPress={() => router.push(`/?postId=${post.id}`)}
                    >
                      <View style={styles.postInfo}>
                        <Text style={styles.postTitle}>{post.title}</Text>
                        <View style={styles.postMeta}>
                          <Clock size={12} color="rgba(255,255,255,0.4)" />
                          <Text style={styles.postTime}>{new Date(post.created_at).toLocaleDateString()}</Text>
                        </View>
                      </View>
                      {post.image_url && (
                        <Image source={{ uri: post.image_url }} style={styles.postThumb} />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No active lost & found posts.</Text>
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
                  <Text style={emojiText}>{emoji}</Text>
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
  },
  username: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },
  userStatus: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  authButton: {
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  authButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.02)",
    paddingVertical: 25,
    marginBottom: 30,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
  },
  statLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 6,
    letterSpacing: 2,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 25,
    gap: 10,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  activeTab: {
    backgroundColor: "#FFFFFF",
  },
  tabText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  activeTabText: {
    color: "#000000",
  },
  personalSection: {
    paddingBottom: 20,
  },
  addFriendContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 25,
    gap: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 15,
    paddingHorizontal: 15,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 45,
    color: "#FFFFFF",
    fontSize: 14,
  },
  addButton: {
    width: 45,
    height: 45,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  storiesContainer: {
    marginBottom: 30,
  },
  storiesScroll: {
    paddingHorizontal: 20,
    gap: 20,
  },
  storyItem: {
    alignItems: "center",
    gap: 8,
  },
  storyAvatar: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#3B82F6",
    padding: 2,
  },
  myStory: {
    borderColor: "rgba(255,255,255,0.2)",
  },
  storyImage: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
  },
  storyEmoji: {
    fontSize: 30,
  },
  storyName: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "700",
  },
  feedList: {
    paddingHorizontal: 20,
  },
  feedItem: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
  },
  feedItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  feedUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  feedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  feedEmoji: {
    fontSize: 24,
  },
  feedUsername: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  feedMeta: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
  },
  feedText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    lineHeight: 22,
  },
  feedImage: {
    width: "100%",
    height: 200,
    borderRadius: 15,
    marginTop: 15,
  },
  replyContext: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(255,255,255,0.1)",
  },
  replyContextText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    fontStyle: "italic",
  },
  emptyFeed: {
    alignItems: "center",
    paddingVertical: 50,
    gap: 15,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 35,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 15,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  replyCard: {
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 20,
    marginBottom: 1,
  },
  replyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  replyUser: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  replyTime: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
  },
  replyText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    lineHeight: 22,
  },
  replyTarget: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    marginTop: 10,
  },
  postCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 15,
    marginBottom: 1,
    alignItems: "center",
  },
  postInfo: {
    flex: 1,
    marginRight: 15,
  },
  postTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  postMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  postTime: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
  },
  postThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  emptyText: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
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
