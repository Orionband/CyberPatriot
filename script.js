// Wait for the entire HTML document to be fully loaded and parsed.
document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION CONSTANTS ---

    /**
     * @constant {string} OPENROUTER_API_KEY
     * The API key for accessing the OpenRouter service.
     */
    const OPENROUTER_API_KEY = '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'; 

    /**
     * @constant {string} MODEL_NAME
     * The identifier for the specific language model to be used via OpenRouter.
     * 'meta-llama/llama-3.1-8b-instruct:free' specifies a free tier Llama 3.1 model.
     */
    const MODEL_NAME = 'mistralai/mistral-7b-instruct:free';


    /**
     * @constant {string} CONTEXT_FILE_PATH
     * The relative path to the text file containing the CyberPatriot context.
     * This file's content will be used to prime the AI.
     */
    const CONTEXT_FILE_PATH = 'context.txt';

    /**
     * @constant {string} OPENROUTER_API_URL
     * The endpoint URL for OpenRouter's chat completions API.
     */
    const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

    // --- DOM ELEMENT REFERENCES ---

    /** @type {HTMLElement} The div element where chat messages will be displayed. */
    const chatBox = document.getElementById('chat-box');
    /** @type {HTMLInputElement} The input field where the user types their messages. */
    const userInput = document.getElementById('user-input');
    /** @type {HTMLButtonElement} The button used to send the user's message. */
    const sendButton = document.getElementById('send-button');
    /** @type {HTMLElement | null} The paragraph element of the initial AI message, used to update its text. */
    const initialAiMessageElement = chatBox.querySelector('.ai-message p');

    // --- STATE VARIABLES ---

    /** @type {string} Stores the content loaded from the CONTEXT_FILE_PATH. */
    let cyberPatriotContext = "";
    /** @type {Array<{role: string, content: string}>} An array to keep track of the conversation history (user and AI messages). */
    let conversationHistory = [];
    /** @type {boolean} A flag to indicate if the context file is currently being loaded. */
    let isLoadingContext = true;

    /**
     * @constant {number} MAX_HISTORY_MESSAGES_TO_SEND
     * The maximum number of recent messages (user and AI) to send to the API with each request.
     * This helps manage token limits and keep the conversation focused.
     */
    const MAX_HISTORY_MESSAGES_TO_SEND = 12; // Includes user and assistant messages

    // --- CORE FUNCTIONS ---

    /**
     * Appends a new message to the chat box UI.
     * @param {('user' | 'ai')} sender - The sender of the message ('user' or 'ai').
     * @param {string} message - The content of the message.
     * @param {boolean} [isError=false] - Optional. If true, styles the message as an error.
     */
    function displayMessage(sender, message, isError = false) {
        // Create the main message container div
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`); // Basic class and sender-specific class

        // Add error class if applicable
        if (isError) {
            messageElement.classList.add('error');
        }

        // Create a paragraph element for the message text
        const pElement = document.createElement('p');
        pElement.textContent = message;
        messageElement.appendChild(pElement);

        // Add the new message to the chat box
        chatBox.appendChild(messageElement);
        // Scroll the chat box to the bottom to show the latest message
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    /**
     * Asynchronously loads the CyberPatriot context from the specified file.
     * Updates the UI based on loading status and success/failure.
     */
    async function loadContext() {
        try {
            // Fetch the context file
            const response = await fetch(CONTEXT_FILE_PATH);
            // Check if the fetch was successful
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}. Failed to fetch '${CONTEXT_FILE_PATH}'. Make sure it exists in the same directory as index.html.`);
            }
            // Read the response text as the context
            cyberPatriotContext = await response.text();

            // Update the initial AI message to indicate context is loaded
            if (initialAiMessageElement) {
                initialAiMessageElement.textContent = "Hello! I'm your CyberPatriot AI assistant. Context loaded. How can I help you today?";
            } else {
                // Fallback if the initial element wasn't found (should not happen in normal flow)
                displayMessage('ai', "Hello! I'm your CyberPatriot AI assistant. Context loaded. How can I help you today?");
            }
            // Reset conversation history as new context is loaded
            conversationHistory = [];
            console.log("CyberPatriot context loaded successfully.");
        } catch (error) {
            // Log the error to the console
            console.error("Error loading context:", error);
            // Prepare an error message for the UI
            const errorMessage = `Error loading context: ${error.message}. AI functionality will be based on a default limited context.`;
            // Display the error message in the initial AI message bubble
            if (initialAiMessageElement) {
                initialAiMessageElement.textContent = errorMessage;
                // Add error styling to the message bubble
                if (initialAiMessageElement.parentElement) {
                    initialAiMessageElement.parentElement.classList.add('error');
                }
            } else {
                displayMessage('ai', errorMessage, true);
            }
            // Provide a very basic fallback context if loading fails
            cyberPatriotContext = "CyberPatriot is a youth cyber defense competition. (Context loading failed, limited information available).";
        } finally {
            // Regardless of success or failure, context loading is complete
            isLoadingContext = false;
            // Enable the send button and user input field
            sendButton.disabled = false;
            userInput.disabled = false;
            // Update placeholder text
            userInput.placeholder = "Ask about CyberPatriot...";
        }
    }

    /**
     * Sends the user's message to the OpenRouter AI API and displays the response.
     * @param {string} userMessageText - The text of the message entered by the user.
     */
    async function sendMessageToAI(userMessageText) {
        // Do nothing if the message is empty or only whitespace
        if (!userMessageText.trim()) return;

        // Display the user's message in the chat box
        displayMessage('user', userMessageText);
        // Add the user's message to the conversation history
        conversationHistory.push({ role: 'user', content: userMessageText });

        // Clear the input field
        userInput.value = '';
        // Disable the send button while waiting for the AI's response
        sendButton.disabled = true;

        // Remove any previous "Thinking..." message to avoid duplicates
        const oldThinkingMessage = Array.from(chatBox.querySelectorAll('.ai-message p'))
            .find(p => p.textContent === 'Thinking...');
        if (oldThinkingMessage && oldThinkingMessage.parentElement) {
            oldThinkingMessage.parentElement.remove();
        }
        // Display a "Thinking..." message to indicate processing
        displayMessage('ai', 'Thinking...');

        // Construct the system prompt to guide the AI's behavior
        const systemPrompt = `You are an AI assistant specializing in CyberPatriot. Your knowledge is based on the following context. Answer questions related to CyberPatriot using ONLY this information, DO NOT USE ANY OTHER INFORMATION BESIDE THE CONTEXT. Maintain a helpful and informative tone. Please be as consise as possible and give short responces(at most 12 sentences unless stated otherwise. usually 4-8 sentences). If their question is a yes or no question, be sure to answer yes or no. If the question is outside of your scope, just say so. Here is the CyberPatriot context:\n\n${cyberPatriotContext}`;

        // Get the most recent part of the conversation history to send to the API
        const recentHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES_TO_SEND);

        // Prepare the payload for the API request
        const messagesPayload = [
            { role: 'system', content: systemPrompt }, // System prompt first
            ...recentHistory // Then the recent conversation messages
        ];

        // Logging for debugging purposes (can be removed in production)
        console.log("GitHub Page: Sending to AI with key:", OPENROUTER_API_KEY.substring(0, 15) + "..."); // Log a snippet of the API key
        console.log("GitHub Page: Model:", MODEL_NAME);
        // Rough estimation of token count for the prompt
        let approximateTokenCount = (systemPrompt.length / 4); // Assume 1 token ~ 4 chars
        recentHistory.forEach(msg => approximateTokenCount += (msg.content.length / 4));
        console.log(`GitHub Page: Estimated prompt tokens (very rough): ${Math.round(approximateTokenCount)} (System: ${Math.round(systemPrompt.length/4)}, History: ${Math.round(recentHistory.reduce((sum, msg) => sum + msg.content.length / 4, 0))})`);

        try {
            // Make the API call to OpenRouter
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'X-Title': 'CyberPatriot AI Chat (GitHub Page)' // Custom header for OpenRouter analytics
                },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    messages: messagesPayload,
                    transforms: ["middle-out"] // An OpenRouter transform to help manage context length
                }),
            });

            // Find and remove the "Thinking..." message now that a response (or error) is imminent
            const thinkingMessage = Array.from(chatBox.querySelectorAll('.ai-message p'))
                .find(p => p.textContent === 'Thinking...');
            if (thinkingMessage && thinkingMessage.parentElement) {
                thinkingMessage.parentElement.remove();
            }

            // Check if the API response is not OK (e.g., 4xx or 5xx errors)
            if (!response.ok) {
                let errorData; // To store parsed error details from the API
                const responseContentType = response.headers.get("content-type");

                // Try to parse error details if the response is JSON
                if (responseContentType && responseContentType.includes("application/json")) {
                    try {
                        errorData = await response.json();
                    } catch (e) {
                        // If JSON parsing fails, use the raw response text
                        errorData = { error: { message: await response.text() || "Unknown API error (non-JSON response, parsing failed)" } };
                    }
                } else {
                    // If not JSON, use the raw response text
                     errorData = { error: { message: await response.text() || "Unknown API error (non-JSON response)" } };
                }

                // Log detailed error information for debugging
                console.error("GitHub Page: API Error Response:", { status: response.status, statusText: response.statusText, data: errorData, headers: Object.fromEntries(response.headers.entries()) });

                // Construct a user-friendly error message
                let errorMessage = `API Error: ${response.status} ${response.statusText}.`;
                const clerkAuthMessage = response.headers.get('x-clerk-auth-message'); // Specific header from OpenRouter for auth issues
                if (clerkAuthMessage) {
                    errorMessage += ` Server Auth Detail: ${clerkAuthMessage}.`;
                }

                // Add more specific details from the errorData if available
                if (errorData && errorData.error && errorData.error.message) {
                    errorMessage += ` Details: ${errorData.error.message}`;
                } else if (errorData && typeof errorData.detail === 'string') { // Handle different error structures
                    errorMessage += ` Details: ${errorData.detail}`;
                } else if (errorData && errorData.message) { // Yet another possible error structure
                     errorMessage += ` Details: ${errorData.message}`;
                } else {
                    errorMessage += ` No further details provided by API. Check browser console.`;
                }

                // Provide more specific advice based on common error codes
                if (response.status === 401) { // Unauthorized
                    errorMessage += " (Authentication failed. Check API Key and model access. If Clerk error persists, this might be an origin-based issue on the server.)";
                } else if (response.status === 400 && errorData.error && errorData.error.message && errorData.error.message.includes("context length")) { // Bad Request - often context length
                    errorMessage += " Even with history truncation and middle-out transform, the context might be too large for this model. Consider shortening context.txt or using a model with a larger context window.";
                }
                // Display the error message in the chat
                displayMessage('ai', errorMessage, true);
                return; // Exit the function as an error occurred
            }

            // If the response is OK, parse the JSON data
            const data = await response.json();
            // Extract the AI's response text
            const aiResponse = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                ? data.choices[0].message.content.trim()
                : "Sorry, I couldn't get a valid response content."; // Fallback if response structure is unexpected

            // Display the AI's response
            displayMessage('ai', aiResponse);
            // Add the AI's response to the conversation history
            conversationHistory.push({ role: 'assistant', content: aiResponse });

        } catch (error) { // Catches network errors (e.g., no internet) or issues with fetch itself
            console.error("GitHub Page: Error sending message to AI (Fetch/Network):", error);
            // Ensure "Thinking..." message is removed even if an error occurs here
            const thinkingMessage = Array.from(chatBox.querySelectorAll('.ai-message p'))
                .find(p => p.textContent === 'Thinking...');
            if (thinkingMessage && thinkingMessage.parentElement) {
                thinkingMessage.parentElement.remove();
            }
            // Display a generic network/application error message
            displayMessage('ai', `Network or application error: ${error.message}. Please check your internet connection and the browser console for more details.`, true);
        } finally {
            // Re-enable the send button and input field, but only if context is not currently loading
            // (This prevents sending messages if context loading somehow finishes *during* an AI request)
            sendButton.disabled = isLoadingContext;
            userInput.disabled = isLoadingContext;
        }
    }

    // --- EVENT LISTENERS ---

    // Event listener for the send button click
    sendButton.addEventListener('click', () => {
        console.log('Send button CLICKED. isLoadingContext:', isLoadingContext, 'Input Value:', `"${userInput.value.trim()}"`);
        // Only send message if context is loaded and input is not empty
        if (!isLoadingContext && userInput.value.trim() !== "") {
            sendMessageToAI(userInput.value);
        } else {
            console.log('Send button click: Conditions not met to send message.');
        }
    });

    // Event listener for key presses in the user input field
    userInput.addEventListener('keypress', (event) => {
        console.log('User input KEYPRESS. Key:', event.key, 'isLoadingContext:', isLoadingContext, 'Input Value:', `"${userInput.value.trim()}"`);
        // Check if the pressed key is 'Enter'
        if (event.key === 'Enter') {
            console.log('Enter key PRESSED.');
            event.preventDefault(); // Prevent the default Enter key action (e.g., form submission)
            // Only send message if context is loaded and input is not empty
            if (!isLoadingContext && userInput.value.trim() !== "") {
                sendMessageToAI(userInput.value);
            } else {
                console.log('Enter key press: Conditions not met to send message.');
            }
        }
    });

    // --- INITIALIZATION ---

    // Initially disable the send button and input field while context is loading
    sendButton.disabled = true;
    userInput.disabled = true;
    userInput.placeholder = "Loading context..."; // Update placeholder

    // Update initial AI message to show loading status
    if (initialAiMessageElement) {
        initialAiMessageElement.textContent = "Loading context...";
    }
    // Start loading the context
    loadContext();
});
