import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

serve(async (req) => {
    try {
      const body = await req.json()
      console.log('[send-push] Received payload:', JSON.stringify(body))
      
      // Handle different Supabase webhook formats or direct calls
      const record = body?.record || body?.old_record || body
      
      if (!record || typeof record !== 'object') {
        console.error('[send-push] Invalid payload: no record object found', JSON.stringify(body))
        return new Response(JSON.stringify({ error: 'Invalid payload: no record' }), { status: 400 })
      }

      const { user_id, title, message, type, link } = record
      
      if (!user_id) {
        console.error('[send-push] Invalid payload: missing user_id in record', JSON.stringify(record))
        return new Response(JSON.stringify({ error: 'Invalid payload: missing user_id' }), { status: 400 })
      }


    // Initialize Supabase Client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user's push token
    const { data: user, error: userError } = await supabase
      .from('rusers')
      .select('push_token, last_seen')
      .eq('id', user_id)
      .single()

    if (userError || !user?.push_token) {
      console.log(`[send-push] Skipped for user ${user_id}: No push token found.`)
      return new Response(JSON.stringify({ skipped: true, reason: 'No token or user' }), { status: 200 })
    }

    // Optional: Online check. We've relaxed this to 5 seconds to allow for testing
    // but still prevent spamming if the user is literally looking at the screen.
    const lastSeen = user.last_seen ? new Date(user.last_seen).getTime() : 0
    const now = new Date().getTime()
    const isVeryOnline = (now - lastSeen) < 5000 // Only skip if active in last 5 seconds

    if (isVeryOnline) {
      console.log(`[send-push] Skipped for user ${user_id}: User is active (last seen ${now - lastSeen}ms ago).`)
      return new Response(JSON.stringify({ skipped: true, reason: 'User is very online' }), { status: 200 })
    }

    // Send to Expo
    console.log(`[send-push] Sending push to user ${user_id}: "${title}"`)
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: user.push_token,
        title: title || 'New Notification',
        body: message || 'You have a new update', // Expo requires a non-null body
        data: { type, link },
        sound: 'default',
        priority: 'high',
      }),
    })

    const result = await res.json()
    console.log(`[send-push] Expo response:`, JSON.stringify(result))
    return new Response(JSON.stringify(result), { status: 200 })

  } catch (err) {
    console.error(`[send-push] Error:`, err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
