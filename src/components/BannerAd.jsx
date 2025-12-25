import React, { useState, useEffect } from 'react';
import { View, Platform, Text } from 'react-native';
import Constants from 'expo-constants';

export function BannerAd() {
  const [adConfig, setAdConfig] = useState(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      const ads = require('react-native-google-mobile-ads');
      setAdConfig({
        BannerAd: ads.BannerAd,
        BannerAdSize: ads.BannerAdSize,
        TestIds: ads.TestIds
      });
    } catch (e) {
      console.warn('BannerAds not supported in this environment');
    }
  }, []);

  // Show placeholder in Expo Go (appOwnership is 'expo') or Web preview
  if (Platform.OS === 'web' || (Constants.appOwnership === 'expo' && __DEV__) || !adConfig) {
    return (
      <View style={{ 
        alignItems: 'center', 
        justifyContent: 'center',
        marginVertical: 10, 
        backgroundColor: '#f0f0f0', 
        height: 50, 
        width: '100%',
        borderWidth: 1,
        borderColor: '#ddd',
        borderStyle: 'dashed'
      }}>
        <Text style={{ color: '#666', fontSize: 12 }}>Banner Ad Placeholder</Text>
      </View>
    );
  }

  const { BannerAd: AdMobBanner, BannerAdSize, TestIds } = adConfig;
  const adUnitId = __DEV__ ? TestIds.BANNER : 'ca-app-pub-1505977777207758/8766030770';

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
