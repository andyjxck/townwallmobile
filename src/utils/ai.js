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
          messages: [{ role: 'system', content: 'TownWall Mod. Rules: No hate, threats, illegal, NSFW, dox, scams, spam. Approve: Civil local talk. Icons: Heart(Helpful), Star(Seen), Flag(Fake), Trash(Del), VolX(Mute). JSON: {"status":"approved"|"rejected"|"flagged","reason":"short"}' }, { role: 'user', content: text }],

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
            { role: 'system', content: 'TownWall AI Hub. Sections: Feed(posts), Biz(listings), Talent(services), Cllr(gov), Zones(areas). Icons: Heart(Helpful), Star(Seen), Flag(Fake-blurs if >5 & >helpful+seen), Trash(Del-author/mod), VolX(Mute-mod), Alert(Misleading), User(Anon), Send(Reply). Features: 24h post expiry, Anon/Public toggle, Hashtags, Multi-image(max 4), AI mod. Roles: Admin, Mod, User. Muted users can\'t post/reply. Be extremely concise but know every detail.' },
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
