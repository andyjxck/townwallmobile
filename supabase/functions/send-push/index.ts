import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

serve(async (req) => {
  try {
    const { record } = await req.json()
    const { user_id, title, message, type, link } = record

    // Initialize Supabase Client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user's push token and online status
    const { data: user, error: userError } = await supabase
      .from('rusers')
      .select('push_token, last_seen')
      .eq('id', user_id)
      .single()

    if (userError || !user?.push_token) {
      return new Response(JSON.stringify({ skipped: true, reason: 'No token or user' }), { status: 200 })
    }

    // Check if user is offline (inactive for > 1 minute)
    const lastSeen = user.last_seen ? new Date(user.last_seen).getTime() : 0
    const now = new Date().getTime()
    const isOnline = (now - lastSeen) < 60000

    if (isOnline) {
      return new Response(JSON.stringify({ skipped: true, reason: 'User is online' }), { status: 200 })
    }

    // Send to Expo
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: user.push_token,
        title: title,
        body: message,
        data: { type, link },
        sound: 'default',
        priority: 'high',
      }),
    })

    const result = await res.json()
    return new Response(JSON.stringify(result), { status: 200 })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
