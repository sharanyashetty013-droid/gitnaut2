import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initDatabase } from './server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite tables
initDatabase();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'gitnaut_cosmic_jwt_secret_token_2026';

app.use(express.json());
app.use(cookieParser());

interface AuthRequest extends express.Request {
  user?: {
    id: string;
    email: string;
    created_at: string;
  };
}

function requireAuth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    const user = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(payload.userId) as
      | { id: string; email: string; created_at: string }
      | undefined;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

/* ================= AUTHENTICATION & PROGRESS ENDPOINTS ================= */

// POST /api/signup: validate email + password (min 8 chars), hash with bcrypt, insert.
// If the email already exists, return 409 "Account already exists".
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(trimmedEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'Account already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = randomUUID();
    const createdAt = new Date().toISOString();

    db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
      userId,
      trimmedEmail,
      passwordHash,
      createdAt
    );

    const token = jwt.sign({ userId, email: trimmedEmail }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      user: {
        id: userId,
        email: trimmedEmail,
        created_at: createdAt,
      },
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Server error during signup' });
  }
});

// POST /api/login: only succeeds if the account exists and password matches.
// Wrong email and wrong password both return the same generic 401 "Invalid credentials".
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, email, password_hash, created_at FROM users WHERE LOWER(email) = LOWER(?)').get(trimmedEmail) as
      | { id: string; email: string; password_hash: string; created_at: string }
      | undefined;

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login' });
  }
});

// GET /api/me: protected, returns the current user
app.get('/api/me', requireAuth, (req: AuthRequest, res) => {
  return res.json({ user: req.user });
});

// POST /api/logout: clears the cookie
app.post('/api/logout', (_req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  return res.json({ success: true });
});

// GET /api/progress: protected, loads mission mastery and streak for the logged-in user
app.get('/api/progress', requireAuth, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const rows = db.prepare('SELECT id, user_id, mission_id, mastery, streak, updated_at FROM progress WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
  return res.json({ progress: rows });
});

// POST /api/progress: protected, saves mission mastery and streak for the logged-in user
app.post('/api/progress', requireAuth, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const now = new Date().toISOString();

  const items = Array.isArray(req.body)
    ? req.body
    : Array.isArray(req.body.items)
    ? req.body.items
    : Array.isArray(req.body.progress)
    ? req.body.progress
    : req.body.mission_id
    ? [req.body]
    : [];

  if (items.length === 0) {
    return res.status(400).json({ error: 'No progress items provided' });
  }

  const findStmt = db.prepare('SELECT id FROM progress WHERE user_id = ? AND mission_id = ?');
  const updateStmt = db.prepare('UPDATE progress SET mastery = ?, streak = ?, updated_at = ? WHERE id = ?');
  const insertStmt = db.prepare('INSERT INTO progress (id, user_id, mission_id, mastery, streak, updated_at) VALUES (?, ?, ?, ?, ?, ?)');

  for (const item of items) {
    const missionId = item.mission_id || item.missionId;
    if (!missionId) continue;
    const mastery = typeof item.mastery === 'number' ? item.mastery : Number(item.mastery) || 1;
    const streak = typeof item.streak === 'number' ? item.streak : Number(item.streak) || 0;

    const existing = findStmt.get(userId, missionId) as { id: string } | undefined;
    if (existing) {
      updateStmt.run(mastery, streak, now, existing.id);
    } else {
      insertStmt.run(randomUUID(), userId, missionId, mastery, streak, now);
    }
  }

  const allProgress = db.prepare('SELECT id, user_id, mission_id, mastery, streak, updated_at FROM progress WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
  return res.json({ success: true, progress: allProgress });
});

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Cache for generated TTS audio
const ttsCache = new Map<string, { audio: string; mimeType: string; timestamp: number }>();

// High-speed in-memory response cache for frequent questions
const askCache = new Map<string, { answer: string; timestamp: number }>();

// Pre-seed frequent Git beginner questions for zero-latency instant response with natural, non-dramatic explanations
const PRESEEDED_ANSWERS: Record<string, string> = {
  'what is a commit?': 
    'A **commit** is a saved snapshot of your project files at a specific point in time. Like a checkpoint, it records your files so you can review history or roll back whenever needed.\n\n```bash\ngit commit -m "feat: add user login"\n```',
  'what is a commit': 
    'A **commit** is a saved snapshot of your project files at a specific point in time. Like a checkpoint, it records your files so you can review history or roll back whenever needed.\n\n```bash\ngit commit -m "feat: add user login"\n```',
  'why do i need git add?': 
    '`git add` stages changes before saving them. Even if you edit multiple files, staging allows you to choose exactly which changes belong together in your next commit.\n\n```bash\ngit add src/index.ts\n```',
  'why do i need git add': 
    '`git add` stages changes before saving them. Even if you edit multiple files, staging allows you to choose exactly which changes belong together in your next commit.\n\n```bash\ngit add src/index.ts\n```',
  'what is a branch in space terms?': 
    'A **branch** is an independent line of development. It lets you safely work on new features or experiments without disturbing your main code, then merge them back when you are ready.\n\n```bash\ngit switch -c feat/navigation-update\n```',
  'what is a branch in space terms': 
    'A **branch** is an independent line of development. It lets you safely work on new features or experiments without disturbing your main code, then merge them back when you are ready.\n\n```bash\ngit switch -c feat/navigation-update\n```',
  'what is a branch and why use it?':
    'A **branch** is an isolated workspace where you can develop new features or test changes without affecting your stable main branch. When your changes are tested and ready, you merge them into main.\n\n```bash\ngit switch -c new-feature\n```',
  'what is a branch and why use it':
    'A **branch** is an isolated workspace where you can develop new features or test changes without affecting your stable main branch. When your changes are tested and ready, you merge them into main.\n\n```bash\ngit switch -c new-feature\n```',
  'how do i undo my last commit?': 
    'To undo your last commit while keeping your work safe in your working directory, run `git reset --soft HEAD~1`. If you want to create a safe reversal commit without rewriting history, use `git revert HEAD`.\n\n```bash\ngit reset --soft HEAD~1\n```',
  'how do i undo my last commit': 
    'To undo your last commit while keeping your work safe in your working directory, run `git reset --soft HEAD~1`. If you want to create a safe reversal commit without rewriting history, use `git revert HEAD`.\n\n```bash\ngit reset --soft HEAD~1\n```',
  'i\'m stuck on this mission': 
    'Start by running `git status` to see the current state of your files and what is staged. Check the mission instructions at the top, verify your command syntax matches the required objective, and test your command.\n\n```bash\ngit status\n```',
  'i am stuck on this mission': 
    'Start by running `git status` to see the current state of your files and what is staged. Check the mission instructions at the top, verify your command syntax matches the required objective, and test your command.\n\n```bash\ngit status\n```',
};

Object.entries(PRESEEDED_ANSWERS).forEach(([q, ans]) => {
  askCache.set(q.toLowerCase(), { answer: ans, timestamp: Date.now() });
});

// Track if Gemini server-side models are accessible for this project
let isGeminiTtsAvailable = Boolean(apiKey);
let isGeminiApiAvailable = Boolean(apiKey);

// Safely probe API key permissions on startup without logging errors
(async () => {
  if (!apiKey) {
    isGeminiApiAvailable = false;
    isGeminiTtsAvailable = false;
    return;
  }
  try {
    await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: 'hi',
      config: { maxOutputTokens: 1 },
    });
  } catch {
    // If project has restricted or denied access, disable remote API calls cleanly
    isGeminiApiAvailable = false;
    isGeminiTtsAvailable = false;
  }
})();

// Natural conversational Git tutor engine (used for instant caching & permission fallback)
function getNaturalGitResponse(question: string, context?: string): string {
  const q = question.toLowerCase();
  
  if (q.includes('commit')) {
    return 'A **commit** is a saved snapshot of your project files at a specific point in time. Like a checkpoint, it records your files so you can review history or roll back whenever needed.\n\n```bash\ngit commit -m "feat: add user login"\n```';
  }
  if (q.includes('add') || q.includes('stage')) {
    return '`git add` moves changed files into the staging area before saving them. Staging lets you choose exactly which changes belong together in your next commit.\n\n```bash\ngit add src/index.ts\n```';
  }
  if (q.includes('branch') || q.includes('switch') || q.includes('checkout')) {
    return 'A **branch** is an isolated workspace where you can develop new features without touching stable production code. You can switch between branches freely and merge your work back when it is ready.\n\n```bash\ngit switch -c feat/navigation-update\n```';
  }
  if (q.includes('undo') || q.includes('revert') || q.includes('reset')) {
    return 'To undo your last commit while keeping your work safe in your working directory, run `git reset --soft HEAD~1`. If you want to create a safe reversal commit without rewriting history, use `git revert HEAD`.\n\n```bash\ngit reset --soft HEAD~1\n```';
  }
  if (q.includes('stuck') || q.includes('mission')) {
    return `Start by running \`git status\` to see the current state of your files and what is staged. Check the mission instructions at the top, verify your command syntax matches the required objective, and test your command.\n\n\`\`\`bash\ngit status\n\`\`\``;
  }
  if (q.includes('push')) {
    return '`git push` uploads your local commits to a remote cloud repository like GitHub so teammates can review and collaborate on your work.\n\n```bash\ngit push origin main\n```';
  }
  if (q.includes('pull') || q.includes('fetch')) {
    return '`git pull` downloads new commits from the remote repository and immediately integrates them into your current branch. It combines `git fetch` and `git merge` in one step.\n\n```bash\ngit pull origin main\n```';
  }
  if (q.includes('merge') || q.includes('conflict')) {
    return 'A merge conflict occurs when two branches edit the exact same lines of a file and Git pauses for you to choose the correct version. Open the file, remove the conflict markers (`<<<<<<<` and `>>>>>>>`), then stage and commit.\n\n```bash\ngit add <file> && git commit -m "fix: resolve conflict"\n```';
  }
  if (q.includes('rebase')) {
    return '`git rebase` lifts up your branch commits and replays them one by one at the very tip of the target branch, keeping project history clean and linear.\n\n```bash\ngit rebase main\n```';
  }
  if (q.includes('stash')) {
    return '`git stash` temporarily shelves your uncommitted changes into a safe pocket, restoring your working directory to a clean state so you can switch branches urgently.\n\n```bash\ngit stash\n```';
  }
  if (q.includes('cherry-pick') || q.includes('cherry')) {
    return '`git cherry-pick` surgically applies a single specific commit from another branch directly onto your current branch without merging the entire branch.\n\n```bash\ngit cherry-pick <hash>\n```';
  }
  if (q.includes('ignore') || q.includes('.gitignore')) {
    return 'A `.gitignore` file specifies intentionally untracked files that Git should ignore, such as `.env` files with secret API keys and heavy folders like `node_modules/`.\n\n```bash\n# in .gitignore\nnode_modules/\n.env\n```';
  }
  if (q.includes('diff')) {
    return '`git diff` shows line-by-line differences between your current working files and the last commit. Green lines (+) represent additions, while red lines (-) represent deletions.\n\n```bash\ngit diff\n```';
  }
  if (q.includes('log')) {
    return '`git log` displays the chronological list of commits in your repository with authors, dates, and messages. Press Q to exit the log view in your terminal.\n\n```bash\ngit log --oneline --graph\n```';
  }
  if (q.includes('simpler')) {
    return 'Think of Git like a document with unlimited undo. Staging (`git add`) is placing papers into an envelope, and committing (`git commit`) is sealing and stamping that envelope with a date.';
  }
  if (q.includes('example')) {
    return 'Here is a complete Git workflow example from creating a branch to saving changes:\n\n```bash\ngit switch -c feat/user-profile\ngit add .\ngit commit -m "feat: create user profile page"\n```';
  }
  if (q.includes('quiz')) {
    return 'Here is a quick question: If you modified `app.js` and want to inspect your unstaged changes before adding them to the staging area, which command should you run?\n\n*Answer: `git diff`*';
  }

  return `In Git, you can inspect your current repository state anytime using \`git status\`. It shows your active branch, unstaged modifications, and files ready for commit.\n\n\`\`\`bash\ngit status\n\`\`\``;
}

async function streamAnswer(answerText: string, res: express.Response) {
  const words = answerText.split(' ');
  for (let i = 0; i < words.length; i += 3) {
    const chunk = words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '');
    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    if ((res as any).flush) (res as any).flush();
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  res.write('data: [DONE]\n\n');
  res.end();
}

// Natural, non-dramatic TTS endpoint
app.post('/api/tts', async (req, res) => {
  const { text, voice = 'Kore' } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid text parameter' });
  }

  const trimmedText = text.trim();
  const cacheKey = `${voice}:${trimmedText.toLowerCase()}`;
  const cached = ttsCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 60 * 24) {
    return res.json({ audio: cached.audio, mimeType: cached.mimeType, fromCache: true });
  }

  if (!apiKey || !isGeminiTtsAvailable) {
    return res.json({ fallbackToClient: true });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: trimmedText,
              speechMetadata: {
                style: 'Natural, calm, warm, conversational, and clear. Avoid overly dramatic, theatrical, or cartoonish inflection. Speak like a helpful, friendly colleague speaking at normal conversational pace.',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.json({ fallbackToClient: true });
    }

    const result = { audio: base64Audio, mimeType: 'audio/wav', timestamp: Date.now() };
    ttsCache.set(cacheKey, result);

    if (ttsCache.size > 100) {
      const oldestKey = ttsCache.keys().next().value;
      if (oldestKey) ttsCache.delete(oldestKey);
    }

    return res.json({ audio: result.audio, mimeType: result.mimeType });
  } catch {
    // Fallback silently to client Web Speech API if remote TTS is restricted
    isGeminiTtsAvailable = false;
    return res.json({ fallbackToClient: true });
  }
});

// Natural, calm conversational Q&A endpoint
app.post('/api/ask', async (req, res) => {
  const { question, context } = req.body;
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid question parameter' });
  }

  const cleanQuestion = question.trim();
  const normalizedKey = cleanQuestion.toLowerCase().replace(/[?!.]+$/, '').trim();

  // Send SSE headers immediately with no-buffering flags
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (res.flushHeaders) {
    res.flushHeaders();
  }

  // 1. Instant Cache Check for immediate response (<10ms)
  const cached = askCache.get(normalizedKey) || askCache.get(cleanQuestion.toLowerCase());
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 60 * 48) {
    const words = cached.answer.split(' ');
    // Stream cached tokens rapidly
    for (let i = 0; i < words.length; i += 3) {
      const chunk = words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '');
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      if ((res as any).flush) (res as any).flush();
      await new Promise((resolve) => setTimeout(resolve, 12));
    }
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  if (!apiKey || !isGeminiApiAvailable) {
    const naturalAns = getNaturalGitResponse(cleanQuestion, context);
    await streamAnswer(naturalAns, res);
    return;
  }

  // Natural, grounded tutor instruction without theatricality
  const systemInstruction = 
    `You are Gitnaut, a friendly, clear, and natural Git tutor for beginners. Explain concepts in a calm, conversational, and direct way in 2 to 3 concise sentences. Use clear everyday language and practical explanations. Avoid overly dramatic, theatrical, or cartoonish sci-fi roleplay. If helpful, include one short command example. Keep responses under 90 words. ${context ? `The student is currently working on: ${context}.` : ''}`;

  try {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-3.1-flash-lite',
      contents: cleanQuestion,
      config: {
        systemInstruction,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
        temperature: 0.3,
        maxOutputTokens: 250,
      },
    });

    let fullAnswer = '';
    for await (const chunk of stream) {
      if (chunk.text) {
        fullAnswer += chunk.text;
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        if ((res as any).flush) {
          (res as any).flush();
        }
      }
    }

    // Save to cache for rapid subsequent retrieval
    if (fullAnswer.trim().length > 10) {
      askCache.set(normalizedKey, { answer: fullAnswer, timestamp: Date.now() });
      if (askCache.size > 300) {
        const oldestKey = askCache.keys().next().value;
        if (oldestKey) askCache.delete(oldestKey);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch {
    // If Gemini call fails or access is restricted, disable remote calls cleanly and stream natural response
    isGeminiApiAvailable = false;
    const naturalAns = getNaturalGitResponse(cleanQuestion, context);
    await streamAnswer(naturalAns, res);
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gitnaut server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
