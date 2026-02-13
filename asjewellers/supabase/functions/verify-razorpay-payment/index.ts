import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, accountId } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !accountId) {
      throw new Error("Missing required payment details");
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`);
    const key = encoder.encode(razorpayKeySecret);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedSignature !== razorpay_signature) {
      throw new Error("Invalid payment signature");
    }

    const basicAuth = btoa(`${Deno.env.get("RAZORPAY_KEY_ID")}:${razorpayKeySecret}`);
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: {
        "Authorization": `Basic ${basicAuth}`,
      },
    });

    if (!paymentResponse.ok) {
      throw new Error("Failed to fetch payment details");
    }

    const payment = await paymentResponse.json();

    if (payment.status !== "captured" && payment.status !== "authorized") {
      throw new Error("Payment not successful");
    }

    const amountInRupees = payment.amount / 100;

    const { data: account, error: accountError } = await supabase
      .from("investment_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      throw new Error("Account not found");
    }

    const currentBalance = parseFloat(account.wallet_balance || 0);
    const newBalance = currentBalance + amountInRupees;

    const { error: updateError } = await supabase
      .from("investment_accounts")
      .update({ 
        wallet_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    if (updateError) {
      throw new Error("Failed to update wallet balance");
    }

    const { error: transactionError } = await supabase
      .from("transactions")
      .insert({
        account_id: accountId,
        type: "wallet_topup",
        amount: amountInRupees,
        status: "completed",
        description: `Wallet top-up via Razorpay (${razorpay_payment_id})`,
        metadata: {
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
        },
      });

    if (transactionError) {
      console.error("Failed to record transaction:", transactionError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        amount: amountInRupees,
        newBalance: newBalance,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});