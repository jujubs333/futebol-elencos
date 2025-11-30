const fs = require('fs');
const https = require('https');

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('❌ ERRO: API_KEY não encontrada nas variáveis de ambiente!');
  process.exit(1);
}

// Banco de dados de times (COMPLETO)
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
  {nome: 'Sport Recife', id: 123},
  {nome: 'Ceará', id: 129},
  {nome: 'Goiás', id: 151},
  {nome: 'Operário - PR', id: 1223},
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
];

// Função para remover acentos
function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Função para fazer requisição HTTPS com suporte a redirecionamentos
function fetchHTTPS(url, options = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error('Muitos redirecionamentos'));
    }

    const req = https.get(url, options, (res) => {
      // Se for redirecionamento (301, 302, 307, 308), seguir
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`   Seguindo redirect para: ${res.headers.location}`);
        return fetchHTTPS(res.headers.location, options, redirectCount + 1)
          .then(resolve)
          .catch(reject);
      }

      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        // Se parecer JSON, tenta parsear
        if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          // Retorna como texto (CSV)
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Função para buscar elenco de um time da API
async function buscarElencoAPI(timeId) {
  try {
    console.log(`   Tentando endpoint principal...`);
    const url = `https://v3.football.api-sports.io/players/squads?team=${timeId}`;
    const data = await fetchHTTPS(url, {
      headers: {
        'x-rapidapi-host': 'v3.football.api-sports.io',
        'x-rapidapi-key': API_KEY,
      },
    });

    if (data.response && data.response[0]?.players) {
      const jogadores = data.response[0].players.map((j) => ({
        id: j.id,
        nome: j.name,
        posicao: j.position,
        numero: j.number,
      }));
      console.log(`   ✅ ${jogadores.length} jogadores encontrados`);
      return jogadores;
    }

    // Tentar endpoint alternativo
    console.log(`   Tentando endpoint alternativo...`);
    const url2 = `https://v3.football.api-sports.io/players?team=${timeId}&season=2024&page=1`;
    const data2 = await fetchHTTPS(url2, {
      headers: {
        'x-rapidapi-host': 'v3.football.api-sports.io',
        'x-rapidapi-key': API_KEY,
      },
    });

    if (data2.response && data2.response.length > 0) {
      const jogadores = data2.response.map((item) => ({
        id: item.player.id,
        nome: item.player.name,
        posicao: item.statistics[0]?.games?.position || 'Unknown',
        numero: item.statistics[0]?.games?.number || null,
      }));
      console.log(`   ✅ ${jogadores.length} jogadores encontrados`);
      return jogadores;
    }

    console.log(`   ⚠️  Nenhum jogador encontrado`);
    return [];
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
    return [];
  }
}

// Função para aguardar X milissegundos
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Função principal
async function buscarTodosElencos() {
  console.log('🚀 Iniciando busca de elencos...\n');

  // 1. Buscar CSV da planilha
  console.log('📋 Buscando lista de times da planilha...');
  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQRrionyAwO3n3GxvyKC4Yb4iSGt7JdmuJez7_8eMPh2gwOM8f0d7aI-bSvJyC-RgJ9B5K8WIBnJcpI/pub?output=csv';

  let csvText;
  try {
    csvText = await fetchHTTPS(csvUrl);
  } catch (error) {
    console.error('❌ Erro ao buscar CSV:', error.message);
    process.exit(1);
  }

  const linhas = csvText.split('\n').map((l) => l.trim()).filter((l) => l);
  
  // Separar em Série A e Série B
  const serieA = [];
  const serieB = [];
  
  // Pular primeira linha (cabeçalhos)
  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i].split(',').map((c) => c.trim());
    if (colunas[0]) serieA.push(colunas[0]);
    if (colunas[1]) serieB.push(colunas[1]);
  }
  
  // Juntar todos os times (Série A + Série B)
  const todosNomesTimes = [...serieA, ...serieB];

  console.log(`   ✅ ${todosNomesTimes.length} times encontrados na planilha`);
  console.log(`   Times da planilha:`, todosNomesTimes);
  console.log();

  // 2. Match com DB_TIMES para pegar IDs
  console.log('🔍 Fazendo match com banco de dados...');
  const timesParaBuscar = [];
  
  for (const nomeTime of todosNomesTimes) {
    const nClean = removeAccents(nomeTime.toLowerCase().trim());
    
    for (const timeDb of DB_TIMES) {
      const dbClean = removeAccents(timeDb.nome.toLowerCase().trim());
      
      // Match exato (mesma lógica do App.tsx)
      if (dbClean === nClean) {
        if (!timesParaBuscar.find(t => t.id === timeDb.id)) {
          timesParaBuscar.push(timeDb);
          console.log(`   ✅ Match: "${nomeTime}" → ${timeDb.nome} (ID: ${timeDb.id})`);
        }
        break;
      }
    }
  }

  console.log(`   ✅ ${timesParaBuscar.length} times encontrados no banco\n`);

  // 3. Buscar elencos da API
  console.log(`⚽ Buscando elencos de ${timesParaBuscar.length} times...\n`);
  const elencos = {};
  let sucessos = 0;
  let falhas = 0;

  for (let i = 0; i < timesParaBuscar.length; i++) {
    const time = timesParaBuscar[i];
    console.log(`[${i + 1}/${timesParaBuscar.length}] ${time.nome} (ID: ${time.id})`);

    const elenco = await buscarElencoAPI(time.id);
    
    if (elenco.length > 0) {
      elencos[time.id.toString()] = elenco;
      sucessos++;
    } else {
      falhas++;
    }

    // Delay de 250ms entre chamadas para respeitar rate limit
    if (i < timesParaBuscar.length - 1) {
      await delay(250);
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Sucessos: ${sucessos}`);
  console.log(`   ❌ Falhas: ${falhas}`);
  console.log(`   📦 Total de times com elenco: ${Object.keys(elencos).length}`);

  // 4. Salvar JSON
  console.log(`\n💾 Salvando arquivo elencos.json...`);
  
  fs.mkdirSync('data', { recursive: true });
  
  const dadosFinais = {
    elencos,
    ultima_atualizacao: new Date().toISOString(),
    total_times: Object.keys(elencos).length,
  };
  
  fs.writeFileSync(
    'data/elencos.json',
    JSON.stringify(dadosFinais, null, 2),
    'utf8'
  );

  console.log('   ✅ Arquivo salvo em data/elencos.json');
  console.log('\n🎉 Processo concluído com sucesso!\n');
}

// Executar
buscarTodosElencos().catch((error) => {
  console.error('\n❌ ERRO FATAL:', error);
  process.exit(1);
});
