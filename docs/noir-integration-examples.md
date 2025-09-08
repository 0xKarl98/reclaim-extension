# Noir Circuit Integration Examples

This document provides comprehensive examples of how to integrate and use Noir circuits within the Reclaim Chrome extension.

## Table of Contents

1. [Basic Setup](#basic-setup)
2. [Message Flow Examples](#message-flow-examples)
3. [Error Handling](#error-handling)
4. [Advanced Usage](#advanced-usage)
5. [Testing Examples](#testing-examples)

## Basic Setup

### 1. Circuit Initialization

Before using any Noir circuit, it must be initialized with the appropriate bytecode:

```javascript
// In offscreen.js or any context where noirAdapter is available
import { noirAdapter } from '../utils/noir-adapter';

// Load circuit bytecode (typically done during extension startup)
const circuitBytecode = await fetch(chrome.runtime.getURL('circuits/noir/aes-gcm.json'))
  .then(response => response.json());

// Initialize the circuit
await noirAdapter.initializeCircuit('aes-gcm', circuitBytecode);
```

### 2. Extension Manifest Configuration

Ensure your `manifest.json` includes the necessary permissions and resources:

```json
{
  "manifest_version": 3,
  "permissions": [
    "offscreen",
    "storage",
    "activeTab"
  ],
  "web_accessible_resources": [
    {
      "resources": ["circuits/noir/*.json"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

## Message Flow Examples

### 1. Content Script to Background Script

```javascript
// content-script.js
// Trigger Noir proof generation from a content script

function generateProofForEncryptedData(encryptedData, key, iv, tag, expectedHash) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'GENERATE_NOIR_PROOF',
      source: 'CONTENT',
      target: 'BACKGROUND',
      data: {
        circuitName: 'aes-gcm',
        inputs: {
          encryptedData: Array.from(encryptedData),
          key: Array.from(key),
          iv: Array.from(iv),
          tag: Array.from(tag),
          expectedPlaintextHash: Array.from(expectedHash)
        },
        sessionId: 'session-' + Date.now()
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (response.received) {
        console.log('Proof generation request received');
        // Listen for the actual proof response
        const messageListener = (message) => {
          if (message.action === 'GENERATE_NOIR_PROOF_RESPONSE') {
            chrome.runtime.onMessage.removeListener(messageListener);
            if (message.success) {
              resolve(message.proof);
            } else {
              reject(new Error(message.error));
            }
          }
        };
        chrome.runtime.onMessage.addListener(messageListener);
      } else {
        reject(new Error('Failed to initiate proof generation'));
      }
    });
  });
}

// Usage example
async function handleEncryptedResponse(responseData) {
  try {
    const encryptedData = new Uint8Array(responseData.encrypted);
    const key = new Uint8Array(responseData.key);
    const iv = new Uint8Array(responseData.iv);
    const tag = new Uint8Array(responseData.tag);
    const expectedHash = new Uint8Array(responseData.expectedHash);
    
    const proof = await generateProofForEncryptedData(
      encryptedData, key, iv, tag, expectedHash
    );
    
    console.log('Proof generated successfully:', proof);
    // Use the proof for verification or submission
    
  } catch (error) {
    console.error('Proof generation failed:', error);
  }
}
```

### 2. Background Script Message Handling

```javascript
// background.js
import { MESSAGE_ACTIONS, MESSAGE_SOURCES } from '../utils/constants';
import { OffscreenManager } from '../utils/offscreen-manager';

class BackgroundMessageHandler {
  constructor() {
    this.offscreenManager = new OffscreenManager();
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  async handleMessage(message, sender, sendResponse) {
    const { action, source, target, data } = message;

    if (target !== MESSAGE_SOURCES.BACKGROUND) return;

    switch (action) {
      case MESSAGE_ACTIONS.GENERATE_NOIR_PROOF:
        await this.handleNoirProofGeneration(message, sender);
        sendResponse({ received: true });
        break;

      case MESSAGE_ACTIONS.GENERATE_NOIR_PROOF_RESPONSE:
        // Forward response back to the original requester
        this.forwardProofResponse(message, sender);
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }

    return true;
  }

  async handleNoirProofGeneration(message, sender) {
    try {
      // Ensure offscreen document is ready
      await this.offscreenManager.ensureOffscreenDocument();
      
      // Forward message to offscreen document
      chrome.runtime.sendMessage({
        action: MESSAGE_ACTIONS.GENERATE_NOIR_PROOF,
        source: MESSAGE_SOURCES.BACKGROUND,
        target: MESSAGE_SOURCES.OFFSCREEN,
        data: message.data
      });
      
    } catch (error) {
      console.error('Failed to handle Noir proof generation:', error);
      // Send error response back to sender
      chrome.tabs.sendMessage(sender.tab?.id, {
        action: MESSAGE_ACTIONS.GENERATE_NOIR_PROOF_RESPONSE,
        success: false,
        error: error.message
      });
    }
  }

  forwardProofResponse(message, sender) {
    // Forward the proof response to all content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore errors for tabs that don't have content scripts
          });
        }
      });
    });
  }
}

new BackgroundMessageHandler();
```

## Error Handling

### 1. Circuit Initialization Errors

```javascript
// utils/noir-circuit-manager.js
class NoirCircuitManager {
  async initializeCircuitSafely(circuitName, bytecode) {
    try {
      await noirAdapter.initializeCircuit(circuitName, bytecode);
      console.log(`Circuit ${circuitName} initialized successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to initialize circuit ${circuitName}:`, error);
      
      // Handle specific error types
      if (error.message.includes('WebAssembly')) {
        throw new Error('WebAssembly not supported in this environment');
      } else if (error.message.includes('bytecode')) {
        throw new Error('Invalid circuit bytecode provided');
      } else {
        throw new Error(`Circuit initialization failed: ${error.message}`);
      }
    }
  }

  async generateProofWithRetry(circuitName, inputs, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await noirAdapter.generateProof(circuitName, inputs);
      } catch (error) {
        lastError = error;
        console.warn(`Proof generation attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    throw new Error(`Proof generation failed after ${maxRetries} attempts: ${lastError.message}`);
  }
}
```

### 2. Input Validation

```javascript
// utils/noir-input-validator.js
class NoirInputValidator {
  static validateAESGCMInputs(inputs) {
    const required = ['encryptedData', 'key', 'iv', 'tag', 'expectedPlaintextHash'];
    const errors = [];
    
    for (const field of required) {
      if (!inputs[field]) {
        errors.push(`Missing required field: ${field}`);
        continue;
      }
      
      if (!(inputs[field] instanceof Uint8Array) && !Array.isArray(inputs[field])) {
        errors.push(`Field ${field} must be Uint8Array or Array`);
        continue;
      }
      
      // Validate specific field lengths
      switch (field) {
        case 'key':
          if (inputs[field].length !== 32) {
            errors.push('AES key must be 32 bytes (256 bits)');
          }
          break;
        case 'iv':
          if (inputs[field].length !== 12) {
            errors.push('GCM IV must be 12 bytes');
          }
          break;
        case 'tag':
          if (inputs[field].length !== 16) {
            errors.push('GCM tag must be 16 bytes');
          }
          break;
        case 'expectedPlaintextHash':
          if (inputs[field].length !== 32) {
            errors.push('Expected plaintext hash must be 32 bytes (SHA-256)');
          }
          break;
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Input validation failed: ${errors.join(', ')}`);
    }
    
    return true;
  }
}
```

## Advanced Usage

### 1. Circuit Performance Monitoring

```javascript
// utils/noir-performance-monitor.js
class NoirPerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  async measureProofGeneration(circuitName, inputs, generator) {
    const startTime = performance.now();
    const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    try {
      const result = await generator();
      const endTime = performance.now();
      const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      
      const metrics = {
        circuitName,
        duration: endTime - startTime,
        memoryDelta: endMemory - startMemory,
        timestamp: new Date().toISOString(),
        success: true
      };
      
      this.recordMetrics(metrics);
      console.log(`Proof generation metrics for ${circuitName}:`, metrics);
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      
      const metrics = {
        circuitName,
        duration: endTime - startTime,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      };
      
      this.recordMetrics(metrics);
      throw error;
    }
  }

  recordMetrics(metrics) {
    const circuitMetrics = this.metrics.get(metrics.circuitName) || [];
    circuitMetrics.push(metrics);
    
    // Keep only last 100 measurements per circuit
    if (circuitMetrics.length > 100) {
      circuitMetrics.shift();
    }
    
    this.metrics.set(metrics.circuitName, circuitMetrics);
  }

  getAveragePerformance(circuitName) {
    const metrics = this.metrics.get(circuitName) || [];
    const successfulMetrics = metrics.filter(m => m.success);
    
    if (successfulMetrics.length === 0) {
      return null;
    }
    
    const avgDuration = successfulMetrics.reduce((sum, m) => sum + m.duration, 0) / successfulMetrics.length;
    const avgMemory = successfulMetrics.reduce((sum, m) => sum + (m.memoryDelta || 0), 0) / successfulMetrics.length;
    
    return {
      averageDuration: avgDuration,
      averageMemoryDelta: avgMemory,
      successRate: successfulMetrics.length / metrics.length,
      totalMeasurements: metrics.length
    };
  }
}

// Usage
const performanceMonitor = new NoirPerformanceMonitor();

async function generateProofWithMonitoring(circuitName, inputs) {
  return await performanceMonitor.measureProofGeneration(
    circuitName,
    inputs,
    () => noirAdapter.generateProof(circuitName, inputs)
  );
}
```

### 2. Circuit Caching Strategy

```javascript
// utils/noir-circuit-cache.js
class NoirCircuitCache {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 5; // Maximum number of circuits to keep in memory
  }

  async getOrInitializeCircuit(circuitName, bytecodeLoader) {
    if (this.cache.has(circuitName)) {
      console.log(`Using cached circuit: ${circuitName}`);
      return this.cache.get(circuitName);
    }

    console.log(`Initializing new circuit: ${circuitName}`);
    
    // Load bytecode
    const bytecode = await bytecodeLoader();
    
    // Initialize circuit
    await noirAdapter.initializeCircuit(circuitName, bytecode);
    
    // Cache the circuit info
    const circuitInfo = {
      name: circuitName,
      bytecode,
      initialized: true,
      lastUsed: Date.now()
    };
    
    this.addToCache(circuitName, circuitInfo);
    return circuitInfo;
  }

  addToCache(circuitName, circuitInfo) {
    // Remove oldest circuit if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestCircuit = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.lastUsed - b.lastUsed)[0];
      
      console.log(`Evicting circuit from cache: ${oldestCircuit[0]}`);
      this.cache.delete(oldestCircuit[0]);
    }
    
    this.cache.set(circuitName, circuitInfo);
  }

  updateLastUsed(circuitName) {
    const circuitInfo = this.cache.get(circuitName);
    if (circuitInfo) {
      circuitInfo.lastUsed = Date.now();
    }
  }

  clearCache() {
    this.cache.clear();
  }
}
```

## Testing Examples

### 1. Unit Test for Noir Integration

```javascript
// tests/noir-integration.test.js
import { noirAdapter } from '../src/utils/noir-adapter';
import { NoirInputValidator } from '../src/utils/noir-input-validator';

describe('Noir Circuit Integration', () => {
  const mockCircuitBytecode = {
    bytecode: 'mock-bytecode-data',
    abi: {
      parameters: [
        { name: 'encryptedData', type: '[u8; N]' },
        { name: 'key', type: '[u8; 32]' },
        { name: 'iv', type: '[u8; 12]' },
        { name: 'tag', type: '[u8; 16]' },
        { name: 'expectedPlaintextHash', type: '[u8; 32]' }
      ]
    }
  };

  const validInputs = {
    encryptedData: new Uint8Array(64).fill(1),
    key: new Uint8Array(32).fill(2),
    iv: new Uint8Array(12).fill(3),
    tag: new Uint8Array(16).fill(4),
    expectedPlaintextHash: new Uint8Array(32).fill(5)
  };

  beforeEach(() => {
    // Reset adapter state
    noirAdapter.circuits.clear();
  });

  test('should initialize circuit successfully', async () => {
    await expect(
      noirAdapter.initializeCircuit('test-circuit', mockCircuitBytecode)
    ).resolves.not.toThrow();
    
    expect(noirAdapter.circuits.has('test-circuit')).toBe(true);
  });

  test('should validate inputs correctly', () => {
    expect(() => {
      NoirInputValidator.validateAESGCMInputs(validInputs);
    }).not.toThrow();
  });

  test('should reject invalid inputs', () => {
    const invalidInputs = { ...validInputs, key: new Uint8Array(16) }; // Wrong key length
    
    expect(() => {
      NoirInputValidator.validateAESGCMInputs(invalidInputs);
    }).toThrow('AES key must be 32 bytes');
  });

  test('should generate proof with valid inputs', async () => {
    // Mock the actual proof generation
    const mockProof = {
      proof: new Uint8Array([1, 2, 3, 4]),
      publicInputs: [new Uint8Array([5, 6, 7, 8])]
    };
    
    jest.spyOn(noirAdapter, 'generateProof').mockResolvedValue(mockProof);
    
    await noirAdapter.initializeCircuit('test-circuit', mockCircuitBytecode);
    const result = await noirAdapter.generateProof('test-circuit', validInputs);
    
    expect(result).toEqual(mockProof);
  });
});
```

### 2. Integration Test for Chrome Extension

```javascript
// tests/chrome-extension-integration.test.js
import { OffscreenProofGenerator } from '../src/offscreen/offscreen';
import { MESSAGE_ACTIONS, MESSAGE_SOURCES } from '../src/utils/constants';

// Mock Chrome APIs
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn()
  }
};

describe('Chrome Extension Noir Integration', () => {
  let proofGenerator;
  let messageHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    proofGenerator = new OffscreenProofGenerator();
    
    // Capture the message handler
    messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
  });

  test('should handle GENERATE_NOIR_PROOF message', async () => {
    const mockMessage = {
      action: MESSAGE_ACTIONS.GENERATE_NOIR_PROOF,
      source: MESSAGE_SOURCES.BACKGROUND,
      target: MESSAGE_SOURCES.OFFSCREEN,
      data: {
        circuitName: 'aes-gcm',
        inputs: {
          encryptedData: Array.from(new Uint8Array(64).fill(1)),
          key: Array.from(new Uint8Array(32).fill(2)),
          iv: Array.from(new Uint8Array(12).fill(3)),
          tag: Array.from(new Uint8Array(16).fill(4)),
          expectedPlaintextHash: Array.from(new Uint8Array(32).fill(5))
        }
      }
    };

    const mockSender = {};
    const mockSendResponse = jest.fn();

    // Mock successful proof generation
    const mockProof = { proof: new Uint8Array([1, 2, 3, 4]) };
    jest.spyOn(proofGenerator, 'generateNoirProof').mockResolvedValue(mockProof);

    // Handle the message
    const result = messageHandler(mockMessage, mockSender, mockSendResponse);

    expect(result).toBe(true);
    expect(mockSendResponse).toHaveBeenCalledWith({ received: true });
    
    // Wait for async operation to complete
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: MESSAGE_ACTIONS.GENERATE_NOIR_PROOF_RESPONSE,
      source: MESSAGE_SOURCES.OFFSCREEN,
      target: MESSAGE_SOURCES.BACKGROUND,
      success: true,
      proof: mockProof
    });
  });

  test('should handle proof generation errors', async () => {
    const mockMessage = {
      action: MESSAGE_ACTIONS.GENERATE_NOIR_PROOF,
      source: MESSAGE_SOURCES.BACKGROUND,
      target: MESSAGE_SOURCES.OFFSCREEN,
      data: {
        circuitName: 'invalid-circuit',
        inputs: {}
      }
    };

    const mockSender = {};
    const mockSendResponse = jest.fn();

    // Mock failed proof generation
    jest.spyOn(proofGenerator, 'generateNoirProof')
      .mockRejectedValue(new Error('Circuit not found'));

    // Handle the message
    messageHandler(mockMessage, mockSender, mockSendResponse);

    // Wait for async operation to complete
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: MESSAGE_ACTIONS.GENERATE_NOIR_PROOF_RESPONSE,
      source: MESSAGE_SOURCES.OFFSCREEN,
      target: MESSAGE_SOURCES.BACKGROUND,
      success: false,
      error: 'Circuit not found'
    });
  });
});
```

This comprehensive guide provides practical examples for integrating Noir circuits into the Reclaim Chrome extension, covering everything from basic setup to advanced performance monitoring and testing strategies.