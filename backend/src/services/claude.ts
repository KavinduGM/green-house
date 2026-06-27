import Anthropic from '@anthropic-ai/sdk';
import { config, hasClaude } from '../config.js';

// Generous timeout + retries: vision calls can be slow and the connection to
// the API occasionally drops mid-response ("Premature close") — retry those.
const client = hasClaude()
  ? new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 4, timeout: 120_000 })
  : null;

type ImageMedia = 'image/jpeg' | 'image/png' | 'image/webp';

function extractJson<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    return match ? (JSON.parse(match[1] ?? match[0]) as T) : fallback;
  } catch {
    return fallback;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function complete(system: string, content: Anthropic.MessageParam['content'], maxTokens = 1500): Promise<string> {
  if (!client) throw new Error('AI is not configured. Set ANTHROPIC_API_KEY on the server.');
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Stream the response and accumulate — far more resilient to dropped
      // connections than a single buffered request (fixes "Premature close").
      const stream = client.messages.stream({
        model: config.anthropicModel,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content }],
      });
      const msg = await stream.finalMessage();
      return msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('\n');
    } catch (e: any) {
      lastErr = e;
      const transient = /premature close|ECONNRESET|ETIMEDOUT|terminated|socket hang up|fetch failed|529|503|overloaded/i.test(
        `${e?.message ?? ''} ${e?.cause?.message ?? ''} ${e?.status ?? ''}`,
      );
      if (!transient || attempt === 2) break;
      await sleep(800 * (attempt + 1));
    }
  }
  throw lastErr;
}

export interface ParsedDiagram {
  bags: Array<{ label: string; x: number; y: number; plant_guess?: string }>;
  rows?: number;
  cols?: number;
  notes?: string;
}

/** Turn a hand-drawn layout photo into structured grow-bag positions (normalized 0..1). */
export async function parseDiagram(base64: string, media: ImageMedia): Promise<ParsedDiagram> {
  const text = await complete(
    `You read hand-drawn greenhouse grow-bag layout sketches and output structured JSON.
The grower draws rough rectangles/circles for grow bags, sometimes in rows, sometimes numbered.
Identify every grow bag and its position. Coordinates are normalized: x and y in 0..1 where
(0,0) is top-left of the drawing and (1,1) is bottom-right. If bags are numbered, keep those labels;
otherwise number them left-to-right, top-to-bottom starting at 1. If any plant names are written
next to a bag, capture them in plant_guess. Output ONLY JSON of shape:
{"bags":[{"label":"1","x":0.12,"y":0.2,"plant_guess":"chilli"}],"rows":N,"cols":M,"notes":"..."}`,
    [
      { type: 'image', source: { type: 'base64', media_type: media, data: base64 } },
      { type: 'text', text: 'Extract the grow-bag layout from this sketch as JSON.' },
    ],
    2000,
  );
  const parsed = extractJson<ParsedDiagram>(text, { bags: [] });
  // sanity clamp
  parsed.bags = (parsed.bags || []).map((b, i) => ({
    label: String(b.label ?? i + 1),
    x: Math.max(0, Math.min(1, Number(b.x) || 0.5)),
    y: Math.max(0, Math.min(1, Number(b.y) || 0.5)),
    plant_guess: b.plant_guess,
  }));
  return parsed;
}

export interface GrowthInsight {
  summary: string;
  status: 'ahead' | 'on_track' | 'behind' | 'unknown';
  recommendations: string[];
}

export async function growthInsight(context: object): Promise<GrowthInsight> {
  const text = await complete(
    `You are an expert greenhouse agronomist for a Sri Lankan grower using grow bags and drip
irrigation. You are given a planting's model timeline plus the grower's actual logged measurements.
Assess whether the crop is ahead/on_track/behind, and give 2-4 short, practical recommendations
(watering, feeding with Albert Solution / YaraMila Target / Grow More K44, pruning, pest watch).
Output ONLY JSON: {"summary":"...","status":"on_track","recommendations":["..."]}`,
    [{ type: 'text', text: JSON.stringify(context) }],
    1200,
  );
  return extractJson<GrowthInsight>(text, {
    summary: 'Not enough data yet — log a height measurement to get an assessment.',
    status: 'unknown',
    recommendations: [],
  });
}

export interface DefectDiagnosis {
  diagnosis: string;
  likely_causes: string[];
  severity: 'low' | 'medium' | 'high';
  treatment: string[];
}

export async function diagnoseDefect(opts: {
  description: string;
  plant: string;
  base64?: string;
  media?: ImageMedia;
}): Promise<DefectDiagnosis> {
  const content: any[] = [];
  if (opts.base64 && opts.media) {
    content.push({ type: 'image', source: { type: 'base64', media_type: opts.media, data: opts.base64 } });
  }
  content.push({
    type: 'text',
    text: `Plant: ${opts.plant}. Symptom described by grower: ${opts.description}. Diagnose.`,
  });
  const text = await complete(
    `You are a plant pathologist. Diagnose the likely problem (pest, fungal, nutrient, water, etc.)
for a greenhouse crop. Give practical treatments suited to a home grower (neem, copper/mancozeb
fungicides, correcting feed/water). Output ONLY JSON:
{"diagnosis":"...","likely_causes":["..."],"severity":"medium","treatment":["..."]}`,
    content,
    1200,
  );
  return extractJson<DefectDiagnosis>(text, {
    diagnosis: 'Could not analyze automatically.',
    likely_causes: [],
    severity: 'medium',
    treatment: ['Isolate the affected plant and monitor.'],
  });
}

export async function askAssistant(question: string, context?: object): Promise<string> {
  return complete(
    `You are the in-app greenhouse assistant for a Sri Lankan grower (crops: brinjal, chilli, tomato,
okra, gourds, herbs). Be concise and practical. Use metric units. Reference the grower's products
(Albert Solution, YaraMila Target, Grow More K44) when relevant.`,
    [{ type: 'text', text: context ? `Context: ${JSON.stringify(context)}\n\nQuestion: ${question}` : question }],
    1000,
  );
}
