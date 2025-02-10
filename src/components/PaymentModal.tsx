
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: string;
}

const PaymentForm = ({ phoneNumber, onClose }: { phoneNumber: string; onClose: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Payment failed",
          description: error.message,
        });
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Payment failed. Please try again.",
      });
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing}
        className="w-full"
      >
        {isProcessing ? "Processing..." : "Pay Now"}
      </Button>
    </form>
  );
};

const PaymentModal = ({ isOpen, onClose, phoneNumber }: PaymentModalProps) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const initializePayment = async () => {
      if (!isOpen || !phoneNumber) return;

      try {
        const { data, error } = await supabase.functions.invoke('stripe-create-payment', {
          body: {
            phone_number: phoneNumber,
            product_id: '10-credits-package', // You might want to make this dynamic
          },
        });

        if (error) throw error;
        setClientSecret(data.clientSecret);
      } catch (error) {
        console.error('Error initializing payment:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to initialize payment",
        });
        onClose();
      }
    };

    initializePayment();
  }, [isOpen, phoneNumber]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Purchase Credits</DialogTitle>
        </DialogHeader>
        {clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm phoneNumber={phoneNumber} onClose={onClose} />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
