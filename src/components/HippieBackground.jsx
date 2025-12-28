import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function HippieBackground({ children }) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4a2c5a', '#2c4a5a', '#2c3e5a', '#5a2c4a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />
      {/* Add some "wavey" decorative elements */}
      <View style={[styles.blob, { top: -100, left: -100, backgroundColor: '#6b4f7d', opacity: 0.3 }]} />
      <View style={[styles.blob, { bottom: -150, right: -50, backgroundColor: '#4f7d6b', opacity: 0.2, width: 400, height: 400 }]} />
      <View style={[styles.blob, { top: height / 2, left: width / 2, backgroundColor: '#7d6b4f', opacity: 0.15, width: 300, height: 300 }]} />
      
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  blob: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 250,
  },
  content: {
    flex: 1,
  }
});
