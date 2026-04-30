const sendTwilioMessage = (role, message) => {
  // MOCK IMPLEMENTATION: In production, use the Twilio npm package
  // to send an SMS or WhatsApp to the mapped role's phone number.
  console.log(`\n========================================`);
  console.log(`[TWILIO SMS/WHATSAPP MOCK] -> ${role}`);
  console.log(`Message: ${message}`);
  console.log(`========================================\n`);
};

module.exports = { sendTwilioMessage };
