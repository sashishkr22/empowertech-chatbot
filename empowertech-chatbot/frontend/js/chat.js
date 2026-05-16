// =============================================
// chat.js - Frontend Chat Logic
// =============================================
// WHAT THIS FILE DOES:
// - Gets the user's message from the input box
// - Sends it to our backend server (server.js)
// - Displays the bot's reply in the chat
// - Manages session and ticket info

// =============================================
// GLOBAL VARIABLES
// =============================================

// Generate a unique session ID for this browser session
// This helps Dialogflow remember context within a conversation
const SESSION_ID = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

// Counter for messages and tickets
let messageCount = 0;
let ticketCount = 0;

// Backend server URL (change this when deploying)
const SERVER_URL = window.location.origin; // Automatically uses the current server

// Ticket creation state
let ticketState = {
  active: false,
  type: 'ticket', // 'ticket' or 'handoff'
  step: 0, // 1: Name, 2: Contact, 3: Issue
  data: {
    name: '',
    email: '',
    phone: '',
    issue: ''
  }
};

// Global variables for polling
let adminPollInterval = null;
let lastSeenAdminReplyTime = null;

/**
 * Periodically checks if the admin has sent a manual reply
 */
async function checkAdminReplies() {
  try {
    const url = `${SERVER_URL}/api/chat/updates?sessionId=${SESSION_ID}&lastSeenTime=${lastSeenAdminReplyTime}`;
    const response = await fetch(url);
    if (!response.ok) return;
    
    const data = await response.json();
    
    if (data.replies && data.replies.length > 0) {
      data.replies.forEach(reply => {
        // Update last seen time to the latest message's time
        if (!lastSeenAdminReplyTime || reply.time > lastSeenAdminReplyTime) {
          lastSeenAdminReplyTime = reply.time;
        }
        
        // Show with a human/executive prefix to distinguish from bot
        const adminText = `🛡️ **Support Executive (${reply.by}):**\n\n${reply.text}`;
        addMessage(adminText, 'bot');
      });
    }
  } catch (error) {
    console.error('Error polling for admin replies:', error);
  }
}

/** Starts polling for admin replies */
function startAdminPolling() {
  if (adminPollInterval) return;
  // Check every 5 seconds
  adminPollInterval = setInterval(checkAdminReplies, 5000);
  console.log('🔄 Started polling for admin replies');
}

/** Stops polling */
function stopAdminPolling() {
  if (adminPollInterval) {
    clearInterval(adminPollInterval);
    adminPollInterval = null;
  }
}

// Update DOMContentLoaded to start polling
document.addEventListener('DOMContentLoaded', () => {
  startAdminPolling();
  
  // Focus the input box when the page loads
  const inputEl = document.getElementById('userInput');
  if (inputEl) inputEl.focus();
  
  // Update character count
  updateCharCount();
});

// =============================================
// TICKET FLOW FUNCTIONS
// =============================================

/**
 * Starts the interactive ticket creation flow
 */
function startTicketFlow(type = 'ticket') {
  ticketState.active = true;
  ticketState.type = type;
  ticketState.step = 1;
  ticketState.data = { name: '', email: '', phone: '', issue: '' };
  
  const prompt = type === 'handoff' 
    ? "I'll connect you to a human agent. First, **what is your full name?**"
    : "I'll help you create a support ticket. First, **what is your full name?** (Required)";
  
  addMessage(prompt, 'bot');
  scrollToBottom();
}

/**
 * Processes each step of the ticket creation conversation
 */
async function processTicketStep(userText) {
  addMessage(userText, 'user');
  setLoading(true);

  try {
    if (ticketState.step === 1) {
      // Step 1: Name (Mandatory)
      if (userText.length < 2) {
        addMessage("Please enter a valid name to continue.", 'bot');
        setLoading(false);
        return;
      }
      ticketState.data.name = userText;
      ticketState.step = 2;
      const contactPrompt = ticketState.type === 'handoff'
        ? `Thanks, **${ticketState.data.name}**. Please provide your **mobile number** so our executive can call you if needed.`
        : `Thanks, **${ticketState.data.name}**. Now, please provide your **email and phone number** so we can contact you. (Optional - type "skip" to continue)`;
      addMessage(contactPrompt, 'bot');
    } 
    else if (ticketState.step === 2) {
      // Step 2: Contact (Optional for ticket, requested for handoff)
      if (userText.toLowerCase() !== 'skip') {
        // Simple regex-ish extraction
        const emailMatch = userText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const phoneMatch = userText.match(/(\+?\d{1,3}[- ]?)?\d{10}/);
        
        if (emailMatch) ticketState.data.email = emailMatch[0];
        if (phoneMatch) ticketState.data.phone = phoneMatch[0];

        // If handoff and no phone found via regex, just take the raw text
        if (ticketState.type === 'handoff' && !phoneMatch) {
            ticketState.data.phone = userText;
        }
      }
      
      ticketState.step = 3;
      const issuePrompt = ticketState.type === 'handoff'
        ? "Got it. Briefly describe **what you'd like to discuss** with our agent."
        : "Got it. Finally, please **describe the issue** you are having in detail.";
      addMessage(issuePrompt, 'bot');
    }
    else if (ticketState.step === 3) {
      // Step 3: Issue Description
      ticketState.data.issue = userText;
      
      // Finalize and send to backend
      await finalizeTicket();
      ticketState.active = false;
      ticketState.step = 0;
    }
  } catch (error) {
    console.error('Ticket step error:', error);
    addMessage("Something went wrong. Let's try again.", 'bot');
    ticketState.active = false;
  }

  setLoading(false);
  scrollToBottom();
}

/**
 * Sends the collected ticket data to the backend
 */
async function finalizeTicket() {
  try {
    const response = await fetch(`${SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: ticketState.data.issue, // Send description as main message
        sessionId: SESSION_ID,
        intent: ticketState.type === 'handoff' ? 'HumanHandoff' : 'CreateTicket',
        ticketData: ticketState.data // Pass name, email, phone separately
      })
    });

    const data = await response.json();
    
    if (ticketState.type === 'handoff') {
        addMessage("### ⏳ Connecting to Agent...\n\nI have notified our support team. **Please wait for a human customer care executive to connect and respond.** They will see your request on a priority basis.", 'bot');
    } else {
        addMessage(data.reply, 'bot', data.ticket);
    }

    if (data.ticket) {
      ticketCount++;
      document.getElementById('ticketCount').textContent = ticketCount;
      showTicketInSidebar(data.ticket);
    }
  } catch (error) {
    addMessage("Error creating ticket. Please try again.", 'bot');
  }
}

// =============================================
// SEND MESSAGE FUNCTION
// =============================================

/**
 * Main function: takes user's text, sends to server, shows reply
 * This runs when user clicks "Send" or presses Enter
 */
async function sendMessage() {
  // Get the input element and the user's text
  const inputElement = document.getElementById('userInput');
  const userText = inputElement.value.trim();
  
  // Don't send if message is empty
  if (!userText) return;
  
  // Clear the input box
  inputElement.value = '';
  updateCharCount();
  
  // Intercept if in ticket flow
  if (ticketState.active) {
    await processTicketStep(userText);
    return;
  }
  
  // Show the user's message in the chat
  addMessage(userText, 'user');
  
  // Update message counter
  messageCount++;
  document.getElementById('messageCount').textContent = messageCount;
  
  // Disable send button and show typing indicator
  setLoading(true);
  
  try {
    // ---- SEND TO BACKEND SERVER ----
    const response = await fetch(`${SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: userText,
        sessionId: SESSION_ID
      })
    });
    // ... rest of sendMessage ...
    
    // Check if request was successful
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    // Parse the JSON response from server
    const data = await response.json();

    // ---- SPECIAL INTENT HANDLING ----
    if (data.intent === 'HumanHandoff') {
        startTicketFlow('handoff');
        setLoading(false);
        return;
    }
    
    // Show the bot's reply in the chat
    addMessage(data.reply, 'bot', data.ticket);
    
    // If a ticket was created, show it in the sidebar
    if (data.ticket) {
      ticketCount++;
      document.getElementById('ticketCount').textContent = ticketCount;
      showTicketInSidebar(data.ticket);
    }
    
    // Show confidence score in console (for learning)
    if (data.confidence) {
      console.log(`🎯 Intent: ${data.intent} (${(data.confidence * 100).toFixed(1)}% confident)`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Show error message to user
    addMessage(
      "⚠️ I'm having trouble connecting to the server right now. Please check your internet connection or try again in a moment.",
      'bot'
    );
  }
  
  // Re-enable input and hide typing indicator
  setLoading(false);
  inputElement.focus();
}

// =============================================
// ADD MESSAGE TO CHAT
// =============================================

/**
 * Creates and adds a message bubble to the chat
 * 
 * @param {string} text - The message text
 * @param {string} type - 'user' or 'bot'
 * @param {object} ticket - Optional ticket info (if ticket was created)
 */
function addMessage(text, type, ticket = null) {
  const container = document.getElementById('messagesContainer');
  
  // Create message wrapper div
  const messageDiv = document.createElement('div');
  messageDiv.className = `msg-wrapper ${type}-msg`;
  
  // Choose avatar emoji
  const avatarEmoji = type === 'bot' ? '🤖' : '👤';
  
  // Build the message HTML
  messageDiv.innerHTML = `
    <div class="msg-avatar">${avatarEmoji}</div>
    <div class="msg-bubble">
      ${formatMessage(text)}
      ${ticket ? createTicketCard(ticket) : ''}
      <span class="msg-time">${getCurrentTime()}</span>
    </div>
  `;
  
  // Add message to chat
  container.appendChild(messageDiv);
  
  // Scroll to the bottom so user sees the new message
  scrollToBottom();
}

// =============================================
// FORMAT MESSAGE TEXT
// =============================================

/**
 * Converts plain text to formatted HTML
 * Handles new lines and basic formatting
 */
function formatMessage(text) {
  if (!text) return '';
  // Replace newlines with <br> tags
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');  // **bold** → <strong>
}

// =============================================
// CREATE TICKET CARD
// =============================================

/**
 * Creates a visual ticket card to show in chat when ticket is created
 */
function createTicketCard(ticket) {
  return `
    <div class="ticket-created-card" style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px; margin-top: 10px;">
      <p style="font-size: 12px; color: #166534; margin-bottom: 4px;">✅ <strong>Support Ticket Created!</strong></p>
      <p style="font-weight: 700; font-size: 16px; color: #15803d;">#${ticket.id}</p>
      <p style="font-size: 11px; margin-top: 4px;">Status: <strong>${ticket.status}</strong></p>
      <p style="font-size: 11px;">Team: ${ticket.assigned_to || 'Pending'}</p>
    </div>
  `;
}

// =============================================
// CHECK TICKET STATUS
// =============================================

/**
 * Called when user clicks "Check" in the sidebar ticket checker
 */
async function checkTicketStatus() {
  const ticketInput = document.getElementById('ticketInput').value.trim();
  
  if (!ticketInput) {
    alert('Please enter a ticket ID (e.g., EMP-1001)');
    return;
  }
  
  try {
    const response = await fetch(`${SERVER_URL}/api/ticket/${ticketInput}`);
    const data = await response.json();
    
    if (data.success) {
      const ticket = data.ticket;
      const statusMessage = `**Ticket Status for ${ticket.id}:**\n\n` +
        `📋 Status: ${ticket.status}\n` +
        `🔥 Priority: ${ticket.priority}\n` +
        `🏷️ Service: ${ticket.service}\n` +
        `👥 Assigned To: ${ticket.assigned_to || 'Pending'}\n` +
        `📅 Created: ${new Date(ticket.created_at).toLocaleString('en-IN')}`;
      
      addMessage(statusMessage, 'bot');
    } else {
      addMessage(`❌ No ticket found with ID "${ticketInput}". Please check the ticket number and try again.`, 'bot');
    }
    
  } catch (error) {
    addMessage(`Sorry, I couldn't check the ticket status right now. Please try again.`, 'bot');
  }
  
  // Clear the input and hide if toggle
  document.getElementById('ticketInput').value = '';
}

// =============================================
// QUICK MESSAGE (from sidebar buttons)
// =============================================

/**
 * Sends a pre-written message when user clicks a quick action button
 */
function sendQuickMessage(message) {
  const inputEl = document.getElementById('userInput');
  inputEl.value = message;
  // Trigger auto-resize if it exists
  if (typeof autoResize === 'function') autoResize(inputEl);
  sendMessage();
}

// =============================================
// CLEAR CHAT
// =============================================

/**
 * Clears all messages and resets the chat
 */
function clearChat() {
  if (!confirm('Are you sure you want to clear the chat history?')) return;
  
  const container = document.getElementById('messagesContainer');
  
  // Remove all messages except the welcome message
  while (container.children.length > 1) {
    container.removeChild(container.lastChild);
  }
  
  // Reset counters
  messageCount = 0;
  ticketCount = 0;
  document.getElementById('messageCount').textContent = '0';
  document.getElementById('ticketCount').textContent = '0';
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/** Shows/hides the typing indicator and enables/disables the send button */
function setLoading(isLoading) {
  const typingIndicator = document.getElementById('typingIndicator');
  const sendBtn = document.getElementById('sendBtn');
  const inputEl = document.getElementById('userInput');
  
  if (isLoading) {
    typingIndicator.style.display = 'flex';
    sendBtn.disabled = true;
    inputEl.disabled = true;
  } else {
    typingIndicator.style.display = 'none';
    sendBtn.disabled = false;
    inputEl.disabled = false;
  }
}

/**
 * Shows the latest created ticket in the action hub
 */
function showTicketInSidebar(ticket) {
  const hub = document.getElementById('latestTicketHub');
  const card = document.getElementById('latestTicketCard');
  
  card.innerHTML = `
    <p class="ticket-id">${ticket.id}</p>
    <p>Status: <strong>${ticket.status}</strong></p>
    <p>Assigned: ${ticket.assigned_to || 'Pending'}</p>
    <p style="font-size: 10px; color: #166534; margin-top: 8px;">Keep this ID to track progress.</p>
  `;
  
  hub.style.display = 'block';
}

/** Scrolls the chat to the bottom */
function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  container.scrollTop = container.scrollHeight;
}

/** Returns current time as "HH:MM AM/PM" */
function getCurrentTime() {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/** Updates the character counter below the input */
function updateCharCount() {
  const input = document.getElementById('userInput');
  document.getElementById('charCount').textContent = `${input.value.length}/500`;
}

/** Handles keyboard shortcuts */
function handleKeyPress(event) {
  // Enter key sends message (unless Shift is held for new line)
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}
