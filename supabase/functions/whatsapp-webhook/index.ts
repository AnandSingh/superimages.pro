import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3"
import Replicate from "https://esm.sh/replicate@0.25.2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Quick response patterns for common messages
const QUICK_RESPONSES = new Map([
  ['hi', 'Hello! How can I help you today? 👋'],
  ['hello', 'Hi there! How can I assist you? 👋'],
  ['hey', 'Hello! What can I do for you? 👋'],
  ['thanks', "You're welcome! 😊"],
  ['thank you', "You're welcome! Let me know if you need anything else 😊"],
  ['ok', '👍'],
  ['hmm', null], // Don't respond to simple acknowledgments
]);

// Simple check for potential image requests
function isPotentialImageRequest(text: string): boolean {
  const imageKeywords = [
    'image', 'picture', 'photo', 'draw', 'generate',
    'create', 'make', 'show', 'like', 'want'
  ];
  const lowerText = text.toLowerCase();
  return imageKeywords.some(keyword => lowerText.includes(keyword));
}

// Function to format conversation history
async function getConversationHistory(supabase: any, userId: string, limit = 5) {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('direction, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching conversation history:', error);
    return '';
  }

  if (!messages || messages.length === 0) return '';

  const orderedMessages = messages.reverse();
  return orderedMessages.map(msg => {
    const role = msg.direction === 'incoming' ? 'User' : 'Assistant';
    const text = msg.content.text || '[media content]';
    return `${role}: ${text}`;
  }).join('\n');
}

// Simplified message analysis for potential image requests
async function quickAnalyzeMessage(text: string, lastImageContext: any): Promise<{
  isImageRequest: boolean;
  isFollowUp: boolean;
  needsFullAnalysis: boolean;
}> {
  const lowerText = text.toLowerCase();
  
  // Check if it's a follow-up to previous image
  const isFollowUp = lastImageContext && (
    lowerText.startsWith('make it') ||
    lowerText.startsWith('change it') ||
    lowerText.startsWith('now') ||
    lowerText.includes('instead') ||
    lowerText.includes('but')
  );

  // Determine if it needs full analysis
  const isImageRequest = isPotentialImageRequest(text);
  const needsFullAnalysis = isImageRequest || isFollowUp;

  return {
    isImageRequest,
    isFollowUp,
    needsFullAnalysis
  };
}

// Simplified analysis for common image generation patterns
function detectImageType(prompt: string): 'portrait' | 'landscape' | 'product' | 'artistic' | 'default' {
  const promptLower = prompt.toLowerCase();
  
  if (promptLower.includes('portrait') || promptLower.includes('person')) return 'portrait';
  if (promptLower.includes('landscape') || promptLower.includes('scenery')) return 'landscape';
  if (promptLower.includes('product') || promptLower.includes('item')) return 'product';
  if (promptLower.includes('artistic') || promptLower.includes('abstract')) return 'artistic';
  
  return 'default';
}

// Optimized image generation parameters
const imageTypeParams: Record<string, any> = {
  portrait: {
    megapixels: "1",
    aspect_ratio: "3:4",
    num_inference_steps: 6,
    output_quality: 95,
    go_fast: true
  },
  landscape: {
    megapixels: "1.5",
    aspect_ratio: "16:9",
    num_inference_steps: 4,
    output_quality: 90,
    go_fast: true
  },
  product: {
    megapixels: "1",
    aspect_ratio: "1:1",
    num_inference_steps: 5,
    output_quality: 95,
    go_fast: true
  },
  artistic: {
    megapixels: "1",
    aspect_ratio: "1:1",
    num_inference_steps: 3,
    output_quality: 85,
    go_fast: true
  },
  default: {
    megapixels: "1",
    aspect_ratio: "1:1",
    num_inference_steps: 4,
    output_quality: 90,
    go_fast: true
  }
};

// Simplified WhatsApp message sending
async function sendWhatsAppMessage(recipient: string, text: string) {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

  const response = await fetch(
    `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: { body: text }
      }),
    }
  );

  const result = await response.json();
  console.log('WhatsApp API text response:', result);
  return result;
}

// Optimized image generation handler
async function generateAndSendImage(prompt: string, recipient: string, imageType: string) {
  try {
    console.log("Starting image generation with prompt:", prompt);
    
    const replicate = new Replicate({
      auth: Deno.env.get('REPLICATE_API_KEY') ?? '',
    });
    
    const params = imageTypeParams[imageType] || imageTypeParams.default;
    
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          ...params,
          num_outputs: 1,
          output_format: "png"
        }
      }
    );
    
    if (!output || !Array.isArray(output) || output.length === 0) {
      throw new Error("Invalid response from image generation API");
    }

    const imageUrl = output[0];
    await sendWhatsAppImage(recipient, imageUrl, "Here's your generated image! 🎨");
    
    return imageUrl;
  } catch (error) {
    console.error("Error generating image:", error);
    await sendWhatsAppMessage(recipient, "I'm sorry, I couldn't generate that image. Could you try describing it differently?");
    throw error;
  }
}

// Function to send WhatsApp image message with improved error handling
async function sendWhatsAppImage(recipient: string, imageUrl: string, caption?: string) {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

  console.log("Attempting to send WhatsApp image message:", {
    recipient,
    imageUrl,
    caption,
    phoneNumberId: !!phoneNumberId,
    accessToken: !!accessToken
  });

  if (!accessToken || !phoneNumberId) {
    throw new Error("Missing WhatsApp configuration");
  }

  try {
    // First send a status message
    await sendWhatsAppMessage(recipient, "Processing your image... 🎨");

    const response = await fetch(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'image',
          image: {
            link: imageUrl,
            caption: caption || ''
          }
        }),
      }
    );

    const result = await response.json();
    console.log('WhatsApp API image response:', JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error('WhatsApp API error:', {
        status: response.status,
        statusText: response.statusText,
        result
      });
      throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`);
    }

    return result;
  } catch (error) {
    console.error('Error sending WhatsApp image:', error);
    // Send error message to user
    await sendWhatsAppMessage(
      recipient,
      "Sorry, I couldn't send the image. I'll try describing it instead..."
    );
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    
    // Handle verification request
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      console.log('Verification request:', { mode, token, challenge })

      if (mode === 'subscribe' && token === Deno.env.get('WHATSAPP_VERIFY_TOKEN')) {
        console.log('Verification successful, returning challenge:', challenge)
        return new Response(challenge)
      }

      console.log('Verification failed')
      return new Response('Forbidden', { status: 403 })
    }

    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Received webhook:', JSON.stringify(body, null, 2));

      if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const message = body.entry[0].changes[0].value.messages[0];
        const sender = body.entry[0].changes[0].value.contacts[0];
        
        console.log("Processing message:", {
          messageId: message.id,
          type: message.type,
          sender: sender.wa_id
        });

        // Initialize Supabase client
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Handle user data
        const { data: userData, error: userError } = await supabase
          .from('whatsapp_users')
          .upsert({
            phone_number: sender.wa_id,
            first_name: sender.profile?.name?.split(' ')[0] || null,
            last_name: sender.profile?.name?.split(' ').slice(1).join(' ') || null,
            last_active: new Date().toISOString()
          }, {
            onConflict: 'phone_number'
          });

        // Get user context
        const { data: userContext } = await supabase
          .from('whatsapp_users')
          .select('id, last_interaction_type, last_image_context')
          .eq('phone_number', sender.wa_id)
          .single();

        // Store incoming message
        const messageData = {
          whatsapp_message_id: message.id,
          user_id: userContext.id,
          direction: 'incoming',
          message_type: message.type,
          content: message.type === 'text' ? { text: message.text.body } : message[message.type],
          status: 'received',
          created_at: new Date(parseInt(message.timestamp) * 1000).toISOString()
        };

        await supabase.from('messages').insert(messageData);

        // Handle text messages
        if (message.type === 'text') {
          const messageText = message.text.body.trim();
          
          // Check for quick response
          const quickResponse = QUICK_RESPONSES.get(messageText.toLowerCase());
          if (quickResponse !== undefined) {
            if (quickResponse) {
              await sendWhatsAppMessage(sender.wa_id, quickResponse);
            }
            return new Response(JSON.stringify({ success: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Quick analysis
          const quickAnalysis = await quickAnalyzeMessage(
            messageText,
            userContext.last_image_context
          );

          if (quickAnalysis.needsFullAnalysis) {
            // Initialize Gemini AI
            const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? "");
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            const conversationHistory = await getConversationHistory(supabase, userContext.id);
            
            const analysisPrompt = `Briefly analyze if this message is requesting an image: "${messageText}"
              Context: ${quickAnalysis.isFollowUp ? `Previous image prompt: ${userContext.last_image_context?.prompt}` : 'New conversation'}
              
              Return only a JSON object with:
              {
                "isImageRequest": true/false,
                "improvedPrompt": "enhanced prompt for better image generation or null",
                "needsGuidance": true/false,
                "guidance": "help message if needed or null"
              }`;

            const result = await model.generateContent({
              contents: [{ parts: [{ text: analysisPrompt }] }]
            });
            
            const analysis = JSON.parse(result.response.text());

            if (analysis.isImageRequest) {
              const imageType = detectImageType(messageText);
              const finalPrompt = analysis.improvedPrompt || messageText;

              if (analysis.needsGuidance) {
                await sendWhatsAppMessage(sender.wa_id, analysis.guidance);
              } else {
                // Update context and generate image
                await supabase
                  .from('whatsapp_users')
                  .update({
                    last_interaction_type: 'image_generation',
                    last_image_context: {
                      prompt: finalPrompt,
                      timestamp: new Date().toISOString()
                    }
                  })
                  .eq('id', userContext.id);

                await generateAndSendImage(finalPrompt, sender.wa_id, imageType);
              }
            } else {
              // Handle regular conversation with simpler prompt
              const conversationPrompt = `You are a helpful assistant. Previous messages:\n${conversationHistory}\n\nUser: ${messageText}\n\nRespond naturally and briefly.`;
              
              const response = await model.generateContent({
                contents: [{ parts: [{ text: conversationPrompt }] }]
              });
              
              await sendWhatsAppMessage(sender.wa_id, response.response.text());
            }
          } else {
            // Simple response for non-image related messages
            const simplePrompt = `Respond briefly and naturally to: "${messageText}"`;
            const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? "");
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const response = await model.generateContent({
              contents: [{ parts: [{ text: simplePrompt }] }]
            });
            
            await sendWhatsAppMessage(sender.wa_id, response.response.text());
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
