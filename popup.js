// Function to handle section visibility based on current URL
function setupInterfaceBasedOnUrl(url) {
    // Define which sections should be enabled on which domains
    const sectionRules = {
        'aiSection': ['efpv.fa.us6.oraclecloud.com/hcmUI/faces','fa-efpv-dev9-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/faces'],
        'linkedinSection': ['efpv.fa.us6.oraclecloud.com/hcmUI/faces','fa-efpv-dev9-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/faces'],
        'indexSection': ['efpv.fa.us6.oraclecloud.com/hcmUI/faces','fa-efpv-dev9-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/faces'],
        'evaluatorSection': ['efpv.fa.us6.oraclecloud.com/hcmUI/faces','fa-efpv-dev9-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/faces']
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
    const query = document.getElementById('linkedinInput').value;
    const processedQuery = `site:linkedin.com/in "${query}"`;
    const linkedinUrl = `https://www.google.com/search?q=${encodeURIComponent(processedQuery)}`;
    chrome.tabs.create({ url: linkedinUrl });
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
