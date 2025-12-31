import { supabase } from './supabase';
import { sendFriendAcceptedNotification } from './notifications';

export const fetchPendingRequests = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('friends')
      .select('id, user_id, rusers!friends_user_id_fkey(id, username, emoji_icon, avatar_url)')
      .eq('friend_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    return data?.map(r => ({ ...r.rusers, requestId: r.id })) || [];
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    return [];
  }
};

export const acceptFriendRequest = async (requestId, userId, friendId, username) => {
  try {
    // Update the existing request to accepted
    const { error: updateError } = await supabase
      .from('friends')
      .update({ status: 'accepted' })
      .eq('id', requestId);
    
    if (updateError) throw updateError;

    // Create the reciprocal friendship record (if not self-friending)
    if (userId !== friendId) {
      const { error: insertError } = await supabase
        .from('friends')
        .insert({ user_id: userId, friend_id: friendId, status: 'accepted' });
      
      if (insertError) throw insertError;
    }

      // Send notification to the requester
      await sendFriendAcceptedNotification({
        acceptorId: userId,
        acceptorUsername: username,
        requesterId: friendId
      });

      // Auto-accept any pending chats between these two users
      const { data: existingChat } = await supabase
        .from('rchats')
        .select('id, status')
        .or(`and(user1_id.eq.${userId},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${userId})`)
        .maybeSingle();

      if (existingChat) {
        if (existingChat.status === 'pending') {
          await supabase
            .from('rchats')
            .update({ status: 'accepted' })
            .eq('id', existingChat.id);
        }
      } else {
        // Create a new accepted chat if none exists
        await supabase
          .from('rchats')
          .insert({
            user1_id: Math.min(userId, friendId),
            user2_id: Math.max(userId, friendId),
            last_message: "You are now friends!",
            status: 'accepted',
            initiated_by: userId
          });
      }

      // Also find and mark the friend_request notification as read for this user
    await supabase
      .from('rnotifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('type', 'friend_request')
      .ilike('message', `%${username}%`); // This is a bit loose but okay for now

    return { success: true };
  } catch (error) {
    console.error('Error accepting friend request:', error);
    return { success: false, error };
  }
};

export const rejectFriendRequest = async (requestId) => {
  try {
    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('id', requestId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    return { success: false, error };
  }
};
