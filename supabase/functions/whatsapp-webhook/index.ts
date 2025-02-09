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

async function generateImageWithReplicate(prompt: string, aspectRatio = "1:1") {
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
          aspect_ratio: aspectRatio,
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

    return imageUrl;
  } catch (error) {
    console.error("Error in generateImageWithReplicate:", error);
    throw error;
  }
}

async function optimizeImagePrompt(genAI: any, userPrompt: string, previousContext: any = null) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  const systemInstructions = `You are an expert at crafting prompts for the FLUX image generation model. 
  Your task is to transform user requests into highly effective image generation prompts.

  Guidelines:
  - Focus on descriptive elements, not instructions
  - Include specific artistic and photographic terminology
  - Add style markers that enhance quality (cinematic, macro, etc.)
  - Consider composition and lighting
  - Keep prompts concise but rich in detail
  - Never use words like "generate", "create", "ensure"
  - Never use instructional language
  - Never mention AI or image generation
  
  Format output as:
  [subject], [key details], [style], [composition], [lighting/atmosphere]

  Examples of good prompts:
  - "black forest gateau cake spelling FLUX SCHNELL, fresh berries, food photography, overhead shot, soft natural light"
  - "tiny astronaut emerging from cracked egg, lunar surface, sci-fi concept art, low angle shot, dramatic rim lighting"
  - "street skateboarder mid-flip, Paris Olympics arena, sports photography, dynamic action shot, golden hour lighting"`;

  let promptContext = `User request: "${userPrompt}"

${previousContext ? `Previous context: ${JSON.stringify(previousContext)}` : ''}

Convert this request into an effective image generation prompt following the guidelines above.
Return only the optimized prompt, nothing else.`;

  const result = await model.generateContent({
    contents: [
      { role: "system", content: systemInstructions },
      { role: "user", content: promptContext }
    ]
  });

  const optimizedPrompt = result.response.text().trim();
  console.log("Optimized prompt:", optimizedPrompt);
  return optimizedPrompt;
}

async function sendWhatsAppImage(recipient: string, imageUrl: string, caption?: string) {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

  if (!accessToken || !phoneNumberId) {
    throw new Error("Missing WhatsApp configuration");
  }

  try {
    await sendWhatsAppMessage(recipient, "🎨 Creating your image...");

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

    if (req.method === 'POST') {
      const body = await req.json()
      console.log('Received webhook:', JSON.stringify(body, null, 2))

      if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const message = body.entry[0].changes[0].value.messages[0]
        const sender = body.entry[0].changes[0].value.contacts[0]
        
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

        if (userError) throw userError;

        const { data: userContext, error: userContextError } = await supabase
          .from('whatsapp_users')
          .select('id, last_interaction_type, last_image_context')
          .eq('phone_number', sender.wa_id)
          .single()

        if (userContextError) throw userContextError;

        let messageContent = {}
        if (message.type === 'text') {
          messageContent = { text: message.text.body }
        } else if (message.type === 'image' || message.type === 'video' || message.type === 'document') {
          messageContent = message[message.type]
        }

        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            whatsapp_message_id: message.id,
            user_id: userContext.id,
            direction: 'incoming',
            message_type: message.type,
            content: messageContent,
            status: 'received',
            created_at: new Date(parseInt(message.timestamp) * 1000).toISOString()
          })

        if (messageError) throw messageError;

        if (message.type === 'text') {
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
          const isFollowUpRequest = isImageContext && followUpKeywords.some(keyword =>
            message.text.body.toLowerCase().includes(keyword)
          );

          if (isDirectImageRequest || isFollowUpRequest) {
            try {
              const previousContext = isFollowUpRequest ? userContext.last_image_context : null;
              const optimizedPrompt = await optimizeImagePrompt(genAI, message.text.body, previousContext);
              
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

              if (contextError) throw contextError;

              const imageUrl = await generateImageWithReplicate(optimizedPrompt);
              const whatsappResponse = await sendWhatsAppImage(
                sender.wa_id,
                imageUrl,
                "✨ Here's your image!"
              );
              
              const { error: aiMessageError } = await supabase
                .from('messages')
                .insert({
                  whatsapp_message_id: whatsappResponse.messages[0].id,
                  user_id: userContext.id,
                  direction: 'outgoing',
                  message_type: 'image',
                  content: { 
                    image: {
                      url: imageUrl,
                      caption: "✨ Here's your image!"
                    }
                  },
                  status: 'sent',
                  created_at: new Date().toISOString()
                })

              if (aiMessageError) throw aiMessageError;
            } catch (error) {
              console.error('Error processing image request:', error);
              await sendWhatsAppMessage(
                sender.wa_id,
                "Sorry, I encountered an error while generating your image. Please try again."
              );
              throw error;
            }
          } else {
            if (userContext.last_interaction_type === 'image_generation') {
              const { error: contextError } = await supabase
                .from('whatsapp_users')
                .update({
                  last_interaction_type: 'conversation',
                  last_image_context: null
                })
                .eq('id', userContext.id);

              if (contextError) throw contextError;
            }

            const conversationHistory = await getConversationHistory(supabase, userContext.id);
            const prompt = `You are a helpful WhatsApp business assistant. Previous conversation:
${conversationHistory}

Current message:
User: ${message.text.body}

Important:
- Use conversation history for context
- Keep responses brief and natural
- Don't mention being AI/chatbot
- Respond as if in an ongoing conversation`;
            
            const result = await genAI.getGenerativeModel({ model: "gemini-pro" })
              .generateContent({
                contents: [{ parts: [{ text: prompt }] }]
              });
            
            const aiResponse = result.response.text();
            const whatsappResponse = await sendWhatsAppMessage(sender.wa_id, aiResponse)
            
            const { error: aiMessageError } = await supabase
              .from('messages')
              .insert({
                whatsapp_message_id: whatsappResponse.messages[0].id,
                user_id: userContext.id,
                direction: 'outgoing',
                message_type: 'text',
                content: { text: aiResponse },
                status: 'sent',
                created_at: new Date().toISOString()
              })

            if (aiMessageError) throw aiMessageError;
          }
        }
      }

      if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
        const status = body.entry[0].changes[0].value.statuses[0]
        
        const { error: statusError } = await supabase
          .from('messages')
          .update({ status: status.status, updated_at: new Date().toISOString() })
          .eq('whatsapp_message_id', status.id)

        if (statusError) throw statusError;
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
