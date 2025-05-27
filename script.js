document.addEventListener('DOMContentLoaded', () => {
    // Ensure this is the key that WORKS in your Chrome extension
    const OPENROUTER_API_KEY = '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';
    // Ensure this model matches the one that WORKS in your Chrome extension
    const MODEL_NAME = 'model:meta-llama/llama-3.3-8b-instruct:free'; // Or 'meta-llama/llama-3.3-8b-instruct:free' if that's what you changed it to
    const CONTEXT_FILE_PATH = 'context.txt';
    const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const initialAiMessageElement = chatBox.querySelector('.ai-message p');

    let cyberPatriotContext = "";
    let conversationHistory = [];
    let isLoadingContext = true;

    function displayMessage(sender, message, isError = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        if (isError) {
            messageElement.classList.add('error');
        }
        const pElement = document.createElement('p');
        pElement.textContent = message;
        messageElement.appendChild(pElement);
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    async function loadContext() {
        try {
            const response = await fetch(CONTEXT_FILE_PATH);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}. Failed to fetch '${CONTEXT_FILE_PATH}'. Make sure it exists in the same directory as index.html.`);
            }
            cyberPatriotContext = await response.text();
            if (initialAiMessageElement) {
                initialAiMessageElement.textContent = "Hello! I'm your CyberPatriot AI assistant. Context loaded. How can I help you today?";
            } else {
                displayMessage('ai', "Hello! I'm your CyberPatriot AI assistant. Context loaded. How can I help you today?");
            }
            conversationHistory = [];
            console.log("CyberPatriot context loaded successfully.");
        } catch (error) {
            console.error("Error loading context:", error);
            const errorMessage = `Error loading context: ${error.message}. AI functionality will be based on a default limited context.`;
            if (initialAiMessageElement) {
                initialAiMessageElement.textContent = errorMessage;
                if (initialAiMessageElement.parentElement) {
                    initialAiMessageElement.parentElement.classList.add('error');
                }
            } else {
                displayMessage('ai', errorMessage, true);
            }
            cyberPatriotContext = "CyberPatriot is a youth cyber defense competition. (Context loading failed, limited information available).";
        } finally {
            isLoadingContext = false;
            sendButton.disabled = false;
            userInput.disabled = false;
            userInput.placeholder = "Ask about CyberPatriot...";
        }
    }

    async function sendMessageToAI(userMessageText) {
        if (!userMessageText.trim()) return;

        displayMessage('user', userMessageText);
        conversationHistory.push({ role: 'user', content: userMessageText });

        userInput.value = '';
        sendButton.disabled = true;

        const oldThinkingMessage = Array.from(chatBox.querySelectorAll('.ai-message p'))
            .find(p => p.textContent === 'Thinking...');
        if (oldThinkingMessage && oldThinkingMessage.parentElement) {
            oldThinkingMessage.parentElement.remove();
        }
        displayMessage('ai', 'Thinking...');

        const systemPrompt = `You are an AI assistant specializing in CyberPatriot. Your knowledge is based on the following context. Answer questions related to CyberPatriot using only this information. If a question is outside this context, clearly state that you don't have information on it. Maintain a helpful and informative tone. Here is the CyberPatriot context:\n\n${cyberPatriotContext}`;

        const messagesPayload = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory
        ];

        console.log("GitHub Page: Sending to AI with key:", OPENROUTER_API_KEY.substring(0, 15) + "...");
        console.log("GitHub Page: Model:", MODEL_NAME);
        console.log("GitHub Page: Payload:", JSON.stringify(messagesPayload, null, 2).substring(0, 500) + "...");


        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                // mode: 'cors', // fetch defaults to 'cors' for cross-origin, but explicitly setting it doesn't hurt
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'X-Title': 'CyberPatriot AI Chat (GitHub Page)' // Added X-Title
                },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    messages: messagesPayload,
                    transforms: ["middle-out"]
                }),
            });

            const thinkingMessage = Array.from(chatBox.querySelectorAll('.ai-message p'))
                .find(p => p.textContent === 'Thinking...');
            if (thinkingMessage && thinkingMessage.parentElement) {
                thinkingMessage.parentElement.remove();
            }

            if (!response.ok) {
                let errorData;
                const responseContentType = response.headers.get("content-type");
                if (responseContentType && responseContentType.includes("application/json")) {
                    try {
                        errorData = await response.json();
                    } catch (e) {
                        errorData = { detail: await response.text() || "Unknown API error structure (non-JSON response)" };
                    }
                } else {
                     errorData = { detail: await response.text() || "Unknown API error structure (non-JSON response)" };
                }


                console.error("GitHub Page: API Error Response:", { status: response.status, statusText: response.statusText, data: errorData, headers: Object.fromEntries(response.headers.entries()) });

                let errorMessage = `API Error: ${response.status} ${response.statusText}.`;
                // Check for Clerk-specific headers in the actual failing response
                const clerkAuthMessage = response.headers.get('x-clerk-auth-message');
                if (clerkAuthMessage) {
                    errorMessage += ` Server Auth Detail: ${clerkAuthMessage}.`;
                } else if (errorData && errorData.error && errorData.error.message) {
                    errorMessage += ` Details: ${errorData.error.message}`;
                } else if (typeof errorData.detail === 'string') {
                    errorMessage += ` Details: ${errorData.detail}`;
                } else if (errorData.message) {
                    errorMessage += ` Details: ${errorData.message}`;
                } else {
                    errorMessage += ` No further details provided by API. Check browser console.`;
                }

                if (response.status === 401) {
                    errorMessage += " (Authentication failed. If Clerk error persists, this might be an origin-based issue on the server.)";
                }

                displayMessage('ai', errorMessage, true);
                return;
            }

            const data = await response.json();
            const aiResponse = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                ? data.choices[0].message.content.trim()
                : "Sorry, I couldn't get a valid response content.";

            displayMessage('ai', aiResponse);
            conversationHistory.push({ role: 'assistant', content: aiResponse });

        } catch (error) {
            console.error("GitHub Page: Error sending message to AI (Fetch/Network):", error);
            const thinkingMessage = Array.from(chatBox.querySelectorAll('.ai-message p'))
                .find(p => p.textContent === 'Thinking...');
            if (thinkingMessage && thinkingMessage.parentElement) {
                thinkingMessage.parentElement.remove();
            }
            displayMessage('ai', `Network or application error: ${error.message}. Please check your internet connection and the browser console for more details.`, true);
        } finally {
            sendButton.disabled = isLoadingContext;
        }
    }

    // Event listeners and initial setup (same as before)
    sendButton.addEventListener('click', () => { /* ... */ });
    userInput.addEventListener('keypress', (event) => { /* ... */ });
    sendButton.disabled = true;
    userInput.disabled = true;
    userInput.placeholder = "Loading context...";
    if (initialAiMessageElement) { initialAiMessageElement.textContent = "Loading context..."; }
    loadContext();
});
