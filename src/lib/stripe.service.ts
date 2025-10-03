// @ts-nocheck
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20', // Use a recent API version
    });
  }

  async createPaymentIntent(amount: number, currency: string, description: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount,
      currency,
      description,
      automatic_payment_methods: { enabled: true },
    });
  }

  async retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(id);
  }

  async constructWebhookEvent(rawBody: Buffer, signature: string, secret: string): Promise<Stripe.Event> {
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}

export const stripeService = new StripeService();
