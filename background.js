/**
 * background.js
 *
 * Background script for the Chrome extension
 */

// Initialize when the background script loads
console.log("Background script initialized");

// Global variable to ensure the background script remains active
let keepAlive = true;

// Variables for tab URL capturing
let isCapturingTabUrls = false;
let activeContentScriptTabId = null;

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
    
    // Handle executing search from the index_resumes_on_page.js
    else if (request.action === 'executeSearch') {
        console.log("Received request to execute search with query:", request.query);
        request.query = "QUERY: " + request.query; // Prefix the query for clarity

        // Get the current tab
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
                console.error("Error getting current tab:", chrome.runtime.lastError);
                sendResponse({success: false, error: "Could not get current tab"});
                return;
            }

            const currentTab = tabs[0];

            // Inject the search_resumes_on_page.js script
            chrome.scripting.executeScript({
                target: {tabId: currentTab.id},
                files: ['search_resumes_on_page.js']
            }).then(() => {
                // Wait for script to load then send the search message
                setTimeout(() => {
                    chrome.tabs.sendMessage(currentTab.id, {
                        action: "searchResumes",
                        query: request.query
                    }, (response) => {
                        console.log("Search execution response:", response);
                        sendResponse({success: true, response: response});
                    });
                }, 500);
            }).catch(error => {
                console.error("Error executing search script:", error);
                sendResponse({success: false, error: error.message});
            });
        });

        // Return true to indicate we'll send a response asynchronously
        return true;
    }
    
    // Handle preparation for tab URL capturing
    else if (request.action === 'prepareForTabCapture') {
        console.log("Preparing to capture next tab URL");
        isCapturingTabUrls = true;
        activeContentScriptTabId = sender.tab.id;
        
        sendResponse({
            success: true,
            message: "Background script ready to capture tab URL"
        });
    }

    // Return true for all message handlers to keep the channel open
    return true;
});

// Listen for tab creation events
chrome.tabs.onCreated.addListener(function(tab) {
    console.log("New tab created:", tab.id);
    
    if (isCapturingTabUrls && activeContentScriptTabId) {
        console.log("Tab created while capturing URLs, waiting for it to load");
        
        // Wait for the tab to finish loading to get the final URL
        chrome.tabs.onUpdated.addListener(function tabLoadListener(tabId, changeInfo, updatedTab) {
            // Check if this is the tab we're watching and it has finished loading
            if (tabId === tab.id && changeInfo.status === 'complete') {
                console.log("Tab finished loading, URL:", updatedTab.url);
                
                // Send the URL back to the content script
                if (activeContentScriptTabId) {
                    chrome.tabs.sendMessage(activeContentScriptTabId, {
                        action: 'tabUrlCaptured',
                        url: updatedTab.url,
                        tabId: tabId
                    }, function(response) {
                        console.log("URL sent to content script, response:", response);
                        
                        // Close the tab after a short delay
                        setTimeout(() => {
                            chrome.tabs.remove(tabId, function() {
                                if (chrome.runtime.lastError) {
                                    console.error("Error closing tab:", chrome.runtime.lastError);
                                }
                            });
                        }, 500);
                    });
                }
                
                // Reset capturing state
                isCapturingTabUrls = false;
                
                // Remove this listener
                chrome.tabs.onUpdated.removeListener(tabLoadListener);
            }
        });
    }
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
