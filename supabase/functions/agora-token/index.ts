import { RtcTokenBuilder, RtcRole } from "npm:agora-token@latest";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const APP_ID = Deno.env.get("AGORA_APP_ID");
    const APP_CERTIFICATE = Deno.env.get("AGORA_APP_CERTIFICATE");

    if (!APP_ID || !APP_CERTIFICATE) {
      console.error("Missing Agora configuration: AGORA_APP_ID or AGORA_APP_CERTIFICATE not set in environment");
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: "Agora configuration missing. Please set AGORA_APP_ID and AGORA_APP_CERTIFICATE secrets in Supabase dashboard." 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const { channelName, uid, role } = await req.json();

    if (!channelName || uid === undefined) {
      return new Response(
        JSON.stringify({ ok: false, error: "channelName and uid are required" }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Token expires in 1 hour
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const roleEnum = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    console.log(`[Agora] Generating token for channel: ${channelName}, uid: ${uid}, role: ${role}`);

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      Number(uid),
      roleEnum,
      privilegeExpiredTs
    );

    return new Response(
      JSON.stringify({ ok: true, token }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[Agora] Unexpected error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
