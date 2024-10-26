require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { TwitterApi } = require('twitter-api-v2');
const { Pool } = require('pg');

// Configuración de credenciales para Discord y Twitter
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const TWITTER_USERNAME = process.env.TWITTER_USERNAME;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});


const twitterClient = new TwitterApi(TWITTER_BEARER_TOKEN);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,  // Para conexiones seguras en Railway
    },
});

// Verificar la conexión a la base de datos
pool.connect((err) => {
    if (err) {
        console.error("Error al conectar a la base de datos:", err.message);
    } else {
        console.log("Conectado a la base de datos PostgreSQL.");
    }
});

pool.query(`CREATE TABLE IF NOT EXISTS builds2 (
    id SERIAL PRIMARY KEY,
    tipo TEXT NOT NULL,
    arma TEXT NOT NULL,
    version TEXT NOT NULL,
    youtube TEXT,
    date_create DATE DEFAULT CURRENT_DATE
)`, (err) => {
    if (err) {
        console.error("Error al crear la tabla:", err.message);
    } else {
        console.log("Tabla 'builds' lista para su uso.");
    }
});

pool.query(`CREATE TABLE IF NOT EXISTS otros (
    id SERIAL PRIMARY KEY,
    descripcion TEXT NOT NULL,
    bioma TEXT,
    seccion TEXT,
    youtube TEXT,
    date_create DATE DEFAULT CURRENT_DATE
)`, (err) => {
    if (err) {
        console.error("Error al crear la tabla:", err.message);
    } else {
        console.log("Tabla 'otros' lista para su uso.");
    }
});

client.login(DISCORD_TOKEN);

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
            `INSERT INTO builds2 (tipo, arma, version, youtube) VALUES ($1, $2, $3, $4)`,
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
        pool.query(`SELECT * FROM builds2 WHERE tipo = $1`, [tipo], (err, res) => {
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

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!add_build')) {
        try {
            // Extraer cada línea después de `!add_build`
            const lines = message.content.split('\n').slice(1); // Ignora la primera línea que es el comando

            // Variables para almacenar los valores
            let tipo, arma, version, youtube;

            // Extraer los valores de cada línea
            lines.forEach(line => {
                const [key, ...value] = line.split(':'); // Divide cada línea en clave y valor
                const trimmedValue = value.join(':').trim(); // Une el valor y elimina espacios innecesarios

                switch (key.toLowerCase()) {
                    case 'tipo':
                        tipo = trimmedValue;
                        break;
                    case 'arma':
                        arma = trimmedValue;
                        break;
                    case 'versión':
                        version = trimmedValue;
                        break;
                    case 'youtube':
                        youtube = trimmedValue;
                        break;
                }
            });

            // Verificar si todos los campos requeridos están presentes
            if (!tipo || !arma || !version || !youtube) {
                return message.channel.send("Por favor, asegúrate de incluir todos los campos:\nTipo, Arma, Versión, YouTube.");
            }

            // Insertar en la base de datos
            await pool.query(
                `INSERT INTO builds2 (tipo, arma, version, youtube) VALUES ($1, $2, $3, $4)`,
                [tipo, arma, version, youtube]
            );

            message.channel.send("Build agregada correctamente.");
        } catch (err) {
            console.error("Error al agregar build:", err);
            message.channel.send("Hubo un error al intentar agregar la build.");
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.content === '!builds') {
        try {
            const res = await pool.query(`SELECT tipo, COUNT(*) as cantidad FROM builds2 GROUP BY tipo`);

            // Construye el mensaje con formato
            let respuesta = '**Cantidad de builds por tipo:**\n';
            res.rows.forEach(row => {
                // Agrega un emoji basado en el tipo de build
                let icono = '';
                switch (row.tipo.toLowerCase()) {
                    case 'ataque':
                        icono = '⚔️'; // Emoji de espada
                        break;
                    case 'defensa':
                        icono = '🛡️'; // Emoji de escudo
                        break;
                    case 'soporte':
                        icono = '💊'; // Emoji de curación o soporte
                        break;
                    default:
                        icono = '🔹'; // Emoji genérico
                        break;
                }
                respuesta += `**${icono} ${row.tipo}:** ${row.cantidad}\n`;
            });

            // Envía el mensaje al canal de Discord
            message.channel.send(respuesta);
        } catch (err) {
            console.error("Error al obtener la cantidad de builds por tipo:", err);
            message.channel.send("Hubo un error al intentar obtener la cantidad de builds.");
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.content === '!help') {
        const helpMessage = `
**Lista de Comandos Disponibles:**

1. **!add_build**
   - Uso: \`!add_build\` seguido de los datos de la build en líneas separadas.
   - Formato:
     \`\`\`
     !add_build
     Tipo: [tipo de build, ej. Ataque]
     Arma: [nombre del arma, ej. Espada Larga]
     Versión: [versión del build, ej. 2.1]
     YouTube: [link de YouTube, ej. https://youtube.com/ejemplo]
     \`\`\`
   - Descripción: Agrega una nueva build a la base de datos.

2. **!builds**
   - Uso: \`!builds\`
   - Descripción: Muestra la cantidad de builds almacenadas agrupadas por tipo.

3. **!build_arma**
   - Uso: \`!build_arma [nombre del arma]\`
   - Descripción: Busca y muestra todas las builds que coinciden con el nombre del arma especificado.
   - Ejemplo:
     \`\`\`
     !build_arma Espada Larga
     \`\`\`

4. **!build_tipo**
   - Uso: \`!build_tipo [tipo de build]\`
   - Descripción: Busca y muestra todas las builds que coinciden con el tipo de build especificado.
   - Ejemplo:
     \`\`\`
     !build_tipo Ataque
     \`\`\`

5. **!help**
   - Uso: \`!help\`
   - Descripción: Muestra esta lista de comandos con una breve descripción de cómo usarlos.
`;

        // Envía el mensaje de ayuda al canal
        message.channel.send(helpMessage);
    }
});

client.on('messageCreate', async (message) => {
    // Comando para buscar builds por arma
    if (message.content.startsWith('!build_arma')) {
        const arma = message.content.split(' ').slice(1).join(' ');
        if (!arma) {
            return message.channel.send("Por favor, especifica el nombre del arma después de `!build_arma`.");
        }

        try {
            const res = await pool.query(`SELECT * FROM builds WHERE arma ILIKE $1`, [arma]);

            if (res.rows.length === 0) {
                message.channel.send(`No se encontraron builds para el arma: **${arma}**.`);
            } else {
                let respuesta = `**🔍 Builds encontradas para el arma "${arma}":**\n`;
                res.rows.forEach(row => {
                    respuesta += `\n**🛠️ Tipo:** ${row.tipo}\n📅 **Versión:** ${row.version}\n🔗 **YouTube:** ${row.youtube}\n`;
                    respuesta += `------------------------------------`;
                });
                message.channel.send(respuesta);
            }
        } catch (err) {
            console.error("Error al buscar builds por arma:", err);
            message.channel.send("Hubo un error al intentar buscar builds por arma.");
        }
    }

    // Comando para buscar builds por tipo
    if (message.content.startsWith('!build_tipo')) {
        const tipo = message.content.split(' ').slice(1).join(' ');
        if (!tipo) {
            return message.channel.send("Por favor, especifica el tipo de build después de `!build_tipo`.");
        }

        try {
            const res = await pool.query(`SELECT * FROM builds WHERE tipo ILIKE $1`, [tipo]);

            if (res.rows.length === 0) {
                message.channel.send(`No se encontraron builds para el tipo: **${tipo}**.`);
            } else {
                let respuesta = `**🔍 Builds encontradas para el tipo "${tipo}":**\n`;
                res.rows.forEach(row => {
                    respuesta += `\n**⚔️ Arma:** ${row.arma}\n📅 **Versión:** ${row.version}\n🔗 **YouTube:** ${row.youtube}\n`;
                    respuesta += `------------------------------------`;
                });
                message.channel.send(respuesta);
            }
        } catch (err) {
            console.error("Error al buscar builds por tipo:", err);
            message.channel.send("Hubo un error al intentar buscar builds por tipo.");
        }
    }
});

//TWITTER

/* let lastTweetId = null;
let userId = null; // Almacena el ID de usuario de Twitter

// Función para obtener el ID de usuario solo una vez
async function obtenerUserId() {
    if (!userId) {
        const user = await twitterClient.v2.userByUsername(TWITTER_USERNAME);
        userId = user.data.id; // Guarda el ID para futuras solicitudes
        console.log(`ID de usuario obtenido: ${userId}`);
    }
}

// Función para obtener el último tweet de la línea de tiempo usando el ID
async function obtenerUltimoTweetDeUsuario() {
    try {
        if (!userId) await obtenerUserId(); // Obtiene el ID si aún no está almacenado

        // Consulta la línea de tiempo usando el ID de usuario
        const userTweets = await twitterClient.v2.userTimeline(userId, { max_results: 5 });

        if (userTweets.data.length > 0) {
            const tweet = userTweets.data[0];
            if (tweet.id !== lastTweetId) {
                lastTweetId = tweet.id;
                return tweet;
            }
        }
    } catch (err) {
        console.error("Error al obtener tweets:", err);
    }
    return null;
}

// Publica un tweet en Discord
async function publicarTweetEnDiscord(tweet) {
    const channel = await discordClient.channels.fetch(CHANNEL_ID);
    if (channel && tweet) {
        const tweetUrl = `https://twitter.com/${TWITTER_USERNAME}/status/${tweet.id}`;
        channel.send(`Nuevo tweet de ${TWITTER_USERNAME}: ${tweet.text}\n${tweetUrl}`);
    }
}

// Verifica y publica tweets
async function verificarTweets() {
    const tweet = await obtenerUltimoTweetDeUsuario();
    if (tweet) {
        await publicarTweetEnDiscord(tweet);
    }
}

client.once('ready', () => {
    console.log(`Bot conectado como ${client.user.tag}`);

    // Ejecuta la función de verificación de tweets cada 5 segundos
    setInterval(verificarTweets, 900000); // 5 segundos en milisegundos
}); */