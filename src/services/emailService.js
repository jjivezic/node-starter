import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import logger from '../config/logger.js';

const OAuth2 = google.auth.OAuth2;

class EmailService {
  constructor() {
    this.oauth2Client = new OAuth2(
      process.env.GOOGLE_EMAIL_CLIENT_ID,
      process.env.GOOGLE_EMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    this.oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_EMAIL_REFRESH_TOKEN
    });

    this.init();
  }

  async init() {
    try {
      const tokenData = await this.oauth2Client.getAccessToken();
      logger.debug('Initial email OAuth data received');
      return tokenData;
    } catch (err) {
      logger.error(`Error initiating email transport: ${err.message}`);
    }
  }

  async _provisionCallback(user, renew, callback) {
    try {
      const tokenData = await this.oauth2Client.getAccessToken();
      logger.debug('Refresh email access token');
      if (!tokenData.token) {
        return callback(new Error('Unknown user'));
      }
      return callback(null, tokenData.token, tokenData.res?.data?.expiry_date);
    } catch (error) {
      return callback(error);
    }
  }

  async getTransport() {
    try {
      const tokenData = await this.oauth2Client.getAccessToken();

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GOOGLE_EMAIL_USER,
          accessToken: tokenData?.token,
          clientId: process.env.GOOGLE_EMAIL_CLIENT_ID,
          clientSecret: process.env.GOOGLE_EMAIL_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_EMAIL_REFRESH_TOKEN,
          provisionCallback: this._provisionCallback.bind(this)
        }
      });

      return transporter;
    } catch (error) {
      logger.error(`Error creating email transporter: ${error.message}`);
      throw error;
    }
  }

  async sendEmail({ to, subject, text, html }) {
    try {
      const transporter = await this.getTransport();

      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Your App'}" <${process.env.GOOGLE_EMAIL_USER}>`,
        to,
        subject,
        text,
        html: html || text
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Email sending failed: ${error.message}`);
      throw error;
    }
  }

  async sendWelcomeEmail(user) {
    const subject = 'Welcome to Our Platform';
    const html = `
      <h1>Welcome, ${user.name}!</h1>
      <p>Thank you for joining us.</p>
      <p>Your account has been successfully created.</p>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request';
    const html = `
      <h1>Password Reset Request</h1>
      <p>Hi ${user.name},</p>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  async sendVerificationEmail(user, verificationToken) {
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    const subject = 'Email Verification';
    const html = `
      <h1>Verify Your Email</h1>
      <p>Hi ${user.name},</p>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verifyUrl}">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
    `;

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }
}

export default new EmailService();
