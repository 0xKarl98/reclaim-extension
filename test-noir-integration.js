// Test script for Noir circuit integration
// Tests the new zk-symmetric-crypto barretenberg operator integration

import { NoirCircuitAdapter } from './src/utils/noir-adapter.js';
import { debugLogger, DebugLogType } from './src/utils/logger/debugLogger.js';

async function testNoirIntegration() {
  console.log('Starting Noir integration test...');
  
  try {
    // Initialize the adapter
    const adapter = new NoirCircuitAdapter();
    
    // Test getting available circuits
    console.log('Available circuits:', adapter.getAvailableCircuits());
    
    // Test initializing AES 128 CTR circuit
    console.log('Initializing aes-128-ctr circuit...');
    await adapter.initializeCircuit('aes-128-ctr');
    
    // Check circuit info
    const circuitInfo = adapter.getCircuitInfo('aes-128-ctr');
    console.log('Circuit info:', circuitInfo);
    
    // Test proof generation with sample inputs
    console.log('\nGenerating proof with sample inputs...');
    
    // Use real test vectors from zk-symmetric-crypto project
    const keyHex = "7E24067817FAE0D743D6CE1F32539163";
    const plaintextHex = "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F000102030405060708090A0B0C0D0E0F101112131415161718191A10A0B0C0D0E0F10111213141516171819B1C1D1E1F";
    const nonceHex = "006CB6DBC0543B59DA48D90B";
    const counter = 1;
    
    // Convert hex strings to byte arrays
    function hexToBytes(hex) {
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
      }
      return bytes;
    }
    
    // Create 128-bit counter from nonce (96 bits) + counter (32 bits)
    const nonceBytes = hexToBytes(nonceHex);
    const fullCounter = new Array(16).fill(0);
    
    // Copy nonce to first 12 bytes
    for (let i = 0; i < 12; i++) {
      fullCounter[i] = nonceBytes[i];
    }
    
    // Set counter in big-endian format in last 4 bytes
    fullCounter[12] = (counter >>> 24) & 0xFF;
    fullCounter[13] = (counter >>> 16) & 0xFF;
    fullCounter[14] = (counter >>> 8) & 0xFF;
    fullCounter[15] = counter & 0xFF;
    
    // Calculate expected ciphertext using Node.js crypto
     const crypto = await import('crypto');
    const keyBuffer = Buffer.from(keyHex, 'hex');
    const nonceCounterBuffer = Buffer.concat([
      Buffer.from(nonceHex, 'hex'),
      Buffer.from([0, 0, 0, counter])
    ]);
    const plaintextBuffer = Buffer.from(plaintextHex, 'hex');
    
    const cipher = crypto.createCipheriv('aes-128-ctr', keyBuffer, nonceCounterBuffer);
    cipher.setAutoPadding(false);
    const ciphertextBuffer = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    
    const sampleInputs = {
      key: hexToBytes(keyHex),
      counter: fullCounter,
      plaintext: hexToBytes(plaintextHex),
      expected_ciphertext: Array.from(ciphertextBuffer)
    };
    
    console.log('Generating proof with sample inputs...');
    const { proof, publicSignals } = await adapter.generateProof('aes-128-ctr', sampleInputs);
    console.log('Proof generated successfully!');
    console.log('Proof length:', proof.length);
    
    // Test proof verification
    console.log('Verifying proof...');
    const counterArray = sampleInputs.counter;
    const nonce = new Uint8Array(counterArray.slice(0, 12));
    const publicInput = { 
        ciphertext: new Uint8Array(sampleInputs.expected_ciphertext),
        iv: nonce,
        offsetBytes: 0
    };
    const isValid = await adapter.verifyProof('aes-128-ctr', proof, publicSignals, publicInput);
    console.log('Proof verification result:', isValid);
    
    // Cleanup
    await adapter.cleanup('aes-128-ctr');
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testNoirIntegration().catch(console.error);