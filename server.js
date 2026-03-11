const express = require('express');
const app = express();
app.use(express.json());

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;
const SERVER_URL = process.env.SERVER_URL || 'https://anchor-server-tykt.onrender.com';

// In-memory store for pending radius change requests
// In production this would be a database
const pendingRequests = {};

app.get('/', (req, res) => {
  res.json({ status: 'Anchor server is running' });
});

// Send alert email
app.post('/send-alert', async (req, res) => {
  const { to, subject, message } = req.body;
  if (!to || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: 'Anchor App' },
        subject: subject,
        content: [{
          type: 'text/html',
          value: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #0F1923; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h1 style="color: #4A90D9; margin: 0; font-size: 24px;">⚓ Anchor</h1>
                <p style="color: #8E9AAB; margin: 4px 0 0 0; font-size: 12px;">Mental Health Monitoring Alert</p>
              </div>
              <div style="background: #fff3f3; border-left: 4px solid #E74C3C; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #E74C3C; margin: 0 0 10px 0; font-size: 18px;">🚨 Alert Triggered</h2>
                <p style="color: #333; margin: 0; font-size: 15px; line-height: 1.5;">${message}</p>
              </div>
              <p style="color: #666; font-size: 13px;">This is an automated alert from the Anchor app.</p>
            </div>
          `
        }],
      }),
    });
    if (response.status === 202) {
      res.json({ success: true });
    } else {
      const error = await response.text();
      res.status(500).json({ error });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request radius change approval
app.post('/request-radius-change', async (req, res) => {
  const { contactEmail, contactName, userName, currentRadius, newRadius, requestId } = req.body;

  if (!contactEmail || !newRadius || !requestId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Store pending request
  pendingRequests[requestId] = {
    newRadius,
    approved: false,
    createdAt: Date.now(),
  };

  const approveUrl = `${SERVER_URL}/approve-radius/${requestId}`;
  const denyUrl = `${SERVER_URL}/deny-radius/${requestId}`;

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: contactEmail }] }],
        from: { email: FROM_EMAIL, name: 'Anchor App' },
        subject: `⚓ Anchor: ${userName} wants to change their safety radius`,
        content: [{
          type: 'text/html',
          value: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #0F1923; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h1 style="color: #4A90D9; margin: 0; font-size: 24px;">⚓ Anchor</h1>
                <p style="color: #8E9AAB; margin: 4px 0 0 0; font-size: 12px;">Safety Radius Change Request</p>
              </div>
              <div style="background: #f0f7ff; border-left: 4px solid #4A90D9; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #4A90D9; margin: 0 0 10px 0; font-size: 18px;">Radius Change Request</h2>
                <p style="color: #333; font-size: 15px; line-height: 1.5;">
                  <strong>${userName}</strong> is requesting to change their safety radius from 
                  <strong>${currentRadius} miles</strong> to <strong>${newRadius} miles</strong>.
                </p>
                <p style="color: #666; font-size: 13px;">As their designated trusted contact, your approval is required before this change takes effect.</p>
              </div>
              <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                <a href="${approveUrl}" style="display: inline-block; background: #2ECC71; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin-right: 12px;">
                  ✅ Approve Change
                </a>
                <a href="${denyUrl}" style="display: inline-block; background: #E74C3C; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                  ❌ Deny Change
                </a>
              </div>
              <p style="color: #999; font-size: 11px;">This request will expire in 24 hours. If you did not expect this request, please check in with ${userName}.</p>
            </div>
          `
        }],
      }),
    });

    if (response.status === 202) {
      res.json({ success: true, requestId });
    } else {
      const error = await response.text();
      res.status(500).json({ error });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve radius change
app.get('/approve-radius/:requestId', (req, res) => {
  const { requestId } = req.params;
  if (pendingRequests[requestId]) {
    pendingRequests[requestId].approved = true;
    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0F1923;">
          <div style="text-align: center; background: #1E2D3D; padding: 40px; border-radius: 16px; max-width: 400px;">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h1 style="color: #2ECC71; margin: 0 0 12px 0;">Approved!</h1>
            <p style="color: #8E9AAB;">The safety radius change has been approved. The Anchor app will update automatically.</p>
          </div>
        </body>
      </html>
    `);
  } else {
    res.status(404).send(`
      <html>
        <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0F1923;">
          <div style="text-align: center; background: #1E2D3D; padding: 40px; border-radius: 16px;">
            <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
            <h1 style="color: #E74C3C; margin: 0 0 12px 0;">Request Not Found</h1>
            <p style="color: #8E9AAB;">This request may have expired or already been processed.</p>
          </div>
        </body>
      </html>
    `);
  }
});

// Deny radius change
app.get('/deny-radius/:requestId', (req, res) => {
  const { requestId } = req.params;
  if (pendingRequests[requestId]) {
    delete pendingRequests[requestId];
    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0F1923;">
          <div style="text-align: center; background: #1E2D3D; padding: 40px; border-radius: 16px; max-width: 400px;">
            <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
            <h1 style="color: #E74C3C; margin: 0 0 12px 0;">Denied</h1>
            <p style="color: #8E9AAB;">The safety radius change has been denied. The current radius remains unchanged.</p>
          </div>
        </body>
      </html>
    `);
  } else {
    res.status(404).send('Request not found or already processed.');
  }
});

// Check if radius change was approved
app.get('/check-approval/:requestId', (req, res) => {
  const { requestId } = req.params;
  const request = pendingRequests[requestId];
  if (!request) {
    return res.json({ status: 'not_found' });
  }
  if (request.approved) {
    const newRadius = request.newRadius;
    delete pendingRequests[requestId];
    return res.json({ status: 'approved', newRadius });
  }
  return res.json({ status: 'pending' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Anchor server running on port ${PORT}`));
