import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Music, Youtube, Globe, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/utils/supabase';
import { getStoredUser } from '@/utils/user';
import * as Haptics from 'expo-haptics';

export default function LocalTalent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    platform: 'Youtube',
    link: '',
    description: ''
  });

  const handleSubmit = async () => {
    if (!form.title || !form.link) {
      Alert.alert("Required", "Please fill in the title and link.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    
    // MOCK PAYMENT for now since Stripe agent failed
    // In a real app, you'd trigger Stripe here
    Alert.alert(
      "Payment Required",
      "This costs £0.99p to showcase your talent. Proceed to mock payment?",
      [
        { text: "Cancel", onPress: () => setLoading(false), style: "cancel" },
        { text: "Pay £0.99", onPress: async () => {
          try {
            const user = await getStoredUser();
            const { error } = await supabase
              .from('rtalent')
              .insert({
                user_id: user?.id,
                title: form.title,
                platform: form.platform,
                link: form.link,
                description: form.description,
                payment_status: 'paid'
              });

            if (error) throw error;
            
            Alert.alert("Success!", "Your talent has been submitted and will be showcased.");
            router.back();
          } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to save talent details.");
          } finally {
            setLoading(false);
          }
        }}
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#FFFFFF" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LOCAL TALENT</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoBox}>
          <Info size={20} color="#60A5FA" />
          <Text style={styles.infoText}>
            Showcase your Youtube, Spotify, or Website to the local community for just £0.99p.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>TALENT TITLE</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. My New Music Video"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={form.title}
            onChangeText={(t) => setForm({ ...form, title: t })}
          />

          <Text style={styles.label}>PLATFORM</Text>
          <View style={styles.platformRow}>
            {['Youtube', 'Spotify', 'Website'].map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setForm({ ...form, platform: p })}
                style={[styles.platformButton, form.platform === p && styles.activePlatform]}
              >
                {p === 'Youtube' && <Youtube size={16} color={form.platform === p ? "#000000" : "#FFFFFF"} />}
                {p === 'Spotify' && <Music size={16} color={form.platform === p ? "#000000" : "#FFFFFF"} />}
                {p === 'Website' && <Globe size={16} color={form.platform === p ? "#000000" : "#FFFFFF"} />}
                <Text style={[styles.platformText, { color: form.platform === p ? "#000000" : "#FFFFFF" }]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>LINK (URL)</Text>
          <TextInput
            style={styles.input}
            placeholder="https://..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            value={form.link}
            onChangeText={(t) => setForm({ ...form, link: t })}
          />

          <Text style={styles.label}>DESCRIPTION (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us more..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            numberOfLines={4}
            value={form.description}
            onChangeText={(t) => setForm({ ...form, description: t })}
          />

          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.submitButtonText}>PAY £0.99 & SUBMIT</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  backButton: {
    padding: 5,
  },
  scrollContent: {
    padding: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    padding: 15,
    borderRadius: 12,
    gap: 12,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  infoText: {
    color: '#60A5FA',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  form: {
    gap: 15,
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 15,
    color: '#FFFFFF',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  platformRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  platformButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  activePlatform: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  platformText: {
    fontSize: 12,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
  },
});
