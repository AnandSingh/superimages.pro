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
  'tier price',
  'how much does it cost',
  'what are your prices',
  'what do credits cost',
  'credit pricing',
  'price list',
  'price of credits',
  'credit rates',
  'rates',
  'fees',
  'cost of credits',
  'price per credit',
  'credit fee',
  'what is the cost'
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
const CHAT_SYSTEM_PROMPT = `You are a helpful WhatsApp image generation assistant. Here's how to help users:

CORE COMMANDS - Guide users to these specific commands:

1. For Checking Credits:
   When users ask about balance or available credits, tell them to send "balance" or "credits"
   Example: "To check your current credit balance, just send 'balance'"

2. For Buying Credits:
   When users ask about prices, costs, or how to buy:
   - ONLY tell them to send "buy credits"
   - NEVER quote specific prices
   - NEVER mention websites, apps, or payment methods
   Example: "To see our current credit packages and pricing, just send 'buy credits'"

3. For Image Generation:
   When users want to create images, guide them to start with:
   - "Show me..."
   - "Generate..."
   - "Create..."
   - "Make me..."
   Example: "To create an image, start with 'show me' or 'generate'. For example: 'show me a sunset'"`;

const IMAGE_OPTIMIZATION_PROMPT = `You are an expert artist using the FLUX image generation model. Your task is to take user requests and create detailed, high-quality prompts that follow this exact structure :

<PICTURE STYLE> of a detailed, high-quality scene showing <SUBJECTS/OBJECTS with detailed attributes/positions/activities>. The background has <BACKGROUND DETAILS>. The lighting is <LIGHTING DETAILS>.

Guidelines : 
- For simple requests (e.g., "show me a cat"), flesh out all details imaginatively
- For detailed requests, maintain all user-specified details while enhancing them
- Always specify lighting and background, even if user doesn't mention them
- Keep the exact three part structure: style, scene, description, lighting
- Focus on visual details, positions, and atmosphere

Example transformations :

Simple request :
User : " show me a cat "

Output: "Realistic photography of a detailed, high-quality scene showing an elegant Siamese cat perched gracefully on a vintage windowsill, its blue eyes reflecting curiosity. The background has soft-focused indoor elements with warm, morning sunlight filtering through sheer curtains. The lighting is gentle and natural, creating subtle shadows that accentuate the cat's features."

Detailed request:

User: "A woman with wavy dark brown hair, wearing an off-shoulder sweater" 

Output: "Professional portrait photography of a detailed, high-quality scene showing a woman with flowing wavy dark brown hair cascading past her shoulders, wearing a cozy off-shoulder brown knit sweater that creates elegant draping effects. The background has a subtle gradient of warm earth tones with artistic bokeh effects. The lighting is soft and diffused, creating gentle highlights in her hair and natural skin tones." 

Return only the generated prompt, no explanations.`;

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
    // Ensure the prompt is properly formatted
    if (!prompt || typeof prompt !== 'string') {
      throw new Error("Invalid prompt format");
    }

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

async function getDynamicCreditsGuide(): Promise<string> {
  return `🎨 Superb Tools Subscriptions [50% Off for a limited time only!}

🎈 Basic Package
• 75 credits monthly (75 images)
• $3.99/month
https://buy.stripe.com/aEU4jM9WEeN58pi7ss

🚀 Pro Package
• 150 credits monthly (150 images)
• $5.99/month
https://buy.stripe.com/28o8A28SA20jbBu8wy

💎 Ultimate Package
• 500 credits monthly ($500 images)
• $9.99/month
https://buy.stripe.com/5kAcQi3ygfR934Y3cf

Click any link above to subscribe and your credits will be added automatically!

By the way, these credits can be used across ALL our Superb products! (We'll be adding more and more tools weekly!)

By the way make sure to use your correct Whatsapp number when checking out.

Type "balance" to check your current credits.`;
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

        // Get or create user with all necessary fields
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
          .select('*, last_interaction_type, last_image_context')
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
          const messageText = message.text.body.toLowerCase();
          console.log('Processing message:', messageText);

          // Check for onboarding state first
          const onboardingResponse = await handleOnboarding(supabase, userData.id, message.text.body);
          let currentUserData = userData;
          
          if (onboardingResponse) {
            await sendWhatsAppMessage(sender.wa_id, onboardingResponse);
            
            // If onboarding was just completed, get fresh user data
            if (onboardingResponse === EMAIL_CONFIRMATION_MESSAGE) {
              const { data: freshUserData, error: freshUserError } = await supabase
                .from('whatsapp_users')
                .select('*, last_interaction_type, last_image_context')
                .eq('id', userData.id)
                .single();
                
              if (!freshUserError) {
                currentUserData = freshUserData;
                console.log('Updated user context after onboarding:', currentUserData);
              } else {
                console.error('Error getting fresh user data:', freshUserError);
              }
            } else {
              return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }

          // Check for greetings first
          if (greetingKeywords.some(keyword => messageText.startsWith(keyword))) {
            await sendWhatsAppMessage(sender.wa_id, INITIAL_GREETING);
            return new Response(JSON.stringify({ success: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // First check for direct image generation requests
          const isDirectImageRequest = imageKeywords.some(keyword => 
            messageText.includes(keyword)
          );

          const isImageContext = currentUserData.last_interaction_type === 'image_generation';
          const isModificationRequest = isImageContext && (
            modificationKeywords.some(keyword => messageText.includes(keyword)) ||
            messageText.match(/^(make|change|turn|set)\s+the\s+/) ||
            messageText.startsWith('but') ||
            messageText.startsWith('and')
          );

          if (isDirectImageRequest || isModificationRequest) {
            let promptText = message.text.body;

            if (isModificationRequest && currentUserData.last_image_context) {
              const previousPrompt = currentUserData.last_image_context.prompt;
              let modification = message.text.body;
              
              modificationKeywords.forEach(keyword => {
                if (modification.toLowerCase().startsWith(keyword)) {
                  modification = modification.slice(keyword.length).trim();
                }
              });
              
              promptText = `${modification} (maintaining style and context from previous image: ${previousPrompt})`;
            }

            // Check and deduct credits before proceeding
            const hasCredits = await checkAndDeductCredits(currentUserData.id);
            if (!hasCredits) {
              await sendWhatsAppMessage(
                sender.wa_id,
                "You don't have enough credits to generate an image. Send 'buy credits' to see available packages or 'balance' to check your current credits."
              );
              return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            // Optimize the prompt using the new format
            const promptOptimizationPrompt = `${IMAGE_OPTIMIZATION_PROMPT}

Input: "${promptText}"`;

            console.log('Optimizing prompt with AI...', promptText);
            
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
              .eq('id', currentUserData.id);

            if (contextError) {
              console.error('Error updating user context:', contextError);
              throw contextError;
            }

            await sendWhatsAppMessage(
              sender.wa_id,
              "I'm generating your image now... This might take a few seconds. 🎨"
            );

            try {
              console.log('Starting image generation with Replicate...');
              const imageUrl = await generateImageWithReplicate(optimizedPrompt);
              console.log('Generated image URL:', imageUrl);

              const whatsappResponse = await sendWhatsAppImage(
                sender.wa_id,
                imageUrl,
                "Here's your generated image! 🎨\n\nYou can modify this image by saying things like:\n- Make it more vibrant\n- Change the lighting\n- Add more details"
              );
              
              const aiMessageData = {
                whatsapp_message_id: whatsappResponse.messages[0].id,
                user_id: currentUserData.id,
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
              await supabase.rpc('add_user_credits', {
                p_user_id: currentUserData.id,
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
            
            return new Response(JSON.stringify({ success: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // After image generation, check for credit balance queries
          if (creditBalanceKeywords.some(keyword => 
            messageText === keyword || 
            messageText.startsWith(keyword + ' ') || 
            messageText === 'balance' || 
            messageText === 'credits'
          )) {
            const creditsMessage = await getCreditsMessage(currentUserData.id);
            await sendWhatsAppMessage(sender.wa_id, creditsMessage);
            return new Response(JSON.stringify({ success: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Finally check for buy credits command
          if (messageText === 'buy credits') {
            const creditsGuide = await getDynamicCreditsGuide();
            await sendWhatsAppMessage(sender.wa_id, creditsGuide);
            return new Response(JSON.stringify({ success: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Normal conversation handling
          const conversationHistory = await getConversationHistory(supabase, currentUserData.id);
          console.log('Retrieved conversation history:', conversationHistory);
          
          if (currentUserData.last_interaction_type === 'image_generation') {
            const { error: contextError } = await supabase
              .from('whatsapp_users')
              .update({
                last_interaction_type: 'conversation',
                last_image_context: null
              })
              .eq('id', currentUserData.id);

            if (contextError) {
              console.error('Error updating user context:', contextError);
              throw contextError;
            }
          }

          const prompt = `You are a helpful WhatsApp business assistant. Use the conversation history below to maintain context and guide users to the correct commands.

Previous conversation:
${conversationHistory}

Current message:
User: ${message.text.body}

${CHAT_SYSTEM_PROMPT}

Important:
1. First understand what the user wants (checking balance, buying credits, or creating images)
2. Then guide them to the exact command they should use
3. Keep responses concise and friendly
4. Never invent features or make up information`;
          
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
            user_id: currentUserData.id,
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
