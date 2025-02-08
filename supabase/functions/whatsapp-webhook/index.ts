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
}

interface AIResponse {
  metadata: {
    type: 'expense' | 'query' | 'conversation';
    expenseData?: ExpenseData;
  };
  message: string;
}

function parseAIResponse(aiResponse: string): AIResponse | null {
  try {
    const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response');
      return null;
    }

    const response = JSON.parse(jsonMatch[1]) as AIResponse;
    return response;
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return null;
  }
}

// Function to store expense in database
async function storeExpense(supabase: any, userId: string, expenseData: ExpenseData) {
  try {
    const { error } = await supabase
      .from('expenses')
      .insert({
        amount: expenseData.amount,
        category: expenseData.category || 'other',
        description: expenseData.description,
        date: expenseData.date || new Date().toISOString(),
        user_id: userId
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error storing expense:', error);
    return false;
  }
}

// Function to get expense summary with improved calculations
async function getExpenseSummary(supabase: any, userId: string, timeframe: string = 'today') {
  const now = new Date();
  const startDate = new Date();
  
  // Set time range based on query
  switch (timeframe.toLowerCase()) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    default:
      startDate.setHours(0, 0, 0, 0); // Default to today
  }

  try {
    // Fetch all expenses in the time range
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('amount, category, description')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString())
      .lte('date', now.toISOString());

    if (error) throw error;

    if (!expenses || expenses.length === 0) {
      return `No expenses found for ${timeframe}.`;
    }

    // Initialize totals for all possible categories
    const categories = {
      groceries: 0,
      restaurant: 0,
      entertainment: 0,
      transport: 0,
      utilities: 0,
      shopping: 0,
      other: 0
    };

    // Track items in "other" category for detailed breakdown
    const otherItems: { description: string; amount: number }[] = [];

    // Calculate totals
    let total = 0;
    expenses.forEach((exp: any) => {
      const amount = Number(exp.amount);
      total += amount;

      if (exp.category === 'other') {
        otherItems.push({
          description: exp.description || 'Unspecified',
          amount: amount
        });
      }
      
      categories[exp.category as keyof typeof categories] += amount;
    });

    // Build the response message
    let summary = `Total expenses for ${timeframe}: $${total.toFixed(2)}\n\nBreakdown by category:`;
    
    // Add each category with non-zero amount
    Object.entries(categories).forEach(([category, amount]) => {
      if (amount > 0) {
        summary += `\n${category.charAt(0).toUpperCase() + category.slice(1)}: $${amount.toFixed(2)}`;
        
        // Add detailed breakdown for "other" category
        if (category === 'other' && otherItems.length > 0) {
          summary += '\n  Includes:';
          otherItems.forEach(item => {
            summary += `\n  - ${item.description}: $${item.amount.toFixed(2)}`;
          });
        }
      }
    });

    return summary;
  } catch (error) {
    console.error('Error getting expense summary:', error);
    return 'Sorry, I had trouble getting your expense summary. Please try again.';
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

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? '');
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Handle incoming messages
    if (req.method === 'POST') {
      const body = await req.json()
      console.log('Received webhook:', JSON.stringify(body, null, 2))

      if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const message = body.entry[0].changes[0].value.messages[0]
        const sender = body.entry[0].changes[0].value.contacts[0]
        
        // Get or create WhatsApp user
        const { data: userIdData, error: userIdError } = await supabase
          .from('whatsapp_users')
          .select('id')
          .eq('phone_number', sender.wa_id)
          .single()

        if (userIdError) {
          console.error('Error getting user ID:', userIdError)
          throw userIdError
        }

        // Store incoming message
        const messageContent = message.type === 'text' ? { text: message.text.body } : message[message.type]
        
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            whatsapp_message_id: message.id,
            user_id: userIdData.id,
            direction: 'incoming',
            message_type: message.type,
            content: messageContent,
            status: 'received',
            created_at: new Date(parseInt(message.timestamp) * 1000).toISOString()
          })

        if (messageError) {
          console.error('Error storing message:', messageError)
          throw messageError
        }

        // Generate AI response for text messages
        if (message.type === 'text') {
          const conversationHistory = await getConversationHistory(supabase, userIdData.id);
          
          const prompt = `You are a helpful WhatsApp expense tracking assistant. Format your entire response as a JSON object with this structure:

{
  "metadata": {
    "type": "expense" | "query" | "conversation",
    "expenseData": {
      "amount": number,
      "category": string (one of: groceries, restaurant, entertainment, transport, utilities, shopping, other),
      "description": string,
      "date": string (ISO format)
    }
  },
  "message": "your natural response here"
}

Rules:
1. If the user mentions spending money: set type="expense" and include expenseData
2. If the user asks about their spending or mentions "total": set type="query"
3. For general conversation: set type="conversation"
4. The "message" field should be natural and friendly, never mention JSON or technical details

Previous conversation:
${conversationHistory}

Current message:
${message.text.body}

Wrap your JSON response between \`\`\`json and \`\`\` markers.`;

          try {
            const result = await model.generateContent([{ text: prompt }]);
            const response = await result.response;
            const aiResponseText = response.text();
            
            console.log('AI generated response:', aiResponseText);

            const parsedResponse = parseAIResponse(aiResponseText);
            if (!parsedResponse) {
              throw new Error('Failed to parse AI response');
            }

            let responseMessage = parsedResponse.message;

            // Handle different response types
            if (parsedResponse.metadata.type === 'expense' && parsedResponse.metadata.expenseData) {
              const stored = await storeExpense(supabase, userIdData.id, parsedResponse.metadata.expenseData);
              if (!stored) {
                responseMessage = "Sorry, I couldn't save your expense. Please try again.";
              }
            } else if (parsedResponse.metadata.type === 'query') {
              // Get fresh expense summary
              const summary = await getExpenseSummary(supabase, userIdData.id);
              responseMessage = summary;
            }

            // Send response via WhatsApp
            const whatsappResponse = await sendWhatsAppMessage(sender.wa_id, responseMessage);
            
            // Store AI response
            const { error: aiMessageError } = await supabase
              .from('messages')
              .insert({
                whatsapp_message_id: whatsappResponse.messages[0].id,
                user_id: userIdData.id,
                direction: 'outgoing',
                message_type: 'text',
                content: { text: responseMessage },
                status: 'sent',
                created_at: new Date().toISOString()
              })

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

      // Handle status updates
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
