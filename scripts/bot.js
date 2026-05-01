require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Dummy HTTP Server for Render Hosted Web Service health checks
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('MapleDevs bot is online.');
}).listen(PORT, () => console.log(`☁️ Cloud health-check server listening on port ${PORT}`));

// Fallback for native fetch in older Node
const fetch = (...args) => import('node-fetch').then(({default: _fetch}) => _fetch(...args)).catch(() => globalThis.fetch(...args));

const SHEET_ID = process.env.SHEET_ID || "2PACX-1vSkt2ROoihRVsL4f0m4dXZ1IzD7KYzEghgOwW7QPC2EN6sE4D_iI3stfllfdeq61coOrhdi47eeLmoY";
const DB_FILE = path.join(__dirname, 'tracked_jobs.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

let trackedJobs = [];
if (fs.existsSync(DB_FILE)) {
  try {
    trackedJobs = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch(e) {
    console.error("Error reading tracked DB");
  }
}

const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(trackedJobs));

client.on('ready', async () => {
  console.log(`🍁 Logged in as ${client.user.tag}!`);
  
  // Register Slash Command
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
      console.log('Started refreshing application (/) commands.');
      const scaffoldCmd = new SlashCommandBuilder()
          .setName('scaffold')
          .setDescription('Auto-generates the MapleDevs server structure.')
          .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

      await rest.put(
          Routes.applicationCommands(client.user.id),
          { body: [scaffoldCmd.toJSON()] },
      );
      console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
      console.error(error);
  }

  // Start polling
  pollJobs();
  setInterval(pollJobs, 60 * 60 * 1000); // Every hour
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'scaffold') {
      await interaction.reply({ content: 'Building server structure...', ephemeral: true });

      const guild = interaction.guild;
      try {
          const makeCategory = async (name, channels, privateMode = false) => {
              const opts = { name, type: ChannelType.GuildCategory };
              if (privateMode) {
                  opts.permissionOverwrites = [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }];
              }
              const cat = await guild.channels.create(opts);
              for (const ch of channels) {
                  await guild.channels.create({ name: ch, type: ChannelType.GuildText, parent: cat.id });
              }
          };

          await makeCategory('📌 WELCOME & INFO', ['rules', 'announcements', 'about-mapledevs', 'get-roles']);
          await makeCategory('👋 COMMUNITY', ['introductions', 'general', 'what-are-you-playing', 'show-and-tell']);
          await makeCategory('💻 INDUSTRY DISCUSSIONS', ['programming-and-tech', 'art-and-animation', 'design-and-production', 'career-advice']);
          await makeCategory('🏢 JOBS & HIRING', ['mapledevs-feed', 'hiring', 'looking-for-work', 'student-and-internships']);
          await makeCategory('📍 LOCAL HUBS', ['bc-chat', 'ontario-chat', 'quebec-chat', 'other-provinces']);
          await makeCategory('🛡️ MODERATION', ['mod-logs'], true);

          await interaction.followUp({ content: '✅ Structure created successfully!', ephemeral: true });
      } catch (err) {
          console.error(err);
          await interaction.followUp({ content: '❌ Failed to create structure. Check my permissions.', ephemeral: true });
      }
  }
});

// CSV Parser Helper
function parseCSV(t) {
    const ls = t.trim().split("\n");
    const jobs = [];
    for(let i=1; i<ls.length; i++){
        const c = csvLine(ls[i]);
        if(!c[0] || !c[1]) continue;
        jobs.push({
            title: cl(c[0]), studio: cl(c[1]), location: cl(c[2]||""), 
            type: cl(c[3]||""), mode: cl(c[4]||""), desc: cl(c[5]||""), 
            apply: cl(c[6]||""), posted: cl(c[7]||""), 
            featured: cl(c[8]||"").toLowerCase()==="yes", student: cl(c[9]||"").toLowerCase()==="yes", salary: cl(c[10]||"")
        });
    }
    return jobs;
}
function csvLine(l) {
    const r=[]; let c="", q=false;
    for(let i=0; i<l.length; i++){
        const ch=l[i];
        if(ch==='"') q=!q;
        else if(ch===',' && !q) { r.push(c); c=""; }
        else c+=ch;
    }
    r.push(c); return r;
}
function cl(s) { return s.replace(/^"|"$/g,"").trim(); }

async function pollJobs() {
    console.log("Polling for new jobs...");
    const url = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?output=csv`;
    try {
        const response = await (globalThis.fetch || fetch)(url);
        if (!response.ok) throw new Error("Failed to fetch jobs");
        const csvText = await response.text();
        const jobs = parseCSV(csvText);
        
        const newJobs = [];
        for (const job of jobs) {
            const hash = `${job.title}|${job.studio}|${job.location}`.toLowerCase();
            if (!trackedJobs.includes(hash)) {
                newJobs.push(job);
                trackedJobs.push(hash);
            }
        }

        if (newJobs.length > 0) {
            saveDB();
            broadcastJobs(newJobs);
        }
    } catch (err) {
        console.error("Job Polling Error:", err);
    }
}

async function broadcastJobs(jobs) {
    // Find all guilds the bot is in, and look for a channel named `mapledevs-feed`
    for (const guild of client.guilds.cache.values()) {
        const feedChannel = guild.channels.cache.find(c => c.name === 'mapledevs-feed' && c.type === ChannelType.GuildText);
        if (feedChannel) {
            for (const job of jobs) {
                const embed = new EmbedBuilder()
                    .setTitle(`🍁 ${job.title}`)
                    .setAuthor({ name: job.studio })
                    .setColor(job.featured ? '#E8C94A' : '#C8372D')
                    .setDescription(job.desc ? (job.desc.substring(0, 300) + '...') : 'New opportunity available!')
                    .addFields(
                        { name: '📍 Location', value: job.location || 'N/A', inline: true },
                        { name: '🏢 Mode', value: job.mode || 'N/A', inline: true },
                        { name: '💼 Type', value: job.type || 'N/A', inline: true }
                    );

                if (job.salary) embed.addFields({ name: '💰 Salary', value: job.salary, inline: true });
                if (job.student) embed.addFields({ name: '🎓 Notes', value: 'Student-friendly / No experience required', inline: true });
                if (job.apply) embed.setURL(job.apply.startsWith('http') ? job.apply : `https://mapledevs.ca`);
                
                embed.setFooter({ text: 'MapleDevs Job Board', iconURL: 'https://mapledevs.ca/og-image.png' });
                
                try {
                    await feedChannel.send({ embeds: [embed] });
                } catch(e) {
                    console.error(`Failed to send to ${guild.name}:`, e);
                }
            }
        }
    }
}

// --- AUTO-MODERATOR & MONITORING --- //

const PROFANITY_LIST = ['fuck', 'bitch', 'cunt', 'shit', 'spammer_word_example']; // Basic blocklist

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // 1. Profanity & Spam Filter
    const content = message.content.toLowerCase();
    const hasProfanity = PROFANITY_LIST.some(word => content.includes(word));
    
    if (hasProfanity) {
        try {
            await message.delete();
            await message.author.send("⚠️ Your message was deleted from MapleDevs for containing inappropriate language. Please keep it professional!");
            
            // Log to mod-logs
            const modLog = message.guild.channels.cache.find(c => c.name === 'mod-logs');
            if (modLog) {
                const embed = new EmbedBuilder()
                    .setTitle('🚨 Profanity Blocked')
                    .setColor('#C8372D')
                    .addFields(
                        { name: 'User', value: `${message.author.tag} (${message.author.id})` },
                        { name: 'Channel', value: `<#${message.channel.id}>` },
                        { name: 'Content', value: message.content }
                    )
                    .setTimestamp();
                await modLog.send({ embeds: [embed] });
            }
        } catch(e) { console.error("Could not delete message or send warning.", e); }
    }
});

client.on('messageDelete', async message => {
    if (message.author?.bot) return;

    const modLog = message.guild.channels.cache.find(c => c.name === 'mod-logs');
    if (modLog && message.content) {
        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Deleted')
            .setColor('#E8C94A')
            .addFields(
                { name: 'User', value: `${message.author.tag}` },
                { name: 'Channel', value: `<#${message.channel.id}>` },
                { name: 'Original Content', value: message.content }
            )
            .setTimestamp();
        await modLog.send({ embeds: [embed] });
    }
});

client.on('guildMemberAdd', async member => {
    const welcomeChannel = member.guild.channels.cache.find(c => c.name === 'introductions' || c.name === 'general');
    const rulesChannel = member.guild.channels.cache.find(c => c.name === 'rules');
    
    if (welcomeChannel) {
        welcomeChannel.send(`Welcome to MapleDevs, <@${member.id}>! 🍁 Please check out ${rulesChannel ? `<#${rulesChannel.id}>` : 'the rules'} and tell us a bit about what you do!`);
    }

    const modLog = member.guild.channels.cache.find(c => c.name === 'mod-logs');
    if (modLog) {
        modLog.send(`👋 New Member Joined: **${member.user.tag}** (${member.id})`);
    }
});

// Log in
if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN).catch(console.error);
} else {
    console.error("No DISCORD_TOKEN found in .env. Bot will not start.");
}
