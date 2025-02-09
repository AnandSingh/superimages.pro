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
    .select('direction, content, message_type, created_at')
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
  
  return orderedMessages
    .filter(msg => {
      // Filter out system messages and invalid content
      if (msg.direction === 'outgoing' && msg.content.text?.includes('Processing your image...')) {
        return false;
      }
      return true;
    })
    .map(msg => {
      const role = msg.direction === 'incoming' ? 'User' : 'Assistant';
      let content = '';
      
      if (msg.message_type === 'text' && msg.content.text) {
        content = msg.content.text;
      } else if (msg.message_type === 'image') {
        content = '[Generated image]';
      }
      
      return content ? `${role}: ${content}` : null;
    })
    .filter(Boolean) // Remove null entries
    .join('\n');
}

async function generateImageWithReplicate(prompt: string) {
  const replicate = new Replicate({
    auth: Deno.env.get('REPLICATE_API_KEY') ?? '',
  });

  console.log("Starting image generation with prompt:", prompt);
  
  try {
    console.log("Making Replicate API call with configuration:", {
      model: "black-forest-labs/flux-schnell",
      input: {
        prompt,
        go_fast: true,
        megapixels: "1",
        num_outputs: 1,
        aspect_ratio: "1:1",
        output_format: "png", // Changed from webp to png for better compatibility
        output_quality: 90,
        num_inference_steps: 4
      }
    });

    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          go_fast: true,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "png", // Changed from webp to png
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

    // Validate the URL
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
            
            // Determine if this is an image generation request
            const imageKeywords = [
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
              'generate a picture'
            ];
            
            const isDirectImageRequest = imageKeywords.some(keyword => 
              message.text.body.toLowerCase().includes(keyword)
            );

            // Improved follow-up request detection
            const isImageContext = userContext.last_interaction_type === 'image_generation';
            const followUpKeywords = ['make it', 'change it to', 'instead', 'but with', 'but make it'];
            const isFollowUpRequest = isImageContext && 
              (followUpKeywords.some(keyword => message.text.body.toLowerCase().includes(keyword)) ||
               message.text.body.toLowerCase().startsWith('but') ||
               message.text.body.toLowerCase().startsWith('and'));

            if (isDirectImageRequest || isFollowUpRequest) {
              let promptText = message.text.body;

              // Handle follow-up requests more intelligently
              if (isFollowUpRequest && userContext.last_image_context) {
                const previousPrompt = userContext.last_image_context.prompt;
                
                // Extract the modification part
                let modification = message.text.body;
                followUpKeywords.forEach(keyword => {
                  if (modification.toLowerCase().startsWith(keyword)) {
                    modification = modification.slice(keyword.length).trim();
                  }
                });
                
                // Combine with previous context more naturally
                promptText = `${modification} (maintaining style and quality from previous image: ${previousPrompt})`;
              } else {
                // For new requests, clear any previous context influence
                const { error: contextResetError } = await supabase
                  .from('whatsapp_users')
                  .update({
                    last_image_context: null
                  })
                  .eq('id', userContext.id);

                if (contextResetError) {
                  console.error('Error resetting context:', contextResetError);
                }
              }

              // Use the improved prompt template
              const promptOptimizationPrompt = `
You are an expert in creating prompts for the FLUX image generation model. Analyze this user request and convert it into a high-quality image generation prompt:
"${promptText}"

Follow these guidelines in order:
1. First, identify the main subject and its key characteristics
2. Then, choose appropriate style elements based on the subject type:
   - For objects: consider materials, textures, and environmental context
   - For portraits: focus on lighting, mood, and composition
   - For landscapes: emphasize atmosphere, time of day, and scale
   - For actions: highlight dynamics, motion, and energy
3. Finally, add relevant technical aspects that enhance the image

Rules:
- Focus purely on descriptive elements
- Each prompt should be unique to the request
- Keep it concise and direct
- Don't use words like "generate", "create", "make", "want", "give me"
- Don't add explanations or extra text
- Ignore any bot responses in the text
- Treat "photo", "image", "picture" as the same thing

Note: The following examples show the structure, but do not copy their exact terms. Create fresh, context-appropriate descriptors for each request:
Input: "I want a photo of a black sports car"
Output: "sleek black sports car, dramatic automotive photography, studio lighting, glossy finish, cinematic"

Input: "Can you make an image of a cat?"
Output: "detailed cat portrait, soft natural lighting, shallow depth of field"

Just return the optimized prompt text, nothing else.`;

              const promptResult = await model.generateContent({
                contents: [{ parts: [{ text: promptOptimizationPrompt }] }]
              });
              
              const optimizedPrompt = promptResult.response.text().trim();
              console.log('Optimized prompt:', optimizedPrompt);

              // Update user's context with new prompt
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
                console.error('Error updating user context:', contextError);
                throw contextError;
              }

              // Send a status message
              await sendWhatsAppMessage(
                sender.wa_id,
                "I'm generating your image now... This might take a few seconds. 🎨"
              );

              // Generate the image using Replicate
              const imageUrl = await generateImageWithReplicate(optimizedPrompt);
              console.log('Generated image URL:', imageUrl);

              // Send the image back via WhatsApp
              const whatsappResponse = await sendWhatsAppImage(
                sender.wa_id,
                imageUrl,
                "Here's your generated image! 🎨"
              );
              
              // Store the response in the database
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

              const { error: aiMessageError } = await supabase
                .from('messages')
                .insert(aiMessageData)

              if (aiMessageError) {
                console.error('Error storing AI message:', aiMessageError)
                throw aiMessageError
              }

            } else {
              // Reset image context if it's a regular conversation
              if (userContext.last_interaction_type === 'image_generation') {
                const { error: contextError } = await supabase
                  .from('whatsapp_users')
                  .update({
                    last_interaction_type: 'conversation',
                    last_image_context: null
                  })
                  .eq('id', userContext.id);

                if (contextError) {
                  console.error('Error updating user context:', contextError);
                  throw contextError;
                }
              }

              // Handle regular text message with Gemini AI
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
