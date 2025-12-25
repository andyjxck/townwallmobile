import React from 'react';
import { View, Text } from 'react-native';

export function NativeAd() {
  return (
    <View style={{ 
      marginVertical: 10, 
      marginHorizontal: 16, 
      padding: 16, 
      backgroundColor: '#1E293B', 
      borderRadius: 16,
      borderWidth: 2,
      borderColor: '#3B82F6',
      minHeight: 250,
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <View style={{ height: 12, width: '40%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginBottom: 6 }} />
          <View style={{ height: 10, width: '25%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />
        </View>
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' }}>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700' }}>AD</Text>
        </View>
      </View>
      
      <View style={{ height: 120, width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 12 }} />
      
      <View style={{ height: 14, width: '90%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginBottom: 8 }} />
      <View style={{ height: 14, width: '70%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginBottom: 16 }} />
      
      <View style={{ height: 40, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: '800' }}>LEARN MORE</Text>
      </View>
      
      <Text style={{ position: 'absolute', bottom: -20, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
        Native Ad Placeholder (Visible in Expo Go)
      </Text>
    </View>
  );
}
