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

// Function to analyze message intent using AI
async function analyzeMessageIntent(message: string, model: any) {
  const prompt = `You are an expense tracking assistant. Analyze this message and classify it:
"${message}"

Respond in JSON format with these fields:
- intent: One of RECORD_EXPENSE, QUERY_EXPENSES, MODIFY_EXPENSE, or OTHER
- details: For RECORD_EXPENSE include amount, category (one of: groceries, restaurant, entertainment, transport, utilities, shopping, other), description, date
- queryParams: For QUERY_EXPENSES include timeFrame, category (optional), queryType (total or breakdown)

Example response for expense recording:
{
  "intent": "RECORD_EXPENSE",
  "details": {
    "amount": 50.00,
    "category": "groceries",
    "description": "weekly shopping",
    "date": "2024-03-19"
  }
}

Example response for querying:
{
  "intent": "QUERY_EXPENSES",
  "queryParams": {
    "timeFrame": "last_week",
    "category": null,
    "queryType": "total"
  }
}`;

  const result = await model.generateContent([
    { text: prompt }
  ]);
  
  const response = await result.response;
  try {
    return JSON.parse(response.text());
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return { intent: 'OTHER' };
  }
}

// Function to handle expense queries
async function handleExpenseQuery(supabase: any, userId: string, queryParams: any) {
  const { timeFrame, category, queryType } = queryParams;
  
  let timeFilter = 'NOW() - INTERVAL \'1 week\'';
  if (timeFrame === 'this_month') timeFilter = 'DATE_TRUNC(\'month\', NOW())';
  else if (timeFrame === 'last_month') timeFilter = 'DATE_TRUNC(\'month\', NOW() - INTERVAL \'1 month\')';
  
  let query = supabase
    .from('expenses')
    .select(queryType === 'total' ? 'amount' : 'amount, category, date, description')
    .eq('user_id', userId)
    .gte('date', timeFilter);
    
  if (category) {
    query = query.eq('category', category);
  }
  
  const { data: expenses, error } = await query;
  
  if (error) {
    console.error('Error querying expenses:', error);
    return 'Sorry, I encountered an error while fetching your expenses.';
  }
  
  if (queryType === 'total') {
    const total = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
    return `Your total expenses for the period: $${total.toFixed(2)}`;
  } else {
    const breakdown = expenses.reduce((acc: any, exp: any) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {});
    
    let response = `Here's your expense breakdown:\n`;
    Object.entries(breakdown).forEach(([category, amount]) => {
      response += `${category}: $${(amount as number).toFixed(2)}\n`;
    });
    return response;
  }
}

// Function to record an expense
async function recordExpense(supabase: any, userId: string, details: any) {
  const { amount, category, description, date } = details;
  
  const { error } = await supabase
    .from('expenses')
    .insert({
      user_id: userId,
      amount,
      category,
      description,
      date: date || new Date().toISOString()
    });
    
  if (error) {
    console.error('Error recording expense:', error);
    return 'Sorry, I encountered an error while recording your expense.';
  }
  
  return `✅ Recorded expense: $${amount.toFixed(2)} for ${category}${description ? ` (${description})` : ''}`;
}

// Function to format AI response based on intent analysis
async function handleIntentResponse(supabase: any, userId: string, intentData: any) {
  switch (intentData.intent) {
    case 'RECORD_EXPENSE':
      return await recordExpense(supabase, userId, intentData.details);
    case 'QUERY_EXPENSES':
      return await handleExpenseQuery(supabase, userId, intentData.queryParams);
    default:
      return 'I can help you track expenses. Try saying something like "Spent $50 on groceries" or "How much did I spend last week?"';
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
    // Test endpoint handling
    if (url.pathname === '/test') {
      return new Response(JSON.stringify({ status: 'ok', message: 'Webhook is operational' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verification request handling
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

    // Handle incoming messages
    if (req.method === 'POST') {
      const body = await req.json()
      console.log('Received webhook:', JSON.stringify(body, null, 2))

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

        // Handle text messages for expense tracking
        if (message.type === 'text') {
          try {
            // Analyze message intent
            const intentAnalysis = await analyzeMessageIntent(message.text.body, model);
            console.log('Intent analysis:', intentAnalysis);
            
            // Store the message with intent and parsed data
            const messageData = {
              whatsapp_message_id: message.id,
              user_id: userIdData.id,
              direction: 'incoming',
              message_type: message.type,
              content: { text: message.text.body },
              intent: intentAnalysis.intent,
              parsed_data: intentAnalysis,
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

            // Generate and send response based on intent
            const response = await handleIntentResponse(supabase, userIdData.id, intentAnalysis);
            console.log('Generated response:', response);
            
            // Send response via WhatsApp
            const whatsappResponse = await sendWhatsAppMessage(sender.wa_id, response);
            
            // Store AI response
            const aiMessageData = {
              whatsapp_message_id: whatsappResponse.messages[0].id,
              user_id: userIdData.id,
              direction: 'outgoing',
              message_type: 'text',
              content: { text: response },
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
            console.error('Error processing message:', error)
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
