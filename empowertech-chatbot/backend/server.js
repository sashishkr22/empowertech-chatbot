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
    } else if (intent === 'CheckTicketStatus' || message.toUpperCase().includes('EMP-')) {
      const match = message.match(/EMP-\d{4}/i);
      if (match) {
        const ticket = await ticketManager.getTicketStatus(match[0].toUpperCase());
        if (ticket) {
          finalReply = `🔍 **Ticket Found!**\n\n**ID:** ${ticket.id}\n**Status:** ${ticket.status}\n**Priority:** ${ticket.priority}\n**Service:** ${ticket.service}`;
        } else {
          finalReply = `❌ Sorry, I couldn't find a ticket with ID **${match[0].toUpperCase()}**. Please double-check the number.`;
        }
      } else if (intent === 'CheckTicketStatus') {
        finalReply = "To check your ticket status, please type your Ticket ID (e.g., **EMP-1001**).";
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
    const { sessionId, lastSeenTime } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    let allReplies = [];

    const handoff = await ticketManager.getHandoffStatus(sessionId);
    if (handoff) {
        // Return only admin replies from the messages array
        allReplies = handoff.messages.filter(m => m.role === 'admin');
    } else {
        const ticket = await ticketManager.getTicketStatusBySession(sessionId);
        if (ticket) {
            allReplies = ticket.manual_replies;
        }
    }

    // Filter by time if lastSeenTime is provided
    if (lastSeenTime && lastSeenTime !== 'null' && lastSeenTime !== 'undefined') {
        allReplies = allReplies.filter(r => r.time > lastSeenTime);
    }

    res.json({ replies: allReplies });
});

// Single ticket status check API (for sidebar)
app.get('/api/ticket/:id', async (req, res) => {
    try {
        const ticket = await ticketManager.getTicketStatus(req.params.id.toUpperCase());
        if (ticket) {
            res.json({ success: true, ticket });
        } else {
            res.json({ success: false, message: 'Ticket not found' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Chatbot running on port ${PORT}`);
});
