const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

/**
 * Moderates content using OpenAI's moderation API or chat completions.
 * Returns { status: 'approved' | 'rejected' | 'flagged', reason: string }
 */
export async function moderateContent(text) {
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API Key not found. Skipping moderation.');
    return { status: 'approved', reason: 'No API Key' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI moderator for a community platform. 
            Analyze the following content and determine if it violates community guidelines (hate speech, harassment, illegal content, explicit adult content, spam, etc.).
            Return your response in JSON format with two fields: 
            "status": "approved", "rejected", or "flagged" (use "flagged" if unsure).
            "reason": A brief explanation of why the content was rejected or flagged, or empty if approved.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('AI Moderation Error:', error);
    return { status: 'approved', reason: 'Error during moderation' }; // Default to approved on error to not block users
  }
}

/**
 * Gets a response from the AI assistant.
 */
export async function getAIAssistantResponse(message, history = []) {
  if (!OPENAI_API_KEY) {
    return "I'm sorry, I don't have an API key configured to help you right now.";
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant and moderator for this platform. You can answer questions, help users navigate, and explain rules.',
          },
          ...history,
          {
            role: 'user',
            content: message,
          },
        ],
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('AI Assistant Error:', error);
    return "I'm having some trouble thinking right now. Please try again later.";
  }
}
