
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const WhatsAppChat = () => {
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [pin, setPin] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!recipient || !message) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all fields",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          message_type: 'text',
          recipient: recipient,
          content: {
            text: message
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Message sent successfully",
      });
      setMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleRegister = async () => {
    if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid 6-digit PIN",
      });
      return;
    }

    setIsRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-register', {
        body: { pin }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "WhatsApp number registered successfully",
      });
      setPin("");
    } catch (error) {
      console.error('Error registering number:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to register WhatsApp number",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-4">
      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chat">Send Message</TabsTrigger>
          <TabsTrigger value="register">Register Number</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-4">
          <Alert>
            <AlertDescription>
              Enter a WhatsApp number with country code (e.g., +1234567890)
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            <Input
              type="tel"
              placeholder="WhatsApp number (with country code)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            
            <div className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button 
                onClick={handleSend} 
                disabled={isSending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="register" className="space-y-4">
          <Alert>
            <AlertDescription>
              Enter a 6-digit PIN to register your WhatsApp business number
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Enter 6-digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={6}
              pattern="\d*"
            />
            
            <Button 
              onClick={handleRegister} 
              disabled={isRegistering}
              className="w-full"
            >
              {isRegistering ? "Registering..." : "Register Number"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WhatsAppChat;
