
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PaymentCancelled = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/");
      toast({
        variant: "destructive",
        title: "Payment Cancelled",
        description: "Your payment was cancelled. No credits were added to your account.",
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate, toast]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-4 text-center">
      <div className="rounded-full bg-red-100 p-3">
        <XCircle className="h-12 w-12 text-red-600" />
      </div>
      <h1 className="text-2xl font-semibold">Payment Cancelled</h1>
      <p className="text-muted-foreground">
        Your payment was cancelled. No credits were added to your account.
      </p>
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Redirecting...
      </div>
    </div>
  );
};

export default PaymentCancelled;
