
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3"

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

// Function to parse expense data from AI response
interface ExpenseData {
  amount: number;
  category?: string;
  description?: string;
  date?: string;
  isExpense: boolean;
}

function parseExpenseData(aiResponse: string): { naturalResponse: string; expenseData: ExpenseData | null } {
  try {
    // Look for JSON data between $$$ markers
    const match = aiResponse.match(/\$\$\$(.*?)\$\$\$/s);
    if (!match) {
      return { naturalResponse: aiResponse, expenseData: null };
    }

    const jsonStr = match[1];
    const expenseData = JSON.parse(jsonStr);
    const naturalResponse = aiResponse.replace(/\$\$\$.*?\$\$\$/s, '').trim();

    return { naturalResponse, expenseData };
  } catch (error) {
    console.error('Error parsing expense data:', error);
    return { naturalResponse: aiResponse, expenseData: null };
  }
}

// Function to send WhatsApp message
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
  console.log('WhatsApp API response:', result);
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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? '');
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Handle incoming messages and status updates
    if (req.method === 'POST') {
      const body = await req.json()
      console.log('Received webhook:', JSON.stringify(body, null, 2))

      // Process messages
      if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const message = body.entry[0].changes[0].value.messages[0]
        const sender = body.entry[0].changes[0].value.contacts[0]
        
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

        // Get the user ID
        const { data: userIdData, error: userIdError } = await supabase
          .from('whatsapp_users')
          .select('id')
          .eq('phone_number', sender.wa_id)
          .single()

        if (userIdError) {
          console.error('Error getting user ID:', userIdError)
          throw userIdError
        }

        // Store the incoming message
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
          user_id: userIdData.id,
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
            console.log('Generating AI response for:', message.text.body)
            
            // Get conversation history
            const conversationHistory = await getConversationHistory(supabase, userIdData.id);
            
            // Construct improved prompt with expense tracking capabilities
            const prompt = `You are a helpful WhatsApp expense tracking assistant. Your main goal is to help users track their expenses and provide insights about their spending. You can also handle general conversation.

For expense-related messages:
1. If the user mentions spending money, buying something, or asks about their expenses, treat it as an expense-related message
2. When an expense is mentioned, extract the following information:
   - Amount (required)
   - Category (optional: groceries, restaurant, entertainment, transport, utilities, shopping, other)
   - Description (optional)
   - Date (optional, default to current date)
3. Format expense data as JSON between $$$ markers
4. Provide a natural, conversational response

Example expense formats the user might send:
- "I spent $50 on groceries"
- "bought lunch for $15"
- "paid $100 for electricity bill"

Previous conversation:
${conversationHistory}

Current message:
User: ${message.text.body}

If you detect an expense, include the structured data between $$$ markers, like this:
$$$
{
  "isExpense": true,
  "amount": 50,
  "category": "groceries",
  "description": "weekly groceries",
  "date": "2024-03-15"
}
$$$

If it's not an expense-related message, respond naturally and include:
$$$
{
  "isExpense": false
}
$$$

Remember to:
- Keep responses brief and friendly
- Be helpful with expense tracking
- Handle both expense and non-expense messages naturally
- Use the conversation history to maintain context`;
            
            // Generate content using Gemini AI
            const result = await model.generateContent({
              contents: [{
                parts: [{ text: prompt }]
              }]
            });
            
            const response = await result.response;
            const aiResponse = response.text();
            
            console.log('AI generated response:', aiResponse);

            // Parse the AI response
            const { naturalResponse, expenseData } = parseExpenseData(aiResponse);

            // If expense data is present and valid, store it
            if (expenseData && expenseData.isExpense && expenseData.amount) {
              const { error: expenseError } = await supabase
                .from('expenses')
                .insert({
                  amount: expenseData.amount,
                  category: expenseData.category || null,
                  description: expenseData.description || null,
                  date: expenseData.date || new Date().toISOString(),
                  user_id: userIdData.id
                });

              if (expenseError) {
                console.error('Error storing expense:', expenseError);
                throw expenseError;
              }
            }

            // Send response back via WhatsApp
            const whatsappResponse = await sendWhatsAppMessage(sender.wa_id, naturalResponse);
            
            // Store AI response in database
            const aiMessageData = {
              whatsapp_message_id: whatsappResponse.messages[0].id,
              user_id: userIdData.id,
              direction: 'outgoing',
              message_type: 'text',
              content: { text: naturalResponse },
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
            console.error('Error generating or sending AI response:', error)
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
