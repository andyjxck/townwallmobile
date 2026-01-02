import { supabase } from './supabase';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isOnline } from './user';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    if (data?.type === 'call') {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    }
    return {
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: true,
    };
  },
});

let hasLoggedDeviceWarning = false;

export async function registerForPushNotificationsAsync(userId) {
  let token;
  
  if (Platform.OS === 'web') {
    return null;
  }

  if (!Device.isDevice) {
    if (!hasLoggedDeviceWarning) {
      console.log('Push notifications require a physical device');
      hasLoggedDeviceWarning = true;
    }
    return null;
  }

    try {
      // 0. Register notification categories
      if (Platform.OS !== 'web') {
        await Notifications.setNotificationCategoryAsync('call', [
          {
            identifier: 'accept',
            buttonTitle: 'Accept',
            options: {
              opensAppToForeground: true,
            },
          },
          {
            identifier: 'decline',
            buttonTitle: 'Decline',
            options: {
              isDestructive: true,
              opensAppToForeground: false,
            },
          },
        ]);
      }

      // 1. Setup channels FIRST on Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22C55E',
      });
      
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22C55E',
        sound: 'message.mp3',
      });

      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22C55E',
        sound: 'ringtone.mp3',
      });

      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22C55E',
        sound: 'alert.mp3',
      });
    }

    // 2. Check/Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // 3. Get Project ID
    const projectId = 
      Constants.expoConfig?.extra?.eas?.projectId ?? 
      Constants.easConfig?.projectId ??
      '3d185e44-e9e3-4196-9dc9-a45a2fdff729';
    
    if (!projectId) {
      console.error('CRITICAL: EAS Project ID not found. Push tokens cannot be generated.');
      return null;
    }

    // 4. Request token with a timeout/retry
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount <= maxRetries) {
      try {
        console.log(`Attempt ${retryCount + 1} to get push token with projectId:`, projectId);
        const tokenPromise = Notifications.getExpoPushTokenAsync({ projectId });
        // Give it 15 seconds to respond
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Token request timed out')), 15000));
        
        const response = await Promise.race([tokenPromise, timeoutPromise]);
        token = response.data;
        if (token) {
          console.log('Successfully generated token:', token);
          break;
        }
      } catch (e) {
        console.warn(`Attempt ${retryCount + 1} to get push token failed:`, e.message);
        retryCount++;
        if (retryCount <= maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        }
      }
    }

    if (!token) {
      console.error('Failed to generate Expo push token after retries');
      return null;
    }

    console.log('Generated Expo Push Token:', token);

    // 5. Update Supabase
    if (userId && token) {
      const { error: updateError } = await supabase
        .from('rusers')
        .update({ push_token: token })
        .eq('id', userId);
        
      if (updateError) {
        console.error('Error saving push token to database:', updateError);
      } else {
        console.log('Successfully saved push token for user:', userId);
      }
    }

  } catch (error) {
    console.error('Error in push notification registration flow:', error);
  }

  return token;
}

export async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken) return;
  
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    const result = await response.json();
    if (result.data?.status === 'error') {
      console.error('Push notification error:', result.data.message);
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

        export const sendNotification = async ({ userId, title, message, type, link, metadata }) => {
          try {
            // For reactions and shares, use a time-based window to prevent rapid spam
            // but still allow multiple different users to trigger notifications
            const isInteractionType = ['reaction', 'share'].includes(type);
            
            let query = supabase
              .from('rnotifications')
              .select('id')
              .eq('user_id', userId)
              .eq('type', type);
  
            if (isInteractionType) {
              // For reactions/shares, check if same message was sent recently (5 min window)
              // This allows different users to trigger notifications while preventing spam
              const timeWindow = new Date(Date.now() - 300000).toISOString();
              query = query.eq('message', message).gt('created_at', timeWindow);
            } else {
              // For others, use a 1-minute window
              const timeWindow = new Date(Date.now() - 60000).toISOString();
              query = query.eq('title', title).eq('message', message).gt('created_at', timeWindow);
            }
        
            const { data: existing } = await query.limit(1);
        
            if (existing && existing.length > 0) {
              console.log(`Skipping duplicate notification (type: ${type})`);
              return { success: true, skipped: true };
            }
    
        const { data: newNotification, error } = await supabase
          .from('rnotifications')
          .insert({
            user_id: userId,
            title,
            message,
            type,
            link,
            metadata
          })
          .select('*')
          .single();
    
        if (error) throw error;
    
        return { success: true, data: newNotification };
      } catch (error) {
        console.error('Error sending notification:', error);
        return { success: false, error };
      }
    };
  
  export const sendCallNotification = async ({ callerId, callerUsername, receiverId, callId, chatId }) => {
  try {
    const { data: receiverData } = await supabase
      .from('rusers')
      .select('push_token')
      .eq('id', receiverId)
      .single();

    if (receiverData?.push_token) {
      const message = {
        to: receiverData.push_token,
        sound: 'ringtone.mp3',
        title: `${callerUsername} is calling`,
        body: 'Tap to answer',
        data: {
          type: 'call',
          callId,
          chatId,
          callerId,
          callerUsername,
          link: '/chat',
        },
        priority: 'high',
        interruptionLevel: 'active',
        channelId: 'calls',
        categoryId: 'call',
        _displayInForeground: true,
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
    }

    return sendNotification({
      userId: receiverId,
      title: `${callerUsername} is calling`,
      message: 'Incoming audio call',
      type: 'call',
      link: '/chat',
      metadata: { callId, chatId, callerId }
    });
  } catch (error) {
    console.error('Error sending call notification:', error);
    return { success: false, error };
  }
};

export const sendMessageNotification = async ({ senderId, receiverId, senderUsername, messageText }) => {
    return sendNotification({
      userId: receiverId,
      title: `New message from @${senderUsername}`,
      message: messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText,
      type: 'message',
      link: `/chat`
    });
  };
  
  export const sendReactionNotification = async ({ reactorUsername, reactorId, postOwnerId, postId, postTitle, reactionType }) => {
    if (reactorId === postOwnerId) return { success: true, skipped: true };
    
    const reactionLabel = reactionType === 'helpful' ? 'liked' : reactionType === 'superlike' ? 'superliked' : 'reacted to';
    
    return sendNotification({
      userId: postOwnerId,
      title: `New ${reactionType === 'superlike' ? 'Superlike' : 'Like'}!`,
      message: `@${reactorUsername} ${reactionLabel} your post: "${postTitle || 'Untitled'}"`,
      type: 'reaction',
      link: `/post?id=${postId}`
    });
  };
  
  export const sendFriendRequestNotification = async ({ senderId, senderUsername, receiverId, requestId }) => {
    return sendNotification({
      userId: receiverId,
      title: 'New Friend Request!',
      message: `@${senderUsername} wants to be your friend`,
      type: 'friend_request',
      link: `/profile?userId=${senderId}`,
      metadata: { requestId, senderId, senderUsername }
    });
  };


export const sendFriendAcceptedNotification = async ({ acceptorId, acceptorUsername, requesterId }) => {
  return sendNotification({
    userId: requesterId,
    title: 'Friend Request Accepted!',
    message: `@${acceptorUsername} accepted your friend request`,
    type: 'friend_accepted',
    link: `/profile?userId=${acceptorId}`
  });
};

export const sendShareNotification = async ({ sharerUsername, sharerId, postOwnerId, postId, postTitle }) => {
  if (sharerId === postOwnerId) return { success: true, skipped: true };
  
  return sendNotification({
    userId: postOwnerId,
    title: 'Your Post Was Shared!',
    message: `@${sharerUsername} shared your post: "${postTitle || 'Untitled'}"`,
    type: 'share',
    link: `/post?id=${postId}`
  });
};

export const sendCommentNotification = async ({ commenterUsername, commenterId, postOwnerId, postId, postTitle, commentText }) => {
  if (commenterId === postOwnerId) return { success: true, skipped: true };
  
  return sendNotification({
    userId: postOwnerId,
    title: 'New Comment!',
    message: `@${commenterUsername} commented: "${commentText.length > 30 ? commentText.substring(0, 30) + '...' : commentText}"`,
    type: 'comment',
    link: `/post?id=${postId}`
  });
};

export const sendNewPostNotification = async ({ posterId, posterUsername, postId }) => {
  try {
    // Get all friends of the poster
    const { data: friendsList } = await supabase
      .from('friends')
      .select('friend_id')
      .eq('user_id', posterId)
      .eq('status', 'accepted');

    if (!friendsList || friendsList.length === 0) return { success: true, skipped: true };

    const notifications = friendsList.map(f => ({
      userId: f.friend_id,
      title: 'New Post!',
      message: `@${posterUsername} just shared a new post!`,
      type: 'new_post',
      link: `/post?id=${postId}`
    }));

    // Send notifications to all friends
    await Promise.all(notifications.map(n => sendNotification(n)));

    return { success: true };
  } catch (error) {
    console.error('Error sending new post notifications:', error);
    return { success: false, error };
  }
};

export const sendHelpMessageNotification = async ({ senderId, senderUsername, receiverId, isFromAdmin, messageContent }) => {
  return sendNotification({
    userId: receiverId,
    title: isFromAdmin ? 'Support Response' : `Help message from @${senderUsername}`,
    message: messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent,
    type: 'help_message',
    link: `/help`
  });
};

export const fetchNotifications = async (userId) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('rnotifications')
      .select('*')
      .eq('user_id', userId)
      .gt('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

export const markAsRead = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('rnotifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error };
  }
};

export const markAllAsRead = async (userId) => {
  try {
    const { error } = await supabase
      .from('rnotifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .neq('type', 'friend_request');

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error };
  }
};

export const getUnreadCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('rnotifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

export const subscribeToNotifications = (userId, onNewNotification) => {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'rnotifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNewNotification(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToUnreadCount = (userId, onCountChange) => {
  const fetchCount = async () => {
    const count = await getUnreadCount(userId);
    onCountChange(count);
  };

  fetchCount();

  const channel = supabase
    .channel(`unread_count:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rnotifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        fetchCount();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
