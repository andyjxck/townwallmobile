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
import { useRouter } from "expo-router";
import { X, ChevronRight, Image as ImageIcon, Trash2, Shield, User } from "lucide-react-native";
import { getStoredUser } from "../utils/user";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { LinearGradient } from "expo-linear-gradient";

export default function PostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [zones, setZones] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [step, setStep] = useState('write'); // 'write' | 'zone' | 'tag' | 'success'
  const [images, setImages] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    getStoredUser().then(setUser);
    fetchData();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        // Silent fail or alert? Let's alert to help user
        // alert('Sorry, we need camera roll permissions to make this work!');
      }
    }
  };

  const fetchData = async () => {
    const { data: zData } = await supabase.from('rzones').select('*').order('name');
    const { data: tData } = await supabase.from('rtags').select('*').order('name');
    setZones(zData || []);
    setTags(tData || []);
    // Default to Town Centre if available
    if (zData) {
      const townCentre = zData.find(z => z.slug === 'town-centre');
      if (townCentre) setSelectedZone(townCentre);
    }
  };

  const pickImage = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImages([...images, ...result.assets]);
      }
    } catch (error) {
      console.error("ImagePicker Error:", error);
      alert("Could not open image library.");
    }
  };

  const handlePost = async () => {
    if (!title || !text || !selectedZone || !selectedTag || !deviceId) return;
    setLoading(true);

    try {
      const imageUrls = [];
      
      for (const img of images) {
        const fileExt = img.uri.split('.').pop()?.toLowerCase() || 'jpg';
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
          xhr.open("GET", img.uri, true);
          xhr.send(null);
        });

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, arrayBuffer, {
            contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('posts')
          .getPublicUrl(filePath);
        
        imageUrls.push(publicUrlData.publicUrl);
      }

      const { error } = await supabase.from('rposts').insert({
        title: title.trim(),
        text: text.trim(),
        zone_id: selectedZone.id,
        tag_id: selectedTag.id,
        device_id: deviceId,
        user_id: user?.id,
        is_anonymous: isAnonymous,
        image_url: imageUrls.length > 0 ? imageUrls[0] : null,
        image_urls: imageUrls,
        expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 hours
      });

      if (error) throw error;
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
            <Text style={styles.headerTitle}>NEW POST</Text>
            <TouchableOpacity
              onPress={handlePost}
              disabled={!text || !selectedTag || loading}
              style={[styles.headerButton, { opacity: (!text || !selectedTag || loading) ? 0.3 : 1 }]}
            >
              <Text style={styles.postActionText}>
                {loading ? "..." : "POST"}
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
              {images.map((img, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri: img.uri }} style={styles.previewImage} />
                  <TouchableOpacity 
                    onPress={() => {
                      const newImages = [...images];
                      newImages.splice(index, 1);
                      setImages(newImages);
                    }}
                    style={styles.removeImageButton}
                  >
                    <X size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity 
                onPress={pickImage}
                style={styles.addImageButton}
              >
                <ImageIcon size={24} color="rgba(255,255,255,0.3)" />
                <Text style={styles.addImageText}>ADD IMAGE</Text>
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
