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
  Shield 
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { decode } from "base64-arraybuffer";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EMOJIS = ["👤", "🦊", "🐯", "🐼", "🦁", "🐨", "🐸", "🤖", "👻", "👽"];

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ posts: 0 });
  const [replies, setReplies] = useState([]);
  const [lostFound, setLostFound] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#FFFFFF" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
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
            {user?.supabase_uid ? "Authenticated Account" : "Anonymous Ghost User"}
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
              <Text style={styles.authButtonText}>CLAIM ACCOUNT</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.posts}</Text>
            <Text style={styles.statLabel}>POSTS</Text>
          </View>
          <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' }]}>
            <Text style={styles.statValue}>{replies.length}</Text>
            <Text style={styles.statLabel}>REPLIES</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MessageSquare size={18} color="#FFFFFF" />
            <Text style={styles.sectionTitle}>Recent Replies</Text>
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

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Search size={18} color="#FFFFFF" />
            <Text style={styles.sectionTitle}>Active Lost & Found</Text>
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

        <View style={{ height: 100 }} />
      </ScrollView>

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
    fontWeight: "800",
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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  emojiAvatar: {
    fontSize: 50,
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#000000",
  },
  username: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  userStatus: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  authButton: {
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  authButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.03)",
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 20,
    marginBottom: 30,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  replyCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
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
    fontSize: 13,
    fontWeight: "700",
  },
  replyTime: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
  },
  replyText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    lineHeight: 20,
  },
  replyTarget: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    marginTop: 8,
    fontStyle: "italic",
  },
  postCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: "center",
  },
  postInfo: {
    flex: 1,
    marginRight: 10,
  },
  postTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
  },
  postMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  postTime: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
  },
  postThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  emptyText: {
    color: "rgba(255,255,255,0.3)",
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
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: "#1A1A1A",
    width: "80%",
    borderRadius: 24,
    padding: 25,
    alignItems: "center",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 20,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 15,
    marginBottom: 25,
  },
  emojiButton: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  emojiText: {
    fontSize: 32,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
    width: "100%",
    justifyContent: "center",
  },
  uploadButtonText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  closeModal: {
    padding: 10,
  },
  closeModalText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontWeight: "700",
  },
});
