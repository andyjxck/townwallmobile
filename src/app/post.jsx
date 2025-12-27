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
  Image,
  StyleSheet,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X, ChevronRight, Image as ImageIcon, Trash2, Shield, User, Play, BarChart2, Plus, Minus } from "lucide-react-native";
import { getStoredUser } from "../utils/user";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import { moderateContent } from "../utils/ai";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { LinearGradient } from "expo-linear-gradient";
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
  const [step, setStep] = useState('write'); // 'write' | 'zone' | 'tag' | 'success' | 'poll'
  const [media, setMedia] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [user, setUser] = useState(null);

  // Poll state
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [hasPoll, setHasPoll] = useState(false);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    getStoredUser().then(setUser);
    fetchData();
    requestPermissions();

    if (postId) {
      fetchPostData();
    }
  }, [postId]);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        // No-op for now
      }
    }
  };

  const fetchPostData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rposts')
        .select('*')
        .eq('id', postId)
        .single();
      
      if (error) throw error;
      if (data) {
        setTitle(data.title || "");
        setText(data.text || "");
        setIsAnonymous(data.is_anonymous);
        if (data.image_urls) {
          setMedia(data.image_urls.map(url => ({ 
            uri: url, 
            fromRemote: true, 
            type: data.media_type || 'image' 
          })));
        } else if (data.image_url) {
          setMedia([{ 
            uri: data.image_url, 
            fromRemote: true, 
            type: data.media_type || 'image' 
          }]);
        }
        
        // Match zone and tag after they are fetched in fetchData
      }
    } catch (error) {
      console.error("Error fetching post for edit:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    const { data: zData } = await supabase.from('rzones').select('*').order('name');
    const { data: tData } = await supabase.from('rtags').select('*').order('name');
    setZones(zData || []);
    setTags(tData || []);
    
    if (postId) {
      // Re-fetch post to ensure we have IDs for zone/tag matching
      const { data: post } = await supabase.from('rposts').select('zone_id, tag_id').eq('id', postId).single();
      if (post) {
        if (zData && post.zone_id) {
          const zone = zData.find(z => z.id === post.zone_id);
          if (zone) setSelectedZone(zone);
        }
        if (tData && post.tag_id) {
          const tag = tData.find(t => t.id === post.tag_id);
          if (tag) setSelectedTag(tag);
        }
      }
    } else if (zData) {
      const townCentre = zData.find(z => z.slug === 'town-centre');
      if (townCentre) setSelectedZone(townCentre);
    }
  };

  const pickMedia = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setMedia([...media, ...result.assets]);
      }
    } catch (error) {
      console.error("ImagePicker Error:", error);
      alert("Could not open media library.");
    }
  };

  const [uploadProgress, setUploadProgress] = useState(0);

  const handlePost = async () => {
    if (!text || !selectedTag || !deviceId) return;
    setLoading(true);
    setUploadProgress(0.05);

    try {
      const user = await getStoredUser();
      
      // Check if muted
      const { data: userData } = await supabase
        .from('rusers')
        .select('is_muted')
        .eq('id', user?.id)
        .single();
      
      if (userData?.is_muted) {
        alert("Your account is muted. You cannot create new posts at this time.");
        setLoading(false);
        return;
      }

      // AI Moderation
      const moderation = await moderateContent(`${title}\n${text}`);
      if (moderation.status === 'rejected') {
        alert(`Your post does not meet community standards: ${moderation.reason}`);
        setLoading(false);
        return;
      }

      // Poll Creation logic
      let createdPollId = null;
      if (hasPoll && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2) {
        const { data: poll, error: pollError } = await supabase
          .from('rpolls')
          .insert({
            question: pollQuestion.trim(),
            is_active: true
          })
          .select()
          .single();

        if (pollError) throw pollError;
        createdPollId = poll.id;

        const optionsToInsert = pollOptions
          .filter(o => o.trim())
          .map(o => ({
            poll_id: createdPollId,
            option_text: o.trim()
          }));

        const { error: optionsError } = await supabase
          .from('rpoll_options')
          .insert(optionsToInsert);

        if (optionsError) throw optionsError;
      }

      const imageUrls = [];
      let postMediaType = 'image';
      let currentIdx = 0;
      
      for (const item of media) {
        setUploadProgress(0.1 + (currentIdx / media.length) * 0.8);
        
        if (item.fromRemote) {
          imageUrls.push(item.uri);
          if (item.type === 'video') postMediaType = 'video';
          currentIdx++;
          continue;
        }

        if (item.type === 'video') postMediaType = 'video';

        const fileExt = item.uri.split('.').pop()?.toLowerCase() || (item.type === 'video' ? 'mp4' : 'jpg');
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        const arrayBuffer = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.onload = function () {
            resolve(xhr.response);
          };
          xhr.onerror = function (e) {
            console.error("XHR Error:", e);
            reject(new TypeError("Network request failed"));
          };
          xhr.responseType = "arraybuffer";
          xhr.open("GET", item.uri, true);
          xhr.send(null);
        });

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, arrayBuffer, {
            contentType: item.type === 'video' ? `video/${fileExt}` : `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('posts')
          .getPublicUrl(filePath);
        
        imageUrls.push(publicUrlData.publicUrl);
        currentIdx++;
      }

      setUploadProgress(0.9);

      // Clean HTML from rich text editor
      const cleanedText = text.trim()
        .replace(/(&nbsp;)+$/, '') // Remove trailing &nbsp;
        .replace(/(<br\s*\/?>)+$/, '') // Remove trailing <br>
        .replace(/<p>(&nbsp;|\s|<br\s*\/?>)*<\/p>$/, '') // Remove empty trailing paragraphs
        .trim();

      const postData = {
        title: title.trim() || cleanedText.replace(/<[^>]*>?/gm, '').substring(0, 50),
        text: cleanedText,
        zone_id: selectedZone?.id,
        tag_id: selectedTag.id,
        device_id: deviceId,
        user_id: user?.id,
        is_anonymous: isAnonymous,
        image_url: imageUrls.length > 0 ? imageUrls[0] : null,
        image_urls: imageUrls,
        media_type: postMediaType,
        poll_id: createdPollId,
        moderation_status: moderation.status,
        moderation_reason: moderation.reason,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (postId) {
        result = await supabase
          .from('rposts')
          .update(postData)
          .eq('id', postId);
      } else {
        result = await supabase
          .from('rposts')
          .insert({
            ...postData,
          });
      }

        if (result.error) throw result.error;
        setUploadProgress(1);
        Haptics.notificationAsync(Haptics.ImpactFeedbackStyle.Light);
        
        if (moderation.status === 'held') {
          Alert.alert("Post Under Review", "Your post has been held for manual moderation to ensure community safety. It will appear once approved.");
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        setStep('success');

    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to post. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  if (step === 'success') {
    return (
      <View style={styles.successContainer}>
        <LinearGradient
          colors={['#0F172A', '#000000', '#000000']}
          style={StyleSheet.absoluteFill}
        />
        <StatusBar style="light" />
        <View style={styles.successContent}>
          <Text style={styles.successTitle}>POSTED</Text>
          <Text style={styles.successSubtitle}>
            Your message is now live in {selectedZone?.name}.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/")}
            style={styles.doneButton}
          >
            <Text style={styles.doneButtonText}>DONE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#000000', '#000000']}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={{ paddingTop: insets.top + 10, flex: 1 }}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.headerTitle}>{postId ? 'EDIT POST' : 'NEW POST'}</Text>
                {loading && (
                  <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${uploadProgress * 100}%` }]} />
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={handlePost}
                disabled={!text || !selectedTag || loading}
                style={[styles.headerButton, { opacity: (!text || !selectedTag || loading) ? 0.3 : 1 }]}
              >
                <Text style={styles.postActionText}>
                  {loading ? "..." : (postId ? "UPDATE" : "POST")}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.metaRow}>
                <TouchableOpacity
                  onPress={() => setStep('zone')}
                  style={styles.metaPill}
                >
                  <Text style={styles.metaPillLabel}>ZONE</Text>
                  <Text style={styles.metaPillValue}>{selectedZone?.name?.toUpperCase() || 'SELECT'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep('tag')}
                  style={styles.metaPill}
                >
                  <Text style={styles.metaPillLabel}>TAG</Text>
                  <Text style={styles.metaPillValue}>{selectedTag?.name?.toUpperCase() || 'SELECT'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsAnonymous(!isAnonymous);
                  }}
                  style={[styles.metaPill, !isAnonymous && styles.metaPillActive]}
                >
                  <Text style={[styles.metaPillLabel, !isAnonymous && { color: 'rgba(0,0,0,0.5)' }]}>POST AS</Text>
                  <View style={styles.metaPillValueContainer}>
                    {isAnonymous ? (
                      <Shield size={10} color="#FFFFFF" style={{ marginRight: 4 }} />
                    ) : (
                      <User size={10} color="#000000" style={{ marginRight: 4 }} />
                    )}
                    <Text style={[styles.metaPillValue, !isAnonymous && { color: '#000000' }]}>
                      {isAnonymous ? 'ANONYMOUS' : (user?.username?.toUpperCase() || 'PUBLIC')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder="Post Title"
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
                style={styles.titleInput}
              />

                <RichTextEditor
                  value={text}
                  onChange={setText}
                  placeholder="What's happening?"
                  onPollPress={() => setStep('poll')}
                  minHeight={350}
                />

                {hasPoll && (
                  <View style={styles.pollPreview}>
                    <View style={styles.pollPreviewHeader}>
                      <BarChart2 size={16} color="#3B82F6" />
                      <Text style={styles.pollPreviewTitle}>INTEGRATED POLL</Text>
                      <TouchableOpacity onPress={() => {
                        setHasPoll(false);
                        setPollQuestion("");
                        setPollOptions(["", ""]);
                      }}>
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.pollPreviewQuestion}>{pollQuestion || "No question set"}</Text>
                    {pollOptions.filter(o => o.trim()).map((opt, i) => (
                      <View key={i} style={styles.pollPreviewOption}>
                        <View style={styles.pollPreviewOptionDot} />
                        <Text style={styles.pollPreviewOptionText}>{opt}</Text>
                      </View>
                    ))}
                    <TouchableOpacity 
                      style={styles.pollEditButton}
                      onPress={() => setStep('poll')}
                    >
                      <Text style={styles.pollEditButtonText}>EDIT POLL</Text>
                    </TouchableOpacity>
                  </View>
                )}


              {media.length > 0 && (
                <View style={styles.mediaContainer}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.imageGrid}
                  >
                    {media.map((item, index) => (
                      <View key={index} style={styles.imageWrapper}>
                        {item.type === 'video' ? (
                          <View style={[styles.previewImage, { backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' }]}>
                            <Play size={32} color="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.1)" />
                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', marginTop: 5 }}>VIDEO</Text>
                          </View>
                        ) : (
                          <Image source={{ uri: item.uri }} style={styles.previewImage} />
                        )}
                        <TouchableOpacity 
                          onPress={() => {
                            const newMedia = [...media];
                            newMedia.splice(index, 1);
                            setMedia(newMedia);
                          }}
                          style={styles.removeImageButton}
                        >
                          <X size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>

            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <TouchableOpacity 
                onPress={pickMedia}
                style={styles.bottomBarButton}
              >
                <ImageIcon size={20} color="#FFFFFF" />
                <Text style={styles.bottomBarButtonText}>ADD MEDIA</Text>
              </TouchableOpacity>
              
              <View style={{ flex: 1 }} />
              
              <Text style={styles.charCount}>
                {text.length} characters
              </Text>
            </View>
          </View>


        {/* Zone Picker Overlay */}
        {step === 'zone' && (
          <View style={[styles.overlay, { paddingTop: insets.top }]}>
            <View style={styles.overlayHeader}>
              <Text style={styles.overlayTitle}>SELECT ZONE</Text>
              <TouchableOpacity onPress={() => setStep('write')}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {zones.map(z => (
                <TouchableOpacity
                  key={z.id}
                  onPress={() => {
                    setSelectedZone(z);
                    setStep('write');
                  }}
                  style={styles.overlayItem}
                >
                  <Text style={[styles.overlayItemText, selectedZone?.id === z.id && styles.overlayItemActive]}>
                    {z.name.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

          {/* Poll Picker Overlay */}
          {step === 'poll' && (
            <View style={[styles.overlay, { paddingTop: insets.top }]}>
              <View style={styles.overlayHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <BarChart2 size={24} color="#3B82F6" />
                  <Text style={styles.overlayTitle}>CREATE POLL</Text>
                </View>
                <TouchableOpacity onPress={() => setStep('write')}>
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                style={{ flex: 1, padding: 25 }}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.pollLabel}>POLL QUESTION</Text>
                <TextInput
                  style={styles.pollInput}
                  placeholder="What do you want to ask?"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                  multiline
                  maxLength={100}
                />

                <Text style={styles.pollLabel}>OPTIONS (MIN 2)</Text>
                {pollOptions.map((opt, idx) => (
                  <View key={idx} style={styles.pollOptionWrapper}>
                    <TextInput
                      style={styles.pollOptionInput}
                      placeholder={`Option ${idx + 1}`}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={opt}
                      onChangeText={(text) => {
                        const newOpts = [...pollOptions];
                        newOpts[idx] = text;
                        setPollOptions(newOpts);
                      }}
                      maxLength={50}
                    />
                    {pollOptions.length > 2 && (
                      <TouchableOpacity 
                        onPress={() => {
                          const newOpts = [...pollOptions];
                          newOpts.splice(idx, 1);
                          setPollOptions(newOpts);
                        }}
                        style={styles.removeOptionBtn}
                      >
                        <Minus size={16} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {pollOptions.length < 5 && (
                  <TouchableOpacity 
                    style={styles.addPollOptionBtn} 
                    onPress={() => setPollOptions([...pollOptions, ''])}
                  >
                    <Plus size={16} color="#4ADE80" />
                    <Text style={styles.addPollOptionText}>ADD OPTION</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={[
                    styles.savePollBtn, 
                    (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) && { opacity: 0.5 }
                  ]}
                  onPress={() => {
                    if (pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2) {
                      setHasPoll(true);
                      setStep('write');
                    }
                  }}
                  disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                >
                  <Text style={styles.savePollBtnText}>ATTACH TO POST</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.cancelPollBtn}
                  onPress={() => {
                    setHasPoll(false);
                    setPollQuestion("");
                    setPollOptions(["", ""]);
                    setStep('write');
                  }}
                >
                  <Text style={styles.cancelPollBtnText}>REMOVE POLL</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* Tag Picker Overlay */}

        {step === 'tag' && (
          <View style={[styles.overlay, { paddingTop: insets.top }]}>
            <View style={styles.overlayHeader}>
              <Text style={styles.overlayTitle}>SELECT TAG</Text>
              <TouchableOpacity onPress={() => setStep('write')}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {tags.map(t => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => {
                    setSelectedTag(t);
                    setStep('write');
                  }}
                  style={styles.overlayItem}
                >
                  <Text style={[styles.overlayItemText, selectedTag?.id === t.id && styles.overlayItemActive]}>
                    #{t.name.toUpperCase().replace(/\s+/g, '')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  successContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  successContent: {
    alignItems: 'center',
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 2,
  },
  successSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  doneButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 50,
    paddingVertical: 18,
    borderRadius: 30,
  },
  doneButtonText: {
    color: '#000000',
    fontWeight: '900',
    letterSpacing: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  progressContainer: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 4,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    padding: 5,
    minWidth: 40,
  },
  postActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 100,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 25,
    flexWrap: 'wrap',
  },
  metaPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  metaPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  metaPillLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  metaPillValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metaPillValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleInput: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  mediaContainer: {
    marginTop: 20,
  },
  imageGrid: {
    gap: 10,
    paddingRight: 20,
  },
  imageWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  bottomBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  bottomBarButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  charCount: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 1000,
  },
  overlayHeader: {
    padding: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overlayTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  overlayItem: {
    paddingHorizontal: 25,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  overlayItemText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
    overlayItemActive: {
      color: '#FFFFFF',
    },
    pollPreview: {
      backgroundColor: 'rgba(59, 130, 246, 0.05)',
      borderRadius: 20,
      padding: 20,
      marginTop: 20,
      borderWidth: 1,
      borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    pollPreviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
      gap: 10,
    },
    pollPreviewTitle: {
      color: '#3B82F6',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 2,
      flex: 1,
    },
    pollPreviewQuestion: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 15,
    },
    pollPreviewOption: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      backgroundColor: 'rgba(255,255,255,0.03)',
      padding: 12,
      borderRadius: 12,
    },
    pollPreviewOptionDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.2)',
      marginRight: 12,
    },
    pollPreviewOptionText: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 14,
      fontWeight: '600',
    },
    pollEditButton: {
      marginTop: 10,
      alignSelf: 'flex-start',
    },
    pollEditButtonText: {
      color: '#3B82F6',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
    },
    pollLabel: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      marginBottom: 10,
      marginTop: 20,
    },
    pollInput: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 12,
      padding: 15,
      color: '#FFFFFF',
      fontSize: 16,
      minHeight: 80,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    pollOptionWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      gap: 10,
    },
    pollOptionInput: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 12,
      padding: 15,
      color: '#FFFFFF',
      fontSize: 15,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    removeOptionBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    addPollOptionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 15,
    },
    addPollOptionText: {
      color: '#4ADE80',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1,
    },
    savePollBtn: {
      backgroundColor: '#3B82F6',
      paddingVertical: 18,
      borderRadius: 16,
      alignItems: 'center',
      marginTop: 30,
    },
    savePollBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 2,
    },
    cancelPollBtn: {
      paddingVertical: 18,
      alignItems: 'center',
      marginTop: 10,
    },
    cancelPollBtnText: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
    },
  });

