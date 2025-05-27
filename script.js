document.addEventListener('DOMContentLoaded', () => {
    const OPENROUTER_API_KEY = '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'; // YOUR PROVIDED KEY
    const MODEL_NAME = 'meta-llama/llama-3.3-8b-instruct:free';
    const CONTEXT_FILE_PATH = 'context.txt';
    const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const initialAiMessage = chatBox.querySelector('.ai-message p'); // Get the initial AI message element

    let cyberPatriotContext = "";
    let conversationHistory = []; // Stores messages like { role: 'user'/'assistant', content: '...' }
    let isLoadingContext = true;

    // Function to display messages in the chat box
    function displayMessage(sender, message, isError = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        if (isError) {
            messageElement.classList.add('error');
        }
        
        const pElement = document.createElement('p');
        pElement.textContent = message; // Using textContent to prevent XSS
        messageElement.appendChild(pElement);
        
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to bottom
    }

    // Function to load CyberPatriot context from context.txt
    async function loadContext() {
        try {
            const response = await fetch(CONTEXT_FILE_PATH);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}. Make sure 'context.txt' exists in the same directory.`);
            }
            cyberPatriotContext = await response.text();
            if (initialAiMessage) {
                 initialAiMessage.textContent = "Hello! I'm your CyberPatriot AI assistant. Context loaded. How can I help you today?";
            } else { // Fallback if the initial message element wasn't found (should not happen with current HTML)
                displayMessage('ai', "Hello! I'm your CyberPatriot AI assistant. Context loaded. How can I help you today?");
            }
            conversationHistory = []; // Reset history if context reloaded (though typically loads once)
            console.log("CyberPatriot context loaded successfully.");
        } catch (error) {
            console.error("Error loading context:", error);
            if (initialAiMessage) {
                initialAiMessage.textContent = `Error loading context: ${error.message}. Please ensure 'context.txt' is present and readable.`;
                initialAiMessage.parentElement.classList.add('error');
            } else {
                displayMessage('ai', `Error loading context: ${error.message}. AI functionality will be limited.`, true);
            }
            cyberPatriotContext = "No context available due to loading error."; // Provide fallback context
        } finally {
            isLoadingContext = false;
            sendButton.disabled = false;
            userInput.disabled = false;
            userInput.placeholder = "Ask about CyberPatriot...";
        }
    }

    // Function to send message to OpenRouter AI
    async function sendMessageToAI(userMessageText) {
        if (!userMessageText.trim()) return;

        displayMessage('user', userMessageText);
        conversationHistory.push({ role: 'user', content: userMessageText });
        
        userInput.value = ''; // Clear input field
        sendButton.disabled = true; // Disable send button while waiting for AI
        displayMessage('ai', 'Thinking...'); // Typing indicator

        const systemPrompt = `You are an AI assistant specializing in CyberPatriot. Your knowledge is based on the following context. Answer questions related to CyberPatriot using only this information. If a question is outside this context, clearly state that you don't have information on it. Maintain a helpful and informative tone. Here is the CyberPatriot context:\n\n${cyberPatriotContext}`;

        const messagesPayload = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory
        ];

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    messages: messagesPayload,
                }),
            });
            
            // Remove "Thinking..." message
            const thinkingMessage = Array.from(chatBox.querySelectorAll('.ai-message p'))
                                   .find(p => p.textContent === 'Thinking...');
            if (thinkingMessage) {
                thinkingMessage.parentElement.remove();
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "Unknown API error" }));
                console.error("API Error:", errorData);
                let errorMessage = `API Error: ${response.status} ${response.statusText}.`;
                if (errorData && errorData.error && errorData.error.message) {
                    errorMessage += ` Details: ${errorData.error.message}`;
                } else if (typeof errorData.detail === 'string') {
                    errorMessage += ` Details: ${errorData.detail}`;
                } else if (errorData.detail && errorData.detail[0] && errorData.detail[0].msg) {
                     errorMessage += ` Details: ${errorData.detail[0].msg}`;
                }
                displayMessage('ai', errorMessage, true);
                conversationHistory.push({ role: 'assistant', content: errorMessage }); // Add error to history to see context
                return;
            }

            const data = await response.json();
            const aiResponse = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                ? data.choices[0].message.content.trim()
                : "Sorry, I couldn't get a valid response.";

            displayMessage('ai', aiResponse);
            conversationHistory.push({ role: 'assistant', content: aiResponse });

        } catch (error) {
            console.error("Error sending message to AI:", error);
            // Remove "Thinking..." message if it's still there after an error
            const thinkingMessage = Array.from(chatBox.querySelectorAll('.ai-message p'))
                                   .find(p => p.textContent === 'Thinking...');
            if (thinkingMessage) {
                thinkingMessage.parentElement.remove();
            }
            displayMessage('ai', `Network or application error: ${error.message}. Please try again.`, true);
            // Optionally add this error to history as well, or decide how to handle it.
        } finally {
            sendButton.disabled = isLoadingContext; // Re-enable based on context loading state
        }
    }

    // Event listeners
    sendButton.addEventListener('click', () => {
        if (!isLoadingContext) {
            sendMessageToAI(userInput.value);
        } else {
            displayMessage('ai', "Please wait, context is still loading.", true);
        }
    });

    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            if (!isLoadingContext) {
                sendMessageToAI(userInput.value);
            } else {
                displayMessage('ai', "Please wait, context is still loading.", true);
            }
        }
    });

    // Initial setup
    sendButton.disabled = true;
    userInput.disabled = true;
    userInput.placeholder = "Loading context...";
    loadContext(); // Start loading the context
});
