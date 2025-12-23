import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { X, Check, ChevronDown } from "lucide-react-native";
import { getDeviceId } from "../../utils/deviceId";
import { supabase } from "../../utils/supabase";
import * as Haptics from "expo-haptics";

const TAG_COLORS = {
  General: "#94A3B8",
  Traffic: "#F59E0B",
  "Lost & Found": "#8B5CF6",
  Complaint: "#EF4444",
  Incident: "#DC2626",
  Warning: "#EA580C",
  Event: "#06B6D4",
  "Shop / Business": "#10B981",
  Question: "#60A5FA",
};

export default function PostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [text, setText] = useState("");
  const [zones, setZones] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [showZonePicker, setShowZonePicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const id = await getDeviceId();
        setDeviceId(id);

        const [zonesRes, tagsRes] = await Promise.all([
          supabase.from("rzones").select("*").order("name"),
          supabase.from("rtags").select("*").order("name"),
        ]);

        if (zonesRes.data) setZones(zonesRes.data);
        if (tagsRes.data) setTags(tagsRes.data);
      } catch (error) {
        console.error("Error initializing post screen:", error);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handlePost = async () => {
    if (!text.trim() || !selectedZone || !selectedTag || !deviceId) {
      Alert.alert(
        "Missing information",
        "Please select a zone, tag, and write your post"
      );
      return;
    }

    setPosting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Set expiration to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { data, error } = await supabase.from("rposts").insert({
        zone_id: selectedZone.id,
        tag_id: selectedTag.id,
        text: text.trim(),
        device_id: deviceId,
        is_anonymous: true,
        expires_at: expiresAt.toISOString(),
      }).select().single();

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", "Could not create post. Please try again.");
      setPosting(false);
    }
  };

  const charCount = text.length;
  const isValid = text.trim() && selectedZone && selectedTag && charCount <= 240;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000000", justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="rgba(255,255,255,0.3)" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <StatusBar style="light" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingBottom: 16,
          paddingHorizontal: 20,
          borderBottomWidth: 0.5,
          borderBottomColor: "rgba(255,255,255,0.06)",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <X size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "600" }}>
          New Post
        </Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={!isValid || posting}
          style={{
            backgroundColor: isValid ? "#FFFFFF" : "rgba(255,255,255,0.1)",
            paddingHorizontal: 20,
            paddingVertical: 8,
            borderRadius: 20,
          }}
        >
          {posting ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Text
              style={{
                color: isValid ? "#000000" : "rgba(255,255,255,0.3)",
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Post
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Zone Picker */}
        <TouchableOpacity
          onPress={() => {
            setShowZonePicker(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 0.5,
            borderBottomColor: "rgba(255,255,255,0.06)",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              Zone
            </Text>
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "500" }}>
              {selectedZone ? selectedZone.name : "Select a zone"}
            </Text>
          </View>
          <ChevronDown size={20} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>

        {/* Tag Picker */}
        <TouchableOpacity
          onPress={() => {
            setShowTagPicker(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 0.5,
            borderBottomColor: "rgba(255,255,255,0.06)",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View>
              <Text
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                Tag
              </Text>
              <Text
                style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "500" }}
              >
                {selectedTag ? selectedTag.name : "Select a tag"}
              </Text>
            </View>
            {selectedTag && (
              <View
                style={{
                  backgroundColor: TAG_COLORS[selectedTag.name] || "#94A3B8",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 4,
                  marginLeft: 12,
                }}
              >
                <Text
                  style={{ color: "#000000", fontSize: 11, fontWeight: "600" }}
                >
                  {selectedTag.name}
                </Text>
              </View>
            )}
          </View>
          <ChevronDown size={20} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>

        {/* Text Input */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="What's happening around Redditch?"
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            maxLength={240}
            style={{
              color: "#FFFFFF",
              fontSize: 17,
              lineHeight: 24,
              minHeight: 200,
              textAlignVertical: "top",
            }}
            autoFocus
          />
        </View>

        {/* Character Count */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
          <Text
            style={{
              color: charCount > 240 ? "#EF4444" : "rgba(255,255,255,0.4)",
              fontSize: 13,
              textAlign: "right",
            }}
          >
            {charCount} / 240
          </Text>
        </View>

        {/* Anonymous Notice */}
        <View
          style={{
            marginHorizontal: 20,
            marginTop: 20,
            padding: 16,
            backgroundColor: "rgba(255,255,255,0.04)",
            borderRadius: 8,
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 13,
              lineHeight: 20,
            }}
          >
            Your post will be published anonymously. All posts are moderated
            before appearing in the feed.
          </Text>
        </View>
      </ScrollView>

      {/* Zone Picker Modal */}
      <Modal visible={showZonePicker} transparent animationType="slide">
        <Pressable
          onPress={() => setShowZonePicker(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#1A1A1A",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: insets.bottom,
            }}
          >
            <View
              style={{
                padding: 20,
                borderBottomWidth: 0.5,
                borderBottomColor: "rgba(255,255,255,0.1)",
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700" }}
              >
                Select Zone
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {zones.map((zone) => (
                <TouchableOpacity
                  key={zone.id}
                  onPress={() => {
                    setSelectedZone(zone);
                    setShowZonePicker(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    borderBottomWidth: 0.5,
                    borderBottomColor: "rgba(255,255,255,0.06)",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 16 }}>
                    {zone.name}
                  </Text>
                  {selectedZone?.id === zone.id && (
                    <Check size={20} color="#4ADE80" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Tag Picker Modal */}
      <Modal visible={showTagPicker} transparent animationType="slide">
        <Pressable
          onPress={() => setShowTagPicker(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#1A1A1A",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: insets.bottom,
            }}
          >
            <View
              style={{
                padding: 20,
                borderBottomWidth: 0.5,
                borderBottomColor: "rgba(255,255,255,0.1)",
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700" }}
              >
                Select Tag
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {tags.map((tag) => (
                <TouchableOpacity
                  key={tag.id}
                  onPress={() => {
                    setSelectedTag(tag);
                    setShowTagPicker(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    borderBottomWidth: 0.5,
                    borderBottomColor: "rgba(255,255,255,0.06)",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        backgroundColor: TAG_COLORS[tag.name] || "#94A3B8",
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 6,
                        marginRight: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: "#000000",
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {tag.name}
                      </Text>
                    </View>
                  </View>
                  {selectedTag?.id === tag.id && (
                    <Check size={20} color="#4ADE80" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
