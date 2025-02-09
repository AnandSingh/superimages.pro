
import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ImageGenerationTest() {
  const [prompt, setPrompt] = useState("");
  const [optimizedPrompt, setOptimizedPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const generateOptimizedPrompt = async (userPrompt: string) => {
    try {
      const response = await fetch(
        "https://dkyeopbzysvdxrldgmjl.supabase.co/functions/v1/whatsapp-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            entry: [{
              changes: [{
                value: {
                  messages: [{
                    type: "text",
                    text: { body: userPrompt }
                  }],
                  contacts: [{
                    wa_id: "test_user"
                  }]
                }
              }]
            }]
          })
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate optimized prompt");
      }

      return "Optimizing prompt..."; // Temporary placeholder
    } catch (error) {
      console.error("Error generating optimized prompt:", error);
      throw error;
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const optimized = await generateOptimizedPrompt(prompt);
      setOptimizedPrompt(optimized);

      // For now, we'll use a placeholder image
      setGeneratedImage("/placeholder.svg");
      
      toast({
        title: "Success",
        description: "Image generated successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Test Image Generation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Enter your prompt (e.g., 'Show me a sunset over mountains')"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full"
                />
                <Button
                  onClick={handleGenerate}
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Image"
                  )}
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Optimized Prompt:</label>
                <Textarea
                  value={optimizedPrompt}
                  readOnly
                  className="h-32 resize-none"
                  placeholder="The optimized prompt will appear here..."
                />
              </div>
            </div>

            {/* Result Section */}
            <div className="space-y-4">
              <div className="aspect-square bg-secondary rounded-lg overflow-hidden relative">
                {generatedImage ? (
                  <img
                    src={generatedImage}
                    alt="Generated"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Generated image will appear here
                  </div>
                )}
                {isLoading && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
