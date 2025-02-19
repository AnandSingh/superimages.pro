
const WhatsAppMockup = () => {
  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-[300px] mx-auto">
      <div className="bg-[#075E54] text-white p-4">
        <h3 className="text-lg font-semibold">WhatsApp AI</h3>
      </div>
      <div className="p-4 bg-[#E5DDD5] h-[500px] space-y-4">
        <div className="flex justify-end">
          <div className="bg-[#DCF8C6] rounded-lg p-3 max-w-[80%] shadow-sm">
            <p className="text-sm">Create a cute anime cat</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-white rounded-lg p-3 max-w-[80%] shadow-sm">
            <p className="text-sm">Here's your image! 🎨</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppMockup;
