
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const paymentIntent = searchParams.get("payment_intent");

  useEffect(() => {
    if (!paymentIntent) {
      navigate("/");
      return;
    }

    const timer = setTimeout(() => {
      navigate("/");
      toast({
        title: "Payment Successful",
        description: "Your credits have been added to your account.",
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [paymentIntent, navigate, toast]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-4 text-center">
      <div className="rounded-full bg-green-100 p-3">
        <CheckCircle className="h-12 w-12 text-green-600" />
      </div>
      <h1 className="text-2xl font-semibold">Payment Successful!</h1>
      <p className="text-muted-foreground">
        Your credits will be added to your account shortly.
      </p>
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Redirecting...
      </div>
    </div>
  );
};

export default PaymentSuccess;
