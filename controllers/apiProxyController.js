const axios = require('axios');
const RequestLog = require('../models/RequestLog');

// ─────────────────────────────────────────────────────────────────────
// @desc    Forward a user's API request to any external URL
// @route   POST /api/proxy
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.proxyRequest = async (req, res, next) => {
  try {
    const { url, method, headers = {}, body, projectId } = req.body;

    const startTime = Date.now();
    let statusCode = null;
    let responseBody = null;
    let errorMsg = null;

    try {
      const axiosConfig = {
        method: method.toLowerCase(),
        url,
        headers,
        timeout: 15000, // 15s timeout to avoid hanging
        validateStatus: () => true, // Don't throw on non-2xx
      };

      if (['post', 'put', 'patch'].includes(method.toLowerCase()) && body) {
        axiosConfig.data = body;
      }

      const response = await axios(axiosConfig);
      statusCode = response.status;
      responseBody = response.data;
    } catch (axiosErr) {
      errorMsg = axiosErr.message;
      statusCode = axiosErr.response?.status || 0;
      responseBody = axiosErr.response?.data || null;
    }

    const responseTime = Date.now() - startTime;

    // Save request log to DB
    await RequestLog.create({
      user: req.user._id,
      project: projectId || null,
      method: method.toUpperCase(),
      url,
      requestHeaders: headers,
      requestBody: body || null,
      statusCode,
      responseBody,
      responseTime,
      error: errorMsg,
    });

    res.json({
      success: true,
      statusCode,
      responseTime,
      responseBody,
      error: errorMsg,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Get paginated request history for current user
// @route   GET /api/proxy/history
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.getHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, projectId, method, status } = req.query;

    const query = { user: req.user._id };
    if (projectId) query.project = projectId;
    if (method) query.method = method.toUpperCase();
    if (status) query.statusCode = parseInt(status);

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const [logs, total] = await Promise.all([
      RequestLog.find(query)
        .sort('-createdAt')
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .select('method url statusCode responseTime error createdAt project'),
      RequestLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      count: logs.length,
      logs,
    });
  } catch (err) {
    next(err);
  }
};
