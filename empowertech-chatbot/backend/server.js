require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const ticketManager = require('./ticketManager');
const { sendMessageToDialogflow, getFallbackResponse } = require('./dialogflow');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Connect to MongoDB
ticketManager.connect();

const sessionHistory = {};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, ticketData } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Empty message' });

    if (!sessionHistory[sessionId]) sessionHistory[sessionId] = [];

    const userMsg = {
      role:  'user',
      text:  message,
      time:  new Date().toISOString(),
      intent: null,
      confidence: null
    };

    // Check for active handoff
    const activeHandoff = await ticketManager.getHandoffStatus(sessionId);
    const msgLower = message.toLowerCase().trim();
    const isExitMsg = ['bye', 'exit', 'quit', 'goodbye', 'end chat'].includes(msgLower);

    if (activeHandoff && !isExitMsg) {
        console.log(`🤫 [${sessionId}] Handoff is active. Bot staying silent.`);
        await ticketManager.updateTicketMessages(sessionId, userMsg);
        return res.json({
            reply: null,
            intent: 'HumanHandoff_Active',
            handoff: activeHandoff,
            timestamp: new Date().toISOString()
        });
    }

    const dfResponse  = await sendMessageToDialogflow(message, sessionId);
    let botReply    = dfResponse.queryResult.fulfillmentText;
    let intent      = dfResponse.queryResult.intent.displayName;
    let confidence  = dfResponse.queryResult.intentDetectionConfidence;

    if (intent === 'Default Fallback Intent') {
      botReply = getFallbackResponse(message);
    }

    userMsg.intent = intent;
    userMsg.confidence = confidence;

    const botMsg = {
      role: 'bot',
      text: botReply,
      time: new Date().toISOString()
    };

    sessionHistory[sessionId].push(userMsg, botMsg);

    let ticketId = null;
    let finalReply = botReply;

    if (intent === 'HumanHandoff') {
        const handoffInfo = await ticketManager.createHandoffRequest({
            sessionId,
            conversationHistory: sessionHistory[sessionId],
            userData: ticketData
        });
        finalReply = `I have notified our support team. Your token number is **${handoffInfo.id}**. Please wait for an agent to respond.`;
        botMsg.text = finalReply;
    } else if (intent === 'CreateTicket' || ticketData) {
      ticketId = await ticketManager.createTicket({ sessionId }, sessionHistory[sessionId], ticketData);
      if (ticketData) {
        finalReply = `✅ Ticket ${ticketId} created! We will contact you at ${ticketData.email || ticketData.phone}.`;
      }
      botMsg.text = finalReply;
    } else if (intent === 'CheckTicketStatus') {
      const match = message.match(/EMP-\d{4}/i);
      if (match) {
        const ticket = await ticketManager.getTicketStatus(match[0].toUpperCase());
        if (ticket) {
          finalReply = `🔍 **Ticket ${ticket.id}**: Status is **${ticket.status}**.`;
        } else {
          finalReply = `❌ Ticket ${match[0]} not found.`;
        }
      }
      botMsg.text = finalReply;
    } else {
      // Sync regular conversation to existing ticket/handoff if it exists
      await ticketManager.updateTicketMessages(sessionId, userMsg);
      await ticketManager.updateTicketMessages(sessionId, botMsg);
    }

    res.json({
      reply: finalReply,
      intent,
      confidence,
      ticketId,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ reply: "Service temporarily unavailable.", error: true });
  }
});

// Admin reply check polling (for frontend chat)
app.get('/api/chat/updates', async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    const handoff = await ticketManager.getHandoffStatus(sessionId);
    if (handoff) {
        // Return only admin replies from the messages array
        const adminReplies = handoff.messages.filter(m => m.role === 'admin');
        return res.json({ replies: adminReplies });
    }

    const ticket = await ticketManager.getTicketStatusBySession(sessionId);
    if (ticket) {
        return res.json({ replies: ticket.manual_replies });
    }

    res.json({ replies: [] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Chatbot running on port ${PORT}`);
});
