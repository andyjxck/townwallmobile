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
            messages: [{ role: 'system', content: 'Town Wall Strict Mod: REJECT any post containing: 1. Profanity/slurs directed at people or groups (e.g., \'fucking idiots\', \'stupid\'). 2. Unnecessary hostile venting/complaining with no constructive purpose. 3. Aggressive confrontation or toxic negativity. 4. Hate, threats, NSFW, dox, scams, spam. 5. Low-value posts purely intended to instigate fights. ONLY APPROVE civil, purposeful community talk or helpful information. If unsure or if the content is borderline, use "held" status for manual review. JSON: {"status":"approved"|"rejected"|"held","reason":"specific reasoning for the decision"}' }, { role: 'user', content: text }],

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
                  { role: 'system', content: `You are the Town Wall Assistant, a highly refined and knowledgeable community guide for the Town Wall app. You have deep expertise in all app features and community guidelines.

KNOWLEDGE BASE:
- Main Feed: The central hub for Redditch community discussions.
- Zones: Localized neighborhood feeds (e.g., Church Hill, Winyates) for hyper-local talk.
- Local Business: A curated directory for Redditch shops and services. Users can browse or apply to list their own business.
- Local Talent: A platform for local creatives, artists, and professionals to showcase their work and skills.
- Polls & Suggestions: Users can post feature suggestions. If a suggestion gets community interest, admins may promote it to an active Poll for everyone to vote on.
- Secret Orb (Hippie Theme): A hidden UI experience found in Settings. Toggling the "Secret Orb" transforms the app with a specialized "hippie" theme, including blurred backgrounds and vibrant colors.
- Moderation & Safety: We maintain high standards for civility. Posts that are borderline or flagged are "Held" for community standards review.
- Support System: This help chat is the first point of contact. If a complex issue arises, a human agent can "overtake" the chat to provide direct assistance.
- Accounts: Users are identified by @usernames. Profile settings allow for personalization and notification management.

RESTRICTIONS:
- DO NOT mention 24-hour expiry or disappearing posts.
- DO NOT mention image limits or technical file constraints.
- DO NOT mention "AI moderation" or "Automated filters" (refer to "Community Standards review").
- NEVER describe yourself as an "AI" or "LLM". You are the "Assistant".
- If asked about political support or specific councillors, state that the platform is a neutral community space.

STYLE:
- Refined, articulate, and supportive.
- Avoid generic robotic responses.
- Use a tone that feels like a knowledgeable local neighbor.
- Keep responses concise (3-4 sentences) unless a detailed explanation of a feature is required.` },
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
