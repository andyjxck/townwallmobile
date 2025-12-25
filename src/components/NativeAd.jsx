import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { NativeAdView, NativeAsset, NativeMediaView, NativeAssetType, TestIds } from 'react-native-google-mobile-ads';

const adUnitId = __DEV__ ? TestIds.NATIVE : 'ca-app-pub-1505977777207758/1579458289';

export function NativeAd() {
  if (Platform.OS === 'web') return null;

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
