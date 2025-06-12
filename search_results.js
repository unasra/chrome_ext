document.addEventListener('DOMContentLoaded', function() {
    console.log("Search results page loaded, attempting to retrieve data");

    // Function to format timestamp
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    // Function to highlight query terms in snippet
    function highlightQuery(text, query) {
        console.log("Highlighting query terms in text:", text, "with query:", query);
        if (!query || !text) return text;

        // Split query into words
        const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);

        // Escape regex special characters
        const escapedWords = words.map(word =>
            word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );

        // Create regex pattern
        const pattern = new RegExp(`(${escapedWords.join('|')})`, 'gi');

        // Replace with highlighted span
        return text.replace(pattern, '<span class="highlight">$1</span>');
    }

    // Setup filter buttons
    function setupFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        const resultCards = document.querySelectorAll('.result-card');

        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                filterButtons.forEach(btn => btn.classList.remove('active'));

                // Add active class to clicked button
                this.classList.add('active');

                // Apply filter
                const filter = this.getAttribute('data-filter');

                resultCards.forEach(card => {
                    if (filter === 'all') {
                        card.style.display = 'block';
                    } else if (filter === 'match') {
                        card.style.display = card.getAttribute('data-match') === 'true' ? 'block' : 'none';
                    } else if (filter === 'no-match') {
                        card.style.display = card.getAttribute('data-match') === 'false' ? 'block' : 'none';
                    }
                });
            });
        });
    }

    // Function to process and display results
    function processResults(resultsData) {
        if (!resultsData) {
            console.error("No results data to process");
            showNoResultsMessage("No data received from search. Please try again.");
            return;
        }

        console.log("Processing results data:", resultsData);

        try {
            const { query, results, timestamp, totalMatches } = resultsData;

            // Update header information
            document.getElementById('query-info').textContent = `Query: "${query}" - ${totalMatches} matches found`;
            document.getElementById('timestamp').textContent = `Search performed: ${formatTimestamp(timestamp)}`;
            document.title = `Search Results: ${query}`;

            // Remove loading message
            const loadingMessage = document.getElementById('loading-message');
            if (loadingMessage) {
                loadingMessage.remove();
            }

            // Display results
            const resultsContainer = document.getElementById('results-container');

            if (results && results.length > 0) {
                results.forEach(result => {
                    const resultCard = document.createElement('div');
                    resultCard.className = `result-card ${result.isMatch ? 'match' : 'no-match'}`;
                    resultCard.setAttribute('data-match', result.isMatch ? 'true' : 'false');

                    // Highlight the query terms in the snippet
                    const highlightedSnippet = highlightQuery(result.snippet || 'No preview available', query);

                    resultCard.innerHTML = `
                            <div class="result-title">
                                ${result.filename || 'Untitled Resume'}
                                <span class="match-badge ${result.isMatch ? 'yes' : 'no'}">${result.isMatch ? 'Match' : 'No Match'}</span>
                            </div>
                            <div class="result-snippet">${highlightedSnippet}</div>
                            <div class="result-footer">
                                <button class="explanation-toggle">Show full explanation</button>
                                <span>ID: ${result.id}</span>
                            </div>
                            <div class="result-explanation" style="display:none">${result.explanation}</div>
                        `;

                    // Add event listener for the explanation toggle
                    resultsContainer.appendChild(resultCard);

                    const toggle = resultCard.querySelector('.explanation-toggle');
                    const explanation = resultCard.querySelector('.result-explanation');

                    toggle.addEventListener('click', function() {
                        const isHidden = explanation.style.display === 'none';
                        explanation.style.display = isHidden ? 'block' : 'none';
                        toggle.textContent = isHidden ? 'Hide full explanation' : 'Show full explanation';
                    });
                });

                // Setup filters
                setupFilters();
            } else {
                showNoResultsMessage(`No matches found for "${query}". Try a different search term.`);
            }
        } catch (error) {
            console.error('Error parsing search results:', error);
            showNoResultsMessage(`Error processing results: ${error.message}`);
        }
    }

    function showNoResultsMessage(message) {
        document.getElementById('query-info').textContent = 'No results available';
        document.getElementById('results-container').innerHTML = `
                <div class="no-results">
                    <p>${message}</p>
                </div>
            `;
    }
    
    // Try multiple methods to retrieve the data
    console.log("Attempting to retrieve data from chrome.storage.local");
    
    // Primary method: Get data from chrome.storage
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['searchResults'], function(data) {
            console.log("Chrome storage response received:", data);
            
            if (chrome.runtime.lastError) {
                console.error("Error retrieving data:", chrome.runtime.lastError);
            }
            
            if (data && data.searchResults) {
                console.log("Found data in chrome.storage.local");
                processResults(data.searchResults);
                
                // Clean up storage
                chrome.storage.local.remove('searchResults', function() {
                    console.log("Cleaned up chrome.storage.local");
                    if (chrome.runtime.lastError) {
                        console.error("Error cleaning storage:", chrome.runtime.lastError);
                    }
                });
            } else {
                console.log("No data found in chrome.storage.local, trying fallback methods");
                tryFallbackMethods();
            }
        });
    } else {
        console.error("chrome.storage.local not available");
        tryFallbackMethods();
    }
    
    function tryFallbackMethods() {
        // Fallback 1: URL parameters
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const dataParam = urlParams.get('data');
            if (dataParam) {
                console.log("Found data in URL parameters");
                const parsedData = JSON.parse(decodeURIComponent(dataParam));
                processResults(parsedData);
                return;
            }
        } catch (e) {
            console.error("Error parsing URL data:", e);
        }
        
        // Fallback 2: localStorage
        try {
            const localData = localStorage.getItem('searchResults') || 
                             localStorage.getItem('tempSearchResults');
            if (localData) {
                console.log("Found data in localStorage");
                const parsedData = JSON.parse(localData);
                processResults(parsedData);
                
                // Clean up localStorage
                localStorage.removeItem('searchResults');
                localStorage.removeItem('tempSearchResults');
                return;
            }
        } catch (e) {
            console.error("Error retrieving from localStorage:", e);
        }
        
        // If all methods failed
        showNoResultsMessage("Could not retrieve search results. Please try your search again.");
    }
});
