import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3"
import Replicate from "https://esm.sh/replicate@0.25.2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  // Reverse to get chronological order
  const orderedMessages = messages.reverse();
  
  return orderedMessages.map(msg => {
    const role = msg.direction === 'incoming' ? 'User' : 'Assistant';
    const text = msg.content.text || '[media content]';
    return `${role}: ${text}`;
  }).join('\n');
}

type ImageType = 'portrait' | 'landscape' | 'product' | 'artistic' | 'default';

interface GenerationParams {
  megapixels: string;
  aspect_ratio: string;
  num_inference_steps: number;
  output_quality: number;
  go_fast: boolean;
}

const imageTypeParams: Record<ImageType, GenerationParams> = {
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

// Function to detect if a message is requesting an image
function isImageRequest(text: string): boolean {
  const promptLower = text.toLowerCase();
  
  // Direct image generation keywords
  const directKeywords = [
    'generate', 'create', 'make', 'draw', 'show',
    'give me', 'i want', 'can you make', 'can you create',
    'can you generate', 'can you show'
  ];
  
  // Image-related nouns
  const imageNouns = [
    'image', 'picture', 'photo', 'pic', 'portrait',
    'selfie', 'photograph', 'drawing', 'artwork'
  ];
  
  // Check for direct matches of image-implying words
  const standaloneKeywords = [
    'selfie', 'portrait', 'painting', 'artwork',
    'landscape', 'scenery', 'picture'
  ];
  
  // Check for standalone keywords
  if (standaloneKeywords.some(keyword => promptLower.includes(keyword))) {
    return true;
  }
  
  // Check for combinations of action words and image nouns
  for (const action of directKeywords) {
    for (const noun of imageNouns) {
      if (promptLower.includes(`${action} ${noun}`)) {
        return true;
      }
      // Check for variations with "a" or "an"
      if (promptLower.includes(`${action} a ${noun}`)) {
        return true;
      }
      if (promptLower.includes(`${action} an ${noun}`)) {
        return true;
      }
    }
  }
  
  // Check for phrases like "image of" or "picture of"
  if (imageNouns.some(noun => promptLower.includes(`${noun} of`))) {
    return true;
  }
  
  return false;
}

// Function to detect image type from prompt
function detectImageType(prompt: string): ImageType {
  const promptLower = prompt.toLowerCase();
  
  // Portrait detection
  if (promptLower.includes('portrait') || 
      promptLower.includes('person') || 
      promptLower.includes('face') ||
      promptLower.includes('selfie') ||
      promptLower.includes('profile') ||
      promptLower.includes('headshot')) {
    return 'portrait';
  }
  
  // Landscape detection
  if (promptLower.includes('landscape') || 
      promptLower.includes('scenery') || 
      promptLower.includes('nature') ||
      promptLower.includes('sunset') ||
      promptLower.includes('mountain') ||
      promptLower.includes('panorama') ||
      promptLower.includes('vista')) {
    return 'landscape';
  }
  
  // Product detection
  if (promptLower.includes('product') || 
      promptLower.includes('item') ||
      promptLower.includes('showcase') ||
      promptLower.includes('car') ||
      promptLower.includes('phone') ||
      promptLower.includes('commercial')) {
    return 'product';
  }
  
  // Artistic detection
  if (promptLower.includes('abstract') || 
      promptLower.includes('artistic') || 
      promptLower.includes('surreal') ||
      promptLower.includes('fantasy') ||
      promptLower.includes('creative') ||
      promptLower.includes('digital art')) {
    return 'artistic';
  }
  
  return 'default';
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

// Function to send WhatsApp text message
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

// Function to generate image with Replicate
async function generateImageWithReplicate(prompt: string) {
  const replicate = new Replicate({
    auth: Deno.env.get('REPLICATE_API_KEY') ?? '',
  });

  console.log("Starting image generation with prompt:", prompt);
  
  try {
    const imageType = detectImageType(prompt);
    const params = imageTypeParams[imageType];
    
    console.log("Detected image type:", imageType);
    console.log("Using parameters:", params);
    
    console.log("Making Replicate API call with configuration:", {
      model: "black-forest-labs/flux-schnell",
      input: {
        prompt,
        ...params,
        num_outputs: 1,
        output_format: "png"
      }
    });

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
    console.error("Detailed error in generateImageWithReplicate:", {
      error: error,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

interface MessageAnalysis {
  intent: 'image_generation' | 'image_modification' | 'conversation' | 'unclear';
  imageType: 'portrait' | 'landscape' | 'product' | 'artistic' | null;
  isFollowUp: boolean;
  hasEnoughDetail: boolean;
  missingDetails: string[];
  suggestedPrompt: string | null;
  guidanceNeeded: boolean;
  suggestedGuidance: string | null;
}

async function analyzeUserMessage(
  message: string,
  conversationHistory: string,
  lastInteractionType: string | null,
  lastImageContext: any
): Promise<MessageAnalysis> {
  const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? "");
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const analysisPrompt = `
    Analyze this user message in the context of an AI image generation assistant:
    "${message}"

    Previous context: ${lastInteractionType === 'image_generation' ? 
      `User was generating images. Last prompt: ${lastImageContext?.prompt}` : 
      'Regular conversation'}

    Previous messages:
    ${conversationHistory}

    Provide a JSON response with:
    {
      "intent": Either "image_generation", "image_modification", "conversation", or "unclear",
      "imageType": Either "portrait", "landscape", "product", "artistic", or null,
      "isFollowUp": true/false based on if this relates to previous image generation,
      "hasEnoughDetail": true/false based on if prompt has enough details for good generation,
      "missingDetails": Array of missing details that would improve the prompt,
      "suggestedPrompt": Improved version of user's prompt or null,
      "guidanceNeeded": true/false if user needs help formulating request,
      "suggestedGuidance": Helpful guidance message if needed or null
    }

    Focus on understanding if the user wants to:
    1. Generate a new image
    2. Modify a previous image
    3. Just have a conversation
    4. Needs help/clarification

    Consider image type based on words like:
    - Portrait/Selfie/Person/Face
    - Landscape/Nature/Scenery
    - Product/Item/Object
    - Artistic/Abstract/Creative
  `;

  try {
    const result = await model.generateContent({
      contents: [{ parts: [{ text: analysisPrompt }] }]
    });
    
    const response = result.response.text();
    console.log('Analysis response:', response);
    
    try {
      return JSON.parse(response);
    } catch (e) {
      console.error('Error parsing analysis response:', e);
      // Return default analysis if parsing fails
      return {
        intent: 'unclear',
        imageType: null,
        isFollowUp: false,
        hasEnoughDetail: false,
        missingDetails: ['Could not analyze request properly'],
        suggestedPrompt: null,
        guidanceNeeded: true,
        suggestedGuidance: "I'm having trouble understanding your request. Could you please rephrase it?"
      };
    }
  } catch (error) {
    console.error('Error in message analysis:', error);
    throw error;
  }
}

async function handleImageGeneration(
  analysis: MessageAnalysis,
  originalPrompt: string,
  sender: { wa_id: string },
  userContext: any
) {
  let promptText = originalPrompt;

  // If it's a follow-up request, combine with previous context
  if (analysis.isFollowUp && userContext.last_image_context) {
    const previousPrompt = userContext.last_image_context.prompt;
    promptText = `${originalPrompt} (based on previous request: ${previousPrompt})`;
  }

  // If we have a suggested prompt improvement, use it
  if (analysis.suggestedPrompt) {
    promptText = analysis.suggestedPrompt;
  }

  // If guidance is needed, send guidance message first
  if (analysis.guidanceNeeded && analysis.suggestedGuidance) {
    await sendWhatsAppMessage(sender.wa_id, analysis.suggestedGuidance);
    if (!analysis.hasEnoughDetail) {
      return; // Wait for user to provide more details
    }
  }

  // Generate the image using the enhanced prompt
  try {
    const imageUrl = await generateImageWithReplicate(promptText);
    console.log('Generated image URL:', imageUrl);

    const whatsappResponse = await sendWhatsAppImage(
      sender.wa_id,
      imageUrl,
      "Here's your generated image! 🎨"
    );

    return whatsappResponse;
  } catch (error) {
    console.error('Error in image generation:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
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
    // Test endpoint to verify the function is accessible
    if (url.pathname === '/test') {
      console.log('Test endpoint called')
      return new Response(JSON.stringify({ status: 'ok', message: 'Webhook is operational' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? "");
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Handle incoming messages and status updates
    if (req.method === 'POST') {
      const body = await req.json()
      console.log('Received webhook:', JSON.stringify(body, null, 2))

      // Process messages
      if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const message = body.entry[0].changes[0].value.messages[0]
        const sender = body.entry[0].changes[0].value.contacts[0]
        
        console.log("Processing incoming message:", {
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

        // Get the user data including context
        const { data: userContext, error: userContextError } = await supabase
          .from('whatsapp_users')
          .select('id, last_interaction_type, last_image_context')
          .eq('phone_number', sender.wa_id)
          .single()

        if (userContextError) {
          console.error('Error getting user context:', userContextError)
          throw userContextError
        }

        // Store the message with appropriate content based on type
        let messageContent = {}
        if (message.type === 'text') {
          messageContent = {
            text: message.text.body
          }
        } else if (message.type === 'image' || message.type === 'video' || message.type === 'document') {
          messageContent = message[message.type]
        }

        const messageData = {
          whatsapp_message_id: message.id,
          user_id: userContext.id,
          direction: 'incoming',
          message_type: message.type,
          content: messageContent,
          status: 'received',
          created_at: new Date(parseInt(message.timestamp) * 1000).toISOString()
        }

        console.log('Storing message:', messageData)

        const { error: messageError } = await supabase
          .from('messages')
          .insert(messageData)

        if (messageError) {
          console.error('Error storing message:', messageError)
          throw messageError
        }

        // Handle media messages
        if (message.type === 'image' || message.type === 'video' || message.type === 'document') {
          const { error: mediaError } = await supabase
            .from('media_assets')
            .insert({
              whatsapp_id: message.image?.id || message.video?.id || message.document?.id,
              type: message.type,
              mime_type: message[message.type].mime_type,
              filename: message.document?.filename
            })

          if (mediaError) {
            console.error('Error storing media asset:', mediaError)
            throw mediaError
          }
        }

        // Generate AI response for text messages
        if (message.type === 'text') {
          try {
            console.log('Processing message:', message.text.body);
            
            // Get conversation history
            const conversationHistory = await getConversationHistory(supabase, userContext.id);
            console.log('Retrieved conversation history:', conversationHistory);
            
            // Analyze the message
            const analysis = await analyzeUserMessage(
              message.text.body,
              conversationHistory,
              userContext.last_interaction_type,
              userContext.last_image_context
            );
            
            console.log('Message analysis:', analysis);

            if (analysis.intent === 'image_generation' || analysis.intent === 'image_modification') {
              // Update user's context
              const { error: contextError } = await supabase
                .from('whatsapp_users')
                .update({
                  last_interaction_type: 'image_generation',
                  last_image_context: {
                    prompt: analysis.suggestedPrompt || message.text.body,
                    timestamp: new Date().toISOString()
                  }
                })
                .eq('id', userContext.id);

              if (contextError) {
                console.error('Error updating user context:', contextError);
                throw contextError;
              }

              // Handle image generation
              await handleImageGeneration(
                analysis,
                message.text.body,
                sender,
                userContext
              );
            } else {
              // Handle regular conversation with Gemini AI
              const prompt = `You are a helpful WhatsApp business assistant. You have access to the conversation history below and should use it to maintain context in your responses. Keep responses concise and friendly.

Previous conversation:
${conversationHistory}

Current message:
User: ${message.text.body}

Important instructions:
- Use the conversation history to maintain context
- Don't mention that you're a chatbot or AI assistant
- Don't say you can't remember - use the conversation history provided
- Respond naturally as if you were in an ongoing conversation
- Keep responses brief and to the point`;
            
              const result = await model.generateContent({
                contents: [{
                  parts: [{ text: prompt }]
                }]
              });
              
              const response = await result.response;
              const aiResponse = response.text();
              
              console.log('AI generated response:', aiResponse)

              // Send AI response back via WhatsApp
              const whatsappResponse = await sendWhatsAppMessage(sender.wa_id, aiResponse)
              
              // Store AI response in database
              const aiMessageData = {
                whatsapp_message_id: whatsappResponse.messages[0].id,
                user_id: userContext.id,
                direction: 'outgoing',
                message_type: 'text',
                content: { text: aiResponse },
                status: 'sent',
                created_at: new Date().toISOString()
              }

              const { error: aiMessageError } = await supabase
                .from('messages')
                .insert(aiMessageData)

              if (aiMessageError) {
                console.error('Error storing AI message:', aiMessageError)
                throw aiMessageError
              }
            }

          } catch (error) {
            console.error('Error generating or sending AI response:', error)
            // Send error message to user
            await sendWhatsAppMessage(
              sender.wa_id,
              "I apologize, but I encountered an error while processing your request. Please try again later."
            );
            throw error
          }
        }
      }

      // Process status updates
      if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
        const status = body.entry[0].changes[0].value.statuses[0]
        
        const { error: statusError } = await supabase
          .from('messages')
          .update({ status: status.status, updated_at: new Date().toISOString() })
          .eq('whatsapp_message_id', status.id)

        if (statusError) {
          console.error('Error updating message status:', statusError)
          throw statusError
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response('Method not allowed', { status: 405 })
  } catch (error) {
    console.error('Error processing request:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
