import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

let NativeAdView, CallToActionView, HeadlineView, IconView, StarRatingView, TaglineView, AdvertiserView, ImageView;

const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  try {
    const ads = require('react-native-google-mobile-ads');
    NativeAdView = ads.default;
    CallToActionView = ads.CallToActionView;
    HeadlineView = ads.HeadlineView;
    IconView = ads.IconView;
    StarRatingView = ads.StarRatingView;
    TaglineView = ads.TaglineView;
    AdvertiserView = ads.AdvertiserView;
    ImageView = ads.ImageView;
  } catch (e) {
  }
}

const adUnitId = __DEV__ 
  ? 'ca-app-pub-3940256099942544/2247696110'
    : Platform.select({
        ios: 'ca-app-pub-1505977777207758/8766030770', 
        android: 'ca-app-pub-1505977777207758/9856407709',
      });

export function NativeAd() {
  const nativeAdRef = useRef(null);
  const [isAdLoaded, setIsAdLoaded] = useState(false);

  useEffect(() => {
    if (NativeAdView) {
      nativeAdRef.current?.loadAd();
    }
  }, []);

  if (!NativeAdView) {
    return (
      <View style={styles.placeholder}>
        <View style={styles.placeholderIcon} />
        <View style={styles.placeholderContent}>
          <View style={styles.placeholderLine} />
          <View style={[styles.placeholderLine, { width: '60%' }]} />
        </View>
        <Text style={styles.placeholderText}>AD</Text>
      </View>
    );
  }

  return (
    <NativeAdView
      ref={nativeAdRef}
      adUnitID={adUnitId}
      onAdLoaded={() => setIsAdLoaded(true)}
      style={{
        width: '100%',
        alignSelf: 'center',
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 12,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        minHeight: isAdLoaded ? 250 : 0,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconView style={{ width: 40, height: 40, borderRadius: 8 }} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <HeadlineView style={{ fontWeight: 'bold', fontSize: 14, color: '#FFF' }} />
          <AdvertiserView style={{ fontSize: 12, color: '#4ADE80', marginTop: 2 }} />
        </View>
        <CallToActionView
          style={{
            height: 32,
            paddingHorizontal: 12,
            backgroundColor: '#FFF',
            borderRadius: 16,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          textStyle={{ color: '#000', fontSize: 12, fontWeight: '700' }}
        />
      </View>
      <ImageView style={{ width: '100%', height: 150, marginTop: 12, borderRadius: 12 }} />
      <TaglineView style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 8 }} />
      <StarRatingView style={{ height: 10, width: 60, marginTop: 4 }} />
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    marginVertical: 8,
    marginHorizontal: 15,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  placeholderIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  placeholderContent: {
    flex: 1,
    gap: 6,
  },
  placeholderLine: {
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    width: '80%',
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
