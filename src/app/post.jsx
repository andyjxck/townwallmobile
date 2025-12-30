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
import { X, ChevronRight, Image as ImageIcon, Shield, BarChart2, Plus, ChevronLeft, WifiOff, MessageCircle, Users, Layout, Check } from "lucide-react-native";
import { getStoredUser } from "../utils/user";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import { moderateContent } from "../utils/ai";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { theme } from "../utils/theme";
import { useTheme } from "@/utils/ThemeContext";
import { RichTextEditor } from "../components/RichTextEditor";
import { offlineStorage, checkNetworkStatus } from "../utils/offline";
import { sendNewPostNotification } from "../utils/notifications";
import { useLocationStore } from "../utils/locationStore";
import { fetchZonesForCity } from "../utils/location";

export default function PostScreen() {
  const { isHippie } = useTheme();
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
  const [isOnline, setIsOnline] = useState(true);
  
  const [ctaType, setCtaType] = useState('none');
  const [ctaGroupId, setCtaGroupId] = useState(null);
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupIcon, setNewGroupIcon] = useState("👥");
  const [myGroups, setMyGroups] = useState([]);

  const { city_id, zone_id, feedView } = useLocationStore();


  useEffect(() => {
    checkNetworkStatus().then(setIsOnline);
    getDeviceId().then(setDeviceId);
    getStoredUser().then(setUser);
    fetchData();
    if (postId) fetchPostData();
    fetchMyGroups();
  }, [postId]);

  const fetchMyGroups = async () => {
    const storedUser = await getStoredUser();
    if (!storedUser) return;
    const { data } = await supabase
      .from('rchat_members')
      .select('chat_id, chat:rchats(*)')
      .eq('user_id', storedUser.id)
      .eq('chat.is_group', true);
    setMyGroups(data?.map(d => d.chat) || []);
  };

  const fetchPostData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('rposts').select('*').eq('id', postId).single();
      if (data) {
        const storedUser = await getStoredUser();
          if (data.user_id !== storedUser?.id) {
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
      city_id ? fetchZonesForCity(city_id) : supabase.from('rzones').select('*').order('name').then(r => r.data),
      supabase.from('rtags').select('*').order('name')
    ]);
    const zonesData = Array.isArray(zRes) ? zRes : (zRes?.data || []);
    setZones(zonesData);
    setTags(tRes.data || []);
    if (zonesData.length && !postId) {
      const defaultZone = zone_id ? zonesData.find(z => z.id === zone_id) : zonesData[0];
      setSelectedZone(defaultZone || zonesData[0]);
    }
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
    
    const online = await checkNetworkStatus();
    
    try {
      let moderation = { status: 'approved' };
      if (online) {
        moderation = await moderateContent(`${title}\n${text}`);
        if (moderation.status === 'rejected') {
          Alert.alert("Rejected", moderation.reason);
          setLoading(false); return;
        }
      }

const postData = {
          title: title.trim(),
          text: text.trim(),
          zone_id: selectedZone?.id,
          tag_id: selectedTag?.id,
          device_id: deviceId,
          user_id: user?.id,
          is_anonymous: isAnonymous,
          moderation_status: moderation.status,
          localMedia: media,
          city_id: city_id,
        };

      if (!online) {
        await offlineStorage.savePendingPost(postData);
        Alert.alert(
          "Saved Offline",
          "Your post has been saved and will be uploaded when you're back online.",
          [{ text: "OK", onPress: () => router.replace("/") }]
        );
        return;
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

const dbPostData = {
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
          city_id: city_id,
          cta_type: ctaType,
          cta_group_id: ctaGroupId,
        };

      if (postId) await supabase.from('rposts').update(dbPostData).eq('id', postId);
      else {
        const { data: newPost } = await supabase.from('rposts').insert(dbPostData).select('id').single();
        if (newPost && !isAnonymous) {
          await sendNewPostNotification({
            posterId: user.id,
            posterUsername: user.username,
            postId: newPost.id
          });
        }
      }

      router.replace("/");
    } catch (error) { Alert.alert("Error", "Failed to post"); }
    finally { setLoading(false); }
  };

  if (step === 'zone' || step === 'tag') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: isHippie ? 'transparent' : theme.colors.background }]}>
        <View style={[styles.overlayHeader, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.overlayTitle, { color: theme.colors.text }]}>Select {step.toUpperCase()}</Text>
          <TouchableOpacity onPress={() => setStep('write')}>
            <X size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.overlayList}>
          {(step === 'zone' ? zones : tags).map(item => (
            <TouchableOpacity 
              key={item.id} 
              onPress={() => { 
                step === 'zone' ? setSelectedZone(item) : setSelectedTag(item); 
                setStep('write'); 
              }} 
              style={[
                styles.item, 
                { borderBottomColor: theme.colors.border },
                (step === 'zone' ? selectedZone?.id : selectedTag?.id) === item.id && { backgroundColor: 'rgba(255,255,255,0.05)' }
              ]}
            >
              <Text style={[styles.itemText, { color: theme.colors.text }]}>{item.name}</Text>
              {(step === 'zone' ? selectedZone?.id : selectedTag?.id) === item.id && (
                <View style={styles.selectedDot} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert("Error", "Please enter a group name");
      return;
    }
    setLoading(true);
    try {
      const { data: chat, error } = await supabase
        .from('rchats')
        .insert({
          is_group: true,
          group_name: newGroupName.trim(),
          group_icon: newGroupIcon,
          status: 'accepted'
        })
        .select()
        .single();

      if (chat) {
        await supabase.from('rchat_members').insert({
          chat_id: chat.id,
          user_id: user.id,
          is_admin: true
        });
        setMyGroups([...myGroups, chat]);
        setCtaGroupId(chat.id);
        setShowGroupCreator(false);
        setNewGroupName("");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  if (step === 'cta') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: isHippie ? 'transparent' : theme.colors.background }]}>
        <View style={[styles.overlayHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => setStep('write')}>
            <ChevronLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.overlayTitle, { color: theme.colors.text }]}>Call to Action</Text>
          <TouchableOpacity onPress={() => setStep('write')}>
            <Check size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={[styles.label, { color: 'rgba(255,255,255,0.5)', marginTop: 0 }]}>Select Type</Text>
          <View style={styles.ctaTypeGrid}>
            {[
              { id: 'none', label: 'None', icon: X },
              { id: 'chat', label: 'Chat to me', icon: MessageCircle },
              { id: 'group', label: 'Join group', icon: Users },
            ].map(type => (
              <TouchableOpacity
                key={type.id}
                onPress={() => {
                  setCtaType(type.id);
                  if (type.id !== 'group') setCtaGroupId(null);
                }}
                style={[
                  styles.ctaTypeCard,
                  { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: theme.colors.border },
                  ctaType === type.id && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }
                ]}
              >
                <type.icon size={24} color={ctaType === type.id ? theme.colors.primary : "rgba(255,255,255,0.5)"} />
                <Text style={[styles.ctaTypeLabel, { color: ctaType === type.id ? theme.colors.primary : "rgba(255,255,255,0.7)" }]}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {ctaType === 'group' && (
            <View style={{ marginTop: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[styles.label, { color: 'rgba(255,255,255,0.5)', marginTop: 0 }]}>Link a Group</Text>
                <TouchableOpacity onPress={() => setShowGroupCreator(true)} style={styles.addGroupBtn}>
                  <Plus size={14} color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '700', marginLeft: 4 }}>New Group</Text>
                </TouchableOpacity>
              </View>

              {showGroupCreator ? (
                <View style={[styles.groupCreator, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: theme.colors.border }]}>
                  <View style={styles.groupCreatorHeader}>
                    <Text style={{ color: '#FFF', fontWeight: '700' }}>Create Group</Text>
                    <TouchableOpacity onPress={() => setShowGroupCreator(false)}>
                      <X size={16} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.groupInputRow}>
                    <TextInput
                      value={newGroupIcon}
                      onChangeText={setNewGroupIcon}
                      style={[styles.groupIconInput, { backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFF' }]}
                      placeholder="Icon"
                    />
                    <TextInput
                      value={newGroupName}
                      onChangeText={setNewGroupName}
                      style={[styles.groupNameInput, { backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFF' }]}
                      placeholder="Group Name"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                  <TouchableOpacity 
                    onPress={handleCreateGroup}
                    disabled={loading || !newGroupName.trim()}
                    style={[styles.groupCreateSubmit, { backgroundColor: theme.colors.primary }]}
                  >
                    {loading ? <ActivityIndicator size="small" color="#000" /> : <Text style={{ fontWeight: '800' }}>Create & Link</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.groupList}>
                  {myGroups.length === 0 ? (
                    <Text style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 20 }}>You haven't joined any groups yet</Text>
                  ) : (
                    myGroups.map(group => (
                      <TouchableOpacity
                        key={group.id}
                        onPress={() => setCtaGroupId(group.id)}
                        style={[
                          styles.groupItem,
                          { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: theme.colors.border },
                          ctaGroupId === group.id && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }
                        ]}
                      >
                        <Text style={styles.groupItemIcon}>{group.group_icon || '👥'}</Text>
                        <Text style={[styles.groupItemName, { color: '#FFF' }]}>{group.group_name}</Text>
                        {ctaGroupId === group.id && <Check size={18} color={theme.colors.primary} />}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>
          )}

          <TouchableOpacity 
            onPress={() => setStep('write')}
            style={[styles.saveCtaBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.saveCtaBtnText}>Apply CTA</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (step === 'poll') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: isHippie ? 'transparent' : theme.colors.background }]}>
        <View style={[styles.overlayHeader, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.overlayTitle, { color: theme.colors.text }]}>Add Poll</Text>
          <TouchableOpacity onPress={() => setStep('write')}>
            <X size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={[styles.label, { color: 'rgba(255,255,255,0.5)', marginTop: 0 }]}>Question</Text>
          <TextInput
            placeholder="What do you want to ask?"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={pollQuestion}
            onChangeText={setPollQuestion}
            style={[styles.pollInput, { color: theme.colors.text, backgroundColor: 'rgba(255,255,255,0.05)' }]}
          />

          <Text style={[styles.label, { color: 'rgba(255,255,255,0.5)' }]}>Options</Text>
          {pollOptions.map((opt, i) => (
            <View key={i} style={styles.pollOptionRow}>
              <TextInput
                placeholder={`Option ${i + 1}`}
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={opt}
                onChangeText={(val) => {
                  const newOpts = [...pollOptions];
                  newOpts[i] = val;
                  setPollOptions(newOpts);
                }}
                style={[styles.pollInput, { flex: 1, color: theme.colors.text, backgroundColor: 'rgba(255,255,255,0.05)' }]}
              />
              {pollOptions.length > 2 && (
                <TouchableOpacity 
                  onPress={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                  style={styles.removeOption}
                >
                  <X size={16} color={theme.colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          
          {pollOptions.length < 5 && (
            <TouchableOpacity 
              onPress={() => setPollOptions([...pollOptions, ""])}
              style={styles.addOptionBtn}
            >
              <Plus size={16} color={theme.colors.primary} />
              <Text style={[styles.addOptionText, { color: theme.colors.primary }]}>Add Option</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            onPress={() => {
              if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
                Alert.alert("Error", "Please provide a question and at least 2 options.");
                return;
              }
              setHasPoll(true);
              setStep('write');
            }}
            style={[styles.savePollBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.savePollBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {postId ? "Edit Post" : "Create Post"}
          </Text>
          {!isOnline && <WifiOff size={14} color={theme.colors.error} style={{ marginLeft: 6 }} />}
        </View>
        <TouchableOpacity 
          onPress={handlePost} 
          disabled={loading}
          style={[styles.publishBtn, { backgroundColor: theme.colors.primary }]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.publishBtnText}>
              {isOnline ? (postId ? "Update" : "Post") : "Save"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {!isOnline && (
        <View style={[styles.offlineBanner, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
          <WifiOff size={14} color={theme.colors.error} />
          <Text style={[styles.offlineBannerText, { color: theme.colors.error }]}>
            Offline Mode: Post will be synced later
          </Text>
        </View>
      )}

      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <View style={styles.topOptions}>
            {feedView !== "global" && (
              <TouchableOpacity 
                onPress={() => setStep('zone')} 
                style={[styles.option, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              >
                <Text style={styles.optionLabel}>In </Text>
                <Text style={[styles.optionValue, { color: theme.colors.primary }]}>
                  {selectedZone?.name || "Select Zone"}
                </Text>
                <ChevronRight size={14} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              onPress={() => setStep('tag')} 
              style={[styles.option, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
            >
              <Text style={styles.optionLabel}>As </Text>
              <Text style={[styles.optionValue, { color: theme.colors.primary }]}>
                {selectedTag?.name || "Select Tag"}
              </Text>
              <ChevronRight size={14} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsAnonymous(!isAnonymous);
              }}
              style={[
                styles.anonOption, 
                { backgroundColor: 'rgba(255,255,255,0.08)' },
                isAnonymous && { backgroundColor: theme.colors.primary }
              ]}
            >
              <Shield size={14} color={isAnonymous ? "#000" : "rgba(255,255,255,0.5)"} />
              <Text style={[
                styles.anonOptionText, 
                { color: "rgba(255,255,255,0.5)" },
                isAnonymous && { color: "#000" }
              ]}>
                Anon
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={() => setStep('cta')} 
            style={[styles.ctaOption, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: theme.colors.border }]}
          >
            <Layout size={20} color={ctaType !== 'none' ? theme.colors.primary : "rgba(255,255,255,0.5)"} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.ctaOptionTitle, { color: theme.colors.text }]}>
                {ctaType === 'none' ? "Add Call to Action" : ctaType === 'chat' ? "Chat Button" : "Group Button"}
              </Text>
              <Text style={styles.ctaOptionDesc}>
                {ctaType === 'none' ? "Help people get in touch" : ctaType === 'chat' ? "Adds a 'Chat to me' button" : "Adds a 'Join group' button"}
              </Text>
            </View>
            <ChevronRight size={20} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>

          <TextInput 
            placeholder="Give it a title..." 
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={title} 
            onChangeText={setTitle} 
            style={[styles.titleInput, { color: theme.colors.text }]} 
            multiline
          />
          
          <RichTextEditor 
            value={text} 
            onChange={setText} 
            placeholder="Share what's on your mind..." 
            onPollPress={() => setStep('poll')}
            minHeight={300}
          />

          <View style={styles.mediaSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaScroll}>
              {media.map((m, i) => (
                <View key={i} style={styles.mediaWrapper}>
                  <Image source={{ uri: m.uri }} style={styles.mediaThumb} />
                  <TouchableOpacity 
                    style={styles.removeMedia}
                    onPress={() => setMedia(media.filter((_, idx) => idx !== i))}
                  >
                    <X size={12} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={pickMedia} style={[styles.addMedia, { borderColor: theme.colors.border }]}>
                <Plus size={24} color="rgba(255,255,255,0.5)" />
                <Text style={styles.addMediaText}>Add Media</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingBottom: 12, 
    borderBottomWidth: 1 
  },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  closeBtn: { padding: 4 },
  publishBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center'
  },
  publishBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  offlineBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8, 
    paddingVertical: 8
  },
  offlineBannerText: { fontSize: 12, fontWeight: '600' },
  scrollView: { flex: 1 },
  form: { padding: 16 },
  topOptions: { 
    flexDirection: 'row', 
    gap: 8, 
    marginBottom: 20, 
    flexWrap: 'wrap' 
  },
  option: { 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 12,
    gap: 4
  },
  optionLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  optionValue: { fontWeight: '700', fontSize: 13 },
  anonOption: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 12 
  },
  anonOptionText: { fontSize: 13, fontWeight: '700' },
  titleInput: { 
    fontSize: 28, 
    fontWeight: '800', 
    marginBottom: 16,
    letterSpacing: -0.5
  },
  mediaSection: { marginTop: 20 },
  mediaScroll: { gap: 12 },
  mediaWrapper: { position: 'relative' },
  mediaThumb: { width: 100, height: 100, borderRadius: 12 },
  removeMedia: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000'
  },
  addMedia: { 
    width: 100, 
    height: 100, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderStyle: 'dashed'
  },
  addMediaText: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, fontWeight: '600' },
  overlayHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 20, 
    borderBottomWidth: 1 
  },
  overlayTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  overlayList: { paddingVertical: 10 },
  item: { 
    padding: 20, 
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  ctaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  ctaOptionTitle: { fontSize: 16, fontWeight: '700' },
  ctaOptionDesc: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  ctaTypeGrid: { flexDirection: 'row', gap: 12, marginTop: 8 },
  ctaTypeCard: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 8 },
  ctaTypeLabel: { fontSize: 13, fontWeight: '600' },
  addGroupBtn: { flexDirection: 'row', alignItems: 'center' },
  groupCreator: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  groupCreatorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupInputRow: { flexDirection: 'row', gap: 8 },
  groupIconInput: { width: 50, height: 44, borderRadius: 12, textAlign: 'center', fontSize: 20 },
  groupNameInput: { flex: 1, height: 44, borderRadius: 12, paddingHorizontal: 12 },
  groupCreateSubmit: { padding: 12, borderRadius: 12, alignItems: 'center' },
  groupList: { gap: 8 },
  groupItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
  groupItemIcon: { fontSize: 24, marginRight: 12 },
  groupItemName: { flex: 1, fontSize: 15, fontWeight: '600' },
  saveCtaBtn: { marginTop: 32, padding: 18, borderRadius: 30, alignItems: 'center' },
  saveCtaBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  itemText: { fontSize: 17, fontWeight: '500' },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF'
  },
  label: { fontSize: 13, fontWeight: '700', marginTop: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  pollInput: { padding: 16, borderRadius: 12, fontSize: 16, marginBottom: 12 },
  pollOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  removeOption: { padding: 10 },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  addOptionText: { fontSize: 14, fontWeight: '700' },
  savePollBtn: { marginTop: 40, padding: 18, borderRadius: 30, alignItems: 'center' },
  savePollBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
});
