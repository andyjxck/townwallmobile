import React from 'react';
import { View, Text } from 'react-native';

export function NativeAd() {
  return (
    <View style={{ 
      marginVertical: 10, 
      marginHorizontal: 16, 
      padding: 20, 
      backgroundColor: 'rgba(255,255,255,0.05)', 
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      borderStyle: 'dashed',
      alignItems: 'center'
    }}>
      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Native Ad Placeholder (Disabled for Expo Go)</Text>
    </View>
  );
}
