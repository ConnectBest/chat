import nodemailer from 'nodemailer';

// Force Node.js runtime for nodemailer (not Edge Runtime compatible)
export const runtime = 'nodejs';

// Email transporter configuration - Static code Backend team please change it to dynamic
// In production, use real SMTP credentials from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password',
  },
});

export async function sendVerificationEmail(
  to: string,
  verificationCode: string,
  userName: string
) {
  const loginUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login?verify=${verificationCode}`;

  const mailOptions = {
    from: `"ConnectBest Chat" <${process.env.EMAIL_FROM || 'noreply@connectbest.com'}>`,
    to,
    subject: '🔐 Verify Your Email - ConnectBest Chat',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
            .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 24px; }
            .logo { font-size: 32px; font-weight: bold; color: #4F46E5; }
            .code-box { background: #F3F4F6; border: 2px dashed #4F46E5; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0; }
            .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4F46E5; }
            .button { display: inline-block; background: #4F46E5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
            .footer { text-align: center; color: #6B7280; font-size: 14px; margin-top: 24px; }
            .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; margin: 16px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <div class="logo">🔐 ConnectBest</div>
                <h1 style="margin: 8px 0; color: #1F2937;">Verify Your Email</h1>
              </div>
              
              <p>Hi <strong>${userName}</strong>,</p>
              <p>Welcome to ConnectBest Chat! To complete your login, please verify your email address using the code below:</p>
              
              <div class="code-box">
                <div class="code">${verificationCode}</div>
              </div>
              
              <p style="text-align: center;">Or click the button below to verify automatically:</p>
              
              <div style="text-align: center;">
                <a href="${loginUrl}" class="button">Verify & Login</a>
              </div>
              
              <div class="warning">
                <strong>⏰ This code expires in 15 minutes</strong><br>
                If you didn't request this verification, please ignore this email.
              </div>
              
              <p>For security reasons, please do not share this code with anyone.</p>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} ConnectBest Chat. All rights reserved.</p>
                <p style="font-size: 12px; margin-top: 8px;">This is an automated email. Please do not reply.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Hi ${userName},

Welcome to ConnectBest Chat! 

Your verification code is: ${verificationCode}

Or click this link to verify: ${loginUrl}

This code expires in 15 minutes.

If you didn't request this verification, please ignore this email.

© ${new Date().getFullYear()} ConnectBest Chat
    `
  };

  const isDev = process.env.NODE_ENV === 'development';

  try {
    // 開發模式：多印 log，**但不提早 return，一定會跑 sendMail**
    if (isDev) {
      console.log('📧 Sending Verification Email');
      console.log('To:', to);
      console.log('Code:', verificationCode);
      console.log('Login URL:', loginUrl);
    }

    await transporter.sendMail(mailOptions);
    return { success: true, dev: isDev };
  } catch (error) {
    console.error('Failed to send verification email:', error);

    // dev 環境：不要把整個登入流程炸掉，但回傳失敗給呼叫端判斷
    if (isDev) {
      console.log('⚠️ Email sending failed in dev mode, please check SMTP (.env.local & Mailtrap)');
      return { success: false, dev: true };
    }

    // prod：讓上層知道真的寄信失敗
    throw new Error('Failed to send verification email');
  }
}

export async function sendWelcomeEmail(to: string, userName: string) {
  const mailOptions = {
    from: `"ConnectBest Chat" <${process.env.EMAIL_FROM || 'noreply@connectbest.com'}>`,
    to,
    subject: '🎉 Welcome to ConnectBest Chat!',
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1 style="color: #4F46E5;">Welcome, ${userName}! 🎉</h1>
          <p>Your account has been successfully created.</p>
          <p>You can now:</p>
          <ul>
            <li>💬 Chat with team members in real-time</li>
            <li>📂 Share files and documents</li>
            <li>🔍 Search through message history</li>
            <li>👥 Create channels and direct messages</li>
          </ul>
          <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/chat" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Start Chatting</a></p>
        </body>
      </html>
    `
  };

  try {
    const hasRealSmtp =
      !!process.env.EMAIL_HOST &&
      !!process.env.EMAIL_USER &&
      !!process.env.EMAIL_PASSWORD;

    if (!hasRealSmtp) {
      console.log('📧 Welcome Email (SMTP NOT CONFIGURED) - To:', to);
      return { success: true, dev: true };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Sending welcome email via real SMTP (development mode) - To:', to);
    }

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    if (process.env.NODE_ENV === 'development') {
      return { success: false, dev: true };
    }
    return { success: false };
  }
}