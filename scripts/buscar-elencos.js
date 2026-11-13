// Robô de elencos do Você Escala — fonte: API pública da ESPN (sem chave).
// Grava data/elencos.json NO MESMO FORMATO de antes, para o app não precisar mudar:
//   { elencos: { "<id do DB_TIMES>": [{ id, nome, posicao, numero }] }, ultima_atualizacao, total_times }
// posicao continua em inglês (Goalkeeper/Defender/Midfielder/Attacker), como o app espera.

const fs = require('fs');
const https = require('https');

// Ligas da ESPN onde procurar os times da planilha
const LIGAS_ESPN = ['bra.1', 'bra.2'];

// Nomes da ESPN que não batem com os nossos (já normalizados: sem acento, minúsculo, só letras/números)
const APELIDOS_ESPN = {
  athleticopr: 'athleticoparanaense',
  atleticomg: 'atleticomineiro',
  redbullbragantino: 'bragantino',
};

// Regras do filtro do elenco "inchado" da ESPN
const MINIMO_JOGADORES_ESPN = 18; // menos que isso = resposta incompleta, não mexe no time
const CAMISA_MAXIMA = 35;         // base costuma usar 40+
const MINIMO_GOLEIROS = 3;
const JOGOS_PARA_FILTRAR = 5;     // se ninguém do time tem 5+ jogos (início de temporada), não filtra

// Banco de dados de times (ids usados como chave no elencos.json e no app)
const DB_TIMES = [
  // SÉRIE A
  {nome: 'Palmeiras', id: 121},
  {nome: 'Flamengo', id: 127},
  {nome: 'Botafogo', id: 120},
  {nome: 'Internacional', id: 119},
  {nome: 'Fortaleza', id: 154},
  {nome: 'São Paulo', id: 126},
  {nome: 'Corinthians', id: 131},
  {nome: 'Bahia', id: 118},
  {nome: 'Cruzeiro', id: 135},
  {nome: 'Vasco da Gama', id: 133},
  {nome: 'Vitória', id: 136},
  {nome: 'Atlético Mineiro', id: 1062},
  {nome: 'Fluminense', id: 124},
  {nome: 'Grêmio', id: 130},
  {nome: 'Juventude', id: 152},
  {nome: 'Bragantino', id: 794},
  {nome: 'Athletico Paranaense', id: 134},
  {nome: 'Criciúma', id: 140},
  {nome: 'Atlético Goianiense', id: 144},
  {nome: 'Cuiabá', id: 1193},
  // SÉRIE B
  {nome: 'Santos', id: 128},
  {nome: 'Mirassol', id: 7848},
  {nome: 'Novorizontino', id: 7834},
  {nome: 'Sport', id: 123},
  {nome: 'Ceará', id: 129},
  {nome: 'Goiás', id: 151},
  {nome: 'Operário-PR', id: 1223},
  {nome: 'Vila Nova', id: 142},
  {nome: 'América Mineiro', id: 125},
  {nome: 'Coritiba', id: 147},
  {nome: 'Avaí', id: 145},
  {nome: 'Paysandu', id: 149},
  {nome: 'Botafogo-SP', id: 2618},
  {nome: 'Chapecoense', id: 132},
  {nome: 'CRB', id: 146},
  {nome: 'Ponte Preta', id: 139},
  {nome: 'Ituano', id: 7779},
  {nome: 'Brusque', id: 1211},
  {nome: 'Guarani', id: 138},
  {nome: 'Amazonas', id: 10862},
  // SÉRIE C e OUTROS
  {nome: 'Náutico', id: 755},
  {nome: 'Figueirense', id: 137},
  {nome: 'Remo', id: 1198},
  {nome: 'Volta Redonda', id: 7814},
  {nome: 'Ferroviária', id: 7826},
  {nome: 'CSA', id: 150},
  {nome: 'ABC', id: 754},
  {nome: 'Sampaio Corrêa', id: 155},
  {nome: 'Confiança', id: 7772},
  {nome: 'Ypiranga', id: 1221},
  {nome: 'Londrina', id: 148},
  {nome: 'São Bernardo', id: 7865},
  {nome: 'Caxias', id: 7770},
  {nome: 'Athletic', id: 13975},
  {nome: 'Tombense', id: 2227},
  {nome: 'Botafogo-PB', id: 1197},
  {nome: 'Aparecidense', id: 1202},
  {nome: 'Floresta', id: 7774},
  {nome: 'São José-RS', id: 2232},
  {nome: 'Ferroviário', id: 1195},
  {nome: 'Portuguesa', id: 1214},
  {nome: 'Brasiliense', id: 2208},
  {nome: 'Tuna Luso', id: 15611},
  {nome: 'Manauara', id: 18308},
  {nome: 'Manaus', id: 2214},
  {nome: 'Trem', id: 7868},
  {nome: 'Humaitá', id: 10478},
  {nome: 'Altos', id: 1203},
  {nome: 'Imperatriz', id: 2213},
  {nome: 'Maranhão', id: 7832},
  {nome: 'Iguatu', id: 15505},
  {nome: 'Tocantinópolis', id: 7878},
  {nome: 'Parnahyba', id: 7784},
  {nome: 'Maracanã', id: 13089},
  {nome: 'América-RN', id: 2233},
  {nome: 'Santa Cruz', id: 753},
  {nome: 'Central', id: 2210},
  {nome: 'Horizonte', id: 12297},
  {nome: 'Treze', id: 7787},
  {nome: 'Sousa', id: 7864},
  {nome: 'ASA', id: 1207},
  {nome: 'Lagarto', id: 10002},
  {nome: 'Sergipe', id: 2224},
  {nome: 'Juazeirense', id: 1224},
  {nome: 'Jequié', id: 15104},
  {nome: 'Barcelona-BA', id: 15103},
  {nome: 'Ceilândia', id: 7771},
  {nome: 'Luverdense', id: 752},
  {nome: 'Mixto', id: 2215},
  {nome: 'Goiânia', id: 10674},
  {nome: 'Goianésia', id: 7873},
  {nome: 'Portuguesa-RJ', id: 7835},
  {nome: 'Água Santa', id: 10018},
  {nome: 'Maricá', id: 14000},
  {nome: 'Pouso Alegre', id: 13084},
  {nome: 'Nova Iguaçu', id: 7782},
  {nome: 'Boavista', id: 222},
  {nome: 'Inter de Limeira', id: 1201},
  {nome: 'Cianorte', id: 1194},
  {nome: 'Cascavel', id: 10673},
  {nome: 'Uberlândia', id: 1196},
  {nome: 'Monte Azul', id: 10021},
  {nome: 'Itabirito', id: 21165},
];

const POSICOES = { G: 'Goalkeeper', D: 'Defender', M: 'Midfielder', F: 'Attacker' };

// Função para remover acentos
function removeAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Para casar nomes: sem acento, minúsculo, só letras e números ("Operário PR" = "Operario-PR")
function chaveNome(str) {
  return removeAccents(String(str).toLowerCase()).replace(/[^a-z0-9]/g, '');
}

// Requisição HTTPS com suporte a redirecionamentos
function fetchHTTPS(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Muitos redirecionamentos'));

    const req = https.get(url, { headers: { 'User-Agent': 'voceescala-elencos/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchHTTPS(res.headers.location, redirectCount + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const t = data.trim();
        if (t.startsWith('{') || t.startsWith('[')) {
          try { return resolve(JSON.parse(t)); } catch (e) { /* cai para texto */ }
        }
        resolve(data); // CSV
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Tenta até 3 vezes
async function fetchComRetry(url, tentativa = 1) {
  try {
    return await fetchHTTPS(url);
  } catch (error) {
    if (tentativa >= 3) throw error;
    console.log(`   🔄 ${error.message} — tentando de novo (${tentativa + 1}/3)...`);
    await delay(tentativa * 3000);
    return fetchComRetry(url, tentativa + 1);
  }
}

// Lista de times de cada liga na ESPN: chaveNome -> { espnId, liga, nome }
async function buscarTimesESPN() {
  const mapa = {};
  for (const liga of LIGAS_ESPN) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${liga}/teams`;
    try {
      const data = await fetchComRetry(url);
      const times = data?.sports?.[0]?.leagues?.[0]?.teams || [];
      for (const { team } of times) {
        if (!team?.id || /^tbd/i.test(team.displayName || '')) continue;
        let chave = chaveNome(team.displayName);
        chave = APELIDOS_ESPN[chave] || chave;
        if (!mapa[chave]) mapa[chave] = { espnId: team.id, liga, nomeEspn: team.displayName };
      }
      console.log(`   ✅ ${liga}: ${times.length} times`);
    } catch (error) {
      console.log(`   ❌ ${liga}: ${error.message}`);
    }
  }
  return mapa;
}

function contarJogos(atleta) {
  let jogos = 0;
  const categorias = atleta?.statistics?.splits?.categories || [];
  for (const c of categorias) {
    for (const s of c.stats || []) {
      if (s.name === 'appearances') jogos = parseInt(s.value, 10) || 0;
    }
  }
  return jogos;
}

function lerCamisa(jersey) {
  const t = String(jersey ?? '').trim();
  return /^\d+$/.test(t) ? parseInt(t, 10) : null;
}

// Busca o elenco de um time e aplica o filtro. Retorna null se a resposta parecer incompleta.
async function buscarElencoESPN(liga, espnId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${liga}/teams/${espnId}/roster`;
  const data = await fetchComRetry(url);
  const atletas = (data?.athletes || []).filter((a) => a?.id && a?.displayName);

  if (atletas.length < MINIMO_JOGADORES_ESPN) {
    console.log(`   ⚠️  Só ${atletas.length} jogadores na ESPN (mínimo ${MINIMO_JOGADORES_ESPN}) — resposta incompleta, mantendo o elenco anterior`);
    return null;
  }

  const todos = atletas.map((a) => ({
    id: parseInt(a.id, 10),
    nome: a.displayName,
    posicao: POSICOES[a.position?.abbreviation] || 'Midfielder',
    numero: lerCamisa(a.jersey),
    jogos: contarJogos(a),
  }));

  const maxJogos = Math.max(0, ...todos.map((j) => j.jogos));
  let escolhidos;

  if (maxJogos < JOGOS_PARA_FILTRAR) {
    // Início de temporada: os jogos ainda não dizem nada, então fica o elenco inteiro
    escolhidos = todos;
    console.log(`   ℹ️  Ninguém com ${JOGOS_PARA_FILTRAR}+ jogos — sem filtro, elenco completo`);
  } else {
    // Fica quem jogou, ou quem usa camisa até 35 (contratado recente / machucado)
    escolhidos = todos.filter((j) => j.jogos > 0 || (j.numero !== null && j.numero <= CAMISA_MAXIMA));

    // Garante pelo menos 3 goleiros (os de camisa mais baixa primeiro)
    const goleiros = escolhidos.filter((j) => j.posicao === 'Goalkeeper').length;
    if (goleiros < MINIMO_GOLEIROS) {
      const reservas = todos
        .filter((j) => j.posicao === 'Goalkeeper' && !escolhidos.includes(j))
        .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999))
        .slice(0, MINIMO_GOLEIROS - goleiros);
      escolhidos = escolhidos.concat(reservas);
    }
  }

  console.log(`   ✅ ${escolhidos.length} jogadores (de ${todos.length} na ESPN)`);
  return escolhidos.map(({ id, nome, posicao, numero }) => ({ id, nome, posicao, numero }));
}

// Função principal
async function buscarTodosElencos() {
  console.log('🚀 Iniciando busca de elencos (ESPN)...\n');

  // 1. Buscar CSV da planilha
  console.log('📋 Buscando lista de times da planilha...');
  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQRrionyAwO3n3GxvyKC4Yb4iSGt7JdmuJez7_8eMPh2gwOM8f0d7aI-bSvJyC-RgJ9B5K8WIBnJcpI/pub?output=csv';

  let csvText;
  try {
    csvText = await fetchComRetry(csvUrl);
  } catch (error) {
    console.error('❌ Erro ao buscar CSV:', error.message);
    process.exit(1);
  }

  const linhas = String(csvText).split('\n').map((l) => l.trim()).filter((l) => l);
  const serieA = [];
  const serieB = [];
  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i].split(',').map((c) => c.trim());
    if (colunas[0]) serieA.push(colunas[0]);
    if (colunas[1]) serieB.push(colunas[1]);
    // Coluna 2 (Copa do Mundo) é ignorada aqui de propósito
  }
  const todosNomesTimes = [...serieA, ...serieB];
  console.log(`   ✅ ${todosNomesTimes.length} times na planilha (Séries A e B)\n`);

  // 2. Lista de times da ESPN
  console.log('🌐 Buscando lista de times na ESPN...');
  const timesESPN = await buscarTimesESPN();
  console.log();

  // 3. Planilha -> DB_TIMES -> ESPN
  console.log('🔍 Fazendo match com banco de dados e ESPN...');
  const timesParaBuscar = [];
  for (const nomeTime of todosNomesTimes) {
    const chave = chaveNome(nomeTime);
    const timeDb = DB_TIMES.find((t) => chaveNome(t.nome) === chave);
    if (!timeDb) {
      console.log(`   ⚠️  "${nomeTime}" não está no DB_TIMES — ignorado`);
      continue;
    }
    if (timesParaBuscar.find((t) => t.id === timeDb.id)) continue;
    const espn = timesESPN[chave];
    if (!espn) {
      console.log(`   ⚠️  "${nomeTime}" não encontrado na ESPN (${LIGAS_ESPN.join(', ')}) — mantém dados antigos`);
      continue;
    }
    timesParaBuscar.push({ ...timeDb, ...espn });
    console.log(`   ✅ "${nomeTime}" → ${timeDb.nome} (ID ${timeDb.id}) = ESPN ${espn.nomeEspn} (${espn.liga}/${espn.espnId})`);
  }
  console.log(`   ✅ ${timesParaBuscar.length} times para buscar\n`);

  // 4. Buscar elencos
  console.log(`⚽ Buscando elencos de ${timesParaBuscar.length} times...`);
  const elencos = {};
  let sucessos = 0;
  let falhas = 0;

  for (let i = 0; i < timesParaBuscar.length; i++) {
    const time = timesParaBuscar[i];
    console.log(`[${i + 1}/${timesParaBuscar.length}] ${time.nome} (ID: ${time.id}, ESPN: ${time.espnId})`);
    try {
      const elenco = await buscarElencoESPN(time.liga, time.espnId);
      if (elenco && elenco.length > 0) {
        elencos[time.id.toString()] = elenco;
        sucessos++;
      } else {
        falhas++;
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
      falhas++;
    }
    await delay(500); // gentileza com a API
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Sucessos: ${sucessos}`);
  console.log(`   ❌ Falhas: ${falhas}`);
  if (falhas > 0) {
    console.log(`\n⚠️ ATENÇÃO: ${falhas} time(s) falharam! Os dados antigos deles serão preservados.\n`);
  }

  // 5. Salvar JSON (preservando times que falharam)
  console.log(`\n💾 Salvando arquivo elencos.json...`);
  fs.mkdirSync('data', { recursive: true });

  let elencosFinais = {};
  if (fs.existsSync('data/elencos.json')) {
    try {
      const jsonAntigo = JSON.parse(fs.readFileSync('data/elencos.json', 'utf8'));
      if (jsonAntigo && jsonAntigo.elencos) {
        elencosFinais = jsonAntigo.elencos;
        console.log(`   ✅ Recuperados dados anteriores de ${Object.keys(elencosFinais).length} times.`);
      }
    } catch (err) {
      console.log(`   ⚠️ Não foi possível ler o arquivo antigo. Criando dados do zero.`);
    }
  }

  for (const [id, elencoAtualizado] of Object.entries(elencos)) {
    elencosFinais[id] = elencoAtualizado;
  }

  const dadosFinais = {
    elencos: elencosFinais,
    ultima_atualizacao: new Date().toISOString(),
    total_times: Object.keys(elencosFinais).length,
  };

  fs.writeFileSync('data/elencos.json', JSON.stringify(dadosFinais, null, 2), 'utf8');
  console.log('   ✅ Arquivo salvo em data/elencos.json');
  console.log(`\n🎉 Processo concluído! Arquivo final contendo ${dadosFinais.total_times} times.\n`);

  // Se nada deu certo, falha o job para você ser avisado pelo GitHub
  if (sucessos === 0) {
    console.error('❌ Nenhum elenco foi atualizado nesta execução.');
    process.exit(1);
  }
}

buscarTodosElencos().catch((error) => {
  console.error('\n❌ ERRO FATAL:', error);
  process.exit(1);
});
