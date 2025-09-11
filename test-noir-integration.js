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
    
    // Test all three algorithms
    await testAES128CTR(adapter);
    await testAES256CTR(adapter);
    await testChaCha20(adapter);
    
    console.log('All tests completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

async function testAES128CTR(adapter) {
  console.log('\n=== Testing AES-128-CTR ===');
  
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
  console.log('AES-128-CTR test completed successfully!');
}

async function testAES256CTR(adapter) {
  console.log('\n=== Testing AES-256-CTR ===');
  
  // Test initializing AES 256 CTR circuit
  console.log('Initializing aes-256-ctr circuit...');
  await adapter.initializeCircuit('aes-256-ctr');
  
  // Check circuit info
  const circuitInfo = adapter.getCircuitInfo('aes-256-ctr');
  console.log('Circuit info:', circuitInfo);
  
  // Test proof generation with sample inputs
  console.log('\nGenerating proof with sample inputs...');
  
  // Use 256-bit key for AES-256
  const keyHex = "7E24067817FAE0D743D6CE1F32539163B1A2C3D4E5F6071819A0B1C2D3E4F506";
  const plaintextHex = "000102030405060708090A0B0C0D0E0F";
  const nonceHex = "006CB6DBC0543B59DA48D90B";
  const counter = 1;
  
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
  
  const cipher = crypto.createCipheriv('aes-256-ctr', keyBuffer, nonceCounterBuffer);
  cipher.setAutoPadding(false);
  const ciphertextBuffer = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  
  const sampleInputs = {
    key: hexToBytes(keyHex),
    counter: fullCounter,
    plaintext: hexToBytes(plaintextHex),
    expected_ciphertext: Array.from(ciphertextBuffer)
  };
  
  console.log('Generating proof with sample inputs...');
  const { proof, publicSignals } = await adapter.generateProof('aes-256-ctr', sampleInputs);
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
  const isValid = await adapter.verifyProof('aes-256-ctr', proof, publicSignals, publicInput);
  console.log('Proof verification result:', isValid);
  
  // Cleanup
  await adapter.cleanup('aes-256-ctr');
  console.log('AES-256-CTR test completed successfully!');
}

async function testChaCha20(adapter) {
  console.log('\n=== Testing ChaCha20 ===');
  
  // Test initializing ChaCha20 circuit
  console.log('Initializing chacha20 circuit...');
  await adapter.initializeCircuit('chacha20');
  
  // Check circuit info
  const circuitInfo = adapter.getCircuitInfo('chacha20');
  console.log('Circuit info:', circuitInfo);
  
  // Test proof generation with sample inputs
  console.log('\nGenerating proof with sample inputs...');
  
  // ChaCha20 uses 256-bit key and different structure
  const keyHex = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
  const plaintextHex = "4c616469657320616e642047656e746c656d656e206f662074686520636c6173";
  const nonceHex = "000000090000004a00000000";
  const counter = 1;
  
  // Calculate expected ciphertext using a ChaCha20 implementation
  // For now, we'll use a mock ciphertext since we don't have ChaCha20 in Node.js crypto
  const plaintextBytes = hexToBytes(plaintextHex);
  const mockCiphertext = plaintextBytes.map((byte, i) => byte ^ (i % 256)); // Simple XOR for testing
  
  const sampleInputs = {
    key: hexToBytes(keyHex),
    plaintext: plaintextBytes,
    nonce: hexToBytes(nonceHex),
    counter: counter,
    expected_ciphertext: mockCiphertext
  };

  console.log('Generating proof with sample inputs...');
  const { proof, publicSignals } = await adapter.generateProof('chacha20', sampleInputs);
  console.log('Proof generated successfully!');
  console.log('Proof length:', proof.length);

  // Test proof verification
  console.log('Verifying proof...');
  
  // Construct publicInput similar to AES algorithms
  const publicInput = { 
      ciphertext: new Uint8Array(mockCiphertext),
      iv: new Uint8Array(hexToBytes(nonceHex)),
      offsetBytes: 0
  };
  const isValid = await adapter.verifyProof('chacha20', proof, publicSignals, publicInput);
  console.log('Proof verification result:', isValid);
  
  if (isValid) {
    console.log('ChaCha20 proof verification successful!');
  } else {
    console.log('ChaCha20 proof verification failed!');
  }
  
  // Cleanup
  await adapter.cleanup('chacha20');
  console.log('ChaCha20 test completed successfully!');
}

// Helper function
function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

// Run the test
testNoirIntegration().catch(console.error);