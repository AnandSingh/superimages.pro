
import { motion } from "framer-motion";
import WhatsAppChat from "@/components/WhatsAppChat";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, Globe } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Create Images in WhatsApp
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Just say what you want, and it's ready in seconds!
            </p>
            <Button 
              size="lg" 
              className="bg-[#2CB67D] hover:bg-[#2CB67D]/90 text-white font-semibold px-8 py-6 text-lg h-auto"
            >
              Click Here to Chat
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">
              Free to try, no credit card needed
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="w-full max-w-[300px] mx-auto">
              <WhatsAppChat />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Examples Section */}
      <section className="bg-secondary py-16 md:py-24">
        <div className="container mx-auto px-4">
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
                className="relative group rounded-lg overflow-hidden"
              >
                <img
                  src={example.image}
                  alt={example.prompt}
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 bg-black/60 flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-sm">{example.prompt}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <Button 
              size="lg"
              className="bg-[#2CB67D] hover:bg-[#2CB67D]/90 text-white font-semibold px-8 py-6 text-lg h-auto"
            >
              TRY FOR FREE
            </Button>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="bg-background py-16">
        <div className="container mx-auto px-4">
          <h3 className="text-2xl font-bold mb-8 text-center">Get in Touch</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-[#2CB67D]" />
                <a href="mailto:support@example.com" className="text-muted-foreground hover:text-foreground">
                  support@example.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-[#2CB67D]" />
                <a href="/privacy-policy" className="text-muted-foreground hover:text-foreground">
                  Privacy Policy
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-[#2CB67D]" />
                <a href="/terms" className="text-muted-foreground hover:text-foreground">
                  Terms of Service
                </a>
              </div>
              <p className="text-sm text-muted-foreground pt-4">
                © 2024 Superb. All rights reserved.
              </p>
            </div>
            <div className="flex justify-center md:justify-end">
              <img src="/logo.png" alt="Superb Logo" className="h-12" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const examples = [
  {
    prompt: "Create a sleek black sports car on a mountain road",
    image: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80"
  },
  {
    prompt: "An anime-style couple having dinner at a restaurant",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"
  },
  {
    prompt: "Batman standing on a Gotham city rooftop at night",
    image: "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?auto=format&fit=crop&w=800&q=80"
  },
  {
    prompt: "A friendly cat and dog playing together",
    image: "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=800&q=80"
  },
  {
    prompt: "Disney-style animated castle in a magical forest",
    image: "https://images.unsplash.com/photo-1704700104537-69bd10b91850?auto=format&fit=crop&w=800&q=80"
  },
  {
    prompt: "Anime-style character in a cyberpunk city",
    image: "https://images.unsplash.com/photo-1704562733853-988fa24fde1d?auto=format&fit=crop&w=800&q=80"
  }
];

export default Index;
