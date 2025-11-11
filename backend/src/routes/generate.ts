import { Router, Request, Response } from "express";
import { generateSolidityContract } from "../services/solidityGenerator";
import prisma from "../lib/prisma";

const router = Router();

interface ContractData {
  type: string;
  parties: string[];
  terms: {
    payment?: string;
    duration?: string;
    trigger?: string;
    startDate?: string;
    endDate?: string;
    obligations?: string[];
  };
}

interface GenerateRequestBody {
  conversionId: string;
  contractData: ContractData;
}

/**
 * POST /api/generate
 * Generate Solidity smart contract from extracted contract data
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { conversionId, contractData } = req.body as GenerateRequestBody;

    // Validate input
    if (!contractData) {
      return res.status(400).json({
        error: "Missing contractData in request body",
      });
    }

    if (!contractData.type || !contractData.parties || contractData.parties.length === 0) {
      return res.status(400).json({
        error: "contractData must include type and at least one party",
      });
    }

    console.log("Generating Solidity contract...");
    console.log("Contract Type:", contractData.type);
    console.log("Parties:", contractData.parties);
    console.log("Terms:", contractData.terms);

    // Generate the Solidity code
    const solidityCode = await generateSolidityContract(contractData);

    console.log("Solidity contract generated successfully");

    // If conversionId is provided, update the database record
    let updatedConversion = null;
    if (conversionId) {
      updatedConversion = await prisma.conversion.update({
        where: { id: conversionId },
        data: {
          processingStep: "GENERATE_CONTRACT",
        },
      });
    }

    // Return the generated contract code
    res.status(200).json({
      success: true,
      message: "Smart contract generated successfully",
      data: {
        conversionId: conversionId || null,
        contractCode: solidityCode,
        contractType: contractData.type,
        parties: contractData.parties,
        terms: contractData.terms,
        generatedAt: new Date().toISOString(),
        instructions: {
          deployment: "Use the contractCode above to deploy on Ethereum, Polygon, or Solana",
          parties: "Provide wallet addresses for all parties when deploying",
          funding: "Ensure sufficient gas for deployment transaction",
          verification: "Verify contract on blockchain explorer after deployment",
        },
      },
    });
  } catch (error) {
    console.error("Error generating contract:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "Error generating contract",
      message: errorMessage,
    });
  }
});

export default router;
