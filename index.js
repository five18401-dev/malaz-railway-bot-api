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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const directoryRoleIds = new Set([
  "1530712642384040027", // Owner
  "1521187079336362024", // Co-Owner
  "1531109479264026706", // Founder
  "1548732297669255259", // Senior Staff
  "1548732341185155103", // Staff
  "1548732606508703744"  // Junior Staff
]);

const strongPermissions = new Set([
  "Administrator",
  "ManageGuild",
  "ManageRoles",
  "ManageChannels",
  "ManageMessages",
  "ManageWebhooks",
  "ManageNicknames",
  "BanMembers",
  "KickMembers",
  "ModerateMembers",
  "MentionEveryone",
  "ViewAuditLog",
  "ManageEvents",
  "ManageThreads",
  "ManageEmojisAndStickers"
]);

const activity = new Map();
const voiceSessions = new Map();
const sendHits = new Map();

const getActivity = (id) => {
  if (!activity.has(id)) {
    activity.set(id, {
      messages: 0,
      mentionsReceived: 0,
      mentionsSent: 0,
      voiceMinutes: 0,
      voiceJoins: 0,
      chatRounds: 0
    });
  }
  return activity.get(id);
};

const getGuild = () => client.guilds.fetch(guildId);
const isDirectoryRole = (role) => directoryRoleIds.has(role.id);

const importantPermissions = (permissionCollection) =>
  permissionCollection.toArray().filter((permission) => strongPermissions.has(permission));

function roleJson(role) {
  return {
    id: role.id,
    name: role.name,
    color: role.hexColor,
    position: role.position,
    permissions: importantPermissions(role.permissions),
    membersCount: role.members?.size || 0,
    mentionable: role.mentionable
  };
}

function allMemberRoles(member) {
  return member.roles.cache
    .filter((role) => role.id !== member.guild.id)
    .sort((a, b) => b.position - a.position)
    .map(roleJson);
}

function directoryRoles(member) {
  return member.roles.cache
    .filter((role) => role.id !== member.guild.id && isDirectoryRole(role))
    .sort((a, b) => b.position - a.position)
    .map(roleJson);
}

function memberJson(member) {
  const roles = allMemberRoles(member);
  const importantRoles = directoryRoles(member);

  return {
    id: member.id,
    name: member.displayName,
    username: member.user.username,
    globalName: member.user.globalName,
    avatar: member.user.displayAvatarURL({ extension: "png", size: 256 }),
    joinedAt: member.joinedAt,
    roles,
    importantRoles,
    rank: importantRoles[0]?.name || roles[0]?.name || "عضو",
    stats: getActivity(member.id)
  };
}

async function allMembers(guild) {
  await guild.members.fetch();
  return [...guild.members.cache.values()].filter((member) => !member.user.bot);
}

function sortedMembers(members) {
  return members
    .sort((a, b) => (directoryRoles(b)[0]?.position || 0) - (directoryRoles(a)[0]?.position || 0))
    .map(memberJson);
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
      memberCount: guild.memberCount,
      ownerName: process.env.SERVER_FOUNDER_NAME || "فهد المطيري",
      invite: process.env.DISCORD_INVITE_URL || ""
    });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: "Discord server is unavailable" });
  }
});

app.get("/api/public/roles", async (req, res) => {
  try {
    const guild = await getGuild();
    const roles = guild.roles.cache
      .filter((role) => role.id !== guild.id && isDirectoryRole(role))
      .sort((a, b) => b.position - a.position)
      .map(roleJson);

    res.json({ roles });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: "Roles are unavailable" });
  }
});

app.get("/api/public/roles/:id/members", async (req, res) => {
  try {
    const guild = await getGuild();
    const role = guild.roles.cache.get(req.params.id);

    if (!role || !isDirectoryRole(role)) {
      return res.status(404).json({ error: "Role not found" });
    }

    const members = (await allMembers(guild))
      .filter((member) => member.roles.cache.has(role.id))
      .map(memberJson);

    res.json({ role: roleJson(role), members });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: "Role members are unavailable" });
  }
});

app.get("/api/public/members", async (req, res) => {
  try {
    const guild = await getGuild();
    const query = String(req.query.q || "").trim().toLowerCase();

    if (!query) {
      return res.json({ members: [] });
    }

    const members = (await allMembers(guild))
      .filter((member) =>
        `${member.displayName} ${member.user.username} ${member.user.globalName || ""}`
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 25)
      .map(memberJson);

    res.json({ members });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: "Members are unavailable" });
  }
});

app.get("/api/public/top", async (req, res) => {
  try {
    const members = (await allMembers(await getGuild())).map(memberJson);

    const by = (key) =>
      [...members]
        .sort((a, b) => (b.stats[key] || 0) - (a.stats[key] || 0))
        .slice(0, 10);

    res.json({
      messages: by("messages"),
      mentions: by("mentionsReceived"),
      voice: by("voiceMinutes"),
      joins: by("voiceJoins")
    });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: "Top unavailable" });
  }
});

app.get("/api/public/member/:id", async (req, res) => {
  try {
    const guild = await getGuild();
    const member = await guild.members.fetch(req.params.id).catch(() => null);

    if (!member || member.user.bot) {
      return res.status(404).json({ error: "Member not found" });
    }

    const highest = member.roles.cache
      .filter((role) => role.id !== guild.id && !role.managed)
      .sort((a, b) => b.position - a.position)
      .first();

    const upcomingRoles = guild.roles.cache
      .filter((role) => role.position > (highest?.position || 0) && !role.managed)
      .sort((a, b) => a.position - b.position)
      .first(8)
      .map(roleJson);

    res.json({
      ...memberJson(member),
      highestRole: highest ? roleJson(highest) : null,
      permissions: highest ? importantPermissions(highest.permissions) : [],
      upcomingRoles
    });
  } catch (error) {
    console.error(error);
    res.status(404).json({ error: "Member not found" });
  }
});

app.post("/api/public/message", async (req, res) => {
  const now = Date.now();
  const ip = req.ip || "unknown";
  const last = sendHits.get(ip) || 0;

  if (now - last < 30000) {
    return res.status(429).json({ error: "انتظر 30 ثانية قبل الإرسال مرة أخرى" });
  }

  const text = String(req.body?.message || "").trim();
  const targetId = String(req.body?.memberId || "").trim();
  const key = String(req.body?.key || "").trim();

  if (!text || text.length > 1000 || !targetId) {
    return res.status(400).json({ error: "بيانات الرسالة غير صحيحة" });
  }

  try {
    const guildObj = await getGuild();
    const member = await guildObj.members.fetch(targetId).catch(() => null);

    if (!member || member.user.bot) {
      return res.status(404).json({ error: "العضو غير موجود" });
    }

    if (!process.env.MESSAGE_SEND_KEY) {
      return res.status(503).json({ error: "ميزة الإرسال غير مفعلة" });
    }

    if (key !== process.env.MESSAGE_SEND_KEY) {
      return res.status(403).json({ error: "غير مصرح" });
    }

    await member.send(text);
    sendHits.set(ip, now);

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "تعذر إرسال الرسالة" });
  }
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const sender = getActivity(message.author.id);
  sender.messages += 1;
  sender.chatRounds += 1;

  for (const id of message.mentions.users.keys()) {
    getActivity(id).mentionsReceived += 1;
    sender.mentionsSent += 1;
  }
});

client.on("voiceStateUpdate", (oldState, newState) => {
  const id = newState.id;

  if (!oldState.channelId && newState.channelId) {
    voiceSessions.set(id, Date.now());
    getActivity(id).voiceJoins += 1;
  }

  if (oldState.channelId && !newState.channelId && voiceSessions.has(id)) {
    const elapsed = Date.now() - voiceSessions.get(id);
    getActivity(id).voiceMinutes += Math.round(elapsed / 60000);
    voiceSessions.delete(id);
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => console.log(`MLD website/API listening on ${port}`));

client.once("ready", () => {
  console.log(`Discord bot logged in as ${client.user.tag}`);
});

client.login(token).catch((error) => {
  console.error("Discord login failed:", error.message);
  process.exit(1);
});
