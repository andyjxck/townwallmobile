import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  ThumbsUp,
  Eye,
  Flag,
  Plus,
  Settings,
  Clock,
  AlertTriangle,
} from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import * as Haptics from "expo-haptics";
import PostItem from "./PostItem";
import { getStoredUser } from "../utils/user";
import { useAuthStore } from "../utils/auth/store";
import { ShareManager } from "./ShareManager";
import { BannerAd } from "./BannerAd";

export default function ZoneFeed({ zoneSlug, zoneName }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [isModerator, setIsModerator] = useState(false);
  const user = useAuthStore(state => state.auth);
  const shareRef = useRef();

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    checkModerator();
  }, []);

  const checkModerator = async () => {
    const user = await getStoredUser();
    if (user) {
      const { data } = await supabase.from('rusers').select('is_admin, is_moderator').eq('id', user.id).single();
      setIsModerator(!!data?.is_admin || !!data?.is_moderator);
    }
  };

  const handleMuteUser = async (userId) => {
    Alert.alert(
      "Mute User",
      "Are you sure you want to mute this user? They will no longer be able to post.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Mute", 
          style: "destructive",
          onPress: async () => {
            try {
              const admin = await getStoredUser();
              const { error } = await supabase
                .from('rusers')
                .update({ 
                  is_muted: true,
                  muted_at: new Date().toISOString(),
                  muted_by: admin.supabase_uid
                })
                .eq('id', userId);
              
              if (error) throw error;
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Success", "User has been muted.");
            } catch (error) {
              console.error("Error muting user:", error);
              Alert.alert("Error", "Failed to mute user.");
            }
          }
        }
      ]
    );
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
              fetchPosts();
            } catch (error) {
              console.error(error);
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

    const handleShare = async (post) => {
      shareRef.current?.share(post);
    };

    const fetchPosts = useCallback(async () => {
    try {
      const { data: zoneData } = await supabase
        .from('rzones')
        .select('id')
        .eq('slug', zoneSlug)
        .single();
      
      if (!zoneData) return;

      const { data, error } = await supabase
        .from('rposts')
        .select(`
          *,
          rtags (name),
          rzones (name),
          rusers (username, emoji_icon, avatar_url),
          rreactions (reaction_type, device_id)
        `)
        .eq('zone_id', zoneData.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [zoneSlug]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
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

      fetchPosts();
    } catch (error) {
      console.error("Error updating reaction:", error);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000000",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="rgba(255,255,255,0.3)" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <StatusBar style="light" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingBottom: 16,
          paddingHorizontal: 20,
          borderBottomWidth: 0.5,
          borderBottomColor: "rgba(255,255,255,0.06)",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 28,
                fontWeight: "700",
                letterSpacing: -0.5,
              }}
            >
              {zoneName}
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 13,
                marginTop: 2,
              }}
            >
              What's happening around you
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/settings")}>
            <Settings size={24} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed */}
      <FlatList
        ListHeaderComponent={<BannerAd />}
        data={posts}
        renderItem={({ item }) => (
              <PostItem
                item={item}
                deviceId={deviceId}
                onReaction={handleReaction}
                onDelete={handleDeletePost}
                onMute={handleMuteUser}
                onEdit={handleEditPost}
                onShare={handleShare}
                user={user}
              />
        )}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="rgba(255,255,255,0.3)"
          />
        }
        ListEmptyComponent={
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 15 }}>
              No posts yet in this zone
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.3)",
                fontSize: 13,
                marginTop: 4,
              }}
            >
              Be the first to post
            </Text>
          </View>
        }
      />

      {/* Floating Post Button */}
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/post");
        }}
        style={{
          position: "absolute",
          bottom: insets.bottom + 90,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "#FFFFFF",
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        }}
      >
        <Plus size={28} color="#000000" strokeWidth={2.5} />
      </TouchableOpacity>

      <ShareManager ref={shareRef} />
    </View>
  );
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}

function getTagColor(tagName) {
  const colors = {
    General: "#94A3B8",
    Traffic: "#F59E0B",
    "Lost & Found": "#8B5CF6",
    Complaint: "#EF4444",
    Incident: "#DC2626",
    Warning: "#EA580C",
    Event: "#06B6D4",
    "Shop / Business": "#10B981",
    Question: "#60A5FA",
  };
  return colors[tagName] || "#94A3B8";
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}

function getTagColor(tagName) {
  const colors = {
    General: "#94A3B8",
    Traffic: "#F59E0B",
    "Lost & Found": "#8B5CF6",
    Complaint: "#EF4444",
    Incident: "#DC2626",
    Warning: "#EA580C",
    Event: "#06B6D4",
    "Shop / Business": "#10B981",
    Question: "#60A5FA",
  };
  return colors[tagName] || "#94A3B8";
}
