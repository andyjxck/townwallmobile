import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Platform } from 'react-native';
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
    // Module not found or failed to load
  }
}

const adUnitId = __DEV__ 
  ? 'ca-app-pub-3940256099942544/2247696110' // Test ID for Native
  : Platform.select({
      ios: 'ca-app-pub-1505977777207758/1638367758', 
      android: 'ca-app-pub-1505977777207758/6195707754',
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
    return null;
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
