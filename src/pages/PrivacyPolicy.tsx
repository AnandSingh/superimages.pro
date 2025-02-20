
const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background py-16">
      <div className="container mx-auto px-4 lg:px-24">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <div className="prose prose-lg max-w-none text-muted-foreground">
          <p className="mb-6">Last updated: March 2024</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">1. Introduction</h2>
          <p className="mb-4">
            Welcome to Superb Tools Image Generation ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">2. Information We Collect</h2>
          <p className="mb-4">
            When you use our WhatsApp-based image generation service, we collect:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>WhatsApp contact information</li>
            <li>Message content related to image generation requests</li>
            <li>Generated images</li>
            <li>Usage data and interactions with our service</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">3. How We Use Your Information</h2>
          <p className="mb-4">
            We use your information to:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Provide our image generation service</li>
            <li>Improve and optimize our AI models</li>
            <li>Ensure service reliability and security</li>
            <li>Communicate with you about our service</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">4. Contact Us</h2>
          <p className="mb-4">
            If you have any questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:support@superbtools.pro" className="text-primary hover:underline">
              support@superbtools.pro
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
