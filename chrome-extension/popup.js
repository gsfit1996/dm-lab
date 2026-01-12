// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const scrapeBtn = document.getElementById('scrape-btn');
    const pushBtn = document.getElementById('push-btn');
    const statusDiv = document.getElementById('status');

    scrapeBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: scrapeLinkedIn
        }, (results) => {
            if (results && results[0] && results[0].result) {
                const res = results[0].result;
                document.getElementById('conn-sent').textContent = res.connSent || 'N/A';
                document.getElementById('msg-sent').textContent = res.msgSent || 'N/A';

                if (res.connSent) document.getElementById('manual-conn').value = res.connSent;
                if (res.msgSent) document.getElementById('manual-perm').value = res.msgSent;
            }
        });
    });

    pushBtn.addEventListener('click', async () => {
        const apiUrl = document.getElementById('api-url').value;
        const payload = {
            date: new Date().toISOString().split('T')[0],
            connectionRequestsSent: Number(document.getElementById('manual-conn').value),
            permissionMessagesSent: Number(document.getElementById('manual-perm').value),
            bookedCalls: Number(document.getElementById('manual-booked').value),
            isOldLane: false,
            accountId: 'Account 1', // TODO: Make dynamic
            notes: "Imported via Extension"
        };

        try {
            statusDiv.textContent = "Pushing...";
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                statusDiv.textContent = "Success! Logged.";
                statusDiv.style.color = "#10b981";
            } else {
                throw new Error('API Error');
            }
        } catch (e) {
            statusDiv.textContent = "Failed. Is Localhost running?";
            statusDiv.style.color = "#ef4444";
        }
    });
});

function scrapeLinkedIn() {
    // This runs in the context of the page
    // Placeholder logic - LinkedIn obfuscates classes so simple selectors might fail.
    // In a real app we'd need robust selectors or API interception.

    // Example: Looking for "Connection requests sent" text or counting elements
    // This is just a dummy return for the PoC
    return {
        connSent: Math.floor(Math.random() * 10),
        msgSent: Math.floor(Math.random() * 20)
    };
}
