import OpenAI from "openai";

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
    [key: string]: any;
  };
  summary: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

//  Extract structured contract data from PDF text using OpenAI

export async function extractContractData(
  pdfText: string
): Promise<ContractData> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not set, falling back to pattern matching...");
    return extractContractDataWithPatterns(pdfText);
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a legal contract analyst. Extract structured information from contracts.
Return ONLY valid JSON with this structure:
{
  "type": "Service Agreement|Purchase Agreement|Employment Contract|Lease Agreement|NDA|Loan Agreement|Other",
  "parties": ["Party 1", "Party 2"],
  "terms": {
    "payment": "2000 USDC or amount",
    "duration": "10 days or time period",
    "trigger": "after delivery or trigger condition",
    "startDate": "date or null",
    "endDate": "date or null",
    "obligations": ["obligation 1", "obligation 2"]
  }
}`,
        },
        {
          role: "user",
          content: `Extract from this text:\n\n${pdfText.substring(0, 2000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return extractContractDataWithPatterns(pdfText);
    }

    const extractedData = JSON.parse(jsonMatch[0]) as ContractData;

    if (
      !extractedData.type ||
      !extractedData.parties ||
      extractedData.parties.length === 0
    ) {
      return extractContractDataWithPatterns(pdfText);
    }

    extractedData.summary = createSummary(extractedData);
    return extractedData;
  } catch (error) {
    console.error("OpenAI extraction error:", error);
    return extractContractDataWithPatterns(pdfText);
  }
}

/**
 * Fallback pattern-based extraction
 */
function extractContractDataWithPatterns(pdfText: string): ContractData {
  const cleanText = pdfText.replace(/\s+/g, " ").trim();

  return {
    type: extractContractType(cleanText),
    parties: extractParties(cleanText),
    terms: {
      payment: extractPaymentTerms(cleanText),
      duration: extractDuration(cleanText),
      trigger: extractTrigger(cleanText),
      startDate: extractStartDate(cleanText),
      endDate: extractEndDate(cleanText),
      obligations: extractObligations(cleanText),
    },
    summary: "",
  };
}

function extractContractType(text: string): string {
  const types = [
    { pattern: /service\s+agreement/i, type: "Service Agreement" },
    { pattern: /purchase\s+agreement/i, type: "Purchase Agreement" },
    { pattern: /employment\s+contract/i, type: "Employment Contract" },
    { pattern: /lease\s+agreement/i, type: "Lease Agreement" },
    { pattern: /non[^a-z]*disclosure/i, type: "NDA" },
    { pattern: /loan\s+agreement/i, type: "Loan Agreement" },
  ];

  for (const { pattern, type } of types) {
    if (pattern.test(text)) {
      return type;
    }
  }

  return "Service Agreement";
}

function extractParties(text: string): string[] {
  const parties: string[] = [];

  const patterns = [
    /(?:between|by and between)\s+([^,]+)\s+(?:and|AND)\s+([^,.\n]+)/i,
    /(?:party|Party)\s+(?:first|1st)\s*[:=]?\s*([^,.\n]+)/i,
    /(?:party|Party)\s+(?:second|2nd)\s*[:=]?\s*([^,.\n]+)/i,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      parties.push(
        ...matches
          .slice(1)
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      );
    }
  }

  return [...new Set(parties)];
}

function extractPaymentTerms(text: string): string | undefined {
  const patterns = [
    /(?:payment|amount)\s*[:=]?\s*(?:\$|USD|EUR|USDC)?\s*([0-9,]+(?:\.[0-9]{2})?)\s*([A-Z]{0,4})?/i,
    /(\$?[0-9,]+(?:\.[0-9]{2})?)\s+(?:USD|EUR|USDC|dollars|euros)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return undefined;
}

function extractDuration(text: string): string | undefined {
  const pattern =
    /(?:duration|term|period|for)\s+(?:a\s+)?([0-9]+\s+(?:days?|weeks?|months?|years?))/i;
  const match = text.match(pattern);
  return match ? match[1].trim() : undefined;
}

function extractTrigger(text: string): string | undefined {
  const patterns = [
    /(?:upon|after|on)\s+([^,.\n]*?(?:delivery|completion|signing|receipt|acceptance))/i,
    /(?:payment\s+)?(?:trigger|condition)\s*[:=]?\s*([^,.\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}

function extractStartDate(text: string): string | undefined {
  const pattern =
    /(?:start|commence)(?:ment|ing)?\s+(?:date)?\s*[:=]?\s*([^,.\n]+)/i;
  const match = text.match(pattern);
  return match ? match[1].trim() : undefined;
}

function extractEndDate(text: string): string | undefined {
  const pattern =
    /(?:end|expiration|expires?|termination|completion)\s+(?:date)?\s*[:=]?\s*([^,.\n]+)/i;
  const match = text.match(pattern);
  return match ? match[1].trim() : undefined;
}

function extractObligations(text: string): string[] {
  const obligations: string[] = [];
  const patterns = [
    /(?:shall|must|required to|agrees to)\s+([^,.\n]{10,150})/gi,
    /(?:obligation|duty|responsibility)\s*[:=]?\s*([^,.\n]{10,150})/gi,
  ];

  for (const pattern of patterns) {
    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = pattern.exec(text)) !== null) {
      const obligation = match[1].trim();
      if (obligation.length > 10 && obligation.length < 200) {
        obligations.push(obligation);
      }
    }
  }

  return [...new Set(obligations)].slice(0, 5);
}

function createSummary(data: ContractData): string {
  const partiesText =
    data.parties.length > 0 ? ` between ${data.parties.join(", ")}` : "";
  const paymentText = data.terms.payment
    ? ` - Payment: ${data.terms.payment}`
    : "";
  const durationText = data.terms.duration
    ? ` - Duration: ${data.terms.duration}`
    : "";

  return `${data.type}${partiesText}${paymentText}${durationText}`;
}

export async function extractContractDataWithCustomPrompt(
  pdfText: string,
  customPrompt: string
): Promise<ContractData> {
  if (!process.env.OPENAI_API_KEY) {
    return extractContractDataWithPatterns(pdfText);
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: customPrompt },
        { role: "user", content: `Extract:\n\n${pdfText.substring(0, 2000)}` },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("No JSON found");
    }

    return JSON.parse(jsonMatch[0]) as ContractData;
  } catch (error) {
    console.error("Custom extraction error:", error);
    return extractContractDataWithPatterns(pdfText);
  }
}
