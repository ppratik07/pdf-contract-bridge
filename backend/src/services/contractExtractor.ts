interface ContractData {
  type: string;
  parties: string[];
  paymentTerms: string | null;
  keyTerms: Record<string, string>;
  summary: string;
}

/**
 * Extract structured contract data from PDF text using pattern matching and NLP
 * This is a basic implementation that can be enhanced with actual AI/NLP services
 * like OpenAI GPT, Hugging Face, or specialized legal contract APIs
 */
export async function extractContractData(pdfText: string): Promise<ContractData> {
  // Remove extra whitespace
  const cleanText = pdfText.replace(/\s+/g, ' ').trim();

  // Extract contract type
  const contractType = extractContractType(cleanText);

  // Extract parties
  const parties = extractParties(cleanText);

  // Extract payment terms
  const paymentTerms = extractPaymentTerms(cleanText);

  // Extract key terms
  const keyTerms = extractKeyTerms(cleanText);

  // Create summary
  const summary = createSummary(contractType, parties, paymentTerms);

  return {
    type: contractType,
    parties,
    paymentTerms,
    keyTerms,
    summary,
  };
}

/**
 * Extract contract type from text
 */
function extractContractType(text: string): string {
  const types = [
    { pattern: /service\s+agreement/i, type: 'ServiceAgreement' },
    { pattern: /purchase\s+agreement/i, type: 'PurchaseAgreement' },
    { pattern: /employment\s+contract/i, type: 'EmploymentContract' },
    { pattern: /lease\s+agreement/i, type: 'LeaseAgreement' },
    { pattern: /non[^a-z]*disclosure/i, type: 'NDA' },
    { pattern: /loan\s+agreement/i, type: 'LoanAgreement' },
    { pattern: /payment\s+terms/i, type: 'PaymentTerms' },
  ];

  for (const { pattern, type } of types) {
    if (pattern.test(text)) {
      return type;
    }
  }

  return 'GeneralContract';
}

/**
 * Extract parties from contract text
 */
function extractParties(text: string): string[] {
  const parties: string[] = [];

  // Common patterns for party identification
  const patterns = [
    /(?:between|by and between)\s+([^,]+)\s+(?:and|AND)\s+([^,.\n]+)/i,
    /(?:party|Party)(?:\s+(?:of|of the))?\s+(?:first|1(?:st)?|a)\s*[:=]?\s*([^,.\n]+)/i,
    /(?:party|Party)(?:\s+(?:of|of the))?\s+(?:second|2(?:nd)?|b)\s*[:=]?\s*([^,.\n]+)/i,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      parties.push(...matches.slice(1).map(p => p.trim()).filter(p => p.length > 0));
    }
  }

  return [...new Set(parties)];
}

/**
 * Extract payment terms from contract text
 */
function extractPaymentTerms(text: string): string | null {
  const paymentPattern = /(?:payment|Payment).*?(?:terms|Terms|conditions|Conditions)[:=]?\s*([^.\n]+)/i;
  const match = text.match(paymentPattern);
  return match ? match[1].trim() : null;
}

/**
 * Extract key terms and values from contract
 */
function extractKeyTerms(text: string): Record<string, string> {
  const keyTerms: Record<string, string> = {};

  // Extract common contract terms
  const termPatterns = {
    duration: /(?:duration|term)\s*[:=]?\s*([^,.\n]+)/i,
    startDate: /(?:start|commence)(?:ment)?\s+(?:date)?\s*[:=]?\s*([^,.\n]+)/i,
    endDate: /(?:end|expiration|expires?|termination)\s+(?:date)?\s*[:=]?\s*([^,.\n]+)/i,
    amount: /(?:amount|payment)\s*[:=]?\s*(?:\$|USD|EUR)?\s*([0-9,]+(?:\.[0-9]{2})?)/i,
    venue: /(?:governed by|jurisdiction|law)\s*[:=]?\s*([^,.\n]+)/i,
  };

  for (const [key, pattern] of Object.entries(termPatterns)) {
    const match = text.match(pattern);
    if (match) {
      keyTerms[key] = match[1].trim();
    }
  }

  return keyTerms;
}

/**
 * Create a summary of the contract
 */
function createSummary(type: string, parties: string[], paymentTerms: string | null): string {
  const partiesText = parties.length > 0 ? ` between ${parties.join(', ')}` : '';
  const paymentText = paymentTerms ? ` with payment terms: ${paymentTerms}` : '';

  return `${type}${partiesText}${paymentText}`;
}

/**
 * For enhanced extraction, integrate with AI services like OpenAI
 * This is a placeholder for future implementation
 */
export async function extractContractDataWithAI(pdfText: string): Promise<ContractData> {
  // TODO: Integrate with OpenAI API or similar service
  // For now, fall back to pattern-based extraction
  return extractContractData(pdfText);
}
