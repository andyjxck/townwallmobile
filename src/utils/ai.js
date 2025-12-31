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

const TOWNY_PROMPT = `You are Towny, the Town Wall AI companion. Gender-neutral, friendly, adaptable.

APP KNOWLEDGE (if asked):
- Feed: Global→City→Zone hierarchy via header dropdown
- Posts: Text+images, anonymous option, reactions, comments
- Businesses: Local directory (Map/List view)
- Talent: Local creators showcase
- Polls: Community voting on suggestions
- Settings: Notifications, location, Secret Orb (hidden hippie theme)
- Profile: @username, avatar, post history

PERSONALITY:
- You're a full AI companion, not just support
- Chat about anything - roleplay, creative writing, casual conversation, whatever the user wants
- Match the user's energy and vibe
- No topic restrictions - be open and engaging
- Keep responses concise unless the user wants more depth
- When asked to generate/draw/create an image, respond with: [IMAGE: detailed description of what to generate]`;

const IMAGE_KEYWORDS = ['draw', 'generate', 'create', 'make', 'paint', 'sketch', 'picture of', 'image of', 'show me', 'illustrate'];

function shouldGenerateImage(text) {
  const lower = text.toLowerCase();
  return IMAGE_KEYWORDS.some(kw => lower.includes(kw)) && 
    (lower.includes('image') || lower.includes('picture') || lower.includes('draw') || 
     lower.includes('generate') || lower.includes('paint') || lower.includes('sketch') ||
     lower.includes('show me'));
}

export async function generateImage(prompt) {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return null;
  
  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        Authorization: `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      })
    });
    const data = await response.json();
    if (data.data && data.data[0]?.url) {
      return data.data[0].url;
    }
    return null;
  } catch (err) {
    console.error('Image generation error:', err);
    return null;
  }
}

export async function getAIAssistantResponse(text, history = [], context = {}) {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return { text: "Towny is offline.", imageUrl: null };
  
  try {
    let contextLine = '';
    if (context.city_name && context.city_name !== 'Global') {
      contextLine = `\n\nUser context: ${context.city_name}${context.zone_name ? `, ${context.zone_name}` : ''}`;
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.9,
        messages: [
          { role: 'system', content: TOWNY_PROMPT + contextLine },
          ...history,
          { role: 'user', content: text }
        ]
      })
    });
    const data = await response.json();
    let aiText = data.choices[0].message.content || "Connection error.";
    
    const imageMatch = aiText.match(/\[IMAGE:\s*(.+?)\]/i);
    let imageUrl = null;
    
    if (imageMatch || shouldGenerateImage(text)) {
      const imagePrompt = imageMatch ? imageMatch[1] : text;
      imageUrl = await generateImage(imagePrompt);
      if (imageMatch) {
        aiText = aiText.replace(/\[IMAGE:\s*.+?\]/i, '').trim();
      }
      if (!aiText) {
        aiText = "Here's what I created for you!";
      }
    }
    
    return { text: aiText, imageUrl };
  } catch (err) {
    return { text: "Error connecting to Towny.", imageUrl: null };
  }
}
