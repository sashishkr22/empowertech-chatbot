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

    // 1. Check for active handoff
    let activeHandoff = null;
    try {
        activeHandoff = await ticketManager.getHandoffStatus(sessionId);
    } catch (dbErr) {
        console.error('DB Error checking handoff:', dbErr.message);
    }

    const msgLower = message.toLowerCase().trim();
    const isExitMsg = ['bye', 'exit', 'quit', 'goodbye', 'end chat'].includes(msgLower);

    if (activeHandoff && !isExitMsg) {
        await ticketManager.updateTicketMessages(sessionId, userMsg);
        return res.json({
            reply: null,
            intent: 'HumanHandoff_Active',
            handoff: activeHandoff,
            timestamp: new Date().toISOString()
        });
    }

    // 2. Get Dialogflow Response (Skip if direct form submission)
    let botReply = "I'm processing your request...";
    let intent = req.body.intent || "Default Fallback Intent";
    let confidence = 1.0;
    
    const isFinalSubmission = ticketData && !req.body.isPartialSync;

    if (!isFinalSubmission) {
        try {
            const dfResponse = await sendMessageToDialogflow(message, sessionId);
            botReply = dfResponse?.queryResult?.fulfillmentText || botReply;
            intent = dfResponse?.queryResult?.intent?.displayName || intent;
            confidence = dfResponse?.queryResult?.intentDetectionConfidence || 0;

            if (intent === 'Default Fallback Intent') {
                botReply = getFallbackResponse(message);
            }
        } catch (dfErr) {
            console.error('Dialogflow Error:', dfErr.message);
            botReply = "I'm connected, but my AI engine is having a moment. How else can I help?";
        }
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

    // 3. Handle Special Actions (Handoff / Ticket)
    try {
        if (intent === 'HumanHandoff') {
            const handoffInfo = await ticketManager.createHandoffRequest({
                sessionId,
                conversationHistory: sessionHistory[sessionId],
                userData: ticketData
            });
            finalReply = `I have notified our support team. Your token number is **${handoffInfo.id}**. Please wait for an agent to respond.`;
            botMsg.text = finalReply;
        } 
        else if (intent === 'CreateTicket' || (ticketData && !req.body.isPartialSync)) {
            // Finalize Ticket
            ticketId = await ticketManager.createTicket({ sessionId }, sessionHistory[sessionId], ticketData || {});
            finalReply = `✅ Ticket **${ticketId}** created! Our team will contact you soon.`;
            botMsg.text = finalReply;
        } 
        else if (req.body.isPartialSync && ticketData) {
            // Just update details in real-time
            await ticketManager.createHandoffRequest({
                sessionId,
                conversationHistory: sessionHistory[sessionId],
                userData: ticketData
            });
        }
        else if (intent === 'CheckTicketStatus' || message.toUpperCase().includes('EMP-')) {
            const match = message.match(/EMP-\d{4}/i);
            if (match) {
                const ticket = await ticketManager.getTicketStatus(match[0].toUpperCase());
                if (ticket) {
                    finalReply = `🔍 **Ticket Found!**\n\n**ID:** ${ticket.id}\n**Status:** ${ticket.status}\n**Priority:** ${ticket.priority}\n**Service:** ${ticket.service}`;
                } else {
                    finalReply = `❌ Sorry, I couldn't find a ticket with ID **${match[0].toUpperCase()}**.`;
                }
            } else if (intent === 'CheckTicketStatus') {
                finalReply = "Please provide your Ticket ID (e.g., **EMP-1001**) to check the status.";
            }
            botMsg.text = finalReply;
        } else {
            // Save messages to existing records if any
            await ticketManager.updateTicketMessages(sessionId, userMsg);
            await ticketManager.updateTicketMessages(sessionId, botMsg);
        }
    } catch (actionErr) {
        console.error('Action Error (Handoff/Ticket):', actionErr.message);
        // Don't crash the whole response, just log it
    }

    res.json({
      reply: botMsg.text,
      intent,
      confidence,
      ticketId,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Global Chat error:', err);
    res.status(500).json({ 
        reply: "Something went wrong in my brain. Please try again in a few seconds.", 
        error: err.message 
    });
  }
});

// Admin updates polling
app.get('/api/chat/updates', async (req, res) => {
    try {
        const { sessionId, lastSeenTime } = req.query;
        if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

        let allReplies = [];
        const handoff = await ticketManager.getHandoffStatus(sessionId);
        
        if (handoff) {
            allReplies = handoff.messages.filter(m => m.role === 'admin');
        } else {
            const ticket = await ticketManager.getTicketStatusBySession(sessionId);
            if (ticket) allReplies = ticket.manual_replies || [];
        }

        if (lastSeenTime && lastSeenTime !== 'null' && lastSeenTime !== 'undefined') {
            allReplies = allReplies.filter(r => r.time > lastSeenTime);
        }
        res.json({ replies: allReplies });
    } catch (err) {
        res.json({ replies: [] });
    }
});

// Sidebar ticket check
app.get('/api/ticket/:id', async (req, res) => {
    try {
        const ticket = await ticketManager.getTicketStatus(req.params.id.toUpperCase());
        res.json({ success: !!ticket, ticket });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Chatbot running on port ${PORT}`);
});
