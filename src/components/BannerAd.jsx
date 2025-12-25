import React from 'react';
import { View, Platform, Text } from 'react-native';
import { BannerAd as AdMobBanner, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';

const adUnitId = __DEV__ ? TestIds.BANNER : 'ca-app-pub-1505977777207758/8766030770';

export function BannerAd() {
  if (Platform.OS === 'web') return null;

  // Show placeholder in Expo Go (appOwnership is 'expo')
  if (Constants.appOwnership === 'expo' && __DEV__) {
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
        <Text style={{ color: '#666', fontSize: 12 }}>Banner Ad Placeholder (Expo Go)</Text>
      </View>
    );
  }

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
