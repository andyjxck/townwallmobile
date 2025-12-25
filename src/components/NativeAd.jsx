import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Heart, Star, Flag, Share as ShareIcon, ExternalLink, Info } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export function NativeAd({ ad }) {
  const [expanded, setExpanded] = useState(false);

  const defaultAd = {
    title: "Boost your business on TownWall",
    text: "Reach thousands of local residents in your community. TownWall Ads are simple, effective, and built for local impact. Tap learn more to start your first campaign today!",
    username: "TownWall Ads",
    image_url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=800",
    cta: "LEARN MORE",
    url: "https://da619ca1-48f2-4f16-9b4e-e352a6eee0c4.created.app/business"
  };

  const adData = ad || defaultAd;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (adData.url) {
      Linking.openURL(adData.url);
    }
  };

  return (
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
                  {adData.username}
                </Text>
                <View style={styles.adSticker}>
                  <Text style={styles.adStickerText}>SPONSORED</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={[styles.postTitle, { color: '#FFFFFF' }]}>
            {adData.title}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handlePress}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: adData.image_url }}
            style={{ width: 80, height: 80, borderRadius: 8 }}
            contentFit="cover"
          />
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <Text style={[styles.postBody, { color: 'rgba(255, 255, 255, 0.8)' }]}>
            {adData.text}
          </Text>
          
          <TouchableOpacity 
            style={styles.ctaButton}
            onPress={handlePress}
          >
            <Text style={styles.ctaText}>{adData.cta}</Text>
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

        <TouchableOpacity onPress={handlePress} style={styles.actionButton}>
          <Info size={18} color="#3B82F6" />
          <Text style={[styles.actionCount, { color: "#3B82F6" }]}>PROMOTED</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />
        
        <TouchableOpacity onPress={handlePress} style={styles.actionButton}>
          <ShareIcon size={18} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.debugText}>
        Native Ad Placeholder (Visible in Expo Go)
      </Text>
    </View>
  );
}

import { Zap } from "lucide-react-native";

const styles = StyleSheet.create({
  postContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.05)', // Subtle blue tint for ads
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
  debugText: {
    textAlign: 'center', 
    color: 'rgba(255,255,255,0.1)', 
    fontSize: 8,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  }
});
