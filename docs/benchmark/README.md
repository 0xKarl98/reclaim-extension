# Noir Circuit Performance Benchmark

This directory contains comprehensive performance benchmarks for Noir circuit implementations in the Reclaim Extension.

## Overview

The benchmark suite evaluates the performance characteristics of different cryptographic algorithms (AES-128-CTR, AES-256-CTR, ChaCha20) across various scenarios and environments.

## Structure

```
benchmark/
├── README.md                    # This documentation
├── noir-circuit-benchmark.js    # Main benchmark script
├── performance-report.md        # Performance analysis template
├── config/
│   └── benchmark-config.js      # Benchmark configuration
└── results/
    ├── latest-results.json      # Most recent benchmark results
    └── historical-results/      # Historical performance data
```

## Benchmark Categories

### 1. Algorithm Performance Comparison
- **AES-128-CTR**: Baseline encryption performance
- **AES-256-CTR**: Enhanced security with performance trade-offs
- **ChaCha20**: Stream cipher performance characteristics

### 2. Data Size Impact Analysis
- Small payloads (< 1KB)
- Medium payloads (1KB - 10KB)
- Large payloads (> 10KB)

### 3. Memory Usage Profiling
- Peak memory consumption
- Garbage collection impact
- Memory leak detection

### 4. Concurrency Performance
- Parallel proof generation
- Resource contention analysis
- Throughput optimization

### 5. Environment Compatibility
- Browser-specific performance
- Device capability impact
- Network condition effects

## Running Benchmarks

### Prerequisites
```bash
# Ensure all dependencies are installed
npm install

# Download required circuit files
node download-circuits.js
```

### Execute Full Benchmark Suite
```bash
# Run comprehensive benchmark
node docs/benchmark/noir-circuit-benchmark.js

# Run specific algorithm benchmark
node docs/benchmark/noir-circuit-benchmark.js --algorithm aes-128-ctr

# Run with custom configuration
node docs/benchmark/noir-circuit-benchmark.js --config custom-config.json
```

### Generate Performance Report
```bash
# Generate detailed analysis report
node docs/benchmark/noir-circuit-benchmark.js --report
```

## Metrics Collected

### Performance Metrics
- **Proof Generation Time**: Time to generate cryptographic proofs
- **Circuit Compilation Time**: Time to compile Noir circuits
- **Memory Peak Usage**: Maximum memory consumption during operations
- **Throughput**: Operations per second under load
- **Latency**: Response time for individual operations

### Reliability Metrics
- **Success Rate**: Percentage of successful operations
- **Error Distribution**: Types and frequency of errors
- **Stability Index**: Performance consistency over time

## Configuration

Benchmark parameters can be customized through configuration files:

```javascript
// Example configuration
{
  "algorithms": ["aes-128-ctr", "aes-256-ctr", "chacha20"],
  "dataSizes": [256, 1024, 4096, 16384],
  "iterations": 100,
  "warmupRounds": 10,
  "concurrencyLevels": [1, 2, 4, 8],
  "timeout": 30000
}
```

## Interpreting Results

### Performance Baselines
- **Excellent**: < 100ms proof generation
- **Good**: 100-500ms proof generation
- **Acceptable**: 500ms-2s proof generation
- **Poor**: > 2s proof generation

### Memory Usage Guidelines
- **Optimal**: < 50MB peak usage
- **Acceptable**: 50-100MB peak usage
- **Concerning**: > 100MB peak usage

## Contributing

When adding new benchmarks:

1. Follow the existing naming conventions
2. Include comprehensive documentation
3. Ensure cross-platform compatibility
4. Add appropriate error handling
5. Update this README with new benchmark descriptions

## Troubleshooting

### Common Issues

**Circuit files not found**
```bash
# Download missing circuit files
node download-circuits.js
```

**Memory errors during benchmarks**
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 docs/benchmark/noir-circuit-benchmark.js
```

**Timeout errors**
- Increase timeout values in configuration
- Reduce iteration count for initial testing
- Check system resources availability

## Performance Optimization Tips

1. **Circuit Caching**: Enable circuit caching for repeated operations
2. **Memory Management**: Monitor and optimize memory usage patterns
3. **Concurrency Tuning**: Find optimal concurrency levels for your environment
4. **Algorithm Selection**: Choose appropriate algorithms based on use case requirements

---

*For detailed performance analysis and historical trends, refer to the generated performance reports in the results directory.*