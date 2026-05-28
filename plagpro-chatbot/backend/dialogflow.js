const dialogflow = require('@google-cloud/dialogflow');
const path = require('path');

const PROJECT_ID = process.env.DIALOGFLOW_PROJECT_ID;

let sessionClient;

try {
  // If we have a raw JSON string (for Render/Cloud), parse it
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    sessionClient = new dialogflow.SessionsClient({ credentials });
    console.log('✅ Dialogflow connected via Cloud Env Variables!');
  } else {
    // Fallback to local file for development
    const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccount.json');
    sessionClient = new dialogflow.SessionsClient({
      keyFilename: SERVICE_ACCOUNT_PATH,
    });
    console.log('✅ Dialogflow connected via local serviceAccount.json!');
  }
} catch (error) {
  console.error('❌ Could not connect to Dialogflow:', error.message);
}

async function sendMessageToDialogflow(userMessage, sessionId) {
  const sessionPath = sessionClient.projectAgentSessionPath(PROJECT_ID, sessionId);

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: userMessage,
        languageCode: 'en',
      },
    },
  };

  try {
    const responses = await sessionClient.detectIntent(request);
    return responses[0];
  } catch (error) {
    console.error('❌ Dialogflow API Error:', error.message);
    throw error;
  }
}

function getFallbackResponse(userMessage) {
  const msg = userMessage.toLowerCase().trim();
  if (msg === 'bye' || msg === 'exit') return "Goodbye! Have a great day!";
  return "I'm here to help with your PlagPro academic integrity questions, plagiarism checking, and AI detection. How can I assist you?";
}

module.exports = {
  sendMessageToDialogflow,
  getFallbackResponse
};
