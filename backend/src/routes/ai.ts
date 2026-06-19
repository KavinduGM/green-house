import { Router } from 'express';
import { hasClaude } from '../config.js';
import { askAssistant } from '../services/claude.js';

export const aiRouter = Router();

aiRouter.get('/status', (_req, res) => res.json({ enabled: hasClaude() }));

aiRouter.post('/ask', async (req, res) => {
  if (!hasClaude()) return res.status(400).json({ error: 'AI not configured on server.' });
  const { question, context } = req.body ?? {};
  if (!question) return res.status(400).json({ error: 'question required' });
  try {
    res.json({ answer: await askAssistant(String(question), context) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
