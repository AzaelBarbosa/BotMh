require('dotenv').config();
const { Client, GatewayIntentBits, MessageActionRow, MessageButton, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { TwitterApi } = require('twitter-api-v2');
const { Pool } = require('pg');

// Configuración de credenciales para Discord y Twitter
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const TWITTER_USERNAME = process.env.TWITTER_USERNAME;
var VERSION_JUEGO = '1.000.05.00'; // Define la versión actual del juego

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

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions] });

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

/* pool.query(`CREATE TABLE IF NOT EXISTS builds2 (
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
}); */

client.login(DISCORD_TOKEN);

//GET BUILD
client.on('messageCreate', async (message) => {

    if (message.author.bot) return;

    if (message.channel.id !== CHANNEL_ID) {
        // Enviar un mensaje de advertencia que se borra en 5 segundos
        console.log(`No es el Canal Designado`);
        /* const warningMessage = await message.reply("🚫 No puedes usar comandos en este canal. Usa el canal autorizado.");
        setTimeout(() => {
            warningMessage.delete().catch(console.error); // Borrar el mensaje
        }, 5000); */
        return;
    }

    if (message.content.startsWith('!get_build')) {
        const args = message.content.split(' ').slice(1);
        if (args.length === 0) {
            return message.channel.send("Por favor, proporciona el nombre del arma o el tipo de build que deseas buscar.");
        }

        const buildQuery = args.join(' ');

        try {
            const result = await pool.query(
                `SELECT * FROM builds WHERE arma ILIKE $1 OR tipo ILIKE $1`,
                [`%${buildQuery}%`]
            );

            if (result.rows.length === 0) {
                return message.channel.send(`No se encontraron builds para: **${buildQuery}**`);
            }

            for (const build of result.rows) {
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`🔹 Build: ${build.arma} (${build.tipo})`)
                    .addFields(
                        { name: '🛠️ Arma', value: build.arma, inline: true },
                        { name: '⚔️ Tipo', value: build.tipo, inline: true },
                        { name: '📜 Versión', value: build.version, inline: true },
                        { name: '❤️ Votos', value: `${build.votos} votos`, inline: true }
                    );

                if (build.youtube) {
                    embed.addFields({
                        name: '🎥 YouTube',
                        value: `[🔗 Ver video aquí](${build.youtube})`,
                        inline: false,
                    });
                }

                if (build.imagen) {
                    embed.setImage(build.imagen);
                }

                embed.setFooter({ text: "Reacciona con ❤️ para votar!" }).setTimestamp();

                // Enviar el embed y guardar el ID del mensaje
                const sentMessage = await message.channel.send({ embeds: [embed] });
                await sentMessage.react('❤️');

                // Guardar el ID del mensaje en la base de datos
                await pool.query(
                    `UPDATE builds SET message_id = $1 WHERE id = $2`,
                    [sentMessage.id, build.id]
                );
            }
        } catch (err) {
            console.error("Error al obtener la build:", err);
            message.channel.send("Hubo un error al intentar obtener la build.");
        }
    }

    if (message.content === '!stats') {
        try {
            // Consulta para obtener estadísticas generales
            const totalBuildsRes = await pool.query(`SELECT COUNT(*) AS total FROM builds`);
            const totalBuilds = totalBuildsRes.rows[0].total;

            const topBuildRes = await pool.query(`
                SELECT arma, tipo, votos, version FROM builds 
                ORDER BY votos DESC LIMIT 1
            `);
            const topBuild = topBuildRes.rows.length > 0 ? topBuildRes.rows[0] : null;

            const topVersionRes = await pool.query(`
                SELECT version, COUNT(*) AS cantidad FROM builds 
                GROUP BY version 
                ORDER BY cantidad DESC LIMIT 1
            `);
            const topVersion = topVersionRes.rows.length > 0 ? topVersionRes.rows[0] : null;

            // Construcción del embed
            const embed = new EmbedBuilder()
                .setColor('#00ADEF')
                .setTitle('📊 Estadísticas del Servidor')
                .setDescription('Aquí tienes información general sobre las builds en el servidor.')
                .addFields(
                    { name: '🔹 Total de Builds', value: `${totalBuilds}`, inline: true },
                    { 
                        name: '🏆 Build más votada', 
                        value: topBuild 
                            ? `**${topBuild.arma} (${topBuild.tipo})**\n🔥 **${topBuild.votos} votos**\n📜 **Versión:** ${topBuild.version}`
                            : "No hay builds votadas aún.",
                        inline: false
                    },
                    { 
                        name: '📜 Versión con más builds', 
                        value: topVersion 
                            ? `**Versión ${topVersion.version}** - ${topVersion.cantidad} builds` 
                            : "No hay builds registradas.", 
                        inline: false 
                    }
                )
                .setFooter({ text: "Información de builds actualizada" })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error("Error al obtener las estadísticas:", err);
            message.channel.send("Hubo un error al intentar obtener las estadísticas.");
        }
    }

    if (message.content === '!top_builds') {
        try {
            const res = await pool.query(
                `SELECT * FROM builds WHERE votos > 0 ORDER BY votos DESC LIMIT 5`
            );

            if (res.rows.length === 0) {
                return message.channel.send("No hay builds con votos aún.");
            }

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏆 Top 5 Builds Más Populares')
                .setDescription("Aquí están las builds más votadas por la comunidad:")
                .setFooter({ text: "Vota usando ❤️ en !get_build" })
                .setTimestamp();

            res.rows.forEach((build, index) => {
                embed.addFields({
                    name: `#${index + 1} - ${build.arma} (${build.tipo})`,
                    value: `🔥 **${build.votos} votos** | 📜 **Versión:** ${build.version}\n[🎥 YouTube](${build.youtube || 'No disponible'})`,
                    inline: false
                });
            });

            await message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error("Error al obtener el ranking de builds:", err);
            message.channel.send("Hubo un error al intentar obtener las builds más votadas.");
        }
    }

    if (message.content === '!builds') {
        try {
            // Consulta para obtener la cantidad de builds por tipo y por tipo de arma
            const resBuilds = await pool.query(`
                SELECT tipo, COUNT(*) as cantidad FROM builds 
                WHERE version = $1 GROUP BY tipo`, [VERSION_JUEGO]);

            const resArmas = await pool.query(`
                SELECT arma, COUNT(*) as cantidad FROM builds 
                WHERE version = $1 GROUP BY arma`, [VERSION_JUEGO]);

            // Mapeo de iconos para tipos de builds
            const iconosBuilds = {
                'ataque': '⚔️',
                'defensa': '🛡️',
                'soporte': '💊',
                'veneno': '☠️',
                'parálisis': '⚡',
                'perforante': '🎯',
                'elemental': '🌪️',
                'crítico': '💥'
            };

            // Mapeo de iconos para tipos de armas
            const iconosArmas = {
                'espada larga': '🗡️',
                'gran espada': '⚔️',
                'arco': '🏹',
                'ballesta ligera': '🔫',
                'ballesta pesada': '💣',
                'duales': '🔪',
                'martillo': '🔨',
                'lanza': '🛡️',
                'hacha cargada': '⚡',
                'cuerno de caza': '🎭',
                'espadas dobles': '🔄',
                'glaive insecto': '🌀'
            };

            // Construye el mensaje del embed
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 Estadísticas de Builds')
                .setDescription(`📌 **Versión Actual del Juego:** ${VERSION_JUEGO}`)
                .setFooter({ text: "Información actualizada" })
                .setTimestamp();

            // Agrega builds por tipo
            let buildText = '';
            resBuilds.rows.forEach(row => {
                const icono = iconosBuilds[row.tipo.toLowerCase()] || '🔹'; // Icono por defecto
                buildText += `**${icono} ${row.tipo}:** ${row.cantidad}\n`;
            });

            embed.addFields({ name: "🔹 Cantidad de Builds por Tipo", value: buildText || "No hay builds registradas.", inline: false });

            // Agrega builds por tipo de arma
            let armasText = '';
            resArmas.rows.forEach(row => {
                const icono = iconosArmas[row.arma.toLowerCase()] || '🔹'; // Icono por defecto
                armasText += `**${icono} ${row.arma}:** ${row.cantidad}\n`;
            });

            embed.addFields({ name: "🛠️ Cantidad de Builds por Tipo de Arma", value: armasText || "No hay builds registradas.", inline: false });

            // Envía el embed al canal de Discord
            await message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error("Error al obtener la cantidad de builds por tipo y tipo de arma:", err);
            message.channel.send("Hubo un error al intentar obtener la cantidad de builds.");
        }
    }

    if (message.content === '!version') {
        try {
            // Obtener la versión del juego desde la base de datos
            const res = await pool.query(`SELECT version FROM juego_config LIMIT 1`);
             VERSION_JUEGO = res.rows.length > 0 ? res.rows[0].version : "Desconocida";

            // Crear el embed con la versión del juego
            const embed = new EmbedBuilder()
                .setColor('#00ADEF')
                .setTitle('📌 Versión Actual del Juego')
                .setDescription(`La versión actual del juego es **${VERSION_JUEGO}**`)
                .setFooter({ text: "Información actualizada" })
                .setTimestamp();

            // Enviar el embed al canal de Discord
            await message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error("❌ Error al obtener la versión del juego:", err);
            message.channel.send("Hubo un error al intentar obtener la versión del juego.");
        }
    }

    if (message.content === '!help') {
        const embed = new EmbedBuilder()
            .setColor('#00ADEF')
            .setTitle('📖 Lista de Comandos Disponibles')
            .setDescription('Aquí tienes la lista de comandos disponibles para gestionar builds y curiosidades en Monster Hunter.')
            .addFields(
                { name: '🛠️ **Builds**', value: 'Comandos para gestionar y consultar builds', inline: false },
                { name: '`!get_build [nombre]`', value: 'Obtiene la información de una build específica.', inline: true },
                { name: '`!builds`', value: 'Muestra la cantidad de builds registradas por tipo y tipo de arma.', inline: true },
                { name: '`!builds all`', value: 'Muestra la cantidad de builds registradas por tipo y tipo de arma ordenados por versión.', inline: true },

                { name: '📊 **Votaciones**', value: 'Comandos para votar y ver builds populares.', inline: false },
                { name: '`!top_builds`', value: 'Muestra las 5 builds más votadas.', inline: true },

                { name: '📹 **Curiosidades y Otros**', value: 'Comandos para gestionar videos y curiosidades.', inline: false },
                { name: '`!version`', value: 'Muestra la versión actual del juego.', inline: true },
                { name: '`!listar_otros`', value: 'Lista todas las curiosidades registradas.', inline: true },

                { name: '📌 **Utilidades**', value: 'Comandos adicionales para el bot.', inline: false },
                { name: '`!armas`', value: 'Lista las armas disponibles en Monster Hunter.', inline: true },
                { name: '`!stats`', value: 'Muestra estadísticas generales de las builds en el servidor.', inline: true },
                { name: '`!help`', value: 'Muestra esta lista de comandos.', inline: true },

                { name: '🎥 **Twitch**', value: '[Enlace a Twitch](https://www.twitch.tv/erulaz)', inline: false }
            )
            .setFooter({ text: "Bot de Monster Hunter | ¡Caza y mejora tu equipo!" })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    }

    if (message.content === '!builds all') {
        try {
            // Obtener todas las builds agrupadas por versión y tipo
            const resBuilds = await pool.query(`
                SELECT version, tipo, COUNT(*) as cantidad 
                FROM builds 
                GROUP BY version, tipo 
                ORDER BY version DESC
            `);

            // Obtener todas las builds agrupadas por versión y tipo de arma
            const resArmas = await pool.query(`
                SELECT version, arma, COUNT(*) as cantidad 
                FROM builds 
                GROUP BY version, arma 
                ORDER BY version DESC
            `);

            if (resBuilds.rows.length === 0 && resArmas.rows.length === 0) {
                return message.channel.send("No hay builds registradas.");
            }

            // Mapeo de iconos para tipos de builds
            const iconosBuilds = {
                'ataque': '⚔️',
                'defensa': '🛡️',
                'soporte': '💊',
                'veneno': '☠️',
                'parálisis': '⚡',
                'perforante': '🎯',
                'elemental': '🌪️',
                'crítico': '💥'
            };

            // Mapeo de iconos para tipos de armas
            const iconosArmas = {
                'espada larga': '🗡️',
                'gran espada': '⚔️',
                'arco': '🏹',
                'ballesta ligera': '🔫',
                'ballesta pesada': '💣',
                'duales': '🔪',
                'martillo': '🔨',
                'lanza': '🛡️',
                'hacha cargada': '⚡',
                'cuerno de caza': '🎭',
                'espadas dobles': '🔄',
                'glaive insecto': '🌀'
            };

            // Organizar builds por versión
            const buildsPorVersion = {};
            resBuilds.rows.forEach(row => {
                if (!buildsPorVersion[row.version]) {
                    buildsPorVersion[row.version] = { builds: [], armas: [] };
                }
                buildsPorVersion[row.version].builds.push({
                    tipo: row.tipo,
                    cantidad: row.cantidad
                });
            });

            // Organizar tipos de armas por versión
            resArmas.rows.forEach(row => {
                if (!buildsPorVersion[row.version]) {
                    buildsPorVersion[row.version] = { builds: [], armas: [] };
                }
                buildsPorVersion[row.version].armas.push({
                    arma: row.arma,
                    cantidad: row.cantidad
                });
            });

            // Construir los embeds por versión
            for (const version in buildsPorVersion) {
                const data = buildsPorVersion[version];

                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`📊 Builds - Versión ${version}`)
                    .setFooter({ text: "Información de builds actualizada" })
                    .setTimestamp();

                // Agregar builds por tipo
                let buildText = '';
                data.builds.forEach(build => {
                    const icono = iconosBuilds[build.tipo.toLowerCase()] || '🔹'; // Icono por defecto
                    buildText += `**${icono} ${build.tipo}:** ${build.cantidad}\n`;
                });

                embed.addFields({ name: "🔹 Cantidad de Builds por Tipo", value: buildText || "No hay builds registradas.", inline: false });

                // Agregar builds por tipo de arma
                let armasText = '';
                data.armas.forEach(arma => {
                    const icono = iconosArmas[arma.arma.toLowerCase()] || '🔹'; // Icono por defecto
                    armasText += `**${icono} ${arma.arma}:** ${arma.cantidad}\n`;
                });

                embed.addFields({ name: "🛠️ Cantidad de Builds por Tipo de Arma", value: armasText || "No hay builds registradas.", inline: false });

                // Enviar cada embed con datos de una versión diferente
                await message.channel.send({ embeds: [embed] });
            }

        } catch (err) {
            console.error("❌ Error al obtener las builds:", err);
            message.channel.send("Hubo un error al intentar obtener las builds.");
        }
    }

    if (message.content === '!armas') {
        try {
            // Lista de armas de Monster Hunter
            const armasMH = [
                "Espada Larga 🗡️", "Gran Espada ⚔️", "Espadas Dobles 🔪", "Martillo 🔨", 
                "Cuerno de Caza 🎭", "Lanza 🛡️", "Lanza Pistola 🔥", "Hacha Cargada ⚡", 
                "Hacha Espada 🔄", "Glaive Insecto 🌀", "Arco 🏹", 
                "Ballesta Ligera 🔫", "Ballesta Pesada 💣"
            ];

            // Construcción del embed con la lista de armas
            const embed = new EmbedBuilder()
                .setColor('#ff5733')
                .setTitle('⚔️ Lista de Armas Disponibles')
                .setDescription("Estas son las armas que puedes usar en `!get_build`")
                .addFields({ name: "🛠️ Armas", value: armasMH.join("\n"), inline: false })
                .setFooter({ text: "Usa !get_build [arma] para ver builds" })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error("Error al mostrar la lista de armas:", err);
            message.channel.send("Hubo un error al intentar obtener la lista de armas.");
        }
    }

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

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return; // Ignorar reacciones de bots

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error("No se pudo recuperar la reacción:", error);
            return;
        }
    }

    if (reaction.emoji.name === '❤️') {
        try {
            const messageId = reaction.message.id;
            const userId = user.id;

            // Buscar la build asociada a este mensaje
            const res = await pool.query(
                `SELECT id FROM builds WHERE message_id = $1`,
                [messageId]
            );

            if (res.rows.length === 0) return; // No hay build asociada a este mensaje

            const buildId = res.rows[0].id;

            // Verificar si el usuario ya votó esta build
            const existingVote = await pool.query(
                `SELECT * FROM build_votes WHERE user_id = $1 AND build_id = $2`,
                [userId, buildId]
            );

            if (existingVote.rows.length > 0) {
                console.log(`⚠️ Usuario ${userId} ya votó la Build ID ${buildId}`);
                return;
            }

            // Registrar el voto en la base de datos
            await pool.query(
                `INSERT INTO build_votes (user_id, build_id) VALUES ($1, $2)`,
                [userId, buildId]
            );

            // Incrementar el contador de votos en la tabla de builds
            await pool.query(
                `UPDATE builds SET votos = votos + 1 WHERE id = $1`,
                [buildId]
            );

            console.log(`✅ Usuario ${userId} votó por la Build ID ${buildId}`);
        } catch (err) {
            console.error("Error al registrar el voto:", err);
        }
    }
});

//STATS


//TOP BUILDS


//ADD BUILD
/* client.on('messageCreate', async (message) => {
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
}); */

//BUILDS


//VERSION

//HELP

//BUILDS ALL


/* client.on('messageCreate', async (message) => {
    if (message.content === '!builds all') {
        try {
            const resBuilds = await pool.query(`
                SELECT version, tipo, COUNT(*) as cantidad 
                FROM builds 
                GROUP BY version, tipo 
                ORDER BY version DESC
            `);

            if (resBuilds.rows.length === 0) {
                return message.channel.send("No hay builds registradas.");
            }

            // Mapeo de iconos para tipos de builds
            const iconosBuilds = {
                'ataque': '⚔️',
                'defensa': '🛡️',
                'soporte': '💊',
                'veneno': '☠️',
                'parálisis': '⚡',
                'perforante': '🎯',
                'elemental': '🌪️',
                'crítico': '💥'
            };

            // Agrupar builds por versión
            const buildsPorVersion = {};
            resBuilds.rows.forEach(row => {
                if (!buildsPorVersion[row.version]) {
                    buildsPorVersion[row.version] = [];
                }
                buildsPorVersion[row.version].push(row);
            });

            // Construir embeds y botones
            for (const version in buildsPorVersion) {
                const data = buildsPorVersion[version];

                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`📊 Builds - Versión ${version}`)
                    .setFooter({ text: "Haz clic en un botón para ver detalles." })
                    .setTimestamp();

                let buildText = '';
                const buttonRows = [];
                let buttonsInRow = [];

                data.forEach(build => {
                    const icono = iconosBuilds[build.tipo.toLowerCase()] || '🔹';
                    buildText += `**${icono} ${build.tipo}:** ${build.cantidad}\n`;

                    // Crear botón para cada tipo de build
                    const button = new ButtonBuilder()
                        .setCustomId(`builds_${build.tipo}`)
                        .setLabel(`${build.tipo} (${build.cantidad})`)
                        .setStyle(ButtonStyle.Primary);

                    buttonsInRow.push(button);

                    // Si hay 5 botones en la fila, se agrega una nueva fila
                    if (buttonsInRow.length === 5) {
                        buttonRows.push(new ActionRowBuilder().addComponents(...buttonsInRow));
                        buttonsInRow = [];
                    }
                });

                // Agregar la última fila de botones si no está vacía
                if (buttonsInRow.length > 0) {
                    buttonRows.push(new ActionRowBuilder().addComponents(...buttonsInRow));
                }

                embed.addFields({ name: "🔹 Cantidad de Builds por Tipo", value: buildText, inline: false });

                // Enviar el embed con las filas de botones
                await message.channel.send({ embeds: [embed], components: buttonRows });
            }
        } catch (err) {
            console.error("❌ Error al obtener las builds:", err);
            message.channel.send("Hubo un error al intentar obtener las builds.");
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('builds_')) {
        const tipoBuild = interaction.customId.replace('builds_', '');

        try {
            const res = await pool.query(`
                SELECT arma, version, youtube FROM builds 
                WHERE tipo = $1 
                ORDER BY version DESC
            `, [tipoBuild]);

            if (res.rows.length === 0) {
                return interaction.reply({ content: `No hay builds disponibles para **${tipoBuild}**`, ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`🏹 Builds de Tipo: ${tipoBuild}`)
                .setFooter({ text: "Información actualizada" })
                .setTimestamp();

            let buildText = '';
            res.rows.forEach(build => {
                buildText += `🔹 **${build.arma}** - 📜 **Versión ${build.version}**\n`;
                buildText += build.youtube ? `[🎥 Ver en YouTube](${build.youtube})\n\n` : `🎥 No disponible\n\n`;
            });

            embed.setDescription(buildText);

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            console.error("❌ Error al mostrar las builds:", err);
            interaction.reply({ content: "Hubo un error al intentar obtener las builds.", ephemeral: true });
        }
    }
}); */

//ARMAS




async function mostrarBuildConDetalles(message, build) {
    // Consulta para obtener los detalles de la build
    const detallesResult = await pool.query(
        `SELECT * FROM build_detalles WHERE idBuild = $1`,
        [build.id]
    );

    // Crea el embed para la build principal
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Build para ${build.arma} (${build.tipo}) por ${build.creado}`)
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
/* client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!build_arma')) {
        const armaBuscada = message.content.slice('!build_arma'.length).trim();

        if (!armaBuscada) {
            return message.channel.send("Por favor, especifica el nombre del arma que deseas buscar.");
        }

        try {
            // Consulta para obtener builds por arma
            const buildsResult = await pool.query(
                `SELECT * FROM builds2 WHERE arma = $1 AND version = $2`,
                [armaBuscada, VERSION_JUEGO]
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
}); */

// Comando `!build_tipo` para buscar builds por tipo
/* client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!build_tipo')) {
        const tipoBuscado = message.content.split(' ')[1];

        if (!tipoBuscado) {
            return message.channel.send("Por favor, especifica el tipo de build que deseas buscar.");
        }

        try {
            // Consulta para obtener builds por tipo
            const buildsResult = await pool.query(
                `SELECT * FROM builds2 WHERE tipo = $1 AND version = $2`,
                [tipoBuscado, VERSION_JUEGO]
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
}); */

//#endregion

//#region OTROS

//LISTAR OTROS


//ADD OTROS
/* client.on('messageCreate', async (message) => {
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
}); */
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