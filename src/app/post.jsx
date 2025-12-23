import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { InstrumentSans_500Medium } from "@expo-google-fonts/instrument-sans";
import { useTheme, getTagColor } from "@/utils/theme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDeviceId } from "@/utils/deviceId";
import { getHomeZone } from "@/utils/onboarding";

export default function PostScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [text, setText] = useState("");
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [showZonePicker, setShowZonePicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [postResult, setPostResult] = useState(null);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    InstrumentSans_500Medium,
  });

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    getHomeZone().then((homeZoneId) => {
      if (homeZoneId && zones) {
        const zone = zones.find((z) => z.id === homeZoneId);
        setSelectedZone(zone);
      }
    });
  }, []);

  const { data: zonesData } = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const response = await fetch("/api/zones");
      if (!response.ok) throw new Error("Failed to fetch zones");
      return response.json();
    },
  });

  const { data: tagsData } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const response = await fetch("/api/tags");
      if (!response.ok) throw new Error("Failed to fetch tags");
      return response.json();
    },
  });

  const zones = zonesData?.zones.filter((z) => z.name !== "All Redditch") || [];
  const tags = tagsData?.tags || [];

  const createPostMutation = useMutation({
    mutationFn: async (postData) => {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });
      if (!response.ok) throw new Error("Failed to create post");
      return response.json();
    },
    onSuccess: (data) => {
      setPostResult(data);
      setShowResult(true);
      queryClient.invalidateQueries(["posts"]);
    },
  });

  const handlePost = () => {
    if (!text || !selectedZone || !selectedTag || !deviceId) return;

    createPostMutation.mutate({
      zoneId: selectedZone.id,
      tagId: selectedTag.id,
      text: text.trim(),
      deviceId,
      isAnonymous: true,
    });
  };

  const handleClose = () => {
    if (showResult && postResult?.moderationResult?.decision === "allow") {
      queryClient.invalidateQueries(["posts"]);
    }
    router.back();
  };

  const charCount = text.length;
  const canPost =
    text.trim().length > 0 && selectedZone && selectedTag && charCount <= 240;

  if (!fontsLoaded) {
    return null;
  }

  if (showResult && postResult) {
    const { moderationResult, post } = postResult;

    const resultMessages = {
      allow: {
        title: "Posted!",
        message: "Your post is now live and visible to everyone in the feed.",
      },
      hold: {
        title: "Under review",
        message:
          "Your post is being reviewed by moderators. You will be notified when it is approved.",
      },
      reject: {
        title: "Not posted",
        message: moderationResult.reason,
      },
    };

    const result = resultMessages[moderationResult.decision];

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={isDark ? "light" : "dark"} />

        <View
          style={{
            flex: 1,
            paddingTop: insets.top + 24,
            paddingHorizontal: 24,
            paddingBottom: insets.bottom + 24,
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text
              style={{
                fontFamily: "InstrumentSans_500Medium",
                fontSize: 32,
                color: colors.text,
                marginBottom: 16,
              }}
            >
              {result.title}
            </Text>

            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 16,
                color: colors.textSecondary,
                lineHeight: 24,
              }}
            >
              {result.message}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleClose}
            style={{
              backgroundColor: colors.text,
              borderRadius: 28,
              paddingVertical: 18,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: colors.background,
              }}
            >
              {moderationResult.decision === "reject" ? "Try again" : "Done"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity onPress={handleClose}>
          <X size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePost}
          disabled={!canPost || createPostMutation.isPending}
          style={{
            backgroundColor: canPost ? colors.text : colors.zonePill,
            borderRadius: 20,
            paddingHorizontal: 20,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 15,
              color: canPost ? colors.background : colors.textTertiary,
            }}
          >
            {createPostMutation.isPending ? "Posting..." : "Post"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: 12, marginBottom: 24 }}>
          <TouchableOpacity
            onPress={() => setShowZonePicker(true)}
            style={{
              backgroundColor: colors.zonePill,
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: colors.textSecondary,
                marginBottom: 4,
              }}
            >
              Zone
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 17,
                color: colors.text,
              }}
            >
              {selectedZone?.name || "Select zone"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowTagPicker(true)}
            style={{
              backgroundColor: colors.zonePill,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: colors.textSecondary,
                marginBottom: 4,
              }}
            >
              Tag
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 17,
                color: colors.text,
              }}
            >
              {selectedTag?.name || "Select tag"}
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What's happening around Redditch?"
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={240}
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 18,
            color: colors.text,
            lineHeight: 26,
            minHeight: 200,
            textAlignVertical: "top",
          }}
        />

        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: charCount > 240 ? "#FF3B30" : colors.textTertiary,
            textAlign: "right",
            marginTop: 12,
          }}
        >
          {charCount}/240
        </Text>
      </ScrollView>

      {/* Zone Picker Modal */}
      <Modal visible={showZonePicker} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <StatusBar style={isDark ? "light" : "dark"} />

          <View
            style={{
              paddingTop: insets.top + 16,
              paddingHorizontal: 20,
              paddingBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 17,
                color: colors.text,
              }}
            >
              Select Zone
            </Text>

            <TouchableOpacity onPress={() => setShowZonePicker(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            {zones.map((zone, index) => (
              <React.Fragment key={zone.id}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedZone(zone);
                    setShowZonePicker(false);
                  }}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 17,
                      color: colors.text,
                    }}
                  >
                    {zone.name}
                  </Text>
                </TouchableOpacity>

                {index < zones.length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.separator,
                      marginHorizontal: 20,
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Tag Picker Modal */}
      <Modal visible={showTagPicker} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <StatusBar style={isDark ? "light" : "dark"} />

          <View
            style={{
              paddingTop: insets.top + 16,
              paddingHorizontal: 20,
              paddingBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 17,
                color: colors.text,
              }}
            >
              Select Tag
            </Text>

            <TouchableOpacity onPress={() => setShowTagPicker(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            {tags.map((tag, index) => (
              <React.Fragment key={tag.id}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedTag(tag);
                    setShowTagPicker(false);
                  }}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      backgroundColor: getTagColor(tag.name, colors),
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 6,
                      marginRight: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 11,
                        color: colors.text,
                      }}
                    >
                      {tag.name}
                    </Text>
                  </View>
                </TouchableOpacity>

                {index < tags.length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.separator,
                      marginHorizontal: 20,
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
