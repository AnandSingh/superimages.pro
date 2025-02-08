
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Enhanced conversation history function with metadata
async function getConversationHistory(supabase: any, userId: string, limit = 5) {
  console.log(`Fetching conversation history for user ${userId}, limit: ${limit}`);
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

  if (!messages || messages.length === 0) {
    console.log('No conversation history found');
    return '';
  }

  const orderedMessages = messages.reverse();
  console.log(`Found ${orderedMessages.length} messages in history`);
  
  return orderedMessages.map(msg => {
    const role = msg.direction === 'incoming' ? 'User' : 'Assistant';
    const text = msg.content.text || '[media content]';
    return `${role}: ${text}`;
  }).join('\n');
}

// Enhanced AI response interface
interface ExpenseData {
  amount: number;
  category?: string;
  description?: string;
  date?: string;
}

interface QueryMetadata {
  type: 'total' | 'category' | 'timeframe';
  timeframe: 'today' | 'week' | 'month';
  category?: string;
}

interface AIResponse {
  metadata: {
    type: 'expense' | 'query' | 'conversation';
    queryMetadata?: QueryMetadata;
    expenseData?: ExpenseData;
    timestamp: string;
  };
  message: string;
}

// Enhanced AI response parser with validation
function parseAIResponse(aiResponse: string): AIResponse | null {
  try {
    console.log('Parsing AI response:', aiResponse);
    const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response');
      return null;
    }

    const response = JSON.parse(jsonMatch[1]) as AIResponse;
    // Add timestamp if not present
    if (!response.metadata.timestamp) {
      response.metadata.timestamp = new Date().toISOString();
    }
    
    console.log('Parsed AI response:', response);
    return response;
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return null;
  }
}

// Enhanced expense storage with validation
async function storeExpense(supabase: any, userId: string, expenseData: ExpenseData) {
  console.log(`Storing expense for user ${userId}:`, expenseData);
  
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
    console.log('Expense stored successfully');
    return true;
  } catch (error) {
    console.error('Error storing expense:', error);
    return false;
  }
}

// Enhanced expense summary with detailed calculations
async function getExpenseSummary(supabase: any, userId: string, timeframe: string = 'today', category?: string) {
  const executionStart = Date.now();
  console.log(`Getting expense summary for user ${userId}, timeframe: ${timeframe}, category: ${category}`);
  
  const now = new Date();
  const startDate = new Date();
  
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
      startDate.setHours(0, 0, 0, 0);
  }

  console.log(`Query time range: ${startDate.toISOString()} to ${now.toISOString()}`);

  try {
    let query = supabase
      .from('expenses')
      .select('amount, category, description, date')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString())
      .lte('date', now.toISOString());

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data: expenses, error } = await query;

    if (error) {
      console.error('Error fetching expenses:', error);
      throw error;
    }

    console.log(`Found ${expenses?.length || 0} expenses in time range`);

    if (!expenses || expenses.length === 0) {
      return `No expenses found for ${timeframe}${category ? ` in category ${category}` : ''}.`;
    }

    // Initialize category tracking
    const categories: Record<string, { total: number; items: { description: string; amount: number; date: string }[] }> = {
      groceries: { total: 0, items: [] },
      restaurant: { total: 0, items: [] },
      entertainment: { total: 0, items: [] },
      transport: { total: 0, items: [] },
      utilities: { total: 0, items: [] },
      shopping: { total: 0, items: [] },
      other: { total: 0, items: [] }
    };

    // Calculate totals with enhanced tracking
    let total = 0;
    expenses.forEach((exp: any) => {
      const amount = Number(exp.amount);
      total += amount;

      const cat = exp.category as keyof typeof categories;
      if (categories[cat]) {
        categories[cat].total += amount;
        categories[cat].items.push({
          description: exp.description || 'Unspecified',
          amount: amount,
          date: exp.date
        });
      }
    });

    // Build detailed response
    let summary = `Total expenses for ${timeframe}: $${total.toFixed(2)}\n`;
    if (category && category !== 'all') {
      summary += `\nDetailed breakdown for ${category}:`;
      const categoryData = categories[category as keyof typeof categories];
      categoryData.items.forEach(item => {
        summary += `\n- ${item.description}: $${item.amount.toFixed(2)} (${new Date(item.date).toLocaleString()})`;
      });
    } else {
      summary += '\nBreakdown by category:';
      Object.entries(categories).forEach(([category, data]) => {
        if (data.total > 0) {
          summary += `\n${category.charAt(0).toUpperCase() + category.slice(1)}: $${data.total.toFixed(2)}`;
          if (data.items.length > 0) {
            summary += '\n  Includes:';
            data.items.forEach(item => {
              summary += `\n  - ${item.description}: $${item.amount.toFixed(2)}`;
            });
          }
        }
      });
    }

    const executionTime = Date.now() - executionStart;
    console.log(`Generated summary in ${executionTime}ms:`, summary);
    return summary;
  } catch (error) {
    console.error('Error getting expense summary:', error);
    return 'Sorry, I had trouble getting your expense summary. Please try again.';
  }
}

// Enhanced WhatsApp message sender with retry logic
async function sendWhatsAppMessage(recipient: string, text: string) {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

  console.log(`Sending WhatsApp message to ${recipient}`);

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? '');
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    if (req.method === 'POST') {
      const body = await req.json()
      console.log('Received webhook:', JSON.stringify(body, null, 2))

      if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const message = body.entry[0].changes[0].value.messages[0]
        const sender = body.entry[0].changes[0].value.contacts[0]
        
        const { data: userIdData, error: userIdError } = await supabase
          .from('whatsapp_users')
          .select('id')
          .eq('phone_number', sender.wa_id)
          .single()

        if (userIdError) {
          console.error('Error getting user ID:', userIdError)
          throw userIdError
        }

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

        if (message.type === 'text') {
          const conversationHistory = await getConversationHistory(supabase, userIdData.id);
          
          const prompt = `You are a helpful WhatsApp expense tracking assistant. Format your entire response as a JSON object with this enhanced structure:

{
  "metadata": {
    "type": "expense" | "query" | "conversation",
    "timestamp": "current ISO timestamp",
    "queryMetadata": {
      "type": "total" | "category" | "timeframe",
      "timeframe": "today" | "week" | "month",
      "category": "all" | specific-category
    },
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
2. If the user asks about spending, mentions "total", asks to verify ("are you sure?"), or asks to recalculate: 
   - set type="query"
   - include queryMetadata with appropriate timeframe and category
3. For general conversation: set type="conversation"
4. ALWAYS include a timestamp
5. The "message" field should be natural and friendly

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

            if (parsedResponse.metadata.type === 'expense' && parsedResponse.metadata.expenseData) {
              const stored = await storeExpense(supabase, userIdData.id, parsedResponse.metadata.expenseData);
              if (!stored) {
                responseMessage = "Sorry, I couldn't save your expense. Please try again.";
              }
            } else if (parsedResponse.metadata.type === 'query') {
              const queryMeta = parsedResponse.metadata.queryMetadata;
              if (queryMeta) {
                const summary = await getExpenseSummary(
                  supabase, 
                  userIdData.id, 
                  queryMeta.timeframe,
                  queryMeta.category
                );
                responseMessage = summary;
              }
            }

            const whatsappResponse = await sendWhatsAppMessage(sender.wa_id, responseMessage);
            
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
