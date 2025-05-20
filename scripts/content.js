// Cache management
const CACHE_DURATION = 10 * 24 * 60 * 60 * 1000; // 10 days in milliseconds

async function getCachedEmoteText(emoteId, type) {
  const cacheKey = `${type}_${emoteId}`;
  const cached = await chrome.storage.local.get([cacheKey]);
  const cachedData = cached[cacheKey];

  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return cachedData.text;
  }
  return null;
}

async function cacheEmoteText(emoteId, type, text) {
  const cacheKey = `${type}_${emoteId}`;
  await chrome.storage.local.set({
    [cacheKey]: { text, timestamp: Date.now() }
  });
}

// Clean up expired cache entries
async function cleanupCache() {
  const allItems = await chrome.storage.local.get(null);
  const now = Date.now();
  const toRemove = [];
  for (const [key, value] of Object.entries(allItems)) {
    if (value.timestamp && now - value.timestamp >= CACHE_DURATION) {
      toRemove.push(key);
    }
  }
  if (toRemove.length) {
    await chrome.storage.local.remove(toRemove);
    console.log(`Cleaned up ${toRemove.length} expired cache entries`);
  }
}

// Get Emote-Keyword from 7TV-API with caching
async function get7TVEmoteText(emoteId) {
  const cached = await getCachedEmoteText(emoteId, '7tv');
  if (cached) return cached;

  try {
    const response = await fetch(`https://api.7tv.app/v3/emotes/${emoteId}`);
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.name;
    await cacheEmoteText(emoteId, '7tv', text);
    return text;
  } catch {
    return null;
  }
}

// Get Emote-Keyword from BTTV-API with caching
async function getBTTVEmoteText(emoteId) {
  const cached = await getCachedEmoteText(emoteId, 'bttv');
  if (cached) return cached;

  try {
    const response = await fetch(`https://api.betterttv.net/3/emotes/${emoteId}`);
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.code;
    await cacheEmoteText(emoteId, 'bttv', text);
    return text;
  } catch {
    return null;
  }
}

// Get Emote-Keyword from FFZ-API with caching
async function getFFZEmoteText(emoteId) {
  const cached = await getCachedEmoteText(emoteId, 'ffz');
  if (cached) return cached;

  try {
    const response = await fetch(`https://api.frankerfacez.com/v1/emote/${emoteId}`);
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.emote.name;
    await cacheEmoteText(emoteId, 'ffz', text);
    return text;
  } catch {
    return null;
  }
}

// Extract Emote-ID
function extractEmoteId(url) {
  const match7TV = url.match(/https:\/\/cdn\.7tv\.app\/emote\/([0-9A-Z]+)\/.*/);
  if (match7TV) return { type: '7tv', id: match7TV[1] };
  const matchBTTV = url.match(/https:\/\/cdn\.betterttv\.net\/emote\/([0-9a-f]+)\/.*/);
  if (matchBTTV) return { type: 'bttv', id: matchBTTV[1] };
  const matchFFZ = url.match(/https:\/\/cdn\.frankerfacez\.com\/emote\/([0-9]+)\/.*/);
  if (matchFFZ) return { type: 'ffz', id: matchFFZ[1] };
  return null;
}

// Visual Feedback
function addDragFeedback(element, add = true) {
  if (add) {
    element.style.border = '2px solid #00ff00';
    element.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
  } else {
    element.style.border = '';
    element.style.backgroundColor = '';
  }
}

// Insert Emote-Keyword
async function insertTextViaClipboard(element, text) {
  if (!element.isContentEditable) return;
  try {
    element.focus();
    const textWithSpace = text + ' ';
    await navigator.clipboard.writeText(textWithSpace);
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });
    pasteEvent.clipboardData.setData('text/plain', textWithSpace);
    element.dispatchEvent(pasteEvent);
  } catch {}
}

// Setup TextField Listeners with WeakMap for handlers
const handlerMap = new WeakMap();

function setupTextFieldListeners(textField, settings) {
  if (textField.dataset.dragListenersAdded) return;
  textField.dataset.dragListenersAdded = 'true';

  let dragEnterCount = 0;

  const dragEnterHandler = (event) => {
    if (!settings.enabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragEnterCount++;
    addDragFeedback(textField, true);
  };

  const dragLeaveHandler = (event) => {
    if (!settings.enabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragEnterCount--;
    if (dragEnterCount <= 0) {
      addDragFeedback(textField, false);
      dragEnterCount = 0;
    }
  };

  const dragOverHandler = (event) => {
    if (!settings.enabled) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  };

  const dropHandler = async (event) => {
  if (!settings.enabled) {
    addDragFeedback(textField, false);
    return;
  }

  const url = event.dataTransfer.getData('text') || event.dataTransfer.getData('text/plain');
  const emoteInfo = extractEmoteId(url);

  // Let through if not an emote
  if (!emoteInfo) {
    dragEnterCount = 0;
    addDragFeedback(textField, false);
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const { type, id } = emoteInfo;
  let emoteText = null;

  if (type === '7tv' && settings.enable7tv) {
    emoteText = await get7TVEmoteText(id);
  } else if (type === 'bttv' && settings.enableBttv) {
    emoteText = await getBTTVEmoteText(id);
  } else if (type === 'ffz' && settings.enableFfz) {
    emoteText = await getFFZEmoteText(id);
  }

  dragEnterCount = 0;
  addDragFeedback(textField, false);

  if (emoteText) {
    insertTextViaClipboard(textField, emoteText);
  }
};

  textField.addEventListener('dragenter', dragEnterHandler, true);
  textField.addEventListener('dragleave', dragLeaveHandler, true);
  textField.addEventListener('dragover', dragOverHandler, true);
  textField.addEventListener('drop', dropHandler, true);

  handlerMap.set(textField, {
    dragenter: dragEnterHandler,
    dragleave: dragLeaveHandler,
    dragover: dragOverHandler,
    drop: dropHandler
  });
}
// Remove existing event listeners
function removeDragListeners(textField) {
  const handlers = handlerMap.get(textField);
  if (!handlers) return;
  textField.removeEventListener('dragenter', handlers.dragenter, true);
  textField.removeEventListener('dragleave', handlers.dragleave, true);
  textField.removeEventListener('dragover', handlers.dragover, true);
  textField.removeEventListener('drop', handlers.drop, true);
  handlerMap.delete(textField);
  delete textField.dataset.dragListenersAdded;
}

// Initialize with settings
function initialize() {
  chrome.storage.sync.get(['enabled', 'enable7tv', 'enableBttv', 'enableFfz'], (data) => {
    const settings = {
      enabled: data.enabled !== false,
      enable7tv: data.enable7tv !== false,
      enableBttv: data.enableBttv !== false,
      enableFfz: data.enableFfz !== false
    };

    let observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (!mutation.addedNodes.length) continue;
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches('div[data-a-target="chat-input"]')) {
            setupTextFieldListeners(node, settings);
          }
          node.querySelectorAll('div[data-a-target="chat-input"]').forEach((el) => setupTextFieldListeners(el, settings));
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const textField = document.querySelector('div[data-a-target="chat-input"]');
    if (textField) setupTextFieldListeners(textField, settings);

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'updateSettings') {
        Object.assign(settings, message.settings);
        const textFields = document.querySelectorAll('div[data-a-target="chat-input"]');
        textFields.forEach((el) => {
          removeDragListeners(el);
          setupTextFieldListeners(el, settings);
        });
      }
    });

    // Clean up cache on initialization
    cleanupCache();
  });
}

// Start
initialize();
