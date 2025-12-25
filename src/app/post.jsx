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
import { X, ChevronRight, Image as ImageIcon, Trash2, Shield, User, Play } from "lucide-react-native";
import { getStoredUser } from "../utils/user";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import { moderateContent } from "../utils/ai";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { LinearGradient } from "expo-linear-gradient";

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
  const [step, setStep] = useState('write'); // 'write' | 'zone' | 'tag' | 'success'
  const [media, setMedia] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [user, setUser] = useState(null);

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

        const postData = {
          title: title.trim() || text.substring(0, 50),
          text: text.trim(),
          zone_id: selectedZone?.id,
          tag_id: selectedTag.id,
          device_id: deviceId,
          user_id: user?.id,
          is_anonymous: isAnonymous,
          image_url: imageUrls.length > 0 ? imageUrls[0] : null,
          image_urls: imageUrls,
          media_type: postMediaType,
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.quickInfoRow}>
              <TouchableOpacity
                onPress={() => setStep('zone')}
                style={styles.pillButton}
              >
                <Text style={styles.pillText}>{selectedZone?.name?.toUpperCase() || 'SELECT ZONE'}</Text>
                <ChevronRight size={12} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setStep('tag')}
                style={styles.pillButton}
              >
                <Text style={styles.pillText}>{selectedTag?.name?.toUpperCase() || 'SELECT TAG'}</Text>
                <ChevronRight size={12} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsAnonymous(!isAnonymous);
                }}
                style={[styles.pillButton, !isAnonymous && styles.pillActive]}
              >
                {isAnonymous ? (
                  <Shield size={12} color="rgba(255,255,255,0.4)" />
                ) : (
                  <User size={12} color="#000000" />
                )}
                <Text style={[styles.pillText, !isAnonymous && { color: '#000000' }]}>
                  {isAnonymous ? 'ANONYMOUS' : (user?.username?.toUpperCase() || 'PUBLIC')}
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              autoFocus
              placeholder="Post Title"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              style={styles.titleInput}
            />

            <TextInput
              multiline
              placeholder="What's happening?"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={text}
              onChangeText={setText}
              maxLength={2000}
              style={styles.bodyInput}
            />

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

              <TouchableOpacity 
                onPress={pickMedia}
                style={styles.addImageButton}
              >
                <ImageIcon size={24} color="rgba(255,255,255,0.3)" />
                <Text style={styles.addImageText}>ADD MEDIA</Text>
              </TouchableOpacity>
            </ScrollView>
          </ScrollView>
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
    paddingBottom: 40,
  },
  quickInfoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 30,
    flexWrap: 'wrap',
  },
  pillButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillActive: {
    backgroundColor: '#FFFFFF',
  },
  pillText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  titleInput: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 15,
    letterSpacing: -0.5,
  },
  bodyInput: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 28,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  imageGrid: {
    gap: 12,
    marginTop: 30,
  },
  imageWrapper: {
    position: 'relative',
    width: 140,
    height: 140,
  },
  previewImage: {
    width: 140,
    height: 140,
    borderRadius: 15,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageButton: {
    width: 140,
    height: 140,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addImageText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    marginTop: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
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
});
