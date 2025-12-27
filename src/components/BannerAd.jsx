import React from 'react';
import { View, Platform } from 'react-native';

let RNBannerAd, BannerAdSize, TestIds;

try {
  const ads = require('react-native-google-mobile-ads');
  RNBannerAd = ads.BannerAd;
  BannerAdSize = ads.BannerAdSize;
  TestIds = ads.TestIds;
} catch (e) {
  // Module not found
}

const adUnitId = __DEV__ 
  ? (TestIds?.BANNER || 'ca-app-pub-3940256099942544/6300978111') 
  : Platform.select({
      ios: 'ca-app-pub-1505977777207758/1638367758', 
      android: 'ca-app-pub-1505977777207758/6195707754',
    });

export function BannerAd() {
  if (!RNBannerAd) {
    return null;
  }

  return (
    <View style={{ alignItems: 'center', marginVertical: 10, width: '100%' }}>
      <RNBannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
}
