
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
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        await handlePaymentIntentSucceeded(paymentIntent, supabase);
        break;
      }
      case 'customer.subscription.created':
      case 'invoice.paid': {
        const subscription = event.type === 'customer.subscription.created' 
          ? event.data.object 
          : await stripe.subscriptions.retrieve(event.data.object.subscription);
        await handleSubscriptionEvent(subscription, supabase, stripe);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('Subscription updated:', subscription.id);
        await handleSubscriptionEvent(subscription, supabase, stripe);
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

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  // Update payment transaction status
  const { error: updateError } = await supabase
    .from('payment_transactions')
    .update({ 
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  if (updateError) {
    console.error('Error updating payment status:', updateError);
    throw updateError;
  }

  const userId = paymentIntent.metadata.user_id;
  if (!userId) {
    console.error('No user_id found in payment intent metadata');
    throw new Error('No user_id found in payment intent metadata');
  }

  // Add credits to user
  const { error: creditError } = await supabase.rpc(
    'add_user_credits',
    {
      p_user_id: userId,
      p_amount: parseInt(paymentIntent.metadata.credits_amount),
      p_transaction_type: 'purchase',
      p_product_type: 'image_generation',
      p_metadata: {
        payment_intent_id: paymentIntent.id,
        product_id: paymentIntent.metadata.product_id,
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
    await supabase.functions.invoke('whatsapp-send', {
      body: {
        message_type: 'text',
        recipient: userData.phone_number,
        content: {
          text: `🎉 Payment successful! ${paymentIntent.metadata.credits_amount} credits have been added to your account.\n\nSend "balance" to check your new credit balance.`
        }
      }
    });
  }
}

async function handleSubscriptionEvent(subscription: any, supabase: any, stripe: any) {
  // Get the subscription details including the price
  const items = subscription.items.data[0];
  const price = await stripe.prices.retrieve(items.price.id);
  const product = await stripe.products.retrieve(price.product);
  
  // Get user_id from the subscription metadata
  const userId = subscription.metadata.user_id;
  
  if (!userId) {
    console.error('No user_id found in subscription metadata');
    throw new Error('No user_id found in subscription metadata');
  }

  // Add credits based on the subscription plan
  const creditsAmount = subscription.metadata.credits_amount 
    ? parseInt(subscription.metadata.credits_amount) 
    : (product.metadata.credits_amount 
      ? parseInt(product.metadata.credits_amount) 
      : 0);

  if (creditsAmount > 0) {
    const { error: creditError } = await supabase.rpc(
      'add_user_credits',
      {
        p_user_id: userId,
        p_amount: creditsAmount,
        p_transaction_type: 'purchase',
        p_product_type: 'image_generation',
        p_metadata: {
          subscription_id: subscription.id,
          product_id: product.id,
          invoice_id: subscription.latest_invoice,
        },
      }
    );

    if (creditError) {
      console.error('Error adding subscription credits:', creditError);
      throw creditError;
    }

    // Send WhatsApp notification
    const { data: userData } = await supabase
      .from('whatsapp_users')
      .select('phone_number')
      .eq('id', userId)
      .single();

    if (userData) {
      await supabase.functions.invoke('whatsapp-send', {
        body: {
          message_type: 'text',
          recipient: userData.phone_number,
          content: {
            text: `🎉 Your subscription credits (${creditsAmount}) have been added to your account.\n\nSend "balance" to check your new credit balance.`
          }
        }
      });
    }
  }
}
