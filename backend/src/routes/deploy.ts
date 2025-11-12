import { Router, Request, Response } from "express";

import prisma from "../lib/prisma";
import { compileSolidityContract } from "../services/compileSolidityContract";
import { deployContractToBlockchain } from "../services/blockchainDeployment";
import { getBlockExplorerUrl } from "../services/getBlockExplorerUrl";

const router = Router();

interface DeployRequestBody {
  solidityCode: string;
  blockchain: "ethereum" | "polygon";
  conversionId?: string;
  contractType?: string;
  fileName?: string;
  constructorArgs?: any[];
}

/**
 * POST /api/deploy
 * Compile and deploy smart contract to blockchain testnet
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {solidityCode,blockchain,conversionId,contractType,fileName,constructorArgs} = req.body as DeployRequestBody;

    // Validate input
    if (!solidityCode) {
      return res.status(400).json({
        error: "solidityCode is required",
      });
    }

    if (!blockchain || !["ethereum", "polygon"].includes(blockchain)) {
      return res.status(400).json({
        error: "blockchain must be 'ethereum' or 'polygon'",
      });
    }

    console.log("\n🚀 === DEPLOYMENT REQUEST RECEIVED ===");
    console.log(`Blockchain: ${blockchain}`);
    console.log(`Conversion ID: ${conversionId || "N/A"}`);
    console.log(`Contract Type: ${contractType || "N/A"}`);

    // Step 1: Validate Solidity code
    console.log("\n📋 Step 1: Validating and compiling Solidity code...");
    const validation = await compileSolidityContract(solidityCode);
    if (!validation.success) {
      console.error("Compilation failed:", validation.error);
      return res.status(400).json({
        error: "Contract compilation failed",
        details: validation.error,
        warnings: validation.warnings,
      });
    }
    console.log("Solidity code is valid and compiled");
    if (validation.warnings && validation.warnings.length > 0) {
      console.warn("Compilation warnings:", validation.warnings);
    }

    // Step 2: Deploy to blockchain
    console.log(`\n🔗 Step 2: Deploying to ${blockchain}...`);
    const deploymentResult = await deployContractToBlockchain(
      solidityCode,
      blockchain,
      constructorArgs
    );

    if (!deploymentResult.success) {
      console.error("Deployment failed:", deploymentResult.error);
      return res.status(500).json({
        error: "Deployment failed",
        message: deploymentResult.error,
      });
    }

    console.log("✅ Contract deployed successfully!");
    console.log(`📍 Contract Address: ${deploymentResult.contractAddress}`);
    console.log(`📝 TX Hash: ${deploymentResult.transactionHash}`);

    // Step 3: Save deployment record to database
    console.log("\n💾 Step 3: Saving deployment record to database...");

    let deployedContractRecord = null;

    if (conversionId) {
      // Link to existing conversion
      deployedContractRecord = await prisma.deployedContract.create({
        data: {
          contractAddress: deploymentResult.contractAddress || "",
          blockchain:
            (deploymentResult.network?.toUpperCase() as
              | "ETHEREUM"
              | "POLYGON"
              | "SOLANA") || "POLYGON",
          transactionHash: deploymentResult.transactionHash || "",
          solidityCode,
          compiledBytecode: validation.bytecode,
          gasUsed: deploymentResult.gasUsed,
          compilerVersion: "0.8.20",
          conversionId,
        },
      });

      // Update conversion status
      await prisma.conversion.update({
        where: { id: conversionId },
        data: {
          status: "DEPLOYING",
          processingStep: "DEPLOY",
        },
      });

      console.log("Deployment record saved and conversion updated");
    } else {
      // Note: DeployedContract requires conversionId due to schema design
      console.warn(
        "⚠️ Warning: DeployedContract requires a conversionId to be stored"
      );
      return res.status(400).json({
        error: "conversionId is required to save deployment record",
      });
    }

    // Prepare block explorer URL
    const explorerUrl = getBlockExplorerUrl(
      deploymentResult.network || "",
      deploymentResult.contractAddress || ""
    );

    console.log(`🔍 Block Explorer: ${explorerUrl}`);
    console.log("\n✅ === DEPLOYMENT COMPLETE ===\n");

    res.status(200).json({
      success: true,
      message: `Contract deployed successfully to ${blockchain}`,
      data: {
        contractAddress: deploymentResult.contractAddress,
        transactionHash: deploymentResult.transactionHash,
        blockchain: blockchain.toUpperCase(),
        blockNumber: deploymentResult.blockNumber,
        gasUsed: deploymentResult.gasUsed,
        deployedAt: new Date().toISOString(),
        conversionId,
        fileName,
        contractType,
        explorerUrl,
        compilation: {
          contractName: validation.contractName,
          bytecodeSize: validation.bytecode?.length || 0,
          compilerVersion: "0.8.20",
          optimized: true,
          optimizationRuns: 200,
          warnings: validation.warnings || [],
        },
        testnetInfo: {
          network:
            blockchain === "ethereum" ? "Ethereum Sepolia" : "Polygon Mumbai",
          rpcUrl:
            blockchain === "ethereum"
              ? process.env.ETHEREUM_SEPOLIA_RPC_URL
              : process.env.POLYGON_MUMBAI_RPC_URL,
        },
      },
    });
  } catch (error) {
    console.error("\nDeploy error:", error);
    res.status(500).json({
      error: "Failed to deploy contract",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/deploy/status/:conversionId
 * Get deployment status for a conversion
 */
router.get("/status/:conversionId", async (req: Request, res: Response) => {
  try {
    const { conversionId } = req.params;

    const deployedContract = await prisma.deployedContract.findFirst({
      where: { conversionId },
    });

    if (!deployedContract) {
      return res.status(404).json({
        error: "Deployment not found for this conversion",
      });
    }

    const explorerUrl = getBlockExplorerUrl(
      deployedContract.blockchain,
      deployedContract.contractAddress
    );

    res.status(200).json({
      success: true,
      data: {
        ...deployedContract,
        explorerUrl,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch deployment status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/deploy/address/:contractAddress
 * Get contract details by address
 */
router.get("/address/:contractAddress", async (req: Request, res: Response) => {
  try {
    const { contractAddress } = req.params;

    const contract = await prisma.deployedContract.findFirst({
      where: { contractAddress },
    });

    if (!contract) {
      return res.status(404).json({
        error: "Contract not found",
      });
    }

    const explorerUrl = getBlockExplorerUrl(
      contract.blockchain,
      contract.contractAddress
    );

    res.status(200).json({
      success: true,
      data: {
        ...contract,
        explorerUrl,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch contract",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/deploy/networks
 * Get available networks for deployment
 */
router.get("/networks", async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      networks: [
        {
          name: "Ethereum Sepolia",
          id: "ethereum",
          testnet: true,
          chainId: 11155111,
          rpcUrl: "https://sepolia.infura.io/v3/YOUR_KEY",
          faucet: "https://www.alchemy.com/faucets/ethereum-sepolia",
          explorer: "https://sepolia.etherscan.io",
          nativeCurrency: "ETH",
        },
        {
          name: "Polygon Mumbai",
          id: "polygon",
          testnet: true,
          chainId: 80001,
          rpcUrl: "https://rpc-mumbai.maticvigil.com",
          faucet: "https://faucet.polygon.technology/",
          explorer: "https://mumbai.polygonscan.com",
          nativeCurrency: "MATIC",
        },
      ],
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch networks",
    });
  }
});

export default router;
