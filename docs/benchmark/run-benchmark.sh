#!/bin/bash

# Noir Circuit Benchmark Runner Script
# 
# This script provides convenient ways to run different benchmark configurations
# for the Noir circuit performance testing suite.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BENCHMARK_SCRIPT="$SCRIPT_DIR/noir-circuit-benchmark.js"

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_VERSION="16.0.0"
    if ! node -e "process.exit(require('semver').gte('$NODE_VERSION', '$REQUIRED_VERSION') ? 0 : 1)" 2>/dev/null; then
        print_warning "Node.js version $NODE_VERSION detected. Recommended version: $REQUIRED_VERSION or higher."
    fi
    
    # Check if npm dependencies are installed
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        print_warning "Node modules not found. Installing dependencies..."
        cd "$PROJECT_ROOT"
        npm install
    fi
    
    # Check if circuit files exist
    CIRCUIT_DIR="$PROJECT_ROOT/src/circuits/compiled"
    if [ ! -f "$CIRCUIT_DIR/aes_128_ctr.json" ] || [ ! -f "$CIRCUIT_DIR/aes_256_ctr.json" ] || [ ! -f "$CIRCUIT_DIR/chacha20.json" ]; then
        print_warning "Circuit files not found. Downloading circuits..."
        cd "$PROJECT_ROOT"
        node download-circuits.js
    fi
    
    print_success "Prerequisites check completed."
}

# Function to show help
show_help() {
    cat << EOF
Noir Circuit Benchmark Runner

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    quick           Run quick benchmark (fast, limited scope)
    full            Run full comprehensive benchmark
    algorithm       Run benchmark for specific algorithm
    memory          Run memory stress test
    concurrency     Run concurrency stress test
    ci              Run CI/CD optimized benchmark
    custom          Run with custom configuration file
    help            Show this help message

Options:
    --algorithm <name>     Specify algorithm (aes-128-ctr, aes-256-ctr, chacha20)
    --iterations <num>     Number of test iterations
    --output <file>        Output file for results
    --config <file>        Custom configuration file
    --verbose              Enable verbose output
    --no-report           Skip generating detailed report

Examples:
    $0 quick
    $0 full --output my-results.json
    $0 algorithm --algorithm aes-128-ctr --iterations 100
    $0 memory --verbose
    $0 custom --config my-config.json

Environment Variables:
    BENCHMARK_ITERATIONS   Override default iteration count
    BENCHMARK_TIMEOUT      Override default timeout (milliseconds)
    BENCHMARK_VERBOSE      Enable verbose mode (true/false)

EOF
}

# Function to run quick benchmark
run_quick() {
    print_info "Running quick benchmark..."
    node "$BENCHMARK_SCRIPT" \
        --algorithm aes-128-ctr \
        --iterations 10 \
        "$@"
}

# Function to run full benchmark
run_full() {
    print_info "Running comprehensive benchmark..."
    print_warning "This may take several minutes to complete."
    node "$BENCHMARK_SCRIPT" \
        --report \
        "$@"
}

# Function to run algorithm-specific benchmark
run_algorithm() {
    local algorithm="$1"
    shift
    
    if [ -z "$algorithm" ]; then
        print_error "Algorithm not specified. Use: aes-128-ctr, aes-256-ctr, or chacha20"
        exit 1
    fi
    
    print_info "Running benchmark for $algorithm..."
    node "$BENCHMARK_SCRIPT" \
        --algorithm "$algorithm" \
        --report \
        "$@"
}

# Function to run memory stress test
run_memory() {
    print_info "Running memory stress test..."
    print_warning "This test uses large data sizes and may consume significant memory."
    
    # Create temporary config for memory stress test
    local temp_config="/tmp/memory-stress-config.json"
    cat > "$temp_config" << EOF
{
    "algorithms": ["aes-256-ctr", "chacha20"],
    "dataSizes": [16384, 32768, 65536],
    "iterations": 50,
    "warmupRounds": 10,
    "concurrencyLevels": [1, 2],
    "timeout": 90000,
    "memoryProfiling": true,
    "verbose": true
}
EOF
    
    node "$BENCHMARK_SCRIPT" \
        --config "$temp_config" \
        --report \
        "$@"
    
    rm -f "$temp_config"
}

# Function to run concurrency stress test
run_concurrency() {
    print_info "Running concurrency stress test..."
    
    # Create temporary config for concurrency stress test
    local temp_config="/tmp/concurrency-stress-config.json"
    cat > "$temp_config" << EOF
{
    "algorithms": ["aes-128-ctr", "aes-256-ctr", "chacha20"],
    "dataSizes": [1024, 4096],
    "iterations": 30,
    "warmupRounds": 5,
    "concurrencyLevels": [1, 2, 4, 8, 16],
    "timeout": 45000,
    "memoryProfiling": true,
    "verbose": true
}
EOF
    
    node "$BENCHMARK_SCRIPT" \
        --config "$temp_config" \
        --report \
        "$@"
    
    rm -f "$temp_config"
}

# Function to run CI benchmark
run_ci() {
    print_info "Running CI/CD optimized benchmark..."
    
    # Create temporary config for CI
    local temp_config="/tmp/ci-config.json"
    cat > "$temp_config" << EOF
{
    "algorithms": ["aes-128-ctr", "aes-256-ctr"],
    "dataSizes": [1024, 4096],
    "iterations": 20,
    "warmupRounds": 3,
    "concurrencyLevels": [1, 2],
    "timeout": 20000,
    "memoryProfiling": false,
    "verbose": false
}
EOF
    
    node "$BENCHMARK_SCRIPT" \
        --config "$temp_config" \
        "$@"
    
    rm -f "$temp_config"
}

# Function to run custom benchmark
run_custom() {
    local config_file="$1"
    shift
    
    if [ -z "$config_file" ] || [ ! -f "$config_file" ]; then
        print_error "Configuration file not found: $config_file"
        exit 1
    fi
    
    print_info "Running benchmark with custom configuration: $config_file"
    node "$BENCHMARK_SCRIPT" \
        --config "$config_file" \
        --report \
        "$@"
}

# Function to generate system info
generate_system_info() {
    print_info "System Information:"
    echo "  OS: $(uname -s) $(uname -r)"
    echo "  Architecture: $(uname -m)"
    echo "  Node.js: $(node --version)"
    echo "  NPM: $(npm --version)"
    echo "  CPU Cores: $(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 'Unknown')"
    
    if command -v free &> /dev/null; then
        echo "  Memory: $(free -h | awk '/^Mem:/ {print $2}')"
    elif command -v vm_stat &> /dev/null; then
        local pages=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        local page_size=$(vm_stat | grep "page size" | awk '{print $8}')
        if [ -n "$pages" ] && [ -n "$page_size" ]; then
            local free_mb=$((pages * page_size / 1024 / 1024))
            echo "  Free Memory: ${free_mb}MB"
        fi
    fi
    echo ""
}

# Main script logic
main() {
    local command="$1"
    shift || true
    
    # Handle environment variables
    if [ -n "$BENCHMARK_ITERATIONS" ]; then
        set -- "--iterations" "$BENCHMARK_ITERATIONS" "$@"
    fi
    
    if [ -n "$BENCHMARK_VERBOSE" ] && [ "$BENCHMARK_VERBOSE" = "true" ]; then
        set -- "--verbose" "$@"
    fi
    
    case "$command" in
        "quick")
            check_prerequisites
            generate_system_info
            run_quick "$@"
            ;;
        "full")
            check_prerequisites
            generate_system_info
            run_full "$@"
            ;;
        "algorithm")
            check_prerequisites
            generate_system_info
            # Extract algorithm from arguments
            local algorithm=""
            local remaining_args=()
            while [[ $# -gt 0 ]]; do
                case $1 in
                    --algorithm)
                        algorithm="$2"
                        shift 2
                        ;;
                    *)
                        remaining_args+=("$1")
                        shift
                        ;;
                esac
            done
            run_algorithm "$algorithm" "${remaining_args[@]}"
            ;;
        "memory")
            check_prerequisites
            generate_system_info
            run_memory "$@"
            ;;
        "concurrency")
            check_prerequisites
            generate_system_info
            run_concurrency "$@"
            ;;
        "ci")
            check_prerequisites
            run_ci "$@"
            ;;
        "custom")
            check_prerequisites
            generate_system_info
            # Extract config file from arguments
            local config_file=""
            local remaining_args=()
            while [[ $# -gt 0 ]]; do
                case $1 in
                    --config)
                        config_file="$2"
                        shift 2
                        ;;
                    *)
                        remaining_args+=("$1")
                        shift
                        ;;
                esac
            done
            run_custom "$config_file" "${remaining_args[@]}"
            ;;
        "help" | "--help" | "-h" | "")
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Change to project root directory
cd "$PROJECT_ROOT"

# Run main function with all arguments
main "$@"