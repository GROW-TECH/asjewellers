// app/utils/payments.ts
import { Platform, Alert } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';

type Profile = { id?: number; name?: string; full_name?: string; email?: string; phone?: string };

// Global declaration for Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}

let razorpayScriptLoaded = false;

export async function openRazorpay(
  order_id: string,
  amount: number,
  currency: string,
  key_id: string,
  profile: Profile,
  planName: string,
  verifyUrl: string,
  subscriptionId: number
): Promise<any> {
  console.log('🔄 Opening Razorpay...', { 
    platform: Platform.OS, 
    order_id, 
    amount, 
    key_id: key_id ? 'present' : 'missing' 
  });

  if (Platform.OS === 'web') {
    return await handleWebRazorpay(
      order_id,
      amount,
      currency,
      key_id,
      profile,
      planName,
      verifyUrl,
      subscriptionId
    );
  } else {
    return await handleNativeRazorpay(
      order_id,
      amount,
      currency,
      key_id,
      profile,
      planName,
      verifyUrl,
      subscriptionId
    );
  }
}

async function handleWebRazorpay(
  order_id: string,
  amount: number,
  currency: string,
  key_id: string,
  profile: Profile,
  planName: string,
  verifyUrl: string,
  subscriptionId: number
): Promise<any> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { success: false, message: 'Not in browser environment' };
  }

  try {
    // Load Razorpay script
    await loadRazorpayScript();
    
    return new Promise((resolve) => {
      const options = {
        key: key_id,
        amount: amount.toString(), // Convert to string for Razorpay
        currency: currency,
        name: 'AS Jewellers',
        description: planName,
        order_id: order_id,
        prefill: {
          name: profile?.name || profile?.full_name || 'Customer',
          email: profile?.email || 'customer@example.com',
          contact: profile?.phone || '9999999999',
        },
        theme: {
          color: '#F6C24A'
        },
        handler: async (response: any) => {
          console.log('✅ Payment successful:', response);
          try {
            const verifyResult = await verifyPaymentWithServer(
              response.razorpay_payment_id,
              response.razorpay_order_id,
              response.razorpay_signature,
              subscriptionId,
              verifyUrl
            );
            resolve(verifyResult);
          } catch (error: any) {
            console.error('❌ Verification failed:', error);
            resolve({ success: false, message: 'Payment verification failed' });
          }
        },
        modal: {
          ondismiss: () => {
            console.log('❌ Payment modal dismissed by user');
            resolve({ success: false, message: 'Payment cancelled' });
          },
        },
        notes: {
          subscription_id: subscriptionId.toString(),
          plan_name: planName
        }
      };

      console.log('🎯 Opening Razorpay with options:', options);

      try {
        const razorpayInstance = new window.Razorpay(options);
        razorpayInstance.open();
      } catch (error: any) {
        console.error('❌ Razorpay open error:', error);
        resolve({ 
          success: false, 
          message: `Failed to open payment gateway: ${error.message}` 
        });
      }
    });
  } catch (error: any) {
    console.error('❌ Razorpay initialization error:', error);
    return { 
      success: false, 
      message: `Payment gateway initialization failed: ${error.message}` 
    };
  }
}

async function handleNativeRazorpay(
  order_id: string,
  amount: number,
  currency: string,
  key_id: string,
  profile: Profile,
  planName: string,
  verifyUrl: string,
  subscriptionId: number
): Promise<any> {
  try {
    const options = {
      key: key_id,
      amount: amount,
      currency: currency,
      name: 'AS Jewellers',
      description: planName,
      order_id: order_id,
      prefill: {
        name: profile?.name || profile?.full_name || 'Customer',
        email: profile?.email || 'customer@example.com',
        contact: profile?.phone || '9999999999',
      },
      theme: { color: '#F6C24A' }
    };

    console.log('📱 Opening native Razorpay:', options);

    const result = await RazorpayCheckout.open(options);
    console.log('✅ Native payment result:', result);

    return await verifyPaymentWithServer(
      result.razorpay_payment_id,
      result.razorpay_order_id,
      result.razorpay_signature,
      subscriptionId,
      verifyUrl
    );

  } catch (error: any) {
    console.error('❌ Native payment error:', error);
    
    if (error.code === 2) {
      return { success: false, message: 'Network error' };
    } else if (error.code === 4) {
      return { success: false, message: 'Payment cancelled by user' };
    } else {
      return { 
        success: false, 
        message: error.description || error.message || 'Payment failed' 
      };
    }
  }
}

async function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Not in browser environment'));
      return;
    }

    // If already loaded, resolve immediately
    if (window.Razorpay) {
      console.log('✅ Razorpay script already loaded');
      resolve();
      return;
    }

    if (razorpayScriptLoaded) {
      // Wait for script to load if it's in progress
      const checkInterval = setInterval(() => {
        if (window.Razorpay) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.Razorpay) {
          reject(new Error('Razorpay script loading timeout'));
        }
      }, 5000);
      return;
    }

    razorpayScriptLoaded = true;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    script.onload = () => {
      console.log('✅ Razorpay script loaded successfully');
      resolve();
    };

    script.onerror = () => {
      console.error('❌ Failed to load Razorpay script');
      razorpayScriptLoaded = false;
      reject(new Error('Failed to load Razorpay payment gateway'));
    };

    document.head.appendChild(script);
  });
}

async function verifyPaymentWithServer(
  paymentId: string,
  orderId: string,
  signature: string,
  subscriptionId: number,
  verifyUrl: string
): Promise<any> {
  console.log('🔍 Verifying payment with server...');

  const verifyResponse = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      razorpay_payment_id: paymentId,
      razorpay_order_id: orderId,
      razorpay_signature: signature,
      subscription_id: subscriptionId,
    }),
  });

  if (!verifyResponse.ok) {
    throw new Error(`Server returned ${verifyResponse.status}`);
  }

  const result = await verifyResponse.json();
  console.log('📋 Verification result:', result);
  return result;
}