import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X, ChevronRight, Image as ImageIcon, Trash2, Shield, User, Play, BarChart2, Plus, Minus, ChevronLeft } from "lucide-react-native";
import { getStoredUser } from "../utils/user";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import { moderateContent } from "../utils/ai";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useTheme } from "../utils/theme";
import { RichTextEditor } from "../components/RichTextEditor";

export default function PostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const postId = params.id;

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [zones, setZones] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [step, setStep] = useState('write'); // 'write' | 'zone' | 'tag' | 'success' | 'poll'
  const [media, setMedia] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [user, setUser] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Poll state
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [hasPoll, setHasPoll] = useState(false);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    getStoredUser().then(setUser);
    fetchData();
    requestPermissions();
    if (postId) fetchPostData();
  }, [postId]);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
  };

  const fetchPostData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('rposts').select('*').eq('id', postId).single();
      if (data) {
        setTitle(data.title || "");
        setText(data.text || "");
        setIsAnonymous(data.is_anonymous);
        if (data.image_urls) {
          setMedia(data.image_urls.map(url => ({ uri: url, fromRemote: true, type: data.media_type || 'image' })));
        } else if (data.image_url) {
          setMedia([{ uri: data.image_url, fromRemote: true, type: data.media_type || 'image' }]);
        }
      }
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const fetchData = async () => {
    const [zRes, tRes] = await Promise.all([
      supabase.from('rzones').select('*').order('name'),
      supabase.from('rtags').select('*').order('name')
    ]);
    setZones(zRes.data || []);
    setTags(tRes.data || []);
    
    if (postId) {
      const { data: post } = await supabase.from('rposts').select('zone_id, tag_id').eq('id', postId).single();
      if (post) {
        if (zRes.data) setSelectedZone(zRes.data.find(z => z.id === post.zone_id));
        if (tRes.data) setSelectedTag(tRes.data.find(t => t.id === post.tag_id));
      }
    } else if (zRes.data) {
      setSelectedZone(zRes.data.find(z => z.slug === 'town-centre') || zRes.data[0]);
    }
  };

  const pickMedia = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled) setMedia([...media, ...result.assets]);
  };

  const handlePost = async () => {
    if (!text || !selectedTag || !deviceId) {
      Alert.alert("Missing Info", "Please write something and select a tag.");
      return;
    }
    setLoading(true);
    setUploadProgress(0.1);

    try {
      const moderation = await moderateContent(`${title}\n${text}`);
      if (moderation.status === 'rejected') {
        alert(`Rejected: ${moderation.reason}`);
        setLoading(false); return;
      }

      let createdPollId = null;
      if (hasPoll && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2) {
        const { data: poll } = await supabase.from('rpolls').insert({ question: pollQuestion.trim(), is_active: true }).select().single();
        createdPollId = poll.id;
        await supabase.from('rpoll_options').insert(pollOptions.filter(o => o.trim()).map(o => ({ poll_id: poll.id, option_text: o.trim() })));
      }

      const imageUrls = [];
      let postMediaType = 'image';
      for (const [idx, item] of media.entries()) {
        setUploadProgress(0.2 + (idx / media.length) * 0.7);
        if (item.fromRemote) {
          imageUrls.push(item.uri);
          if (item.type === 'video') postMediaType = 'video';
          continue;
        }
        const fileExt = item.uri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const arrayBuffer = await (await fetch(item.uri)).arrayBuffer();
        await supabase.storage.from('posts').upload(fileName, arrayBuffer, { contentType: item.type === 'video' ? `video/${fileExt}` : 'image/jpeg' });
        imageUrls.push(supabase.storage.from('posts').getPublicUrl(fileName).data.publicUrl);
        if (item.type === 'video') postMediaType = 'video';
      }

      const postData = {
        title: title.trim() || text.replace(/<[^>]*>?/gm, '').substring(0, 50),
        text: text.trim(),
        zone_id: selectedZone?.id,
        tag_id: selectedTag.id,
        device_id: deviceId,
        user_id: user?.id,
        is_anonymous: isAnonymous,
        image_url: imageUrls[0] || null,
        image_urls: imageUrls,
        media_type: postMediaType,
        poll_id: createdPollId,
        moderation_status: moderation.status,
        moderation_reason: moderation.reason,
      };

      const result = postId 
        ? await supabase.from('rposts').update(postData).eq('id', postId)
        : await supabase.from('rposts').insert(postData);

      if (result.error) throw result.error;
      setStep('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) { alert("Failed to post."); }
    finally { setLoading(false); }
  };

  if (step === 'success') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.successTitle, { color: colors.text }]}>SUCCESS!</Text>
        <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>Your post is now live.</Text>
        <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={() => router.replace("/")}>
          <Text style={styles.doneBtnText}>CONTINUE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}><X size={24} color={colors.text} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{postId ? 'EDIT' : 'NEW POST'}</Text>
        <TouchableOpacity onPress={handlePost} disabled={loading || !text} style={[styles.headerBtn, { opacity: (loading || !text) ? 0.5 : 1 }]}>
          {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.postBtnText, { color: colors.primary }]}>{postId ? 'SAVE' : 'POST'}</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.metaRow}>
          <TouchableOpacity onPress={() => setStep('zone')} style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>ZONE</Text>
            <Text style={[styles.pillValue, { color: colors.text }]}>{selectedZone?.name?.toUpperCase() || 'SELECT'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep('tag')} style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>TAG</Text>
            <Text style={[styles.pillValue, { color: colors.text }]}>{selectedTag?.name?.toUpperCase() || 'SELECT'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsAnonymous(!isAnonymous)} style={[styles.pill, { backgroundColor: isAnonymous ? colors.surface : colors.primary, borderColor: colors.border }]}>
            <Text style={[styles.pillLabel, { color: isAnonymous ? colors.textSecondary : 'rgba(255,255,255,0.7)' }]}>POST AS</Text>
            <Text style={[styles.pillValue, { color: isAnonymous ? colors.text : '#FFF' }]}>{isAnonymous ? 'ANONYMOUS' : 'MY PROFILE'}</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          placeholder="Title (Optional)"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
          style={[styles.titleInput, { color: colors.text, ...typography.h2 }]}
        />

        <RichTextEditor
          value={text}
          onChange={setText}
          placeholder="Share something with the town..."
          onPollPress={() => setStep('poll')}
          minHeight={300}
        />

        {hasPoll && (
          <View style={[styles.pollPreview, { backgroundColor: colors.primary + '1A', borderColor: colors.primary + '33' }]}>
            <View style={styles.pollHeader}><BarChart2 size={16} color={colors.primary} /><Text style={[styles.pollLabel, { color: colors.primary }]}>INTEGRATED POLL</Text></View>
            <Text style={[styles.pollQuestion, { color: colors.text }]}>{pollQuestion}</Text>
            <TouchableOpacity onPress={() => setHasPoll(false)}><Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>REMOVE</Text></TouchableOpacity>
          </View>
        )}

        <View style={styles.mediaRow}>
          {media.map((m, i) => (
            <View key={i} style={styles.mediaItem}>
              <Image source={{ uri: m.uri }} style={[styles.mediaThumb, { borderRadius: borderRadius.md }]} />
              <TouchableOpacity onPress={() => setMedia(media.filter((_, idx) => idx !== i))} style={styles.removeMedia}><X size={12} color="#FFF" /></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={pickMedia} style={[styles.addMediaBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Plus size={24} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Overlays */}
      {(step === 'zone' || step === 'tag') && (
        <View style={[styles.overlay, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={styles.overlayHeader}>
            <Text style={[styles.overlayTitle, { color: colors.text }]}>SELECT {step.toUpperCase()}</Text>
            <TouchableOpacity onPress={() => setStep('write')}><X size={24} color={colors.text} /></TouchableOpacity>
          </View>
          <ScrollView>
            {(step === 'zone' ? zones : tags).map(item => (
              <TouchableOpacity key={item.id} onPress={() => { step === 'zone' ? setSelectedZone(item) : setSelectedTag(item); setStep('write'); }} style={[styles.overlayItem, { borderBottomColor: colors.separator }]}>
                <Text style={[styles.overlayText, { color: colors.text }]}>{item.name.toUpperCase()}</Text>
                <ChevronRight size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {step === 'poll' && (
        <View style={[styles.overlay, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={styles.overlayHeader}><Text style={[styles.overlayTitle, { color: colors.text }]}>CREATE POLL</Text><TouchableOpacity onPress={() => setStep('write')}><X size={24} color={colors.text} /></TouchableOpacity></View>
          <ScrollView style={{ padding: 20 }}>
            <TextInput placeholder="Poll Question" placeholderTextColor={colors.textTertiary} value={pollQuestion} onChangeText={setPollQuestion} style={[styles.pollInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
            {pollOptions.map((opt, i) => (
              <TextInput key={i} placeholder={`Option ${i+1}`} placeholderTextColor={colors.textTertiary} value={opt} onChangeText={(t) => { const n = [...pollOptions]; n[i] = t; setPollOptions(n); }} style={[styles.pollInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, marginTop: 10 }]} />
            ))}
            <TouchableOpacity onPress={() => { setHasPoll(true); setStep('write'); }} style={[styles.doneBtn, { backgroundColor: colors.primary, marginTop: 20 }]}><Text style={styles.doneBtnText}>ATTACH POLL</Text></TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  postBtnText: { fontWeight: '800' },
  scrollContent: { padding: 20 },
  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  pillLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
  pillValue: { fontSize: 11, fontWeight: '800' },
  titleInput: { marginBottom: 15, fontWeight: '800' },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  mediaItem: { width: 80, height: 80, position: 'relative' },
  mediaThumb: { width: '100%', height: '100%' },
  removeMedia: { position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  addMediaBtn: { width: 80, height: 80, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  successTitle: { fontSize: 32, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  successSubtitle: { fontSize: 16, marginBottom: 30 },
  doneBtn: { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 30 },
  doneBtnText: { color: '#FFF', fontWeight: '900', letterSpacing: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
  overlayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  overlayTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  overlayItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  overlayText: { fontSize: 16, fontWeight: '700' },
  pollPreview: { padding: 16, borderRadius: 16, borderWidth: 1, marginTop: 10 },
  pollHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pollQuestion: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  pollInput: { padding: 15, borderRadius: 12, borderWidth: 1, fontSize: 16 },
});
