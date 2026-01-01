import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VERSION = "007"
const VERSION_LENGTH = 3
const APP_ID_LENGTH = 32

enum Privileges {
  kJoinChannel = 1,
  kPublishAudioStream = 2,
  kPublishVideoStream = 3,
  kPublishDataStream = 4,
}

function packUint16(val: number): Uint8Array {
  const buf = new Uint8Array(2)
  buf[0] = val & 0xff
  buf[1] = (val >> 8) & 0xff
  return buf
}

function packUint32(val: number): Uint8Array {
  const buf = new Uint8Array(4)
  buf[0] = val & 0xff
  buf[1] = (val >> 8) & 0xff
  buf[2] = (val >> 16) & 0xff
  buf[3] = (val >> 24) & 0xff
  return buf
}

function packString(str: string): Uint8Array {
  const strBytes = new TextEncoder().encode(str)
  const lenBytes = packUint16(strBytes.length)
  const result = new Uint8Array(lenBytes.length + strBytes.length)
  result.set(lenBytes, 0)
  result.set(strBytes, lenBytes.length)
  return result
}

function packMapUint32(map: Map<number, number>): Uint8Array {
  const parts: Uint8Array[] = []
  parts.push(packUint16(map.size))
  map.forEach((value, key) => {
    parts.push(packUint16(key))
    parts.push(packUint32(value))
  })
  const totalLength = parts.reduce((acc, part) => acc + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

async function hmacSign(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message)
  return new Uint8Array(signature)
}

function generateRandomSalt(): number {
  return Math.floor(Math.random() * 0xffffffff)
}

async function buildTokenWithUid(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
  role: number,
  privilegeExpiredTs: number
): Promise<string> {
  const salt = generateRandomSalt()
  const ts = Math.floor(Date.now() / 1000)
  
  const privileges = new Map<number, number>()
  privileges.set(Privileges.kJoinChannel, privilegeExpiredTs)
  if (role === 1) {
    privileges.set(Privileges.kPublishAudioStream, privilegeExpiredTs)
    privileges.set(Privileges.kPublishVideoStream, privilegeExpiredTs)
    privileges.set(Privileges.kPublishDataStream, privilegeExpiredTs)
  }

  const uidStr = uid === 0 ? "" : String(uid)
  
  const message = concat(
    packUint32(salt),
    packUint32(ts),
    packMapUint32(privileges)
  )
  
  const toSign = concat(
    new TextEncoder().encode(appId),
    new TextEncoder().encode(channelName),
    new TextEncoder().encode(uidStr),
    message
  )
  
  const signature = await hmacSign(new TextEncoder().encode(appCertificate), toSign)
  
  const content = concat(
    packString(signature.reduce((str, byte) => str + String.fromCharCode(byte), '')),
    packUint32(salt),
    packUint32(ts),
    packMapUint32(privileges)
  )
  
  const contentBase64 = encodeBase64(content)
  
  return VERSION + appId + contentBase64
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { channelName, uid, role = 'publisher' } = await req.json()

    if (!channelName) {
      return new Response(JSON.stringify({ error: 'channelName is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const appId = Deno.env.get('AGORA_APP_ID')
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE')

    if (!appId || !appCertificate) {
      return new Response(JSON.stringify({ error: 'Agora credentials not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const expirationSeconds = 3600
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const privilegeExpiredTs = currentTimestamp + expirationSeconds

    const agoraRole = role === 'publisher' ? 1 : 2

    const token = await buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      Number(uid) || 0,
      agoraRole,
      privilegeExpiredTs
    )

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
