const nodemailer = require('nodemailer');

// Address of the site, used to build the links in emails
const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
const MAIL_FROM = process.env.MAIL_FROM || 'Sweeple <no-reply@localhost>';

// Emails go out over SMTP when SMTP_HOST is set. Otherwise they are printed
// to the backend log, so the links can be copied during local development.
let transport = null;
if (process.env.SMTP_HOST) {
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
}

// Tests replace this to capture outgoing mail instead of sending it
let sender = async (message) => {
  if (transport) {
    await transport.sendMail({ from: MAIL_FROM, ...message });
  } else if (process.env.NODE_ENV !== 'test') {
    console.log(`[email] To: ${message.to}\nSubject: ${message.subject}\n${message.text}`);
  }
};

function setSender(fn) {
  sender = fn;
}

function sendVerificationEmail(user, token) {
  const link = `${APP_URL}/api/auth/verify-email?token=${token}`;
  return sender({
    to: user.email,
    subject: 'Verify your Sweeple account',
    text:
      `Hi ${user.firstName || user.username},\n\n` +
      `Confirm your email address to finish creating your account:\n${link}\n\n` +
      'The link expires in 24 hours. If you did not sign up, you can ignore this email.'
  });
}

function sendPasswordResetEmail(user, token) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  return sender({
    to: user.email,
    subject: 'Reset your Sweeple password',
    text:
      `Hi ${user.firstName || user.username},\n\n` +
      `Use this link to choose a new password:\n${link}\n\n` +
      'The link expires in 1 hour. If you did not ask for this, you can ignore this email.'
  });
}

module.exports = {
  APP_URL,
  sendVerificationEmail,
  sendPasswordResetEmail,
  setSender
};
