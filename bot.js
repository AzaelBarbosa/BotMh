require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { TwitterApi } = require('twitter-api-v2');
const { Pool } = require('pg');

// Configuración de credenciales para Discord y Twitter
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    port: process.env.DATABASE_PORT,
});

// Verificar la conexión a la base de datos
pool.connect((err) => {
    if (err) {
        console.error("Error al conectar a la base de datos:", err.message);
    } else {
        console.log("Conectado a la base de datos PostgreSQL.");
    }
});

// Crear tabla de builds si no existe
pool.query(`CREATE TABLE IF NOT EXISTS builds (
    id SERIAL PRIMARY KEY,
    tipo TEXT NOT NULL,
    arma TEXT NOT NULL,
    version TEXT NOT NULL,
    youtube TEXT
)`, (err) => {
    if (err) {
        console.error("Error al crear la tabla:", err.message);
    } else {
        console.log("Tabla 'builds' lista para su uso.");
    }
});

client.on('messageCreate', async (message) => {
    // Comando para guardar una build en la base de datos
    if (message.content.startsWith("!set_build")) {
        const args = message.content.split(" ").slice(1);
        if (args.length < 4) {
            message.channel.send("Uso: !set_build <Tipo> <Arma> <Versión> <YouTube>");
            return;
        }

        const [tipo, arma, version, youtube] = args;
        pool.query(
            `INSERT INTO builds (tipo, arma, version, youtube) VALUES ($1, $2, $3, $4)`,
            [tipo, arma, version, youtube],
            (err) => {
                if (err) {
                    console.error("Error al insertar en la base de datos:", err.message);
                    message.channel.send("Ocurrió un error al guardar la build.");
                } else {
                    message.channel.send("Build guardada correctamente.");
                }
            }
        );
    }

    // Comando para obtener una build específica
    else if (message.content.startsWith("!get_build")) {
        const tipo = message.content.split(" ")[1];
        pool.query(`SELECT * FROM builds WHERE tipo = $1`, [tipo], (err, res) => {
            if (err) {
                console.error("Error al consultar la base de datos:", err.message);
                message.channel.send("Ocurrió un error al buscar la build.");
            } else if (res.rows.length > 0) {
                const build = res.rows[0];
                message.channel.send(`Build - Tipo: ${build.tipo}, Arma: ${build.arma}, Versión: ${build.version}, YouTube: ${build.youtube}`);
            } else {
                message.channel.send("No se encontró ninguna build con ese tipo.");
            }
        });
    }
});
