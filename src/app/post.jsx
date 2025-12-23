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
import { X, ChevronRight, Image as ImageIcon, Trash2 } from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

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
    const [image, setImage] = useState(null);
  
    useEffect(() => {
      getDeviceId().then(setDeviceId);
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
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
  
        if (!result.canceled && result.assets && result.assets.length > 0) {
          setImage(result.assets[0]);
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
        let imageUrl = null;
          if (image) {
            const fileExt = image.uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            // Use XMLHttpRequest to get an ArrayBuffer from local URI - very robust in RN
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
              xhr.open("GET", image.uri, true);
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
        
        imageUrl = publicUrlData.publicUrl;
      }

      const { error } = await supabase.from('rposts').insert({
        title: title.trim(),
        text: text.trim(),
        zone_id: selectedZone.id,
        tag_id: selectedTag.id,
        device_id: deviceId,
        is_anonymous: true,
        image_url: imageUrl,
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
      <View style={{ flex: 1, backgroundColor: "#000000", justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <StatusBar style="light" />
        <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginBottom: 16, textAlign: 'center' }}>POSTED</Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, textAlign: 'center', marginBottom: 40 }}>
          Your message is now live in {selectedZone?.name}.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/")}
          style={{
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 40,
            paddingVertical: 15,
            borderRadius: 30,
          }}
        >
          <Text style={{ color: '#000000', fontWeight: '700' }}>DONE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#000000" }}
    >
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 10, flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePost}
            disabled={!text || !selectedTag || loading}
            style={{
              opacity: (!text || !selectedTag || loading) ? 0.3 : 1
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
              {loading ? "..." : "POST"}
            </Text>
          </TouchableOpacity>
        </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20 }}>
            {/* Quick Info Bar */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TouchableOpacity
                onPress={() => setStep('zone')}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 15,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{selectedZone?.name || 'Select Zone'}</Text>
                <ChevronRight size={12} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setStep('tag')}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 15,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{selectedTag?.name || 'Select Tag'}</Text>
                <ChevronRight size={12} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            </View>

            <TextInput
              autoFocus
              placeholder="Title"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              style={{
                color: '#FFFFFF',
                fontSize: 28,
                fontWeight: '800',
                marginBottom: 10,
              }}
            />

            <TextInput
              multiline
              placeholder="What's happening?"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={text}
              onChangeText={setText}
              maxLength={2000}
              style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: '400',
                lineHeight: 26,
                minHeight: 150,
                textAlignVertical: 'top',
              }}
            />

            {image && (
              <View style={{ position: 'relative', marginTop: 20, width: 150, height: 150 }}>
                <Image 
                  source={{ uri: image.uri }} 
                  style={{ width: 150, height: 150, borderRadius: 10 }} 
                />
                <TouchableOpacity 
                  onPress={() => setImage(null)}
                  style={{ 
                    position: 'absolute', 
                    top: -10, 
                    right: -10, 
                    backgroundColor: '#EF4444', 
                    padding: 8, 
                    borderRadius: 20 
                  }}
                >
                  <Trash2 size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}

            {!image && (
              <TouchableOpacity 
                onPress={pickImage}
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: 10, 
                  marginTop: 20,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  alignSelf: 'flex-start',
                  paddingHorizontal: 15,
                  paddingVertical: 10,
                  borderRadius: 20
                }}
              >
                <ImageIcon size={20} color="rgba(255,255,255,0.6)" />
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>ADD IMAGE</Text>
              </TouchableOpacity>
            )}

            <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 20 }}>
              {text.length} characters
            </Text>
          </ScrollView>
      </View>

      {/* Zone Picker Overlay */}
      {step === 'zone' && (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#000000', paddingTop: insets.top }}>
          <View style={{ padding: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>SELECT ZONE</Text>
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
                style={{
                  padding: 20,
                  borderBottomWidth: 0.5,
                  borderBottomColor: 'rgba(255,255,255,0.05)'
                }}
              >
                <Text style={{ color: selectedZone?.id === z.id ? '#FFFFFF' : 'rgba(255,255,255,0.5)', fontSize: 18 }}>{z.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Tag Picker Overlay */}
      {step === 'tag' && (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#000000', paddingTop: insets.top }}>
          <View style={{ padding: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>SELECT TAG</Text>
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
                style={{
                  padding: 20,
                  borderBottomWidth: 0.5,
                  borderBottomColor: 'rgba(255,255,255,0.05)'
                }}
              >
                <Text style={{ color: selectedTag?.id === t.id ? '#FFFFFF' : 'rgba(255,255,255,0.5)', fontSize: 18 }}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
