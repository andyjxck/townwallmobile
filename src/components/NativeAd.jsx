import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Heart, Star, Flag, Share as ShareIcon, ExternalLink, Info, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import NativeAdView, {
  CallToActionView,
  HeadlineView,
  TaglineView,
  AdvertiserView,
  ImageView,
  IconView,
} from 'react-native-google-mobile-ads';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const NATIVE_AD_UNIT_ID = Platform.select({
  ios: 'ca-app-pub-1505977777207758/1579458289',
  android: 'ca-app-pub-1505977777207758/1579458289',
  default: 'ca-app-pub-3940256099942544/3986624511', // Test ID
});

export function NativeAd() {
  const [adLoaded, setAdLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const nativeAdRef = useRef(null);

  // Fallback for Expo Go or when ad fails to load
  const renderPlaceholder = () => (
    <View style={styles.postContainer}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setExpanded(!expanded);
          }}
          activeOpacity={0.8}
          style={{ flex: 1 }}
        >
          <View style={[styles.postHeader, { gap: 8 }]}>
            <View style={styles.adIcon}>
              <Zap size={14} color="#F59E0B" fill="#F59E0B" />
            </View>
            
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.zoneText, { color: '#FFFFFF' }]}>
                  TownWall Ads
                </Text>
                <View style={styles.adSticker}>
                  <Text style={styles.adStickerText}>SPONSORED</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={[styles.postTitle, { color: '#FFFFFF' }]}>
            Boost your business on TownWall
          </Text>
          {isExpoGo && (
            <Text style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 10, marginTop: 4 }}>
              [Native Ad Placeholder for Expo Go]
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => Linking.openURL('https://da619ca1-48f2-4f16-9b4e-e352a6eee0c4.created.app/business')}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=800" }}
            style={{ width: 80, height: 80, borderRadius: 8 }}
            contentFit="cover"
          />
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <Text style={[styles.postBody, { color: 'rgba(255, 255, 255, 0.8)' }]}>
            Reach thousands of local residents in your community. TownWall Ads are simple, effective, and built for local impact.
          </Text>
          
          <TouchableOpacity 
            style={styles.ctaButton}
            onPress={() => Linking.openURL('https://da619ca1-48f2-4f16-9b4e-e352a6eee0c4.created.app/business')}
          >
            <Text style={styles.ctaText}>LEARN MORE</Text>
            <ExternalLink size={14} color="#000000" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.actionRow}>
        <View style={styles.actionButton}>
          <Heart size={18} color="rgba(255,255,255,0.2)" />
          <Text style={[styles.actionCount, { color: "rgba(255,255,255,0.2)" }]}>0</Text>
        </View>
        <View style={styles.actionButton}>
          <Star size={18} color="rgba(255,255,255,0.2)" />
          <Text style={[styles.actionCount, { color: "rgba(255,255,255,0.2)" }]}>0</Text>
        </View>
        <View style={styles.actionButton}>
          <Info size={18} color="#3B82F6" />
          <Text style={[styles.actionCount, { color: "#3B82F6" }]}>PROMOTED</Text>
        </View>
        <View style={{ flex: 1 }} />
        <ShareIcon size={18} color="rgba(255,255,255,0.4)" />
      </View>
    </View>
  );

  if (isExpoGo) {
    return renderPlaceholder();
  }

  return (
    <NativeAdView
      ref={nativeAdRef}
      adUnitID={NATIVE_AD_UNIT_ID}
      onAdLoaded={() => setAdLoaded(true)}
      onAdFailedToLoad={(error) => {
        console.warn('Native Ad failed to load:', error);
        setAdLoaded(false);
      }}
      style={{ minHeight: 120 }}
    >
      {!adLoaded ? renderPlaceholder() : (
        <View style={styles.postContainer}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <View style={[styles.postHeader, { gap: 8 }]}>
                <IconView style={styles.adIcon} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <AdvertiserView style={[styles.zoneText, { color: '#FFFFFF' }]} />
                    <View style={styles.adSticker}>
                      <Text style={styles.adStickerText}>SPONSORED</Text>
                    </View>
                  </View>
                </View>
              </View>

              <HeadlineView style={[styles.postTitle, { color: '#FFFFFF' }]} />
              <TaglineView style={[styles.postBody, { color: 'rgba(255, 255, 255, 0.6)', marginTop: 4, fontSize: 13 }]} numberOfLines={2} />
            </View>

            <ImageView
              style={{ width: 80, height: 80, borderRadius: 8 }}
            />
          </View>

          <View style={styles.actionRow}>
            <View style={styles.actionButton}>
              <Heart size={18} color="rgba(255,255,255,0.2)" />
              <Text style={[styles.actionCount, { color: "rgba(255,255,255,0.2)" }]}>0</Text>
            </View>
            <View style={styles.actionButton}>
              <Star size={18} color="rgba(255,255,255,0.2)" />
              <Text style={[styles.actionCount, { color: "rgba(255,255,255,0.2)" }]}>0</Text>
            </View>
            
            <CallToActionView
              style={styles.inlineCta}
              textStyle={styles.inlineCtaText}
            />

            <View style={{ flex: 1 }} />
            <ShareIcon size={18} color="rgba(255,255,255,0.4)" />
          </View>
        </View>
      )}
    </NativeAdView>
  );
}
        <View style={styles.postContainer}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <View style={[styles.postHeader, { gap: 8 }]}>
                <IconView style={styles.adIcon} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <AdvertiserView style={[styles.zoneText, { color: '#FFFFFF' }]} />
                    <View style={styles.adSticker}>
                      <Text style={styles.adStickerText}>SPONSORED</Text>
                    </View>
                  </View>
                </View>
              </View>

              <HeadlineView style={[styles.postTitle, { color: '#FFFFFF' }]} />
              <TaglineView style={[styles.postBody, { color: 'rgba(255, 255, 255, 0.6)', marginTop: 4, fontSize: 13 }]} numberOfLines={2} />
            </View>

            <ImageView
              style={{ width: 80, height: 80, borderRadius: 8 }}
            />
          </View>

          <View style={styles.actionRow}>
            <View style={styles.actionButton}>
              <Heart size={18} color="rgba(255,255,255,0.2)" />
              <Text style={[styles.actionCount, { color: "rgba(255,255,255,0.2)" }]}>0</Text>
            </View>
            <View style={styles.actionButton}>
              <Star size={18} color="rgba(255,255,255,0.2)" />
              <Text style={[styles.actionCount, { color: "rgba(255,255,255,0.2)" }]}>0</Text>
            </View>
            
            <CallToActionView
              style={styles.inlineCta}
              textStyle={styles.inlineCtaText}
            />

            <View style={{ flex: 1 }} />
            <ShareIcon size={18} color="rgba(255,255,255,0.4)" />
          </View>
        </View>
      )}
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  postContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    marginBottom: 1,
    position: 'relative',
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  adIcon: {
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    backgroundColor: 'rgba(245, 158, 11, 0.1)', 
    justifyContent: 'center', 
    alignItems: 'center'
  },
  adSticker: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  adStickerText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  zoneText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  expandedContent: {
    marginTop: 12,
  },
  postBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  ctaButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  ctaText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  inlineCta: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCtaText: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionCount: {
    fontSize: 13,
    fontWeight: "800",
  },
});

