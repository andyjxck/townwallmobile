/**
 * Moderates content using OpenAI's moderation API or chat completions.
 * Returns { status: 'approved' | 'rejected' | 'flagged', reason: string }
 */
export async function moderateContent(text) {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OpenAI API Key not found. Skipping moderation.');
    return { status: 'approved', reason: 'No API Key' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
    if (data.error) {
       console.error('OpenAI Moderation Error:', data.error);
       return { status: 'approved', reason: 'API Error' };
    }
    const result = JSON.parse(data.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('AI Moderation Error:', error);
    return { status: 'approved', reason: 'Error during moderation' };
  }
}

  /**
   * Gets a response from the AI assistant.
   */
  export async function getAIAssistantResponse(message, history = []) {
    // Re-check key every time to handle late initialization
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('EXPO_PUBLIC_OPENAI_API_KEY is missing from process.env');
      return "I'm sorry, I don't have an API key configured to help you right now. Please check your environment variables.";
    }

    try {
      console.log('Sending request to OpenAI with message:', message);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant for this community platform. You help users with support inquiries, platform rules, and navigation. Keep responses concise and friendly.',
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
      
      if (data.error) {
        console.error('OpenAI API Error:', data.error);
        return `I encountered an error: ${data.error.message || 'Unknown error'}`;
      }
      
      if (!data.choices || !data.choices[0]) {
        return "I received an empty response from the AI.";
      }

      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI Assistant Fetch Error:', error);
      return "I'm having trouble connecting to my brain right now. Please try again in a moment.";
    }
  }
