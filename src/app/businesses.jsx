import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, Image, Platform, FlatList, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Globe, Info, Plus, ExternalLink, ShieldCheck, CheckCircle2, Star, Camera, MapPin, Phone, Briefcase, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { supabase } from '@/utils/supabase';
import { getStoredUser } from '@/utils/user';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

import { LinearGradient } from 'expo-linear-gradient';

import MapView, { Marker, Callout } from 'react-native-maps';
import { BannerAd } from '@/components/BannerAd';

export default function LocalBusinesses() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingLink, setProcessingLink] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  
  const [form, setForm] = useState({
    name: '',
    category: 'Retail',
    link: '',
    address: '',
    phone: '',
    description: '',
    avatar: null,
    rating: null
  });

  useEffect(() => {
    fetchBusinesses();
  }, []);

    const fetchBusinesses = async () => {
    try {
      const { data, error } = await supabase
        .from('rbusinesses')
        .select('*')
        .eq('status', 'approved')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBusinesses(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setForm({ ...form, avatar: result.assets[0] });
    }
  };

  const uploadImage = async (userId) => {
    if (!form.avatar) return null;
    
    try {
      const fileName = `${userId || 'anon'}_${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('business_avatars')
        .upload(filePath, decode(form.avatar.base64), {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('business_avatars')
        .getPublicUrl(filePath);
        
      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

    const processGoogleLink = async () => {
    if (!form.link.includes('google.com/maps') && !form.link.includes('maps.app.goo.gl')) {
      Alert.alert("Link Type", "Please enter a valid Google Maps link to auto-fill details.");
      return;
    }

    setProcessingLink(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      
      let finalUrl = form.link;
      let extractedName = '';
      let extractedAddress = '';
      let extractedPhone = '';
      let extractedRating = null;

      // 1. Resolve short links safely
      if (form.link.includes('maps.app.goo.gl') || form.link.includes('goo.gl/maps')) {
        try {
          // Attempt to resolve the redirect to get the full URL which contains the place name/ID
          const response = await fetch(form.link, { 
            method: 'HEAD', 
            redirect: 'follow' 
          });
          finalUrl = response.url;
          
          // If we got redirected to a consent page, try to extract the original destination from the query params
          if (finalUrl.includes('consent.google.com') || finalUrl.includes('google.com/search')) {
            const urlObj = new URL(finalUrl);
            const continueUrl = urlObj.searchParams.get('continue');
            if (continueUrl) finalUrl = continueUrl;
          }
        } catch (e) {
          console.log("Short link resolution error:", e);
        }
      }

      // 2. Try to extract Place ID or Name from URL
      // Long URLs often have /place/Name/data=!4m2!3m1!1sPLACE_ID
      const placeIdMatch = finalUrl.match(/!1s(ChI[a-zA-Z0-9_-]+)/);
      const placeId = placeIdMatch ? placeIdMatch[1] : null;
      
      const placeMatch = finalUrl.match(/\/place\/([^\/|@?]+)/);
      if (placeMatch && placeMatch[1]) {
        extractedName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      }

      // 3. Use Places API if Key is available
      if (apiKey) {
        let placesData = null;
        
        // Strategy A: If we have a Place ID, use Details API directly (most accurate)
        if (placeId) {
          const detailsResponse = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_phone_number,rating,formatted_address,geometry,website&key=${apiKey}`
          );
          const detailsData = await detailsResponse.json();
          
          if (detailsData.status === 'REQUEST_DENIED') {
            console.error("Google API Key Error:", detailsData.error_message);
            Alert.alert("API Key Restriction", "Your Google API key might have IP or Referrer restrictions. Please check your Google Cloud Console settings.");
          }

          if (detailsData.result) {
            const res = detailsData.result;
            extractedName = res.name;
            extractedAddress = res.formatted_address;
            extractedPhone = res.formatted_phone_number || '';
            extractedRating = res.rating?.toString();
          }
        } 
        
        // Strategy B: Fallback to Text Search if no results yet
        if (!extractedAddress && (extractedName || form.link)) {
          const searchQuery = encodeURIComponent(extractedName || form.link);
          const searchResponse = await fetch(
            `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&key=${apiKey}`
          );
          const searchData = await searchResponse.json();

          if (searchData.results && searchData.results[0]) {
            const place = searchData.results[0];
            extractedName = place.name;
            extractedAddress = place.formatted_address;
            extractedRating = place.rating?.toString();

            if (place.place_id && !extractedPhone) {
              const detailsResponse = await fetch(
                `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number&key=${apiKey}`
              );
              const detailsData = await detailsResponse.json();
              if (detailsData.result?.formatted_phone_number) {
                extractedPhone = detailsData.result.formatted_phone_number;
              }
            }
          }
        }
      }

      // 4. Final Clean up - avoid any consent page strings
      const isConsentString = (str) => {
        if (!str) return true;
        const s = str.toLowerCase();
        return s.includes('before you continue') || s.includes('google maps') || s.includes('consent') || s.includes('cookie');
      };

      const finalName = !isConsentString(extractedName) ? extractedName : (placeMatch && placeMatch[1] ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')) : '');

      setForm(prev => ({
        ...prev,
        name: finalName || prev.name,
        address: extractedAddress || prev.address,
        phone: extractedPhone || prev.phone,
        description: prev.description || (extractedAddress ? `Located at ${extractedAddress}` : prev.description),
        rating: extractedRating || prev.rating
      }));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Details Extracted", "We've filled in what we could find from Google Maps!");

    } catch (error) {
      console.error("Link processing error:", error);
      Alert.alert("Error", "Could not extract details. Please check the link or fill manually.");
    } finally {
      setProcessingLink(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.category) {
      Alert.alert("Required", "Please fill in the business name and category.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);

    try {
      const user = await getStoredUser();
      
      let avatarUrl = null;
      if (form.avatar) {
        avatarUrl = await uploadImage(user?.id);
      }

      const { error } = await supabase
        .from('rbusinesses')
        .insert({
          user_id: user?.id,
          name: form.name,
          category: form.category,
          link: form.link,
          address: form.address,
          phone: form.phone,
          description: form.description,
          avatar_url: avatarUrl,
          rating: form.rating ? parseFloat(form.rating) : null,
          payment_status: 'mock_paid',
          status: 'pending' 
        });

      if (error) throw error;
      
      Alert.alert("Submitted!", "Your business has been submitted for moderation. It will appear once approved.");
      setShowModal(false);
      setForm({ name: '', category: 'Retail', link: '', address: '', phone: '', description: '', avatar: null, rating: null });
      fetchBusinesses();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to save business details.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenLink = async (url) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      Alert.alert("Error", "Cannot open link");
    }
  };

  const filteredBusinesses = businesses.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayBusinesses = useMemo(() => {
    return filteredBusinesses;
  }, [filteredBusinesses]);

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => handleOpenLink(item.link)}
        style={styles.card}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardMain}>
            <View style={styles.categoryRow}>
              <Text style={styles.categoryText}>{item.category?.toUpperCase() || 'BUSINESS'}</Text>
              {item.rating ? (
                <View style={styles.ratingBadge}>
                  <Star size={10} color="#FBBF24" fill="#FBBF24" />
                  <Text style={styles.ratingText}>{item.rating}</Text>
                </View>
              ) : null}
            </View>
            
            <Text style={styles.businessNameText}>{item.name}</Text>
            
            {item.address ? (
              <View style={styles.infoRow}>
                <MapPin size={12} color="rgba(255,255,255,0.4)" />
                <Text style={styles.infoText} numberOfLines={1}>{item.address}</Text>
              </View>
            ) : null}

            {item.description ? (
              <Text style={styles.descText} numberOfLines={2}>{item.description}</Text>
            ) : null}

            <View style={styles.actionRow}>
              <View style={styles.visitAction}>
                <Text style={styles.visitText}>VIEW ON MAPS</Text>
                <ExternalLink size={12} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              {item.phone ? (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)} style={styles.phoneAction}>
                  <Phone size={14} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          
          <View style={styles.cardSide}>
            <Image 
              source={{ uri: item.avatar_url || `https://avatar.vercel.sh/${item.name}.png` }} 
              style={styles.businessAvatar} 
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMapView = () => {
    // Collect businesses with valid coordinates (mocked if not present for this exercise, or used if available)
    // For now, we'll show a centered map with markers for all businesses
    return (
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 52.3082, // Redditch center
          longitude: -1.9427,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        userInterfaceStyle="dark"
      >
        {filteredBusinesses.map((b) => (
          <Marker
            key={b.id}
            coordinate={{
              latitude: b.latitude || 52.3082 + (Math.random() - 0.5) * 0.01,
              longitude: b.longitude || -1.9427 + (Math.random() - 0.5) * 0.01,
            }}
            title={b.name}
            description={b.category}
          >
            <View style={{ backgroundColor: '#FFFFFF', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: '#000' }}>
               <Briefcase size={16} color="#000" />
            </View>
            <Callout onPress={() => handleOpenLink(b.link)}>
              <View style={{ padding: 10, width: 200 }}>
                <Text style={{ fontWeight: 'bold' }}>{b.name}</Text>
                <Text style={{ fontSize: 12 }}>{b.category}</Text>
                <Text style={{ fontSize: 10, marginTop: 5, color: '#666' }}>Tap to view on Google Maps</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#000000', '#000000']}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ paddingTop: insets.top, flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft color="#FFFFFF" size={24} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>LOCAL BUSINESSES</Text>
          <TouchableOpacity 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode(v => v === 'list' ? 'map' : 'list');
            }}
            style={styles.backButton}
          >
            <MapPin color={viewMode === 'map' ? "#4ADE80" : "#FFFFFF"} size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search size={18} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search local businesses..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : (
            viewMode === 'list' ? (
                <FlatList
                  data={displayBusinesses}
                  renderItem={renderItem}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={styles.listContent}
                  ListFooterComponent={displayBusinesses.length > 0 ? <BannerAd /> : null}
                  ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Briefcase size={48} color="rgba(255,255,255,0.1)" />
                    <Text style={styles.emptyText}>No businesses found.</Text>
                    <Text style={styles.emptySubtext}>Try a different search term.</Text>
                  </View>
                }
              />
          ) : renderMapView()
        )}

        <TouchableOpacity 
          style={[styles.fab, { bottom: insets.bottom + 20 }]} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowModal(true);
          }}
        >
          <Plus color="#000000" size={32} />
        </TouchableOpacity>
      </View>

      <Modal visible={showModal} animationType="slide" transparent>
        <BlurView intensity={100} tint="dark" style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>List Your Business</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.priceTag}>
                <ShieldCheck size={16} color="#10B981" />
                <Text style={styles.priceText}>Promote your business for £3.99</Text>
              </View>

              <Text style={styles.label}>BUSINESS LOGO</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {form.avatar ? (
                  <Image source={{ uri: form.avatar.uri }} style={styles.pickedImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Camera size={24} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.imagePlaceholderText}>Upload Logo</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.label}>GOOGLE MAPS LINK</Text>
              <View style={styles.linkInputContainer}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Paste Google Maps URL..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="none"
                  value={form.link}
                  onChangeText={(t) => setForm({ ...form, link: t })}
                />
                <TouchableOpacity 
                  style={styles.processButton} 
                  onPress={processGoogleLink}
                  disabled={processingLink}
                >
                  {processingLink ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Globe size={18} color="#000" />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.hintText}>We'll try to fetch details from the link</Text>

              <Text style={styles.label}>BUSINESS NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Redditch Coffee Co."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
              />

              <Text style={styles.label}>CATEGORY</Text>
              <View style={styles.tagRow}>
                {['Cafe', 'Restaurant', 'Retail', 'Service', 'Health', 'Other'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setForm({ ...form, category: c })}
                    style={[styles.tag, form.category === c && styles.activeTag]}
                  >
                    <Text style={[styles.tagText, { color: form.category === c ? "#000000" : "#FFFFFF" }]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>ADDRESS (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="123 High Street, Redditch"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={form.address}
                onChangeText={(t) => setForm({ ...form, address: t })}
              />

              <Text style={styles.label}>PHONE (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="01234 567890"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(t) => setForm({ ...form, phone: t })}
              />

              <Text style={styles.label}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What makes your business special?"
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                numberOfLines={4}
                value={form.description}
                onChangeText={(t) => setForm({ ...form, description: t })}
              />

              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.submitButtonText}>PAY £3.99 & SUBMIT</Text>
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
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
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
    paddingBottom: 120,
  },
  card: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardMain: {
    flex: 1,
    paddingRight: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  categoryText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
  },
  businessNameText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  infoText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  descText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    fontWeight: '400',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginTop: 20,
  },
  visitAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingBottom: 4,
  },
  visitText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  phoneAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardSide: {
    alignItems: 'center',
  },
  businessAvatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#FFFFFF',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
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
    backgroundColor: '#000000',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 30,
    maxHeight: '92%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: -0.5,
  },
  closeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '500',
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 32,
    gap: 10,
  },
  priceText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '400',
  },
  label: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
    marginTop: 20,
  },
  hintText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 10,
    marginTop: 4,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 17,
    marginBottom: 10,
  },
  linkInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  processButton: {
    backgroundColor: '#FFFFFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeTag: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    padding: 20,
    alignItems: 'center',
    marginTop: 40,
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  imagePicker: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  pickedImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    gap: 4,
  },
  imagePlaceholderText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '600',
  },
});
