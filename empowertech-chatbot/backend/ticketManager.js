const mongoose = require('mongoose');
require('dotenv').config();

// Define Ticket Schema
const messageSchema = new mongoose.Schema({
    role: String,
    text: String,
    timestamp: { type: Date, default: Date.now },
    intent: String,
    confidence: Number
});

const ticketSchema = new mongoose.Schema({
    ticketId: { type: String, unique: true },
    userName: String,
    service: String,
    priority: { type: String, default: 'Low' },
    status: { type: String, default: 'Open' },
    session_id: String,
    messages: [messageSchema],
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const Ticket = mongoose.model('Ticket', ticketSchema);

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected for Chatbot...');
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
        process.exit(1);
    }
};

const ticketManager = {
    connect: connectDB,

    createTicket: async (sessionData, messages) => {
        const count = await Ticket.countDocuments();
        const ticketId = `EMP-${1001 + count}`;
        
        // Auto-detect service from last intent
        const lastIntent = messages[messages.length - 1].intent || "";
        let service = "General";
        if (lastIntent.startsWith("AppDevelopment")) service = "App Development";
        else if (lastIntent.startsWith("WebsiteDesign")) service = "Website Design";
        else if (lastIntent.startsWith("LegalTech")) service = "Legal Tech Support";
        else if (lastIntent.startsWith("Consulting")) service = "Consulting";

        // Auto-priority
        let priority = "Low";
        if (service === "Legal Tech Support") priority = "High";
        else if (["App Development", "Website Design"].includes(service)) priority = "Medium";

        const newTicket = new Ticket({
            ticketId,
            userName: "Website User",
            service,
            priority,
            status: "Open",
            session_id: sessionData.sessionId,
            messages: messages
        });

        await newTicket.save();
        return ticketId;
    },

    getTicketStatus: async (ticketId) => {
        const ticket = await Ticket.findOne({ ticketId });
        return ticket;
    },

    updateTicketMessages: async (sessionId, message) => {
        // If ticket exists for this session, append message
        const ticket = await Ticket.findOne({ session_id: sessionId });
        if (ticket) {
            ticket.messages.push(message);
            ticket.updated_at = Date.now();
            await ticket.save();
        }
    }
};

module.exports = ticketManager;
