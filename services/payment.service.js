const QRCode = require('qrcode');

async function generateVietQR(bankCode, accountNumber, amount, content) {
  const vietQRUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.jpg?amount=${amount}&addInfo=${content}`;

  
  const qrImage = await QRCode.toDataURL(vietQRUrl);
  
  return vietQRUrl;
}

module.exports = { generateVietQR };