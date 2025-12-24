export async function moderateContent(text) {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey || !text?.trim()) return { status: 'approved', reason: '' };
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
            messages: [{ role: 'system', content: 'TownWall Strict Mod: REJECT any post containing: 1. Profanity/slurs directed at people or groups (e.g., \'fucking idiots\', \'stupid\'). 2. Unnecessary hostile venting/complaining with no constructive purpose. 3. Aggressive confrontation or toxic negativity. 4. Hate, threats, NSFW, dox, scams, spam. 5. Low-value posts purely intended to instigate fights. ONLY APPROVE civil, purposeful community talk or helpful information. JSON: {"status":"approved"|"rejected"|"flagged","reason":"specific reason"}' }, { role: 'user', content: text }],

        response_format: { type: 'json_object' }
      })
    });
    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return { status: result.status, reason: result.reason || '' };
  } catch (err) {
    return { status: 'flagged', reason: 'Moderation error' };
  }
}

export async function getAIAssistantResponse(text, history = []) {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return "Support offline.";
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
            messages: [
              { role: 'system', content: 'TownWall AI Hub Knowledge Base. Sections: Feed(community posts), Biz(business listings), Talent(services), Councillor(gov contact), Zones(neighborhood-specific feeds). POST ICONS: Heart(Helpful), Star(Seen), Flag(Fake/Report-blurs if >5 & >helpful+seen), Trash2(Delete-author/mod), VolumeX(Mute User-mod), Pencil(Edit Post-author), AlertTriangle(Misleading Banner), User(Anonymous/User Icon), Send(Reply/Comment), Share(Share Post), ChevronLeft/Right(Nav Images), X(Close). FEATURES: 24h auto-expiry for posts, Anonymous vs Public toggle, Hashtags, Multi-image(max 4), AI Auto-Mod. ROLES: Admin, Mod, User. Muted users cannot post or reply. ROLES: Admin/Mod see Trash2/VolumeX on all posts. Be extremely concise but know every detail. If asked about icons, list them exactly as defined here.' },
              ...history,
              { role: 'user', content: text }
            ]

      })
    });
    const data = await response.json();
    return data.choices[0].message.content || "Connection error.";
  } catch (err) {
    return "Error.";
  }
}
