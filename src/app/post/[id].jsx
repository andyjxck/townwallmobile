import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Share2, MapPin, Tag, Calendar, User } from "lucide-react-native";
import { supabase } from "../../utils/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";

export default function PostDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      console.error("Error fetching post detail:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!post) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `${post.title || 'Redditch\'d Post'}\n\n${post.text}\n\nSent via Redditch'd`,
      });
    } catch (error) {
      console.error(error);
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

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <StatusBar style="light" />
      
      <View style={{ paddingTop: insets.top + 10 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <ChevronLeft size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
            <Share2 size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <MapPin size={12} color="rgba(255,255,255,0.4)" />
            <Text style={styles.metaText}>{post.rzones?.name.toUpperCase()}</Text>
          </View>
          {post.rtags?.name && (
            <View style={styles.metaItem}>
              <Tag size={12} color="rgba(255,255,255,0.4)" />
              <Text style={styles.metaText}>{post.rtags.name.toUpperCase()}</Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>{post.title || "Untitled Post"}</Text>
        
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Calendar size={14} color="rgba(255,255,255,0.3)" />
            <Text style={styles.infoText}>
              {new Date(post.created_at).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <User size={14} color="rgba(255,255,255,0.3)" />
            <Text style={styles.infoText}>Anonymous</Text>
          </View>
        </View>

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
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  iconButton: {
    padding: 5,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 25,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 25,
  },
  body: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '400',
  },
});