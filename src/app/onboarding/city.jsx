import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import { useLocationStore } from "../../utils/locationStore";
  import { setOnboardingComplete } from "../../utils/onboarding";
  import {
    detectLocation,
    fetchCities,
    findCityByName,
    fetchZonesForCity,
  } from "../../utils/location";

export default function CityScreen() {
  const router = useRouter();
  const { mode, global: globalParam } = useLocalSearchParams();
  const { setCity } = useLocationStore();
  
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [cities, setCities] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showNotUKMessage, setShowNotUKMessage] = useState(false);
  const [detectedCity, setDetectedCity] = useState(null);

  useEffect(() => {
    if (globalParam === 'true') {
      handleAutoSelectGlobal();
    } else {
      loadCities();
      if (mode !== 'manual') {
        attemptAutoDetectionOnce();
      }
    }
  }, [mode, globalParam]);

  const handleAutoSelectGlobal = async () => {
    setLoading(true);
    const globalCity = await findCityByName('Global');
    if (globalCity) {
      setCity({
        id: globalCity.id,
        name: globalCity.name,
        source: "manual",
      });
      await setOnboardingComplete(true);
      router.replace("/");
    } else {
      loadCities();
    }
  };

  const attemptAutoDetectionOnce = async () => {
    try {
      const attempted = await AsyncStorage.getItem('@auto_location_attempted');
      if (!attempted) {
        await attemptAutoDetection();
        await AsyncStorage.setItem('@auto_location_attempted', 'true');
      }
    } catch (e) {
      console.error('Error in auto detection check:', e);
      await attemptAutoDetection();
    }
  };

  const loadCities = async () => {
    const citiesData = await fetchCities();
    setCities(citiesData);
    setLoading(false);
  };

  const attemptAutoDetection = async () => {
    setDetecting(true);
    const result = await detectLocation();
    setDetecting(false);

    if (result.success) {
      if (result.isUK) {
        const matchedCity = await findCityByName(result.city);
        if (matchedCity) {
          setDetectedCity(matchedCity);
          setSelectedCity(matchedCity);
          setShowConfirmModal(true);
        }
      } else {
        setShowNotUKMessage(true);
      }
    }
  };

  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return cities;
    const query = searchQuery.toLowerCase();
    return cities.filter((city) =>
      city.name.toLowerCase().includes(query)
    );
  }, [cities, searchQuery]);

  const handleCitySelect = (city) => {
    setSelectedCity(city);
    setShowConfirmModal(true);
  };

    const handleConfirm = async () => {
      if (selectedCity) {
        setCity({
          id: selectedCity.id,
          name: selectedCity.name,
          source: detectedCity?.id === selectedCity.id ? "auto" : "manual",
        });
        
        // Check if city has zones
        const zones = await fetchZonesForCity(selectedCity.id);
        if (zones && zones.length > 0) {
          setShowConfirmModal(false);
          router.push("/onboarding/zones");
        } else {
          await setOnboardingComplete(true);
          setShowConfirmModal(false);
          router.replace("/");
        }
      }
    };

  const handleChangeCity = () => {
    setShowConfirmModal(false);
    setSelectedCity(null);
  };

  const handleNotFromUK = async () => {
    const globalCity = cities.find(c => c.name.toLowerCase() === 'global');
    if (globalCity) {
      setCity({
        id: globalCity.id,
        name: globalCity.name,
        source: "auto",
      });
      
      const zones = await fetchZonesForCity(globalCity.id);
      if (zones && zones.length > 0) {
        router.push("/onboarding/zones");
      } else {
        await setOnboardingComplete(true);
        router.replace("/");
      }
    }
  };

  const renderCityItem = ({ item }) => (
    <TouchableOpacity
      style={styles.cityItem}
      onPress={() => handleCitySelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cityContent}>
        <Ionicons name="location-outline" size={20} color="#4ADE80" />
        <Text style={styles.cityName}>{item.name}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ADE80" />
      </View>
    );
  }

  return (
    <LinearGradient colors={["#000", "#0a0a0a"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Town</Text>
          <Text style={styles.subtitle}>
            Town Wall connects you with your local community
          </Text>
        </View>

{showNotUKMessage && (
            <View style={styles.notUKBanner}>
              <Ionicons name="information-circle" size={20} color="#FFA500" />
              <View style={styles.notUKContent}>
                <Text style={styles.notUKText}>
                  Are you from the UK?
                </Text>
                <View style={styles.notUKButtons}>
                  <TouchableOpacity
                    style={styles.notUKButtonYes}
                    onPress={() => setShowNotUKMessage(false)}
                  >
                    <Text style={styles.notUKButtonYesText}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.notUKButtonNo}
                    onPress={handleNotFromUK}
                  >
                    <Text style={styles.notUKButtonNoText}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

        {detecting && (
          <View style={styles.detectingBanner}>
            <ActivityIndicator size="small" color="#4ADE80" />
            <Text style={styles.detectingText}>
              Finding your community...
            </Text>
          </View>
        )}

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search towns..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filteredCities}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCityItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No towns found</Text>
            </View>
          }
        />

        <Modal
          visible={showConfirmModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConfirmModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIcon}>
                <Ionicons name="location" size={40} color="#4ADE80" />
              </View>
              <Text style={styles.modalTitle}>Your town is set to:</Text>
              <Text style={styles.modalCityName}>{selectedCity?.name}</Text>
              <Text style={styles.modalDescription}>
                You'll see posts and content from this community
              </Text>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={handleChangeCity}
                activeOpacity={0.8}
              >
                <Text style={styles.changeButtonText}>Change town</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    lineHeight: 22,
  },
  notUKBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(255, 165, 0, 0.1)",
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  notUKContent: {
    flex: 1,
  },
  notUKText: {
    fontSize: 14,
    color: "#FFA500",
    lineHeight: 20,
    marginBottom: 12,
  },
  notUKButtons: {
    flexDirection: "row",
    gap: 10,
  },
  notUKButtonYes: {
    backgroundColor: "#4ADE80",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  notUKButtonYesText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 14,
  },
  notUKButtonNo: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  notUKButtonNoText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  detectingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  detectingText: {
    fontSize: 14,
    color: "#4ADE80",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    marginHorizontal: 20,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 16,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
    height: "100%",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cityItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  cityContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cityName: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    color: "#888",
    marginBottom: 8,
  },
  modalCityName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  confirmButton: {
    backgroundColor: "#4ADE80",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  changeButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  changeButtonText: {
    fontSize: 16,
    color: "#4ADE80",
  },
});
