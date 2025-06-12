/**
 * background.js
 *
 * Background script for the Chrome extension
 */

// Initialize when the background script loads
console.log("Background script initialized");

// Global variable to ensure the background script remains active
let keepAlive = true;

// Main message listener for handling requests from content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("Background script received message:", request.action, "Data size:", 
                request.data ? JSON.stringify(request.data).length : 0);
    
    // Handle opening the results tab
    if (request.action === 'openResultsTab') {
        console.log("Processing request to open results tab");

        // Store the results data in chrome.storage for the results page to access
        chrome.storage.local.set({ 'searchResults': request.data }, function() {
            if (chrome.runtime.lastError) {
                console.error("Error storing data:", chrome.runtime.lastError);
                sendResponse({ 
                    success: false, 
                    error: "Failed to store search results" 
                });
                return;
            }
            
            console.log("Data stored successfully in chrome.storage.local");
            
            // After storing the data, open the results page
            console.log("Opening Results Page");
            const resultsUrl = chrome.runtime.getURL('search_results.html');

            try {
                chrome.tabs.create({ url: resultsUrl }, function(tab) {
                    if (chrome.runtime.lastError) {
                        console.error("Error creating tab:", chrome.runtime.lastError);
                        sendResponse({
                            success: false,
                            error: chrome.runtime.lastError.message
                        });
                    } else {
                        console.log('Results tab created:', tab.id);
                        sendResponse({
                            success: true,
                            tabId: tab.id
                        });
                    }
                });
            } catch (error) {
                console.error("Exception creating tab:", error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            }
        });

        // IMPORTANT: Return true to indicate async response
        return true;
    }
    
    // Return true for all message handlers to keep the channel open
    return true;
});

// Make sure the background script stays active
chrome.runtime.onInstalled.addListener(function() {
    console.log("Extension installed/updated");
    
    // Create an alarm to keep the service worker alive
    chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
});

// Respond to the keepAlive alarm
chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name === 'keepAlive') {
        console.log('Background script kept alive');
    }
});

// Listen for connections to keep the service worker alive
chrome.runtime.onConnect.addListener(function(port) {
    port.onDisconnect.addListener(function() {
        console.log('Port disconnected, but background script remains active');
    });
});

// Add a persistent runtime.onStartup listener
chrome.runtime.onStartup.addListener(function() {
    console.log("Browser started, background script activated");
});
