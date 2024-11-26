# Quantum Entropy: What We Know (and Don't Know)

## The Circuit Basics

Our quantum circuit actually does:

```
First, each qubit gets hit with an sx gate (square root of NOT) - this creates a partial superposition
Then it applies rz (rotation around Z-axis) gates with different angles:

First 8 qubits: π/2 rotation (stronger)
Last 8 qubits: π/8 rotation (more subtle)


Finally another sx gate before measurement
```

## What We Actually Know

1. **Measurement Results**:

   - We get 1024 measurements of 16 qubits
   - Each measurement gives us a 16-bit string
   - The distribution of these results determines entropy

2. **Sources of Variation**:
   - Quantum superposition and interference
   - Hardware noise and imperfections
   - Environmental effects on the quantum system
   - Decoherence during operation

## What Makes This Quantum (Not Just Random)

The entropy variations come from several quantum effects:

1. Quantum interference between the SX gates and RZ rotations
2. The way superposition states evolve
3. How quantum measurements collapse these states
4. Real quantum hardware effects

## Why We See Different Entropy Levels

We can actually partially explain the variations:

- High entropy runs: Superposition states remained more "quantum"
- Low entropy runs: Some quantum states may have decohered more
- Medium entropy: Mix of these effects

However, we cannot predict exactly what will happen in any given run - this is fundamental quantum behavior, not just randomness or noise.

## The Real Mystery

What we truly don't know:

- Exact state of the quantum system between operations
- Precise impact of environmental interactions
- Why specific patterns emerge in specific runs

This is different from classical randomness because:

1. The variations have quantum signatures
2. The patterns show quantum interference effects
3. The results depend on quantum mechanical principles

## Important Note

While we don't know the exact outcome of each run, we do understand the quantum mechanics behind why variations occur. The mystery isn't in why there are variations, but in predicting specific outcomes.
