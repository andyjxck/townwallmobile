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
        messages: [{ role: 'system', content: 'TownWall Mod. Reject: hate, threats, illegal, NSFW, scams, doxxing. Flag: toxicity, spam. Approve: civil local talk. JSON: {"status":"approved"|"rejected"|"flagged","reason":"short"}' }, { role: 'user', content: text }],
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
          { role: 'system', content: 'TownWall AI. Know: Feed (posts), Business (listings), Talent (services), Councillor (local gov), Zones (neighborhoods). Help users find local info. extremely concise (max 2 sentences).' },
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
