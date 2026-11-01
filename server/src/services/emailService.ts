import nodemailer from 'nodemailer';
import { env, isSmtpConfigured } from '../config/env';

export interface EmailSendResult {
  sent: boolean;
  message: string;
}

export async function sendAdminReplyEmail(params: {
  to: string;
  subject: string;
  replyBody: string;
  recipientName: string;
}): Promise<EmailSendResult> {
  if (!isSmtpConfigured()) {
    return {
      sent: false,
      message:
        'SMTP service is not configured (EMAIL_SERVICE_HOST / USER / PASSWORD missing). Reply was saved in MongoDB inbox without sending an external email.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: env.EMAIL_SERVICE_HOST,
      port: env.EMAIL_SERVICE_PORT,
      secure: env.EMAIL_SERVICE_PORT === 465,
      auth: {
        user: env.EMAIL_SERVICE_USER,
        pass: env.EMAIL_SERVICE_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Mahim Dev" <${env.EMAIL_FROM_ADDRESS}>`,
      to: params.to,
      subject: params.subject.startsWith('Re:') ? params.subject : `Re: ${params.subject}`,
      text: `Hi ${params.recipientName},\n\n${params.replyBody}\n\nBest regards,\nMahim Dev`,
    });

    return {
      sent: true,
      message: `Email reply delivered to ${params.to} via configured SMTP transport.`,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'SMTP transport error';
    return {
      sent: false,
      message: `Reply saved to database, but SMTP delivery failed: ${reason}`,
    };
  }
}
