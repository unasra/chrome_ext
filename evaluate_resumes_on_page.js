/**
 * search_resumes_on_page.js
 * 
 * This script scans the current webpage for resume links with 
 * a specific Oracle Cloud prefix and fetches PDFs using fetch() API.
 */

(function() {
    // Store the search query passed from the popup
    let searchQuery = '';
    
    // Flag to track if we've already processed a search to avoid duplicate execution
    let searchProcessed = false;
    
    console.log("Rank/Evaluate Resume Content script loaded and initialized");
    
    // Listen for messages from the popup - set this up first before any other operation
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        console.log("Message received in content script:", request.action);

        if (request.action === "evaluateCandidates" && !searchProcessed) {
            // Set flag to prevent duplicate processing
            searchProcessed = true;
            
            console.log("Query received from popup:", request.query);
            searchQuery = request.query || '';
            console.log(`Search initiated with query: "${searchQuery}"`);

            if (!searchQuery) {
                console.log("No search query provided - proceeding anyway");
            } else {
                console.log("Search query received:", searchQuery);
            }

            // Execute the search function with the received query
            searchResumesOnPage(searchQuery);
            sendResponse({status: "Search started with query: " + searchQuery});
        } else {
            console.log("Ignoring duplicate message or unknown action");
            sendResponse({status: "Ignored - action already processed or unknown"});
        }
        return true;
    });
    
    function searchResumesOnPage(query = '') {
        console.log("searchResumesOnPage function called with query:", query);
        try {
            // The prefix to search for
           // const resumePrefix = "https://efpv.fa.us6.oraclecloud.com/hcmUI/content/conn/FusionAppsContentRepository/uuid/dDocID:";
            const resumePrefix = "https://fa-efpv-dev9-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/hcmRec";

            // Array to store matching resume links
            const resumeLinks = [];

            // 1. Check all anchor elements on the page
            const allLinks = document.getElementsByTagName('a');
            
            // Check each link for the resume prefix
            for (let i = 0; i < allLinks.length; i++) {
                const link = allLinks[i];
                const href = link.href || "";

                if (href.startsWith(resumePrefix)) {
                    resumeLinks.push({
                        url: href,
                        text: link.textContent.trim() || "No text",
                        element: link,
                        source: "anchor"
                    });
                }
            }

            // 2. Check all iframe elements on the page
            const allIframes = document.getElementsByTagName('iframe');
            
            // Check each iframe src for the resume prefix
            for (let i = 0; i < allIframes.length; i++) {
                const iframe = allIframes[i];
                const src = iframe.src || "";

                if (src.startsWith(resumePrefix)) {
                    // Create a description for the iframe-based link
                    const frameTitle = iframe.title || iframe.name || iframe.id || `Frame ${i+1}`;
                    
                    resumeLinks.push({
                        url: src,
                        text: `Resume from iframe: ${frameTitle}`,
                        element: iframe,
                        source: "iframe"
                    });
                }
            }
            
            // 3. Try to access iframe contents if same-origin
            try {
                const iframesWithContent = Array.from(allIframes).filter(iframe => {
                    try {
                        // This will throw an error if cross-origin
                        return iframe.contentDocument && iframe.contentDocument.body;
                    } catch (e) {
                        return false;
                    }
                });
                
                // Search for links inside each accessible iframe
                iframesWithContent.forEach((iframe, frameIndex) => {
                    try {
                        const iframeLinks = iframe.contentDocument.getElementsByTagName('a');
                        
                        for (let i = 0; i < iframeLinks.length; i++) {
                            const link = iframeLinks[i];
                            const href = link.href || "";
                            
                            if (href.startsWith(resumePrefix)) {
                                resumeLinks.push({
                                    url: href,
                                    text: link.textContent.trim() || `Iframe ${frameIndex+1} link`,
                                    element: link,
                                    source: "iframe-content"
                                });
                            }
                        }
                    } catch (e) {
                        console.log(`Error accessing links in iframe ${frameIndex}:`, e);
                    }
                });
            } catch (e) {
                console.log("Error accessing iframe contents:", e);
            }

            // If any resume link contains preview=true, convert it to preview=false
            resumeLinks.forEach(linkObj => {
                if (linkObj.url.includes('preview=true')) {
                    linkObj.url = linkObj.url.replace('preview=true', 'preview=false');
                }
            });
            
            // Filter out duplicate URLs by using a Set to track unique URLs
            const uniqueUrls = new Set();
            const uniqueResumeLinks = resumeLinks.filter(linkObj => {
                if (uniqueUrls.has(linkObj.url)) {
                    console.log(`Skipping duplicate URL: ${linkObj.url}`);
                    return false;
                }
                uniqueUrls.add(linkObj.url);
                return true;
            });

            // Display results
            console.log(`Found ${resumeLinks.length} resume links (${uniqueResumeLinks.length} unique) on this page:`);

            if (uniqueResumeLinks.length > 0) {
                uniqueResumeLinks.forEach((item, index) => {
                    console.log(`${index + 1}. ${item.text}:`);
                    console.log(`   ${item.url}`);
                    console.log(`   Source: ${item.source}`);
                });

                // Fetch PDFs from all unique links
                fetchPDFsFromLinks(uniqueResumeLinks, query);

                return uniqueResumeLinks;
            } else {
                console.log("No resume links found with the specified prefix.");
                showNotification("No resume links found with the specified prefix.");
                return [];
            }
        } catch (error) {
            console.error("Error in searchResumesOnPage:", error);
            showNotification("Error: " + error.message);
            return [];
        }
    }

    /**
     * Fetches PDFs from all resume links using fetch() API
     * @param {Array} links - Array of resume link objects
     * @param {string} query - Search query to send with PDFs
     */
    async function fetchPDFsFromLinks(links, query) {
        console.log(`Starting to fetch ${links.length} PDFs...`);
        console.log(`Search query: "${query}"`);
        
        // Create a status container to show progress on the page
        const statusContainer = createStatusContainer(links.length);
        
        // Array to collect all PDF blobs
        const pdfCollection = [];
        
        try {
            for (let i = 0; i < links.length; i++) {
                const link = links[i];
                try {
                    updateStatus(statusContainer, i, links.length, `Fetching: ${link.text}`, 'pending');
                    
                    // Use fetch() API to get the PDF content
                    const response = await fetch(link.url, {
                        method: 'GET',
                        credentials: 'include', // Important: includes cookies to maintain session
                        headers: {
                            'Accept': 'application/pdf'
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
                    }
                    
                    // Get the blob from the response
                    const pdfBlob = await response.blob();
                    
                    // Create a filename for the PDF
                    const filename = generateFilename(link.text, i);
                    
                    // Add to collection
                    pdfCollection.push({
                        blob: pdfBlob,
                        filename: filename,
                        text: link.text,
                        url: link.url
                    });
                    
                    updateStatus(statusContainer, i, links.length, 
                        `Processed: ${link.text} (${(pdfBlob.size / 1024).toFixed(2)} KB)`, 'success');
                    
                    // Short delay to prevent overwhelming the browser
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    console.error(`Error fetching PDF from ${link.url}:`, error);
                    updateStatus(statusContainer, i, links.length, 
                        `Failed: ${link.text} - ${error.message}`, 'error');
                }
            }
            
            updateStatus(statusContainer, links.length, links.length, 
                `Completed fetching ${links.length} PDFs`, 'complete');
                
            // Check if we have PDFs and a query to search with
            console.log(`Collection size: ${pdfCollection.length}, Query: "${query}"`);
            
            // If we have a query and PDFs, send them to the search endpoint
            if (query && pdfCollection.length > 0) {
                console.log("Sending PDFs to search endpoint...");
                // Add a small delay to ensure UI updates are complete
                setTimeout(async () => {
                    try {
                        await sendPDFsToSearchEndpoint(pdfCollection, query, statusContainer);
                    } catch (err) {
                        console.error("Error in delayed search call:", err);
                        updateStatus(statusContainer, 0, 1, `Search failed: ${err.message}`, 'error');
                    }
                }, 1000);
            } else {
                console.log("Not sending to search endpoint - missing query or no PDFs collected");
            }
        } catch (error) {
            console.error("Error in fetchPDFsFromLinks:", error);
            updateStatus(statusContainer, 0, links.length, 
                `Process failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Sends PDFs to the search endpoint
     * @param {Array} pdfCollection - Array of PDF objects
     * @param {string} query - Search query
     * @param {HTMLElement} statusContainer - Container for status updates
     */
    async function sendPDFsToSearchEndpoint(pdfCollection, query, statusContainer) {
        console.log(`sendPDFsToSearchEndpoint function called with query: "${query}"`);
        
        // Validate query again to be sure
        if (!query || query.trim() === '') {
            const errorMsg = "Cannot search with empty query";
            console.error(errorMsg);
            updateStatus(statusContainer, 0, 1, errorMsg, 'error');
            showNotification(errorMsg, 'error');
            return;
        }
        
        try {
            updateStatus(statusContainer, 0, 1, `Sending ${pdfCollection.length} PDFs to search service with query: "${query}"`, 'pending');
            
            // Create FormData to send files
            const formData = new FormData();
            formData.append('query', query);
            
            // Add all PDFs
            pdfCollection.forEach((pdf, index) => {
                console.log(`Adding PDF to form: ${pdf.filename} (${pdf.blob.size} bytes)`);
                formData.append(`pdf_${index}`, pdf.blob, pdf.filename);
            });
            
            
            console.log("FormData prepared, sending to search endpoint...");
            // Send to search endpoint
            const response = await fetch('http://localhost:8000/evaluate/', {
                method: 'POST',
                body: formData
            });
            
            console.log("Search response received:", response.status);
            
            if (!response.ok) {
                throw new Error(`Search service error: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log("Search results:", result);
            
            // Format result for display and storage
            const formattedResults = formatSearchResults(result, pdfCollection);
            
            // Update status with summary of matches
            const matchCount = countMatches(formattedResults.results);
            updateStatus(statusContainer, 1, 1, 
                `Search complete: ${matchCount} matches found for "${query}"`, 'success');
            
            // Open results in a new tab
            openResultsInNewTab(formattedResults);
            
        } catch (error) {
            console.error('Error sending PDFs to search endpoint:', error);
            updateStatus(statusContainer, 0, 1, `Search failed: ${error.message}`, 'error');
            
            // Show a more visible error notification
            showNotification(`Search failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Formats the search results into a structured object
     * @param {Object} rawResult - Raw result from the API
     * @param {Array} pdfCollection - Collection of PDF objects
     * @returns {Object} - Formatted search results
     */
    function formatSearchResults(rawResult, pdfCollection) {
        const formattedResult = {
            query: rawResult.query || searchQuery,
            timestamp: new Date().toISOString(),
            totalMatches: 0,
            results: []
        };
        
        // Process results (array of arrays with [id, yes/no, explanation])
        if (Array.isArray(rawResult.result)) {
            formattedResult.results = rawResult.result.map((item, index) => {
                const pdfId = item[0];
                const isMatch = item[1] === 'Yes' || item[1] === true || item[1] === 'yes';
                const explanation = item[2] || '';
                
                // Find the corresponding PDF in the collection
                const pdf = pdfCollection.find((p, idx) => idx === pdfId || p.filename.includes(pdfId));
                
                if (isMatch) {
                    formattedResult.totalMatches++;
                }
                
                return {
                    id: pdfId,
                    filename: pdf ? pdf.filename : `Resume ${pdfId}`,
                    isMatch: isMatch,
                    explanation: explanation,
                    snippet: extractSnippet(explanation),
                    score: isMatch ? 1 : 0
                };
            });
        }
        
        return formattedResult;
    }
    
    /**
     * Extracts a readable snippet from the explanation
     * @param {string} explanation - Explanation text
     * @returns {string} - Extracted snippet
     */
    function extractSnippet(explanation) {
        // If explanation is short enough, use it directly
        if (explanation.length < 300) {
            return explanation;
        }
        
        // Otherwise, extract a reasonable snippet
        // First try to find sentences with "because", "since", etc.
        const reasonSentences = explanation.match(/[^.!?]*(?:because|since|reason|qualified|experience|skill)[^.!?]*[.!?]/gi);
        if (reasonSentences && reasonSentences.length > 0) {
            return reasonSentences.slice(0, 2).join(' ');
        }
        
        // Fall back to the first few sentences
        const sentences = explanation.match(/[^.!?]*[.!?]/g);
        if (sentences && sentences.length > 0) {
            return sentences.slice(0, 3).join(' ');
        }
        
        // Last resort: just take the first 250 characters
        return explanation.substring(0, 250) + '...';
    }
    
    /**
     * Counts the number of positive matches in the results
     * @param {Array} results - Formatted results array
     * @returns {number} - Count of matches
     */
    function countMatches(results) {
        return results.filter(item => item.isMatch).length;
    }
    
    /**
     * Opens search results in a new tab
     * @param {Object} results - Search results
     */
    function openResultsInNewTab(results) {
        console.log("Opening results in new tab with data:", results);
        
        // First, ensure the background script is active by creating a connection
        const port = chrome.runtime.connect({name: "resultsConnection"});
        console.log("Connected to background script");
        
        // Store data in localStorage as a backup
        try {
            localStorage.setItem('tempSearchResults', JSON.stringify(results));
            console.log("Saved results to localStorage as backup");
        } catch (e) {
            console.log("Could not save to localStorage (not critical):", e);
        }
        
        // Send the results to the background script to open in a new tab
        try {
            console.log("Sending results to background script");
            chrome.runtime.sendMessage({
                action: 'openResultsTab',
                data: results
            }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error("Error sending message to background:", chrome.runtime.lastError);
                    console.log("Trying fallback method...");
                    fallbackOpenTab(results);
                } else if (response && response.success) {
                    console.log("Results tab created successfully via background script");
                } else {
                    console.log("No success in response, trying fallback...");
                    fallbackOpenTab(results);
                }
            });
        } catch (error) {
            console.error("Exception sending message to background:", error);
            fallbackOpenTab(results);
        }
    }
    
    /**
     * Fallback method to open the results tab
     * @param {Object} resultsData - Search results data
     */
    function fallbackOpenTab(resultsData) {
        console.log("Using fallback method to open results tab");
        
        try {
            // Store data in localStorage for the results page to retrieve
            localStorage.setItem('searchResults', JSON.stringify(resultsData));
            
            // Create a URL with the data as a parameter (for small datasets)
            let resultsUrl;
            
            // Try to use URL parameters if the data isn't too large
            if (JSON.stringify(resultsData).length < 2000) {
                const dataStr = encodeURIComponent(JSON.stringify(resultsData));
                resultsUrl = chrome.runtime.getURL(`search_results.html?data=${dataStr}`);
            } else {
                // Just open the page without parameters for large datasets
                resultsUrl = chrome.runtime.getURL('search_results.html');
            }
            
            // Try to create a new tab
            if (chrome.tabs && chrome.tabs.create) {
                chrome.tabs.create({ url: resultsUrl }, function(tab) {
                    console.log("Tab created directly via chrome.tabs API");
                });
                return;
            }
            
            // Last resort: try window.open
            const newWindow = window.open(resultsUrl, '_blank');
            if (!newWindow) {
                throw new Error("Failed to open results tab");
            }
        } catch (e) {
            console.error("All methods failed to open results tab:", e);
            showNotification("Failed to display search results. Check console for details.", 'error');
        }
    }
    
    /**
     * Creates a status container to show download progress
     * @param {number} totalLinks - Total number of links to process
     * @returns {HTMLElement} - The status container element
     */
    function createStatusContainer(totalLinks) {
        // Remove existing container if present
        const existingContainer = document.getElementById('pdf-download-status');
        if (existingContainer) {
            existingContainer.remove();
        }
        
        // Create container
        const container = document.createElement('div');
        container.id = 'pdf-download-status';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 320px;
            max-height: 450px;
            overflow-y: auto;
            background: #ffffff;
            border: none;
            border-radius: 8px;
            padding: 0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            transition: all 0.3s ease;
        `;
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            font-weight: bold;
            padding: 15px;
            background: #0e1b2a;
            color: white;
            border-radius: 8px 8px 0 0;
            margin-bottom: 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        const headerTitle = document.createElement('span');
        headerTitle.textContent = `Processing PDFs (0/${totalLinks})`;
        headerTitle.style.cssText = `
            flex-grow: 1;
        `;
        header.appendChild(headerTitle);
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;'; // × symbol
        closeBtn.style.cssText = `
            background: none;
            border: none;
            cursor: pointer;
            font-size: 22px;
            font-weight: bold;
            color: #ffffff;
            padding: 0 5px;
            margin-left: 10px;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            transition: background-color 0.2s;
        `;
        
        // Hover effect for close button
        closeBtn.addEventListener('mouseover', () => {
            closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        });
        
        closeBtn.addEventListener('mouseout', () => {
            closeBtn.style.backgroundColor = 'transparent';
        });
        
        closeBtn.onclick = () => {
            // Add fade out animation
            container.style.opacity = '0';
            container.style.transform = 'translateY(-20px)';
            
            // Remove after animation completes
            setTimeout(() => container.remove(), 300);
        };
        
        header.appendChild(closeBtn);
        container.appendChild(header);
        
        // Content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.style.cssText = `
            padding: 15px;
        `;
        container.appendChild(contentWrapper);
        
        // Status list
        const statusList = document.createElement('div');
        statusList.id = 'pdf-status-list';
        statusList.style.cssText = `
            max-height: 300px;
            overflow-y: auto;
            margin-bottom: 15px;
            padding-right: 5px;
        `;
        contentWrapper.appendChild(statusList);
        
        // Overall progress
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            margin-top: 15px;
            background-color: #f3f3f3;
            border-radius: 4px;
            height: 8px;
            overflow: hidden;
        `;
        
        const progressBar = document.createElement('div');
        progressBar.id = 'pdf-progress-bar';
        progressBar.style.cssText = `
            height: 100%;
            width: 0%;
            background-color: #4285f4;
            border-radius: 4px;
            transition: width 0.3s ease;
        `;
        
        progressContainer.appendChild(progressBar);
        contentWrapper.appendChild(progressContainer);
        
        // Add minimize/maximize button
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = 'Minimize';
        toggleBtn.style.cssText = `
            background: none;
            border: none;
            color: #0e1b2a;
            font-size: 12px;
            text-decoration: underline;
            cursor: pointer;
            padding: 5px 0;
            margin-top: 10px;
            text-align: center;
            width: 100%;
        `;
        
        let isMinimized = false;
        
        toggleBtn.onclick = () => {
            if (isMinimized) {
                statusList.style.display = 'block';
                toggleBtn.textContent = 'Minimize';
                isMinimized = false;
            } else {
                statusList.style.display = 'none';
                toggleBtn.textContent = 'Expand';
                isMinimized = true;
            }
        };
        
        contentWrapper.appendChild(toggleBtn);
        
        // Add to page with fade-in effect
        container.style.opacity = '0';
        container.style.transform = 'translateY(20px)';
        document.body.appendChild(container);
        
        // Trigger animation after element is added to DOM
        setTimeout(() => {
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        }, 10);
        
        return container;
    }
    
    /**
     * Updates the status display
     * @param {HTMLElement} container - The status container
     * @param {number} current - Current index
     * @param {number} total - Total items
     * @param {string} message - Status message
     * @param {string} status - Status type (pending, success, error, complete)
     */
    function updateStatus(container, current, total, message, status) {
        const statusList = container.querySelector('#pdf-status-list');
        const header = container.querySelector('div:first-child');
        const headerTitle = header.querySelector('span');
        const progressBar = container.querySelector('#pdf-progress-bar');
        
        // Update header
        headerTitle.textContent = `Processing PDFs (${current}/${total})`;
        
        // Update progress bar
        const percent = (current / total) * 100;
        progressBar.style.width = `${percent}%`;
        
        // Add status message
        const statusItem = document.createElement('div');
        statusItem.style.cssText = `
            padding: 8px 0;
            border-bottom: 1px solid #eee;
            font-size: 13px;
            line-height: 1.4;
        `;
        
        // Status icon and color
        let statusIcon = '●';
        let statusColor = '#333';
        switch(status) {
            case 'pending':
                statusColor = '#ff9800';
                statusIcon = '●';
                break;
            case 'success':
                statusColor = '#4caf50';
                statusIcon = '✓';
                break;
            case 'error':
                statusColor = '#f44336';
                statusIcon = '✗';
                break;
            case 'complete':
                statusColor = '#2196f3';
                statusIcon = '✓';
                break;
        }
        
        statusItem.innerHTML = `<span style="color:${statusColor}; margin-right: 6px;">${statusIcon}</span> ${message}`;
        
        // Add to the list
        statusList.appendChild(statusItem);
        
        // Scroll to the bottom to show latest status
        statusList.scrollTop = statusList.scrollHeight;
        
        // If complete, update the progress bar color
        if (status === 'complete') {
            progressBar.style.backgroundColor = '#4caf50';
        }
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
    
    /**
     * Generates a filename for the downloaded PDF
     * @param {string} linkText - Text of the link
     * @param {number} index - Index of the link
     * @returns {string} - The generated filename
     */
    function generateFilename(linkText, index) {
        // Clean the link text to create a filename
        let filename = linkText.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').toLowerCase();
        
        // Truncate if too long
        if (filename.length > 30) {
            filename = filename.substring(0, 30);
        }
        
        // Add timestamp to avoid duplicate filenames
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
        
        return `resume_${filename}_${timestamp}.pdf`;
    }

    // DO NOT automatically execute the search function when the script is loaded
    // Instead, wait for the message from the popup to trigger the search
    try {
        console.log("search_resumes_on_page.js loaded, waiting for messages");
        
        // Make the function available in the global scope for debugging
        window.searchResumesOnPage = searchResumesOnPage;
    } catch (error) {
        console.error("Error during content script initialization:", error);
        showNotification("Script initialization error: " + error.message, 'error');
    }
})();
