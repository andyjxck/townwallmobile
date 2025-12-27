import React from 'react';
import { View, Platform } from 'react-native';
import { BannerAd as RNBannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const adUnitId = __DEV__ 
  ? TestIds.BANNER 
  : Platform.select({
      ios: 'ca-app-pub-1505977777207758/1638367758', // Placeholder or real ID
      android: 'ca-app-pub-1505977777207758/6195707754',
    });

export function BannerAd() {
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
