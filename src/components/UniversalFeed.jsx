import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Dimensions,
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
  ChevronDown,
  Filter,
  ArrowUpDown,
} from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingVertical: 20,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}
      >
        <View
          style={{
            backgroundColor: getTagColor(item.rtags?.name),
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 4,
            marginRight: 8,
          }}
        >
          <Text style={{ color: "#000000", fontSize: 10, fontWeight: "700", textTransform: 'uppercase' }}>
            {item.rtags?.name || 'General'}
          </Text>
        </View>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: '500' }}>
          {item.rzones?.name}
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.2)",
            fontSize: 12,
            marginLeft: 6,
          }}
        >
          · {timeAgo}
        </Text>
        {item.is_resolved && (
          <View style={{ marginLeft: "auto" }}>
            <Text style={{ color: "#4ADE80", fontSize: 11, fontWeight: "600" }}>
              RESOLVED
            </Text>
          </View>
        )}
      </View>

      {shouldBlur && !revealed ? (
        <Pressable
          onPress={() => {
            setRevealed(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            paddingVertical: 24,
            paddingHorizontal: 16,
            borderRadius: 12,
            marginBottom: 12,
            alignItems: 'center',
          }}
        >
          <AlertTriangle size={20} color="rgba(255,255,255,0.4)" />
          <Text
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 14,
              marginTop: 8,
              textAlign: 'center'
            }}
          >
            This post is being fact-checked. Tap to reveal.
          </Text>
        </Pressable>
      ) : (
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 17,
            lineHeight: 25,
            marginBottom: 16,
            fontWeight: '400',
          }}
        >
          {item.text}
        </Text>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <ReactionButton
          icon={<ThumbsUp size={16} color={userReactions.helpful ? "#FFFFFF" : "rgba(255,255,255,0.3)"} />}
          count={helpfulCount}
          active={userReactions.helpful}
          onPress={() => onReaction(item.id, "helpful", userReactions.helpful)}
        />
        <ReactionButton
          icon={<Eye size={16} color={userReactions.seen ? "#FFFFFF" : "rgba(255,255,255,0.3)"} />}
          count={seenCount}
          active={userReactions.seen}
          onPress={() => onReaction(item.id, "seen", userReactions.seen)}
        />
        <ReactionButton
          icon={<Flag size={16} color={userReactions.fake ? "#FFFFFF" : "rgba(255,255,255,0.3)"} />}
          count={fakeCount}
          active={userReactions.fake}
          onPress={() => onReaction(item.id, "fake", userReactions.fake)}
        />
      </View>
    </View>
  );
}

function ReactionButton({ icon, count, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: active ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
      }}
    >
      {icon}
      {count > 0 && (
        <Text
          style={{
            color: active ? "#FFFFFF" : "rgba(255,255,255,0.5)",
            fontSize: 12,
            marginLeft: 6,
            fontWeight: "600",
          }}
        >
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function UniversalFeed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [zones, setZones] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest'

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    fetchFilterData();
  }, []);

  const fetchFilterData = async () => {
    const { data: zData } = await supabase.from('rzones').select('*').order('name');
    const { data: tData } = await supabase.from('rtags').select('*').order('name');
    setZones(zData || []);
    setTags(tData || []);
  };

  const fetchPosts = useCallback(async () => {
    try {
      let query = supabase
        .from('rposts')
        .select(`
          *,
          rtags (name),
          rzones (name),
          rreactions (reaction_type, device_id)
        `);

      if (selectedZone) query = query.eq('zone_id', selectedZone);
      if (selectedTag) query = query.tag_id ? query.eq('tag_id', selectedTag) : query; // safety check for tag column

      query = query.order('created_at', { ascending: sortBy === 'oldest' });

      const { data, error } = await query;
      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedZone, selectedTag, sortBy]);

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
        await supabase.from('rreactions').delete().match({ post_id: postId, reaction_type: reactionType, device_id: deviceId });
      } else {
        await supabase.from('rreactions').insert({ post_id: postId, reaction_type: reactionType, device_id: deviceId });
      }
      fetchPosts();
    } catch (error) {
      console.error("Error updating reaction:", error);
    }
  };

  const clearFilters = () => {
    setSelectedZone(null);
    setSelectedTag(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <StatusBar style="light" />

      {/* Headerless Filter Bar */}
      <View style={{ paddingTop: insets.top + 10, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 15 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: -1 }}>REDDITCH'D</Text>
          <View style={{ flexDirection: 'row', gap: 15 }}>
            <TouchableOpacity onPress={() => setSortBy(s => s === 'newest' ? 'oldest' : 'newest')}>
              <ArrowUpDown size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/settings")}>
              <Settings size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          data={[{ id: null, name: 'All Zones' }, ...zones]}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedZone(item.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: selectedZone === item.id ? '#FFFFFF' : 'rgba(255,255,255,0.05)',
              }}
            >
              <Text style={{ color: selectedZone === item.id ? '#000000' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' }}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => `zone-${item.id}`}
        />

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginTop: 10 }}
          data={[{ id: null, name: 'All Tags' }, ...tags]}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedTag(item.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: selectedTag === item.id ? 'rgba(255,255,255,0.3)' : 'transparent',
                backgroundColor: selectedTag === item.id ? 'transparent' : 'rgba(255,255,255,0.03)',
              }}
            >
              <Text style={{ color: selectedTag === item.id ? '#FFFFFF' : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '500' }}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => `tag-${item.id}`}
        />
      </View>

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="rgba(255,255,255,0.3)" />
        </View>
      ) : (
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          ListEmptyComponent={
            <View style={{ paddingVertical: 100, alignItems: "center", paddingHorizontal: 40 }}>
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 16, textAlign: 'center' }}>
                No posts found with these filters.
              </Text>
              <TouchableOpacity onPress={clearFilters} style={{ marginTop: 15 }}>
                <Text style={{ color: "#FFFFFF", fontWeight: '600' }}>Clear all filters</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Flush Floating Post Button */}
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/post");
        }}
        style={{
          position: "absolute",
          bottom: insets.bottom + 20,
          right: 20,
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: "#FFFFFF",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Plus size={24} color="#000000" strokeWidth={3} />
      </TouchableOpacity>
    </View>
  );
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
}

function getTagColor(tagName) {
  const colors = {
    General: "#FFFFFF",
    Traffic: "#F59E0B",
    "Lost & Found": "#8B5CF6",
    Complaint: "#EF4444",
    Incident: "#DC2626",
    Warning: "#EA580C",
    Event: "#06B6D4",
    "Shop / Business": "#10B981",
    Question: "#60A5FA",
  };
  return colors[tagName] || "#FFFFFF";
}
