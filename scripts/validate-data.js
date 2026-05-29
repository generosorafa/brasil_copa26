const data = require("../data/site-data.js");

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function unique(items, label) {
  const seen = new Set();
  items.forEach((item) => {
    if (seen.has(item)) fail(`${label} duplicado: ${item}`);
    seen.add(item);
  });
}

unique(data.games.map((game) => game.id), "ID de jogo");
unique(data.players.map((player) => player.card), "Numero de figurinha");

data.group.teams.forEach((teamId) => {
  if (!data.teams[teamId]) fail(`Time do grupo nao existe: ${teamId}`);
});

data.games.forEach((game) => {
  if (!data.teams[game.home]) fail(`Mandante inexistente em ${game.id}: ${game.home}`);
  if (!data.teams[game.away]) fail(`Visitante inexistente em ${game.id}: ${game.away}`);
  if (!data.venues[game.venue]) fail(`Estadio inexistente em ${game.id}: ${game.venue}`);

  const start = new Date(game.date);
  const end = new Date(game.end);
  if (Number.isNaN(start.getTime())) fail(`Data invalida em ${game.id}: ${game.date}`);
  if (Number.isNaN(end.getTime())) fail(`Fim invalido em ${game.id}: ${game.end}`);
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
    fail(`Fim antes do inicio em ${game.id}`);
  }

  if (game.status === "final" && !game.score) {
    warn(`Jogo finalizado sem placar: ${game.id}`);
  }

  if (game.score) {
    ["home", "away"].forEach((side) => {
      if (!Number.isInteger(game.score[side]) || game.score[side] < 0) {
        fail(`Placar invalido em ${game.id}: ${side}`);
      }
    });
  }
});

data.players.forEach((player) => {
  if (!player.name) fail(`Jogador sem nome na figurinha ${player.card}`);
  if (!player.position) fail(`Jogador sem posicao: ${player.name}`);
  if (!player.role) fail(`Jogador sem sigla de posicao: ${player.name}`);
});

if (warnings.length) {
  console.warn("Avisos:");
  warnings.forEach((message) => console.warn(`- ${message}`));
}

if (errors.length) {
  console.error("Erros:");
  errors.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`OK: ${data.games.length} jogos, ${data.players.length} jogadores, ${Object.keys(data.venues).length} estadios.`);
