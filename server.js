const express = require('express');
const app = express();
app.use(express.json());

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;

app.get('/', (req, res) => {
  res.json({ status: 'Anchor server is running' });
});

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
              <p style="color: #666; font-size: 13px; line-height: 1.5;">This is an automated alert from the Anchor app. Please check in with your contact to make sure they are okay.</p>
              <p style="color: #999; font-size: 11px;">This message was sent because you are listed as a trusted contact in the Anchor app.</p>
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Anchor server running on port ${PORT}`));
