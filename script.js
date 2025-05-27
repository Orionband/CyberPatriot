document.addEventListener('DOMContentLoaded', () => {
    // Ensure this is the key that WORKS in your Chrome extension
    const OPENROUTER_API_KEY = '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';
    // Ensure this model matches the one that WORKS in your Chrome extension.
    // OpenRouter usually expects identifiers like 'meta-llama/llama-3.1-8b-instruct:free' without the "model:" prefix.
    // If you still have issues, try removing "model:"
    const MODEL_NAME = 'meta-llama/llama-3.1-8b-instruct:free'; // Example: Using a known free model. Adjust if needed.
    const CONTEXT_FILE_PATH = 'context.txt';
    const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const initialAiMessageElement = chatBox.querySelector('.ai-message p');

    let cyberPatriotContext = "";
    let conversationHistory = [];
    let isLoadingContext = true;

    // --- NEW: Define max history messages to send (to prevent token limits) ---
    const MAX_HISTORY_MESSAGES_TO_SEND = 6; // Keep last 3 user/assistant turns (6 messages). Adjust as needed.

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
            conversationHistory = []; // Reset history on context load
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
        sendButton.disabled = true; // Disable while processing

        // Remove previous "Thinking..." message if any
        const oldThinkingMessage = Array.from(chatBox.querySelectorAll('.ai-message p'))
            .find(p => p.textContent === 'Thinking...');
        if (oldThinkingMessage && oldThinkingMessage.parentElement) {
            oldThinkingMessage.parentElement.remove();
        }
        displayMessage('ai', 'Thinking...');

        const systemPrompt = `You are an AI assistant specializing in CyberPatriot. Your knowledge is based on the following context. Answer questions related to CyberPatriot using only this information. If a question is outside this context, clearly state that you don't have information on it. Maintain a helpful and informative tone. Here is the CyberPatriot context:\n\n${cyberPatriotContext}`;

        // --- MODIFIED: Limit conversation history to send ---
        const recentHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES_TO_SEND);

        const messagesPayload = [
            { role: 'system', content: systemPrompt },
            ...recentHistory // Use the sliced history
        ];

        console.log("GitHub Page: Sending to AI with key:", OPENROUTER_API_KEY.substring(0, 15) + "...");
        console.log("GitHub Page: Model:", MODEL_NAME);
        let approximateTokenCount = (systemPrompt.length / 4); // Very rough estimate
        recentHistory.forEach(msg => approximateTokenCount += (msg.content.length / 4));
        console.log(`GitHub Page: Estimated prompt tokens (very rough): ${Math.round(approximateTokenCount)} (System: ${Math.round(systemPrompt.length/4)}, History: ${Math.round(recentHistory.reduce((sum, msg) => sum + msg.content.length / 4, 0))})`);


        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'X-Title': 'CyberPatriot AI Chat (GitHub Page)'
                },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    messages: messagesPayload,
                    transforms: ["middle-out"] // Keep this for OpenRouter's automatic prompt compression
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
                        // If parsing JSON fails, use the raw text
                        errorData = { error: { message: await response.text() || "Unknown API error (non-JSON response, parsing failed)" } };
                    }
                } else {
                     errorData = { error: { message: await response.text() || "Unknown API error (non-JSON response)" } };
                }

                console.error("GitHub Page: API Error Response:", { status: response.status, statusText: response.statusText, data: errorData, headers: Object.fromEntries(response.headers.entries()) });

                let errorMessage = `API Error: ${response.status} ${response.statusText}.`;
                const clerkAuthMessage = response.headers.get('x-clerk-auth-message');
                if (clerkAuthMessage) {
                    errorMessage += ` Server Auth Detail: ${clerkAuthMessage}.`;
                }

                if (errorData && errorData.error && errorData.error.message) {
                    errorMessage += ` Details: ${errorData.error.message}`;
                } else if (errorData && typeof errorData.detail === 'string') { // Some APIs use 'detail'
                    errorMessage += ` Details: ${errorData.detail}`;
                } else if (errorData && errorData.message) { // Some APIs use 'message' directly
                     errorMessage += ` Details: ${errorData.message}`;
                } else {
                    errorMessage += ` No further details provided by API. Check browser console.`;
                }

                if (response.status === 401) {
                    errorMessage += " (Authentication failed. Check API Key and model access. If Clerk error persists, this might be an origin-based issue on the server.)";
                } else if (response.status === 400 && errorData.error && errorData.error.message && errorData.error.message.includes("context length")) {
                    errorMessage += " Even with history truncation and middle-out transform, the context might be too large for this model. Consider shortening context.txt or using a model with a larger context window.";
                }
                displayMessage('ai', errorMessage, true);
                return; // Don't push API error response to history or re-enable button yet, handled in finally
            }

            const data = await response.json();
            const aiResponse = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                ? data.choices[0].message.content.trim()
                : "Sorry, I couldn't get a valid response content.";

            displayMessage('ai', aiResponse);
            conversationHistory.push({ role: 'assistant', content: aiResponse });

        } catch (error) { // Catches network errors or issues with fetch itself
            console.error("GitHub Page: Error sending message to AI (Fetch/Network):", error);
            const thinkingMessage = Array.from(chatBox.querySelectorAll('.ai-message p'))
                .find(p => p.textContent === 'Thinking...');
            if (thinkingMessage && thinkingMessage.parentElement) {
                thinkingMessage.parentElement.remove();
            }
            displayMessage('ai', `Network or application error: ${error.message}. Please check your internet connection and the browser console for more details.`, true);
        } finally {
            // Re-enable the send button ONLY if context is loaded.
            // If context is still loading (shouldn't happen if we reach here, but good check), keep it disabled.
            sendButton.disabled = isLoadingContext;
            // The user input field can always be re-enabled if not loading context
            userInput.disabled = isLoadingContext;
        }
    }

    // --- CORRECTED Event listeners ---
    sendButton.addEventListener('click', () => {
        if (!isLoadingContext && userInput.value.trim() !== "") { // Check if not loading and input has text
            sendMessageToAI(userInput.value);
        }
    });

    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            if (!isLoadingContext && userInput.value.trim() !== "") { // Check if not loading and input has text
                sendMessageToAI(userInput.value);
                event.preventDefault(); // Prevent default Enter behavior (e.g., form submission if it were in a form)
            }
        }
    });

    // Initial setup
    sendButton.disabled = true;
    userInput.disabled = true;
    userInput.placeholder = "Loading context...";
    if (initialAiMessageElement) {
        initialAiMessageElement.textContent = "Loading context...";
    }
    loadContext();
});
