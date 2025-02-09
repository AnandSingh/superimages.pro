
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
  
  return orderedMessages.map(msg => {
    const role = msg.direction === 'incoming' ? 'User' : 'Assistant';
    let text = '';
    
    if (msg.message_type === 'text') {
      text = msg.content.text;
    } else if (msg.message_type === 'image') {
      text = '[Image]';
    } else {
      text = `[${msg.message_type}]`;
    }
    
    return `${role}: ${text}`;
  }).join('\n');
}

// Function to detect aspect ratio from text
function detectAspectRatio(text: string): string {
  const portraitKeywords = ['portrait', 'vertical', 'tall'];
  const landscapeKeywords = ['landscape', 'horizontal', 'wide'];
  const wideScreenKeywords = ['widescreen', '16:9', 'cinematic'];
  
  text = text.toLowerCase();
  
  if (portraitKeywords.some(keyword => text.includes(keyword))) {
    return '3:4';
  }
  if (wideScreenKeywords.some(keyword => text.includes(keyword))) {
    return '16:9';
  }
  if (landscapeKeywords.some(keyword => text.includes(keyword))) {
    return '4:3';
  }
  
  return '1:1';
}

// Function to manage context expiration
async function shouldResetContext(supabase: any, userId: string) {
  const { data: user, error } = await supabase
    .from('whatsapp_users')
    .select('last_interaction_type, last_image_context')
    .eq('id', userId)
    .single();

  if (error || !user) return true;

  if (user.last_image_context) {
    const lastContextTime = new Date(user.last_image_context.timestamp).getTime();
    const currentTime = new Date().getTime();
    const contextTimeout = 5 * 60 * 1000; // 5 minutes
    return (currentTime - lastContextTime) > contextTimeout;
  }

  return true;
}

// Function to preserve image generation context
async function updateImageContext(supabase: any, userId: string, prompt: string, aspectRatio: string) {
  const { error } = await supabase
    .from('whatsapp_users')
    .update({
      last_interaction_type: 'image_generation',
      last_image_context: {
        prompt,
        aspectRatio,
        timestamp: new Date().toISOString()
      }
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating image context:', error);
    throw error;
  }
}

// Function to generate image with Replicate
async function generateImageWithReplicate(prompt: string, aspectRatio: string) {
  const replicate = new Replicate({
    auth: Deno.env.get('REPLICATE_API_KEY') ?? '',
  });

  console.log("Starting image generation:", { prompt, aspectRatio });
  
  try {
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          go_fast: true,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio: aspectRatio,
          output_format: "png",
          output_quality: 90,
          num_inference_steps: 4
        }
      }
    );
    
    console.log("Replicate API response:", JSON.stringify(output));
    
    if (!output || !Array.isArray(output) || output.length === 0) {
      throw new Error("Invalid response from image generation API");
    }

    const imageUrl = output[0];
    if (!imageUrl || !imageUrl.startsWith('https://')) {
      throw new Error("Invalid image URL generated");
    }

    return imageUrl;
  } catch (error) {
    console.error("Error in generateImageWithReplicate:", error);
    throw error;
  }
}

// Function to send WhatsApp image message
async function sendWhatsAppImage(recipient: string, imageUrl: string) {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

  console.log("Sending WhatsApp image:", {
    recipient,
    imageUrl,
    phoneNumberId: !!phoneNumberId
  });

  if (!accessToken || !phoneNumberId) {
    throw new Error("Missing WhatsApp configuration");
  }

  try {
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
            link: imageUrl
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
    await sendWhatsAppMessage(
      recipient,
      "Sorry, I couldn't send the image. Please try again."
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
    if (url.pathname === '/test') {
      return new Response(JSON.stringify({ status: 'ok', message: 'Webhook is operational' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      if (mode === 'subscribe' && token === Deno.env.get('WHATSAPP_VERIFY_TOKEN')) {
        return new Response(challenge)
      }
      return new Response('Forbidden', { status: 403 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? "");
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    if (req.method === 'POST') {
      const body = await req.json()
      console.log('Received webhook:', JSON.stringify(body, null, 2))

      if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const message = body.entry[0].changes[0].value.messages[0]
        const sender = body.entry[0].changes[0].value.contacts[0]
        
        console.log("Processing message:", {
          messageId: message.id,
          type: message.type,
          sender: sender.wa_id
        });

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

        const { data: userContext, error: userContextError } = await supabase
          .from('whatsapp_users')
          .select('id, last_interaction_type, last_image_context')
          .eq('phone_number', sender.wa_id)
          .single()

        if (userContextError) {
          console.error('Error getting user context:', userContextError)
          throw userContextError
        }

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

        const { error: messageError } = await supabase
          .from('messages')
          .insert(messageData)

        if (messageError) {
          console.error('Error storing message:', messageError)
          throw messageError
        }

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

        if (message.type === 'text') {
          try {
            console.log('Processing text message:', message.text.body);
            
            const conversationHistory = await getConversationHistory(supabase, userContext.id);
            console.log('Conversation history:', conversationHistory);
            
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

            const isImageContext = userContext.last_interaction_type === 'image_generation';
            const followUpKeywords = ['make it', 'change it to', 'i want', 'instead', 'but'];
            const isFollowUpRequest = isImageContext && 
              !await shouldResetContext(supabase, userContext.id) && 
              followUpKeywords.some(keyword =>
                message.text.body.toLowerCase().includes(keyword)
              );

            if (isDirectImageRequest || isFollowUpRequest) {
              let promptText = message.text.body;
              let aspectRatio = detectAspectRatio(promptText);

              if (isFollowUpRequest && userContext.last_image_context) {
                const previousPrompt = userContext.last_image_context.prompt;
                const previousAspectRatio = userContext.last_image_context.aspectRatio || '1:1';
                
                if (aspectRatio === '1:1' && previousAspectRatio !== '1:1') {
                  aspectRatio = previousAspectRatio;
                }
                
                promptText = `${message.text.body} (based on previous request: ${previousPrompt})`;
              }

              const promptOptimizationPrompt = `
                I need to generate an image based on this user request: "${promptText}"
                ${isFollowUpRequest ? "This is a modification of a previous image request." : ""}
                The image will be generated in ${aspectRatio} aspect ratio format.
                Please create an optimized, clear, and detailed prompt for an AI image generator.
                The prompt should be descriptive but concise.
                Just return the optimized prompt, nothing else.
              `;

              const promptResult = await model.generateContent({
                contents: [{ parts: [{ text: promptOptimizationPrompt }] }]
              });
              
              const optimizedPrompt = promptResult.response.text().trim();
              console.log('Optimized prompt:', optimizedPrompt);

              await updateImageContext(supabase, userContext.id, optimizedPrompt, aspectRatio);

              await sendWhatsAppMessage(sender.wa_id, "Generating...");

              const imageUrl = await generateImageWithReplicate(optimizedPrompt, aspectRatio);
              console.log('Generated image URL:', imageUrl);

              const whatsappResponse = await sendWhatsAppImage(sender.wa_id, imageUrl);
              
              const aiMessageData = {
                whatsapp_message_id: whatsappResponse.messages[0].id,
                user_id: userContext.id,
                direction: 'outgoing',
                message_type: 'image',
                content: { 
                  image: {
                    url: imageUrl
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
              if (await shouldResetContext(supabase, userContext.id)) {
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

              const whatsappResponse = await sendWhatsAppMessage(sender.wa_id, aiResponse)
              
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
            console.error('Error processing message:', error)
            await sendWhatsAppMessage(
              sender.wa_id,
              "Sorry, I encountered an error. Please try again."
            );
            throw error
          }
        }
      }

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
