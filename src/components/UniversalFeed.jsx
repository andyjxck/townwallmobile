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
  StyleSheet,
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
  ArrowUp,
  ArrowDown,
  MapPin,
  Tag as TagIcon,
  Search,
} from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView, AnimatePresence } from "moti";
import { useTheme, getTagColor } from "../utils/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function PostItem({ item, deviceId, onReaction, index }) {
  const { colors } = useTheme();
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
  const tagColor = getTagColor(item.rtags?.name, colors);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 500, delay: index * 50 }}
      style={[styles.postContainer, { backgroundColor: colors.surface + '80' }]}
    >
      <View style={styles.postHeader}>
        <View style={[styles.tagBadge, { backgroundColor: tagColor }]}>
          <TagIcon size={10} color={colors.text} style={{ marginRight: 4 }} />
          <Text style={[styles.tagText, { color: colors.text }]}>
            {item.rtags?.name || 'General'}
          </Text>
        </View>
        <View style={styles.zoneBadge}>
          <MapPin size={10} color={colors.textSecondary} style={{ marginRight: 4 }} />
          <Text style={[styles.zoneText, { color: colors.textSecondary }]}>
            {item.rzones?.name}
          </Text>
        </View>
        <Text style={[styles.timeText, { color: colors.textTertiary }]}>
          · {timeAgo}
        </Text>
        {item.is_resolved && (
          <View style={styles.resolvedBadge}>
            <View style={styles.resolvedDot} />
            <Text style={styles.resolvedText}>RESOLVED</Text>
          </View>
        )}
      </View>

      {shouldBlur && !revealed ? (
        <Pressable
          onPress={() => {
            setRevealed(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          style={styles.blurContainer}
        >
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
          <AlertTriangle size={24} color={colors.textTertiary} />
          <Text style={[styles.blurText, { color: colors.textSecondary }]}>
            Flagged for fact-checking. Tap to reveal.
          </Text>
        </Pressable>
      ) : (
        <Text style={[styles.postText, { color: colors.text }]}>
          {item.text}
        </Text>
      )}

      <View style={styles.reactionRow}>
        <ReactionButton
          icon={<ThumbsUp size={14} color={userReactions.helpful ? "#FFFFFF" : colors.textSecondary} />}
          count={helpfulCount}
          active={userReactions.helpful}
          onPress={() => onReaction(item.id, "helpful", userReactions.helpful)}
        />
        <ReactionButton
          icon={<Eye size={14} color={userReactions.seen ? "#FFFFFF" : colors.textSecondary} />}
          count={seenCount}
          active={userReactions.seen}
          onPress={() => onReaction(item.id, "seen", userReactions.seen)}
        />
        <ReactionButton
          icon={<Flag size={14} color={userReactions.fake ? "#FFFFFF" : colors.textSecondary} />}
          count={fakeCount}
          active={userReactions.fake}
          onPress={() => onReaction(item.id, "fake", userReactions.fake)}
        />
      </View>
    </MotiView>
  );
}

function ReactionButton({ icon, count, active, onPress }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={[
        styles.reactionButton,
        { 
          backgroundColor: active ? 'rgba(255,255,255,0.2)' : colors.reactionDefault,
          borderColor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
          borderWidth: 1,
        }
      ]}
    >
      {icon}
      {count > 0 && (
        <Text style={[styles.reactionCount, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function UniversalFeed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const [posts, setPosts] = useState([]);
  const [zones, setZones] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [sortBy, setSortBy] = useState('newest');

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
        if (selectedTag) query = query.eq('tag_id', selectedTag);

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.background, '#0f0f1a', colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <View style={{ paddingTop: insets.top, zIndex: 10 }}>
        <View style={styles.header}>
          <Text style={[styles.logo, { color: colors.text }]}>FEED</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: colors.reactionDefault }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSortBy(s => s === 'newest' ? 'oldest' : 'newest');
              }}
            >
              {sortBy === 'newest' ? (
                <ArrowDown size={18} color={colors.text} />
              ) : (
                <ArrowUp size={18} color={colors.text} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: colors.reactionDefault }]}
              onPress={() => router.push("/settings")}
            >
              <Settings size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.filterSection}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
            data={[{ id: null, name: 'All' }, ...zones]}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedZone(item.id)}
                style={[
                  styles.filterPill,
                  { backgroundColor: selectedZone === item.id ? colors.text : colors.reactionDefault }
                ]}
              >
                <Text style={[
                  styles.filterText,
                  { color: selectedZone === item.id ? colors.background : colors.textSecondary }
                ]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
            keyExtractor={item => `zone-${item.id}`}
          />

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.filterList, { marginTop: 8 }]}
            data={[{ id: null, name: 'Everyone' }, ...tags]}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedTag(item.id)}
                style={[
                  styles.tagPill,
                  { 
                    backgroundColor: selectedTag === item.id ? 'transparent' : colors.reactionDefault,
                    borderColor: selectedTag === item.id ? colors.textTertiary : 'transparent'
                  }
                ]}
              >
                <Text style={[
                  styles.tagPillText,
                  { color: selectedTag === item.id ? colors.text : colors.textTertiary }
                ]}>
                  #{item.name?.toLowerCase().replace(/\s+/g, '') || 'all'}
                </Text>
              </TouchableOpacity>
            )}
            keyExtractor={item => `tag-${item.id}`}
          />
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={({ item, index }) => (
            <PostItem
              item={item}
              index={index}
              deviceId={deviceId}
              onReaction={handleReaction}
            />
          )}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textTertiary}
            />
          }
          contentContainerStyle={{ 
            paddingBottom: insets.bottom + 100,
            paddingHorizontal: 16,
            paddingTop: 10
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Search size={48} color={colors.textTertiary} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Nothing found here yet.
              </Text>
              <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
                <Text style={[styles.clearButtonText, { color: colors.text }]}>Reset filters</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/post");
        }}
        activeOpacity={0.8}
        style={styles.fab}
      >
        <LinearGradient
          colors={['#ffffff', '#e0e0e0']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Plus size={28} color="#000000" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  logo: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterSection: {
    paddingBottom: 12,
  },
  filterList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  postContainer: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: 'uppercase',
  },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  zoneText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  resolvedBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resolvedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
    marginRight: 5,
  },
  resolvedText: {
    color: "#4ADE80",
    fontSize: 9,
    fontWeight: "800",
  },
  postText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  blurContainer: {
    height: 100,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontWeight: '500',
  },
  reactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reactionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  reactionCount: {
    fontSize: 11,
    marginLeft: 6,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 100,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
  clearButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
});

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w`;
  return `${Math.floor(seconds / 2592000)}mo`;
}
