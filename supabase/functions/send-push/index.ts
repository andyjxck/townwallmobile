import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

serve(async (req) => {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`[send-push] [${requestId}] Request received: ${req.method}`)

  try {
    const body = await req.json()
    console.log(`[send-push] [${requestId}] Received payload:`, JSON.stringify(body))
    
    // Handle different Supabase webhook formats or direct calls
    // Supabase webhooks wrap data in 'record', 'old_record'
    // Custom triggers might send raw row or wrapped in 'record'
    const record = body?.record || body?.old_record || (body?.user_id ? body : null)
    
    if (!record) {
      console.error(`[send-push] [${requestId}] Invalid payload: no record or user_id found in body`, JSON.stringify(body))
      return new Response(JSON.stringify({ error: 'Invalid payload: missing record or user_id' }), { status: 400 })
    }

    const { user_id, title, message, type, link } = record
    
    if (!user_id) {
      console.error(`[send-push] [${requestId}] Invalid payload: missing user_id in record`, JSON.stringify(record))
      return new Response(JSON.stringify({ error: 'Invalid payload: missing user_id' }), { status: 400 })
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseKey) {
      console.error(`[send-push] [${requestId}] Configuration error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing`)
      return new Response(JSON.stringify({ error: 'Internal configuration error' }), { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user's push token
    const { data: user, error: userError } = await supabase
      .from('rusers')
      .select('push_token, last_seen')
      .eq('id', user_id)
      .single()

    if (userError) {
      console.error(`[send-push] [${requestId}] Database error fetching user ${user_id}:`, userError.message)
      return new Response(JSON.stringify({ error: 'User not found or database error' }), { status: 404 })
    }

    if (!user?.push_token) {
      console.log(`[send-push] [${requestId}] Skipped for user ${user_id}: No push token found.`)
      return new Response(JSON.stringify({ skipped: true, reason: 'No push token' }), { status: 200 })
    }

    // Optional: Online check.
    const lastSeen = user.last_seen ? new Date(user.last_seen).getTime() : 0
    const now = new Date().getTime()
    const isVeryOnline = (now - lastSeen) < 5000 // Only skip if active in last 5 seconds

    if (isVeryOnline) {
      console.log(`[send-push] [${requestId}] Skipped for user ${user_id}: User is active (last seen ${now - lastSeen}ms ago).`)
      return new Response(JSON.stringify({ skipped: true, reason: 'User is active' }), { status: 200 })
    }

    // Map sound and channel based on notification type
    const sound = type === 'call' ? 'ringtone.mp3' : (type === 'message' ? 'message.mp3' : 'alert.mp3');
    const channelId = type === 'call' ? 'calls' : (type === 'message' ? 'messages' : 'default');

    // Send to Expo
    console.log(`[send-push] [${requestId}] Sending push to user ${user_id} token ${user.push_token.substring(0, 10)}...: "${title}"`)
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: user.push_token,
        title: title || 'New Notification',
        body: message || 'You have a new update', // Expo requires a non-null body
        data: { type, link, user_id },
        sound: sound,
        channelId: channelId,
        priority: 'high',
      }),
    })

    const result = await res.json()
    console.log(`[send-push] [${requestId}] Expo response:`, JSON.stringify(result))
    return new Response(JSON.stringify(result), { status: 200 })

  } catch (err) {
    console.error(`[send-push] [${requestId}] Global error:`, err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
