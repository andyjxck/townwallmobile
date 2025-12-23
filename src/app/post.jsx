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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X, ChevronRight } from "lucide-react-native";
import { getDeviceId } from "../utils/deviceId";
import { supabase } from "../utils/supabase";
import * as Haptics from "expo-haptics";

export default function PostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [text, setText] = useState("");
  const [zones, setZones] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [step, setStep] = useState('write'); // 'write' | 'zone' | 'tag' | 'success'

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    fetchData();
  }, []);

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

  const handlePost = async () => {
    if (!text || !selectedZone || !selectedTag || !deviceId) return;
    setLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const { error } = await supabase.from('rposts').insert({
        text: text.trim(),
        zone_id: selectedZone.id,
        tag_id: selectedTag.id,
        device_id: deviceId,
        is_anonymous: true,
        expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 hours
      });

      if (error) throw error;
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
            multiline
            placeholder="What's happening?"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={text}
            onChangeText={setText}
            maxLength={240}
            style={{
              color: '#FFFFFF',
              fontSize: 24,
              fontWeight: '500',
              lineHeight: 32,
              minHeight: 200,
              textAlignVertical: 'top',
            }}
          />
          <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 10 }}>
            {text.length} / 240
          </Text>
        </ScrollView>
      </View>

      {/* Zone Picker Overlay */}
      {step === 'zone' && (
        <View style={{ ...View.absoluteFillObject, backgroundColor: '#000000', paddingTop: insets.top }}>
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
        <View style={{ ...View.absoluteFillObject, backgroundColor: '#000000', paddingTop: insets.top }}>
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
