
import { motion } from "framer-motion";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center max-w-2xl mx-auto"
      >
        <span className="inline-block px-3 py-1 text-sm font-medium bg-secondary text-secondary-foreground rounded-full mb-6 animate-fadeIn">
          Welcome
        </span>
        <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-foreground mb-6 animate-fadeIn" style={{ animationDelay: "0.2s" }}>
          Start Building Something Beautiful
        </h1>
        <p className="text-lg text-muted-foreground mb-8 animate-fadeIn" style={{ animationDelay: "0.3s" }}>
          This is your blank canvas. Create something extraordinary.
        </p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <button className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-primary-foreground transition-colors bg-primary rounded-full hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            Get Started
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Index;
