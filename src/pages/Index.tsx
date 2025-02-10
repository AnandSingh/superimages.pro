
import { motion } from "framer-motion";
import WhatsAppChat from "@/components/WhatsAppChat";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center max-w-2xl mx-auto"
      >
        <span className="inline-block px-3 py-1 text-sm font-medium bg-secondary text-secondary-foreground rounded-full mb-6 animate-fadeIn">
          WhatsApp Cloud API Demo
        </span>
        <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-foreground mb-6 animate-fadeIn" style={{ animationDelay: "0.2s" }}>
          Send WhatsApp Messages
        </h1>
        <p className="text-lg text-muted-foreground mb-4 animate-fadeIn" style={{ animationDelay: "0.3s" }}>
          Test the WhatsApp Cloud API integration by sending messages to any WhatsApp number.
        </p>
        <div className="text-sm text-muted-foreground mb-8 animate-fadeIn space-y-2" style={{ animationDelay: "0.4s" }}>
          <p>Available commands:</p>
          <ul className="space-y-1">
            <li>"credits" - Check your credit balance</li>
            <li>"buy credits" - View available credit packages</li>
            <li>"buy [package name]" - Purchase a credit package</li>
            <li>"show me [description]" - Generate an image (costs 1 credit)</li>
          </ul>
        </div>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="w-full max-w-2xl"
      >
        <WhatsAppChat />
      </motion.div>
    </div>
  );
};

export default Index;
