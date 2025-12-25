import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';

export function NativeAd() {
  const [adConfig, setAdConfig] = useState(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      const ads = require('react-native-google-mobile-ads');
      setAdConfig({
        NativeAdView: ads.NativeAdView,
        NativeAsset: ads.NativeAsset,
        NativeMediaView: ads.NativeMediaView,
        NativeAssetType: ads.NativeAssetType,
        TestIds: ads.TestIds
      });
    } catch (e) {
      console.warn('NativeAds not supported in this environment');
    }
  }, []);

  // Show placeholder in Expo Go (appOwnership is 'expo') or Web preview
  if (Platform.OS === 'web' || (Constants.appOwnership === 'expo' && __DEV__) || !adConfig) {
    return (
      <View style={[styles.container, { borderStyle: 'dashed' }]}>
        <View style={styles.adContent}>
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: '#e0e0e0' }]} />
            <View style={styles.headerText}>
              <Text style={[styles.headline, { backgroundColor: '#e0e0e0', color: 'transparent', width: '80%', height: 16, borderRadius: 4 }]}>Placeholder</Text>
              <Text style={[styles.advertiser, { backgroundColor: '#f0f0f0', color: 'transparent', width: '40%', height: 12, borderRadius: 4, marginTop: 4 }]}>Advertiser</Text>
            </View>
            <View style={styles.adBadge}>
              <Text style={styles.adBadgeText}>Ad</Text>
            </View>
          </View>
          <Text style={[styles.bodyText, { backgroundColor: '#f0f0f0', color: 'transparent', width: '100%', height: 14, borderRadius: 4, marginBottom: 4 }]}>Body</Text>
          <Text style={[styles.bodyText, { backgroundColor: '#f0f0f0', color: 'transparent', width: '90%', height: 14, borderRadius: 4 }]}>Body</Text>
          <View style={[styles.mediaView, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: '#999', fontSize: 14 }}>Native Ad Placeholder</Text>
          </View>
          <View style={[styles.ctaButton, { backgroundColor: '#ccc' }]}>
            <Text style={styles.ctaText}>Learn More</Text>
          </View>
        </View>
      </View>
    );
  }

  const { NativeAdView, NativeAsset, NativeMediaView, NativeAssetType, TestIds } = adConfig;
  const adUnitId = __DEV__ ? TestIds.NATIVE : 'ca-app-pub-1505977777207758/1579458289';

  return (
    <View style={styles.container}>
      <NativeAdView
        adUnitID={adUnitId}
        onAdLoaded={(data) => console.log('Ad Loaded', data)}
        onAdFailedToLoad={(error) => console.error('Ad Failed to Load', error)}
        style={styles.adView}
      >
        <View style={styles.adContent}>
          <View style={styles.header}>
            <NativeAsset assetType={NativeAssetType.ICON}>
              <View style={styles.icon} />
            </NativeAsset>
            <View style={styles.headerText}>
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <Text style={styles.headline} numberOfLines={1} />
              </NativeAsset>
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={styles.advertiser} numberOfLines={1} />
              </NativeAsset>
            </View>
            <View style={styles.adBadge}>
              <Text style={styles.adBadgeText}>Ad</Text>
            </View>
          </View>

          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text style={styles.bodyText} numberOfLines={2} />
          </NativeAsset>

          <NativeMediaView style={styles.mediaView} />

          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <View style={styles.ctaButton}>
              <Text style={styles.ctaText} />
            </View>
          </NativeAsset>
        </View>
      </NativeAdView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  adView: {
    width: '100%',
  },
  adContent: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  headerText: {
    flex: 1,
    marginLeft: 10,
  },
  headline: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  advertiser: {
    fontSize: 12,
    color: '#666',
  },
  adBadge: {
    backgroundColor: '#FFCC00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  bodyText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
  },
  mediaView: {
    width: '100%',
    height: 180,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12,
  },
  ctaButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
