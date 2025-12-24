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
              <Text style={styles.statValue}>{replies.length}</Text>
              <Text style={styles.statLabel}>REPLIES</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MessageSquare size={18} color="#FFFFFF" />
              <Text style={styles.sectionTitle}>RECENT REPLIES</Text>
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
              <Text style={styles.sectionTitle}>ACTIVE LOST & FOUND</Text>
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
