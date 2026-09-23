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

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// The directory intentionally contains only the six leadership/staff roles.
const defaultDirectoryRoles = ["Owner", "Co-Owner", "Founder", "Senior Staff", "Staff", "Junior Staff"];
const activity = new Map();
const voiceSessions = new Map();
const getActivity = (id) => {
  if (!activity.has(id)) activity.set(id, { messages: 0, mentionsReceived: 0, mentionsSent: 0, voiceMinutes: 0, voiceJoins: 0, chatRounds: 0 });
  return activity.get(id);
};
const directoryRoleNames = () => new Set(String(process.env.DIRECTORY_ROLE_NAMES || defaultDirectoryRoles.join(",")).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean));
const directoryRoleIds = () => new Set(String(process.env.DIRECTORY_ROLE_IDS || "").split(",").map((x) => x.trim()).filter(Boolean));
const isDirectoryRole = (role) => directoryRoleIds().has(role.id) || directoryRoleNames().has(role.name.trim().toLowerCase());
const getGuild = () => client.guilds.fetch(guildId);

function roleJson(role) {
  return { id: role.id, name: role.name, color: role.hexColor, position: role.position, permissions: role.permissions.toArray(), membersCount: role.members?.size || 0, mentionable: role.mentionable };
}
function allMemberRoles(member) {
  return member.roles.cache.filter((role) => role.id !== member.guild.id).sort((a, b) => b.position - a.position).map(roleJson);
}
function directoryRoles(member) {
  return member.roles.cache.filter((role) => role.id !== member.guild.id && isDirectoryRole(role)).sort((a, b) => b.position - a.position).map(roleJson);
}
function memberJson(member) {
  const roles = allMemberRoles(member);
  const importantRoles = directoryRoles(member);
  return { id: member.id, name: member.displayName, username: member.user.username, globalName: member.user.globalName, avatar: member.user.displayAvatarURL({ extension: "png", size: 256 }), joinedAt: member.joinedAt, roles, importantRoles, rank: importantRoles[0]?.name || roles[0]?.name || "عضو", stats: getActivity(member.id) };
}
async function allMembers(guild) { await guild.members.fetch(); return [...guild.members.cache.values()].filter((member) => !member.user.bot); }
function sortedMembers(members) { return members.sort((a, b) => (directoryRoles(b)[0]?.position || 0) - (directoryRoles(a)[0]?.position || 0)).map(memberJson); }

app.get("/health", (req, res) => res.json({ ok: true, botReady: client.isReady() }));
app.get("/api/public/server", async (req, res) => {
  try { const guild = await getGuild(); res.json({ id: guild.id, name: guild.name, icon: guild.iconURL({ extension: "png", size: 256 }), memberCount: guild.memberCount, ownerName: process.env.SERVER_FOUNDER_NAME || "فهد المطيري", invite: process.env.DISCORD_INVITE_URL || "" }); }
  catch (error) { console.error(error); res.status(503).json({ error: "Discord server is unavailable" }); }
});
app.get("/api/public/roles", async (req, res) => {
  try { const guild = await getGuild(); res.json({ roles: guild.roles.cache.filter((role) => role.id !== guild.id && isDirectoryRole(role)).sort((a, b) => b.position - a.position).map(roleJson) }); }
  catch (error) { console.error(error); res.status(503).json({ error: "Roles are unavailable" }); }
});
app.get("/api/public/roles/:id/members", async (req, res) => {
  try { const guild = await getGuild(); const role = guild.roles.cache.get(req.params.id); if (!role || !isDirectoryRole(role)) return res.status(404).json({ error: "Role not found" }); res.json({ role: roleJson(role), members: sortedMembers((await allMembers(guild)).filter((member) => member.roles.cache.has(role.id))) }); }
  catch (error) { console.error(error); res.status(503).json({ error: "Role members are unavailable" }); }
});
app.get("/api/public/members", async (req, res) => {
  try { const guild = await getGuild(); const query = String(req.query.q || "").trim().toLowerCase(); const members = (await allMembers(guild)).filter((member) => !query || `${member.displayName} ${member.user.username} ${member.user.globalName || ""}`.toLowerCase().includes(query)); res.json({ members: sortedMembers(members) }); }
  catch (error) { console.error(error); res.status(503).json({ error: "Members are unavailable" }); }
});
app.get("/api/public/member/:id", async (req, res) => {
  try { const guild = await getGuild(); const member = await guild.members.fetch(req.params.id).catch(() => null); if (!member || member.user.bot) return res.status(404).json({ error: "Member not found" }); const highest = member.roles.cache.filter((role) => role.id !== guild.id && !role.managed).sort((a, b) => b.position - a.position).first(); const upcomingRoles = guild.roles.cache.filter((role) => role.position > (highest?.position || 0) && !role.managed).sort((a, b) => a.position - b.position).first(8).map(roleJson); res.json({ ...memberJson(member), highestRole: highest ? roleJson(highest) : null, permissions: highest?.permissions.toArray() || [], upcomingRoles }); }
  catch (error) { console.error(error); res.status(404).json({ error: "Member not found" }); }
});
app.get("/api/public/leaderboard", async (req, res) => { try { res.json({ members: sortedMembers(await allMembers(await getGuild())) }); } catch (error) { res.status(503).json({ error: "Leaderboard unavailable" }); } });

client.on("messageCreate", (message) => { if (message.author.bot) return; const sender = getActivity(message.author.id); sender.messages += 1; sender.chatRounds += 1; for (const id of message.mentions.users.keys()) { getActivity(id).mentionsReceived += 1; sender.mentionsSent += 1; } });
client.on("voiceStateUpdate", (oldState, newState) => { const id = newState.id; if (!oldState.channelId && newState.channelId) { voiceSessions.set(id, Date.now()); getActivity(id).voiceJoins += 1; } if (oldState.channelId && !newState.channelId && voiceSessions.has(id)) { getActivity(id).voiceMinutes += Math.round((Date.now() - voiceSessions.get(id)) / 60000); voiceSessions.delete(id); } });
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(port, () => console.log(`MLD website/API listening on ${port}`));
client.once("ready", () => console.log(`Discord bot logged in as ${client.user.tag}`));
client.login(token).catch((error) => { console.error("Discord login failed:", error.message); process.exit(1); });
