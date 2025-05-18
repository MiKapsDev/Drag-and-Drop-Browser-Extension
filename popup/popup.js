// Load saved settings and apply i18n manually if needed
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    // Apply i18n messages manually if not already applied
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach((el) => {
      const messageKey = el.getAttribute('data-i18n');
      const message = chrome.i18n.getMessage(messageKey);
      if (message) {
        el.textContent = message;
      } else {
        console.warn(`i18n message not found for key: ${messageKey}`);
      }
    });

    // Load settings
    chrome.storage.sync.get(['enabled', 'enable7tv', 'enableBttv', 'enableFfz'], (data) => {
      document.getElementById('enabled').checked = data.enabled !== false;
      document.getElementById('enable7tv').checked = data.enable7tv !== false;
      document.getElementById('enableBttv').checked = data.enableBttv !== false;
      document.getElementById('enableFfz').checked = data.enableFfz !== false;
    });
  }, 200);
});

// Save settings and notify content script
document.getElementById('save').addEventListener('click', () => {
  const settings = {
    enabled: document.getElementById('enabled').checked,
    enable7tv: document.getElementById('enable7tv').checked,
    enableBttv: document.getElementById('enableBttv').checked,
    enableFfz: document.getElementById('enableFfz').checked
  };
  chrome.storage.sync.set(settings, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'updateSettings', settings });
      }
    });
    window.close();
  });
});