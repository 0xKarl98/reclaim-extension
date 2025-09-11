import { UltraHonkBackend } from '@aztec/bb.js'
// @ts-ignore
import { CompiledCircuit, Noir } from '@noir-lang/noir_js'
import PQueue from 'p-queue'
import {
	BarretenbergOperator,
	Logger,
	MakeZKOperatorOpts,
	ZKProofInput,
	ZKProofPublicSignals,
} from '../types'
import { BarretenbergOpts } from './types'
import { convertToNoirWitness, getCircuitFilename } from './utils'

/**
 * Creates a Barretenberg ZK operator for Noir circuits
 * This operator uses the UltraHonk proving system from Barretenberg
 */
export function makeBarretenbergZKOperator({
	algorithm,
	fetcher,
	options: { threads = 1 } = {}
}: MakeZKOperatorOpts<BarretenbergOpts>): BarretenbergOperator {
	let circuit: CompiledCircuit
	let noir: Noir
	let backend: UltraHonkBackend

	async function loadCircuit(logger?: Logger): Promise<CompiledCircuit> {
		if(!circuit) {
			logger?.info?.(`Loading Noir circuit for ${algorithm}`)
			const circuitData = await fetcher.fetch(
				'barretenberg',
				getCircuitFilename(algorithm),
				logger
			)
			circuit = JSON.parse(new TextDecoder().decode(circuitData)) as CompiledCircuit
			logger?.info?.('Circuit loaded successfully')
		}

		return circuit
	}

	async function initializeBackend(logger?: Logger): Promise<{ noir: Noir, backend: UltraHonkBackend }> {
		if(!noir || !backend) {
			const loadedCircuit = await loadCircuit(logger)
			noir = new Noir(loadedCircuit)
			backend = new UltraHonkBackend(loadedCircuit.bytecode, { threads })
			logger?.info?.(`Barretenberg backend initialized with ${threads} threads`)
		}

		return { noir, backend }
	}

	return {
		async generateWitness(input: ZKProofInput, logger?: Logger): Promise<Uint8Array> {
			const { noir: noirInstance } = await initializeBackend(logger)

			// Convert input to Noir witness format
			const noirInput = convertToNoirWitness(algorithm, input)
			// console.log('noirInput', JSON.stringify(noirInput, null, 2))

			logger?.debug?.('Executing Noir circuit...')
			const { witness } = await noirInstance.execute(noirInput)
			// console.log('witness length', witness.length)

			logger?.debug?.('Witness generated successfully')
			return witness
		},

		async ultrahonkProve(witness: Uint8Array, logger?: Logger): Promise<{ proof: Uint8Array, publicInputs: any[] }> {
			const { backend: backendInstance } = await initializeBackend(logger)

			logger?.info?.('Generating proof with UltraHonk backend...')
			const startTime = Date.now()

			const proofData = await backendInstance.generateProof(witness)
			const proofTime = Date.now() - startTime
			logger?.info?.(`Proof generated in ${proofTime}ms, size: ${proofData.proof.length} bytes`)

			return { proof: proofData.proof, publicInputs: proofData.publicInputs }
		},

		async ultrahonkVerify(
			publicSignals: ZKProofPublicSignals,
			proof: Uint8Array | string,
			logger?: Logger
		): Promise<boolean> {
			const { backend: backendInstance } = await initializeBackend(logger)
			logger?.info?.('Verifying proof with UltraHonk backend...')
			const startTime = Date.now()

			try {
				// Use the proof directly without parsing
				const proofBytes = typeof proof === 'string'
					? new Uint8Array(Buffer.from(proof, 'hex'))
					: proof
				
				// Use the stored public inputs from the last proof generation
				const proofData = {
					proof: new Uint8Array(proofBytes),
					publicInputs: publicSignals || []
				}

				const isValid = await backendInstance.verifyProof(proofData)

				const verifyTime = Date.now() - startTime
				logger?.info?.(`Proof verification completed in ${verifyTime}ms, result: ${isValid}`)

				return isValid
			} catch(error) {
				logger?.error?.(`Proof verification failed: ${error}`)
				// console.error('Verification error details:', error)
				return false
			}
		}
  }
}
