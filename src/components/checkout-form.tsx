"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

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
  amount_usd: number;
  settlement_reference: string;
  usd_equivalent_rate: number;
  note: string | null;
}

interface ErrorResult {
  error: string;
}

export function CheckoutForm() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<CheckoutResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      order_id: "",
      amount_usd: 500,
      payer: "0xUserWallet",
      merchant_id: "merchant-001",
      site_order_id: "",
    },
  });

  React.useEffect(() => {
    form.reset({
      order_id: `ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      amount_usd: 500.00,
      payer: "0xUserWallet",
      merchant_id: "merchant-001",
      site_order_id: `SITE-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    });
  }, [form]);

  async function onSubmit(values: CheckoutFormValues) {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const responseData: CheckoutResult | ErrorResult = await response.json();

      if (!response.ok) {
        throw new Error((responseData as ErrorResult).error || 'An unknown error occurred.');
      }
      
      setResult(responseData as CheckoutResult);
      // Reset form with a new order ID for the next transaction
      form.reset({
        ...form.getValues(),
        order_id: `ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        site_order_id: `SITE-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl bg-card">
      <CardHeader>
        <CardTitle className="text-xl font-headline">New Payment</CardTitle>
        <CardDescription>Enter payment details to process a transaction.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <Input type="number" step="0.01" placeholder="500.00" {...field} />
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
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
          
          {result && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Payment Successful</AlertTitle>
              <AlertDescription className="break-all">
                <div className="space-y-1 mt-2">
                  <span className="text-sm font-medium text-muted-foreground">Settlement Reference:</span>
                  <p className="font-mono text-sm bg-muted p-2 rounded-md text-foreground">{result.settlement_reference}</p>
                  {result.note && <p className="mt-2 text-xs text-muted-foreground">{result.note}</p>}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
