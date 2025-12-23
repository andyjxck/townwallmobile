import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, Image, Platform, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Music, Youtube, Globe, Info, Plus, ExternalLink, ShieldCheck, Instagram } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/utils/supabase';
import { getStoredUser } from '@/utils/user';
import * as Haptics from 'expo-haptics';
import Purchases from 'react-native-purchases';
import { BlurView } from 'expo-blur';

export default function LocalTalent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [talents, setTalents] = useState([]);
  const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
      name: '',
      title: '',
      platform: 'Youtube',
      link: '',
      description: '',
      category: 'YouTuber'
    });

  useEffect(() => {
    fetchTalents();
    setupRevenueCat();
  }, []);

  const setupRevenueCat = async () => {
    try {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      if (Platform.OS === 'ios') {
        const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
        if (apiKey) {
          await Purchases.configure({ apiKey });
        }
      }
    } catch (e) {
      console.log("RevenueCat Setup Error:", e);
    }
  };

  const fetchTalents = async () => {
    try {
      const { data, error } = await supabase
        .from('rtalent')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTalents(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseAndSubmit = async () => {
    if (!form.name || !form.title || !form.link) {
      Alert.alert("Required", "Please fill in your name, title, and link.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);

    try {
      const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
      
      if (!apiKey) {
        // Fallback for development if no API key is provided yet
        Alert.alert(
          "Development Mode",
          "No RevenueCat API key found. Would you like to proceed with a mock submission?",
          [
            { text: "Cancel", onPress: () => setSubmitting(false), style: "cancel" },
            { text: "Mock Submit", onPress: () => submitTalent('mock_paid') }
          ]
        );
        return;
      }

      const offerings = await Purchases.getOfferings();
      if (offerings.current && offerings.current.availablePackages.length > 0) {
        const pkg = offerings.current.availablePackages[0]; // Assuming first package is the £0.99 one
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        
        if (customerInfo) {
          await submitTalent('paid');
        }
      } else {
        throw new Error("No offerings available. Please check RevenueCat dashboard.");
      }
    } catch (e) {
      if (!e.userCancelled) {
        Alert.alert("Payment Error", e.message || "Something went wrong with the payment.");
      }
      setSubmitting(false);
    }
  };

  const submitTalent = async (paymentStatus) => {
    try {
      const user = await getStoredUser();
      const { error } = await supabase
        .from('rtalent')
        .insert({
          user_id: user?.id,
          name: form.name,
          title: form.title,
          platform: form.platform,
          link: form.link,
          description: form.description,
          category: form.category,
          payment_status: paymentStatus,
          status: 'pending' // Moderation pending
        });

      if (error) throw error;
      
      Alert.alert("Submitted!", "Your talent has been submitted for moderation. It will appear on the feed once approved.");
      setShowModal(false);
      setForm({ name: '', title: '', platform: 'Youtube', link: '', description: '', category: 'Musician' });
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to save your submission.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderTalentCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{item.name?.charAt(0) || '?'}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.talentName}>{item.name}</Text>
          <Text style={styles.talentCategory}>{item.category || 'Talent'}</Text>
        </View>
          <TouchableOpacity style={styles.platformIcon} onPress={() => {}}>
            {item.platform === 'Youtube' && <Youtube size={20} color="#FF0000" />}
            {item.platform === 'Spotify' && <Music size={20} color="#1DB954" />}
            {item.platform === 'Instagram' && <Instagram size={20} color="#E4405F" />}
            {item.platform === 'TikTok' && <Music size={20} color="#69C9D0" />}
            {(item.platform === 'Website' || !['Youtube', 'Spotify', 'Instagram', 'TikTok'].includes(item.platform)) && <Globe size={20} color="#FFFFFF" />}
          </TouchableOpacity>
      </View>
      
      <Text style={styles.cardTitle}>{item.title}</Text>
      {item.description ? <Text style={styles.cardDescription} numberOfLines={3}>{item.description}</Text> : null}
      
      <TouchableOpacity style={styles.viewButton} onPress={() => Alert.alert("Opening", `Opening ${item.link}`)}>
        <Text style={styles.viewButtonText}>View Project</Text>
        <ExternalLink size={14} color="#000000" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#FFFFFF" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LOCAL TALENT</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : (
        <FlatList
          data={talents}
          renderItem={renderTalentCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Music size={48} color="rgba(255,255,255,0.1)" />
              <Text style={styles.emptyText}>No talent showcased yet.</Text>
              <Text style={styles.emptySubtext}>Be the first to show off your skills!</Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { bottom: insets.bottom + 20 }]} 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowModal(true);
        }}
      >
        <Plus color="#000000" size={32} />
      </TouchableOpacity>

      {/* Submission Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <BlurView intensity={100} tint="dark" style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Showcase Your Talent</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.priceTag}>
                <ShieldCheck size={16} color="#10B981" />
                <Text style={styles.priceText}>One-time payment: £0.99p (Pending Moderation)</Text>
              </View>

              <Text style={styles.label}>YOUR NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="How should we call you?"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
              />

              <Text style={styles.label}>TITLE</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. My Latest Album / Photography Portfolio"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={form.title}
                onChangeText={(t) => setForm({ ...form, title: t })}
              />

                <Text style={styles.label}>CATEGORY</Text>
                <View style={styles.platformRow}>
                  {['YouTuber', 'Podcaster', 'Musician', 'Artist', 'Developer', 'Other'].map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setForm({ ...form, category: c })}
                      style={[styles.miniButton, form.category === c && styles.activeMiniButton]}
                    >
                      <Text style={[styles.miniButtonText, { color: form.category === c ? "#000000" : "#FFFFFF" }]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>PLATFORM</Text>
                <View style={styles.platformRow}>
                  {['Youtube', 'Spotify', 'Instagram', 'TikTok', 'Website'].map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setForm({ ...form, platform: p })}
                      style={[styles.platformButton, form.platform === p && styles.activePlatform]}
                    >
                      {p === 'Youtube' && <Youtube size={14} color={form.platform === p ? "#000000" : "#FFFFFF"} />}
                      {p === 'Spotify' && <Music size={14} color={form.platform === p ? "#000000" : "#FFFFFF"} />}
                      {p === 'Instagram' && <Instagram size={14} color={form.platform === p ? "#000000" : "#FFFFFF"} />}
                      {p === 'TikTok' && <Music size={14} color={form.platform === p ? "#000000" : "#FFFFFF"} />}
                      {p === 'Website' && <Globe size={14} color={form.platform === p ? "#000000" : "#FFFFFF"} />}
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

              <Text style={styles.label}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell the world about yourself..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                numberOfLines={4}
                value={form.description}
                onChangeText={(t) => setForm({ ...form, description: t })}
              />

              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={handlePurchaseAndSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.submitButtonText}>PAY £0.99 & SUBMIT</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </BlurView>
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  backButton: {
    padding: 5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  talentName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  talentCategory: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  platformIcon: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  cardDescription: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  viewButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  viewButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#FFFFFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 20,
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  closeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '700',
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  priceText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  platformRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
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
    minWidth: '30%',
  },
  miniButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeMiniButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  activePlatform: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  platformText: {
    fontSize: 12,
    fontWeight: '700',
  },
  miniButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
  },
});
