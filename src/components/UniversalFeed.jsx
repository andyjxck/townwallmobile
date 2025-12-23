import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  Plus,
  Settings,
  ArrowUp,
  ArrowDown,
  Search,
} from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/theme";

function PostItem({ item, index }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const timeAgo = getTimeAgo(new Date(item.created_at));
  const fullDate = new Date(item.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setExpanded(!expanded);
      }}
      activeOpacity={0.8}
      style={styles.postContainer}
    >
      <View style={styles.postHeader}>
        <Text style={[styles.zoneText, { color: 'rgba(255, 255, 255, 0.5)' }]}>
          {item.rzones?.name}
        </Text>
        <Text style={[styles.timeText, { color: 'rgba(255, 255, 255, 0.3)' }]}>
          · {timeAgo}
        </Text>
        {item.rtags?.name && (
          <Text style={[styles.tagText, { color: 'rgba(255, 255, 255, 0.3)' }]}>
            · {item.rtags.name}
          </Text>
        )}
      </View>

      <Text style={[styles.postTitle, { color: '#FFFFFF' }]}>
        {item.title || "Untitled Post"}
      </Text>

      {expanded && (
        <View style={styles.expandedContent}>
          <Text style={[styles.postBody, { color: 'rgba(255, 255, 255, 0.8)' }]}>
            {item.text}
          </Text>
          
          <View style={styles.postFooter}>
            <Text style={[styles.footerText, { color: 'rgba(255, 255, 255, 0.4)' }]}>
              Posted by {item.rusers?.username || "Anonymous"}
            </Text>
            <Text style={[styles.footerText, { color: 'rgba(255, 255, 255, 0.4)' }]}>
              {fullDate}
            </Text>
          </View>
        </View>
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
          rusers (username)
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

  const clearFilters = () => {
    setSelectedZone(null);
    setSelectedTag(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <StatusBar style="light" />
      
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <Text style={[styles.logo, { color: '#FFFFFF' }]}>REDDITCH'D</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSortBy(s => s === 'newest' ? 'oldest' : 'newest');
              }}
            >
              {sortBy === 'newest' ? (
                <ArrowDown size={20} color="#FFFFFF" />
              ) : (
                <ArrowUp size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => router.push("/settings")}
            >
              <Settings size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.filterSection}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
            data={[{ id: null, name: 'ALL ZONES' }, ...zones]}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedZone(item.id)}
                style={styles.filterPill}
              >
                <Text style={[
                  styles.filterText,
                  { color: selectedZone === item.id ? '#FFFFFF' : 'rgba(255,255,255,0.4)', 
                    fontWeight: selectedZone === item.id ? '800' : '400' }
                ]}>
                  {item.name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            )}
            keyExtractor={item => `zone-${item.id}`}
          />

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.filterList, { marginTop: 4 }]}
            data={[{ id: null, name: 'EVERYTHING' }, ...tags]}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedTag(item.id)}
                style={styles.filterPill}
              >
                <Text style={[
                  styles.filterText,
                  { color: selectedTag === item.id ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                    fontWeight: selectedTag === item.id ? '800' : '400',
                    fontSize: 11 }
                ]}>
                  #{item.name.toUpperCase().replace(/\s+/g, '')}
                </Text>
              </TouchableOpacity>
            )}
            keyExtractor={item => `tag-${item.id}`}
          />
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={({ item, index }) => (
            <PostItem item={item} index={index} />
          )}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFFFFF"
            />
          }
          contentContainerStyle={{ 
            paddingBottom: insets.bottom + 100,
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Search size={40} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
              <Text style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                No posts found.
              </Text>
              <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>CLEAR FILTERS</Text>
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
        activeOpacity={0.9}
        style={styles.fab}
      >
        <Plus size={32} color="#000000" strokeWidth={3} />
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
    paddingVertical: 15,
  },
  logo: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  iconButton: {
    padding: 5,
  },
  filterSection: {
    paddingBottom: 10,
  },
  filterList: {
    paddingHorizontal: 20,
    gap: 15,
  },
  filterPill: {
    paddingVertical: 5,
  },
  filterText: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  postContainer: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  zoneText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 11,
    marginLeft: 4,
  },
  tagText: {
    fontSize: 11,
    marginLeft: 4,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  expandedContent: {
    marginTop: 12,
  },
  postBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 100,
    alignItems: "center",
  },
  clearButton: {
    marginTop: 20,
    padding: 10,
  },
  fab: {
    position: "absolute",
    bottom: 35,
    right: 25,
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#FFFFFF',
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
});

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "NOW";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}M`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}H`;
  return `${Math.floor(seconds / 86400)}D`;
}
