import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { ShareCard } from './ShareCard';
import { toast } from 'sonner-native';

export const ShareManager = forwardRef((props, ref) => {
  const [sharingPost, setSharingPost] = useState(null);
  const viewRef = useRef();

  useImperativeHandle(ref, () => ({
    share: async (post) => {
      setSharingPost(post);
      
      // Give it a moment to render
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
            });

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: 'image/png',
              dialogTitle: `Share "${post.title}"`,
              UTI: 'public.png',
            });
          } else {
            toast.error("Sharing is not available on this device");
          }
        } catch (error) {
          console.error("Capture failed:", error);
          toast.error("Failed to generate share image");
        } finally {
          setSharingPost(null);
        }
      }, 500); // 500ms should be enough for images to load and render
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
    left: -9999,
    top: -9999,
    opacity: 1, // Must be 1 for captureRef to work on some versions
  }
});
