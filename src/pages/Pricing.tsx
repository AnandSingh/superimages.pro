
import { useNavigate } from "react-router-dom";
import { CreditPackageSelector } from "@/components/CreditPackageSelector";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

const Pricing = () => {
  const navigate = useNavigate();

  const handlePackageSelect = async (packageId: string) => {
    // Navigate back to main page with the selected package
    navigate('/', { state: { selectedPackage: packageId } });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/')}
        className="mb-8"
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Credit Package</h1>
        <p className="text-muted-foreground text-lg">
          Select a package that suits your needs
        </p>
      </div>

      <CreditPackageSelector onSelect={handlePackageSelect} />
    </div>
  );
};

export default Pricing;
