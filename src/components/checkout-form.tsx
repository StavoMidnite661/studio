
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Separator } from "./ui/separator";

const formSchema = z.object({
  order_id: z.string().min(1, "Order ID is required."),
  amount_usd: z.coerce.number().positive("Amount must be a positive number."),
  payer: z.string().min(1, "Payer wallet is required."),
  merchant_id: z.string().min(1, "Merchant ID is required."),
  site_order_id: z.string().optional(),
});

type CheckoutFormValues = z.infer<typeof formSchema>;

interface CheckoutResult {
  ok: boolean;
  order_id: string;
  clientSecret: string;
}

interface ErrorResult {
  error: string;
}

// A simple mock for a Stripe Elements form
const StripePaymentForm = ({ clientSecret, onPaymentSuccess, amount }: { clientSecret: string, onPaymentSuccess: (ref: string) => void, amount: number }) => {
  const [paying, setPaying] = React.useState(false);
  const [paid, setPaid] = React.useState(false);

  const handlePay = () => {
    setPaying(true);
    // In a real app, you would use Stripe.js to confirm the payment.
    // This is a simulation.
    setTimeout(() => {
      setPaying(false);
      setPaid(true);
      // Simulate getting a settlement reference back
      const settlementReference = `pi_${Math.random().toString(36).substring(2)}`;
      onPaymentSuccess(settlementReference);
    }, 2000);
  };
  
  if (paid) {
    return (
       <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Payment Successful!</AlertTitle>
          <AlertDescription>
            Your payment has been processed.
          </AlertDescription>
        </Alert>
    )
  }

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
        <h3 className="font-medium text-center">Complete Payment with Stripe</h3>
        <div className="h-10 w-full bg-background rounded-md border flex items-center px-3 text-sm text-muted-foreground">
            Mock Card Details
        </div>
        <Button onClick={handlePay} disabled={paying || !clientSecret} className="w-full">
            {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {paying ? 'Processing...' : `Pay $${(amount).toFixed(2)}`}
        </Button>
        <p className="text-xs text-muted-foreground text-center">This is a simulated Stripe payment form.</p>
    </div>
  )
}


export function CheckoutForm() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<CheckoutResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [formValues, setFormValues] = React.useState<CheckoutFormValues | null>(null);
  const [paymentSuccessRef, setPaymentSuccessRef] = React.useState<string | null>(null);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      order_id: "",
      amount_usd: 50.00,
      payer: "0xUserWallet", // This should be the connected user's wallet
      merchant_id: "merchant-001",
      site_order_id: "",
    },
  });

  React.useEffect(() => {
    const randomOrderId = `ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const randomSiteOrderId = `SITE-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    form.reset({
      order_id: randomOrderId,
      amount_usd: 50.00,
      payer: "0xUserWallet", // This should be the connected user's wallet
      merchant_id: "merchant-001",
      site_order_id: randomSiteOrderId,
    });
  }, [form]);


  async function handleFormSubmit(values: CheckoutFormValues) {
    setFormValues(values);
    setIsConfirming(true);
    setError(null);
    setResult(null);
    setPaymentSuccessRef(null);
  }

  async function processCheckout() {
    if (!formValues) return;

    setIsConfirming(false);
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues),
      });

      const responseData: CheckoutResult | ErrorResult = await response.json();

      if (!response.ok) {
        throw new Error((responseData as ErrorResult).error || 'An unknown error occurred.');
      }
      
      setResult(responseData as CheckoutResult);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }
  
  const handlePaymentSuccess = (reference: string) => {
    setPaymentSuccessRef(reference);
    // Reset form for next transaction
     form.reset({
        ...form.getValues(),
        order_id: `ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        site_order_id: `SITE-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      });
     setResult(null); // Clear the client secret form
  }

  const processingFee = formValues ? (formValues.amount_usd * 0.01).toFixed(2) : '0.00';
  const networkFee = '0.50'; // Example fixed network fee
  const totalAmount = formValues ? (formValues.amount_usd + parseFloat(processingFee) + parseFloat(networkFee)).toFixed(2) : '0.00';


  return (
    <>
      <Card className="w-full max-w-lg mx-auto shadow-xl bg-card">
        <CardHeader>
          <CardTitle className="text-xl font-headline">New Payment</CardTitle>
          <CardDescription>Enter payment details to process a transaction.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order ID</FormLabel>
                    <FormControl>
                      <Input placeholder="ORD-12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount_usd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="50.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payer Wallet</FormLabel>
                    <FormControl>
                      <Input placeholder="0x..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="merchant_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Merchant ID</FormLabel>
                    <FormControl>
                      <Input placeholder="merchant-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="site_order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site Order ID (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="your-site-order-id" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
                {(isLoading || isConfirming) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Pay Now
              </Button>
            </form>
          </Form>
          
          <div className="mt-6 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Payment Failed</AlertTitle>
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
            )}
            
            {result?.clientSecret && formValues && (
                <StripePaymentForm 
                    clientSecret={result.clientSecret} 
                    onPaymentSuccess={handlePaymentSuccess}
                    amount={formValues.amount_usd}
                />
            )}

            {paymentSuccessRef && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Payment Complete</AlertTitle>
                <AlertDescription className="break-all">
                  <div className="space-y-1 mt-2">
                    <span className="text-sm font-medium text-muted-foreground">Settlement Reference:</span>
                    <p className="font-mono text-sm bg-muted p-2 rounded-md text-foreground">{paymentSuccessRef}</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isConfirming} onOpenChange={setIsConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Your Payment</DialogTitle>
            <DialogDescription>
              Please review the details below before confirming your transaction.
            </DialogDescription>
          </DialogHeader>
          {formValues && (
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-medium">${formValues.amount_usd.toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Processing Fee (1%)</span>
                        <span className="font-medium">${processingFee} USD</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Network Fee</span>
                        <span className="font-medium">${networkFee} USD</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center font-bold text-lg">
                        <span>Total</span>
                        <span>${totalAmount} USD</span>
                    </div>
                </div>
                 <Separator />
                <div className="text-xs text-muted-foreground space-y-2">
                    <p>
                      This USD-denominated transaction will be backed by your POSCR credit.
                    </p>
                    <p>By clicking "Confirm & Pay", you agree to the Sovr.world Terms of Service and Privacy Policy. All charges are final and non-refundable.</p>
                    <p>This transaction will be recorded on a public ledger. Your payment is being processed via the Sovr.world USD Gateway.</p>
                     <a href="https://www.gateway.sovr.world/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        Learn more about Sovr.world Gateway <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
            </div>
          )}
          <DialogFooter className="sm:justify-between gap-2">
            <DialogClose asChild>
                <Button type="button" variant="outline" className="w-full sm:w-auto">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={processCheckout} disabled={isLoading} className="w-full sm:w-auto">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

    