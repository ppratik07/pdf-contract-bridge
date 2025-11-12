import { ethers } from "ethers";
import { compileSolidityContract, DeploymentResult } from "./blockchainDeployment";

/**
 * Deploy contract to Polygon Mumbai testnet
 */
export async function deployToPolygonMumbai(
  solidityCode: string,
  constructorArgs?: any[]
): Promise<DeploymentResult> {
  try {
    console.log("\n========== POLYGON MUMBAI DEPLOYMENT ==========");
    console.log("Step 1: Compiling contract...");

    const compilation = await compileSolidityContract(solidityCode);
    if (!compilation.success) {
      console.error("Compilation failed:", compilation.error);
      return {
        success: false,
        error: `Compilation failed: ${compilation.error}`,
      };
    }

    console.log("✅ Contract compiled successfully");
    console.log("Step 2: Connecting to Polygon Mumbai testnet...");

    const rpcUrl = process.env.POLYGON_MUMBAI_RPC_URL;
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

    if (!rpcUrl) {
      console.error("Missing POLYGON_MUMBAI_RPC_URL in .env");
      return {
        success: false,
        error: "Missing POLYGON_MUMBAI_RPC_URL in environment variables",
      };
    }

    if (!privateKey) {
      console.error("Missing DEPLOYER_PRIVATE_KEY in .env");
      return {
        success: false,
        error: "Missing DEPLOYER_PRIVATE_KEY in environment variables",
      };
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`✅ Connected to Polygon Mumbai`);
    console.log(`Deployer address: ${wallet.address}`);

    console.log("Step 3: Creating contract factory...");
    const factory = new ethers.ContractFactory(
      compilation.abi || [],
      compilation.bytecode || "0x",
      wallet
    );

    console.log("Step 4: Deploying contract...");
    const contract = await factory.deploy(...(constructorArgs || []));
    console.log(`Deployment tx: ${contract.deploymentTransaction()?.hash}`);

    const receipt = await contract.deploymentTransaction()?.wait();
    const contractAddress = await contract.getAddress();

    console.log("✅ Contract deployed successfully!");
    console.log(`Contract Address: ${contractAddress}`);
    console.log(`Block Number: ${receipt?.blockNumber}`);
    console.log(`Gas Used: ${receipt?.gasUsed}`);

    return {
      success: true,
      contractAddress,
      transactionHash: receipt?.hash || "",
      blockNumber: receipt?.blockNumber,
      gasUsed: receipt?.gasUsed?.toString(),
      network: "POLYGON",
    };
  } catch (error) {
    console.error("Deployment error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Deployment failed",
    };
  }
}
