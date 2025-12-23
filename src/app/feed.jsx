import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Plus, Settings } from "lucide-react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
} from "@expo-google-fonts/inter";
import { useTheme, getTagColor } from "@/utils/theme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDeviceId } from "@/utils/deviceId";
import { getHomeZone } from "@/utils/onboarding";
import { BlurView } from "expo-blur";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const queryClient = useQueryClient();
  const scrollViewRef = useRef(null);
  const [currentZoneIndex, setCurrentZoneIndex] = useState(0);
  const [deviceId, setDeviceId] = useState(null);
  const [userReactions, setUserReactions] = useState({});

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
  });

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  useEffect(() => {
    getHomeZone().then((homeZoneId) => {
      if (homeZoneId && zones) {
        const index = zones.findIndex((z) => z.id === homeZoneId);
        if (index >= 0) {
          setCurrentZoneIndex(index);
          scrollViewRef.current?.scrollTo({
            x: index * SCREEN_WIDTH,
            animated: false,
          });
        }
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

  const zones = zonesData?.zones || [];
  const currentZone = zones[currentZoneIndex];

  const { data: postsData, isLoading } = useQuery({
    queryKey: ["posts", currentZone?.id],
    queryFn: async () => {
      const response = await fetch(`/api/posts?zoneId=${currentZone?.id || 1}`);
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
    enabled: !!currentZone,
  });

  const reactionMutation = useMutation({
    mutationFn: async ({ postId, reactionType }) => {
      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, reactionType, deviceId }),
      });
      if (!response.ok) throw new Error("Failed to add reaction");
      return response.json();
    },
    onSuccess: (data, variables) => {
      const key = `${variables.postId}-${variables.reactionType}`;
      setUserReactions((prev) => ({
        ...prev,
        [key]: data.action === "added",
      }));
      queryClient.invalidateQueries(["posts"]);
    },
  });

  const posts = postsData?.posts || [];

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== currentZoneIndex && index >= 0 && index < zones.length) {
      setCurrentZoneIndex(index);
    }
  };

  const handleReaction = (postId, reactionType) => {
    if (!deviceId) return;
    reactionMutation.mutate({ postId, reactionType });
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Header with zone name */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 17,
              color: colors.text,
            }}
          >
            {currentZone?.name || "All Redditch"}
          </Text>

          <TouchableOpacity onPress={() => router.push("/settings")}>
            <Settings size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Zone indicator dots */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          paddingVertical: 8,
          gap: 6,
        }}
      >
        {zones.slice(0, 5).map((_, index) => (
          <View
            key={index}
            style={{
              width: index === currentZoneIndex ? 16 : 4,
              height: 4,
              borderRadius: 2,
              backgroundColor:
                index === currentZoneIndex ? colors.text : colors.separator,
            }}
          />
        ))}
      </View>

      {/* Horizontal scrolling zones */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {zones.map((zone) => (
          <View key={zone.id} style={{ width: SCREEN_WIDTH }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingBottom: insets.bottom + 100,
              }}
              showsVerticalScrollIndicator={false}
            >
              {isLoading ? (
                <View style={{ padding: 20 }}>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 15,
                      color: colors.textSecondary,
                    }}
                  >
                    Loading...
                  </Text>
                </View>
              ) : posts.length === 0 ? (
                <View
                  style={{ padding: 20, alignItems: "center", marginTop: 60 }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 15,
                      color: colors.textSecondary,
                      textAlign: "center",
                    }}
                  >
                    No posts yet in this zone
                  </Text>
                </View>
              ) : (
                posts.map((post, index) => (
                  <PostItem
                    key={post.id}
                    post={post}
                    colors={colors}
                    onReaction={handleReaction}
                    userReactions={userReactions}
                    isLast={index === posts.length - 1}
                  />
                ))
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* Floating post button */}
      <TouchableOpacity
        onPress={() => router.push("/post")}
        style={{
          position: "absolute",
          bottom: insets.bottom + 32,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: colors.text,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Plus size={28} color={colors.background} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

function PostItem({ post, colors, onReaction, userReactions, isLast }) {
  const [revealed, setRevealed] = useState(false);

  const tagColor = getTagColor(post.tag_name, colors);

  const helpfulActive = userReactions[`${post.id}-helpful`];
  const seenActive = userReactions[`${post.id}-seen`];
  const fakeActive = userReactions[`${post.id}-fake`];

  const isBlurred = post.is_blurred && !revealed;

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
      <View
        style={{
          marginBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <View
          style={{
            backgroundColor: tagColor,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 6,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 11,
              color: colors.text,
            }}
          >
            {post.tag_name}
          </Text>
        </View>

        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            color: colors.textTertiary,
          }}
        >
          {post.zone_name}
        </Text>

        {post.is_resolved && (
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 11,
              color: colors.textSecondary,
            }}
          >
            • Resolved
          </Text>
        )}
      </View>

      {isBlurred ? (
        <TouchableOpacity
          onPress={() => setRevealed(true)}
          style={{
            backgroundColor: colors.zonePill,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
              textAlign: "center",
            }}
          >
            This post is being fact-checked.{"\n"}Tap to reveal.
          </Text>
        </TouchableOpacity>
      ) : (
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 16,
            color: colors.text,
            lineHeight: 24,
            marginBottom: 12,
          }}
        >
          {post.text}
        </Text>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          marginBottom: 4,
        }}
      >
        <ReactionButton
          emoji="👍"
          count={parseInt(post.helpful_count)}
          active={helpfulActive}
          onPress={() => onReaction(post.id, "helpful")}
          colors={colors}
        />
        <ReactionButton
          emoji="👀"
          count={parseInt(post.seen_count)}
          active={seenActive}
          onPress={() => onReaction(post.id, "seen")}
          colors={colors}
        />
        <ReactionButton
          emoji="🚩"
          count={parseInt(post.fake_count)}
          active={fakeActive}
          onPress={() => onReaction(post.id, "fake")}
          colors={colors}
        />

        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            color: colors.textTertiary,
            marginLeft: "auto",
          }}
        >
          {new Date(post.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      {!isLast && (
        <View
          style={{
            height: 1,
            backgroundColor: colors.separator,
            marginTop: 20,
          }}
        />
      )}
    </View>
  );
}

function ReactionButton({ emoji, count, active, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: active
          ? colors.reactionActive
          : colors.reactionDefault,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
      }}
    >
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: 14,
          color: colors.text,
        }}
      >
        {count}
      </Text>
    </TouchableOpacity>
  );
}
