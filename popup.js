// Function to handle section visibility based on current URL
function setupInterfaceBasedOnUrl(url) {
    // Define which sections should be enabled on which domains
    const sectionRules = {
        'aiSection': ['efpv.fa.us6.oraclecloud.com/hcmUI/faces','fa-efpv-dev9-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI'],
        'linkedinSection': ['efpv.fa.us6.oraclecloud.com/hcmUI/faces','fa-efpv-dev9-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI'],
        'indexSection': ['efpv.fa.us6.oraclecloud.com/hcmUI/faces','fa-efpv-dev9-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI'],
        'evaluatorSection': ['efpv.fa.us6.oraclecloud.com/hcmUI/faces','fa-efpv-dev9-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI']
    };
    
    // Process each section
    Object.keys(sectionRules).forEach(sectionId => {
        const section = document.getElementById(sectionId);
        const allowedDomains = sectionRules[sectionId];
        const isEnabled = allowedDomains.some(domain => url.includes(domain));
        
        // Get all interactive elements in this section
        const interactiveElements = section.querySelectorAll('button, input, select, textarea');
        
        if (isEnabled) {
            // Enable the section
            section.classList.remove('disabled-section');
            interactiveElements.forEach(el => el.disabled = false);
            
            // Enable the corresponding tab
            const tab = document.querySelector(`.tab[data-section="${sectionId}"]`);
            if (tab) {
                tab.classList.remove('disabled-tab');
                tab.disabled = false;
            }
        } else {
            // Disable the section
            section.classList.add('disabled-section');
            interactiveElements.forEach(el => el.disabled = true);
            
            // Disable the corresponding tab
            const tab = document.querySelector(`.tab[data-section="${sectionId}"]`);
            if (tab) {
                tab.classList.add('disabled-tab');
                tab.disabled = true;
            }
        }
    });
    
    // Show a message in disabled sections
    document.querySelectorAll('.disabled-section').forEach(section => {
        // Check if we already added a message
        if (!section.querySelector('.disabled-message')) {
            const message = document.createElement('div');
            message.className = 'disabled-message';
            message.textContent = 'This feature is not available on the current page.';
            section.appendChild(message);
        }
    });
    
    // If current active section is disabled, switch to the first enabled tab
    const activeSection = document.querySelector('.section:not(.hidden)');
    if (activeSection && activeSection.classList.contains('disabled-section')) {
        const firstEnabledTab = document.querySelector('.tab:not(.disabled-tab)');
        if (firstEnabledTab) {
            firstEnabledTab.click();
        }
    }
}

// Initialize tab system - make sure only one section is visible initially
function initializeTabs() {
    // Hide all sections except the first one
    const sections = document.querySelectorAll('.section');
    sections.forEach((section, index) => {
        if (index === 0) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    });
    
    // Mark the first tab as active
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach((tab, index) => {
        if (index === 0) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

// Get current tab URL when popup opens
document.addEventListener('DOMContentLoaded', () => {
    // Initialize tab system first
    initializeTabs();
    
    // Then set up interface based on URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        setupInterfaceBasedOnUrl(currentUrl);
    });
});

// Event listeners for functional buttons
document.getElementById('aiSearch').addEventListener('click', () => {
    // Get the search query from the input field
    const query = document.getElementById('aiInput').value.trim();
    
    // Just log whether query is entered or not
    if (!query) {
        console.log("No search query entered");
    } else {
        console.log("Search query entered:", query);
    }

    // Execute the search_resumes_on_page.js script in the current active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        try {
            // First inject the script
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                files: ['search_resumes_on_page.js']
            }).then(() => {
                // Increase delay to ensure script is fully loaded before sending the message
                setTimeout(() => {
                    console.log("Sending search query to content script:", query);
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "searchResumes",
                        query: query
                    }, (response) => {
                        console.log("Response from content script:", response);
                        if (chrome.runtime.lastError) {
                            console.error("Error sending message:", chrome.runtime.lastError);
                        }
                    });
                }, 500); // Increased to 500ms delay to ensure script is fully loaded
            }).catch(error => {
                console.error("Error executing script:", error);
            });
            
            // Don't close the popup immediately to ensure message is sent
            setTimeout(() => {
                window.close();
            }, 1000); // Close after 1 second to ensure communication completes
        } catch (err) {
            console.error("Error in aiSearch click handler:", err);
        }
    });
});

document.getElementById('indexButton').addEventListener('click', () => {
    // Execute the index_resumes_on_page.js script in the current active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        try {
            // First inject the script
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                files: ['index_resumes_on_page.js']
            }).then(() => {
                // Increase delay to ensure script is fully loaded before sending the message
                setTimeout(() => {
                    console.log("Sending indexCandidates action to content script");
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "indexCandidates"
                    }, (response) => {
                        console.log("Response from content script:", response);
                        if (chrome.runtime.lastError) {
                            console.error("Error sending message:", chrome.runtime.lastError);
                        }
                    });
                }, 500); // 500ms delay to ensure script is fully loaded
            }).catch(error => {
                console.error("Error executing script:", error);
            });

            // Don't close the popup immediately to ensure message is sent
            setTimeout(() => {
                window.close();
            }, 1000); // Close after 1 second to ensure communication completes
        } catch (err) {
            console.error("Error in indexButton click handler:", err);
        }
    });
});

document.getElementById('linkedinSearch').addEventListener('click', () => {
    const query = document.getElementById('linkedinInput').value.trim();
    
    // Get query from input or extract from page
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
        let finalQuery = query;
        
        // If no query provided, extract from page
        if (!finalQuery) {
            try {
                console.log("No query provided, attempting to extract from page");
                
                // Execute script to extract text from the specified element
                const extractionResults = await chrome.scripting.executeScript({
                    target: {tabId: tabs[0].id},
                    function: () => {
                        // Get all elements with the specified class
                        const editorElements = document.querySelectorAll('.af_richTextEditor_content.ck-content');
                        
                        // Log in the page context
                        window.console.log("[Page Context] Searching for job description in page");
                        window.console.log("[Page Context] Found", editorElements.length, "editor elements");
                        
                        // If we have at least 2 elements, get the text from the second one
                        if (editorElements.length >= 1) {
                            const fullText = editorElements[0].textContent || '';
                            window.console.log("[Page Context] Found text content:", fullText.substring(0, 100) + "...");
                            
                            // Use regex to extract text between "bring" and "What success"
                            const regex = /bring:([\s\S]*?)What success/i;
                            window.console.log("[Page Context] Applying regex to extract job requirements");
                            const match = fullText.match(regex);
                            
                            if (match && match[1]) {
                                const extractedText = match[1].trim();
                                window.console.log(`[Page Context] Regex match found, extracted ${extractedText.length} characters`);
                                window.console.log("[Page Context] Extracted text:", extractedText.substring(0, 100) + "...");
                                return extractedText;
                            }
                            window.console.log("[Page Context] Regex didn't match, returning full text");
                            return fullText.trim(); // Return full text if regex doesn't match
                        }
                        window.console.log("[Page Context] Couldn't find required editor elements");
                        return null;
                    }
                });
                
                // Check if extraction was successful
                if (extractionResults && extractionResults[0] && extractionResults[0].result) {
                    finalQuery = extractionResults[0].result;
                    console.log("Extracted query from page:", finalQuery);
                } else {
                    console.log("Could not extract query from page");
                    alert("Could not extract job description from page. Please enter a query manually.");
                    return;
                }
            } catch (err) {
                console.error("Error extracting text:", err);
                alert("Error extracting text from page: " + err.message);
                return;
            }
        }
        
        // Now we have a query either from input or extracted from page
        // Send the query to the LinkedIn API endpoint
        try {
            console.log("Sending query to LinkedIn API:", finalQuery);

            // Show loading notification
            const loadingNotification = document.createElement('div');
            loadingNotification.textContent = 'Sending request to LinkedIn API...';
            loadingNotification.style.cssText = 'position:fixed; top:0; left:0; right:0; background:#3498db; color:white; text-align:center; padding:10px;';
            document.body.prepend(loadingNotification);

            // Send the request
            const response = await fetch('http://localhost:8000/linkedin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: finalQuery })
            });

            console.log(`API response status: ${response.status} ${response.statusText}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the response data
            const data = await response.json();
            console.log("Received response from LinkedIn API:", data);

            await chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                function: (responseData) => {
                    window.console.log("%c LinkedIn API Response:", "color: #0077B5; font-weight: bold; font-size: 14px;");
                    window.console.log(responseData);

                    // Create a temporary on-screen notification
                    const notification = document.createElement('div');
                    notification.textContent = 'LinkedIn API response received. Check browser console (F12) for details.';
                    notification.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#0077B5; color:white; padding:10px; border-radius:5px; z-index:9999; box-shadow:0 4px 8px rgba(0,0,0,0.2);';
                    document.body.appendChild(notification);

                    // Remove the notification after 5 seconds
                    setTimeout(() => {
                        notification.remove();
                    }, 5000);
                },
                args: [data]
            });

            // Handle the response format
            if (data.result) {
                // Format the data for search_results.js format
                const formattedResults = {
                    query: finalQuery,
                    results: [{
                        id: 'linkedin-result',
                        filename: data.result[0] || 'LinkedIn Search Result',
                        isMatch: data.result[1] === 'YES',
                        snippet: data.result.title || 'LinkedIn Search Result',
                        explanation: data.result[2] || 'No explanation available',
                        linkedinProfile: true
                    }],
                    timestamp: new Date().toISOString(),
                    totalMatches: data.result.matchBadge === 'YES' ? 1 : 0
                };

                // Store in chrome.storage.local for search_results.html to display
                chrome.storage.local.set({
                    searchResults: formattedResults
                }, function() {
                    // Open search_results.html
                    chrome.tabs.create({ url: 'search_results.html' });
                });
            } else {
                // Fallback to existing format if result key is not present
                const formattedResults = {
                    query: finalQuery,
                    results: data.profiles.map((profile, index) => ({
                        id: `linkedin-${index}`,
                        filename: profile.name || 'LinkedIn Profile',
                        isMatch: profile.match === true,
                        snippet: `<p><strong>Title:</strong> ${profile.title || 'N/A'}</p>
                                  <p><strong>Location:</strong> ${profile.location || 'N/A'}</p>
                                  <p><strong>Skills:</strong> ${profile.skills?.join(', ') || 'N/A'}</p>
                                  <p><strong>Experience:</strong> ${profile.experience || 'N/A'}</p>
                                  ${profile.url ? `<p><a href="${profile.url}" target="_blank" style="color: #56b9ff;">View Profile</a></p>` : ''}`,
                        explanation: profile.analysis || 'No analysis available',
                        linkedinProfile: true
                    })),
                    timestamp: new Date().toISOString(),
                    totalMatches: data.profiles.filter(p => p.match === true).length
                };

                // Store in chrome.storage.local for search_results.html to display
                chrome.storage.local.set({
                    searchResults: formattedResults
                }, function() {
                    // Open search_results.html
                    chrome.tabs.create({ url: 'search_results.html' });
                });
            }

        } catch (error) {
            console.error("Error processing LinkedIn query:", error);
            alert("Error connecting to LinkedIn API: " + error.message);
        }
    });
});

document.getElementById('evaluateButton').addEventListener('click', () => {
    // Get the evaluation criteria from the input field
    const criteria = document.getElementById('evaluatorInput').value.trim();
    
    // Just log whether criteria is entered or not
    if (!criteria) {
        console.log("No evaluation criteria entered");
    } else {
        console.log("Evaluation criteria entered:", criteria);
    }

    // Execute the search_resumes_on_page.js script in the current active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        try {
            // First inject the script
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                files: ['evaluate_resumes_on_page.js']
            }).then(() => {
                // Increase delay to ensure script is fully loaded before sending the message
                setTimeout(() => {
                    console.log("Sending evaluation criteria to content script:", criteria);
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "evaluateCandidates",
                        query: criteria
                    }, (response) => {
                        console.log("Response from content script:", response);
                        if (chrome.runtime.lastError) {
                            console.error("Error sending message:", chrome.runtime.lastError);
                        }
                    });
                }, 500); // 500ms delay to ensure script is fully loaded
            }).catch(error => {
                console.error("Error executing script:", error);
            });
            
            // Don't close the popup immediately to ensure message is sent
            setTimeout(() => {
                window.close();
            }, 1000); // Close after 1 second to ensure communication completes
        } catch (err) {
            console.error("Error in evaluateButton click handler:", err);
        }
    });
});

// Tab switcher logic
const tabs = document.querySelectorAll('.tab');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Skip if tab is disabled
        if (tab.disabled || tab.classList.contains('disabled-tab')) {
            return;
        }
        
        // Remove active from all tabs
        tabs.forEach(t => t.classList.remove('active'));

        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show selected section
        const sectionId = tab.getAttribute('data-section');
        document.getElementById(sectionId).classList.remove('hidden');
        tab.classList.add('active');
    });
});
