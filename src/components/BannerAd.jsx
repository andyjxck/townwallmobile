import React from 'react';
import { View, Text } from 'react-native';

export function BannerAd() {
  return (
    <View style={{ 
      alignItems: 'center', 
      justifyContent: 'center',
      marginVertical: 10, 
      backgroundColor: 'rgba(255,255,255,0.05)', 
      height: 50, 
      width: '100%',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      borderStyle: 'dashed'
    }}>
      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Banner Ad Placeholder (Disabled for Expo Go)</Text>
    </View>
  );
}
