
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

    const { phone_number, price_id } = await req.json();

    if (!phone_number || !price_id) {
      throw new Error('Missing required parameters');
    }

    console.log('Creating subscription for:', { phone_number, price_id });

    // Get user information
    const { data: userData, error: userError } = await supabase
      .from('whatsapp_users')
      .select('id, phone_number')
      .eq('phone_number', phone_number)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    // Get price information from Stripe
    const price = await stripe.prices.retrieve(price_id);
    const product = await stripe.products.retrieve(price.product as string);

    console.log('Found product:', product);

    // Create or retrieve Stripe customer
    let customerId: string;
    const { data: existingCustomers } = await stripe.customers.search({
      query: `metadata['whatsapp_number']:'${phone_number}'`,
    });

    if (existingCustomers && existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;
    } else {
      const customer = await stripe.customers.create({
        metadata: {
          whatsapp_number: phone_number,
          user_id: userData.id,
        },
      });
      customerId = customer.id;
    }

    console.log('Customer ID:', customerId);

    // Create subscription with proper metadata
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price_id }],
      metadata: {
        user_id: userData.id,
        product_id: product.id,
        credits_amount: product.metadata.credits_amount,
      },
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    console.log('Created subscription:', subscription.id);

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    return new Response(
      JSON.stringify({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
})
