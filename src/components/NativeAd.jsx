import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
} from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Haptics from "expo-haptics";
import { Zap, ExternalLink, Heart, Star, Info, Share as ShareIcon } from "lucide-react-native";
import { Image } from "expo-image";

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const NATIVE_AD_UNIT_ID = Platform.select({
  ios: "ca-app-pub-1505977777207758/1579458289",
  android: "ca-app-pub-1505977777207758/1579458289",
  default: "ca-app-pub-3940256099942544/3986624511",
});

export function NativeAd() {
  const [adLoaded, setAdLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const nativeAdRef = useRef(null);

  const renderPlaceholder = () => (
    <View style={styles.postContainer}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setExpanded(!expanded);
          }}
          activeOpacity={0.8}
          style={{ flex: 1 }}
        >
          <View style={[styles.postHeader, { gap: 8 }]}>
            <View style={styles.adIcon}>
              <Zap size={14} color="#F59E0B" fill="#F59E0B" />
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={[styles.zoneText, { color: "#FFFFFF" }]}>
                  TownWall Ads
                </Text>
                <View style={styles.adSticker}>
                  <Text style={styles.adStickerText}>SPONSORED</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={[styles.postTitle, { color: "#FFFFFF" }]}>
            Boost your business on TownWall
          </Text>

          {isExpoGo && (
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 4 }}>
              [Native Ad Placeholder]
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            Linking.openURL(
              "https://da619ca1-48f2-4f16-9b4e-e352a6eee0c4.created.app/business"
            )
          }
        >
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1557804506-669a67965ba0",
            }}
            style={{ width: 80, height: 80, borderRadius: 8 }}
            contentFit="cover"
          />
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <Text style={[styles.postBody, { color: "rgba(255,255,255,0.8)" }]}>
            Reach thousands of local residents in your community.
          </Text>

          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() =>
              Linking.openURL(
                "https://da619ca1-48f2-4f16-9b4e-e352a6eee0c4.created.app/business"
              )
            }
          >
            <Text style={styles.ctaText}>LEARN MORE</Text>
            <ExternalLink size={14} color="#000000" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.actionRow}>
        <View style={styles.actionButton}>
          <Heart size={18} color="rgba(255,255,255,0.2)" />
          <Text style={[styles.actionCount, { color: "rgba(255,255,255,0.2)" }]}>
            0
          </Text>
        </View>
        <View style={styles.actionButton}>
          <Star size={18} color="rgba(255,255,255,0.2)" />
          <Text style={[styles.actionCount, { color: "rgba(255,255,255,0.2)" }]}>
            0
          </Text>
        </View>
        <View style={styles.actionButton}>
          <Info size={18} color="#3B82F6" />
          <Text style={[styles.actionCount, { color: "#3B82F6" }]}>
            PROMOTED
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <ShareIcon size={18} color="rgba(255,255,255,0.4)" />
      </View>
    </View>
  );

  if (isExpoGo) {
    return renderPlaceholder();
  }

  const {
    default: NativeAdView,
    CallToActionView,
    HeadlineView,
    TaglineView,
    AdvertiserView,
    ImageView,
    IconView,
  } = require("react-native-google-mobile-ads");

  return (
    <NativeAdView
      ref={nativeAdRef}
      adUnitID={NATIVE_AD_UNIT_ID}
      onAdLoaded={() => setAdLoaded(true)}
      onAdFailedToLoad={() => setAdLoaded(false)}
      style={{ minHeight: 120 }}
    >
      {!adLoaded ? renderPlaceholder() : <View />}
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  postContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "rgba(59,130,246,0.05)",
    borderLeftWidth: 3,
    borderLeftColor: "#3B82F6",
  },
  postHeader: { flexDirection: "row", alignItems: "center" },
  adIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  adSticker: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 4,
  },
  adStickerText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 8,
    fontWeight: "900",
  },
  zoneText: { fontSize: 11, fontWeight: "700" },
  postTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  expandedContent: { marginTop: 12 },
  postBody: { fontSize: 14 },
  ctaButton: {
    marginTop: 12,
    backgroundColor: "#FFF",
    padding: 10,
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },
  ctaText: { color: "#000", fontWeight: "900" },
  actionRow: { flexDirection: "row", marginTop: 16, gap: 12 },
  actionButton: { flexDirection: "row", gap: 6 },
  actionCount: { fontSize: 13, fontWeight: "800" },
});
