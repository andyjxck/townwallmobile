import { View, Text, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function BannerAd() {
  if (isExpoGo) {
    return (
      <View
        style={{
          height: 60,
          marginHorizontal: 20,
          marginVertical: 10,
          borderRadius: 12,
          backgroundColor: "rgba(59,130,246,0.1)",
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: "rgba(59,130,246,0.2)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#3B82F6", fontSize: 10, fontWeight: "900" }}>
          SPONSORED BANNER AD
        </Text>
        <Text style={{ color: "rgba(59,130,246,0.6)", fontSize: 8 }}>
          Ad placeholder (Expo Go)
        </Text>
      </View>
    );
  }

  // 🚨 SAFE dynamic import (NOT top-level)
  const {
    BannerAd: AdMobBanner,
    BannerAdSize,
  } = require("react-native-google-mobile-ads");

  const unitId =
    Platform.OS === "ios"
      ? "ca-app-pub-3940256099942544/2934735716"
      : "ca-app-pub-3940256099942544/6300978111";

  return (
    <AdMobBanner
      unitId={unitId}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
    />
  );
}
