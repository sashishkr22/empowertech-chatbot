const mongoose = require('mongoose');
require('dotenv').config();

const messageSchema = new mongoose.Schema({
    role: String,
    text: String,
    time: { type: String, default: () => new Date().toISOString() },
    intent: String,
    confidence: Number
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

const Ticket = mongoose.model('Ticket', ticketSchema);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error('MongoDB Error:', err.message);
        process.exit(1);
    }
};

const ticketManager = {
    connect: connectDB,

    createTicket: async (sessionData, messages) => {
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

        const newTicket = new Ticket({
            id: ticketId,
            session_id: sessionData.sessionId,
            user_name: sessionData.userName || "Website User",
            user_email: sessionData.userEmail || "",
            subject: lastMsg.text.substring(0, 50) + "...",
            service: service,
            intent: lastIntent,
            status: "Open",
            priority: priority,
            messages: messages
        });

        await newTicket.save();
        return ticketId;
    },

    getTicketStatus: async (ticketId) => {
        return await Ticket.findOne({ id: ticketId });
    },

    updateTicketMessages: async (sessionId, message) => {
        const ticket = await Ticket.findOne({ session_id: sessionId });
        if (ticket) {
            ticket.messages.push(message);
            ticket.updated_at = new Date().toISOString();
            await ticket.save();
        }
    }
};

module.exports = ticketManager;
