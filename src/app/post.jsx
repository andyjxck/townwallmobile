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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X, ChevronRight, Image as ImageIcon, Shield, BarChart2, Plus, ChevronLeft } from "lucide-react-native";
import { getStoredUser } from "../utils/user";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import { moderateContent } from "../utils/ai";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { theme } from "../utils/theme";
import { RichTextEditor } from "../components/RichTextEditor";

export default function PostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const postId = params.id;

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [zones, setZones] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [step, setStep] = useState('write');
  const [media, setMedia] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [user, setUser] = useState(null);

  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [hasPoll, setHasPoll] = useState(false);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    getStoredUser().then(setUser);
    fetchData();
    if (postId) fetchPostData();
  }, [postId]);

  const fetchPostData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('rposts').select('*').eq('id', postId).single();
      if (data) {
        const storedUser = await getStoredUser();
        if (data.user_id !== storedUser?.id && !storedUser?.is_admin) {
          Alert.alert("Permission Denied", "You cannot edit someone else's post.");
          router.replace("/");
          return;
        }
        setTitle(data.title || "");
        setText(data.text || "");
        setIsAnonymous(data.is_anonymous);
        if (data.image_urls) setMedia(data.image_urls.map(url => ({ uri: url, fromRemote: true, type: data.media_type || 'image' })));
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
    if (zRes.data && !postId) setSelectedZone(zRes.data[0]);
  };

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled) setMedia([...media, ...result.assets]);
  };

  const handlePost = async () => {
    if (!text || !selectedTag || !deviceId) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      const moderation = await moderateContent(`${title}\n${text}`);
      if (moderation.status === 'rejected') {
        Alert.alert("Rejected", moderation.reason);
        setLoading(false); return;
      }

      let createdPollId = null;
      if (hasPoll) {
        const { data: poll } = await supabase.from('rpolls').insert({ question: pollQuestion.trim(), is_active: true }).select().single();
        createdPollId = poll.id;
        await supabase.from('rpoll_options').insert(pollOptions.filter(o => o.trim()).map(o => ({ poll_id: poll.id, option_text: o.trim() })));
      }

      const imageUrls = [];
      for (const item of media) {
        if (item.fromRemote) { imageUrls.push(item.uri); continue; }
        const fileExt = item.uri.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const arrayBuffer = await (await fetch(item.uri)).arrayBuffer();
        await supabase.storage.from('posts').upload(fileName, arrayBuffer);
        imageUrls.push(supabase.storage.from('posts').getPublicUrl(fileName).data.publicUrl);
      }

      const postData = {
        title: title.trim(),
        text: text.trim(),
        zone_id: selectedZone?.id,
        tag_id: selectedTag?.id,
        device_id: deviceId,
        user_id: user?.id,
        is_anonymous: isAnonymous,
        image_url: imageUrls[0] || null,
        image_urls: imageUrls,
        poll_id: createdPollId,
        moderation_status: moderation.status,
      };

      if (postId) await supabase.from('rposts').update(postData).eq('id', postId);
      else await supabase.from('rposts').insert(postData);

      router.replace("/");
    } catch (error) { Alert.alert("Error", "Failed to post"); }
    finally { setLoading(false); }
  };

  if (step === 'zone' || step === 'tag') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.overlayHeader}>
          <Text style={styles.overlayTitle}>Select {step.toUpperCase()}</Text>
          <TouchableOpacity onPress={() => setStep('write')}><X size={24} color="#000" /></TouchableOpacity>
        </View>
        <ScrollView>
          {(step === 'zone' ? zones : tags).map(item => (
            <TouchableOpacity key={item.id} onPress={() => { step === 'zone' ? setSelectedZone(item) : setSelectedTag(item); setStep('write'); }} style={styles.item}>
              <Text style={styles.itemText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()}><X size={24} color="#000" /></TouchableOpacity>
        <Text style={styles.headerTitle}>{postId ? "Edit Post" : "New Post"}</Text>
        <TouchableOpacity onPress={handlePost} disabled={loading}><Text style={[styles.postBtn, { color: theme.colors.primary }]}>Post</Text></TouchableOpacity>
      </View>

        <View style={styles.form}>
          <View style={styles.topOptions}>
            <TouchableOpacity onPress={() => setStep('zone')} style={styles.option}>
              <Text style={styles.optionLabel}>Zone: </Text>
              <Text style={styles.optionValue}>{selectedZone?.name || "Select"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('tag')} style={styles.option}>
              <Text style={styles.optionLabel}>Tag: </Text>
              <Text style={styles.optionValue}>{selectedTag?.name || "Select"}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsAnonymous(!isAnonymous);
              }}
              style={[styles.anonOption, isAnonymous && styles.anonOptionActive]}
            >
              <Shield size={14} color={isAnonymous ? "#FFF" : "#666"} />
              <Text style={[styles.anonOptionText, isAnonymous && styles.anonOptionTextActive]}>Anon</Text>
            </TouchableOpacity>
          </View>

          <TextInput placeholder="Title" value={title} onChangeText={setTitle} style={styles.titleInput} />
            <RichTextEditor value={text} onChange={setText} placeholder="What's happening?" onPollPress={() => setStep('poll')} />

            <View style={styles.mediaSection}>
            {media.map((m, i) => <Image key={i} source={{ uri: m.uri }} style={styles.mediaThumb} />)}
            <TouchableOpacity onPress={pickMedia} style={styles.addMedia}><Plus size={24} color="#666" /></TouchableOpacity>
          </View>
        </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  postBtn: { fontSize: 16, fontWeight: 'bold' },
  form: { padding: 20, flex: 1 },
  topOptions: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  option: { flexDirection: 'row', backgroundColor: '#F5F5F5', padding: 8, borderRadius: 8 },
  optionLabel: { color: '#666' },
  optionValue: { fontWeight: 'bold' },
  anonOption: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5F5F5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  anonOptionActive: { backgroundColor: theme.colors.primary },
  anonOptionText: { fontSize: 13, fontWeight: '600', color: '#666' },
    anonOptionTextActive: { color: '#000' },
  titleInput: { fontSize: 24, fontWeight: 'bold', marginBottom: 15 },
  mediaSection: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 20 },
  mediaThumb: { width: 80, height: 80, borderRadius: 8 },
  addMedia: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CCC' },
  overlayHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  overlayTitle: { fontSize: 18, fontWeight: 'bold' },
  item: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  itemText: { fontSize: 16 },
});
