import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { BannerAd as AdMobBanner, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const BANNER_ID = Platform.select({
  ios: 'ca-app-pub-3940256099942544/2934735716', // Test ID
  android: 'ca-app-pub-3940256099942544/6300978111', // Test ID
});

export function BannerAd() {
  if (isExpoGo) {
    return (
      <View style={styles.placeholderContainer}>
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderTitle}>SPONSORED BANNER AD</Text>
          <Text style={styles.placeholderSubtitle}>Ads are disabled in Expo Go. This will be a Google Banner Ad in production.</Text>
        </View>
      </View>
    );
  }

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

const styles = StyleSheet.create({
  placeholderContainer: {
    paddingHorizontal: 20,
    marginVertical: 10,
    width: '100%',
  },
  placeholderBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
  placeholderTitle: {
    color: '#3B82F6',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  placeholderSubtitle: {
    color: 'rgba(59, 130, 246, 0.6)',
    fontSize: 8,
    textAlign: 'center',
    marginTop: 2,
  }
});
