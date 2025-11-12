import { ethers } from "ethers";
import { deployToEthereumSepolia } from "./deployToEtherium";
import { deployToPolygonMumbai } from "./deployToPolygon";


export interface DeploymentResult {
  success: boolean;
  contractAddress?: string;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
  network?: string;
}

export interface CompilationResult {
  success: boolean;
  abi?: any;
  bytecode?: string;
  contractName?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Main deployment router based on blockchain selection
 */
export async function deployContractToBlockchain(
  solidityCode: string,
  blockchain: "ethereum" | "polygon",
  constructorArgs?: any[]
): Promise<DeploymentResult> {
  console.log(`\n🚀 Starting deployment to ${blockchain}...`);

  switch (blockchain.toLowerCase()) {
    case "ethereum":
      return deployToEthereumSepolia(solidityCode, constructorArgs);
    case "polygon":
      return deployToPolygonMumbai(solidityCode, constructorArgs);
    default:
      return {
        success: false,
        error: `Unknown blockchain: ${blockchain}. Use 'ethereum' or 'polygon'`,
      };
  }
}


