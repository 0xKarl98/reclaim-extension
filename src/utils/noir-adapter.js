// Noir Circuit Adapter for Reclaim Extension
// Provides compatibility layer between Noir circuits and existing proof generation interface

import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { debugLogger, DebugLogType } from './logger';

class NoirCircuitAdapter {
  constructor() {
    this.circuits = new Map();
    this.backends = new Map();
  }

  /**
   * Initialize a Noir circuit
   * @param {string} circuitName - Name of the circuit
   * @param {Uint8Array} circuitBytecode - Compiled circuit bytecode
   */
  async initializeCircuit(circuitName, circuitBytecode) {
    try {
      debugLogger.log(DebugLogType.OFFSCREEN, `Initializing Noir circuit: ${circuitName}`);
      
      const backend = new BarretenbergBackend(circuitBytecode);
      const noir = new Noir(circuitBytecode, backend);
      
      this.circuits.set(circuitName, noir);
      this.backends.set(circuitName, backend);
      
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
      const noir = this.circuits.get(circuitName);
      if (!noir) {
        throw new Error(`Circuit ${circuitName} not initialized`);
      }

      debugLogger.log(DebugLogType.OFFSCREEN, `Generating proof for circuit: ${circuitName}`);
      
      // Generate witness
      const { witness } = await noir.execute(inputs);
      
      // Generate proof
      const backend = this.backends.get(circuitName);
      const proof = await backend.generateProof(witness);
      
      debugLogger.log(DebugLogType.OFFSCREEN, `Proof generated successfully for circuit: ${circuitName}`);
      
      // Return proof in format compatible with existing interface
      return {
        proof: Array.from(proof),
        publicSignals: [], // Noir handles public inputs differently
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
  async verifyProof(circuitName, proof, publicInputs = []) {
    try {
      const backend = this.backends.get(circuitName);
      if (!backend) {
        throw new Error(`Circuit ${circuitName} not initialized`);
      }

      debugLogger.log(DebugLogType.OFFSCREEN, `Verifying proof for circuit: ${circuitName}`);
      
      const isValid = await backend.verifyProof({ proof, publicInputs });
      
      debugLogger.log(DebugLogType.OFFSCREEN, `Proof verification result for ${circuitName}: ${isValid}`);
      return isValid;
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
    const noir = this.circuits.get(circuitName);
    if (!noir) {
      return null;
    }

    return {
      name: circuitName,
      type: 'noir',
      initialized: true,
      backend: 'barretenberg'
    };
  }

  /**
   * List all initialized circuits
   * @returns {Array} List of circuit names
   */
  listCircuits() {
    return Array.from(this.circuits.keys());
  }

  /**
   * Clean up resources for a circuit
   * @param {string} circuitName - Name of the circuit to cleanup
   */
  async cleanup(circuitName) {
    try {
      const backend = this.backends.get(circuitName);
      if (backend && typeof backend.destroy === 'function') {
        await backend.destroy();
      }
      
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
}

// Export singleton instance
export const noirAdapter = new NoirCircuitAdapter();
export default NoirCircuitAdapter;