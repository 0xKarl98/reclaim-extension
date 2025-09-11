// Noir circuit adapter for zk-symmetric-crypto integration
// Uses barretenberg operator for proof generation and verification

import fs from 'fs';

import { debugLogger, DebugLogType } from './logger/debugLogger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateProof as pkgGenerateProof, verifyProof as pkgVerifyProof, makeSnarkJsZKOperator } from 'zk-symmetric-crypto-test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class NoirCircuitAdapter {
  constructor() {
    this.circuits = new Map();
    this.backends = new Map();
    this.operators = new Map();
    this.circuitPath = path.join(__dirname, '../circuits/compiled');
  }

  /**
   * Initialize a Noir circuit from compiled JSON file
   * @param {string} circuitName - Name of the circuit (algorithm name like 'aes-128-ctr')
   * @returns {Promise<void>}
   */
  async initializeCircuit(circuitName) {
    try {
      debugLogger.log(DebugLogType.OFFSCREEN, `Initializing Noir circuit: ${circuitName}`);
      
      // Map algorithm name to file name
      const fileNameMap = {
        'aes-128-ctr': 'aes_128_ctr.json',
        'aes-256-ctr': 'aes_256_ctr.json',
        'chacha20': 'chacha20.json'
      };
      
      const fileName = fileNameMap[circuitName];
      if (!fileName) {
        throw new Error(`Unknown circuit algorithm: ${circuitName}`);
      }
      
      // Load circuit from compiled JSON file
      const circuitFile = path.join(this.circuitPath, fileName);
      if (!fs.existsSync(circuitFile)) {
        throw new Error(`Circuit file not found: ${circuitFile}`);
      }
      
      const circuitData = JSON.parse(fs.readFileSync(circuitFile, 'utf8'));
      this.circuits.set(circuitName, circuitData);
      
      // Create operator with file fetcher
      const fetcher = {
        fetch: async (backend, filename, logger) => {
          // Map to correct resource path
          const resourcePath = path.join(__dirname, '../../public/browser-rpc/resources', backend, filename);
          return fs.readFileSync(resourcePath);
        }
      };
      
      const operator = makeSnarkJsZKOperator({
        algorithm: circuitName,
        fetcher,
        options: { threads: 1 }
      });
      
      this.operators.set(circuitName, operator);
      
      debugLogger.log(DebugLogType.OFFSCREEN, `Circuit ${circuitName} initialized successfully`);
      return true;
    } catch (error) {
      debugLogger.error(DebugLogType.OFFSCREEN, `Failed to initialize circuit ${circuitName}:`, error);
      throw error;
    }
  }

  /**
   * Generate proof using Noir circuit
   * @param {string} circuitName - Name of the circuit to use
   * @param {Object} inputs - Circuit inputs
   * @returns {Object} Proof object compatible with existing interface
   */
  async generateProof(circuitName, inputs) {
    try {
      const operator = this.operators.get(circuitName);
      if (!operator) {
        throw new Error(`Circuit ${circuitName} not initialized`);
      }

      debugLogger.log(DebugLogType.OFFSCREEN, `Generating proof for circuit: ${circuitName}`);
      const algorithm = circuitName;
      
      let nonce, counterValue;
      
      if (circuitName === 'chacha20') {
        // ChaCha20 has separate nonce and counter inputs
        nonce = new Uint8Array(inputs.nonce);
        counterValue = inputs.counter;
      } else {
        // AES algorithms use combined counter array
        // Extract nonce (first 12 bytes) and counter (last 4 bytes) from inputs.counter
        const counterArray = inputs.counter;
        nonce = new Uint8Array(counterArray.slice(0, 12));
        counterValue = (counterArray[12] << 24) | (counterArray[13] << 16) | (counterArray[14] << 8) | counterArray[15];
      }
      
      const privateInput = {
        key: new Uint8Array(inputs.key)
      };
      const publicInput = { 
        ciphertext: new Uint8Array(inputs.expected_ciphertext),
        iv: nonce,
        offsetBytes: 0
      };
      const {algorithm: resultAlgorithm, proofData, plaintext} = await pkgGenerateProof({
        algorithm,
        privateInput,
        publicInput,
        operator
      });
      return {
        proof: proofData,
        publicSignals: plaintext,
        circuitType: 'noir',
        circuitName: circuitName,
        timestamp: Date.now()
      };
    } catch (error) {
      debugLogger.error(DebugLogType.OFFSCREEN, `Failed to generate proof for circuit ${circuitName}:`, error);
      throw error;
    }
  }

  /**
   * Verify a proof
   * @param {string} circuitName - Name of the circuit
   * @param {Uint8Array} proof - Proof to verify
   * @param {Array} publicInputs - Public inputs
   * @returns {boolean} Verification result
   */
  async verifyProof(circuitName, proof, publicSignals, publicInput) {
    try {
      const operator = this.operators.get(circuitName);
      if (!operator) {
        throw new Error(`Circuit ${circuitName} not initialized`);
      }
      debugLogger.log(DebugLogType.OFFSCREEN, `Verifying proof for circuit: ${circuitName}`);
      const algorithm = circuitName;
      await pkgVerifyProof({
        proof: {
          proofData: proof,
          plaintext: publicSignals,
          algorithm
        },
        publicInput,
        operator
      });
      // pkgVerifyProof doesn't return a value, it throws on failure
      debugLogger.log(DebugLogType.OFFSCREEN, `Proof verification result for ${circuitName}: true`);
      return true;
    } catch (error) {
      debugLogger.error(DebugLogType.OFFSCREEN, `Failed to verify proof for circuit ${circuitName}:`, error);
      return false;
    }
  }

  /**
   * Get circuit information
   * @param {string} circuitName - Name of the circuit
   * @returns {Object} Circuit information
   */
  getCircuitInfo(circuitName) {
    const operator = this.operators.get(circuitName);
    if (!operator) {
      return null;
    }

    return {
      name: circuitName,
      type: 'noir',
      initialized: true,
      backend: 'ultrahonk'
    };
  }

  /**
   * List all initialized circuits
   * @returns {Array} List of circuit names
   */
  listCircuits() {
    return Array.from(this.operators.keys());
  }

  /**
   * Clean up resources for a circuit
   * @param {string} circuitName - Name of the circuit to cleanup
   */
  async cleanup(circuitName) {
    try {
      this.operators.delete(circuitName);
      this.circuits.delete(circuitName);
      this.backends.delete(circuitName);
      
      debugLogger.log(DebugLogType.OFFSCREEN, `Cleaned up circuit: ${circuitName}`);
    } catch (error) {
      debugLogger.error(DebugLogType.OFFSCREEN, `Failed to cleanup circuit ${circuitName}:`, error);
    }
  }

  /**
   * Clean up all circuits
   */
  async cleanupAll() {
    const circuitNames = this.listCircuits();
    for (const name of circuitNames) {
      await this.cleanup(name);
    }
  }

  /**
   * Get available circuit types
   * @returns {Array} List of available circuit types
   */
  getAvailableCircuits() {
    const circuitFiles = fs.readdirSync(this.circuitPath)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
    return circuitFiles;
  }
}

// Export singleton instance
export const noirAdapter = new NoirCircuitAdapter();
export default NoirCircuitAdapter;
export { NoirCircuitAdapter };