import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import logger from '../config/logger.js';
import { 
  baseEmailTemplate, 
  welcomeEmailBody, 
  passwordResetBody, 
  verificationEmailBody 
} from '../templates/emailTemplate.js';

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
    const html = baseEmailTemplate({
      title: 'Welcome!',
      body: welcomeEmailBody(user.name)
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request';
    const html = baseEmailTemplate({
      title: 'Reset Your Password',
      body: passwordResetBody(user.name, resetUrl)
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  async sendVerificationEmail(user, verificationToken) {
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    const subject = 'Email Verification';
    const html = baseEmailTemplate({
      title: 'Verify Your Email',
      body: verificationEmailBody(user.name, verifyUrl)
    });

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }
}

export default new EmailService();
