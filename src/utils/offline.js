import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { supabase } from './supabase';

const OFFLINE_POSTS_KEY = '@offline_posts';
const OFFLINE_CACHE_KEY = '@offline_cache';

export const offlineStorage = {
  async getPendingPosts() {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_POSTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error getting pending posts:', e);
      return [];
    }
  },

  async savePendingPost(post) {
    try {
      const pending = await this.getPendingPosts();
      const newPost = {
        ...post,
        id: `offline_${Date.now()}`,
        created_at: new Date().toISOString(),
        isPending: true,
      };
      pending.push(newPost);
      await AsyncStorage.setItem(OFFLINE_POSTS_KEY, JSON.stringify(pending));
      return newPost;
    } catch (e) {
      console.error('Error saving pending post:', e);
      throw e;
    }
  },

  async removePendingPost(offlineId) {
    try {
      const pending = await this.getPendingPosts();
      const filtered = pending.filter(p => p.id !== offlineId);
      await AsyncStorage.setItem(OFFLINE_POSTS_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Error removing pending post:', e);
    }
  },

  async getCachedData(key) {
    try {
      const cache = await AsyncStorage.getItem(OFFLINE_CACHE_KEY);
      const data = cache ? JSON.parse(cache) : {};
      return data[key];
    } catch (e) {
      console.error('Error getting cached data:', e);
      return null;
    }
  },

  async setCachedData(key, value) {
    try {
      const cache = await AsyncStorage.getItem(OFFLINE_CACHE_KEY);
      const data = cache ? JSON.parse(cache) : {};
      data[key] = { value, timestamp: Date.now() };
      await AsyncStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Error setting cached data:', e);
    }
  },
};

export const syncService = {
  async syncPendingPosts() {
    const isConnected = await checkNetworkStatus();
    if (!isConnected) return { synced: 0, failed: 0 };

    const pending = await offlineStorage.getPendingPosts();
    let synced = 0;
    let failed = 0;

    for (const post of pending) {
      try {
        const { isPending, id: offlineId, ...postData } = post;
        
        let imageUrls = [];
        if (postData.localMedia && postData.localMedia.length > 0) {
          for (const item of postData.localMedia) {
            if (item.fromRemote) {
              imageUrls.push(item.uri);
              continue;
            }
            const fileExt = item.uri.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const arrayBuffer = await (await fetch(item.uri)).arrayBuffer();
            await supabase.storage.from('posts').upload(fileName, arrayBuffer);
            imageUrls.push(supabase.storage.from('posts').getPublicUrl(fileName).data.publicUrl);
          }
        }

        const dbPostData = {
          title: postData.title,
          text: postData.text,
          zone_id: postData.zone_id,
          tag_id: postData.tag_id,
          device_id: postData.device_id,
          user_id: postData.user_id,
          is_anonymous: postData.is_anonymous,
          image_url: imageUrls[0] || null,
          image_urls: imageUrls,
          poll_id: postData.poll_id || null,
          moderation_status: postData.moderation_status,
        };

        const { error } = await supabase.from('rposts').insert(dbPostData);
        if (error) throw error;

        await offlineStorage.removePendingPost(offlineId);
        synced++;
      } catch (e) {
        console.error('Error syncing post:', e);
        failed++;
      }
    }

    return { synced, failed };
  },
};

export async function checkNetworkStatus() {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected && state.isInternetReachable;
  } catch (e) {
    return false;
  }
}

export function subscribeToNetworkChanges(callback) {
  const handler = async (nextAppState) => {
    if (nextAppState === 'active') {
      const isConnected = await checkNetworkStatus();
      callback(isConnected);
    }
  };

  const subscription = AppState.addEventListener('change', handler);

  // Since expo-network doesn't have a listener, we also do a one-time check
  checkNetworkStatus().then(callback);

  return () => {
    subscription.remove();
  };
}
