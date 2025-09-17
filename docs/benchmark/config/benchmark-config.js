/**
 * Benchmark Configuration
 * 
 * This file contains default and customizable configuration options
 * for the Noir Circuit Performance Benchmark Suite.
 */

import os from 'os';

const BenchmarkConfig = {
    /**
     * Default Benchmark Configuration
     */
    default: {
        // Algorithms to benchmark
        algorithms: ['aes-128-ctr', 'aes-256-ctr', 'chacha20'],
        
        // Data sizes to test (in bytes)
        dataSizes: [256, 1024, 4096, 16384],
        
        // Number of iterations per test case
        iterations: 50,
        
        // Number of warmup rounds before actual benchmarking
        warmupRounds: 5,
        
        // Concurrency levels to test
        concurrencyLevels: [1, 2, 4, 8],
        
        // Timeout for individual operations (milliseconds)
        timeout: 30000,
        
        // Enable memory profiling
        memoryProfiling: true,
        
        // Output format (json, csv, markdown)
        outputFormat: 'json',
        
        // Enable detailed logging
        verbose: false,
        
        // Circuit compilation timeout
        compilationTimeout: 60000
    },

    /**
     * Quick Test Configuration
     * For rapid development and testing
     */
    quick: {
        algorithms: ['aes-128-ctr', 'aes-256-ctr', 'chacha20'],
        dataSizes: [1024],
        iterations: 10,
        warmupRounds: 2,
        concurrencyLevels: [1, 2],
        timeout: 15000,
        memoryProfiling: false,
        outputFormat: 'json',
        verbose: true
    },

    /**
     * Comprehensive Test Configuration
     * For thorough performance analysis
     */
    comprehensive: {
        algorithms: ['aes-128-ctr', 'aes-256-ctr', 'chacha20'],
        dataSizes: [128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768],
        iterations: 100,
        warmupRounds: 10,
        concurrencyLevels: [1, 2, 4, 8, 16],
        timeout: 60000,
        memoryProfiling: true,
        outputFormat: 'json',
        verbose: true,
        compilationTimeout: 120000
    },

    /**
     * Memory Stress Test Configuration
     * For testing memory usage and garbage collection
     */
    memoryStress: {
        algorithms: ['aes-256-ctr', 'chacha20'],
        dataSizes: [16384, 32768, 65536],
        iterations: 200,
        warmupRounds: 20,
        concurrencyLevels: [1, 4, 8],
        timeout: 90000,
        memoryProfiling: true,
        outputFormat: 'json',
        verbose: true,
        gcBetweenTests: true,
        memoryThreshold: 500 * 1024 * 1024 // 500MB
    },

    /**
     * Concurrency Stress Test Configuration
     * For testing parallel processing capabilities
     */
    concurrencyStress: {
        algorithms: ['aes-128-ctr', 'aes-256-ctr', 'chacha20'],
        dataSizes: [1024, 4096],
        iterations: 50,
        warmupRounds: 5,
        concurrencyLevels: [1, 2, 4, 8, 16, 32],
        timeout: 45000,
        memoryProfiling: true,
        outputFormat: 'json',
        verbose: true,
        maxConcurrentOperations: 32
    },

    /**
     * Algorithm Comparison Configuration
     * For comparing performance across different algorithms
     */
    algorithmComparison: {
        algorithms: ['aes-128-ctr', 'aes-256-ctr', 'chacha20'],
        dataSizes: [1024, 4096, 16384],
        iterations: 75,
        warmupRounds: 10,
        concurrencyLevels: [1, 4],
        timeout: 30000,
        memoryProfiling: true,
        outputFormat: 'json',
        verbose: false,
        statisticalAnalysis: true
    },

    /**
     * CI/CD Configuration
     * For automated testing in continuous integration
     */
    ci: {
        algorithms: ['aes-128-ctr', 'aes-256-ctr'],
        dataSizes: [1024, 4096],
        iterations: 25,
        warmupRounds: 3,
        concurrencyLevels: [1, 2],
        timeout: 20000,
        memoryProfiling: false,
        outputFormat: 'json',
        verbose: false,
        failOnError: true,
        performanceThresholds: {
            maxMeanTime: 1000, // milliseconds
            minSuccessRate: 95  // percentage
        }
    },

    /**
     * Development Configuration
     * For local development and debugging
     */
    development: {
        algorithms: ['aes-128-ctr'],
        dataSizes: [256, 1024],
        iterations: 5,
        warmupRounds: 1,
        concurrencyLevels: [1],
        timeout: 10000,
        memoryProfiling: true,
        outputFormat: 'json',
        verbose: true,
        debugMode: true
    },

    /**
     * Performance Regression Test Configuration
     * For detecting performance regressions
     */
    regression: {
        algorithms: ['aes-128-ctr', 'aes-256-ctr', 'chacha20'],
        dataSizes: [1024, 4096],
        iterations: 50,
        warmupRounds: 5,
        concurrencyLevels: [1, 4],
        timeout: 30000,
        memoryProfiling: true,
        outputFormat: 'json',
        verbose: false,
        baselineComparison: true,
        regressionThreshold: 10 // percentage increase
    },

    /**
     * Load Test Configuration
     * For testing system behavior under sustained load
     */
    loadTest: {
        algorithms: ['aes-128-ctr', 'aes-256-ctr', 'chacha20'],
        dataSizes: [1024],
        iterations: 500,
        warmupRounds: 50,
        concurrencyLevels: [4, 8],
        timeout: 60000,
        memoryProfiling: true,
        outputFormat: 'json',
        verbose: false,
        sustainedLoad: true,
        loadDuration: 300000 // 5 minutes
    },

    /**
     * Configuration Validation
     */
    validate: function(config) {
        const required = ['algorithms', 'dataSizes', 'iterations'];
        const missing = required.filter(key => !config.hasOwnProperty(key));
        
        if (missing.length > 0) {
            throw new Error(`Missing required configuration keys: ${missing.join(', ')}`);
        }

        // Validate algorithms
        const validAlgorithms = ['aes-128-ctr', 'aes-256-ctr', 'chacha20'];
        const invalidAlgorithms = config.algorithms.filter(alg => !validAlgorithms.includes(alg));
        
        if (invalidAlgorithms.length > 0) {
            throw new Error(`Invalid algorithms: ${invalidAlgorithms.join(', ')}. Valid options: ${validAlgorithms.join(', ')}`);
        }

        // Validate data sizes
        if (!Array.isArray(config.dataSizes) || config.dataSizes.some(size => size <= 0)) {
            throw new Error('Data sizes must be an array of positive numbers');
        }

        // Validate iterations
        if (config.iterations <= 0) {
            throw new Error('Iterations must be a positive number');
        }

        return true;
    },

    /**
     * Get Configuration by Name
     */
    get: function(name) {
        if (!this[name]) {
            throw new Error(`Configuration '${name}' not found. Available configurations: ${Object.keys(this).filter(k => typeof this[k] === 'object').join(', ')}`);
        }
        
        const config = { ...this[name] };
        this.validate(config);
        return config;
    },

    /**
     * Merge Configurations
     */
    merge: function(base, override) {
        const merged = { ...this.get(base), ...override };
        this.validate(merged);
        return merged;
    },

    /**
     * Create Custom Configuration
     */
    create: function(customConfig) {
        const config = { ...this.default, ...customConfig };
        this.validate(config);
        return config;
    }
};

/**
 * Environment-specific Configuration Loader
 */
const loadEnvironmentConfig = function() {
    const env = process.env.NODE_ENV || 'development';
    const configMap = {
        'development': 'development',
        'test': 'ci',
        'production': 'default',
        'ci': 'ci',
        'benchmark': 'comprehensive'
    };
    
    const configName = configMap[env] || 'default';
    return BenchmarkConfig.get(configName);
};

/**
 * Performance Thresholds
 */
const performanceThresholds = {
    // Proof generation time thresholds (milliseconds)
    proofGeneration: {
        excellent: 100,
        good: 500,
        acceptable: 2000,
        poor: 5000
    },
    
    // Memory usage thresholds (MB)
    memoryUsage: {
        optimal: 50,
        acceptable: 100,
        concerning: 200,
        critical: 500
    },
    
    // Success rate thresholds (percentage)
    successRate: {
        excellent: 99,
        good: 95,
        acceptable: 90,
        poor: 80
    },
    
    // Throughput thresholds (operations per second)
    throughput: {
        excellent: 10,
        good: 5,
        acceptable: 2,
        poor: 1
    }
};

/**
 * Hardware-specific Configuration Adjustments
 */
const adjustForHardware = function(baseConfig) {
    const totalMemory = os.totalmem();
    const cpuCount = os.cpus().length;
    
    const adjusted = { ...baseConfig };
    
    // Adjust concurrency based on CPU count
    if (cpuCount <= 2) {
        adjusted.concurrencyLevels = adjusted.concurrencyLevels.filter(level => level <= 2);
    } else if (cpuCount <= 4) {
        adjusted.concurrencyLevels = adjusted.concurrencyLevels.filter(level => level <= 4);
    }
    
    // Adjust iterations based on available memory
    const memoryGB = totalMemory / (1024 * 1024 * 1024);
    if (memoryGB < 4) {
        adjusted.iterations = Math.min(adjusted.iterations, 25);
        adjusted.dataSizes = adjusted.dataSizes.filter(size => size <= 8192);
    } else if (memoryGB < 8) {
        adjusted.iterations = Math.min(adjusted.iterations, 50);
    }
    
    return adjusted;
};

export {
    BenchmarkConfig as default,
    loadEnvironmentConfig,
    performanceThresholds,
    adjustForHardware
};