import React from 'react';
import { View, Platform } from 'react-native';
import { BannerAd as AdMobBanner, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const adUnitId = TestIds.BANNER;

export function BannerAd() {
  if (Platform.OS === 'web') return null;

  return (
    <View style={{ alignItems: 'center', marginVertical: 10 }}>
      <AdMobBanner
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
}
