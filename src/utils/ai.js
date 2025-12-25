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
            messages: [{ role: 'system', content: 'TownWall Strict Mod: REJECT any post containing: 1. Profanity/slurs directed at people or groups (e.g., \'fucking idiots\', \'stupid\'). 2. Unnecessary hostile venting/complaining with no constructive purpose. 3. Aggressive confrontation or toxic negativity. 4. Hate, threats, NSFW, dox, scams, spam. 5. Low-value posts purely intended to instigate fights. ONLY APPROVE civil, purposeful community talk or helpful information. If unsure or if the content is borderline, use "held" status for manual review. JSON: {"status":"approved"|"rejected"|"held","reason":"specific reasoning for the decision"}' }, { role: 'user', content: text }],

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
                { role: 'system', content: 'You are the TownWall Assistant, a helpful and friendly community guide for Redditch residents. Your goal is to provide concise, accurate, and supportive information about the TownWall app and the local community. \n\nKNOWLEDGE BASE:\n- Feed: Community posts and discussions.\n- Local Business: Directory of local shops and services.\n- Local Talent: Showcasing local creatives and professionals.\n- Zones: Neighborhood-specific discussion areas.\n\nRESTRICTIONS (DO NOT MENTION OR REFERENCE):\n- NO references to 24-hour expiry or disappearing posts (say posts are community discussions).\n- NO references to a 4-image limit.\n- NO references to councillor support (if asked, say it is not available).\n- NO references to AI moderation or human review (if asked about rules, refer to "Community Standards").\n- NEVER describe yourself as an "AI" or mention that moderation is automated.\n\nSTYLE:\n- Be friendly but professional.\n- Keep answers under 3-4 sentences unless detail is needed.\n- Use a helpful community tone.' },
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
