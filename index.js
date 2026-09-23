"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const { Client, GatewayIntentBits } = require("discord.js");

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const port = Number(process.env.PORT || 3000);

if (!token || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID in environment variables.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const app = express();
const allowedOrigin = process.env.PUBLIC_SITE_URL || true;
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const defaultVisibleRoleNames = [
  "Owner", "Co-Owner", "Founder",
  "Senior Staff", "Staff", "Junior Staff",
  "PIC", "Emo", "Live"
];

function visibleRoleNames() {
  const configured = String(process.env.VISIBLE_ROLE_NAMES || "")
    .split(",").map((name) => name.trim().toLowerCase()).filter(Boolean);
  return new Set(configured.length ? configured : defaultVisibleRoleNames.map((name) => name.toLowerCase()));
}

function visibleRoleIds() {
  return new Set(String(process.env.VISIBLE_ROLE_IDS || "")
    .split(",").map((id) => id.trim()).filter(Boolean));
}

function isVisibleRole(role) {
  const ids = visibleRoleIds();
  const names = visibleRoleNames();
  return ids.has(role.id) || names.has(role.name.trim().toLowerCase());
}

async function getGuild() {
  return client.guilds.fetch(guildId);
}

function publicRole(role) {
  return { id: role.id, name: role.name, color: role.hexColor, position: role.position, membersCount: role.members?.size || 0 };
}

function memberRoles(member) {
  return member.roles.cache
    .filter((role) => role.id !== member.guild.id && isVisibleRole(role))
    .sort((a, b) => b.position - a.position)
    .map(publicRole);
}

function publicMember(member) {
  const roles = memberRoles(member);
  return {
    id: member.id,
    name: member.displayName,
    username: member.user.username,
    globalName: member.user.globalName,
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

function visibleMembers(guild, query = "") {
  const q = query.toLowerCase();
  return guild.members.cache
    .filter((member) => !member.user.bot)
    .filter((member) => memberRoles(member).length > 0)
    .filter((member) => !q || `${member.displayName} ${member.user.username} ${member.user.globalName || ""}`.toLowerCase().includes(q))
    .sort((a, b) => memberRoles(b)[0]?.position - memberRoles(a)[0]?.position)
    .first(100)
    .map(publicMember);
}

app.get("/health", (req, res) => res.json({ ok: true, botReady: client.isReady() }));

app.get("/api/public/server", async (req, res) => {
  try {
    const guild = await getGuild();
    res.json({ id: guild.id, name: guild.name, icon: guild.iconURL({ extension: "png", size: 256 }), memberCount: guild.memberCount });
  } catch (error) {
    console.error(error); res.status(503).json({ error: "Discord server is unavailable" });
  }
});

app.get("/api/public/roles", async (req, res) => {
  try {
    const guild = await getGuild();
    const roles = guild.roles.cache.filter((role) => role.id !== guild.id && isVisibleRole(role)).sort((a, b) => b.position - a.position).map(publicRole);
    res.json({ roles });
  } catch (error) {
    console.error(error); res.status(503).json({ error: "Roles are unavailable" });
  }
});

app.get("/api/public/members", async (req, res) => {
  try {
    const guild = await getGuild();
    await guild.members.fetch();
    res.json({ members: visibleMembers(guild, String(req.query.q || "").trim()) });
  } catch (error) {
    console.error(error); res.status(503).json({ error: "Members are unavailable" });
  }
});

app.get("/api/public/member/:id", async (req, res) => {
  try {
    const guild = await getGuild();
    const member = await guild.members.fetch(req.params.id).catch(() => null);
    if (!member || member.user.bot || !memberRoles(member).length) return res.status(404).json({ error: "Member not found" });
    res.json(publicMember(member));
  } catch (error) {
    console.error(error); res.status(404).json({ error: "Member not found" });
  }
});

app.get("/api/public/leaderboard", async (req, res) => {
  try {
    const guild = await getGuild();
    await guild.members.fetch();
    res.json({ members: visibleMembers(guild) });
  } catch (error) {
    console.error(error); res.status(503).json({ error: "Leaderboard is unavailable" });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(port, () => console.log(`Malaz MLD site/API listening on port ${port}`));
client.once("clientReady", () => console.log(`Discord bot logged in as ${client.user.tag}`));
client.login(token).catch((error) => { console.error("Discord login failed:", error.message); process.exit(1); });
