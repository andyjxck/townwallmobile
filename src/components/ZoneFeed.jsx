import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Pressable,
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

function PostItem({ item, deviceId, onReaction }) {
  const [revealed, setRevealed] = useState(false);
  
  const reactions = item.rreactions || [];
  const helpfulCount = reactions.filter(r => r.reaction_type === 'helpful').length;
  const seenCount = reactions.filter(r => r.reaction_type === 'seen').length;
  const fakeCount = reactions.filter(r => r.reaction_type === 'fake').length;
  
  const userReactions = {
    helpful: reactions.some(r => r.reaction_type === 'helpful' && r.device_id === deviceId),
    seen: reactions.some(r => r.reaction_type === 'seen' && r.device_id === deviceId),
    fake: reactions.some(r => r.reaction_type === 'fake' && r.device_id === deviceId),
  };

  const shouldBlur = fakeCount > (helpfulCount + seenCount) * 0.5 && fakeCount > 0;
  const timeAgo = getTimeAgo(new Date(item.created_at));
  const isExpiring =
    item.expires_at &&
    new Date(item.expires_at) < new Date(Date.now() + 3600000);

  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: "rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
      >
        <View
          style={{
            backgroundColor: getTagColor(item.rtags?.name),
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 4,
            marginRight: 8,
          }}
        >
          <Text style={{ color: "#000000", fontSize: 11, fontWeight: "600" }}>
            {item.rtags?.name || 'General'}
          </Text>
        </View>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          {item.is_anonymous ? "Anonymous" : "User"}
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 12,
            marginLeft: 6,
          }}
        >
          · {timeAgo}
        </Text>
        {isExpiring && (
          <View
            style={{
              marginLeft: "auto",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Clock size={12} color="rgba(255,255,255,0.4)" />
            <Text
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 11,
                marginLeft: 4,
              }}
            >
              Expiring soon
            </Text>
          </View>
        )}
        {item.is_resolved && (
          <View
            style={{
              marginLeft: "auto",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#4ADE80", fontSize: 11, fontWeight: "600" }}>
              ✓ Resolved
            </Text>
          </View>
        )}
      </View>

      {/* Post Content */}
      {shouldBlur && !revealed ? (
        <Pressable
          onPress={() => {
            setRevealed(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            paddingVertical: 20,
            paddingHorizontal: 16,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "rgba(239, 68, 68, 0.2)",
            marginBottom: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertTriangle size={16} color="#EF4444" />
            <Text
              style={{
                color: "#EF4444",
                fontSize: 14,
                fontWeight: "600",
                marginLeft: 8,
              }}
            >
              This post is being fact-checked. Tap to reveal.
            </Text>
          </View>
        </Pressable>
      ) : (
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 16,
            lineHeight: 24,
            marginBottom: 12,
            opacity: shouldBlur && revealed ? 0.7 : 1,
          }}
        >
          {item.text}
        </Text>
      )}

      {/* Reactions */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <TouchableOpacity
          onPress={() => onReaction(item.id, "helpful", userReactions.helpful)}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <ThumbsUp
            size={18}
            color={userReactions.helpful ? "#4ADE80" : "rgba(255,255,255,0.4)"}
            fill={userReactions.helpful ? "#4ADE80" : "transparent"}
          />
          {helpfulCount > 0 && (
            <Text
              style={{
                color: userReactions.helpful
                  ? "#4ADE80"
                  : "rgba(255,255,255,0.5)",
                fontSize: 13,
                marginLeft: 6,
                fontWeight: "600",
              }}
            >
              {helpfulCount}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onReaction(item.id, "seen", userReactions.seen)}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <Eye
            size={18}
            color={userReactions.seen ? "#60A5FA" : "rgba(255,255,255,0.4)"}
            fill={userReactions.seen ? "#60A5FA" : "transparent"}
          />
          {seenCount > 0 && (
            <Text
              style={{
                color: userReactions.seen ? "#60A5FA" : "rgba(255,255,255,0.5)",
                fontSize: 13,
                marginLeft: 6,
                fontWeight: "600",
              }}
            >
              {seenCount}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onReaction(item.id, "fake", userReactions.fake)}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <Flag
            size={18}
            color={userReactions.fake ? "#EF4444" : "rgba(255,255,255,0.4)"}
            fill={userReactions.fake ? "#EF4444" : "transparent"}
          />
          {fakeCount > 0 && (
            <Text
              style={{
                color: userReactions.fake ? "#EF4444" : "rgba(255,255,255,0.5)",
                fontSize: 13,
                marginLeft: 6,
                fontWeight: "600",
              }}
            >
              {fakeCount}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ZoneFeed({ zoneSlug, zoneName }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState(null);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      // Get zone ID first
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
          rreactions (reaction_type, device_id)
        `)
        .eq('zone_id', zoneData.id)
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
        data={posts}
        renderItem={({ item }) => (
          <PostItem
            item={item}
            deviceId={deviceId}
            onReaction={handleReaction}
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
