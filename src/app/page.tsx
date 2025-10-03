import { CheckoutForm } from "@/components/checkout-form";
import { Icons } from "@/components/icons";

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-background font-body text-foreground flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-lg">
        <header className="flex items-center gap-4 mb-8 justify-center">
          <Icons.logo className="h-10 w-10 text-primary" />
          <h1 className="text-3xl font-bold font-headline tracking-tight text-primary">
            USD Gateway
          </h1>
        </header>
        <CheckoutForm />
        <footer className="mt-8 text-center text-sm text-muted-foreground">
          <p>A plug-and-play gateway for USD-denominated events.</p>
          <p>Built for sovr.world</p>
        </footer>
      </div>
    </main>
  );
}
