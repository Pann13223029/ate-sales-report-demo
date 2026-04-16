import {
  opportunityDraftCandidateSchema,
  parseOpportunityDraftText,
  type OpportunityDraftCandidate,
  type ParsedOpportunityDraftPatch
} from '../domain/opportunity-draft.js';

export interface OpportunityDraftParserConfig {
  geminiApiKey: string | null;
  geminiModel: string;
}

export interface OpportunityDraftParserResult extends ParsedOpportunityDraftPatch {
  parserVersion: string;
  multipleOpportunitiesDetected: boolean;
}

interface GeminiExtractionResponse {
  patch: OpportunityDraftCandidate;
  parseNotes: string[];
  multipleOpportunitiesDetected: boolean;
}

export async function parseOpportunityDraftInput(
  text: string,
  config: OpportunityDraftParserConfig
): Promise<OpportunityDraftParserResult> {
  if (!config.geminiApiKey) {
    const heuristic = parseOpportunityDraftText(text);
    return {
      ...heuristic,
      parserVersion: 'heuristic_v1',
      multipleOpportunitiesDetected: false
    };
  }

  try {
    const geminiResult = await parseOpportunityDraftTextWithGemini(text, config);

    return {
      ...geminiResult,
      parserVersion: 'gemini_v1'
    };
  } catch (error) {
    const fallback = parseOpportunityDraftText(text);
    const fallbackReason = error instanceof Error ? error.message : String(error);

    return {
      patch: fallback.patch,
      parseNotes: [...fallback.parseNotes, `Gemini fallback: ${fallbackReason}`],
      parserVersion: 'heuristic_v1',
      multipleOpportunitiesDetected: false
    };
  }
}

async function parseOpportunityDraftTextWithGemini(
  text: string,
  config: OpportunityDraftParserConfig
): Promise<GeminiExtractionResponse> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      config.geminiModel
    )}:generateContent?key=${encodeURIComponent(config.geminiApiKey ?? '')}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: buildGeminiSystemInstruction()
            }
          ]
        },
        contents: [
          {
            parts: [
              {
                text: buildGeminiUserPrompt(text)
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: buildGeminiResponseSchema()
        }
      })
    }
  );

  const rawJson = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`Gemini request failed with HTTP ${response.status}`);
  }

  const rawText = extractGeminiResponseText(rawJson);

  if (!rawText) {
    throw new Error('Gemini returned no text response');
  }

  const parsed = JSON.parse(rawText) as Record<string, unknown>;

  return sanitizeGeminiExtractionResponse(parsed);
}

function sanitizeGeminiExtractionResponse(
  value: Record<string, unknown>
): GeminiExtractionResponse {
  return {
    patch: opportunityDraftCandidateSchema.parse(stripNullishFields(value)),
    parseNotes: Array.isArray(value.parseNotes)
      ? value.parseNotes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
    multipleOpportunitiesDetected: value.multipleOpportunitiesDetected === true
  };
}

function stripNullishFields(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([key, entry]) => {
      if (key === 'parseNotes' || key === 'multipleOpportunitiesDetected') {
        return false;
      }

      return entry !== null && entry !== undefined;
    })
  );
}

function extractGeminiResponseText(value: Record<string, unknown>): string | null {
  const candidates = Array.isArray(value.candidates) ? value.candidates : [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    const content = (candidate as Record<string, unknown>).content;

    if (!content || typeof content !== 'object') {
      continue;
    }

    const parts = Array.isArray((content as Record<string, unknown>).parts)
      ? ((content as Record<string, unknown>).parts as unknown[])
      : [];

    for (const part of parts) {
      if (!part || typeof part !== 'object') {
        continue;
      }

      const text = (part as Record<string, unknown>).text;

      if (typeof text === 'string' && text.trim().length > 0) {
        return text;
      }
    }
  }

  return null;
}

function buildGeminiSystemInstruction(): string {
  return [
    'You extract exactly one sales opportunity draft from a Telegram sales-report message.',
    'Thai-first, English-friendly.',
    'Return JSON only.',
    'Do not invent missing fields.',
    'If the message clearly contains multiple separate opportunities, set multipleOpportunitiesDetected to true and leave business fields empty.',
    'Normalize expectedCloseDate and nextFollowUpDate to YYYY-MM-DD.',
    'If only a month is known, use the first day of that month and set expectedClosePrecision to month.',
    'Reject vague quarter or relative dates by omitting them.',
    'ValueEurK means EUR (000). Example: 25 means EUR 25,000.',
    'Only set productSegmentCode if the rep explicitly provided it.',
    'Only set notes if the message explicitly contains them.',
    'Use one of these salesStage values only: identified, qualified, quoted, negotiation, waiting_po, closed_won, closed_lost.'
  ].join(' ');
}

function buildGeminiUserPrompt(text: string): string {
  return [
    'Extract a single opportunity draft from this Telegram message.',
    'Message:',
    text
  ].join('\n');
}

function buildGeminiResponseSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      customer: { type: 'string' },
      contactPerson: { type: 'string' },
      contactChannel: { type: 'string' },
      product: { type: 'string' },
      productSegmentCode: {
        type: 'string',
        enum: ['CI', 'GET', 'LVI', 'MRM', 'PDIX', 'PP', 'PT']
      },
      quantity: { type: 'integer' },
      valueEurK: { type: 'number' },
      salesStage: {
        type: 'string',
        enum: [
          'identified',
          'qualified',
          'quoted',
          'negotiation',
          'waiting_po',
          'closed_won',
          'closed_lost'
        ]
      },
      expectedCloseDate: { type: 'string' },
      expectedClosePrecision: {
        type: 'string',
        enum: ['day', 'month']
      },
      nextFollowUpDate: { type: 'string' },
      competitorRaw: { type: 'string' },
      stageNote: { type: 'string' },
      followUpNote: { type: 'string' },
      lostReason: { type: 'string' },
      lostReasonNote: { type: 'string' },
      winNote: { type: 'string' },
      reopenNote: { type: 'string' },
      multipleOpportunitiesDetected: { type: 'boolean' },
      parseNotes: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  };
}
