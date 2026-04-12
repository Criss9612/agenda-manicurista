/*import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

export async function sendAppointmentEmail({
  to,
  subject,
  html
}) {
  await transporter.sendMail({
    from: `"Agenda Manicurista 💅" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  })
}*/

import nodemailer from 'nodemailer'
import 'dotenv/config'

console.log('Verificando credenciales...');
console.log('Usuario:', process.env.EMAIL_USER ? 'OK' : 'FALTA USUARIO');
console.log('Password:', process.env.EMAIL_PASS ? 'OK' : 'FALTA PASSWORD');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  // --- AÑADE ESTE BLOQUE ---
  tls: {
    rejectUnauthorized: false
  }
})

export async function sendAppointmentEmail({ to, subject, html }) {
  try {
    const info = await transporter.sendMail({
      from: `"Agenda Manicurista 💅" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log('✅ Correo enviado con éxito:', info.messageId);
  } catch (error) {
    // Es vital capturar el error aquí para que no detenga (crash) tu servidor
    console.error('❌ Error detallado de Nodemailer:', error);
  }
}
