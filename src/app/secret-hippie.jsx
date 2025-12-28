import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useAuthStore } from '@/utils/auth';
import { theme } from '@/utils/theme';
import { useRouter } from 'expo-router';
import { Sparkles, Palette, CheckCircle2, Lock } from 'lucide-react-native';
import HippieBackground from '@/components/HippieBackground';

export default function SecretHippieScreen() {
  const { isHippie, toggleHippie } = useTheme();
  const user = useAuthStore(state => state.auth);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [discoveryCount, setDiscoveryCount] = useState(0);
  const [hasDiscovered, setHasDiscovered] = useState(false);

  useEffect(() => {
    fetchDiscoveryInfo();
  }, []);

  const fetchDiscoveryInfo = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Get count of users who discovered it
      const { count } = await supabase
        .from('rusers')
        .select('*', { count: 'exact', head: true })
        .not('hippie_discovered_at', 'is', null);
      
      setDiscoveryCount(count || 0);

      // Check if current user has discovered it
      const { data } = await supabase
        .from('rusers')
        .select('hippie_discovered_at')
        .eq('id', user.id)
        .single();
      
      setHasDiscovered(!!data?.hippie_discovered_at);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscover = async () => {
    if (discoveryCount >= 5 && !hasDiscovered) {
      Alert.alert("Too Late!", "The first 5 slots have already been claimed. Keep looking for other secrets!");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('rusers')
        .update({ 
          hippie_discovered_at: new Date().toISOString(),
          hippie_theme_enabled: true 
        })
        .eq('id', user.id);
      
      if (!error) {
        setHasDiscovered(true);
        toggleHippie(true);
        Alert.alert("Success!", "You've unlocked the Secret Hippie Theme!");
        fetchDiscoveryInfo();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const Content = () => (
    <View style={styles.container}>
      <View style={styles.card}>
        <Sparkles size={48} color={theme.colors.primary} style={styles.icon} />
        <Text style={styles.title}>You Found It!</Text>
        <Text style={styles.subtitle}>
          {hasDiscovered 
            ? "Welcome to the inner circle. Enjoy your custom hippie UI." 
            : "You've discovered a secret! Be one of the first 5 to unlock the Wavey Hippie Theme."}
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Slots Claimed: {discoveryCount}/5</Text>
        </View>

        {!hasDiscovered ? (
          <TouchableOpacity 
            style={[styles.button, discoveryCount >= 5 && styles.disabledButton]} 
            onPress={handleDiscover}
            disabled={discoveryCount >= 5}
          >
            <Palette size={20} color="#000" />
            <Text style={styles.buttonText}>Unlock Theme</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Hippie Theme</Text>
            <TouchableOpacity 
              style={[styles.toggle, isHippie ? styles.toggleOn : styles.toggleOff]}
              onPress={() => toggleHippie(!isHippie)}
            >
              <View style={[styles.toggleThumb, isHippie ? styles.thumbOn : styles.thumbOff]} />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return isHippie ? <HippieBackground><Content /></HippieBackground> : <Content />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  icon: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 25 },
  infoBox: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginBottom: 25 },
  infoText: { color: '#fff', fontWeight: '600' },
  button: { backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 12 },
  disabledButton: { backgroundColor: '#666' },
  buttonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 20, marginBottom: 20 },
  toggleLabel: { color: '#fff', fontSize: 18, fontWeight: '600' },
  toggle: { width: 60, height: 32, borderRadius: 16, padding: 4 },
  toggleOn: { backgroundColor: theme.colors.primary },
  toggleOff: { backgroundColor: 'rgba(255,255,255,0.2)' },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  thumbOn: { alignSelf: 'flex-end' },
  thumbOff: { alignSelf: 'flex-start' },
  closeButton: { marginTop: 20 },
  closeButtonText: { color: theme.colors.primary, fontWeight: '600' },
});
