
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!signature || !webhookSecret) {
      throw new Error('Missing Stripe webhook signature or secret');
    }

    const body = await req.text();
    let event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error(`Webhook signature verification failed:`, err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing webhook event:', event.type);

    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object;
        console.log('Processing paid invoice:', invoice.id);
        
        // Get customer and subscription details
        const subscription = invoice.subscription 
          ? await stripe.subscriptions.retrieve(invoice.subscription)
          : null;
        
        // Get user_id either from subscription metadata or invoice metadata
        const userId = subscription?.metadata?.user_id || invoice.metadata?.user_id;
        
        if (!userId) {
          console.error('No user_id found in metadata');
          throw new Error('No user_id found in metadata');
        }

        // Get the price and product information
        let creditsAmount = 0;
        let productId = '';

        if (subscription) {
          // For subscription payments
          const items = subscription.items.data[0];
          const price = await stripe.prices.retrieve(items.price.id);
          const product = await stripe.products.retrieve(price.product);
          
          creditsAmount = subscription.metadata.credits_amount 
            ? parseInt(subscription.metadata.credits_amount) 
            : (product.metadata.credits_amount 
              ? parseInt(product.metadata.credits_amount) 
              : 0);
          productId = product.id;
        } else {
          // For one-time payments
          const lineItem = invoice.lines.data[0];
          const price = await stripe.prices.retrieve(lineItem.price.id);
          const product = await stripe.products.retrieve(price.product);
          
          creditsAmount = product.metadata.credits_amount 
            ? parseInt(product.metadata.credits_amount) 
            : 0;
          productId = product.id;
        }

        if (creditsAmount > 0) {
          // Add credits to user
          const { error: creditError } = await supabase.rpc(
            'add_user_credits',
            {
              p_user_id: userId,
              p_amount: creditsAmount,
              p_transaction_type: 'purchase',
              p_product_type: 'image_generation',
              p_metadata: {
                invoice_id: invoice.id,
                subscription_id: subscription?.id,
                product_id: productId,
              },
            }
          );

          if (creditError) {
            console.error('Error adding credits:', creditError);
            throw creditError;
          }

          // Send WhatsApp notification
          const { data: userData } = await supabase
            .from('whatsapp_users')
            .select('phone_number')
            .eq('id', userId)
            .single();

          if (userData) {
            const message = subscription
              ? `🎉 Your subscription credits (${creditsAmount}) have been added to your account.\n\nSend "balance" to check your new credit balance.`
              : `🎉 Payment successful! ${creditsAmount} credits have been added to your account.\n\nSend "balance" to check your new credit balance.`;

            await supabase.functions.invoke('whatsapp-send', {
              body: {
                message_type: 'text',
                recipient: userData.phone_number,
                content: {
                  text: message
                }
              }
            });
          }
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('Subscription updated:', subscription.id);
        // You might want to handle subscription updates differently
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('Subscription cancelled:', subscription.id);
        // You might want to handle subscription cancellations differently
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
