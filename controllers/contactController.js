const Message = require('../models/Message');
const sendEmail = require('../config/mailer');

// ─────────────────────────────────────────────────────────────────────
// @desc    Submit a contact form message
// @route   POST /api/contact
// @access  Public
// ─────────────────────────────────────────────────────────────────────
exports.submitContact = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    // Save to DB
    await Message.create({ name, email, subject, message });
try {
  await fetch('http://localhost:5678/webhook/nexaui-contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      email,
      subject,
      message
    })
  });
} catch (err) {
  console.error('n8n webhook failed:', err.message);
}
    // Notify admin + auto-reply to sender (non-blocking)
    Promise.all([
      sendEmail({
        to: process.env.EMAIL_USER,
        subject: `[NexaUI Contact] ${subject || 'New Inquiry'} — from ${name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;">
            <h2 style="color:#6c63ff;">📨 New Contact Message</h2>
            <table style="width:100%;border-collapse:collapse;margin-top:16px;">
              <tr style="background:#f5f5f5;">
                <td style="padding:10px;font-weight:bold;color:#555;width:100px;">Name</td>
                <td style="padding:10px;">${name}</td>
              </tr>
              <tr>
                <td style="padding:10px;font-weight:bold;color:#555;">Email</td>
                <td style="padding:10px;">
                  <a href="mailto:${email}">${email}</a>
                </td>
              </tr>
              <tr style="background:#f5f5f5;">
                <td style="padding:10px;font-weight:bold;color:#555;">Subject</td>
                <td style="padding:10px;">${subject || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding:10px;font-weight:bold;color:#555;vertical-align:top;">Message</td>
                <td style="padding:10px;">${message}</td>
              </tr>
            </table>
          </div>
        `,
      }),

      sendEmail({
        to: email,
        subject: `We got your message, ${name} — NexaUI`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">
            <h2 style="color:#6c63ff;">Thanks for reaching out, ${name}!</h2>

            <p>
              We've received your message and will get back to you within
              <strong>24 hours</strong>.
            </p>

            <blockquote style="border-left:3px solid #6c63ff;padding-left:16px;color:#666;margin:20px 0;">
              "${message}"
            </blockquote>

            <p style="color:#888;font-size:12px;">
              — The NexaUI Team
            </p>
          </div>
        `,
      }),
    ]).catch((err) =>
      console.error('Contact email error:', err.message)
    );

    res.status(201).json({
      success: true,
      message: 'Message sent successfully. We will get back to you soon!',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// @desc    Get all messages (admin)
// @route   GET /api/contact
// @access  Private
// ─────────────────────────────────────────────────────────────────────
exports.getMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unread } = req.query;

    const query = {};

    if (unread === 'true') {
      query.isRead = false;
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));

    const [messages, total] = await Promise.all([
      Message.find(query)
        .sort('-createdAt')
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),

      Message.countDocuments(query),
    ]);

    res.json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      count: messages.length,
      messages,
    });
  } catch (err) {
    next(err);
  }
};
