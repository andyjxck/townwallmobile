import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft, Share, Flag, Clock, MapPin } from "lucide-react-native";
import { supabase } from "../../utils/supabase";
import * as Haptics from "expo-haptics";

export default function PostDetail() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from('rposts')
        .select(`
          *,
          rtags (name),
          rzones (name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setPost(data);
    } catch (error) {
      console.error("Error fetching post:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: '#000000', justifyContent: 'center' }]}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, { backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#FFFFFF' }}>Post not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)' }}>GO BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const createdDate = new Date(post.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <StatusBar style="light" />
      
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.iconButton}
          >
            <ChevronLeft size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton}>
              <Share size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Flag size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50 }}>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <MapPin size={14} color="rgba(255,255,255,0.4)" />
            <Text style={styles.metaText}>{post.rzones?.name}</Text>
          </View>
          <View style={styles.metaItem}>
            <Clock size={14} color="rgba(255,255,255,0.4)" />
            <Text style={styles.metaText}>{createdDate}</Text>
          </View>
        </View>

        <Text style={styles.title}>{post.title || 'Untitled'}</Text>
        
        {post.rtags?.name && (
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>#{post.rtags.name.toUpperCase().replace(/\s+/g, '')}</Text>
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.body}>{post.text}</Text>
      </ScrollView>
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
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    padding: 10,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 20,
    marginBottom: 15,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 38,
    marginBottom: 15,
  },
  tagBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    borderRadius: 5,
    marginBottom: 25,
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 25,
  },
  body: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400',
  },
});
