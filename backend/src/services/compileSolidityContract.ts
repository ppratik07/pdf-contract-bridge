import { CompilationResult } from "./blockchainDeployment";
// @ts-ignore - solc doesn't have TypeScript definitions but works fine
import solc from "solc";
/**
 * Compile Solidity contract using solc compiler
 * Production-ready compilation with full error handling
 */
export async function compileSolidityContract(
  solidityCode: string
): Promise<CompilationResult> {
  try {
    // Input validation
    if (!solidityCode || solidityCode.trim().length === 0) {
      return {
        success: false,
        error: "Empty Solidity code provided",
      };
    }

    if (!solidityCode.includes("pragma solidity")) {
      return {
        success: false,
        error: "Missing pragma solidity declaration",
      };
    }

    if (!solidityCode.includes("contract ")) {
      return {
        success: false,
        error: "Missing contract declaration",
      };
    }

    console.log("Compiling Solidity contract with solc...");

    // Setup compilation input
    const input = {
      language: "Solidity",
      sources: {
        "Contract.sol": {
          content: solidityCode,
        },
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        outputSelection: {
          "*": {
            "*": ["abi", "evm.bytecode", "evm.bytecode.object"],
          },
        },
      },
    };

    // Compile using solc
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    // Check for compilation errors
    if (output.errors && output.errors.length > 0) {
      const errors = output.errors.filter(
        (error: any) => error.severity === "error"
      );
      const warnings = output.errors.filter(
        (error: any) => error.severity === "warning"
      );

      if (errors.length > 0) {
        const errorMessages = errors
          .map((e: any) => e.message)
          .join("; ");
        console.error("Compilation errors:", errorMessages);
        return {
          success: false,
          error: `Compilation failed: ${errorMessages}`,
          warnings: warnings.map((w: any) => w.message),
        };
      }

      // Log warnings but continue if no errors
      if (warnings.length > 0) {
        console.warn(
          "Compilation warnings:",
          warnings.map((w: any) => w.message)
        );
      }
    }

    // Extract contract details from compilation output
    const contracts = output.contracts["Contract.sol"];
    if (!contracts || Object.keys(contracts).length === 0) {
      return {
        success: false,
        error: "No contracts found in compilation output",
      };
    }

    // Get the first (or only) contract
    const contractName = Object.keys(contracts)[0];
    const contract = contracts[contractName];

    if (!contract.abi || !contract.evm || !contract.evm.bytecode) {
      return {
        success: false,
        error: "Missing ABI or bytecode in compilation output",
      };
    }

    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    console.log(`Compilation successful`);
    console.log(`Contract: ${contractName}`);
    console.log(`Bytecode size: ${bytecode.length} bytes`);
    console.log(`ABI functions: ${abi.filter((item: any) => item.type === "function").length}`);

    return {
      success: true,
      abi,
      bytecode,
      contractName,
      warnings: [],
    };
  } catch (error) {
    console.error("Compilation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Compilation failed",
    };
  }
}