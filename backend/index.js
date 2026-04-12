import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { db, initDB } from './database.js';
import { calculateTotalDuration } from './utils/calculateDuration.js';
import { hasTimeConflict } from './utils/hasTimeConflict.js';
import { sendAppointmentEmail } from './mailer.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Conectar a Supabase al iniciar
await initDB();

// --- 1. RUTAS DE USUARIOS ---

// Obtener todos los usuarios (para validación de login)
app.get('/users', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener usuarios de la base de datos" });
  }
});

// Registrar nuevo cliente
app.post('/users/register', async (req, res) => {
  const { name, email } = req.body;
  try {
    const exists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: "El correo ya está registrado" });
    }

    const newUser = await db.query(
      'INSERT INTO users (id, name, email, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [Date.now(), name, email, 'client']
    );
    res.status(201).json(newUser.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Error en el registro" });
  }
});

// --- 2. RUTAS DE SERVICIOS ---

app.get('/services', async (req, res) => {
  try {
    // Usamos 'as' para que los nombres coincidan con lo que el frontend espera (camelCase)
    const { rows } = await db.query(`
      SELECT id, name, 
      base_duration as "baseDuration", 
      extra_duration_per_unit as "extraDurationPerUnit" 
      FROM services
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Error al cargar servicios" });
  }
});

// --- 3. RUTAS DE DISPONIBILIDAD ---

app.post('/availability', async (req, res) => {
  const { date, services } = req.body;
  try {
    if (!date || !services) return res.status(400).json({ availableSlots: [] });

    // Traer servicios para calcular duración
    const { rows: dbServices } = await db.query('SELECT id, base_duration as "baseDuration", extra_duration_per_unit as "extraDurationPerUnit" FROM services');
    
    const servicesForCalc = services.map(s => ({
      serviceId: s.serviceId,
      quantity: Number(s.units) || 0
    }));

    const totalMinutes = calculateTotalDuration(servicesForCalc, dbServices);

    // Definir horario laboral (9 AM a 6 PM)
    const workStart = 9 * 60; 
    const workEnd = 18 * 60;

    // Citas existentes en ese día
    const { rows: dayAppointments } = await db.query(
      'SELECT start_time as "startTime", end_time as "endTime" FROM appointments WHERE date = $1 AND status != $2',
      [date, 'cancelled']
    );

    const availableSlots = [];
    for (let current = workStart; current + totalMinutes <= workEnd; current += 30) {
      const startStr = `${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}`;
      const endMin = current + totalMinutes;
      const endStr = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

      if (!hasTimeConflict(startStr, endStr, dayAppointments)) {
        availableSlots.push({ startTime: startStr, endTime: endStr });
      }
    }
    res.json({ availableSlots });
  } catch (error) {
    res.status(500).json({ availableSlots: [] });
  }
});

// --- 4. RUTAS DE CITAS ---

// Crear nueva cita
app.post('/appointments', async (req, res) => {
  const { date, startTime, services, userId } = req.body;
  const appointmentId = Date.now();

  try {
    // 1. Obtener datos de servicios para calcular el fin
    const { rows: dbServices } = await db.query('SELECT id, base_duration as "baseDuration", extra_duration_per_unit as "extraDurationPerUnit" FROM services');
    const totalMinutes = calculateTotalDuration(
      services.map(s => ({ serviceId: s.serviceId, quantity: s.units })),
      dbServices
    );

    const [h, m] = startTime.split(':').map(Number);
    const endTotal = (h * 60 + m) + totalMinutes;
    const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;

    // 2. Insertar en tabla appointments
    await db.query(
      'INSERT INTO appointments (id, user_id, date, start_time, end_time, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [appointmentId, userId, date, startTime, endTime, 'scheduled']
    );

    // 3. Insertar detalle en appointment_services
    for (const s of services) {
      await db.query(
        'INSERT INTO appointment_services (appointment_id, service_id, units) VALUES ($1, $2, $3)',
        [appointmentId, s.serviceId, s.units]
      );
    }

    // 4. Obtener nombres de servicios para el EMAIL
    const { rows: srvNames } = await db.query('SELECT name FROM services WHERE id = ANY($1)', [services.map(s => s.serviceId)]);
    const listaServicios = srvNames.map(s => s.name).join(', ');

    sendAppointmentEmail({
      to: 'rosatarazona9612@gmail.com',
      subject: `📌 Nueva Cita: ${date} a las ${startTime}`,
      html: `
        <h1>¡Nueva reserva!</h1>
        <p><b>Cliente ID:</b> ${userId}</p>
        <p><b>Servicios:</b> ${listaServicios}</p>
        <p><b>Horario:</b> ${startTime} - ${endTime}</p>
      `
    });

    res.status(201).json({ message: "Cita creada con éxito" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear la cita" });
  }
});

// Obtener historial o agenda del día
app.get('/appointments', async (req, res) => {
  const { date, userId } = req.query;
  try {
    let query = 'SELECT * FROM appointments WHERE 1=1';
    let params = [];

    if (date) {
      params.push(date);
      query += ` AND date = $${params.length}`;
    }
    if (userId) {
      params.push(userId);
      query += ` AND user_id = $${params.length}`;
    }

    const { rows } = await db.query(query + ' ORDER BY start_time ASC', params);
    res.json({ appointments: rows });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener citas" });
  }
});

// Actualizar estado (Confirmar/Cancelar/Completar)
app.patch('/appointments/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  const statusMap = { 'confirm': 'confirmed', 'cancel': 'cancelled', 'complete': 'completed' };
  const newStatus = statusMap[action];

  try {
    await db.query('UPDATE appointments SET status = $1 WHERE id = $2', [newStatus, id]);
    res.json({ message: `Estado actualizado a ${newStatus}` });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar estado" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});