const mongoose = require('mongoose');
require('dotenv').config();

const messageSchema = new mongoose.Schema({
    role: String,
    text: String,
    time: { type: String, default: () => new Date().toISOString() },
    intent: String,
    confidence: Number,
    by: { type: String, default: "System" }
});

const adminNoteSchema = new mongoose.Schema({
    note: String,
    by: String,
    time: { type: String, default: () => new Date().toISOString() }
});

const manualReplySchema = new mongoose.Schema({
    text: String,
    by: String,
    time: { type: String, default: () => new Date().toISOString() }
});

const ticketSchema = new mongoose.Schema({
    id: { type: String, unique: true }, // EMP-XXXX
    session_id: String,
    user_name: { type: String, default: "Anonymous" },
    user_email: { type: String, default: "" },
    user_phone: { type: String, default: "" },
    subject: String,
    service: String,
    intent: String,
    status: { type: String, default: 'Open' },
    priority: { type: String, default: 'Low' },
    assigned_to: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
    admin_notes: [adminNoteSchema],
    messages: [messageSchema],
    manual_replies: [manualReplySchema]
});

const handoffSchema = new mongoose.Schema({
    id: { type: String, unique: true }, // H-XXXX
    session_id: String,
    user_name: { type: String, default: "Anonymous" },
    user_email: { type: String, default: "" },
    user_phone: { type: String, default: "" },
    status: { type: String, default: 'Waiting' }, // Waiting, Active, Resolved
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
    messages: [messageSchema]
});

const Ticket = mongoose.model('Ticket', ticketSchema);
const Handoff = mongoose.model('Handoff', handoffSchema);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected for ticketManager...');
    } catch (err) {
        console.error('MongoDB Error:', err.message);
        process.exit(1);
    }
};

const ticketManager = {
    connect: connectDB,

    createTicket: async (sessionData, messages, userData = {}) => {
        const count = await Ticket.countDocuments();
        const ticketId = `EMP-${1001 + count}`;
        
        const lastMsg = messages[messages.length - 1];
        const lastIntent = lastMsg.intent || "";
        
        let service = "General";
        if (lastIntent.startsWith("AppDevelopment")) service = "App Development";
        else if (lastIntent.startsWith("WebsiteDesign")) service = "Website Design";
        else if (lastIntent.startsWith("LegalTech")) service = "Legal Tech Support";
        else if (lastIntent.startsWith("Consulting")) service = "Consulting";

        let priority = "Low";
        if (service === "Legal Tech Support") priority = "High";
        else if (["App Development", "Website Design"].includes(service)) priority = "Medium";

        // Clean up messages to include 'by' field for display
        const cleanedMessages = messages.map(m => ({
            ...m,
            by: m.role === 'user' ? (userData.name || "User") : "AI Bot"
        }));

        const newTicket = new Ticket({
            id: ticketId,
            session_id: sessionData.sessionId,
            user_name: userData.name || "Website User",
            user_email: userData.email || "",
            user_phone: userData.phone || "",
            subject: lastMsg.text.substring(0, 50) + "...",
            service: service,
            intent: lastIntent,
            status: "Open",
            priority: priority,
            messages: cleanedMessages
        });

        await newTicket.save();
        return ticketId;
    },

    createHandoffRequest: async (data) => {
        const count = await Handoff.countDocuments();
        const handoffId = `H-${1001 + count}`;
        
        const cleanedMessages = data.conversationHistory.map(m => ({
            ...m,
            by: m.role === 'user' ? (data.userData?.name || "User") : "AI Bot"
        }));

        const newHandoff = new Handoff({
            id: handoffId,
            session_id: data.sessionId,
            user_name: data.userData?.name || "Anonymous User",
            user_email: data.userData?.email || "",
            user_phone: data.userData?.phone || "",
            status: "Waiting",
            messages: cleanedMessages
        });

        await newHandoff.save();
        return newHandoff;
    },

    getHandoffStatus: async (sessionId) => {
        return await Handoff.findOne({ session_id: sessionId, status: { $ne: 'Resolved' } });
    },

    getTicketStatus: async (ticketId) => {
        return await Ticket.findOne({ id: ticketId });
    },

    getTicketStatusBySession: async (sessionId) => {
        return await Ticket.findOne({ session_id: sessionId });
    },

    updateTicketMessages: async (sessionId, message) => {
        const ticket = await Ticket.findOne({ session_id: sessionId });
        if (ticket) {
            const formattedMsg = { ...message, by: message.role === 'user' ? "User" : "AI Bot" };
            ticket.messages.push(formattedMsg);
            ticket.updated_at = new Date().toISOString();
            await ticket.save();
        }
        
        // Also update any active handoff
        const handoff = await Handoff.findOne({ session_id: sessionId, status: { $ne: 'Resolved' } });
        if (handoff) {
            const formattedMsg = { ...message, by: message.role === 'user' ? (handoff.user_name || "User") : "AI Bot" };
            handoff.messages.push(formattedMsg);
            handoff.updated_at = new Date().toISOString();
            await handoff.save();
        }
    }
};

module.exports = ticketManager;
