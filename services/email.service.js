const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // or other SMTP service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send email OTP for account registration
exports.sendOTPEmail = async (email, otpCode) => {
  await transporter.sendMail({
    from: `"Grand Hotel" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🌟 Your Registration Verification Code (OTP) - Grand Hotel',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; padding: 30px; background-color: #f9f9f9;">
        <div style="text-align: center;">
          <img src="https://res.cloudinary.com/dgyb5zpqr/image/upload/v1751275465/splash-logo5_jtqk7w.png" alt="Grand Hotel" width="100" style="margin-bottom: 20px;" />
          <h2 style="color: #6b4f4f;">Verify Your Account</h2>
        </div>
        <p style="font-size: 16px; color: #333;">
          Thank you for registering at <strong>Grand Hotel</strong>, one of the most prestigious hotel chains.  
          To complete your registration, please use the OTP code below:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; letter-spacing: 5px; background-color: #fff3cd; padding: 15px 25px; border-radius: 10px; display: inline-block; color: #856404; font-weight: bold;">
            ${otpCode}
          </span>
        </div>
        <p style="font-size: 14px; color: #555;">
          This code is valid for <strong>5 minutes</strong>. If you did not request this, please ignore this email.
        </p>
        <hr style="margin: 40px 0; border: none; border-top: 1px solid #ccc;" />
        <p style="font-size: 12px; color: #aaa; text-align: center;">
          © 2025 Grand Hotel. All rights reserved.<br/>
          Need assistance? Contact us at: dinhquochuy.2004hl@gmail.com
        </p>
      </div>
    `
  });
};

// Send email OTP for password reset
exports.sendResetPasswordEmail = async (email, otpCode) => {
  await transporter.sendMail({
    from: `"Grand Hotel" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔐 Your Password Reset Code (OTP) - Grand Hotel',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; padding: 30px; background-color: #f9f9f9;">
        <div style="text-align: center;">
          <img src="https://res.cloudinary.com/dgyb5zpqr/image/upload/v1751275465/splash-logo5_jtqk7w.png" alt="Grand Hotel" width="100" style="margin-bottom: 20px;" />
          <h2 style="color: #6b4f4f;">Reset Your Password</h2>
        </div>
        <p style="font-size: 16px; color: #333;">
          We have received a request to reset your password for your <strong>Grand Hotel</strong> account.  
          Please use the OTP code below to proceed:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; letter-spacing: 5px; background-color: #fff3cd; padding: 15px 25px; border-radius: 10px; display: inline-block; color: #856404; font-weight: bold;">
            ${otpCode}
          </span>
        </div>
        <p style="font-size: 14px; color: #555;">
          This code is valid for <strong>5 minutes</strong>. If you did not request a password reset, please ignore this email or contact us immediately if you suspect unauthorized access.
        </p>
        <hr style="margin: 40px 0; border: none; border-top: 1px solid #ccc;" />
        <p style="font-size: 12px; color: #aaa; text-align: center;">
          © 2025 Grand Hotel. All rights reserved.<br/>
          Need assistance? Contact us at: dinhquochuy.2004hl@gmail.com
        </p>
      </div>
    `
  });
};
