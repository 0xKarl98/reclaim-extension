# Benchmark Integration Guide

This guide explains how to integrate the Noir Circuit Performance Benchmark Suite into your development workflow and CI/CD pipeline.

## Quick Start

### 1. Basic Usage

```bash
# Run quick benchmark for development
./docs/benchmark/run-benchmark.sh quick

# Run comprehensive benchmark
./docs/benchmark/run-benchmark.sh full

# Run algorithm-specific benchmark
./docs/benchmark/run-benchmark.sh algorithm --algorithm aes-128-ctr
```

### 2. Direct Script Usage

```bash
# Run with Node.js directly
node docs/benchmark/noir-circuit-benchmark.js

# Run with custom parameters
node docs/benchmark/noir-circuit-benchmark.js --algorithm chacha20 --iterations 100

# Generate detailed report
node docs/benchmark/noir-circuit-benchmark.js --report --output my-results.json
```

## Development Workflow Integration

### Pre-commit Hooks

Add performance regression checks to your pre-commit hooks:

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running performance regression check..."
./docs/benchmark/run-benchmark.sh ci

if [ $? -ne 0 ]; then
    echo "Performance benchmark failed. Commit aborted."
    exit 1
fi
```

### Development Testing

For daily development, use the quick benchmark:

```bash
# Add to package.json scripts
{
  "scripts": {
    "benchmark:quick": "./docs/benchmark/run-benchmark.sh quick",
    "benchmark:full": "./docs/benchmark/run-benchmark.sh full",
    "benchmark:memory": "./docs/benchmark/run-benchmark.sh memory",
    "test:performance": "npm run benchmark:quick"
  }
}
```

### Performance Monitoring

Set up automated performance monitoring:

```bash
# Weekly comprehensive benchmark
0 2 * * 1 cd /path/to/project && ./docs/benchmark/run-benchmark.sh full --output weekly-$(date +%Y%m%d).json

# Daily quick checks
0 6 * * * cd /path/to/project && ./docs/benchmark/run-benchmark.sh ci
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/performance.yml
name: Performance Benchmark

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday

jobs:
  benchmark:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Download circuits
      run: node download-circuits.js
    
    - name: Run performance benchmark
      run: ./docs/benchmark/run-benchmark.sh ci --output benchmark-results.json
    
    - name: Upload benchmark results
      uses: actions/upload-artifact@v3
      with:
        name: benchmark-results
        path: benchmark-results.json
    
    - name: Performance regression check
      run: |
        # Add custom logic to compare with baseline
        node -e "
          const results = require('./benchmark-results.json');
          const threshold = 1000; // 1 second threshold
          
          for (const [alg, summary] of Object.entries(results.summary)) {
            const meanTime = parseFloat(summary.performance.mean);
            if (meanTime > threshold) {
              console.error(\`Performance regression detected in \${alg}: \${meanTime}ms > \${threshold}ms\`);
              process.exit(1);
            }
          }
          
          console.log('Performance check passed');
        "
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm ci'
                sh 'node download-circuits.js'
            }
        }
        
        stage('Performance Test') {
            steps {
                sh './docs/benchmark/run-benchmark.sh ci --output benchmark-results.json'
            }
            
            post {
                always {
                    archiveArtifacts artifacts: 'benchmark-results.json', fingerprint: true
                    
                    script {
                        def results = readJSON file: 'benchmark-results.json'
                        def overallSuccess = results.benchmarkMetadata.overallSuccessRate
                        
                        if (overallSuccess < 95) {
                            error "Performance benchmark failed: ${overallSuccess}% success rate"
                        }
                    }
                }
            }
        }
    }
}
```

## Configuration Management

### Environment-specific Configurations

```javascript
// config/benchmark-environments.js
module.exports = {
    development: {
        algorithms: ['aes-128-ctr'],
        iterations: 5,
        dataSizes: [1024],
        timeout: 10000
    },
    
    staging: {
        algorithms: ['aes-128-ctr', 'aes-256-ctr'],
        iterations: 25,
        dataSizes: [1024, 4096],
        timeout: 20000
    },
    
    production: {
        algorithms: ['aes-128-ctr', 'aes-256-ctr', 'chacha20'],
        iterations: 50,
        dataSizes: [256, 1024, 4096, 16384],
        timeout: 30000
    }
};
```

### Custom Configuration Usage

```bash
# Use environment-specific config
NODE_ENV=staging ./docs/benchmark/run-benchmark.sh custom --config config/benchmark-environments.js

# Override with environment variables
BENCHMARK_ITERATIONS=100 BENCHMARK_VERBOSE=true ./docs/benchmark/run-benchmark.sh quick
```

## Performance Monitoring Dashboard

### Data Collection Script

```javascript
// scripts/collect-performance-data.js
const fs = require('fs');
const path = require('path');

class PerformanceDataCollector {
    constructor() {
        this.dataDir = path.join(__dirname, '../docs/benchmark/results/historical-results');
    }
    
    async collectDailyMetrics() {
        const today = new Date().toISOString().split('T')[0];
        const resultsFile = path.join(this.dataDir, `${today}.json`);
        
        if (fs.existsSync(resultsFile)) {
            const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
            
            // Extract key metrics
            const metrics = {
                date: today,
                algorithms: {},
                overallSuccessRate: results.benchmarkMetadata.overallSuccessRate,
                totalOperations: results.benchmarkMetadata.totalOperations
            };
            
            for (const [algorithm, summary] of Object.entries(results.summary)) {
                metrics.algorithms[algorithm] = {
                    meanTime: parseFloat(summary.performance.mean),
                    successRate: parseFloat(summary.successRate),
                    memoryPeak: summary.memoryPeak
                };
            }
            
            // Append to historical data
            const historicalFile = path.join(this.dataDir, 'historical-metrics.jsonl');
            fs.appendFileSync(historicalFile, JSON.stringify(metrics) + '\n');
            
            console.log(`Metrics collected for ${today}`);
        }
    }
}

if (require.main === module) {
    const collector = new PerformanceDataCollector();
    collector.collectDailyMetrics().catch(console.error);
}
```

### Visualization Script

```javascript
// scripts/generate-performance-charts.js
const fs = require('fs');
const path = require('path');

class PerformanceVisualizer {
    generateTrendReport() {
        const historicalFile = path.join(__dirname, '../docs/benchmark/results/historical-results/historical-metrics.jsonl');
        
        if (!fs.existsSync(historicalFile)) {
            console.log('No historical data found');
            return;
        }
        
        const lines = fs.readFileSync(historicalFile, 'utf8').trim().split('\n');
        const data = lines.map(line => JSON.parse(line));
        
        // Generate trend analysis
        const trends = this.analyzeTrends(data);
        
        // Generate HTML report
        const htmlReport = this.generateHTMLReport(trends);
        
        const outputFile = path.join(__dirname, '../docs/benchmark/results/performance-trends.html');
        fs.writeFileSync(outputFile, htmlReport);
        
        console.log(`Performance trends report generated: ${outputFile}`);
    }
    
    analyzeTrends(data) {
        // Implement trend analysis logic
        return {
            performanceTrends: {},
            regressions: [],
            improvements: []
        };
    }
    
    generateHTMLReport(trends) {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Trends</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <h1>Noir Circuit Performance Trends</h1>
    <canvas id="performanceChart"></canvas>
    <script>
        // Chart.js implementation
    </script>
</body>
</html>
        `;
    }
}

if (require.main === module) {
    const visualizer = new PerformanceVisualizer();
    visualizer.generateTrendReport();
}
```

## Alerting and Notifications

### Slack Integration

```javascript
// scripts/performance-alerts.js
const https = require('https');

class PerformanceAlerter {
    constructor(webhookUrl) {
        this.webhookUrl = webhookUrl;
    }
    
    async checkPerformanceRegression(resultsFile) {
        const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
        const alerts = [];
        
        // Check for performance regressions
        for (const [algorithm, summary] of Object.entries(results.summary)) {
            const meanTime = parseFloat(summary.performance.mean);
            const successRate = parseFloat(summary.successRate);
            
            if (meanTime > 1000) {
                alerts.push(`⚠️ Performance regression in ${algorithm}: ${meanTime}ms`);
            }
            
            if (successRate < 95) {
                alerts.push(`🚨 Low success rate in ${algorithm}: ${successRate}%`);
            }
        }
        
        if (alerts.length > 0) {
            await this.sendSlackAlert(alerts);
        }
    }
    
    async sendSlackAlert(alerts) {
        const message = {
            text: "Performance Alert",
            attachments: [{
                color: "danger",
                fields: [{
                    title: "Performance Issues Detected",
                    value: alerts.join('\n'),
                    short: false
                }]
            }]
        };
        
        // Send to Slack webhook
        // Implementation details...
    }
}
```

## Best Practices

### 1. Regular Monitoring
- Run quick benchmarks daily during development
- Execute comprehensive benchmarks weekly
- Monitor trends over time to detect gradual regressions

### 2. Performance Budgets
- Set clear performance thresholds for each algorithm
- Fail builds that exceed performance budgets
- Track performance metrics as part of code review

### 3. Environment Consistency
- Use consistent hardware for benchmark comparisons
- Document system specifications in benchmark results
- Account for environmental factors in analysis

### 4. Data Management
- Archive historical benchmark data
- Implement data retention policies
- Use version control for benchmark configurations

### 5. Team Communication
- Share benchmark results with the team
- Document performance optimization efforts
- Celebrate performance improvements

## Troubleshooting

### Common Issues

**Circuit files not found:**
```bash
# Download missing circuits
node download-circuits.js
```

**Memory errors:**
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 docs/benchmark/noir-circuit-benchmark.js
```

**Timeout errors:**
- Increase timeout values in configuration
- Reduce iteration count for initial testing
- Check system resource availability

**Inconsistent results:**
- Ensure system is not under load during benchmarking
- Increase warmup rounds
- Run multiple benchmark sessions and average results

### Performance Optimization Tips

1. **Enable circuit caching** for repeated operations
2. **Monitor memory usage** and optimize garbage collection
3. **Tune concurrency levels** based on system capabilities
4. **Profile individual components** to identify bottlenecks
5. **Use appropriate algorithms** for specific use cases

---

*For additional support, refer to the main README.md or contact the development team.*