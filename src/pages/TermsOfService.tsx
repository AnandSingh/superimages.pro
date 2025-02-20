
const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background py-16">
      <div className="container mx-auto px-4 lg:px-24">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <div className="prose prose-lg max-w-none text-muted-foreground">
          <p className="mb-6">Last updated: March 2024</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">1. Acceptance of Terms</h2>
          <p className="mb-4">
            By accessing or using the Superb Tools Image Generation service through WhatsApp, you agree to be bound by these Terms of Service.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">2. Service Description</h2>
          <p className="mb-4">
            We provide an AI-powered image generation service accessible through WhatsApp. Users can create custom images by sending text descriptions.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">3. User Responsibilities</h2>
          <ul className="list-disc pl-6 mb-4">
            <li>You must provide appropriate and legal image generation prompts</li>
            <li>You are responsible for maintaining the confidentiality of your account</li>
            <li>You agree not to use the service for any illegal or unauthorized purpose</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">4. Intellectual Property</h2>
          <p className="mb-4">
            You retain rights to the images you generate, subject to our license to use them for service improvement.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">5. Contact</h2>
          <p className="mb-4">
            For any questions about these Terms, please contact us at{" "}
            <a href="mailto:support@superbtools.pro" className="text-primary hover:underline">
              support@superbtools.pro
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
