"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const port = Number(process.env.PORT || 3000);

if (!token || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID in environment variables.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const app = express();
const allowedOrigin = process.env.PUBLIC_SITE_URL || "*";
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

function visibleRoleIds() {
  return new Set(
    String(process.env.VISIBLE_ROLE_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

async function getGuild() {
  return client.guilds.fetch(guildId);
}

function publicRole(role) {
  return {
    id: role.id,
    name: role.name,
    color: role.hexColor,
    position: role.position,
    membersCount: role.members?.size || 0
  };
}

function publicMember(member) {
  const roles = member.roles.cache
    .filter((role) => role.id !== member.guild.id && visibleRoleIds().has(role.id))
    .sort((a, b) => b.position - a.position)
    .map(publicRole);

  return {
    id: member.id,
    name: member.displayName,
    username: member.user.username,
    avatar: member.user.displayAvatarURL({ extension: "png", size: 256 }),
    joinedAt: member.joinedAt,
    roles,
    rank: roles[0]?.name || "عضو ملاذ",
    messages: 0,
    voice: 0,
    level: 1,
    xp: 0
  };
}

app.get("/health", (req, res) => {
  res.json({ ok: true, botReady: client.isReady() });
});

app.get("/api/public/server", async (req, res) => {
  try {
    const guild = await getGuild();
    res.json({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ extension: "png", size: 256 }),
      memberCount: guild.memberCount
    });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: "Discord server is unavailable" });
  }
});

app.get("/api/public/roles", async (req, res) => {
  try {
    const guild = await getGuild();
    const ids = visibleRoleIds();
    const roles = guild.roles.cache
      .filter((role) => role.id !== guild.id && ids.has(role.id))
      .sort((a, b) => b.position - a.position)
      .map(publicRole);
    res.json({ roles });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: "Roles are unavailable" });
  }
});

app.get("/api/public/members", async (req, res) => {
  try {
    const guild = await getGuild();
    const query = String(req.query.q || "").trim().toLowerCase();
    await guild.members.fetch();
    const members = guild.members.cache
      .filter((member) => !member.user.bot)
      .filter((member) => !query || member.displayName.toLowerCase().includes(query) || member.user.username.toLowerCase().includes(query))
      .filter((member) => visibleRoleIds().size === 0 || member.roles.cache.some((role) => visibleRoleIds().has(role.id)))
      .first(50)
      .map(publicMember);
    res.json({ members });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: "Members are unavailable" });
  }
});

app.get("/api/public/member/:id", async (req, res) => {
  try {
    const guild = await getGuild();
    const member = await guild.members.fetch(req.params.id).catch(() => null);
    if (!member || member.user.bot) return res.status(404).json({ error: "Member not found" });
    res.json(publicMember(member));
  } catch (error) {
    console.error(error);
    res.status(404).json({ error: "Member not found" });
  }
});

app.get("/api/public/leaderboard", async (req, res) => {
  try {
    const guild = await getGuild();
    await guild.members.fetch();
    const members = guild.members.cache
      .filter((member) => !member.user.bot)
      .filter((member) => visibleRoleIds().size === 0 || member.roles.cache.some((role) => visibleRoleIds().has(role.id)))
      .first(50)
      .map(publicMember);
    res.json({ members });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: "Leaderboard is unavailable" });
  }
});

app.listen(port, () => console.log(`Malaz API listening on port ${port}`));

client.once("clientReady", () => {
  console.log(`Discord bot logged in as ${client.user.tag}`);
});

client.login(token).catch((error) => {
  console.error("Discord login failed:", error.message);
  process.exit(1);
});
