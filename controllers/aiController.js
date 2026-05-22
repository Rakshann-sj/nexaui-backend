const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper: Call OpenAI chat completion
const chat = async (systemPrompt, userContent) => {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    max_tokens: 600,
    temperature: 0.4,
  });
  return completion.choices[0].message.content.trim();
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Describe an API response in plain English
// @route   POST /api/ai/describe
// @access  Private (Pro/Enterprise)
// ─────────────────────────────────────────────────────────────────────
exports.describeResponse = async (req, res, next) => {
  try {
    const { responseBody, statusCode, url, method } = req.body;

    const content = [
      method && `Method: ${method}`,
      url && `URL: ${url}`,
      statusCode && `HTTP Status: ${statusCode}`,
      `Response:\n${JSON.stringify(responseBody, null, 2)}`,
    ]
      .filter(Boolean)
      .join('\n');

    const description = await chat(
      'You are a helpful API analyst. Explain the given API response in clear, plain English for developers. Keep it concise (3-5 sentences max). Highlight key data returned.',
      content
    );

    res.json({ success: true, description });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Generate a JSON request body from a plain description
// @route   POST /api/ai/generate-body
// @access  Private (Pro/Enterprise)
// ─────────────────────────────────────────────────────────────────────
exports.generateBody = async (req, res, next) => {
  try {
    const { description, method, url } = req.body;

    const userContent = [
      method && `HTTP Method: ${method}`,
      url && `Endpoint: ${url}`,
      `What the request should do: ${description}`,
    ]
      .filter(Boolean)
      .join('\n');

    const raw = await chat(
      'You are an API expert. Generate a realistic, valid JSON request body based on the user\'s description. Return ONLY valid JSON with no markdown, no explanation, no code fences.',
      userContent
    );

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw; // Return as string if not valid JSON
    }

    res.json({ success: true, body });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Analyze an error response and suggest fixes
// @route   POST /api/ai/detect-error
// @access  Private (Pro/Enterprise)
// ─────────────────────────────────────────────────────────────────────
exports.detectError = async (req, res, next) => {
  try {
    const { response, statusCode, url, method } = req.body;

    const content = [
      method && `Method: ${method}`,
      url && `URL: ${url}`,
      statusCode && `HTTP Status: ${statusCode}`,
      `Error Response:\n${JSON.stringify(response, null, 2)}`,
    ]
      .filter(Boolean)
      .join('\n');

    const analysis = await chat(
      'You are a debugging expert. Analyze the API error response, explain in 1-2 sentences what went wrong, then give 2-3 specific, actionable fixes the developer should try. Format: "What went wrong: ... Suggested fixes: 1. ... 2. ... 3. ..."',
      content
    );

    res.json({ success: true, analysis });
  } catch (err) {
    next(err);
  }
};
