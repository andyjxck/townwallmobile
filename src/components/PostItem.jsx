import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import {
  Heart,
  Flag,
  Share as ShareIcon,
  AlertTriangle,
  X,
  User,
  Send,
  Pencil,
  Play,
  MessageCircle,
} from "lucide-react-native";
import { supabase } from "../utils/supabase";
import { moderateContent } from "../utils/ai";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from 'expo-video';
import { getStoredUser } from "../utils/user";
import { TextInput } from "react-native-gesture-handler";
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import PollComponent from "./PollComponent";
import { useRouter, useLocalSearchParams, usePathname } from "expo-router";
import { theme } from "../utils/theme";

export default function PostItem({ item, deviceId, onReaction, onComment, onDelete, onShare, onEdit, user }) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  
  const [revealed, setRevealed] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isVideo = item.media_type === 'video' || (item.image_url && (item.image_url.endsWith('.mp4') || item.image_url.endsWith('.mov')));
  const videoPlayer = useVideoPlayer(item.image_url, (player) => { player.loop = true; });

  useEffect(() => {
    if (isExpanded) fetchComments();
  }, [isExpanded, item.id]);

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const { data } = await supabase.from('rcomments').select(`*, user:rusers (username, emoji_icon, avatar_url)`).eq('post_id', item.id).order('created_at', { ascending: true });
      setComments(data || []);
    } catch (error) { console.error(error); }
    finally { setLoadingComments(false); }
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const storedUser = await getStoredUser();
      const { data } = await supabase.from('rcomments').insert({
        post_id: item.id,
        user_id: storedUser?.id,
        text: commentText.trim(),
        device_id: deviceId,
      }).select(`*, user:rusers (username, emoji_icon, avatar_url)`).single();
      setComments([...comments, data]);
      setCommentText("");
      if (onComment) onComment(item.id);
    } catch (error) { console.error(error); }
  };

  const images = item.image_urls || (item.image_url ? [item.image_url] : []);
  const reactions = item.reactions || item.rreactions || [];
  const helpfulCount = reactions.filter(r => r.reaction_type === 'helpful').length;
  const fakeCount = reactions.filter(r => r.reaction_type === 'fake').length;
  
  const userReactions = {
    helpful: reactions.some(r => r.reaction_type === 'helpful' && r.device_id === deviceId),
    fake: reactions.some(r => r.reaction_type === 'fake' && r.device_id === deviceId),
  };

  const shouldBlur = fakeCount > 5 && fakeCount > helpfulCount;
  const timeAgo = getTimeAgo(new Date(item.created_at));

  return (
    <View style={styles.container}>
      {shouldBlur && !revealed ? (
        <TouchableOpacity onPress={() => setRevealed(true)} style={styles.blurBanner}>
          <AlertTriangle size={18} color={theme.colors.error} />
          <Text style={[styles.blurText, { color: theme.colors.error }]}>Reported Content. Tap to reveal.</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.card}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => !item.is_anonymous && router.push(`/profile?userId=${item.user_id}`)} disabled={item.is_anonymous}>
              {item.user?.avatar_url ? (
                <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
              ) : (
                <Text style={styles.emojiAvatar}>{item.user?.emoji_icon || "👤"}</Text>
              )}
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.username}>@{item.is_anonymous ? "Anonymous" : item.user?.username}</Text>
              <Text style={styles.metaText}>{item.zone?.name} • {timeAgo}</Text>
            </View>
            {(user?.id === item.user_id || user?.is_admin) && (
              <TouchableOpacity onPress={() => onEdit?.(item)}><Pencil size={18} color={theme.colors.textSecondary} /></TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={styles.body}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.bodyText} numberOfLines={isExpanded ? undefined : 3}>
              {item.text?.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ')}
            </Text>
            {item.poll_id && <PollComponent pollId={item.poll_id} />}
          </TouchableOpacity>

          {images.length > 0 && (
            <TouchableOpacity onPress={() => setShowFullImage(true)} style={styles.mediaContainer}>
              {isVideo ? (
                <VideoView player={videoPlayer} style={styles.media} contentFit="cover" nativeControls={false} />
              ) : (
                <Image source={{ uri: images[0] }} style={styles.media} contentFit="cover" />
              )}
            </TouchableOpacity>
          )}

          <View style={styles.footer}>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => onReaction(item.id, "helpful", userReactions.helpful)} style={styles.actionBtn}>
                <Heart size={20} color={userReactions.helpful ? theme.colors.error : theme.colors.textSecondary} fill={userReactions.helpful ? theme.colors.error : "transparent"} />
                <Text style={styles.actionText}>{helpfulCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={styles.actionBtn}>
                <MessageCircle size={20} color={theme.colors.textSecondary} />
                <Text style={styles.actionText}>{comments.length}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onShare(item)} style={styles.actionBtn}>
                <ShareIcon size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => onReaction(item.id, "fake", userReactions.fake)}>
              <Flag size={18} color={userReactions.fake ? theme.colors.error : theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {isExpanded && (
            <View style={styles.commentsSection}>
              {loadingComments ? <ActivityIndicator size="small" /> : comments.map(c => (
                <View key={c.id} style={styles.comment}>
                  <Text style={styles.commentUser}>@{c.user?.username}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              ))}
              <View style={styles.inputRow}>
                <TextInput style={styles.input} placeholder="Comment..." value={commentText} onChangeText={setCommentText} />
                <TouchableOpacity onPress={handleSendComment} style={styles.sendBtn}><Send size={18} color="#FFF" /></TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      <Modal visible={showFullImage} transparent animationType="fade">
        <View style={styles.fullImageOverlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowFullImage(false)}><X color="#FFF" size={32} /></TouchableOpacity>
          {isVideo ? (
            <VideoView player={videoPlayer} style={styles.fullMedia} contentFit="contain" nativeControls />
          ) : (
            <Image source={{ uri: images[0] }} style={styles.fullMedia} contentFit="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 15, paddingHorizontal: 15 },
  card: { backgroundColor: '#FFF', borderRadius: 15, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  emojiAvatar: { fontSize: 30 },
  headerInfo: { flex: 1, marginLeft: 10 },
  username: { fontWeight: 'bold', fontSize: 16 },
  metaText: { fontSize: 12, color: '#666' },
  body: { marginBottom: 10 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  bodyText: { fontSize: 14, color: '#444' },
  mediaContainer: { height: 200, borderRadius: 10, overflow: 'hidden', marginVertical: 10 },
  media: { width: '100%', height: '100%' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 10 },
  actions: { flexDirection: 'row', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 14, color: '#666' },
  commentsSection: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 10 },
  comment: { marginBottom: 10 },
  commentUser: { fontWeight: 'bold', fontSize: 12 },
  commentText: { fontSize: 13 },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  input: { flex: 1, backgroundColor: '#F0F0F0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8 },
  sendBtn: { backgroundColor: '#000', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  blurBanner: { backgroundColor: '#FFF0F0', padding: 20, borderRadius: 15, alignItems: 'center', flexDirection: 'row', gap: 10 },
  blurText: { fontWeight: 'bold' },
  fullImageOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  fullMedia: { width: '100%', height: '80%' },
});

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 84600) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 84600)}d ago`;
}
