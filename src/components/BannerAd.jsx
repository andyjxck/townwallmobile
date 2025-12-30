import React from 'react';
import { View, Platform, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

let RNBannerAd, BannerAdSize, TestIds;

const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  try {
    const ads = require('react-native-google-mobile-ads');
    RNBannerAd = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
    TestIds = ads.TestIds;
  } catch (e) {
  }
}

const adUnitId = __DEV__ 
  ? (TestIds?.BANNER || 'ca-app-pub-3940256099942544/6300978111') 
    : Platform.select({
        ios: 'ca-app-pub-1505977777207758/9856407709', 
        android: 'ca-app-pub-1505977777207758/9856407709',
      });

export function BannerAd() {
  if (!RNBannerAd || !BannerAdSize) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>AD SPACE</Text>
      </View>
    );
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

const styles = StyleSheet.create({
  placeholder: {
    height: 60,
    marginVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 15,
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
