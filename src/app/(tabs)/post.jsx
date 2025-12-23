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
import { getDeviceId } from "@/utils/deviceId";
import * as Haptics from "expo-haptics";

const ZONES = [
  { id: 1, name: "Astwood Bank & Feckenham", slug: "astwood-feckenham" },
  { id: 2, name: "Batchley & Brockhill", slug: "batchley-brockhill" },
  { id: 3, name: "Central", slug: "central" },
  { id: 4, name: "Greenlands & Lakeside", slug: "greenlands-lakeside" },
  { id: 5, name: "Headless Cross & Oakenshaw", slug: "headless-oakenshaw" },
  { id: 6, name: "Matchborough & Woodrow", slug: "matchborough-woodrow" },
  { id: 7, name: "North", slug: "north" },
  { id: 8, name: "Webheath & Callow Hill", slug: "webheath-callow" },
  { id: 9, name: "Winyates", slug: "winyates" },
];

const TAGS = [
  { id: 1, name: "General", color: "#94A3B8" },
  { id: 2, name: "Traffic", color: "#F59E0B" },
  { id: 3, name: "Lost & Found", color: "#8B5CF6" },
  { id: 4, name: "Complaint", color: "#EF4444" },
  { id: 5, name: "Incident", color: "#DC2626" },
  { id: 6, name: "Warning", color: "#EA580C" },
  { id: 7, name: "Event", color: "#06B6D4" },
  { id: 8, name: "Shop / Business", color: "#10B981" },
  { id: 9, name: "Question", color: "#60A5FA" },
];

export default function PostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [text, setText] = useState("");
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [showZonePicker, setShowZonePicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  const handlePost = async () => {
    if (!text.trim() || !selectedZone || !selectedTag || !deviceId) {
      Alert.alert(
        "Missing information",
        "Please select a zone, tag, and write your post",
      );
      return;
    }

    setPosting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoneId: selectedZone.id,
          tagId: selectedTag.id,
          text: text.trim(),
          deviceId,
          isAnonymous: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to create post");

      const data = await response.json();

      if (data.status === "rejected") {
        Alert.alert(
          "Post not allowed",
          data.reason || "Your post could not be published",
        );
        setPosting(false);
        return;
      }

      if (data.status === "held") {
        Alert.alert(
          "Under review",
          "Your post is being reviewed by our team and will be published shortly",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", "Could not create post. Please try again.");
      setPosting(false);
    }
  };

  const charCount = text.length;
  const isValid =
    text.trim() && selectedZone && selectedTag && charCount <= 240;

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
                  backgroundColor: selectedTag.color,
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
              {ZONES.map((zone) => (
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
              {TAGS.map((tag) => (
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
                        backgroundColor: tag.color,
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
