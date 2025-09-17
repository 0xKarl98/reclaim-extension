#!/usr/bin/env node

/**
 * Noir Circuit Performance Benchmark Suite
 * 
 * Comprehensive performance testing for Noir circuit implementations
 * supporting AES-128-CTR, AES-256-CTR, and ChaCha20 algorithms.
 * 
 * Usage:
 *   node noir-circuit-benchmark.js [options]
 * 
 * Options:
 *   --algorithm <name>    Run benchmark for specific algorithm
 *   --config <file>       Use custom configuration file
 *   --report             Generate detailed performance report
 *   --output <file>      Save results to specific file
 *   --iterations <num>   Number of test iterations
 *   --help               Show help information
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

// Import project modules
import { noirAdapter } from '../../src/utils/noir-adapter.js';
import BenchmarkConfig from './config/benchmark-config.js';

/**
 * Performance Metrics Collector
 */
class PerformanceMetrics {
    constructor() {
        this.metrics = {
            proofGeneration: [],
            circuitCompilation: [],
            memoryUsage: [],
            throughput: [],
            errors: [],
            timestamps: []
        };
    }

    recordProofGeneration(algorithm, dataSize, duration, success = true) {
        this.metrics.proofGeneration.push({
            algorithm,
            dataSize,
            duration,
            success,
            timestamp: Date.now()
        });
    }

    recordMemoryUsage(algorithm, dataSize, peakMemory, gcCount = 0) {
        this.metrics.memoryUsage.push({
            algorithm,
            dataSize,
            peakMemory,
            gcCount,
            timestamp: Date.now()
        });
    }

    recordError(algorithm, dataSize, error, context = '') {
        this.metrics.errors.push({
            algorithm,
            dataSize,
            error: error.message || error,
            context,
            timestamp: Date.now()
        });
    }

    calculateStatistics(metricType, algorithm = null) {
        let data = this.metrics[metricType];
        
        if (algorithm) {
            data = data.filter(item => item.algorithm === algorithm);
        }

        if (data.length === 0) return null;

        const durations = data.map(item => item.duration).filter(d => d !== undefined);
        
        if (durations.length === 0) return null;

        durations.sort((a, b) => a - b);
        
        return {
            count: durations.length,
            min: durations[0],
            max: durations[durations.length - 1],
            mean: durations.reduce((a, b) => a + b, 0) / durations.length,
            median: durations[Math.floor(durations.length / 2)],
            p95: durations[Math.floor(durations.length * 0.95)],
            p99: durations[Math.floor(durations.length * 0.99)]
        };
    }

    getSuccessRate(algorithm = null) {
        let data = this.metrics.proofGeneration;
        
        if (algorithm) {
            data = data.filter(item => item.algorithm === algorithm);
        }

        if (data.length === 0) return 0;

        const successCount = data.filter(item => item.success).length;
        return (successCount / data.length) * 100;
    }
}

/**
 * Memory Profiler
 */
class MemoryProfiler {
    constructor() {
        this.baseline = null;
        this.peak = 0;
        this.samples = [];
    }

    start() {
        this.baseline = process.memoryUsage();
        this.peak = this.baseline.heapUsed;
        this.samples = [this.baseline];
    }

    sample() {
        const current = process.memoryUsage();
        this.samples.push(current);
        this.peak = Math.max(this.peak, current.heapUsed);
        return current;
    }

    stop() {
        const final = process.memoryUsage();
        this.samples.push(final);
        
        return {
            baseline: this.baseline,
            peak: this.peak,
            final: final,
            growth: final.heapUsed - this.baseline.heapUsed,
            samples: this.samples.length
        };
    }

    getPeakUsageMB() {
        return Math.round(this.peak / 1024 / 1024 * 100) / 100;
    }
}

/**
 * Test Data Generator
 */
class TestDataGenerator {
    static generateRandomData(size) {
        const data = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            data[i] = Math.floor(Math.random() * 256);
        }
        return data;
    }

    static generateTestCases(dataSizes) {
        return dataSizes.map(size => ({
            size,
            data: this.generateRandomData(size),
            description: `${size} bytes random data`
        }));
    }
}

/**
 * Main Benchmark Runner
 */
class NoirCircuitBenchmark {
    constructor(configName = 'quick') {
        this.config = BenchmarkConfig.get(configName);
        this.metrics = new PerformanceMetrics();
        this.noirAdapter = noirAdapter;
    }

    async initialize() {
        console.log('🚀 Initializing Noir Circuit Benchmark Suite...');
        
        try {
            // Verify circuit files exist
            await this.verifyCircuitFiles();
            
            // Initialize circuits
            for (const algorithm of this.config.algorithms) {
                console.log(`  Initializing ${algorithm} circuit...`);
                await this.noirAdapter.initializeCircuit(algorithm);
            }
            
            console.log('✅ Benchmark suite initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize benchmark suite:', error.message);
            throw error;
        }
    }

    async verifyCircuitFiles() {
        const circuitDir = path.resolve(process.cwd(), 'src/circuits/compiled');
        const requiredCircuits = ['aes_128_ctr.json', 'aes_256_ctr.json', 'chacha20.json'];
        
        for (const circuit of requiredCircuits) {
            const circuitPath = path.join(circuitDir, circuit);
            if (!fs.existsSync(circuitPath)) {
                throw new Error(`Circuit file not found: ${circuit}. Run 'node download-circuits.js' first.`);
            }
        }
    }

    async runAlgorithmBenchmark(algorithm, testCases) {
        console.log(`\n📊 Benchmarking ${algorithm.toUpperCase()}...`);
        
        const profiler = new MemoryProfiler();
        
        for (const testCase of testCases) {
            console.log(`  Testing ${testCase.description}...`);
            
            // Warmup rounds
            for (let i = 0; i < this.config.warmupRounds; i++) {
                try {
                    await this.runSingleTest(algorithm, testCase.data, false);
                } catch (error) {
                    // Ignore warmup errors
                }
            }

            // Actual benchmark iterations
            for (let i = 0; i < this.config.iterations; i++) {
                profiler.start();
                
                try {
                    const duration = await this.runSingleTest(algorithm, testCase.data, true);
                    this.metrics.recordProofGeneration(algorithm, testCase.size, duration, true);
                    
                    profiler.sample();
                } catch (error) {
                    this.metrics.recordError(algorithm, testCase.size, error, 'proof_generation');
                    this.metrics.recordProofGeneration(algorithm, testCase.size, null, false);
                }
                
                const memoryStats = profiler.stop();
                this.metrics.recordMemoryUsage(algorithm, testCase.size, memoryStats.peak);
                
                // Small delay to prevent overwhelming the system
                await this.sleep(10);
            }
        }
    }

    async runSingleTest(algorithm, data, measureTime = true) {
        const startTime = measureTime ? performance.now() : 0;
        
        // Create test input based on algorithm
        const input = this.createAlgorithmInput(algorithm, data);
        
        // Generate proof
        const proof = await this.noirAdapter.generateProof(algorithm, input);
        
        if (!proof) {
            throw new Error('Proof generation failed');
        }
        
        const endTime = measureTime ? performance.now() : 0;
        return measureTime ? endTime - startTime : 0;
    }

    createAlgorithmInput(algorithm, data) {
        if (algorithm === 'aes-128-ctr') {
            const key = TestDataGenerator.generateRandomData(16); // 128-bit key
            const nonce = TestDataGenerator.generateRandomData(12); // 96-bit nonce
            const counter = 1;
            
            // Create 128-bit counter from nonce (96 bits) + counter (32 bits)
            const fullCounter = new Array(16).fill(0);
            
            // Copy nonce to first 12 bytes
            for (let i = 0; i < 12; i++) {
                fullCounter[i] = nonce[i];
            }
            
            // Set counter in big-endian format in last 4 bytes
            fullCounter[12] = (counter >>> 24) & 0xFF;
            fullCounter[13] = (counter >>> 16) & 0xFF;
            fullCounter[14] = (counter >>> 8) & 0xFF;
            fullCounter[15] = counter & 0xFF;
            
            return {
                key: Array.from(key),
                counter: fullCounter,
                plaintext: Array.from(data)
            };
        } else if (algorithm === 'aes-256-ctr') {
            const key = TestDataGenerator.generateRandomData(32); // 256-bit key
            const nonce = TestDataGenerator.generateRandomData(12); // 96-bit nonce
            const counter = 1;
            
            // Create 128-bit counter from nonce (96 bits) + counter (32 bits)
            const fullCounter = new Array(16).fill(0);
            
            // Copy nonce to first 12 bytes
            for (let i = 0; i < 12; i++) {
                fullCounter[i] = nonce[i];
            }
            
            // Set counter in big-endian format in last 4 bytes
            fullCounter[12] = (counter >>> 24) & 0xFF;
            fullCounter[13] = (counter >>> 16) & 0xFF;
            fullCounter[14] = (counter >>> 8) & 0xFF;
            fullCounter[15] = counter & 0xFF;
            
            return {
                key: Array.from(key),
                counter: fullCounter,
                plaintext: Array.from(data)
            };
        } else if (algorithm === 'chacha20') {
            const key = TestDataGenerator.generateRandomData(32); // 256-bit key
            const nonce = TestDataGenerator.generateRandomData(12); // 96-bit nonce
            const counter = 1;
            
            return {
                key: Array.from(key),
                nonce: Array.from(nonce),
                counter: counter,
                plaintext: Array.from(data)
            };
        }
        
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }

    async runConcurrencyBenchmark(algorithm) {
        console.log(`\n🔄 Running concurrency benchmark for ${algorithm.toUpperCase()}...`);
        
        const testData = TestDataGenerator.generateRandomData(1024);
        
        for (const concurrency of this.config.concurrencyLevels) {
            console.log(`  Testing concurrency level: ${concurrency}`);
            
            const startTime = performance.now();
            const promises = [];
            
            for (let i = 0; i < concurrency; i++) {
                promises.push(this.runSingleTest(algorithm, testData, false));
            }
            
            try {
                await Promise.all(promises);
                const totalTime = performance.now() - startTime;
                const throughput = concurrency / (totalTime / 1000); // operations per second
                
                console.log(`    Throughput: ${throughput.toFixed(2)} ops/sec`);
            } catch (error) {
                console.log(`    Concurrency test failed: ${error.message}`);
            }
        }
    }

    async runFullBenchmark() {
        console.log('🎯 Starting comprehensive benchmark suite...');
        
        const testCases = TestDataGenerator.generateTestCases(this.config.dataSizes);
        
        for (const algorithm of this.config.algorithms) {
            await this.runAlgorithmBenchmark(algorithm, testCases);
            await this.runConcurrencyBenchmark(algorithm);
        }
        
        console.log('\n✅ Benchmark suite completed!');
    }

    generateReport() {
        console.log('\n📈 Generating Performance Report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            configuration: this.config.config,
            summary: {},
            detailed: {},
            errors: this.metrics.metrics.errors
        };

        // Generate summary for each algorithm
        for (const algorithm of this.config.algorithms) {
            const stats = this.metrics.calculateStatistics('proofGeneration', algorithm);
            const successRate = this.metrics.getSuccessRate(algorithm);
            
            report.summary[algorithm] = {
                successRate: `${successRate.toFixed(2)}%`,
                performance: stats ? {
                    mean: `${stats.mean.toFixed(2)}ms`,
                    median: `${stats.median.toFixed(2)}ms`,
                    p95: `${stats.p95.toFixed(2)}ms`,
                    min: `${stats.min.toFixed(2)}ms`,
                    max: `${stats.max.toFixed(2)}ms`
                } : 'No data'
            };
            
            report.detailed[algorithm] = {
                statistics: stats,
                rawMetrics: this.metrics.metrics.proofGeneration.filter(m => m.algorithm === algorithm)
            };
        }

        return report;
    }

    async saveResults(report, filename = null) {
        const resultsDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'results');
        
        // Ensure results directory exists
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultFilename = `benchmark-results-${timestamp}.json`;
        const outputFile = filename || path.join(resultsDir, defaultFilename);
        
        // Save detailed results
        fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
        
        // Update latest results
        const latestFile = path.join(resultsDir, 'latest-results.json');
        fs.writeFileSync(latestFile, JSON.stringify(report, null, 2));
        
        console.log(`📁 Results saved to: ${outputFile}`);
        console.log(`📁 Latest results updated: ${latestFile}`);
    }

    printSummary(report) {
        console.log('\n📊 BENCHMARK SUMMARY');
        console.log('=' .repeat(50));
        
        for (const [algorithm, summary] of Object.entries(report.summary)) {
            console.log(`\n${algorithm.toUpperCase()}:`);
            console.log(`  Success Rate: ${summary.successRate}`);
            
            if (summary.performance !== 'No data') {
                console.log(`  Mean Time: ${summary.performance.mean}`);
                console.log(`  Median Time: ${summary.performance.median}`);
                console.log(`  95th Percentile: ${summary.performance.p95}`);
            }
        }
        
        if (report.errors.length > 0) {
            console.log(`\n⚠️  Total Errors: ${report.errors.length}`);
        }
        
        console.log('\n' + '=' .repeat(50));
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Command Line Interface
 */
class BenchmarkCLI {
    static parseArguments() {
        const args = process.argv.slice(2);
        const options = {
            algorithm: null,
            config: null,
            report: false,
            output: null,
            iterations: null,
            help: false
        };

        for (let i = 0; i < args.length; i++) {
            switch (args[i]) {
                case '--algorithm':
                    options.algorithm = args[++i];
                    break;
                case '--config':
                    options.config = args[++i];
                    break;
                case '--report':
                    options.report = true;
                    break;
                case '--output':
                    options.output = args[++i];
                    break;
                case '--iterations':
                    options.iterations = parseInt(args[++i]);
                    break;
                case '--help':
                    options.help = true;
                    break;
            }
        }

        return options;
    }

    static showHelp() {
        console.log(`
Noir Circuit Performance Benchmark Suite

Usage: node noir-circuit-benchmark.js [options]

Options:
  --algorithm <name>    Run benchmark for specific algorithm (aes-128-ctr, aes-256-ctr, chacha20)
  --config <file>       Use custom configuration file
  --report             Generate detailed performance report
  --output <file>      Save results to specific file
  --iterations <num>   Number of test iterations (default: 50)
  --help               Show this help information

Examples:
  node noir-circuit-benchmark.js
  node noir-circuit-benchmark.js --algorithm aes-128-ctr --iterations 100
  node noir-circuit-benchmark.js --report --output my-results.json
`);
    }
}

/**
 * Main Execution
 */
async function main() {
    const options = BenchmarkCLI.parseArguments();
    
    if (options.help) {
        BenchmarkCLI.showHelp();
        return;
    }

    try {
        // Determine configuration name
        let configName = 'quick';
        if (options.config) {
            configName = options.config;
        }
        
        // Create benchmark instance
        const benchmark = new NoirCircuitBenchmark(configName);
        
        // Override configuration with command line options
         if (options.algorithm) {
             benchmark.config.algorithms = [options.algorithm];
         }
         if (options.iterations) {
             benchmark.config.iterations = options.iterations;
         }
        
        // Initialize and run benchmark
        await benchmark.initialize();
        await benchmark.runFullBenchmark();
        
        // Generate and save results
        const report = benchmark.generateReport();
        await benchmark.saveResults(report, options.output);
        
        // Print summary
        benchmark.printSummary(report);
        
        console.log('\n🎉 Benchmark completed successfully!');
        
        // Exit the process successfully
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Benchmark failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export {
    NoirCircuitBenchmark,
    BenchmarkConfig,
    PerformanceMetrics,
    MemoryProfiler,
    TestDataGenerator
};