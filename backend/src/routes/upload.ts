import { Router, Request, Response } from "express";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { parsePdfFile } from "../services/pdfParser";
import { extractContractData } from "../services/contractExtractor";
import { generateSolidityContract } from "../services/solidityGenerator";
import { deployContract } from "../services/blockchainDeployment";
import prisma from "../lib/prisma";

const router = Router();

//Creating directory for uploads if it doesn't exist
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

//multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `contract-${uniqueSuffix}.pdf`);
  },
});

//upload middleware
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

interface UploadRequestBody {
  blockchain?: string;
  deploy?: boolean;
}

router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const { blockchain = "ethereum", deploy = false } = req.body as UploadRequestBody;
    const filePath = req.file.path;
    const fileName = req.file.originalname;

    // Step 1: Parse PDF
    console.log("Step 1: Parsing PDF...");
    const parsedPdf = await parsePdfFile(filePath);

    // Step 2: Extract contract data using pattern matching
    console.log("Step 2: Extracting contract data...");
    const contractData = await extractContractData(parsedPdf.text);

    // Step 3: Generate Solidity contract
    console.log("Step 3: Generating Solidity contract...");
    const solidityCode = await generateSolidityContract(contractData);

    let deploymentAddress: string | null = null;
    let deploymentTx: string | null = null;

    // Step 4: Deploy if requested
    if (deploy) {
      console.log("Step 4: Deploying contract...");
      const deploymentResult = await deployContract(solidityCode, blockchain);
      deploymentAddress = deploymentResult.address;
      deploymentTx = deploymentResult.transactionHash;
    }

    // Step 5: Save to database
    console.log("Step 5: Saving to database...");
    const conversion = await prisma..create({
      data: {
        fileName,
        fileHash: req.file.filename,
        contractType: contractData.type,
        pdfUrl: `/uploads/${req.file.filename}`,
        solidityCode,
        contractData: JSON.stringify(contractData),
        blockchain,
        deploymentAddress,
        deploymentTxHash: deploymentTx,
        status: deploy ? "DEPLOYED" : "GENERATED",
      },
    });

    // Clean up uploaded file after processing
    fs.unlinkSync(filePath);

    // Step 6: Return response
    res.status(200).json({
      success: true,
      message: "Contract processed successfully",
      data: {
        id: conversion.id,
        fileName: conversion.fileName,
        contractType: conversion.contractType,
        blockchain,
        solidityCode,
        contractData,
        deploymentAddress,
        deploymentTxHash: deploymentTx,
        status: conversion.status,
        createdAt: conversion.createdAt,
      },
    });
  } catch (error) {
    // Clean up file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        // File cleanup error - continue
      }
    }

    console.error("Error processing file:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "Error processing file",
      message: errorMessage,
    });
  }
});

export default router;
