document.addEventListener('DOMContentLoaded', () => {
    // IMPORTANT: Ensure this key is EXACTLY as provided and has no leading/trailing spaces.
    // This key is publicly visible in client-side code.
    const OPENROUTER_API_KEY = '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';
    const MODEL_NAME = 'meta-llama/llama-3.3-8b-instruct:free';
    const CONTEXT_FILE_PATH = 'context.txt'; // Assumes context.txt is in the same directory as index.html
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
        
        // Remove previous "Thinking..." message if any, then add new one
        const oldThinkingMessage = Array.from(chatBox.querySelectorAll('.ai-message p'))
                               .find(p => p.textContent === 'Thinking...');
        if (oldThinkingMessage && oldThinkingMessage.parentElement) {
            oldThinkingMessage.parentElement.remove();
        }
        displayMessage('ai', 'Thinking...');

        const systemPrompt = `You are an AI assistant specializing in CyberPatriot. Your knowledge is based on the following context. Answer questions related to CyberPatriot using only this information. If a question is outside this context, clearly state that you don't have information on it. Maintain a helpful and informative tone. Here is the CyberPatriot context:\n\n${cyberPatriotContext}`;

        const messagesPayload = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory // Includes the latest user message
        ];
        
        // Log the key being used (for debugging only, remove in production if key wasn't meant to be public)
        console.log("Using API Key (first 10 chars):", OPENROUTER_API_KEY.substring(0, 10) + "...");
        console.log("Sending payload to OpenRouter:", JSON.stringify(messagesPayload, null, 2));


        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    // 'HTTP-Referer': 'your-site-url.com', // Optional: OpenRouter recommends this
                    // 'X-Title': 'CyberPatriot Chat App', // Optional: OpenRouter recommends this
                },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    messages: messagesPayload,
                }),
            });
            
            const thinkingMessage = Array.from(chatBox.querySelectorAll('.ai-message p'))
                                   .find(p => p.textContent === 'Thinking...');
            if (thinkingMessage && thinkingMessage.parentElement) {
                thinkingMessage.parentElement.remove();
            }

            if (!response.ok) {
                // Try to parse error response as JSON, otherwise use text
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { detail: await response.text() || "Unknown API error structure" };
                }

                console.error("API Error Response:", { status: response.status, statusText: response.statusText, data: errorData });
                
                let errorMessage = `API Error: ${response.status} ${response.statusText}.`;
                if (errorData && errorData.error && errorData.error.message) {
                    errorMessage += ` Details: ${errorData.error.message}`;
                } else if (typeof errorData.detail === 'string') {
                    errorMessage += ` Details: ${errorData.detail}`;
                } else if (errorData.detail && Array.isArray(errorData.detail) && errorData.detail[0] && errorData.detail[0].msg) {
                     errorMessage += ` Details: ${errorData.detail[0].msg}`;
                } else if (errorData.message) { // Another possible error format
                    errorMessage += ` Details: ${errorData.message}`;
                } else {
                    errorMessage += ` No further details provided by API. Check browser console.`;
                }
                
                // Specifically for 401, suggest checking the key
                if (response.status === 401) {
                    errorMessage += " (Please double-check your API key and ensure it's active and correctly entered in script.js)";
                }

                displayMessage('ai', errorMessage, true);
                // Do not add API errors to conversation history as AI responses for context
                // conversationHistory.push({ role: 'assistant', content: errorMessage });
                return;
            }

            const data = await response.json();
            const aiResponse = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                ? data.choices[0].message.content.trim()
                : "Sorry, I couldn't get a valid response content.";

            displayMessage('ai', aiResponse);
            conversationHistory.push({ role: 'assistant', content: aiResponse });

        } catch (error) {
            console.error("Error sending message to AI (Fetch/Network):", error);
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

    sendButton.addEventListener('click', () => {
        if (!isLoadingContext && !userInput.disabled) {
            sendMessageToAI(userInput.value);
        } else if (isLoadingContext) {
            displayMessage('ai', "Please wait, context is still loading.", true);
        }
    });

    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            if (!isLoadingContext && !userInput.disabled) {
                sendMessageToAI(userInput.value);
            } else if (isLoadingContext) {
                displayMessage('ai', "Please wait, context is still loading.", true);
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
