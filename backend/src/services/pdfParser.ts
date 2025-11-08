import pdfParse from 'pdf-parse';
import * as fs from 'fs';

interface ParsedPdfData {
  text: string;
  numPages: number;
  metadata?: any;
}

/**
 * Parse PDF file and extract text content
 */
export async function parsePdfFile(filePath: string): Promise<ParsedPdfData> {
  try {
    const pdfBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(pdfBuffer);

    return {
      text: data.text,
      numPages: data.numpages,
      metadata: data.metadata,
    };
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}
