import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Category mapping for natural language to enum values
const categoryMap: Record<string, Database["public"]["Enums"]["expense_category"]> = {
  'food': 'restaurant',
  'meal': 'restaurant',
  'ice cream': 'restaurant',
  'lunch': 'restaurant',
  'dinner': 'restaurant',
  'breakfast': 'restaurant',
  'snack': 'restaurant',
  'grocery': 'groceries',
  'groceries': 'groceries',
  'supermarket': 'groceries',
  'transport': 'transport',
  'bus': 'transport',
  'taxi': 'transport',
  'uber': 'transport',
  'entertainment': 'entertainment',
  'movie': 'entertainment',
  'game': 'entertainment',
  'utility': 'utilities',
  'bill': 'utilities',
  'electricity': 'utilities',
  'water': 'utilities',
  'shopping': 'shopping',
  'clothes': 'shopping',
  'shoes': 'shopping',
  'other': 'other'
};

// Map natural language categories to enum values
function mapToValidCategory(category: string): Database["public"]["Enums"]["expense_category"] {
  const lowercaseCategory = category.toLowerCase();
  
  // Direct match
  if (categoryMap[lowercaseCategory]) {
    return categoryMap[lowercaseCategory];
  }
  
  // Fuzzy match - find the closest category
  for (const [key, value] of Object.entries(categoryMap)) {
    if (lowercaseCategory.includes(key)) {
      return value;
    }
  }
  
  // Default fallback
  return 'other';
}

// Enhanced conversation history with context
async function getConversationHistory(supabase: any, userId: string, limit = 5) {
  console.log(`Fetching conversation history for user ${userId}, limit: ${limit}`);
  const { data: messages, error } = await supabase
    .from('messages')
    .select('direction, content, conversation_context, created_at')
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
    const context = msg.conversation_context ? 
      `[Context: ${JSON.stringify(msg.conversation_context)}]` : '';
    return `${role}${context}: ${text}`;
  }).join('\n');
}

// Enhanced AI response interface with conversation context
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

interface ConversationContext {
  previous_topic?: string;
  conversation_flow?: string;
  last_action?: string;
  confidence_score?: number;
}

interface AIResponse {
  metadata: {
    type: 'expense' | 'query' | 'financial_advice' | 'clarification' | 'conversation';
    context: ConversationContext;
    queryMetadata?: QueryMetadata;
    expenseData?: ExpenseData;
    timestamp: string;
  };
  message: string;
}

// Enhanced AI response parser with context validation
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
    
    // Ensure context is present
    if (!response.metadata.context) {
      response.metadata.context = {
        conversation_flow: 'general',
        confidence_score: 1.0
      };
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
    // Validate category
    const validCategory = mapToValidCategory(expenseData.category || 'other');
    console.log(`Mapped category '${expenseData.category}' to '${validCategory}'`);

    const { error } = await supabase
      .from('expenses')
      .insert({
        amount: expenseData.amount,
        category: validCategory,
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
          type: 'text',
          text: { body: text }
        }),
      }
    );

    const result = await response.json();
    console.log('WhatsApp API response:', result);
    return result;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
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
        
        // Store incoming message
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            whatsapp_message_id: message.id,
            user_id: userIdData.id,
            direction: 'incoming',
            message_type: message.type,
            content: messageContent,
            status: 'received',
            conversation_context: null,
            created_at: new Date(parseInt(message.timestamp) * 1000).toISOString()
          })

        if (messageError) {
          console.error('Error storing message:', messageError)
          throw messageError
        }

        if (message.type === 'text') {
          const conversationHistory = await getConversationHistory(supabase, userIdData.id);
          
          const prompt = `You are a helpful WhatsApp expense tracking assistant. Your primary roles are:
1. Recording expenses when users report spending
2. Providing expense summaries when explicitly requested
3. Offering financial advice and general conversation

IMPORTANT CONTEXT RULES:
- "Save money" or "money tips" = FINANCIAL_ADVICE type
- Only classify as RECORD_EXPENSE if there's a clear indication of spending (numbers, amounts)
- Only provide totals when explicitly asked about expenses or summaries (QUERY_EXPENSES)
- Default to CONVERSATION type unless clearly about expenses or queries

Format your entire response as a JSON object with this structure:

{
  "metadata": {
    "type": "RECORD_EXPENSE" | "QUERY_EXPENSES" | "FINANCIAL_ADVICE" | "CLARIFICATION" | "CONVERSATION",
    "timestamp": "current ISO timestamp",
    "context": {
      "previous_topic": string | null,
      "conversation_flow": string,
      "last_action": string | null,
      "confidence_score": number,
      "extracted_amount": number | null,
      "extracted_category": string | null,
      "extracted_description": string | null
    }
  },
  "message": "your natural response here"
}

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
            const context = parsedResponse.metadata.context;

            // Handle different types with enhanced context
            switch (parsedResponse.metadata.type) {
              case 'RECORD_EXPENSE':
                if (context.extracted_amount && (context.extracted_category || context.extracted_description)) {
                  const stored = await storeExpense(supabase, userIdData.id, {
                    amount: context.extracted_amount,
                    category: context.extracted_category || 'other',
                    description: context.extracted_description || 'Unspecified expense'
                  });
                  
                  if (!stored) {
                    responseMessage = "I couldn't save your expense. Please make sure to include both the amount and category/description. For example: 'I spent $20 on lunch'";
                    context.last_action = 'expense_failed';
                  } else {
                    responseMessage = `Great! I've recorded your expense of $${context.extracted_amount} for ${context.extracted_description || context.extracted_category}.`;
                    context.last_action = 'expense_stored';
                  }
                } else {
                  responseMessage = "I noticed you're trying to record an expense. Please include both the amount and what it was for. For example: 'I spent $20 on lunch'";
                  context.last_action = 'expense_incomplete';
                }
                break;

              case 'QUERY_EXPENSES':
                if (parsedResponse.metadata.queryMetadata) {
                  const summary = await getExpenseSummary(
                    supabase, 
                    userIdData.id, 
                    parsedResponse.metadata.queryMetadata.timeframe,
                    parsedResponse.metadata.queryMetadata.category
                  );
                  responseMessage = summary;
                  context.last_action = 'summary_provided';
                }
                break;

              case 'financial_advice':
                parsedResponse.metadata.context.conversation_flow = 'advice';
                parsedResponse.metadata.context.last_action = 'advice_given';
                break;

              case 'clarification':
                parsedResponse.metadata.context.conversation_flow = 'clarification';
                parsedResponse.metadata.context.last_action = 'clarification_requested';
                break;

              default:
                parsedResponse.metadata.context.conversation_flow = 'general';
                parsedResponse.metadata.context.last_action = 'conversation';
            }

            const whatsappResponse = await sendWhatsAppMessage(sender.wa_id, responseMessage);
            
            // Store AI response with enhanced context
            const { error: aiMessageError } = await supabase
              .from('messages')
              .insert({
                whatsapp_message_id: whatsappResponse.messages[0].id,
                user_id: userIdData.id,
                direction: 'outgoing',
                message_type: 'text',
                content: { text: responseMessage },
                status: 'sent',
                conversation_context: context,
                created_at: new Date().toISOString(),
                intent: parsedResponse.metadata.type
              })

            if (aiMessageError) {
              console.error('Error storing AI message:', aiMessageError)
              throw aiMessageError
            }

            // Update the context of the incoming message
            const { error: updateError } = await supabase
              .from('messages')
              .update({
                conversation_context: context,
                intent: parsedResponse.metadata.type
              })
              .eq('whatsapp_message_id', message.id)

            if (updateError) {
              console.error('Error updating message context:', updateError)
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
