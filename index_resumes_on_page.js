/**
 * index_resumes_on_page.js
 * 
 * This script handles the indexing functionality for candidate resumes
 */

(function() {
    // Flag to track if we've already processed a search to avoid duplicate execution
    let searchProcessed = false;
    
    console.log("Index Resumes Content script loaded and initialized");
    
    // Listen for messages from the popup
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        console.log("Message received in content script:", request.action);

        if (request.action === "indexCandidates" && !searchProcessed) {
            // Set flag to prevent duplicate processing
            searchProcessed = true;
            
            console.log("Starting the index candidates process");
            processDetailsPage()
                .then(result => {
                    sendResponse({status: "Index process completed: " + result});
                })
                .catch(error => {
                    console.error("Error in index process:", error);
                    sendResponse({status: "Error: " + error.message});
                    showNotification("Error: " + error.message, 'error');
                });
            
            // Return true to indicate we'll send a response asynchronously
            return true;
        } else {
            console.log("Ignoring duplicate message or unknown action");
            sendResponse({status: "Ignored - action already processed or unknown"});
            return true;
        }
    });
    
    /**
     * Process the details page to extract resume information
     */
    async function processDetailsPage() {
        console.log("Processing details page");
        
        try {
            // Step 1: Find the div with title="Details" and click its link
            const detailsElement = findElementWithTitle("Details");
            if (!detailsElement) {
                throw new Error("Could not find element with title 'Details'");
            }
            
            console.log("Found Details element:", detailsElement);
            
            const linkElement = detailsElement.querySelector('a');
            if (!linkElement) {
                throw new Error("Could not find link inside Details element");
            }
            
            console.log("Found link element inside Details:", linkElement);
            console.log("Link URL:", linkElement.href);
            
            console.log("Clicking on Details link");
            linkElement.click();
            
            // Step 2: Wait for page to load completely with JavaScript
            await waitForPageLoad();
            // Additional wait to ensure all JavaScript is loaded and executed
            console.log("Waiting for Details page to fully load and stabilize...");
            await new Promise(resolve => setTimeout(resolve, 2000)); // Increased to 8 seconds
            
            // Step 2.1: Find the div with title="Posting Description"
            console.log("Finding div with title 'Posting Description'");
            const postingDescElement = await waitForElement('[title="Posting Description"]', 2000); // Increased timeout
            if (!postingDescElement) {
                throw new Error("Could not find element with title 'Posting Description'");
            }
            
            console.log("Found Posting Description element:", postingDescElement);
            
            // Add additional delay before looking for resume link
            console.log("Waiting for Posting Description content to stabilize...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Step 2.2: Find div with specific class within the Posting Description parent
            console.log("Finding div with class for resume link within Posting Description context");
            const resumeDiv = await waitForElementWithinContext(
                ".x37f.x37e.x3gu.hideInEditMode.xeq.p_AFIconOnly", 
                postingDescElement,
                15000 // Increased timeout
            );
            
            if (!resumeDiv) {
                throw new Error("Could not find the resume div element within Posting Description");
            }
            
            console.log("Found resume div:", resumeDiv);
            
            const resumeLink = resumeDiv.querySelector('a');
            if (!resumeLink) {
                throw new Error("Could not find resume link inside div");
            }
            
            console.log("Found resume link:", resumeLink);
            console.log("Resume URL:", resumeLink.href);
            
            console.log("Clicking on resume link");
            resumeLink.click();
            
            // Step 3: Wait for content to load, extract div with rich text content
            await waitForPageLoad();
            
            // Add significant delay to allow resume content to fully load
            console.log("Waiting for resume content to fully load...");
            await new Promise(resolve => setTimeout(resolve, 2000)); // Increased to 8 seconds
            
            console.log("Finding rich text content elements");
            // Wait for at least one element to appear first with increased timeout
            await waitForElement(".af_richTextEditor_content.ck-content", 2000); // Increased timeout
            
            // Add additional delay to ensure content is fully rendered
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Then get all matching elements and check if there are multiple instances
            const richTextDivs = document.querySelectorAll(".af_richTextEditor_content.ck-content");
            console.log(`Found ${richTextDivs.length} rich text content elements`);
            
            if (richTextDivs.length < 1) {
                throw new Error("Could not find second rich text content element. Only found " + richTextDivs.length);
            }
            
            // Get the second element (index 1)
            const richTextDiv = richTextDivs[0];
            console.log("Using the second rich text div for extraction");
            
            // Step 4: Apply regex to extract text between specific phrases
            const extractedText = richTextDiv.textContent || "";
            console.log("Raw extracted text length:", extractedText.length);

            // Improved regex to more precisely capture text between the markers
            const regex = /bring:[\s\n\r]*(.+?)[\s\n\r]*(?:What\s+success|$)/is;
            const match = extractedText.match(regex);

            let query = "";
            if (match && match[1]) {
                // More thorough whitespace cleanup
                query = match[1]
                    .trim()                    // Remove leading/trailing whitespace
                    .replace(/\s+/g, ' ')      // Replace any whitespace sequence with a single space
                    .replace(/\s,/g, ',')      // Fix spacing before commas
                    .replace(/\s\./g, '.')     // Fix spacing before periods
                    .replace(/\n|\r/g, '')     // Remove any remaining newlines/carriage returns
                    .trim();                   // Final trim to ensure clean result
                
                console.log("Extracted and cleaned text between 'What you'll bring:' and 'What success looks like:'");
            } else {
                console.log("Pattern not found, using full text as fallback");
                // Apply the same thorough cleaning to the fallback text
                query = extractedText
                    .trim()
                    .replace(/\s+/g, ' ')
                    .replace(/\s,/g, ',')
                    .replace(/\s\./g, '.')
                    .replace(/\n|\r/g, '')
                    .trim();
            }

            console.log("Extracted query:", query);
            console.log("Query length:", query.length);

            if (!query) {
                throw new Error("Could not extract meaningful text from content");
            }
            
            // Add a significant delay here to ensure the query extraction is complete
            // and the system is ready for navigation
            console.log("Waiting for system to stabilize before navigating away...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Step 5: Navigate to Overview page then Active Applications
            console.log("Finding Overview link");
            const overviewElement = findElementWithTitle("Overview");
            if (!overviewElement) {
                throw new Error("Could not find element with title 'Overview'");
            }
            
            console.log("Found Overview element:", overviewElement);
            
            const overviewLink = overviewElement.tagName === 'A' ? 
                overviewElement : overviewElement.querySelector('a');
            
            if (!overviewLink) {
                throw new Error("Could not find clickable link for Overview");
            }
            
            console.log("Clicking on Overview link");
            overviewLink.click();
            
            // Wait for the Overview page to load with more robust waiting
            await waitForPageLoad(1000); // Increased timeout
            console.log("Overview page initially loaded, waiting for JavaScript execution...");
            
            // Add increased delay time to ensure all JavaScript is loaded and executed
            await new Promise(resolve => setTimeout(resolve, 2000)); // Increased to 10 seconds
            
            // Wait specifically for the Active Applications link to appear in the DOM
            console.log("Waiting for Active Applications link to appear...");
            try {
                const activeAppsElement = await waitForElement('[title="Active Applications"]', 2000); // Increased to 20 seconds
                console.log("Found Active Applications element:", activeAppsElement);
                
                // Add additional delay before clicking to ensure page is stable
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const activeAppsLink = activeAppsElement.tagName === 'A' ? 
                    activeAppsElement : activeAppsElement.querySelector('a');
                
                if (!activeAppsLink) {
                    throw new Error("Could not find clickable link for Active Applications");
                }
                
                console.log("Clicking on Active Applications link");
                activeAppsLink.click();
                
                await waitForPageLoad(5000); // Increased timeout
                console.log("Active Applications page loaded, waiting for page to stabilize...");
                
                // Add a significant delay before proceeding with search
                await new Promise(resolve => setTimeout(resolve, 2000)); // Increased to 10 seconds
                
                // Execute search with the extracted query
                await injectAndExecuteSearchScript(query);
            } catch (error) {
                console.error("Error finding Active Applications link:", error);
                showNotification("Error: " + error.message, 'error');
                throw error;
            }
            
            return "Successfully processed and executed search with extracted query";
            
        } catch (error) {
            console.error("Error in processDetailsPage:", error);
            showNotification("Error processing details: " + error.message, 'error');
            throw error;
        }
    }
    
    /**
     * Inject and execute the search_resumes_on_page.js script with the extracted query
     * @param {string} query - The query to search with
     */
    async function injectAndExecuteSearchScript(query) {
        return new Promise((resolve, reject) => {
            try {
                // Get the current tab ID
                chrome.runtime.sendMessage({
                    action: 'executeSearch',
                    query: query
                }, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error("Error executing search:", chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    
                    console.log("Search execution response:", response);
                    resolve(response);
                });
            } catch (error) {
                console.error("Error injecting search script:", error);
                reject(error);
            }
        });
    }
    
    /**
     * Find an element with the specified title attribute
     * @param {string} title - The title to search for
     * @returns {Element} - The found element or null
     */
    function findElementWithTitle(title) {
        return document.querySelector(`[title="${title}"]`);
    }
    
    /**
     * Wait for a specific element to be available in the DOM
     * @param {string} selector - CSS selector for the element
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Element>} - The found element
     */
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            // First check if element already exists
            const element = document.querySelector(selector);
            if (element) {
                return resolve(element);
            }
            
            // Set a timeout to reject the promise if element isn't found
            const timeoutId = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
            
            // Create a mutation observer to watch for DOM changes
            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    clearTimeout(timeoutId);
                    obs.disconnect();
                    resolve(element);
                }
            });
            
            // Start observing
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }
    
    /**
     * Wait for a specific element to be available within a context element
     * @param {string} selector - CSS selector for the element
     * @param {Element} contextElement - The context element to search within
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Element>} - The found element
     */
    function waitForElementWithinContext(selector, contextElement, timeout = 10000) {
        return new Promise((resolve, reject) => {
            // First check if element already exists within context
            const element = contextElement.querySelector(selector);
            if (element) {
                return resolve(element);
            }
            
            // Set a timeout to reject the promise if element isn't found
            const timeoutId = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within context element within ${timeout}ms`));
            }, timeout);
            
            // Create a mutation observer to watch for DOM changes in the context
            const observer = new MutationObserver((mutations, obs) => {
                const element = contextElement.querySelector(selector);
                if (element) {
                    clearTimeout(timeoutId);
                    obs.disconnect();
                    resolve(element);
                }
            });
            
            // Start observing the context element
            observer.observe(contextElement, {
                childList: true,
                subtree: true
            });
        });
    }
    
    /**
     * Wait for the page to finish loading
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<void>}
     */
    function waitForPageLoad(timeout = 10000) {
        return new Promise((resolve, reject) => {
            // If document is already complete, resolve immediately
            if (document.readyState === 'complete') {
                return resolve();
            }
            
            // Set a timeout to reject the promise if page doesn't load
            const timeoutId = setTimeout(() => {
                reject(new Error(`Page did not load within ${timeout}ms`));
            }, timeout);
            
            // Listen for the load event
            window.addEventListener('load', function onLoad() {
                clearTimeout(timeoutId);
                window.removeEventListener('load', onLoad);
                
                // Give a small additional delay for any scripts to initialize
                setTimeout(resolve, 500);
            });
        });
    }
    
    /**
     * Shows a notification message
     * @param {string} message - Message to display
     * @param {string} type - Type of notification (info, success, error)
     */
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 20px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10001;
        `;
        
        // Set style based on type
        switch(type) {
            case 'success':
                notification.style.backgroundColor = '#4caf50';
                notification.style.color = 'white';
                break;
            case 'error':
                notification.style.backgroundColor = '#f44336';
                notification.style.color = 'white';
                break;
            default:
                notification.style.backgroundColor = '#2196f3';
                notification.style.color = 'white';
        }
        
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 5000);
    }

    // Make the processDetailsPage function available for testing
    window.processDetailsPage = processDetailsPage;
})();
