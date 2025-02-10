
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PackageIcon, Loader2 } from "lucide-react";

interface CreditPackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  credits_amount: number;
  currency: string;
}

interface CreditPackageSelectorProps {
  onSelect: (packageId: string) => void;
  isLoading?: boolean;
}

export const CreditPackageSelector = ({ onSelect, isLoading: isProcessing }: CreditPackageSelectorProps) => {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const { data: packages, isLoading } = useQuery({
    queryKey: ["creditPackages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_products")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) throw error;
      return data as CreditPackage[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {packages?.map((pkg) => (
        <Card
          key={pkg.id}
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedPackage === pkg.id ? "border-primary" : ""
          }`}
          onClick={() => setSelectedPackage(pkg.id)}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageIcon className="h-5 w-5" />
              {pkg.name}
            </CardTitle>
            <CardDescription>{pkg.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {(pkg.price / 100).toLocaleString("en-US", {
                style: "currency",
                currency: pkg.currency,
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {pkg.credits_amount} credits
            </p>
          </CardContent>
          <CardFooter>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(pkg.id);
              }}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Select Package"
              )}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};
