import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { ShareCard } from './ShareCard';
import { toast } from 'sonner-native';
import { supabase } from '../utils/supabase';
import { getStoredUser } from '../utils/user';
import { sendNotification, sendShareNotification } from '../utils/notifications';

export const ShareManager = forwardRef((props, ref) => {
  const [sharingPost, setSharingPost] = useState(null);
  const viewRef = useRef();

  const trackShare = async (post) => {
    try {
      const user = await getStoredUser();
      await supabase.from('rshares').insert({
        post_id: post.id,
        user_id: user?.id || null
      });

      if (post.user_id && post.user_id !== user?.id) {
        await sendShareNotification({
          sharerUsername: user?.username || 'Someone',
          sharerId: user?.id,
          postOwnerId: post.user_id,
          postId: post.id,
          postTitle: post.title
        });
      }
    } catch (error) {
      console.error("Failed to track share:", error);
    }
  };

  useImperativeHandle(ref, () => ({
    share: async (post) => {
      setSharingPost(post);
      
      toast.info("Generating shareable card...");
      
        setTimeout(async () => {
          try {
            if (!viewRef.current) {
              throw new Error("View is not mounted yet");
            }

            const uri = await captureRef(viewRef.current, {
              format: 'png',
              quality: 1,
              result: 'tmpfile',
              useRenderInContext: true,
            });

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: 'image/png',
              dialogTitle: `Share "${post.title}"`,
              UTI: 'public.png',
            });
            await trackShare(post);
          } else {
            toast.error("Sharing is not available on this device");
          }
        } catch (error) {
          console.error("Capture failed:", error);
          toast.error("Failed to generate share image");
        } finally {
          setSharingPost(null);
        }
      }, 500);
    }
  }));

  if (!sharingPost) return null;

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <View ref={viewRef} collapsable={false}>
        <ShareCard post={sharingPost} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
    zIndex: -1000,
    pointerEvents: 'none',
  }
});
