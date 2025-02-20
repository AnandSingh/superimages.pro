
import { motion } from "framer-motion";
import WhatsAppMockup from "@/components/WhatsAppMockup";
import { Button } from "@/components/ui/button";
import { Mail, Globe } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="container mx-auto px-4 lg:px-24 py-8 md:py-12 min-h-[95vh] flex items-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center md:text-left"
          >
            <h1 className="text-5xl leading-none md:leading-tight md:text-8xl font-bold text-foreground mb-4 md:mb-8">
              Create Images in WhatsApp
            </h1>
            <p className="text-lg leading-snug md:leading-normal md:text-3xl text-muted-foreground mb-6 md:mb-10">
              Just say what you want, and it's ready in seconds!
            </p>
            <a 
              href="https://linktw.in/cfITPA"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button 
                size="lg" 
                className="bg-[#25D366] hover:bg-[#25D366]/90 text-white font-semibold px-10 py-8 text-xl h-auto"
              >
                Click Here to Chat
              </Button>
            </a>
            <p className="mt-4 md:mt-6 text-base md:text-lg text-muted-foreground">
              Free to try, no credit card needed
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative flex justify-center md:justify-end px-0 md:px-4"
          >
            <img 
              src="https://s3.gifyu.com/images/bSkqc.gif" 
              alt="WhatsApp AI Demo"
              className="w-full max-w-[1000px] md:max-w-[500px]"
            />
          </motion.div>
        </div>
      </section>

      {/* Examples Section */}
      <section className="bg-secondary py-16 md:py-24">
        <div className="container mx-auto px-4 lg:px-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold mb-4">Easy as 1,2,3...</h2>
            <p className="text-lg text-muted-foreground">
              Check out some of the awesome images made with just a few words:
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {examples.map((example, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="relative rounded-lg overflow-hidden mx-auto w-full max-w-sm"
              >
                <div className="absolute top-0 left-0 right-0 bg-black/60 p-4 z-10">
                  <p className="text-white text-sm text-center">{example.prompt}</p>
                </div>
                <img
                  src={example.image}
                  alt={example.prompt}
                  className="w-full h-64 object-cover"
                />
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <a 
              href="https://linktw.in/cfITPA"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button 
                size="lg"
                className="bg-[#2CB67D] hover:bg-[#2CB67D]/90 text-white font-semibold px-8 py-6 text-lg h-auto"
              >
                TRY FOR FREE
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="bg-background py-16">
        <div className="container mx-auto px-4 lg:px-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-4 text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <Mail className="h-5 w-5 text-[#25D366]" />
                <a href="mailto:support@example.com" className="text-muted-foreground hover:text-foreground">
                  support@example.com
                </a>
              </div>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <Globe className="h-5 w-5 text-[#25D366]" />
                <a 
                  href="https://superbtools.pro/privacy-policy" 
                  className="text-muted-foreground hover:text-foreground"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
              </div>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <Globe className="h-5 w-5 text-[#25D366]" />
                <a 
                  href="https://superbtools.pro/terms-of-service" 
                  className="text-muted-foreground hover:text-foreground"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms of Service
                </a>
              </div>
              <p className="text-sm text-muted-foreground pt-4">
                © 2024 Superb. All rights reserved.
              </p>
            </div>
            <div className="flex justify-center md:justify-end">
              <img 
                alt="Superb Logo" 
                src="/lovable-uploads/95a69163-fc19-4829-a1f9-70e95ab9fe4d.png" 
                className="h-48 object-contain" 
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const examples = [
  {
    prompt: "Create a black sports car in a rainy night city",
    image: "/lovable-uploads/af0256b5-5b3e-4033-ba76-f39f598433ac.png"
  },
  {
    prompt: "Show me Batman in a dark alley",
    image: "/lovable-uploads/c906dac1-9222-4453-af7d-c6ad9ccf219a.png"
  },
  {
    prompt: "Make me the Petronas Towers at sunset",
    image: "/lovable-uploads/dd8dabde-764d-48d3-b337-e70d0f3f972c.png"
  },
  {
    prompt: "Create a cute plush lion toy",
    image: "/lovable-uploads/2ec9c20a-367e-4251-9483-73dd8cceb13a.png"
  },
  {
    prompt: "Make me a strawberry cheesecake",
    image: "/lovable-uploads/9d62d7af-bd2d-496e-a70b-91b94443ccee.png"
  },
  {
    prompt: "Create an anime cafe with cherry blossoms",
    image: "/lovable-uploads/0adcaefe-b8a6-4149-9652-aeacda5d48ba.png"
  }
];

export default Index;
