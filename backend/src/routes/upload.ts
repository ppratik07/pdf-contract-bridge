import { Router, Request, Response } from "express";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { parsePdfFile } from "../services/pdfParser";
import { extractContractData } from "../services/contractExtractor";
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
  userId?: string;
}

router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { userId = "default-user" } = req.body as UploadRequestBody;
    const filePath = req.file.path;
    const fileName = req.file.originalname;

    console.log("Step 1: Parsing PDF...");
    const parsedPdf = await parsePdfFile(filePath);

    console.log("Step 2: Extracting contract data...");
    const contractData = await extractContractData(parsedPdf.text);

    console.log("Step 3: Saving to database...");
    const conversion = await prisma.conversion.create({
      data: {
        userId,
        originalFileName: fileName,
        fileUrl: `/uploads/${req.file.filename}`,
        contractType: contractData.type,
        status: "COMPLETED",
        processingStep: "COMPLETED",
        extractedData: {
          create: {
            parties: contractData.parties.join(", "),
            contractType: contractData.type,
            paymentAmount: contractData.terms.payment || undefined,
            obligations: JSON.stringify(contractData.terms.obligations || []),
            startDate: new Date(),
          },
        },
      },
    });

    // Clean up uploaded file after processing
    fs.unlinkSync(filePath);
    res.status(200).json({
      success: true,
      message: "Contract extracted successfully",
      data: {
        conversionId: conversion.id,
        fileName: conversion.originalFileName,
        type: contractData.type,
        parties: contractData.parties,
        terms: {
          payment: contractData.terms.payment,
          duration: contractData.terms.duration,
          trigger: contractData.terms.trigger,
          startDate: contractData.terms.startDate,
          endDate: contractData.terms.endDate,
          obligations: contractData.terms.obligations,
        },
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
