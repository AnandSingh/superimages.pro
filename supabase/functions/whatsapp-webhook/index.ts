
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3"
import Replicate from "https://esm.sh/replicate@0.25.2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Enhanced set of image generation keywords
const IMAGE_KEYWORDS = [
  'generate image',
  'create image',
  'make image',
  'create an image',
  'generate an image',
  'make an image',
  'image of',
  'picture of',
  'draw',
  'create a picture',
  'generate a picture',
  'show me',
  'can you make',
  'can you create',
  'i need a picture',
  'i want a picture',
  'selfie',
  'photo'
];

// Enhanced set of follow-up keywords
const FOLLOWUP_KEYWORDS = [
  'make it',
  'change it to',
  'i want',
  'instead',
  'but',
  'can you',
  'modify',
  'update',
  'different'
];

// Error messages for better user feedback
const ERROR_MESSAGES = {
  promptGeneration: "I'm having trouble understanding your image request. Could you try describing it differently?",
  imageGeneration: "I couldn't generate that image. Could you try a different description?",
  imageSending: "The image was created but I couldn't send it. Would you like to try again?",
  general: "I encountered an issue. Could you please try again?"
};

// Quick validation function for image requests
function isValidImageRequest(message: string): boolean {
  if (!message || message.length < 3 || message.length > 500) return false;
  return true;
}

// Function to check if a message is a potential image request
function isImageRequest(message: string, isImageContext: boolean): boolean {
  const lowercaseMessage = message.toLowerCase();
  return (
    IMAGE_KEYWORDS.some(keyword => lowercaseMessage.includes(keyword)) ||
    (isImageContext && FOLLOWUP_KEYWORDS.some(keyword => lowercaseMessage.includes(keyword)))
  );
}

// Enhanced conversation history formatting
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

// Enhanced image generation with better error handling
async function generateImageWithReplicate(prompt: string) {
  const replicate = new Replicate({
    auth: Deno.env.get('REPLICATE_API_KEY') ?? '',
  });

  console.log("Starting image generation with prompt:", prompt);
  
  try {
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          go_fast: true,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "png",
          output_quality: 90,
          num_inference_steps: 4
        }
      }
    );
    
    console.log("Raw Replicate API response:", JSON.stringify(output));
    
    if (!output || !Array.isArray(output) || output.length === 0) {
      console.error("Invalid response format from Replicate:", output);
      throw new Error("Invalid response from image generation API");
    }

    const imageUrl = output[0];
    if (!imageUrl || !imageUrl.startsWith('https://')) {
      throw new Error("Invalid image URL generated");
    }

    console.log("Generated image URL:", imageUrl);
    return imageUrl;
  } catch (error) {
    console.error("Error in generateImageWithReplicate:", error);
    throw error;
  }
}

// Enhanced WhatsApp message sending with better error handling
async function sendWhatsAppMessage(recipient: string, text: string) {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

  if (!accessToken || !phoneNumberId) {
    throw new Error("Missing WhatsApp configuration");
  }

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
  
  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`);
  }
  
  return result;
}

// Enhanced image sending with better error handling
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
      throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`);
    }

    return result;
  } catch (error) {
    console.error('Error sending WhatsApp image:', error);
    await sendWhatsAppMessage(
      recipient,
      ERROR_MESSAGES.imageSending
    );
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  console.log('Webhook request:', {
    method: req.method,
    pathname: url.pathname,
    searchParams: Object.fromEntries(url.searchParams)
  })

  try {
    // Test endpoint
    if (url.pathname === '/test') {
      return new Response(JSON.stringify({ status: 'ok', message: 'Webhook is operational' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Handle verification request
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      if (mode === 'subscribe' && token === Deno.env.get('WHATSAPP_VERIFY_TOKEN')) {
        return new Response(challenge)
      }

      return new Response('Forbidden', { status: 403 })
    }

    // Initialize clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? "");
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Handle incoming messages
    if (req.method === 'POST') {
      const body = await req.json()
      
      if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const message = body.entry[0].changes[0].value.messages[0]
        const sender = body.entry[0].changes[0].value.contacts[0]
        
        console.log("Processing message:", {
          messageId: message.id,
          type: message.type,
          sender: sender.wa_id,
          timestamp: message.timestamp
        });

        // Create or update WhatsApp user
        const { data: userData, error: userError } = await supabase
          .from('whatsapp_users')
          .upsert({
            phone_number: sender.wa_id,
            first_name: sender.profile?.name?.split(' ')[0] || null,
            last_name: sender.profile?.name?.split(' ').slice(1).join(' ') || null,
            last_active: new Date().toISOString()
          }, {
            onConflict: 'phone_number'
          })

        if (userError) {
          console.error('Error updating user:', userError)
          throw userError
        }

        // Get user context
        const { data: userContext, error: userContextError } = await supabase
          .from('whatsapp_users')
          .select('id, last_interaction_type, last_image_context')
          .eq('phone_number', sender.wa_id)
          .single()

        if (userContextError) {
          console.error('Error getting user context:', userContextError)
          throw userContextError
        }

        // Store the message
        const messageContent = message.type === 'text' ? 
          { text: message.text.body } : 
          message[message.type]

        const messageData = {
          whatsapp_message_id: message.id,
          user_id: userContext.id,
          direction: 'incoming',
          message_type: message.type,
          content: messageContent,
          status: 'received',
          created_at: new Date(parseInt(message.timestamp) * 1000).toISOString()
        }

        const { error: messageError } = await supabase
          .from('messages')
          .insert(messageData)

        if (messageError) {
          console.error('Error storing message:', messageError)
          throw messageError
        }

        // Process text messages
        if (message.type === 'text') {
          try {
            const userMessage = message.text.body;
            
            // Quick validation
            if (!isValidImageRequest(userMessage)) {
              await sendWhatsAppMessage(
                sender.wa_id,
                "I couldn't process that message. Could you try again with a clearer request?"
              );
              return;
            }

            const isImageContext = userContext.last_interaction_type === 'image_generation';
            
            // Check if this is an image request
            if (isImageRequest(userMessage, isImageContext)) {
              let promptText = userMessage;

              // Handle follow-up requests
              if (isImageContext && userContext.last_image_context) {
                const previousPrompt = userContext.last_image_context.prompt;
                promptText = `${userMessage} (based on previous request: ${previousPrompt})`;
              }

              // Optimize prompt with Gemini
              const promptOptimizationPrompt = `
                I need to generate an image based on this user request: "${promptText}"
                ${isImageContext ? "This is a modification of a previous image request." : ""}
                Please create an optimized, clear, and detailed prompt that:
                - Maintains the user's core request
                - Adds helpful artistic details
                - Preserves any specific style preferences
                - Includes proper composition elements
                Just return the optimized prompt, nothing else.
              `;

              const promptResult = await model.generateContent({
                contents: [{ parts: [{ text: promptOptimizationPrompt }] }]
              });
              
              const optimizedPrompt = promptResult.response.text().trim();
              console.log('Optimized prompt:', optimizedPrompt);

              // Update context
              const { error: contextError } = await supabase
                .from('whatsapp_users')
                .update({
                  last_interaction_type: 'image_generation',
                  last_image_context: {
                    prompt: optimizedPrompt,
                    timestamp: new Date().toISOString()
                  }
                })
                .eq('id', userContext.id);

              if (contextError) {
                console.error('Error updating context:', contextError);
                throw contextError;
              }

              // Generate and send image
              const imageUrl = await generateImageWithReplicate(optimizedPrompt);
              const whatsappResponse = await sendWhatsAppImage(
                sender.wa_id,
                imageUrl,
                "Here's your generated image! 🎨"
              );
              
              // Store response
              const aiMessageData = {
                whatsapp_message_id: whatsappResponse.messages[0].id,
                user_id: userContext.id,
                direction: 'outgoing',
                message_type: 'image',
                content: { 
                  image: {
                    url: imageUrl,
                    caption: "Here's your generated image! 🎨"
                  }
                },
                status: 'sent',
                created_at: new Date().toISOString()
              }

              await supabase
                .from('messages')
                .insert(aiMessageData)

            } else {
              // Handle regular conversation
              // Reset image context if needed
              if (isImageContext) {
                await supabase
                  .from('whatsapp_users')
                  .update({
                    last_interaction_type: 'conversation',
                    last_image_context: null
                  })
                  .eq('id', userContext.id);
              }

              const conversationHistory = await getConversationHistory(supabase, userContext.id);
              
              const prompt = `
                You are a helpful WhatsApp assistant. Keep responses concise and friendly.
                Previous conversation:
                ${conversationHistory}
                User: ${userMessage}
                Instructions:
                - Use conversation history for context
                - Keep responses brief and natural
                - Don't mention being AI or chatbot
              `.trim();
              
              const result = await model.generateContent({
                contents: [{ parts: [{ text: prompt }] }]
              });
              
              const aiResponse = result.response.text().trim();
              const whatsappResponse = await sendWhatsAppMessage(sender.wa_id, aiResponse);
              
              // Store AI response
              const aiMessageData = {
                whatsapp_message_id: whatsappResponse.messages[0].id,
                user_id: userContext.id,
                direction: 'outgoing',
                message_type: 'text',
                content: { text: aiResponse },
                status: 'sent',
                created_at: new Date().toISOString()
              }

              await supabase
                .from('messages')
                .insert(aiMessageData)
            }

          } catch (error) {
            console.error('Error processing message:', error);
            await sendWhatsAppMessage(
              sender.wa_id,
              ERROR_MESSAGES.general
            );
            throw error;
          }
        }
      }

      // Handle status updates
      if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
        const status = body.entry[0].changes[0].value.statuses[0];
        
        await supabase
          .from('messages')
          .update({ 
            status: status.status, 
            updated_at: new Date().toISOString() 
          })
          .eq('whatsapp_message_id', status.id);
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
