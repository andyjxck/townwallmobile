import React from 'react';
import { View, Text, Platform } from 'react-native';
import { BannerAd as AdMobBanner, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const BANNER_ID = Platform.select({
  ios: 'ca-app-pub-3940256099942544/2934735716', // Test ID
  android: 'ca-app-pub-3940256099942544/6300978111', // Test ID
});

export function BannerAd() {
  return (
    <View style={{ 
      alignItems: 'center', 
      justifyContent: 'center',
      marginVertical: 10,
      width: '100%',
    }}>
      <AdMobBanner
        unitId={BANNER_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error) => console.error('Banner ad failed to load: ', error)}
      />
    </View>
  );
}
