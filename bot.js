require('dotenv').config();
const { Client, GatewayIntentBits, MessageActionRow, MessageButton, EmbedBuilder   } = require('discord.js');
const { TwitterApi } = require('twitter-api-v2');
const { Pool } = require('pg');

// Configuración de credenciales para Discord y Twitter
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const TWITTER_USERNAME = process.env.TWITTER_USERNAME;
const VERSION_JUEGO = '13.5'; // Define la versión actual del juego

const ICONS = {
    casco: '👒',
    casco_joyas: '💎',
    peto: '🛡️',
    peto_joyas: '💎',
    cintura: '🩲',
    cintura_joyas: '💎',
    piernas: '🥾',
    piernas_joyas: '💎',
    brazales: '🧤',
    brazales_joyas: '💎',
    talisman: '🔮'
};
// const client = new Client({
//     intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
// });

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

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
    date_create DATE DEFAULT CURRENT_DATE,
    creado TEXT
)`, (err) => {
    if (err) {
        console.error("Error al crear la tabla:", err.message);
    } else {
        console.log("Tabla 'otros' lista para su uso.");
    }
});

pool.query(`CREATE TABLE IF NOT EXISTS build_detalles (
    id SERIAL PRIMARY KEY,
    idBuild INTEGER REFERENCES builds(id) ON DELETE CASCADE,
    casco TEXT,
    casco_joyas TEXT,
    peto TEXT,
    peto_joyas TEXT,
    cintura TEXT,
    cintura_joyas TEXT,
    piernas TEXT,
    piernas_joyas TEXT,
    brazales TEXT,
    brazales_joyas TEXT,
    talisman TEXT
)`, (err) => {
    if (err) {
        console.error("Error al crear la tabla:", err.message);
    } else {
        console.log("Tabla 'build_detalles' lista para su uso.");
    }
});

client.login(DISCORD_TOKEN);

//#region BUILDS
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
        // Extrae cada línea después de `!add_build`
        const lines = message.content.split('\n').slice(1); // Ignora la primera línea que es el comando

        // Variables para almacenar los valores de la build
        let tipo, arma, youtube, creadoPor;
        //const creadoPor = message.author.username; // Usuario que ejecuta el comando

        // Extraer los valores de cada línea
        lines.forEach(line => {
            const [key, ...value] = line.split(':'); // Divide cada línea en clave y valor
            const trimmedValue = value.join(':').trim(); // Elimina espacios innecesarios del valor

            switch (key.toLowerCase()) {
                case 'tipo':
                    tipo = trimmedValue;
                    break;
                case 'arma':
                    arma = trimmedValue;
                    break;
                case 'youtube':
                    youtube = trimmedValue;
                    break;
                case 'creado':
                    creadoPor = trimmedValue;
                    break;
            }
        });

        // Verificar si los campos requeridos están presentes
        if (!tipo || !arma) {
            return message.channel.send("Por favor, asegúrate de incluir al menos los campos:\nTipo y Arma.");
        }

        try {
            // Insertar la build en la tabla `builds` con el campo "creado" que es el nombre del usuario
            const buildResult = await pool.query(
                `INSERT INTO builds2 (tipo, arma, version, youtube, creado) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [tipo, arma, VERSION_JUEGO, youtube, creadoPor]
            );
            const idBuild = buildResult.rows[0].id;

            // Verificar si el enlace de YouTube está presente
            if (!youtube) {
                return message.channel.send("Build agregada sin detalles porque no se proporcionó un enlace de YouTube.");
            }

            // Preguntar al usuario si desea agregar detalles
            message.channel.send("¿Deseas agregar detalles de la build? Responde con `sí` o `no`.");

            // Espera la respuesta del usuario
            const filter = response => response.author.id === message.author.id;
            const respuestaUsuario = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });

            const respuesta = respuestaUsuario.first().content.toLowerCase();
            if (respuesta === 'sí' || respuesta === 'si') {
                message.channel.send("Por favor, proporciona los detalles en el siguiente formato:\n" +
                    "```\n" +
                    "Casco: [nombre del casco]\n" +
                    "Casco Joyas: [nombre de la joya]\n" +
                    "Peto: [nombre del peto]\n" +
                    "Peto Joyas: [nombre de la joya]\n" +
                    "Cintura: [nombre de la cintura]\n" +
                    "Cintura Joyas: [nombre de la joya]\n" +
                    "Piernas: [nombre de las piernas]\n" +
                    "Piernas Joyas: [nombre de la joya]\n" +
                    "Brazales: [nombre de los brazales]\n" +
                    "Brazales Joyas: [nombre de la joya]\n" +
                    "Talisman: [nombre del talisman]\n" +
                    "```");

                // Espera el mensaje con los detalles de la build
                const detallesMensaje = await message.channel.awaitMessages({ filter, max: 1, time: 300000, errors: ['time'] });
                const detallesLines = detallesMensaje.first().content.split('\n');

                // Variables para almacenar los detalles de la build
                let casco, casco_joyas, peto, peto_joyas, cintura, cintura_joyas, piernas, piernas_joyas, brazales, brazales_joyas, talisman;

                // Extrae los detalles de cada línea
                detallesLines.forEach(line => {
                    const [key, ...value] = line.split(':');
                    const trimmedValue = value.join(':').trim();

                    switch (key.toLowerCase()) {
                        case 'casco':
                            casco = trimmedValue;
                            break;
                        case 'casco joyas':
                            casco_joyas = trimmedValue;
                            break;
                        case 'peto':
                            peto = trimmedValue;
                            break;
                        case 'peto joyas':
                            peto_joyas = trimmedValue;
                            break;
                        case 'cintura':
                            cintura = trimmedValue;
                            break;
                        case 'cintura joyas':
                            cintura_joyas = trimmedValue;
                            break;
                        case 'piernas':
                            piernas = trimmedValue;
                            break;
                        case 'piernas joyas':
                            piernas_joyas = trimmedValue;
                            break;
                        case 'brazales':
                            brazales = trimmedValue;
                            break;
                        case 'brazales joyas':
                            brazales_joyas = trimmedValue;
                            break;
                        case 'talisman':
                            talisman = trimmedValue;
                            break;
                    }
                });

                // Insertar los detalles de la build en la tabla `build_detalles`
                await pool.query(
                    `INSERT INTO build_detalles (idBuild, casco, casco_joyas, peto, peto_joyas, cintura, cintura_joyas, piernas, piernas_joyas, brazales, brazales_joyas, talisman)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [idBuild, casco, casco_joyas, peto, peto_joyas, cintura, cintura_joyas, piernas, piernas_joyas, brazales, brazales_joyas, talisman]
                );

                message.channel.send("Detalles de la build agregados correctamente.");
            } else {
                message.channel.send("Build agregada sin detalles.");
            }
        } catch (err) {
            console.error("Error al agregar la build y sus detalles:", err);
            message.channel.send("Hubo un error al intentar agregar la build y sus detalles.");
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

5. **!add_otros**
   - Uso: \`!add_otros\` seguido de los datos en líneas separadas.
   - Formato:
     \`\`\`
     !add_otros
     Nombre: [nombre del registro, ej. Ejemplo de Nombre]
     Descripción: [descripción del registro, ej. Descripción detallada]
     Bioma: [bioma, ej. Bosque]
     Sección: [sección, ej. Norte]
     YouTube: [link de YouTube, ej. https://youtube.com/ejemplo]
     \`\`\`
   - Descripción: Agrega un nuevo registro a la tabla "otros".

6. **!listar_otros**
   - Uso: \`!listar_otros\`
   - Descripción: Muestra una lista de todos los registros en la tabla "otros" con solo los campos **Nombre** y **YouTube**.

7. **!tipos_build**
   - Uso: \`!tipos_build\`
   - Descripción: Muestra los tipos de builds disponibles: Ataque, Defensa, Soporte, Mixto, DPS.

8. **!help**
   - Uso: \`!help\`
   - Descripción: Muestra esta lista de comandos con una breve descripción de cómo usarlos.
`;

        // Envía el mensaje de ayuda al canal
        message.channel.send(helpMessage);
    }
});

// client.on('messageCreate', async (message) => {
//     // Comando para buscar builds por arma
//     if (message.content.startsWith('!build_arma')) {
//         const arma = message.content.split(' ').slice(1).join(' ');
//         if (!arma) {
//             return message.channel.send("Por favor, especifica el nombre del arma después de `!build_arma`.");
//         }

//         try {
//             const res = await pool.query(`SELECT * FROM builds WHERE arma ILIKE $1`, [arma]);

//             if (res.rows.length === 0) {
//                 message.channel.send(`No se encontraron builds para el arma: **${arma}**.`);
//             } else {
//                 let respuesta = `**🔍 Builds encontradas para el arma "${arma}":**\n`;
//                 res.rows.forEach(row => {
//                     respuesta += `\n**🛠️ Tipo:** ${row.tipo}\n📅 **Versión:** ${row.version}\n🔗 **YouTube:** ${row.youtube}\n`;
//                     respuesta += `------------------------------------`;
//                 });
//                 message.channel.send(respuesta);
//             }
//         } catch (err) {
//             console.error("Error al buscar builds por arma:", err);
//             message.channel.send("Hubo un error al intentar buscar builds por arma.");
//         }
//     }

//     // Comando para buscar builds por tipo
//     if (message.content.startsWith('!build_tipo')) {
//         const tipo = message.content.split(' ').slice(1).join(' ');
//         if (!tipo) {
//             return message.channel.send("Por favor, especifica el tipo de build después de `!build_tipo`.");
//         }

//         try {
//             const res = await pool.query(`SELECT * FROM builds WHERE tipo ILIKE $1`, [tipo]);

//             if (res.rows.length === 0) {
//                 message.channel.send(`No se encontraron builds para el tipo: **${tipo}**.`);
//             } else {
//                 let respuesta = `**🔍 Builds encontradas para el tipo "${tipo}":**\n`;
//                 res.rows.forEach(row => {
//                     respuesta += `\n**⚔️ Arma:** ${row.arma}\n📅 **Versión:** ${row.version}\n🔗 **YouTube:** ${row.youtube}\n`;
//                     respuesta += `------------------------------------`;
//                 });
//                 message.channel.send(respuesta);
//             }
//         } catch (err) {
//             console.error("Error al buscar builds por tipo:", err);
//             message.channel.send("Hubo un error al intentar buscar builds por tipo.");
//         }
//     }
// });



// Función para mostrar los detalles en embed


async function mostrarBuildConDetalles(message, build) {
    // Consulta para obtener los detalles de la build
    const detallesResult = await pool.query(
        `SELECT * FROM build_detalles WHERE idBuild = $1`,
        [build.id]
    );

    // Crea el embed para la build principal
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Build para ${build.arma} (${build.tipo})`)
        .setAuthor(`Creado Por: ${build.creado}`)
        .setDescription(`**Versión:** ${build.version}\n**YouTube:** ${build.youtube || "(Sin enlace)"}`)
        .setFooter({ text: 'Detalles de la build' })
        .setTimestamp();

    // Añade los detalles de la build si existen
    if (detallesResult.rows.length > 0) {
        const detalles = detallesResult.rows[0];

        embed.addFields(
            { name: `${ICONS.casco} Casco`, value: detalles.casco || "(Sin casco)", inline: true },
            { name: `${ICONS.casco_joyas} Casco Joyas`, value: detalles.casco_joyas || "(Sin joyas)", inline: true },
            { name: `${ICONS.peto} Peto`, value: detalles.peto || "(Sin peto)", inline: true },
            { name: `${ICONS.peto_joyas} Peto Joyas`, value: detalles.peto_joyas || "(Sin joyas)", inline: true },
            { name: `${ICONS.cintura} Cintura`, value: detalles.cintura || "(Sin cintura)", inline: true },
            { name: `${ICONS.cintura_joyas} Cintura Joyas`, value: detalles.cintura_joyas || "(Sin joyas)", inline: true },
            { name: `${ICONS.piernas} Piernas`, value: detalles.piernas || "(Sin piernas)", inline: true },
            { name: `${ICONS.piernas_joyas} Piernas Joyas`, value: detalles.piernas_joyas || "(Sin joyas)", inline: true },
            { name: `${ICONS.brazales} Brazales`, value: detalles.brazales || "(Sin brazales)", inline: true },
            { name: `${ICONS.brazales_joyas} Brazales Joyas`, value: detalles.brazales_joyas || "(Sin joyas)", inline: true },
            { name: `${ICONS.talisman} Talisman`, value: detalles.talisman || "(Sin talisman)", inline: true }
        );
    } else {
        embed.addFields({ name: "Detalles", value: "Sin detalles adicionales para esta build." });
    }

    // Envía el embed en el canal
    await message.channel.send({ embeds: [embed] });
}

// Comando `!build_arma` para buscar builds por arma
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!build_arma')) {
        const armaBuscada = message.content.slice('!build_arma'.length).trim();

        if (!armaBuscada) {
            return message.channel.send("Por favor, especifica el nombre del arma que deseas buscar.");
        }

        try {
            // Consulta para obtener builds por arma
            const buildsResult = await pool.query(
                `SELECT * FROM builds2 WHERE arma = $1`,
                [armaBuscada]
            );

            if (buildsResult.rows.length === 0) {
                return message.channel.send(`No se encontraron builds para el arma: ${armaBuscada}`);
            }

            // Muestra cada build con sus detalles en embeds
            for (const build of buildsResult.rows) {
                await mostrarBuildConDetalles(message, build);
            }
        } catch (err) {
            console.error("Error al obtener la build por arma:", err);
            message.channel.send("Hubo un error al intentar obtener la build por arma.");
        }
    }
});

// Comando `!build_tipo` para buscar builds por tipo
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!build_tipo')) {
        const tipoBuscado = message.content.split(' ')[1];

        if (!tipoBuscado) {
            return message.channel.send("Por favor, especifica el tipo de build que deseas buscar.");
        }

        try {
            // Consulta para obtener builds por tipo
            const buildsResult = await pool.query(
                `SELECT * FROM builds2 WHERE tipo = $1`,
                [tipoBuscado]
            );

            if (buildsResult.rows.length === 0) {
                return message.channel.send(`No se encontraron builds para el tipo: ${tipoBuscado}`);
            }

            // Muestra cada build con sus detalles en embeds
            for (const build of buildsResult.rows) {
                await mostrarBuildConDetalles(message, build);
            }
        } catch (err) {
            console.error("Error al obtener la build por tipo:", err);
            message.channel.send("Hubo un error al intentar obtener la build por tipo.");
        }
    }
});

client.on('messageCreate', (message) => {
    if (message.content.startsWith('!set_version')) {
        const nuevaVersion = message.content.split(' ')[1]; // Extrae la versión después del comando

        if (!nuevaVersion) {
            return message.channel.send("Por favor, especifica la nueva versión. Ejemplo: `!set_version 14.0`");
        }

        // Actualiza la versión y el estado del bot
        client.user.setPresence({
            activities: [{ name: `Versión: ${nuevaVersion}`, type: 'PLAYING' }],
            status: 'online'
        });

        message.channel.send(`La versión del juego ha sido actualizada a: ${nuevaVersion}`);
    }
});

client.on('messageCreate', async (message) => {
    if (message.content === '!tipos_build') {
        const tiposBuildMensaje = `
**Tipos de Builds:**
- ⚔️ **Ataque**: Builds enfocadas en maximizar el daño.
- 🛡️ **Defensa**: Builds diseñadas para resistir el daño y proteger.
- 💊 **Soporte**: Builds que ofrecen curación y apoyo a los aliados.
- ⚔️🛡️ **Mixto**: Builds con un balance entre ataque y defensa.
- 💥 **DPS**: Builds dedicadas a infligir daño por segundo de forma continua. `;

        message.channel.send(tiposBuildMensaje);
    }
});

//#endregion

//#region OTROS

client.on('messageCreate', async (message) => {
    if (message.content === '!listar_otros') {
        try {
            // Consulta para obtener todos los registros de la tabla "otros"
            const res = await pool.query(`SELECT * FROM otros`);

            // Verifica si hay registros
            if (res.rows.length === 0) {
                return message.channel.send("No se encontraron registros en la tabla 'otros'.");
            }

            // Envía la información detallada de cada registro en el canal principal
            for (const row of res.rows) {
                // Crea un embed para el registro en el formato deseado
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`Registro: ${row.nombre || "Sin Nombre"}`)
                    .setDescription(`**Descripción:** ${row.descripcion || "Sin descripción"}`)
                    .addFields(
                        { name: 'Bioma', value: row.bioma || "No especificado", inline: true },
                        { name: 'Sección', value: row.seccion || "No especificado", inline: true }
                    )
                    .setFooter({ text: 'Información de la tabla "otros"' })
                    .setTimestamp();

                // Envía el embed primero
                await message.channel.send({ embeds: [embed] });

                // Luego, envía el enlace de YouTube como mensaje separado para activar la vista previa
                if (row.youtube) {
                    await message.channel.send(`YouTube: ${row.youtube}`);
                } else {
                    await message.channel.send("YouTube: (Sin enlace)");
                }
            }
        } catch (err) {
            console.error("Error al obtener los registros de la tabla 'otros':", err);
            message.channel.send("Hubo un error al intentar obtener los registros de la tabla 'otros'.");
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!add_otros')) {
        // Extrae cada línea después de `!add_otros`
        const lines = message.content.split('\n').slice(1); // Ignora la primera línea que es el comando

        // Variables para almacenar los valores
        let nombre = null, descripcion = null, bioma = null, seccion = null, youtube = null;

        // Extraer los valores de cada línea
        lines.forEach(line => {
            const [key, ...value] = line.split(':'); // Divide cada línea en clave y valor
            const trimmedKey = key.trim().toLowerCase(); // Elimina espacios y pasa a minúsculas para evitar problemas
            const trimmedValue = value.join(':').trim(); // Elimina espacios innecesarios del valor

            switch (trimmedKey) {
                case 'nombre':
                    nombre = trimmedValue;
                    break;
                case 'descripcion':
                    descripcion = trimmedValue;
                    break;
                case 'bioma':
                    bioma = trimmedValue;
                    break;
                case 'seccion':
                    seccion = trimmedValue;
                    break;
                case 'youtube':
                    youtube = trimmedValue;
                    break;
            }
        });

        // Verificar si los campos requeridos están presentes
        if (!nombre || !descripcion) {
            return message.channel.send("Por favor, asegúrate de incluir al menos los campos:\n**Nombre** y **Descripción**.");
        }

        try {
            // Insertar en la base de datos
            await pool.query(
                `INSERT INTO otros (nombre, descripcion, bioma, seccion, youtube) VALUES ($1, $2, $3, $4, $5)`,
                [nombre, descripcion, bioma, seccion, youtube]
            );

            message.channel.send("Registro agregado correctamente a la tabla 'otros'.");
        } catch (err) {
            console.error("Error al agregar registro en 'otros':", err);
            message.channel.send("Hubo un error al intentar agregar el registro a la tabla 'otros'.");
        }
    }
});
//#endregion






//TWITTER

const TWITTER_USER_ID = '1778449176726003712'; // ID de usuario de ESMonsterHunter

// Función para obtener los últimos tweets de un usuario
async function obtenerUltimosTweets(userId) {
    try {
        const tweets = await twitterClient.v2.userTimeline(userId, { max_results: 5, "tweet.fields": "created_at" }); // Obtener los últimos 5 tweets
        return tweets.data.data; // Retorna los tweets
    } catch (error) {
        console.error('Error al obtener tweets:', error);
        return null;
    }
}

// Comando de Discord para mostrar los últimos tweets
client.on('messageCreate', async (message) => {
    if (message.content === '!ultimos_tweets') {
        const tweets = await obtenerUltimosTweets(TWITTER_USER_ID);
        if (!tweets) {
            return message.channel.send('No se pudieron obtener los tweets de la cuenta especificada.');
        }

        // Envía cada tweet como un mensaje en Discord
        tweets.forEach((tweet) => {
            let mensaje = `📅 **Fecha:** ${new Date(tweet.created_at).toLocaleDateString()}\n`;
            mensaje += `📝 **Tweet:** ${tweet.text}\n`;
            mensaje += `🔗 **Enlace:** https://x.com/ESMonsterHunter/status/${tweet.id}\n`;
            message.channel.send(mensaje);
        });
    }
});

// async function obtenerUsuario() {
//     try {
//         const user = await twitterClient.v2.userByUsername('ESMonsterHunter');
//         console.log(user);
//     } catch (error) {
//         console.error('Error al autenticar:', error);
//     }
// }

// obtenerUsuario();