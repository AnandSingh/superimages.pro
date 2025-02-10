import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3"
import Replicate from "https://esm.sh/replicate@0.25.2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Updated keyword arrays for better detection
const creditBalanceKeywords = [
  'balance',
  'credits',
  'credit',
  'how many credits',
  'check credits',
  'my credits',
  'credit balance',
  "what's my balance",
  'remaining credits'
];

const buyCreditsKeywords = [
  'buy credits',
  'purchase credits',
  'credit packages',
  'credit prices',
  'how much are credits',
  'credit cost',
  'how much is',
  'what is the price',
  'what are the prices',
  'pricing',
  'cost',
  'package price',
  'tier price'
];

const greetingKeywords = [
  'hi',
  'hello',
  'hey',
  'hola',
  'greetings',
  'good morning',
  'good afternoon',
  'good evening'
];

// Enhanced system prompt for AI with pricing knowledge
const AI_SYSTEM_PROMPT = `You are a helpful WhatsApp image generation assistant. Here are the key details you should know:

Available Credit Packages:
- Starter Tier: 75 credits ($3.99)
- Pro Tier: 150 credits ($4.99)
- Ultimate Tier: 500 credits ($9.99)

Important Keywords:
1. For checking credits:
   - Use "balance" or "credits" to check your current balance
   - Example: "What's my balance?" or "How many credits do I have?"

2. For buying credits:
   - Use "buy credits" to see all available packages
   - Example: "I want to buy credits" or "Show me the packages"

3. For image generation:
   - Start with keywords like "show me", "generate", "create", "make me"
   - Example: "Show me a sunset" or "Generate a fantasy castle"

Guidelines:
- If users ask about prices or packages, always direct them to use "buy credits" to see accurate, up-to-date pricing
- If users ask about their balance, direct them to use "balance" or "credits"
- For any image-related requests, remind them to use generation keywords
- Never make up or quote specific prices - always direct users to use "buy credits" command
- Focus on helping users use the right keywords to get what they need

Remember to be concise but helpful in your responses.`;

const helpfulImageRequestGuide = `I notice you didn't use any specific keywords that help me understand you want an image. 

To Create New Images:
Always start with keywords like:
- "Show me..."
- "Generate..."
- "Create..."
- "Make me..."
- "I want..."
- "Give me..."

For example:
"Show me a sunset"
"Generate a sci-fi city"
"I want a picture of mountains"
"Make me a fantasy castle"

Try it now! What would you like me to create?`;

const INITIAL_GREETING = `Hi! I'm an AI image generator that can create any image you imagine! 🎨

Important: I need specific keywords to understand your requests!

To Create New Images:
Always start with keywords like:
- "Show me..."
- "Generate..."
- "Create..."
- "Make me..."
- "I want..."
- "Give me..."

For example:
"Show me a sunset"
"Generate a sci-fi city"
"I want a picture of mountains"
"Make me a fantasy castle"

Try it now! What would you like me to create?`;

const HOW_IT_WORKS_GUIDE = `I can generate any kind of image you want! Here's how to use me:

Important: I need specific keywords to understand your requests!

1. New Images:
Always start with keywords like:
- "Show me..."
- "Generate..."
- "Create..."
- "Make me..."
- "I want..."
- "Give me..."

For example:
"Show me a sunset"
"Generate a sci-fi city"
"I want a picture of mountains"
"Make me a fantasy castle"

Try it now! What would you like me to create?`;

const imageKeywords = [
  // Want/Need variations
  'want', 'need', 'give me',
  // General commands
  'show', 'generate', 'create', 'make',
  // Specific requests
  'photo', 'picture', 'image',
  // Context switches
  'now i want', 'can you show', 'how about',
  // Simple commands
  'draw', 'create'
];

const modificationKeywords = [
  // Direct modifications
  'make it', 'change it', 'turn it',
  // Style changes
  'more', 'less', 'bigger', 'smaller',
  // Context switches
  'now make', 'now change', 'instead make',
  // Additions/Removals
  'add', 'remove', 'put', 'take',
  // Simple changes
  'but', 'and', 'with', 'without'
];

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
        output_format: "png",
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
    console.error("Detailed error in generateImageWithReplicate:", {
      error: error,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

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
            caption: `Here's your generated image! 🎨

You can make a similar image by using keywords like: "Make it, Change it, Add", examples:

- "Make it more vibrant"
- "Change it to night time"
- "Add more details"

*If the new images are too similar and you want something completely different, create a new image by using the keywords (Create, Make, Give me, etc..)  Examples:

"Create a cute puppy"
"Make me a dragon"
"I want a picture of mountains"
"Give me an image of space"`
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
      await sendWhatsAppMessage(recipient, helpfulImageRequestGuide);
      throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`);
    }

    return result;
  } catch (error) {
    console.error('Error sending WhatsApp image:', error);
    await sendWhatsAppMessage(recipient, helpfulImageRequestGuide);
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

async function checkAndDeductCredits(userId: string): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await supabase.rpc('use_credits', {
    p_user_id: userId,
    p_amount: 1,
    p_product_type: 'image_generation',
    p_metadata: {}
  });

  if (error) {
    console.error('Error checking credits:', error);
    return false;
  }

  return data;
}

async function getCreditsMessage(userId: string): Promise<string> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: creditData } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', userId)
    .single();

  const { data: products } = await supabase
    .from('credit_products')
    .select('*')
    .eq('is_active', true)
    .gt('price', 0)  // Only get paid products
    .order('price', { ascending: true })
    .limit(1);

  const balance = creditData?.balance || 0;
  const cheapestProduct = products?.[0];

  return `You have ${balance} credit${balance !== 1 ? 's' : ''} remaining.

Each image generation costs 1 credit.${balance === 0 ? `

To purchase more credits, start with our ${cheapestProduct?.name} (${cheapestProduct?.credits_amount} credits) for $${(cheapestProduct?.price || 0) / 100}.` : ''}

Send "buy credits" to see available packages.`;
}

async function getDynamicCreditsGuide(supabase: any): Promise<string> {
  const { data: products, error } = await supabase
    .from('credit_products')
    .select('*')
    .eq('is_active', true)
    .gt('price', 0)  // Only get paid products
    .order('credits_amount', { ascending: true });

  if (error || !products?.length) {
    return 'Credit packages are currently unavailable. Please try again later.';
  }

  const packagesText = products.map(product => 
    `${product.name}: $${(product.price / 100).toFixed(2)}
- ${product.credits_amount} credits`
  ).join('\n\n');

  return `Here are our credit packages:

${packagesText}

Each image generation costs 1 credit.

To purchase, just reply with:
${products.map(p => `"buy ${p.name.toLowerCase()}" for ${p.name}`).join('\n')}

Or type "balance" to check your current credits.`;
}

async function getConversationHistory(supabase: any, userId: string): Promise<string> {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('direction, content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching conversation history:', error);
    return 'Error fetching conversation history.';
  }

  const formattedMessages = messages
    .map(msg => {
      const prefix = msg.direction === 'incoming' ? 'User: ' : 'You: ';
      const content = msg.content?.text || 'No text content';
      return prefix + content;
    })
    .reverse()
    .join('\n');

  return formattedMessages || 'No previous conversation.';
}

const ONBOARDING_INITIAL_MESSAGE = `Welcome! 👋 Before we start, I need your email address to set up your account. 

Please reply with your email address (for example: user@example.com).

Your email will only be used for account management and important notifications.`;

const INVALID_EMAIL_MESSAGE = `That doesn't look like a valid email address. 

Please send a valid email address (for example: user@example.com).`;

const EMAIL_CONFIRMATION_MESSAGE = `Thanks! Your email has been saved. 

Now, let me show you how I can help you create amazing images! 🎨

To create images, always start with keywords like:
- "Show me..."
- "Generate..."
- "Create..."
- "Make me..."
- "I want..."
- "Give me..."

For example:
"Show me a sunset"
"Generate a sci-fi city"
"I want a picture of mountains"
"Make me a fantasy castle"

Try it now! What would you like me to create?`;

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function handleOnboarding(supabase: any, userId: string, userMessage: string): Promise<string | null> {
  // Get user's current onboarding state
  const { data: userData, error: userError } = await supabase
    .from('whatsapp_users')
    .select('onboarding_state, onboarding_completed')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('Error getting user onboarding state:', userError);
    return null;
  }

  // If onboarding is completed, return null to continue with normal flow
  if (userData.onboarding_completed) {
    return null;
  }

  // If this is the first message (onboarding not started)
  if (userData.onboarding_state === 'not_started') {
    await supabase
      .from('whatsapp_users')
      .update({ onboarding_state: 'awaiting_email' })
      .eq('id', userId);
    
    return ONBOARDING_INITIAL_MESSAGE;
  }

  // If we're waiting for email
  if (userData.onboarding_state === 'awaiting_email') {
    const email = userMessage.trim().toLowerCase();
    
    if (!isValidEmail(email)) {
      return INVALID_EMAIL_MESSAGE;
    }

    // Email is valid, save it and complete onboarding
    await supabase
      .from('whatsapp_users')
      .update({
        email: email,
        onboarding_completed: true,
        onboarding_state: 'completed'
      })
      .eq('id', userId);

    return EMAIL_CONFIRMATION_MESSAGE;
  }

  return null;
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
      console.log('Test endpoint called')
      return new Response(JSON.stringify({ status: 'ok', message: 'Webhook is operational' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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
        
        console.log("Processing incoming message:", {
          messageId: message.id,
          type: message.type,
          sender: sender.wa_id,
          timestamp: message.timestamp
        });

        // User data handling
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
          .select()
          .single();

        if (userError) {
          console.error('Error updating user:', userError)
          throw userError
        }

        // Store the message
        const messageData = {
          whatsapp_message_id: message.id,
          user_id: userData.id,
          direction: 'incoming',
          message_type: message.type,
          content: message.type === 'text' ? { text: message.text.body } : message[message.type],
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

        if (message.type === 'text') {
          // Check for onboarding state first
          const onboardingResponse = await handleOnboarding(supabase, userData.id, message.text.body);
          
          if (onboardingResponse) {
            // If we got an onboarding response, send it and end the request
            await sendWhatsAppMessage(sender.wa_id, onboardingResponse);
            return new Response(JSON.stringify({ success: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Continue with existing message handling logic
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

          console.log('Storing message:', messageData)

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
              console.log('Processing message:', message.text.body);
              
              const messageText = message.text.body.toLowerCase();

              // Check for greetings first
              if (greetingKeywords.some(keyword => messageText.startsWith(keyword))) {
                await sendWhatsAppMessage(sender.wa_id, INITIAL_GREETING);
                return new Response(JSON.stringify({ success: true }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }
              
              // Check for buy credits/packages first - needs to be more specific
              if (
                buyCreditsKeywords.some(keyword => 
                  messageText === keyword || // Exact match
                  messageText.startsWith(keyword + ' ') || // Starts with keyword
                  messageText === 'packages' || // Common variations
                  messageText === 'credit packages' ||
                  messageText === 'show packages' ||
                  messageText === 'show credit packages'
                )
              ) {
                const creditsGuide = await getDynamicCreditsGuide(supabase);
                await sendWhatsAppMessage(sender.wa_id, creditsGuide);
                return new Response(JSON.stringify({ success: true }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }

              // Then check for balance inquiries - make it more specific
              if (
                creditBalanceKeywords.some(keyword => 
                  messageText === keyword || // Exact match
                  messageText.startsWith(keyword + ' ') || // Starts with keyword
                  messageText === 'balance' || // Common variations
                  messageText === 'credits' ||
                  messageText === "what's my balance" ||
                  messageText === 'how many credits do i have'
                )
              ) {
                const creditsMessage = await getCreditsMessage(userContext.id);
                await sendWhatsAppMessage(sender.wa_id, creditsMessage);
                return new Response(JSON.stringify({ success: true }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }

              const conversationHistory = await getConversationHistory(supabase, userContext.id);
              console.log('Retrieved conversation history:', conversationHistory);
              
              const isDirectImageRequest = imageKeywords.some(keyword => 
                messageText.includes(keyword)
              );

              const isImageContext = userContext.last_interaction_type === 'image_generation';
              const isModificationRequest = isImageContext && (
                modificationKeywords.some(keyword => messageText.includes(keyword)) ||
                messageText.match(/^(make|change|turn|set)\s+the\s+/) ||
                messageText.startsWith('but') ||
                messageText.startsWith('and')
              );

              if (isDirectImageRequest || isModificationRequest) {
                let promptText = message.text.body;

                if (isModificationRequest && userContext.last_image_context) {
                  const previousPrompt = userContext.last_image_context.prompt;
                  let modification = message.text.body;
                  
                  modificationKeywords.forEach(keyword => {
                    if (modification.toLowerCase().startsWith(keyword)) {
                      modification = modification.slice(keyword.length).trim();
                    }
                  });
                  
                  promptText = `${modification} (maintaining style and context from previous image: ${previousPrompt})`;
                }

                // Check and deduct credits before proceeding
                const hasCredits = await checkAndDeductCredits(userContext.id);
                if (!hasCredits) {
                  await sendWhatsAppMessage(
                    sender.wa_id,
                    "You don't have enough credits to generate an image. Send 'buy credits' to see available packages or 'balance' to check your current credits."
                  );
                  return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                  });
                }

                const promptOptimizationPrompt = `
You are an expert artist using the FLUX image generation model. Your task is to take user requests and create detailed, high-quality prompts that follow this exact structure:

<PICTURE STYLE> of a detailed, high-quality scene showing <SUBJECTS/OBJECTS with detailed attributes/positions/activities>. The background has <BACKGROUND DETAILS>. The lighting is <LIGHTING DETAILS>.

Guidelines:
- For simple requests (e.g., "show me a cat"), flesh out all details imaginatively
- For detailed requests, maintain all user-specified details while enhancing them
- Always specify lighting and background, even if user doesn't mention them
- Keep the exact three-part structure: style, scene description, lighting
- Focus on visual details, positions, and atmosphere

Example transformations:

Simple request:
User: "show me a cat"
Output: "Realistic photography of a detailed, high-quality scene showing an elegant Siamese cat perched gracefully on a vintage windowsill, its blue eyes reflecting curiosity. The background has soft-focused indoor elements with warm, morning sunlight filtering through sheer curtains. The lighting is gentle and natural, creating subtle shadows that accentuate the cat's features."

Detailed request:
User: "A woman with wavy dark brown hair, wearing an off-shoulder sweater"
Output: "Professional portrait photography of a detailed, high-quality scene showing a woman with flowing wavy dark brown hair cascading past her shoulders, wearing a cozy off-shoulder brown knit sweater that creates elegant draping effects. The background has a subtle gradient of warm earth tones with artistic bokeh effects. The lighting is soft and diffused, creating gentle highlights in her hair and natural skin tones."

Current request to transform: "${promptText}"

Return only the generated prompt, no explanations.`;

                const promptResult = await model.generateContent({
                  contents: [{ parts: [{ text: promptOptimizationPrompt }] }]
                });
                
                const optimizedPrompt = promptResult.response.text().trim();
                console.log('Optimized prompt:', optimizedPrompt);

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

                await sendWhatsAppMessage(
                  sender.wa_id,
                  "I'm generating your image now... This might take a few seconds. 🎨"
                );

                try {
                  const imageUrl = await generateImageWithReplicate(optimizedPrompt);
                  console.log('Generated image URL:', imageUrl);

                  const whatsappResponse = await sendWhatsAppImage(
                    sender.wa_id,
                    imageUrl,
                    "Here's your generated image! 🎨\n\nYou can modify this image by saying things like:\n- Make it more vibrant\n- Change the lighting\n- Add more details"
                  );
                  
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
                } catch (error) {
                  console.error('Error generating or sending image:', error);
                  // Since image generation failed, let's refund the credit
                  const supabase = createClient(
                    Deno.env.get('SUPABASE_URL') ?? '',
                    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                  );
                  
                  await supabase.rpc('add_user_credits', {
                    p_user_id: userContext.id,
                    p_amount: 1,
                    p_transaction_type: 'refund',
                    p_product_type: 'image_generation',
                    p_metadata: { reason: 'generation_failed' }
                  });
                  
                  await sendWhatsAppMessage(
                    sender.wa_id,
                    "I apologize, but I encountered an error while generating your image. Your credit has been refunded. Please try again."
                  );
                  return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                  });
                }
                
                // Return after successful image generation
                return new Response(JSON.stringify({ success: true }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              } else {
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
- Keep responses brief and to the point
- Only mention credits if the user specifically asks about them
- For general conversations, focus on image generation capabilities
- After your response, suggest a relevant image the user could create based on the conversation context`;
              
                const result = await model.generateContent({
                  contents: [{
                    parts: [{ text: prompt }]
                  }]
                });
                
                const response = await result.response;
                const aiResponse = response.text();
                
                console.log('AI generated response:', aiResponse);

                // Send the AI response
                const whatsappResponse = await sendWhatsAppMessage(sender.wa_id, aiResponse);
                
                // After any regular conversation, send the image guide
                await sendWhatsAppMessage(
                  sender.wa_id,
                  "By the way, I can create images too! Try saying:\n\"Show me a sunset over mountains\"\nor\n\"Generate a magical forest\""
                );
                
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
              await sendWhatsAppMessage(
                sender.wa_id,
                "I apologize, but I encountered an error while processing your request. Please try again later."
              );
              throw error
            }
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
