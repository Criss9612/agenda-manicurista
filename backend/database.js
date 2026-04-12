console.log('🔍 Buscando URL en .env:', process.env.DATABASE_URL ? '✅ Encontrada' : '❌ No encontrada');
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// 1. Configuramos el "Pool" (el grupo de conexiones a Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Esto es obligatorio para que Supabase acepte la conexión
  }
});

// 2. Exportamos el objeto 'db' con el método 'query' que usa tu nuevo index.js
export const db = {
  query: (text, params) => pool.query(text, params),
};

// 3. Exportamos la función para iniciar la conexión

export const initDB = async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Conexión exitosa a Supabase');
  } catch (err) {
    console.error('❌ Error crítico de conexión:');
    console.error('CÓDIGO DE ERROR:', err.code); // Nos dirá si es password, red, etc.
    console.error('MENSAJE:', err.message);
    process.exit(1); 
  }
};