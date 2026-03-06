import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Search, Calendar, User, CheckCircle, Loader2, AlertCircle, Play, GraduationCap, Users, LayoutList, ChevronDown, School, Building2, BookCheck, XCircle, DollarSign, Filter, RefreshCw, FileSpreadsheet, Globe, Plus, Copy, Settings } from 'lucide-react';

const App = () => {
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [turmas, setTurmas] = useState([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [loadingAlunos, setLoadingAlunos] = useState(false); // Estado global de carregamento da turma
  const [progressAluno, setProgressAluno] = useState({ total: 0, current: 0 });
  const [error, setError] = useState(null);
  const [selectedUnidade, setSelectedUnidade] = useState('unidade_2');
  const [filtroCompradores, setFiltroCompradores] = useState(false);
  const [downloadingTurmaId, setDownloadingTurmaId] = useState(null);
  const [viewMode, setViewMode] = useState('welcome'); // 'welcome' | 'auditoria' | 'notas'
  const [filtroVeteranos, setFiltroVeteranos] = useState(false);
  const [selectedBoletim, setSelectedBoletim] = useState(null);
  const [loadingBoletim, setLoadingBoletim] = useState(false);
  const [selectedPeriodo, setSelectedPeriodo] = useState('Todos');
  const [selectedAnoBoletim, setSelectedAnoBoletim] = useState(null);
  const [selectedDisciplinasExport, setSelectedDisciplinasExport] = useState(new Set());

  // --- Pesquisa Global de Alunos ---
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalBoletim, setGlobalBoletim] = useState(null); // { aluno, unidadeNome, loading, resultados }
  const [globalAnoBol, setGlobalAnoBol] = useState(null);
  const [globalPeriodo, setGlobalPeriodo] = useState('Todos');
  const [globalDetalhes, setGlobalDetalhes] = useState(null); // { aluno, loading, data }
  const [globalDetalhesTab, setGlobalDetalhesTab] = useState('dados'); // 'dados' | 'notas'
  const [copiedField, setCopiedField] = useState(null); // tracks which field was just copied
  const searchDebounceRef = useRef(null);
  const searchInputRef = useRef(null);

  const [savedStudents, setSavedStudents] = useState(() => {
    const saved = localStorage.getItem('savedStudents');
    return saved ? JSON.parse(saved) : [];
  });
  const [exportingSavedStudents, setExportingSavedStudents] = useState(false);
  const [exportModalData, setExportModalData] = useState(null); // { allRows, uniqueDisciplines }
  const [selectedExportDisciplines, setSelectedExportDisciplines] = useState(new Set());
  const [exportProgress, setExportProgress] = useState(null);
  const [exportErrors, setExportErrors] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSavedStudentsModalOpen, setIsSavedStudentsModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('isDarkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('savedStudents', JSON.stringify(savedStudents));
  }, [savedStudents]);

  useEffect(() => {
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Configuração das unidades (Tokens e Códigos agora estão no Backend)
  // Configuração das unidades
  const UNIDADES_CONFIG = {
    unidade_1: { nome: 'Unidade 1 - Ícone Taquara 1', codigo: import.meta.env.VITE_UNIDADE_1_CODIGO, token: import.meta.env.VITE_UNIDADE_1_TOKEN },
    unidade_2: { nome: 'Unidade 2 - Ícone Taquara 2', codigo: import.meta.env.VITE_UNIDADE_2_CODIGO, token: import.meta.env.VITE_UNIDADE_2_TOKEN },
    unidade_3: { nome: 'Unidade 3 - Ícone Taquara 3', codigo: import.meta.env.VITE_UNIDADE_3_CODIGO, token: import.meta.env.VITE_UNIDADE_3_TOKEN },
    unidade_4: { nome: 'Unidade 4 - Ícone Taquara 4', codigo: import.meta.env.VITE_UNIDADE_4_CODIGO, token: import.meta.env.VITE_UNIDADE_4_TOKEN },
    unidade_5: { nome: 'Unidade 5 - Ícone Taquara 5', codigo: import.meta.env.VITE_UNIDADE_5_CODIGO, token: import.meta.env.VITE_UNIDADE_5_TOKEN },
    unidade_6: { nome: 'Unidade 6 - Ícone Taquara 6', codigo: import.meta.env.VITE_UNIDADE_6_CODIGO, token: import.meta.env.VITE_UNIDADE_6_TOKEN }
  };

  // Helper: chamada Sponte para qualquer unidade (não depende de selectedUnidade)
  const callSponteForUnit = useCallback((unidadeKey, method, params, isRaw = false) => {
    const config = UNIDADES_CONFIG[unidadeKey];
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      let url = `https://api.sponteeducacional.net.br/WSAPIEdu.asmx/${method}?nCodigoCliente=${config.codigo}&sToken=${config.token}`;
      url += isRaw ? params : `&sParametrosBusca=${params}`;
      xhr.open('GET', url, true);
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) resolve(xhr.status === 200 ? xhr.responseXML : null);
      };
      xhr.onerror = () => resolve(null);
      xhr.send();
    });
  }, []);

  // Busca global de alunos em todas as unidades
  const runGlobalSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 3) { setGlobalSearchResults([]); return; }
    setGlobalSearchLoading(true);
    const unidades = Object.keys(UNIDADES_CONFIG);
    const results = [];

    const removeAccents = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const searchTerms = removeAccents(query).split(/\s+/).filter(t => t.length > 0);

    // Precisamos enviar um termo príncipal para a API. Pegamos a primeira palavra com 3+ letras, ou a 1ª palavra.
    const apiSearchTerm = searchTerms.find(t => t.length >= 3) || searchTerms[0];

    await Promise.all(unidades.map(async (uKey) => {
      const xml = await callSponteForUnit(uKey, 'GetAlunos', `nome=${encodeURIComponent(apiSearchTerm)}`);
      if (!xml) return;
      const nodes = Array.from(xml.getElementsByTagName('wsAluno'));
      nodes.forEach(node => {
        const id = node.getElementsByTagName('AlunoID')[0]?.textContent;
        const nome = node.getElementsByTagName('Nome')[0]?.textContent;
        const situacao = node.getElementsByTagName('Situacao')[0]?.textContent || 'Inativo';
        if (id && id !== '0' && nome) {
          const nomeNormalizado = removeAccents(nome);
          // Verifica se TODAS as partes pesquisadas estão no nome do aluno (não importando a ordem ou distância)
          const matchesAll = searchTerms.every(term => nomeNormalizado.includes(term));

          if (matchesAll) {
            results.push({ id, nome, situacao, unidadeKey: uKey, unidadeNome: UNIDADES_CONFIG[uKey].nome });
          }
        }
      });
    }));

    const grouped = new Map();
    results.forEach(r => {
      const gName = removeAccents(r.nome);
      if (!grouped.has(gName)) {
        grouped.set(gName, { nome: r.nome, id: r.id, situacao: r.situacao, unidadeKey: r.unidadeKey, unidadeNome: r.unidadeNome, unidades: [] });
      }

      const group = grouped.get(gName);

      // PRIORIDADE: Se o registro atual é INATIVO mas encontramos um ATIVO, trocamos os dados principais
      if (group.situacao !== 'Ativo' && r.situacao === 'Ativo') {
        group.id = r.id;
        group.situacao = r.situacao;
        group.unidadeKey = r.unidadeKey;
        group.unidadeNome = r.unidadeNome;
      }

      if (!group.unidades.some(u => u.unidadeKey === r.unidadeKey)) {
        group.unidades.push({ id: r.id, unidadeKey: r.unidadeKey, unidadeNome: r.unidadeNome });
      }
    });

    const finalResults = Array.from(grouped.values())
      .sort((a, b) => {
        if (a.situacao === 'Ativo' && b.situacao !== 'Ativo') return -1;
        if (a.situacao !== 'Ativo' && b.situacao === 'Ativo') return 1;
        return a.nome.localeCompare(b.nome);
      })
      .slice(0, 15);

    // BÔNUS: Para cada resultado final que esteja ATIVO, vamos buscar a turma atual dele
    // Fazemos isso em paralelo para ser rápido
    await Promise.all(finalResults.map(async (res) => {
      if (res.situacao === 'Ativo') {
        try {
          // Busca matrícula na unidade principal do resultado
          const matXml = await callSponteForUnit(res.unidadeKey, 'GetMatriculas', `alunoid=${res.id}`);
          if (matXml) {
            const mats = Array.from(matXml.getElementsByTagName('wsMatricula'));
            // Pega a matrícula de 2026 ou a mais recente
            const mat2026 = mats.find(m => (m.getElementsByTagName('AnoLetivo')[0]?.textContent || '') === '2026');
            const matRecente = mat2026 || mats[0];

            if (matRecente) {
              res.turmaNome = matRecente.getElementsByTagName('NomeTurma')[0]?.textContent || '';
            }
          }
        } catch (e) {
          console.error("Erro ao buscar turma para pesquisa global", e);
        }
      }
    }));

    setGlobalSearchResults(finalResults);
    setGlobalSearchLoading(false);
  }, [callSponteForUnit]);

  // Exportar Alunos Salvos para Excel
  const handleExportSavedStudents = async () => {
    if (savedStudents.length === 0) return;
    setExportingSavedStudents(true);
    setExportProgress({ current: 0, total: savedStudents.length, studentName: '' });
    setExportErrors([]);

    try {
      const allRows = [];
      let currentIdx = 0;

      // Loop pelos alunos salvos
      for (const student of savedStudents) {
        currentIdx++;
        setExportProgress({ current: currentIdx, total: savedStudents.length, studentName: student.nome });

        try {
          const studentUnits = student.unidades && student.unidades.length > 0
            ? student.unidades
            : [{ id: student.id, unidadeKey: student.unidadeKey, unidadeNome: student.unidadeNome }];

          let studentGradesMap = new Map(); // key: disciplina -> value: object de notas
          const anoGeralMap = {}; // aggregated map for ALL units: { '2025': [ {turmaId, unidadeKey, unidadeNome} ] }

          // Loop pelas unidades do aluno (agora apenas para coletar as matrículas e anos)
          for (const unit of studentUnits) {
            const matriculasXml = await callSponteForUnit(unit.unidadeKey, 'GetMatriculas', `alunoid=${unit.id}`);
            if (!matriculasXml) continue;
            const mats = Array.from(matriculasXml.getElementsByTagName('wsMatricula'));

            mats.forEach(m => {
              const dataInicio = m.getElementsByTagName('DataInicio')[0]?.textContent || '';
              const dataMatricula = m.getElementsByTagName('DataMatricula')[0]?.textContent || '';
              let ano = '';
              if (dataInicio.includes('/')) ano = dataInicio.split(' ')[0].split('/')[2];
              else if (dataInicio.includes('-')) ano = dataInicio.split('T')[0].split('-')[0];
              if (!ano && dataMatricula.includes('/')) ano = dataMatricula.split(' ')[0].split('/')[2];
              else if (!ano && dataMatricula.includes('-')) ano = dataMatricula.split('T')[0].split('-')[0];
              if (!ano) ano = m.getElementsByTagName('AnoLetivo')[0]?.textContent || '';

              const turmaId = m.getElementsByTagName('TurmaID')[0]?.textContent || '';

              if (ano && ano.length === 4 && turmaId) {
                if (!anoGeralMap[ano]) anoGeralMap[ano] = [];
                // Evita duplicar a mesma turma para o mesmo ano/unidade
                if (!anoGeralMap[ano].some(t => t.turmaId === turmaId && t.unidadeKey === unit.unidadeKey)) {
                  anoGeralMap[ano].push({ turmaId, unidadeKey: unit.unidadeKey, unidadeNome: unit.unidadeNome, alunoId: unit.id });
                }
              }
            });
          }

          const anosOrdenadosGerais = Object.keys(anoGeralMap).sort((a, b) => b.localeCompare(a));

          // Busca as notas nas turmas, descendo do ano mais recente GERAL para o mais antigo GERAL
          // Assim que encontrar UM ano com notas em qualquer unidade, para a busca.
          for (const anoToTest of anosOrdenadosGerais) {
            let foundGradesThisYear = false;

            // Para cada turma (em qualquer unidade) vinculada a este ano
            for (const turmaInfo of anoGeralMap[anoToTest]) {
              const npXml = await callSponteForUnit(turmaInfo.unidadeKey, 'GetNotaParcial', `&nAlunoID=${turmaInfo.alunoId}&nTurmaID=${turmaInfo.turmaId}&nCursoID=0&sParametrosBusca=`, true);
              if (!npXml) continue;

              const disciplinasNodes = Array.from(npXml.getElementsByTagName('wsDisciplinasNotasParciais'));
              disciplinasNodes.forEach(discNode => {
                const periodos = Array.from(discNode.getElementsByTagName('wsNotasPeriodos'));

                periodos.forEach(perNode => {
                  const nomePeriodoStr = (perNode.getElementsByTagName('NomePeriodo')[0]?.textContent || '').toUpperCase();
                  const trimMatch = nomePeriodoStr.match(/(\d)º\s*TRIMESTRE/);
                  if (trimMatch) {
                    foundGradesThisYear = true; // Achou notas de trimestre neste ano GERAL

                    const disciplinaNome = discNode.getElementsByTagName('NomeDisciplina')[0]?.textContent || 'Desconhecida';
                    if (!studentGradesMap.has(disciplinaNome)) {
                      studentGradesMap.set(disciplinaNome, {
                        'Aluno': student.nome,
                        'Unidade': turmaInfo.unidadeNome, // Usa a unidade de onde a nota realmente veio
                        'Ano Letivo': anoToTest,
                        'Disciplina': disciplinaNome,
                        '1º Trim (Nota)': '-', '1º Trim (VAD)': '-', '1º Trim (VAO)': '-', '1º Trim (VAF)': '-',
                        '2º Trim (Nota)': '-', '2º Trim (VAD)': '-', '2º Trim (VAO)': '-', '2º Trim (VAF)': '-',
                        '3º Trim (Nota)': '-', '3º Trim (VAD)': '-', '3º Trim (VAO)': '-', '3º Trim (VAF)': '-'
                      });
                    }

                    const cols = studentGradesMap.get(disciplinaNome);
                    const trim = trimMatch[1]; // '1', '2' ou '3'
                    cols[`${trim}º Trim (Nota)`] = perNode.getElementsByTagName('MediaPrevista')[0]?.textContent || '-';

                    const parciais = Array.from(perNode.getElementsByTagName('wsNotaParcial'));
                    parciais.forEach(np => {
                      const nomeAval = (np.getElementsByTagName('NomeAvaliacao')[0]?.textContent || '').toUpperCase();
                      const val = np.getElementsByTagName('Nota')[0]?.textContent || '-';
                      if (nomeAval.includes('VAD')) cols[`${trim}º Trim (VAD)`] = val;
                      if (nomeAval.includes('VAO')) cols[`${trim}º Trim (VAO)`] = val;
                      if (nomeAval.includes('VAF')) cols[`${trim}º Trim (VAF)`] = val;
                    });
                  }
                });
              });
            }

            if (foundGradesThisYear) {
              // Encerra a busca ao encontrar qualquer nota válida do aluno no ano mais atual possível
              break;
            }
          }

          // Adiciona as linhas do aluno à planilha final
          studentGradesMap.forEach(row => allRows.push(row));
        } catch (innerErr) {
          console.error(`Erro ao buscar notas do aluno ${student.nome}:`, innerErr);
          setExportErrors(prev => [...prev, student.nome]);
        }
      }

      setExportProgress(null);

      if (allRows.length === 0) {
        alert("Não foram encontradas notas nos padrões (1º, 2º, 3º Trimestre) para os alunos da lista.");
        setExportingSavedStudents(false);
        return;
      }

      // Instead of downloading directly, extract unique disciplines and show modal
      const uniqueDisciplines = [...new Set(allRows.map(row => row.Disciplina))].sort((a, b) => a.localeCompare(b));
      setExportModalData({ allRows, uniqueDisciplines });
      setSelectedExportDisciplines(new Set(uniqueDisciplines)); // All selected by default

    } catch (err) {
      console.error(err);
      alert("Houve um erro ao buscar as notas para exportação.");
    } finally {
      setExportingSavedStudents(false);
    }
  };

  // Executa o download real em Excel filtrando apenas pelas disciplinas checadas
  const confirmExportSelection = () => {
    if (!exportModalData) return;

    try {
      const { allRows } = exportModalData;
      // Filter rows
      const filteredRows = allRows.filter(row => selectedExportDisciplines.has(row.Disciplina));

      if (filteredRows.length === 0) {
        alert("Selecione pelo menos uma disciplina antes de exportar.");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(filteredRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Notas Consolidadas`);
      XLSX.writeFile(wb, `Notas_Alunos_Salvos_${new Date().getTime()}.xlsx`);

      setExportModalData(null); // Close modal
    } catch (err) {
      console.error(err);
      alert("Houve um erro ao gerar a planilha Excel.");
    }
  };

  // Abre detalhes do aluno da pesquisa global (dados primeiro, notas depois)
  const fetchGlobalDetalhes = async (alunoResult) => {
    setGlobalDetalhes({ aluno: alunoResult, loading: true, data: null });
    setGlobalDetalhesTab('dados');
    setGlobalSearchOpen(false);
    setGlobalSearch(alunoResult.nome);

    try {
      // Pega o ID do aluno na primeira unidade disponível
      const primeiraUnidade = alunoResult.unidades && alunoResult.unidades.length > 0
        ? alunoResult.unidades[0]
        : { id: alunoResult.id, unidadeKey: alunoResult.unidadeKey };

      const xml = await callSponteForUnit(primeiraUnidade.unidadeKey, 'GetAlunos', `alunoid=${primeiraUnidade.id}`);
      const alunoNode = xml?.getElementsByTagName('wsAluno')[0];

      if (alunoNode) {
        let dataNasc = alunoNode.getElementsByTagName('DataNascimento')[0]?.textContent || '';
        if (dataNasc) {
          try {
            if (dataNasc.includes('T')) dataNasc = dataNasc.split('T')[0];
            if (dataNasc.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const [y, m, d] = dataNasc.split('-');
              dataNasc = `${d}/${m}/${y}`;
            } else if (dataNasc.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
              const [d, m, y] = dataNasc.split('/');
              dataNasc = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
            }
          } catch (e) { }
        }

        // Busca turma do aluno em todas as unidades para achar a mais recente
        let turmaNome = alunoResult.turmaNome || '';
        if (!turmaNome) {
          try {
            const studentUnits = alunoResult.unidades && alunoResult.unidades.length > 0
              ? alunoResult.unidades
              : [{ id: alunoResult.id, unidadeKey: alunoResult.unidadeKey }];

            const allEnrollments = [];

            await Promise.all(studentUnits.map(async (unit) => {
              const matXml = await callSponteForUnit(unit.unidadeKey, 'GetMatriculas', `alunoid=${unit.id}`);
              if (matXml) {
                const mats = Array.from(matXml.getElementsByTagName('wsMatricula'));
                mats.forEach(m => {
                  const dataInicio = m.getElementsByTagName('DataInicio')[0]?.textContent || '';
                  const dataMatricula = m.getElementsByTagName('DataMatricula')[0]?.textContent || '';
                  const anoLetivo = m.getElementsByTagName('AnoLetivo')[0]?.textContent || '';
                  const nomeTurma = m.getElementsByTagName('NomeTurma')[0]?.textContent || '';

                  let ano = '';
                  if (dataInicio) {
                    if (dataInicio.includes('/')) ano = dataInicio.split(' ')[0].split('/')[2];
                    else if (dataInicio.includes('-')) ano = dataInicio.split('T')[0].split('-')[0];
                  }
                  if (!ano && dataMatricula) {
                    if (dataMatricula.includes('/')) ano = dataMatricula.split(' ')[0].split('/')[2];
                    else if (dataMatricula.includes('-')) ano = dataMatricula.split('T')[0].split('-')[0];
                  }
                  if (!ano) ano = anoLetivo;

                  if (nomeTurma && ano && ano.length === 4) {
                    allEnrollments.push({ ano: parseInt(ano), nomeTurma });
                  }
                });
              }
            }));

            if (allEnrollments.length > 0) {
              // Ordena por ano decrescente numericamente
              allEnrollments.sort((a, b) => b.ano - a.ano);
              turmaNome = allEnrollments[0].nomeTurma;
            }
          } catch (e) {
            console.error("Erro ao buscar turma recente", e);
          }
        }

        const matricula = alunoNode.getElementsByTagName('NumeroMatricula')[0]?.textContent || alunoNode.getElementsByTagName('RA')[0]?.textContent || '';
        setGlobalDetalhes({
          aluno: alunoResult,
          loading: false,
          data: {
            matricula,
            dataNascimento: dataNasc || '--',
            cpf: alunoNode.getElementsByTagName('CPF')[0]?.textContent || '--',
            email: alunoNode.getElementsByTagName('Email')[0]?.textContent || '--',
            turma: turmaNome || 'Não informado',
          }
        });
      } else {
        setGlobalDetalhes({ aluno: alunoResult, loading: false, data: null, error: 'Dados não encontrados.' });
      }
    } catch (err) {
      setGlobalDetalhes({ aluno: alunoResult, loading: false, data: null, error: 'Erro ao carregar dados.' });
    }
  };

  // Carrega boletim completo do aluno em TODAS as unidades
  const fetchGlobalBoletim = async (alunoResult) => {
    setGlobalBoletim({ aluno: alunoResult, loading: true, resultados: {} });
    setGlobalSearchOpen(false);
    setGlobalSearch(alunoResult.nome);

    const parseExtrato = (xml) => {
      const disciplinas = Array.from(xml.getElementsByTagName('wsDisciplinasNotasParciais'));
      let extrato = [];
      disciplinas.forEach(discNode => {
        const nomeDisciplina = discNode.getElementsByTagName('NomeDisciplina')[0]?.textContent || 'Média/Geral';
        Array.from(discNode.getElementsByTagName('wsNotasPeriodos')).forEach(perNode => {
          const nomePeriodo = perNode.getElementsByTagName('NomePeriodo')[0]?.textContent;
          const mediaPrevista = perNode.getElementsByTagName('MediaPrevista')[0]?.textContent;
          if (nomePeriodo && mediaPrevista) {
            const subNotas = [];
            Array.from(perNode.getElementsByTagName('wsNotaParcial')).forEach(np => {
              const nomeAvaliacao = np.getElementsByTagName('NomeAvaliacao')[0]?.textContent || '';
              const nota = np.getElementsByTagName('Nota')[0]?.textContent || '';
              if (nomeAvaliacao && nota) subNotas.push({ nome: nomeAvaliacao, nota });
            });
            const idUnico = `${nomeDisciplina}-${nomePeriodo}`;
            if (!extrato.some(e => e.id === idUnico))
              extrato.push({ id: idUnico, disciplina: nomeDisciplina, nome: nomePeriodo, notaFinal: mediaPrevista, subNotas });
          }
        });
      });
      return extrato;
    };

    const resultados = {}; // { unidadeKey: { unidadeNome, anos: { '2025': [...], ... } } }

    await Promise.all(Object.keys(UNIDADES_CONFIG).map(async (uKey) => {
      // Encontra o ID correto deste aluno nesta unidade específica
      let targetId = null;
      if (alunoResult.unidades && alunoResult.unidades.length > 0) {
        const uInfo = alunoResult.unidades.find(u => u.unidadeKey === uKey);
        if (uInfo) targetId = uInfo.id;
      } else {
        // Fallback para pesquisas salvas antigas
        targetId = alunoResult.id;
      }

      // Se não tem ID correspondente para esta unidade, pule
      if (!targetId) return;

      const matriculasXml = await callSponteForUnit(uKey, 'GetMatriculas', `alunoid=${targetId}`);
      if (!matriculasXml) return;
      const mats = Array.from(matriculasXml.getElementsByTagName('wsMatricula'));
      if (mats.length === 0) return;

      const anoMap = {};
      mats.forEach(m => {
        const dataInicio = m.getElementsByTagName('DataInicio')[0]?.textContent || '';
        const dataMatricula = m.getElementsByTagName('DataMatricula')[0]?.textContent || '';
        let ano = '';
        if (dataInicio.includes('/')) ano = dataInicio.split(' ')[0].split('/')[2];
        else if (dataInicio.includes('-')) ano = dataInicio.split('T')[0].split('-')[0];
        if (!ano && dataMatricula.includes('/')) ano = dataMatricula.split(' ')[0].split('/')[2];
        else if (!ano && dataMatricula.includes('-')) ano = dataMatricula.split('T')[0].split('-')[0];
        if (!ano) ano = m.getElementsByTagName('AnoLetivo')[0]?.textContent || '';
        const nomeTurma = m.getElementsByTagName('NomeTurma')[0]?.textContent || '';
        const turmaId = m.getElementsByTagName('TurmaID')[0]?.textContent || '';
        if (ano && ano.length === 4 && turmaId) {
          if (!anoMap[ano]) anoMap[ano] = { turmaIds: [], nomeTurma };
          if (!anoMap[ano].turmaIds.includes(turmaId)) anoMap[ano].turmaIds.push(turmaId);
          if (nomeTurma) anoMap[ano].nomeTurma = nomeTurma;
        }
      });

      const anosResult = {};
      for (const [ano, { turmaIds, nomeTurma }] of Object.entries(anoMap)) {
        let extratoAno = [];
        for (const turmaId of turmaIds) {
          const npXml = await callSponteForUnit(uKey, 'GetNotaParcial', `&nAlunoID=${targetId}&nTurmaID=${turmaId}&nCursoID=0&sParametrosBusca=`, true);
          if (npXml) {
            parseExtrato(npXml).forEach(d => { if (!extratoAno.some(e => e.id === d.id)) extratoAno.push(d); });
          }
        }
        anosResult[ano] = { disciplinas: extratoAno, nomeTurma, temNotas: extratoAno.length > 0 };
      }

      if (Object.keys(anosResult).length > 0) {
        resultados[uKey] = { unidadeNome: UNIDADES_CONFIG[uKey].nome, anos: anosResult };
      }
    }));

    const anosDisponiveis = [...new Set(
      Object.values(resultados).flatMap(u => Object.keys(u.anos))
    )].sort((a, b) => b.localeCompare(a));

    let firstAno = anosDisponiveis[0] || null;

    // Busca o primeiro ano que realmente tenha notas
    for (const ano of anosDisponiveis) {
      const anoTemNotas = Object.values(resultados).some(
        u => u.anos[ano] && u.anos[ano].temNotas
      );
      if (anoTemNotas) {
        firstAno = ano;
        break;
      }
    }

    setGlobalBoletim({ aluno: alunoResult, loading: false, resultados });
    setGlobalAnoBol(firstAno);
    setGlobalPeriodo('Todos');
  };

  // Função genérica de Request
  const callSponteXhr = (method, params, isRawQuery = false) => {
    return new Promise((resolve, reject) => {
      const config = UNIDADES_CONFIG[selectedUnidade];
      const xhr = new XMLHttpRequest();

      let url = `https://api.sponteeducacional.net.br/WSAPIEdu.asmx/${method}?nCodigoCliente=${config.codigo}&sToken=${config.token}`;
      if (isRawQuery) {
        url += params;
      } else {
        url += `&sParametrosBusca=${params}`;
      }

      xhr.open("GET", url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            resolve(xhr.responseXML);
          } else {
            // Em caso de erro, resolve com null para não quebrar o Promise.all
            console.error(`Erro API ${method}:`, xhr.status);
            resolve(null);
          }
        }
      };
      xhr.onerror = () => resolve(null); // Falha de rede não quebra o fluxo
      xhr.send();
    });
  };

  // 1. Carregar Turmas de 2026
  const fetchTurmas = async () => {
    setLoadingTurmas(true);
    setError(null);
    setTurmas([]);
    setAlunos([]);
    setSelectedTurmaId(null);

    try {
      const xml = await callSponteXhr('GetTurmas2', 'AnoLetivo=2026');
      if (!xml) throw new Error("Falha ao comunicar com o servidor.");

      const nodes = Array.from(xml.getElementsByTagName('wsTurma2'));

      const listaTurmas = nodes.map(node => ({
        id: node.getElementsByTagName('TurmaID')[0]?.textContent,
        nome: node.getElementsByTagName('Nome')[0]?.textContent,
        sigla: node.getElementsByTagName('Sigla')[0]?.textContent,
        situacao: node.getElementsByTagName('Situacao')[0]?.textContent,
        vagasOcupadas: node.getElementsByTagName('VagasOcupadas')[0]?.textContent,
        maxAlunos: node.getElementsByTagName('MaxAlunos')[0]?.textContent,
      })).filter(t => t.situacao === 'Aberta' || t.situacao === 'Lotada');

      // Remove duplicatas de TurmaID
      const turmasUnicas = Array.from(new Map(listaTurmas.map(item => [item.id, item])).values());

      if (turmasUnicas.length === 0) {
        throw new Error(`Nenhuma turma encontrada em 2026 na ${UNIDADES_CONFIG[selectedUnidade].nome}.`);
      }

      setTurmas(turmasUnicas);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTurmas(false);
    }
  };

  // EXPORTAÇÃO
  const handleDownloadReport = async (turma, e) => {
    e.stopPropagation();
    if (downloadingTurmaId) return;

    setDownloadingTurmaId(turma.id);

    try {
      // 1. Buscar integrantes
      const integrantesXml = await callSponteXhr('GetIntegrantesTurmas', `TurmaID=${turma.id}`);
      if (!integrantesXml) throw new Error("Erro ao buscar alunos.");

      const integrantesNodes = Array.from(integrantesXml.getElementsByTagName('Integrantes'));

      let alunosExport = integrantesNodes
        .map(node => ({
          id: node.getElementsByTagName('AlunoID')[0]?.textContent,
          nome: node.getElementsByTagName('Nome')[0]?.textContent,
        }))
        .filter(a => a.id && a.nome);

      // Remove duplicatas
      alunosExport = Array.from(new Map(alunosExport.map(item => [item.id, item])).values());

      const processarAluno = async (aluno) => {
        // A. Verifica Financeiro (Reuso da lógica)
        const finXml = await callSponteXhr('GetFinanceiro', `alunoid=${aluno.id}`);
        let pago = false;

        if (finXml) {
          let itens = Array.from(finXml.getElementsByTagName('wsFinanceiro'));
          if (itens.length === 0) itens = Array.from(finXml.getElementsByTagName('wsFinanceiroDescontos'));

          const keywords = ['plataforma', 'material', 'didatico', 'didático', 'apostila', 'livro', 'sistema', 'kit', '1.0'];

          itens.forEach(item => {
            const cat = (item.getElementsByTagName('Categoria')[0]?.textContent || '').toLowerCase();
            const desc = (item.getElementsByTagName('Descricao')[0]?.textContent || '').toLowerCase();
            const tipoPlano = (item.getElementsByTagName('TipoPlano')[0]?.textContent || '').toLowerCase();

            const parcelas = Array.from(item.getElementsByTagName('wsParcela'));
            const parcelasFallback = Array.from(item.getElementsByTagName('wsParcelaDescontos'));
            const todasParcelas = [...parcelas, ...parcelasFallback];

            const temParcela2026 = todasParcelas.some(p => {
              const v = p.getElementsByTagName('Vencimento')[0]?.textContent || '';
              const dp = p.getElementsByTagName('DataPagamento')[0]?.textContent || '';
              return v.includes('2026') || dp.includes('2026');
            });

            if (keywords.some(k => cat.includes(k) || desc.includes(k) || tipoPlano.includes(k))) {
              // Se tem parcelas e nenhuma é de 2026, ignora
              if (todasParcelas.length > 0 && !temParcela2026) return;

              // Verifica se está pago
              const estaPago = todasParcelas.some(p => {
                const s = (p.getElementsByTagName('SituacaoParcela')[0]?.textContent || '').toLowerCase();
                const dp = (p.getElementsByTagName('DataPagamento')[0]?.textContent || '');
                return s === 'quitada' || (dp && dp.length > 5);
              });

              if (estaPago) pago = true;
            }
          });
        }

        // Se não pagou, retorna null para filtrar depois
        if (!pago) return null;

        // B. Busca Detalhes para o CSV
        const xml = await callSponteXhr('GetAlunos', `alunoid=${aluno.id}`);
        const alunoNode = xml?.getElementsByTagName('wsAluno')[0];

        if (alunoNode) {
          const matricula = alunoNode.getElementsByTagName('NumeroMatricula')[0]?.textContent ||
            alunoNode.getElementsByTagName('RA')[0]?.textContent || '';

          // Formata Data Rígida (dd/mm/yyyy)
          let dataNasc = alunoNode.getElementsByTagName('DataNascimento')[0]?.textContent || '';
          if (dataNasc) {
            try {
              // Remove hora se houver
              if (dataNasc.includes('T')) dataNasc = dataNasc.split('T')[0];

              // Parse simple
              if (dataNasc.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [y, m, d] = dataNasc.split('-');
                dataNasc = `${d}/${m}/${y}`;
              } else if (dataNasc.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                // Já está em pt-BR, mas garante padding
                const [d, m, y] = dataNasc.split('/');
                dataNasc = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
              }
            } catch (e) { console.error('Date parse error', e); }
          }

          // Fallback visual para Excel não bugar
          if (!dataNasc) dataNasc = "";

          return {
            ...aluno,
            dataNascimento: dataNasc,
            cpf: alunoNode.getElementsByTagName('CPF')[0]?.textContent || '',
            email: alunoNode.getElementsByTagName('Email')[0]?.textContent || '',
            matricula,
            usuario: matricula ? `i${matricula}` : '',
            senha: matricula ? `Icone@${matricula}` : ''
          };
        }
        return { ...aluno, dataNascimento: '', cpf: '', email: '', matricula: '', usuario: '', senha: '' };
      };

      const BATCH_SIZE = 5;
      const alunosCompletos = [];

      for (let i = 0; i < alunosExport.length; i += BATCH_SIZE) {
        const batch = alunosExport.slice(i, i + BATCH_SIZE);
        const resultados = await Promise.all(batch.map(processarAluno));
        // Filtra nulos (não pagos)
        alunosCompletos.push(...resultados.filter(r => r !== null));
      }

      if (alunosCompletos.length === 0) {
        alert("Nenhum aluno com material PAGO encontrado nesta turma.");
        setDownloadingTurmaId(null);
        return;
      }

      // 3. Gerar XLSX
      // Header: Nome Completo, Nome de Usuario, Data de Nascimento, CPF, E-mail, Turma, Matrícula, Senha Temporaria

      // Helper function to remove accents (assuming it's defined elsewhere or will be added)
      const removeAccents = (str) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      };

      const turmaNomeSanitized = removeAccents(turma.nome);

      const dadosExport = alunosCompletos.map(a => ({
        "Nome Completo": a.nome,
        "Nome de Usuario": a.usuario,
        "Data de Nascimento": a.dataNascimento,
        "CPF": a.cpf,
        "E-mail": a.email,
        "Turma": turmaNomeSanitized,
        "Matrícula": a.matricula,
        "Senha Temporaria": a.senha
      }));

      const worksheet = XLSX.utils.json_to_sheet(dadosExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Alunos");

      // 4. Download
      const fileName = `lista_alunos_${turmaNomeSanitized.replace(/\s+/g, '_').substring(0, 30)}_2026.xlsx`;
      XLSX.writeFile(workbook, fileName);


    } catch (err) {
      console.error("Erro export:", err);
      alert("Erro ao gerar planilha. Tente novamente.");
    } finally {
      setDownloadingTurmaId(null);
    }
  };

  // 2. Carregar Alunos e verificar Financeiro GLOBALMENTE (Otimizado)
  const fetchAlunosEMateriais = async (turmaId) => {
    if (selectedTurmaId === turmaId) {
      setSelectedTurmaId(null);
      setAlunos([]);
      return;
    }

    setLoadingAlunos(true);
    setSelectedTurmaId(turmaId);
    setAlunos([]);
    setProgressAluno({ total: 0, current: 0 });

    try {
      // A. Busca a lista de alunos da turma
      const integrantesXml = await callSponteXhr('GetIntegrantesTurmas', `TurmaID=${turmaId}`);
      if (!integrantesXml) throw new Error("Erro ao buscar integrantes.");

      const integrantesNodes = Array.from(integrantesXml.getElementsByTagName('Integrantes'));

      const listaBase = integrantesNodes
        .map(node => ({
          id: node.getElementsByTagName('AlunoID')[0]?.textContent,
          nome: node.getElementsByTagName('Nome')[0]?.textContent,
          contrato: node.getElementsByTagName('NumeroContrato')[0]?.textContent,
          material: { loading: true, comprou: false, pago: false, det: '' }
        }))
        .filter(a => a.id && a.nome);

      const alunosUnicos = Array.from(new Map(listaBase.map(item => [item.id, item])).values());

      // Atualiza a tela com os alunos (ainda carregando financeiro)
      setAlunos(alunosUnicos);
      setProgressAluno({ total: alunosUnicos.length, current: 0 });

      // ESTRATÉGIA DE CRUZAMENTO:
      // Vamos tentar usar GetFinanceiro por aluno, pois é o método mais garantido de pegar "Contas a Receber" ligadas ao Contrato.
      // GetVendas seria para itens avulsos. O "Material Didático" de 2026 geralmente está no contrato.

      const keywords = ['plataforma', 'material', 'didatico', 'didático', 'apostila', 'livro', 'sistema', 'kit', '1.0'];

      // Helper para formatar data (usado no export também)
      const formatDate = (dateStr) => {
        if (!dateStr) return '';
        // Tenta lidar com formatos ISO ou PT-BR
        try {
          if (dateStr.includes('T')) {
            const date = new Date(dateStr);
            return date.toLocaleDateString('pt-BR');
          }
          // Se já vier algo como yyyy-mm-dd
          if (dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('T')[0].split('-');
            return `${day}/${month}/${year}`;
          }
          return dateStr; // Retorna original se não identificar
        } catch (e) {
          return dateStr;
        }
      };

      const updateAlunoFinanceiro = async (aluno) => {
        if (viewMode === 'notas') {
          // Lógica para buscar matrículas
          let xml = await callSponteXhr('GetMatriculas', `alunoid=${aluno.id}`);
          // anoMap: { '2025': ['660', '582'], '2024': ['550'] }
          const anoMap = {};
          if (xml) {
            const matriculas = Array.from(xml.getElementsByTagName('wsMatricula'));
            matriculas.forEach(m => {
              const dataInicio = m.getElementsByTagName('DataInicio')[0]?.textContent || '';
              const dataMatricula = m.getElementsByTagName('DataMatricula')[0]?.textContent || '';

              let ano = '';
              if (dataInicio) {
                if (dataInicio.includes('-')) ano = dataInicio.split('T')[0].split('-')[0];
                else if (dataInicio.includes('/')) ano = dataInicio.split(' ')[0].split('/')[2];
              }
              if (!ano && dataMatricula) {
                if (dataMatricula.includes('-')) ano = dataMatricula.split('T')[0].split('-')[0];
                else if (dataMatricula.includes('/')) ano = dataMatricula.split(' ')[0].split('/')[2];
              }
              if (!ano) {
                ano = m.getElementsByTagName('AnoLetivo')[0]?.textContent || ''; // Fallback
              }

              const turmaIdPassada = m.getElementsByTagName('TurmaID')[0]?.textContent || '';

              // Store ALL turmaIds per year (student may have changed classes mid-year)
              if (ano && ano.length === 4 && turmaIdPassada) {
                if (!anoMap[ano]) anoMap[ano] = [];
                if (!anoMap[ano].includes(turmaIdPassada)) anoMap[ano].push(turmaIdPassada);
              }
            });
          }
          // Remove 2026 (current year) and build array, sorted descending
          const anosAnteriores = Object.entries(anoMap)
            .filter(([ano]) => ano !== '2026')
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([ano, turmaIds]) => ({ ano, turmaIds }));

          setAlunos(prev => prev.map(a =>
            a.id === aluno.id
              ? { ...a, material: { loading: false, comprou: false, pago: false, det: '', anosAnteriores } }
              : a
          ));
          setProgressAluno(prev => ({ ...prev, current: prev.current + 1 }));
          return;
        }

        // Tenta GetFinanceiro para o aluno
        let xml = await callSponteXhr('GetFinanceiro', `alunoid=${aluno.id}`);

        let comprou = false;
        let pago = false;
        let detalhe = '';

        if (xml) {
          // CORREÇÃO: A tag correta geralmente é wsFinanceiro, mas mantemos fallback
          // Primeiro tenta a tag padrão 'wsFinanceiro'
          let itens = Array.from(xml.getElementsByTagName('wsFinanceiro'));
          // Se vazio, tenta 'wsFinanceiroDescontos' (legado ou config específica)
          if (itens.length === 0) {
            itens = Array.from(xml.getElementsByTagName('wsFinanceiroDescontos'));
          }

          itens.forEach(item => {
            const cat = (item.getElementsByTagName('Categoria')[0]?.textContent || '').toLowerCase();
            const desc = (item.getElementsByTagName('Descricao')[0]?.textContent || '').toLowerCase();
            const tipoPlano = (item.getElementsByTagName('TipoPlano')[0]?.textContent || '').toLowerCase();

            // EXTRAÇÃO DAS PARCELAS
            // Tenta 'wsParcela' (padrão em wsFinanceiro) e 'wsParcelaDescontos' (fallback)
            const parcelas = Array.from(item.getElementsByTagName('wsParcela'));
            const parcelasFallback = Array.from(item.getElementsByTagName('wsParcelaDescontos'));
            const todasParcelas = [...parcelas, ...parcelasFallback];

            // VERIFICAÇÃO DE ANO: Verifica se há alguma parcela/vencimento em 2026
            const temParcela2026 = todasParcelas.some(p => {
              const v = p.getElementsByTagName('Vencimento')[0]?.textContent || '';
              const dp = p.getElementsByTagName('DataPagamento')[0]?.textContent || '';
              return v.includes('2026') || dp.includes('2026');
            });

            // LÓGICA DE MATCH:
            // Se encontrar palavra-chave E (for de 2026 OU não tivermos filtrado ano nas parcelas)
            if (keywords.some(k => cat.includes(k) || desc.includes(k) || tipoPlano.includes(k))) {

              // Se tiver parcelas identificáveis e NENHUMA for de 2026, ignoramos (ex: material antigo)
              if (todasParcelas.length > 0 && !temParcela2026) return;

              comprou = true;
              // Tenta pegar o nome mais descritivo possível
              detalhe = item.getElementsByTagName('Categoria')[0]?.textContent || desc || 'Material';

              const estaPago = todasParcelas.some(p => {
                const s = (p.getElementsByTagName('SituacaoParcela')[0]?.textContent || '').toLowerCase();
                const dp = p.getElementsByTagName('DataPagamento')[0]?.textContent;
                // Pago se status quitada OU data pagamento presente
                return s === 'quitada' || (dp && dp.length > 5);
              });

              if (estaPago) pago = true;
            }
          });
        }

        setAlunos(prev => prev.map(a =>
          a.id === aluno.id
            ? { ...a, material: { loading: false, comprou, pago, det: detalhe } }
            : a
        ));
        setProgressAluno(prev => ({ ...prev, current: prev.current + 1 }));
      };

      // Executa em lotes limitados para evitar timeout
      const BATCH_SIZE = 5;
      for (let i = 0; i < alunosUnicos.length; i += BATCH_SIZE) {
        const batch = alunosUnicos.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(a => updateAlunoFinanceiro(a)));
      }

    } catch (err) {
      console.error(err);
      setError("Erro ao carregar dados: " + err.message);
    } finally {
      setLoadingAlunos(false);
    }
  };

  const [selectedAlunoDetails, setSelectedAlunoDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // 3. Carregar Detalhes do Aluno (On Demand)
  const fetchDetalhesAluno = async (aluno) => {
    setLoadingDetails(true);
    setSelectedAlunoDetails({ ...aluno, loading: true }); // Abre modal loading

    try {
      // CORREÇÃO: Usando GetAlunos que retorna os dados cadastrais completos
      const xml = await callSponteXhr('GetAlunos', `alunoid=${aluno.id}`);
      if (!xml) throw new Error("Erro ao buscar detalhes.");

      const alunoNode = xml.getElementsByTagName('wsAluno')[0];

      if (!alunoNode) throw new Error("Detalhes não encontrados.");

      const detalhes = {
        ...aluno,
        dataNascimento: alunoNode.getElementsByTagName('DataNascimento')[0]?.textContent || '--',
        cpf: alunoNode.getElementsByTagName('CPF')[0]?.textContent || '--',
        email: alunoNode.getElementsByTagName('Email')[0]?.textContent || '--',
        matricula: alunoNode.getElementsByTagName('NumeroMatricula')[0]?.textContent || alunoNode.getElementsByTagName('RA')[0]?.textContent || aluno.id,
        turma: (turmas.find(t => t.id === selectedTurmaId)?.nome) || 'Não informado',
        loading: false
      };

      setSelectedAlunoDetails(detalhes);

    } catch (err) {
      console.error(err);
      setSelectedAlunoDetails({ ...aluno, error: "Erro ao carregar detalhes.", loading: false });
    } finally {
      setLoadingDetails(false);
    }
  };

  // 4. Carregar Boletim do Aluno (On Demand)
  const fetchBoletimAluno = async (aluno) => {
    setLoadingBoletim(true);
    setSelectedBoletim({ aluno, loading: true, anos: {} });

    try {
      // Usa os anos encontrados na matricula (ou tenta padrão)
      const anosBusca = aluno.material?.anosAnteriores?.length > 0
        ? aluno.material.anosAnteriores
        : [];

      const resultadosPorAno = {};

      const parseExtrato = (xml) => {
        const disciplinas = Array.from(xml.getElementsByTagName('wsDisciplinasNotasParciais'));
        let extrato = [];
        disciplinas.forEach(discNode => {
          const nomeDisciplina = discNode.getElementsByTagName('NomeDisciplina')[0]?.textContent || 'Média/Geral';
          const periodos = Array.from(discNode.getElementsByTagName('wsNotasPeriodos'));
          periodos.forEach(perNode => {
            const nomePeriodo = perNode.getElementsByTagName('NomePeriodo')[0]?.textContent;
            const mediaPrevista = perNode.getElementsByTagName('MediaPrevista')[0]?.textContent;
            if (nomePeriodo && mediaPrevista) {
              const subNotas = [];
              Array.from(perNode.getElementsByTagName('wsNotaParcial')).forEach(np => {
                const nomeAvaliacao = np.getElementsByTagName('NomeAvaliacao')[0]?.textContent || '';
                const nota = np.getElementsByTagName('Nota')[0]?.textContent || '';
                if (nomeAvaliacao && nota) subNotas.push({ nome: nomeAvaliacao, nota });
              });
              const idUnico = `${nomeDisciplina}-${nomePeriodo}`;
              if (!extrato.some(e => e.id === idUnico)) {
                extrato.push({ id: idUnico, disciplina: nomeDisciplina, nome: nomePeriodo, notaFinal: mediaPrevista, subNotas, resultado: '-' });
              }
            }
          });
        });
        return extrato;
      };

      for (const item of anosBusca) {
        // item.turmaIds is now an array of all turmaIds for this year
        const turmaIds = item.turmaIds || (item.turmaIdPassada ? [item.turmaIdPassada] : []);
        if (turmaIds.length === 0) continue;

        let extratoAno = [];
        for (const turmaId of turmaIds) {
          const xml = await callSponteXhr('GetNotaParcial', `&nAlunoID=${aluno.id}&nTurmaID=${turmaId}&nCursoID=0&sParametrosBusca=`, true);
          if (xml) {
            const extratoTurma = parseExtrato(xml);
            // Merge disciplines from this turma; avoid duplicates
            extratoTurma.forEach(d => {
              if (!extratoAno.some(e => e.id === d.id)) extratoAno.push(d);
            });
          }
        }

        if (extratoAno.length > 0) {
          resultadosPorAno[item.ano] = extratoAno;
        }
      }

      const anosResult = Object.keys(resultadosPorAno).length > 0 ? resultadosPorAno : null;
      const anosEncontrados = anosBusca.map(i => i.ano); // all years searched
      setSelectedBoletim({
        aluno,
        loading: false,
        anos: anosResult,
        anosEncontrados // pass even when no grades, for better empty-state message
      });
      setSelectedPeriodo('Todos');
      if (anosResult) {
        setSelectedAnoBoletim(Object.keys(anosResult).sort((a, b) => b.localeCompare(a))[0]);
      } else {
        setSelectedAnoBoletim(null);
      }
      setSelectedDisciplinasExport(new Set());

    } catch (err) {
      console.error(err);
      setSelectedBoletim({ aluno, loading: false, error: "Erro ao buscar notas." });
    } finally {
      setLoadingBoletim(false);
    }
  };

  const alunosExibidos = viewMode === 'auditoria'
    ? (filtroCompradores ? alunos.filter(a => a.material.comprou) : alunos)
    : (filtroVeteranos ? alunos.filter(a => a.material?.anosAnteriores && a.material.anosAnteriores.length > 0) : alunos);

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-[#f3f4f6] text-slate-900'} p-4 md:p-8 font-sans antialiased selection:bg-orange-100 relative`}>

      {/* BOTÃO DE CONFIGURAÇÕES (TOP RIGHT) */}
      <div className="absolute top-4 right-4 md:top-8 md:right-8 z-40">
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`p-3 rounded-2xl transition-all shadow-sm flex items-center gap-2 group ${isSettingsOpen ? 'bg-orange-600 text-white shadow-orange-200' : 'bg-white text-slate-400 hover:text-orange-500 hover:shadow-md'}`}
        >
          <Settings size={20} className={isSettingsOpen ? 'animate-spin-slow' : 'group-hover:rotate-90 transition-transform duration-500'} />
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Configurações</span>
          {savedStudents.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-[#f3f4f6] animate-bounce">
              {savedStudents.length}
            </span>
          )}
        </button>

        {/* DROPDOWN DE CONFIGURAÇÕES */}
        {isSettingsOpen && (
          <div className="absolute right-0 mt-3 w-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/20 dark:border-slate-800/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50 transition-colors">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 flex items-center gap-2">
                <Settings size={12} /> Painel de Controle
              </h3>
            </div>

            <div className="p-2">
              <button
                onClick={() => { setIsSavedStudentsModalOpen(true); setIsSettingsOpen(false); }}
                className="w-full flex items-center justify-between p-4 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-[1.5rem] transition-all group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="font-black text-[11px] text-slate-700 dark:text-slate-200 uppercase tracking-tight">Alunos Salvos</p>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{savedStudents.length} Registro(s)</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 group-hover:bg-orange-200 dark:group-hover:bg-orange-900 group-hover:text-orange-600 transition-colors">
                  <ChevronDown size={16} className="-rotate-90" />
                </div>
              </button>

              {/* Toggle Dark Mode */}
              <div className="mt-2 p-1">
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-[1.5rem] transition-all group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/40' : 'bg-slate-100 text-slate-400 group-hover:bg-orange-100 group-hover:text-orange-600'}`}>
                      {isDarkMode ? <RefreshCw size={18} className="animate-spin-slow" /> : <Globe size={18} />}
                    </div>
                    <div>
                      <p className="font-black text-[11px] text-slate-700 dark:text-slate-200 uppercase tracking-tight">Modo {isDarkMode ? 'Escuro' : 'Claro'}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Tema Visual Atual</p>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 flex items-center ${isDarkMode ? 'bg-orange-600' : 'bg-slate-200'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>

              <div className="mt-1 px-2 py-4 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Versão 2.5 • Estável</span>
                </div>
              </div>
            </div>

            <div className={`p-4 text-center transition-colors ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100 border-t border-slate-200'}`}>
              <p className={`text-[8px] font-black uppercase tracking-[0.3em] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>ÍCONE COLÉGIO E CURSO</p>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CENTRAL DE ALUNOS SALVOS */}
      {isSavedStudentsModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsSavedStudentsModalOpen(false)}>
          <div className="bg-white dark:bg-slate-950 rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-white/10 dark:border-slate-800/50" onClick={e => e.stopPropagation()}>
            <div className={`p-8 text-white relative overflow-hidden flex-shrink-0 transition-all border-b ${isDarkMode ? 'bg-black border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-100'}`}>
              <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none transition-colors ${isDarkMode ? 'bg-orange-500/5' : 'bg-orange-500/10'}`}></div>
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/20">
                    <Users size={28} className="text-white" />
                  </div>
                  <div>
                    <h3 className={`font-black text-2xl uppercase tracking-tighter leading-none transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Alunos Ativos na Seleção</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] transition-colors">Gerenciamento de Exportação em Lote</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsSavedStudentsModalOpen(false)} className="p-3 bg-slate-200/50 dark:bg-white/10 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/20 transition-colors text-slate-400 dark:text-white">
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <div className="p-8 pb-4 flex-1 overflow-y-auto bg-slate-50/30 dark:bg-slate-900/20">
              {savedStudents.length === 0 ? (
                <div className="py-20 flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 opacity-50">
                    <Users size={32} className="text-slate-300 dark:text-slate-700" />
                  </div>
                  <p className="text-sm font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Nenhum aluno na lista de exportação</p>
                  <p className="text-[10px] text-slate-300 dark:text-slate-700 font-bold mt-2 uppercase">Adicione alunos clicando no ícone "+" nos resultados da pesquisa</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedStudents.map((student, idx) => (
                    <div key={idx} className="group flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-xl hover:shadow-orange-900/5 relative overflow-hidden">
                      <div className="flex items-center gap-3 min-w-0 pr-8 cursor-pointer relative z-10" onClick={() => { fetchGlobalDetalhes(student); setIsSavedStudentsModalOpen(false); }}>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-orange-100 dark:group-hover:bg-orange-900 group-hover:text-orange-600 dark:group-hover:text-orange-400 flex items-center justify-center font-black text-sm transition-colors">
                          {student.nome.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{student.nome}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 truncate max-w-[120px]">{student.unidadeNome}</span>
                            <span className={`w-1.5 h-1.5 rounded-full ${student.situacao === 'Ativo' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSavedStudents(prev => prev.filter(s => s.nome !== student.nome))}
                        className="p-2 text-slate-300 dark:text-slate-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all opacity-0 group-hover:opacity-100 absolute right-3 z-20"
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {savedStudents.length > 0 && (
              <div className="p-8 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 flex-shrink-0">
                <button
                  onClick={() => setSavedStudents([])}
                  className="flex-1 flex items-center justify-center gap-3 p-4 bg-slate-100 dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all border border-slate-200 dark:border-slate-800"
                >
                  <RefreshCw size={16} /> Limpar Seleção
                </button>
                <button
                  onClick={handleExportSavedStudents}
                  disabled={exportingSavedStudents}
                  className="flex-[2] flex items-center justify-center gap-3 p-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-orange-600/20 hover:shadow-orange-600/40 hover:-translate-y-0.5 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none translate-y-0"
                >
                  {exportingSavedStudents ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                  {exportingSavedStudents ? 'Processando Exportação...' : 'Gerar Planilha Consolidada'}
                </button>
              </div>
            )}

            {exportingSavedStudents && exportProgress && (
              <div className="px-8 pb-8 bg-white">
                <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-orange-600">
                    <span>Progresso: {exportProgress.studentName}</span>
                    <span>{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-orange-200/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all duration-300"
                      style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES GLOBAL (PESQUISA) */}
      {globalDetalhes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" onClick={() => { setGlobalDetalhes(null); setGlobalBoletim(null); }}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-slate-900 p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-green-500 flex items-center justify-center font-black text-lg text-white shadow-lg shadow-green-900/20">
                    {globalDetalhes.aluno.nome.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <div
                      className="cursor-pointer group/name relative inline-block self-start"
                      onClick={() => {
                        navigator.clipboard.writeText(globalDetalhes.aluno.nome);
                        setCopiedField('nome');
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                    >
                      <h3 className="font-black text-lg uppercase tracking-tight leading-tight group-hover/name:text-orange-500 transition-colors flex items-center gap-2">
                        {globalDetalhes.aluno.nome}
                        {copiedField === 'nome' && (
                          <span className="bg-orange-500 text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest animate-in fade-in zoom-in duration-200">
                            Copiado!
                          </span>
                        )}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Detalhes do Aluno</p>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest border ${globalDetalhes.aluno.situacao === 'Ativo' ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-red-500/20 border-red-500/50 text-red-400'}`}>
                        {globalDetalhes.aluno.situacao}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => { setGlobalDetalhes(null); setGlobalBoletim(null); }} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                    <XCircle size={20} className="text-white" />
                  </button>
                </div>
              </div>
              {/* Tabs: Dados | Notas */}
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setGlobalDetalhesTab('dados')}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${globalDetalhesTab === 'dados' ? 'bg-orange-500 text-white shadow-md' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
                >
                  Dados
                </button>
                <button
                  onClick={() => {
                    setGlobalDetalhesTab('notas');
                    if (!globalBoletim || globalBoletim.aluno.nome !== globalDetalhes.aluno.nome) {
                      fetchGlobalBoletim(globalDetalhes.aluno);
                    }
                  }}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${globalDetalhesTab === 'notas' ? 'bg-orange-500 text-white shadow-md' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
                >
                  <GraduationCap size={12} /> Notas
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 flex-1 overflow-y-auto">
              {globalDetalhesTab === 'dados' ? (
                globalDetalhes.loading ? (
                  <div className="py-12 flex flex-col items-center gap-4 text-slate-400">
                    <Loader2 size={32} className="animate-spin text-orange-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Buscando Informações...</p>
                  </div>
                ) : globalDetalhes.error ? (
                  <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-bold text-center">{globalDetalhes.error}</div>
                ) : globalDetalhes.data ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        className="p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-orange-200 transition-colors group/field"
                        onClick={() => {
                          navigator.clipboard.writeText(globalDetalhes.data.matricula || '');
                          setCopiedField('matricula');
                          setTimeout(() => setCopiedField(null), 2000);
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><User size={10} /> Matrícula</p>
                          {copiedField === 'matricula' && <CheckCircle size={11} className="text-green-500 animate-in zoom-in duration-200" />}
                        </div>
                        <p className="font-bold text-slate-700 text-sm group-hover/field:text-orange-600 transition-colors">{globalDetalhes.data.matricula || '--'}</p>
                      </div>

                      <div
                        className="p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-orange-200 transition-colors group/field"
                        onClick={() => {
                          navigator.clipboard.writeText(globalDetalhes.data.dataNascimento || '');
                          setCopiedField('nasc');
                          setTimeout(() => setCopiedField(null), 2000);
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar size={10} /> Nascimento</p>
                          {copiedField === 'nasc' && <CheckCircle size={11} className="text-green-500 animate-in zoom-in duration-200" />}
                        </div>
                        <p className="font-bold text-slate-700 text-sm group-hover/field:text-orange-600 transition-colors">{globalDetalhes.data.dataNascimento}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div
                        className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-orange-100 cursor-pointer transition-colors group"
                        onClick={() => {
                          navigator.clipboard.writeText(globalDetalhes.data.cpf || '');
                          setCopiedField('cpf');
                          setTimeout(() => setCopiedField(null), 2000);
                        }}
                      >
                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors"><User size={18} /></div>
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 flex items-center justify-between">
                            CPF
                            {copiedField === 'cpf' && <span className="text-green-500 text-[8px] animate-in fade-in slide-in-from-right-1 duration-200">COPIADO!</span>}
                          </p>
                          <p className="font-bold text-slate-700 font-mono text-sm group-hover:text-orange-600 transition-colors">{globalDetalhes.data.cpf}</p>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-blue-100 cursor-pointer transition-colors group"
                        onClick={() => {
                          navigator.clipboard.writeText(globalDetalhes.data.email || '');
                          setCopiedField('email');
                          setTimeout(() => setCopiedField(null), 2000);
                        }}
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors"><div className="scale-75"><User size={20} /></div></div>
                        <div className="overflow-hidden flex-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 flex items-center justify-between">
                            Email
                            {copiedField === 'email' && <span className="text-green-500 text-[8px] animate-in fade-in slide-in-from-right-1 duration-200">COPIADO!</span>}
                          </p>
                          <p className="font-bold text-slate-700 text-sm truncate group-hover:text-blue-600 transition-colors">{globalDetalhes.data.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500"><LayoutList size={18} /></div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Turma Atual</p>
                          <p className="font-bold text-slate-700 text-sm">{globalDetalhes.data.turma}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null
              ) : (
                /* Tab de Notas — reutiliza o globalBoletim já carregado */
                globalBoletim?.aluno?.nome === globalDetalhes?.aluno?.nome ? (
                  globalBoletim.loading ? (
                    <div className="py-16 flex flex-col items-center gap-4 text-slate-400">
                      <Loader2 size={36} className="animate-spin text-orange-500" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Buscando notas em todas as unidades...</p>
                    </div>
                  ) : Object.keys(globalBoletim.resultados).length === 0 ? (
                    <div className="py-16 flex flex-col items-center text-slate-400">
                      <BookCheck size={36} className="opacity-20 mb-3" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma nota encontrada</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Seletor de Ano */}
                      {(() => {
                        const todosAnosData = {};
                        Object.entries(globalBoletim.resultados).forEach(([uKey, uData]) => {
                          Object.keys(uData.anos).forEach(ano => {
                            if (!todosAnosData[ano]) todosAnosData[ano] = [];
                            todosAnosData[ano].push(uData.unidadeNome);
                          });
                        });
                        const todosAnos = Object.keys(todosAnosData).sort((a, b) => b.localeCompare(a));
                        return (
                          <div className="space-y-4 border-b border-slate-100 pb-4">
                            <div className="flex gap-2 flex-wrap">
                              {todosAnos.map(ano => (
                                <button key={ano} onClick={() => { setGlobalAnoBol(ano); setGlobalPeriodo('Todos'); }}
                                  className={`px-4 py-2 rounded-xl transition-all border text-left ${globalAnoBol === ano ? 'bg-orange-600 border-orange-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                                  <span className="font-black text-sm block leading-none">{ano}</span>
                                </button>
                              ))}
                            </div>

                            {/* Filtro de período */}
                            {globalAnoBol && (() => {
                              const todosPeriodos = new Set();
                              Object.values(globalBoletim.resultados).forEach(u => {
                                if (u.anos[globalAnoBol] && u.anos[globalAnoBol].disciplinas) {
                                  u.anos[globalAnoBol].disciplinas.forEach(d => todosPeriodos.add(d.nome));
                                }
                              });
                              const periodos = Array.from(todosPeriodos).sort();
                              return periodos.length > 0 ? (
                                <div className="flex gap-2 flex-wrap">
                                  <button onClick={() => setGlobalPeriodo('Todos')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${globalPeriodo === 'Todos' ? 'bg-orange-600 text-white shadow-md shadow-orange-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Todos</button>
                                  {periodos.map(p => (
                                    <button key={p} onClick={() => setGlobalPeriodo(p)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${globalPeriodo === p ? 'bg-orange-600 text-white shadow-md shadow-orange-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{p}</button>
                                  ))}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        );
                      })()}
                      {/* Disciplinas por unidade */}
                      {globalAnoBol && Object.entries(globalBoletim.resultados).map(([uKey, uData]) => {
                        if (!uData.anos[globalAnoBol]) return null;
                        const { disciplinas, nomeTurma, temNotas } = uData.anos[globalAnoBol];
                        const filtradas = disciplinas ? disciplinas.filter(d => globalPeriodo === 'Todos' || d.nome === globalPeriodo) : [];
                        return (
                          <div key={uKey} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="bg-orange-50 border-b border-orange-100 p-3 px-5 flex items-center justify-between">
                              <h4 className="font-black text-orange-900 uppercase tracking-widest text-xs flex items-center gap-2"><Building2 size={12} className="text-orange-500" />{uData.unidadeNome}</h4>
                              {nomeTurma && <span className="text-[9px] font-black uppercase tracking-widest text-orange-400 bg-orange-50 border border-orange-100 px-2 py-1 rounded-lg">{nomeTurma}</span>}
                            </div>
                            {!temNotas || filtradas.length === 0 ? (
                              <div className="p-8 text-center bg-white flex flex-col items-center">
                                <BookCheck size={24} className="text-slate-200 mb-2" />
                                <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Nenhuma nota lançada</p>
                              </div>
                            ) : (
                              <div className="divide-y divide-slate-100 bg-white">
                                {filtradas.map((d, i) => (
                                  <div key={i} className="p-3 px-5 flex items-center justify-between hover:bg-slate-50">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs font-bold text-slate-700 uppercase">
                                        {d.disciplina}
                                        <span className="font-normal ml-2 text-[9px] text-slate-400 tracking-widest">({d.nome})</span>
                                      </span>
                                      {d.subNotas && d.subNotas.length > 0 && (
                                        <div className="flex gap-1.5 flex-wrap">
                                          {d.subNotas.map((sn, idx) => (
                                            <span key={idx} className="bg-orange-50 text-orange-600 font-bold text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-widest border border-orange-100 flex items-center gap-1">
                                              {sn.nome}: <span className="text-orange-900">{sn.nota}</span>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <span className="font-black text-orange-600 w-14 text-center bg-orange-50 p-1.5 rounded-lg border border-orange-100 text-sm flex-shrink-0 self-start">{d.notaFinal}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="py-12 flex flex-col items-center gap-4 text-slate-400">
                    <Loader2 size={32} className="animate-spin text-orange-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Carregando notas...</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )
      }

      {/* MODAL GLOBAL DE BOLETIM POR PESQUISA */}
      {
        globalBoletim && !globalDetalhes && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" onClick={() => setGlobalBoletim(null)}>
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 p-6 text-white relative overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
                <div className="relative z-10 flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center font-black text-xl">
                      {globalBoletim.aluno.nome.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black text-lg uppercase tracking-tight leading-tight">{globalBoletim.aluno.nome}</h3>
                      <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
                        <Globe size={11} /> Histórico Global — Todas as Unidades
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setGlobalBoletim(null)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                    <XCircle size={20} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto flex-1">
                {globalBoletim.loading ? (
                  <div className="py-16 flex flex-col items-center gap-4 text-slate-400">
                    <Loader2 size={36} className="animate-spin text-indigo-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Buscando notas em todas as unidades...</p>
                    <p className="text-[9px] text-slate-400">Isso pode demorar alguns segundos</p>
                  </div>
                ) : Object.keys(globalBoletim.resultados).length === 0 ? (
                  <div className="py-16 flex flex-col items-center text-slate-400">
                    <BookCheck size={36} className="opacity-20 mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma nota encontrada em nenhuma unidade</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Seletor de Ano — todos os anos de todas as unidades */}
                    {(() => {
                      const todosAnosData = {};
                      Object.entries(globalBoletim.resultados).forEach(([uKey, uData]) => {
                        Object.keys(uData.anos).forEach(ano => {
                          if (!todosAnosData[ano]) todosAnosData[ano] = [];
                          todosAnosData[ano].push(uData.unidadeNome.replace('UNIDADE ', 'U').replace(' - ÍCONE', '').trim());
                        });
                      });

                      const todosAnos = Object.keys(todosAnosData).sort((a, b) => b.localeCompare(a));

                      return (
                        <div className="flex gap-2 flex-wrap border-b border-slate-100 pb-4">
                          {todosAnos.map(ano => (
                            <button
                              key={ano}
                              onClick={() => { setGlobalAnoBol(ano); setGlobalPeriodo('Todos'); }}
                              className={`px-5 py-2 rounded-xl transition-all border text-left ${globalAnoBol === ano ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                            >
                              <span className="font-black text-sm block leading-none mb-1">{ano}</span>
                              <span className={`text-[8px] font-bold uppercase tracking-widest block ${globalAnoBol === ano ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {todosAnosData[ano].join(', ')}
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Filtro de período */}
                    {globalAnoBol && (() => {
                      const todosPeriodos = new Set();
                      Object.values(globalBoletim.resultados).forEach(u => {
                        if (u.anos[globalAnoBol] && u.anos[globalAnoBol].disciplinas) {
                          u.anos[globalAnoBol].disciplinas.forEach(d => todosPeriodos.add(d.nome));
                        }
                      });
                      const periodos = Array.from(todosPeriodos).sort();
                      return periodos.length > 0 ? (
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => setGlobalPeriodo('Todos')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${globalPeriodo === 'Todos' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Todos</button>
                          {periodos.map(p => (
                            <button key={p} onClick={() => setGlobalPeriodo(p)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${globalPeriodo === p ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{p}</button>
                          ))}
                        </div>
                      ) : null;
                    })()}

                    {/* Resultados por unidade */}
                    {globalAnoBol && Object.entries(globalBoletim.resultados).map(([uKey, uData]) => {
                      if (!uData.anos[globalAnoBol]) return null;
                      const { disciplinas, nomeTurma, temNotas } = uData.anos[globalAnoBol];
                      const filtradas = disciplinas ? disciplinas.filter(d => globalPeriodo === 'Todos' || d.nome === globalPeriodo) : [];

                      return (
                        <div key={uKey} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                          <div className="bg-gradient-to-r from-indigo-50 to-slate-50 border-b border-slate-200 p-3 px-5 flex items-center justify-between">
                            <h4 className="font-black text-indigo-900 uppercase tracking-widest text-xs flex items-center gap-2">
                              <Building2 size={12} className="text-indigo-500" /> {uData.unidadeNome}
                            </h4>
                            {nomeTurma && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
                                {nomeTurma}
                              </span>
                            )}
                          </div>

                          {!temNotas || filtradas.length === 0 ? (
                            <div className="p-8 text-center bg-white flex flex-col items-center">
                              <BookCheck size={24} className="text-slate-200 mb-2" />
                              <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Nenhuma nota lançada neste período</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100 bg-white">
                              {filtradas.map((d, i) => (
                                <div key={i} className="p-3 px-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                  <span className="text-xs font-bold text-slate-700 uppercase">
                                    {d.disciplina}
                                    <span className="font-normal ml-2 text-[9px] text-slate-400 tracking-widest">({d.nome})</span>
                                  </span>
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="font-black text-indigo-600 w-14 text-center bg-indigo-50 p-1.5 rounded-lg border border-indigo-100 text-sm">{d.notaFinal}</span>
                                    {d.subNotas && d.subNotas.length > 0 && (
                                      <div className="flex gap-1.5 flex-wrap justify-end">
                                        {d.subNotas.map((sn, idx) => (
                                          <span key={idx} className="bg-slate-100 text-slate-500 font-bold text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-widest border border-slate-200">
                                            {sn.nome}: <span className="text-slate-700">{sn.nota}</span>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL DE DETALHES */}
      {
        selectedAlunoDetails && (

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedAlunoDetails(null)}>
            <div className="bg-white dark:bg-slate-950 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10 dark:border-slate-800/50" onClick={e => e.stopPropagation()}>
              <div className={`p-6 relative overflow-hidden transition-all border-b ${isDarkMode ? 'bg-black text-white border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-100'}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                <div className="relative z-10 flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-all ${selectedAlunoDetails.material?.comprou ? 'bg-green-500 text-white shadow-lg shadow-green-900/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700'}`}>
                      {selectedAlunoDetails.nome.charAt(0)}
                    </div>
                    <div
                      className="cursor-pointer group/name relative"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedAlunoDetails.nome);
                        setCopiedField('nome_details');
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                    >
                      <h3 className="font-black text-lg uppercase tracking-tight leading-tight group-hover/name:text-orange-500 transition-colors flex items-center gap-2">
                        {selectedAlunoDetails.nome}
                        {copiedField === 'nome_details' && (
                          <span className="bg-orange-500 text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest animate-in fade-in zoom-in duration-200">
                            Copiado!
                          </span>
                        )}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-500 text-xs font-bold uppercase tracking-widest mt-1 transition-colors">
                        Detalhes do Aluno • Clique para copiar
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedAlunoDetails(null)} className="p-2 bg-slate-200/50 dark:bg-white/10 rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-colors">
                    <XCircle size={20} className="text-slate-400 dark:text-white" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {selectedAlunoDetails.loading ? (
                  <div className="py-12 flex flex-col items-center gap-4 text-slate-400">
                    <Loader2 size={32} className="animate-spin text-orange-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Buscando Informações...</p>
                  </div>
                ) : selectedAlunoDetails.error ? (
                  <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-bold text-center">
                    {selectedAlunoDetails.error}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all cursor-pointer hover:border-orange-200 dark:hover:border-orange-800 group/field"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedAlunoDetails.matricula || '');
                          setCopiedField('matricula_details');
                          setTimeout(() => setCopiedField(null), 2000);
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><User size={10} /> Matrícula</p>
                          {copiedField === 'matricula_details' && <CheckCircle size={11} className="text-green-500 animate-in zoom-in duration-200" />}
                        </div>
                        <p className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover/field:text-orange-600 transition-colors">{selectedAlunoDetails.matricula}</p>
                      </div>
                      <div
                        className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all cursor-pointer hover:border-orange-200 dark:hover:border-orange-800 group/field"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedAlunoDetails.dataNascimento || '');
                          setCopiedField('nasc_details');
                          setTimeout(() => setCopiedField(null), 2000);
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Calendar size={10} /> Nascimento</p>
                          {copiedField === 'nasc_details' && <CheckCircle size={11} className="text-green-500 animate-in zoom-in duration-200" />}
                        </div>
                        <p className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover/field:text-orange-600 transition-colors">{selectedAlunoDetails.dataNascimento}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div
                        className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-orange-100 dark:hover:border-orange-900 transition-colors group cursor-pointer"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedAlunoDetails.cpf || '');
                          setCopiedField('cpf_details');
                          setTimeout(() => setCopiedField(null), 2000);
                        }}
                      >
                        <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-500 dark:text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                          <User size={18} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 flex items-center justify-between">
                            CPF
                            {copiedField === 'cpf_details' && <span className="text-green-500 text-[8px] animate-in fade-in slide-in-from-right-1 duration-200">COPIADO!</span>}
                          </p>
                          <p className="font-bold text-slate-700 dark:text-slate-200 font-mono text-sm group-hover:text-orange-600 transition-colors">{selectedAlunoDetails.cpf}</p>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-100 dark:hover:border-blue-900 transition-colors group cursor-pointer"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedAlunoDetails.email || '');
                          setCopiedField('email_details');
                          setTimeout(() => setCopiedField(null), 2000);
                        }}
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                          <div className="scale-75"><User size={20} /></div>
                        </div>
                        <div className="overflow-hidden flex-1">
                          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 flex items-center justify-between">
                            Email
                            {copiedField === 'email_details' && <span className="text-green-500 text-[8px] animate-in fade-in slide-in-from-right-1 duration-200">COPIADO!</span>}
                          </p>
                          <p className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate w-full group-hover:text-blue-600 transition-colors">{selectedAlunoDetails.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                          <LayoutList size={18} />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Turma Atual</p>
                          <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{selectedAlunoDetails.turma}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL DE BOLETIM */}
      {
        selectedBoletim && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedBoletim(null)}>
            <div className="bg-white dark:bg-slate-950 rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10 dark:border-slate-800/50" onClick={e => e.stopPropagation()}>
              <div className={`p-6 relative overflow-hidden transition-all border-b ${isDarkMode ? 'bg-black text-white border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-100'}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                <div className="relative z-10 flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 dark:shadow-indigo-900/20">
                      {selectedBoletim.aluno.nome.charAt(0)}
                    </div>
                    <div
                      className="cursor-pointer group/name relative"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedBoletim.aluno.nome);
                        const el = document.getElementById('copy-feedback-boletim');
                        if (el) {
                          el.style.opacity = '1';
                          setTimeout(() => el.style.opacity = '0', 2000);
                        }
                      }}
                    >
                      <h3 className="font-black text-lg uppercase tracking-tight leading-tight group-hover/name:text-indigo-500 transition-colors flex items-center gap-2">
                        {selectedBoletim.aluno.nome}
                        <span id="copy-feedback-boletim" className="opacity-0 transition-opacity bg-indigo-500 text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest">Copiado!</span>
                      </h3>
                      <p className="text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mt-1">Histórico de Notas • Clique no nome para copiar</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedBoletim(null)} className="p-2 bg-slate-200/50 dark:bg-white/10 rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-colors">
                    <XCircle size={20} className="text-slate-400 dark:text-white" />
                  </button>
                </div>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {selectedBoletim.loading ? (
                  <div className="py-12 flex flex-col items-center gap-4 text-slate-400 dark:text-slate-600">
                    <Loader2 size={32} className="animate-spin text-indigo-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Buscando Notas...</p>
                  </div>
                ) : selectedBoletim.error ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold text-center border border-red-100 dark:border-red-900/20">
                    {selectedBoletim.error}
                  </div>
                ) : !selectedBoletim.anos ? (
                  <div className="py-12 flex flex-col items-center text-slate-400 dark:text-slate-600 px-6">
                    <BookCheck size={32} className="opacity-20 mb-3" />
                    {selectedBoletim.anosEncontrados?.length > 0 ? (
                      <>
                        <p className="text-[10px] font-black uppercase tracking-widest text-center">
                          Matrículas anteriores encontradas, mas sem notas no sistema
                        </p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 text-center">
                          Anos consultados: {selectedBoletim.anosEncontrados.join(', ')}
                        </p>
                        <p className="text-[9px] text-orange-400 dark:text-orange-500 mt-1 text-center font-bold uppercase tracking-widest">
                          As notas não foram lançadas no Sponte para esses períodos
                        </p>
                      </>
                    ) : (
                      <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma matrícula anterior encontrada</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      const anosOrdenados = Object.keys(selectedBoletim.anos).sort((a, b) => b.localeCompare(a));
                      return (
                        <div className="flex gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
                          {anosOrdenados.map(ano => (
                            <button
                              key={ano}
                              onClick={() => {
                                setSelectedAnoBoletim(ano);
                                setSelectedPeriodo('Todos');
                                setSelectedDisciplinasExport(new Set());
                              }}
                              className={`px-5 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-widest transition-all ${selectedAnoBoletim === ano ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                            >
                              Ano {ano}
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {selectedAnoBoletim && selectedBoletim.anos[selectedAnoBoletim] && (() => {
                      const disciplinasAno = selectedBoletim.anos[selectedAnoBoletim];
                      const todosPeriodos = new Set();
                      disciplinasAno.forEach(d => todosPeriodos.add(d.nome));
                      const periodosOrdenados = Array.from(todosPeriodos).sort();

                      return (
                        <div className="flex gap-2 mb-2 flex-wrap">
                          <button
                            onClick={() => setSelectedPeriodo('Todos')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${selectedPeriodo === 'Todos' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                          >
                            <LayoutGrid size={12} /> Todos os Períodos
                          </button>
                          {periodosOrdenados.map(p => (
                            <button
                              key={p}
                              onClick={() => setSelectedPeriodo(p)}
                              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedPeriodo === p ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {selectedAnoBoletim && selectedBoletim.anos[selectedAnoBoletim] && (
                      <>
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                          <button
                            onClick={() => {
                              const allVisibleIds = new Set();
                              selectedBoletim.anos[selectedAnoBoletim].forEach(d => {
                                if (selectedPeriodo === 'Todos' || d.nome === selectedPeriodo) {
                                  allVisibleIds.add(d.id);
                                }
                              });

                              let allSelected = true;
                              for (let id of allVisibleIds) {
                                if (!selectedDisciplinasExport.has(id)) {
                                  allSelected = false;
                                  break;
                                }
                              }

                              if (allSelected && allVisibleIds.size > 0) {
                                setSelectedDisciplinasExport(new Set());
                              } else {
                                setSelectedDisciplinasExport(allVisibleIds);
                              }
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1.5 transition-colors px-2 py-1"
                          >
                            <CheckCircle size={14} /> Selecionar Visíveis
                          </button>

                          <button
                            onClick={() => {
                              if (!selectedBoletim || !selectedBoletim.anos || selectedDisciplinasExport.size === 0) return;

                              const dataToExport = [];
                              selectedBoletim.anos[selectedAnoBoletim].forEach(d => {
                                if (selectedDisciplinasExport.has(d.id)) {
                                  const row = {
                                    'Ano Letivo': selectedAnoBoletim,
                                    'Período': d.nome,
                                    'Disciplina': d.disciplina,
                                    'Média Final': d.notaFinal,
                                  };

                                  if (d.subNotas) {
                                    d.subNotas.forEach(sn => {
                                      row[`Nota Parcial - ${sn.nome}`] = sn.nota;
                                    });
                                  }
                                  dataToExport.push(row);
                                }
                              });

                              const ws = XLSX.utils.json_to_sheet(dataToExport);
                              const wb = XLSX.utils.book_new();
                              XLSX.utils.book_append_sheet(wb, ws, `Notas ${selectedAnoBoletim}`);
                              XLSX.writeFile(wb, `Boletim_${selectedAnoBoletim}_${selectedBoletim.aluno.nome.replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`);
                            }}
                            disabled={selectedDisciplinasExport.size === 0}
                            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${selectedDisciplinasExport.size > 0 ? 'bg-green-600 text-white shadow-md shadow-green-600/20 hover:bg-green-500 hover:-translate-y-0.5' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'}`}
                          >
                            <FileSpreadsheet size={15} /> Baixar {selectedDisciplinasExport.size} Selecionadas
                          </button>
                        </div>

                        {(() => {
                          const disciplinasFiltradas = selectedBoletim.anos[selectedAnoBoletim].filter(d => selectedPeriodo === 'Todos' || d.nome === selectedPeriodo);
                          if (disciplinasFiltradas.length === 0) return null;

                          return (
                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors">
                              <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 p-3 px-5">
                                <h4 className="font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest text-xs flex items-center gap-2">
                                  <Calendar size={14} className="text-indigo-500 dark:text-indigo-400" /> Ano Letivo {selectedAnoBoletim}
                                </h4>
                              </div>
                              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {disciplinasFiltradas.map((d, i) => (
                                  <div key={i} className={`p-3 px-5 flex items-center justify-between transition-colors border-l-2 ${selectedDisciplinasExport.has(d.id) ? 'bg-indigo-50/20 dark:bg-indigo-900/10 border-indigo-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent'}`}>
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => {
                                          setSelectedDisciplinasExport(prev => {
                                            const next = new Set(prev);
                                            if (next.has(d.id)) next.delete(d.id);
                                            else next.add(d.id);
                                            return next;
                                          });
                                        }}
                                        className={`w-5 h-5 rounded flex items-center justify-center border transition-all flex-shrink-0 ${selectedDisciplinasExport.has(d.id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-slate-800 cursor-pointer'}`}
                                      >
                                        {selectedDisciplinasExport.has(d.id) && <CheckCircle size={14} className="stroke-[3px]" />}
                                      </button>
                                      <span className={`text-xs font-bold uppercase transition-colors ${selectedDisciplinasExport.has(d.id) ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {d.disciplina} <span className={`font-normal ml-2 tracking-widest text-[9px] ${selectedDisciplinasExport.has(d.id) ? 'text-indigo-400/80' : 'text-slate-400 dark:text-slate-500'}`}>({d.nome})</span>
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1 items-end">
                                      <div className="flex items-center gap-4">
                                        <span className="font-black text-indigo-600 dark:text-indigo-400 w-16 text-center bg-indigo-50/50 dark:bg-indigo-900/20 p-1.5 rounded-lg border border-indigo-100/50 dark:border-indigo-800/50" title="Média do Período">
                                          {d.notaFinal}
                                        </span>
                                      </div>
                                      {d.subNotas && d.subNotas.length > 0 && (
                                        <div className="flex gap-1.5 justify-end mt-1 flex-wrap">
                                          {d.subNotas.map((sn, idx) => (
                                            <span key={idx} className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                                              {sn.nome}: <span className="text-slate-700 dark:text-slate-300">{sn.nota}</span>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      <div className="max-w-[1400px] mx-auto space-y-8 w-full min-w-0">
        {/* TABS DE NAVEGAÇÃO */}
        <div className={`flex backdrop-blur border p-1.5 rounded-2xl w-fit mx-auto shadow-sm transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-200/50 border-slate-300'}`}>
          <button
            onClick={() => { setViewMode('auditoria'); setTurmas([]); setSelectedTurmaId(null); setAlunos([]); }}
            className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'auditoria' ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20' : 'text-slate-600 dark:text-slate-400 hover:text-orange-600 hover:bg-white dark:hover:bg-slate-800'}`}
          >
            <BookCheck size={16} /> Auditoria Material
          </button>
          <button
            onClick={() => { setViewMode('notas'); setTurmas([]); setSelectedTurmaId(null); setAlunos([]); }}
            className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'notas' ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20' : 'text-slate-600 dark:text-slate-400 hover:text-orange-600 hover:bg-white dark:hover:bg-slate-800'}`}
          >
            <GraduationCap size={16} /> Consulta de Dados
          </button>
        </div>

        {viewMode === 'welcome' && (
          <div className={`rounded-[2rem] shadow-sm border p-12 text-center flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in zoom-in-95 duration-500 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`w-32 h-32 ${isDarkMode ? 'bg-white/5' : 'bg-orange-50'} rounded-full flex items-center justify-center mb-8 transition-colors`}>
              <img
                src="https://iconecolegioecurso.com.br/wp-content/uploads/2022/08/xlogo_icone_site.png.pagespeed.ic_.QgXP3GszLC.webp"
                alt="Logo Ícone"
                className="w-20 h-20 object-contain"
              />
            </div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-4 text-center">Bem-vindo ao Sistema</h1>
            <p className="text-slate-500 dark:text-slate-400 max-w-md font-medium text-sm text-center">
              Selecione uma das guias acima para iniciar.
            </p>
          </div>
        )}

        {viewMode !== 'welcome' && (
          <>
            <div className={`rounded-[2rem] shadow-xl relative overflow-hidden group animate-in fade-in duration-300 border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 shadow-slate-950/50' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
              {/* Efeito Glass decorativo */}
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-50/20 dark:bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none transition-colors duration-700 group-hover:bg-orange-500/10"></div>

              <div className="p-8 md:p-12 text-slate-900 dark:text-white relative z-10 transition-colors">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                  <div className="flex items-center gap-6">
                    <div className={`p-5 rounded-2xl backdrop-blur-md border shadow-inner transition-all ${isDarkMode ? 'bg-white/10 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                      {viewMode === 'auditoria' ? <BookCheck size={40} className="text-orange-500 dark:text-orange-400" /> : <GraduationCap size={40} className="text-orange-500 dark:text-orange-400" />}
                    </div>
                    <div>
                      <h1 className="text-3xl font-black uppercase tracking-tight leading-none mb-2">
                        {viewMode === 'auditoria' ? 'Auditoria Material 2026' : 'Consulta de dados'}
                      </h1>
                      <div className="flex items-center gap-2">

                      </div>
                    </div>
                  </div>

                  {viewMode === 'auditoria' && (
                    <div className={`p-1.5 pl-5 rounded-2xl flex flex-col gap-1 backdrop-blur-sm border min-w-[300px] shadow-sm transition-all ${isDarkMode ? 'bg-slate-950/50 border-white/10 shadow-slate-950' : 'bg-slate-100 border-slate-200'}`}>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mt-2 transition-colors">
                        <Building2 size={10} /> Unidade Selecionada
                      </label>
                      <div className="relative group/select">
                        <select
                          className="w-full bg-transparent text-slate-900 dark:text-white font-bold text-sm uppercase appearance-none outline-none py-3 pr-8 cursor-pointer group-hover/select:text-orange-600 dark:group-hover/select:text-orange-400 transition-colors"
                          value={selectedUnidade}
                          onChange={(e) => {
                            setSelectedUnidade(e.target.value);
                            setTurmas([]);
                            setSelectedTurmaId(null);
                            setAlunos([]);
                          }}
                        >
                          {Object.entries(UNIDADES_CONFIG).map(([key, config]) => (
                            <option key={key} value={key} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{config.nome}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500 group-hover/select:text-orange-600 dark:group-hover/select:text-orange-500 transition-colors" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {viewMode === 'auditoria' && (
                <div className="bg-slate-50/50 dark:bg-slate-950 py-4 px-8 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4 border-t border-slate-100 dark:border-slate-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)] animate-pulse"></div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500 text-center transition-colors">Sistema Conectado e Pronto</span>
                  </div>
                  <button
                    onClick={fetchTurmas}
                    disabled={loadingTurmas}
                    className="w-full md:w-auto text-white px-8 py-4 rounded-xl font-black transition-all flex items-center justify-center gap-3 shadow-lg hover:-translate-y-0.5 active:translate-y-0 uppercase text-[11px] tracking-widest disabled:opacity-50 disabled:pointer-events-none bg-orange-600 hover:bg-orange-500 shadow-orange-600/20 hover:shadow-orange-600/40"
                  >
                    {loadingTurmas ? <Loader2 className="animate-spin" size={16} /> : <><Play size={16} fill="currentColor" /> Carregar Turmas 2026</>}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-600 p-6 rounded-2xl flex items-center gap-4 shadow-sm animate-in slide-in-from-top-4">
                <AlertCircle className="shrink-0" size={24} />
                <p className="font-bold text-sm">{error}</p>
              </div>
            )}

            {/* BARRA DE PESQUISA GLOBAL — Notas Mode */}
            {viewMode === 'notas' && (
              <div className="relative">
                <div className={`rounded-2xl shadow-sm border p-1 flex items-center gap-3 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center gap-3 flex-1 px-4 py-3">
                    {globalSearchLoading
                      ? <Loader2 size={18} className="text-orange-400 animate-spin flex-shrink-0" />
                      : <Globe size={18} className="text-orange-400 flex-shrink-0" />
                    }
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Informe o nome do aluno"
                      value={globalSearch}
                      onChange={e => {
                        const val = e.target.value;
                        setGlobalSearch(val);
                        setGlobalSearchOpen(true);
                        clearTimeout(searchDebounceRef.current);
                        searchDebounceRef.current = setTimeout(() => runGlobalSearch(val), 400);
                      }}
                      onFocus={() => { if (globalSearchResults.length > 0) setGlobalSearchOpen(true); }}
                      className="flex-1 bg-transparent text-slate-800 dark:text-slate-100 font-bold text-sm placeholder:text-slate-500 dark:placeholder:text-slate-600 outline-none"
                    />
                    {globalSearch && (
                      <button onClick={() => { setGlobalSearch(''); setGlobalSearchResults([]); setGlobalSearchOpen(false); setGlobalBoletim(null); }} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
                  <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex-shrink-0">
                    {globalSearchResults.length > 0 ? `${globalSearchResults.length} resultado${globalSearchResults.length !== 1 ? 's' : ''}` : 'Pesquisa Global'}
                  </div>
                </div>

                {/* Dropdown de autocompletamento */}
                {globalSearchOpen && globalSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-40 overflow-hidden max-h-72 overflow-y-auto transition-colors">
                    {globalSearchResults.map((result) => (
                      <div
                        key={`${result.unidadeKey}-${result.id}`}
                        className="w-full text-left px-4 sm:px-5 py-3.5 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-0 group"
                      >
                        <button onClick={() => fetchGlobalDetalhes(result)} className="flex-1 flex items-center gap-3 text-left overflow-hidden">
                          <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-sm flex-shrink-0">
                            {result.nome.charAt(0)}
                          </div>
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <p className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 truncate transition-colors">{result.nome}</p>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest border flex-shrink-0 ${result.situacao === 'Ativo' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'}`}>
                                {result.situacao}
                              </span>
                              {result.turmaNome && (
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex-shrink-0">
                                  {result.turmaNome}
                                </span>
                              )}
                            </div>
                            {result.unidades && result.unidades.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {result.unidades.map(u => (
                                  <span key={u.unidadeKey} className="text-[9px] font-black uppercase tracking-widest text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded border border-orange-100 dark:border-orange-800 whitespace-nowrap truncate max-w-full">{u.unidadeNome}</span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[9px] font-black uppercase tracking-widest text-orange-400 mt-0.5 truncate">{result.unidadeNome}</p>
                            )}
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-100 dark:border-slate-800 ml-1">
                          <button onClick={() => fetchGlobalDetalhes(result)} className="hidden sm:block text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600 group-hover:text-orange-400 transition-colors px-2 py-1.5 bg-slate-100 dark:bg-slate-800 group-hover:bg-orange-100 dark:group-hover:bg-orange-950/50 rounded-lg whitespace-nowrap">
                            Ver Dados
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (savedStudents.find(s => s.nome === result.nome)) {
                                setSavedStudents(prev => prev.filter(s => s.nome !== result.nome));
                              } else {
                                setSavedStudents(prev => [...prev, result]);
                              }
                            }}
                            className={`${savedStudents.find(s => s.nome === result.nome) ? 'text-green-500 bg-green-50 dark:bg-green-950/30 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500' : 'text-slate-400 dark:text-slate-600 hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-green-500'} p-2 rounded-xl transition-all shadow-sm flex-shrink-0 group/action`}
                            title={savedStudents.find(s => s.nome === result.nome) ? "Remover dos Alunos Salvos" : "Salvar Aluno para Exportar"}
                          >
                            {savedStudents.find(s => s.nome === result.nome)
                              ? <><CheckCircle size={18} strokeWidth={2.5} className="group-hover/action:hidden" /><XCircle size={18} strokeWidth={2.5} className="hidden group-hover/action:block" /></>
                              : <Plus size={18} strokeWidth={2.5} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dropdown vazio (sem resultados) */}
                {globalSearchOpen && !globalSearchLoading && globalSearch.trim().length >= 3 && globalSearchResults.length === 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 z-40 px-5 py-6 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nenhum aluno encontrado com esse nome</p>
                  </div>
                )}
              </div>
            )}


            {/* Lista de Turmas */}
            <div className="space-y-4 pb-20">
              {turmas.map((turma) => (
                <div key={turma.id} className={`bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border transition-all duration-300 overflow-hidden ${selectedTurmaId === turma.id ? 'ring-2 ring-orange-500 border-transparent shadow-xl shadow-orange-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-md dark:hover:shadow-orange-900/5'}`}>
                  <div
                    onClick={() => fetchAlunosEMateriais(turma.id)}
                    className="w-full cursor-pointer text-left p-6 md:p-8 flex items-center justify-between group transition-colors"
                  >
                    <div className="flex items-center gap-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${selectedTurmaId === turma.id ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/30 group-hover:text-orange-500'}`}>
                        <LayoutList size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight text-xl transition-colors group-hover:text-orange-600">
                          {turma.nome} <span className="text-slate-300 dark:text-slate-700 font-medium ml-2">- 2026</span>
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 transition-colors group-hover:border-orange-200 dark:group-hover:border-orange-900 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20 group-hover:text-orange-600 dark:group-hover:text-orange-400">
                            {turma.sigla}
                          </span>
                          <span className="text-[10px] font-black text-white px-2.5 py-1 rounded-md uppercase tracking-widest shadow-sm bg-orange-500 shadow-orange-900/20">
                            {turma.vagasOcupadas} Alunos
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => handleDownloadReport(turma, e)}
                        disabled={downloadingTurmaId === turma.id}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border ${downloadingTurmaId === turma.id ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 animate-pulse cursor-wait' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-green-300 dark:hover:border-green-800 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 hover:shadow-sm'}`}
                        title="Baixar Planilha da Turma"
                      >
                        {downloadingTurmaId === turma.id ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                      </button>

                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${selectedTurmaId === turma.id ? 'bg-orange-100/50 dark:bg-orange-900/20 rotate-180' : 'bg-slate-50 dark:bg-slate-800 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/30'}`}>
                        <ChevronDown className={`transition-colors ${selectedTurmaId === turma.id ? 'text-orange-600' : 'text-slate-400 group-hover:text-orange-500'}`} />
                      </div>
                    </div>
                  </div>

                  {selectedTurmaId === turma.id && (
                    <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 animate-in slide-in-from-top-2 duration-300 transition-colors">

                      {/* Barra de Progresso da Turma */}
                      {loadingAlunos && (
                        <div className="p-8 pb-0">
                          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-orange-100 dark:border-orange-900/30 shadow-sm flex items-center gap-5 transition-colors">
                            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl relative">
                              <Loader2 className="animate-spin text-orange-500" size={24} />
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                <span className="text-orange-600 dark:text-orange-400">{viewMode === 'notas' ? 'Buscando Histórico de Notas' : 'Cruzando Dados Financeiros'}</span>
                                <span>{Math.round((progressAluno.current / Math.max(progressAluno.total, 1)) * 100)}%</span>
                              </div>
                              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                                  style={{ width: `${(progressAluno.current / Math.max(progressAluno.total, 1)) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="p-8">
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Users size={14} /> Lista de Alunos
                          </h4>
                          <button
                            onClick={() => viewMode === 'auditoria' ? setFiltroCompradores(!filtroCompradores) : setFiltroVeteranos(!filtroVeteranos)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${(viewMode === 'auditoria' && filtroCompradores) || (viewMode === 'notas' && filtroVeteranos)
                              ? 'bg-slate-800 dark:bg-orange-600 text-white shadow-slate-800/20 dark:shadow-orange-900/40 ring-2 ring-slate-800 dark:ring-orange-600 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-200 dark:hover:border-orange-900'
                              }`}
                          >
                            <Filter size={12} />
                            {viewMode === 'auditoria'
                              ? (filtroCompradores ? 'Mostrando: Apenas Compradores' : 'Filtrar Compradores')
                              : (filtroVeteranos ? 'Mostrando: Apenas Veteranos' : 'Filtrar Veteranos')}
                          </button>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                          {alunosExibidos.length > 0 ? (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {alunosExibidos.map((aluno) => (
                                <div key={aluno.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                  <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-sm transition-colors ${aluno.material.comprou
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 shadow-green-100 dark:shadow-none'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:shadow-sm group-hover:text-slate-500 dark:group-hover:text-slate-300'
                                      }`}>
                                      {aluno.nome.charAt(0)}
                                    </div>
                                    <div>
                                      <p className={`font-bold text-sm uppercase tracking-tight ${aluno.material.comprou ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>{aluno.nome}</p>
                                      <p className="font-mono text-[10px] text-slate-400 dark:text-slate-600">ID: <span className="font-bold">{aluno.id}</span></p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-6">
                                    {/* Info Secundária */}
                                    {viewMode === 'auditoria' ? (
                                      <>
                                        {/* Status Material */}
                                        {aluno.material.loading ? (
                                          <div className="w-24 h-6 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                                        ) : (
                                          <div className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest border flex items-center gap-1.5 min-w-[140px] justify-center transition-colors ${aluno.material.comprou
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600'
                                            }`}>
                                            {aluno.material.comprou ? (
                                              <><BookCheck size={12} /> {aluno.material.det.substring(0, 15)}...</>
                                            ) : (
                                              <><XCircle size={12} /> Não Identificado</>
                                            )}
                                          </div>
                                        )}

                                        {/* Status Pagamento */}
                                        <div className="w-28 text-right">
                                          {aluno.material.loading ? (
                                            <div className="w-16 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto" />
                                          ) : aluno.material.comprou ? (
                                            aluno.material.pago ? (
                                              <div className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400 font-black text-[10px] uppercase tracking-widest bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full ring-1 ring-inset ring-green-600/20 dark:ring-green-400/20 transition-colors">
                                                <CheckCircle size={12} /> Pago
                                              </div>
                                            ) : (
                                              <div className="inline-flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-black text-[10px] uppercase tracking-widest bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-full ring-1 ring-inset ring-orange-600/20 dark:ring-orange-400/20 animate-pulse transition-colors">
                                                <DollarSign size={12} /> Pendente
                                              </div>
                                            )
                                          ) : (
                                            <span className="text-slate-200 dark:text-slate-800 font-bold text-xl">-</span>
                                          )}
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        {/* Status Veterano */}
                                        {aluno.material.loading ? (
                                          <div className="w-24 h-6 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                                        ) : aluno.material.anosAnteriores?.length > 0 ? (
                                          <div className="px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest border bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 min-w-[140px] justify-center transition-colors">
                                            <GraduationCap size={12} /> Veterano ({aluno.material.anosAnteriores.map(a => a.ano).join(', ')})
                                          </div>
                                        ) : (
                                          <div className="px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest border bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600 flex items-center gap-1.5 min-w-[140px] justify-center transition-colors">
                                            <User size={12} /> Novato (Só 2026)
                                          </div>
                                        )}

                                        {/* Botão Ver Notas */}
                                        <div className="w-28 text-right">
                                          {!aluno.material.loading && aluno.material.anosAnteriores?.length > 0 && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); fetchBoletimAluno(aluno); }}
                                              className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white transition-all shadow-sm hover:shadow-indigo-900/20"
                                            >
                                              <BookCheck size={12} /> Ver Notas
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}

                                    {/* Botão Mais Opções */}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); fetchDetalhesAluno(aluno); }}
                                      className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                                    >
                                      <div className="flex gap-0.5">
                                        <div className="w-1 h-1 bg-current rounded-full"></div>
                                        <div className="w-1 h-1 bg-current rounded-full"></div>
                                        <div className="w-1 h-1 bg-current rounded-full"></div>
                                      </div>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-16 text-center text-slate-400 dark:text-slate-600 flex flex-col items-center">
                              {loadingAlunos ? (
                                <div className="flex flex-col items-center gap-3">
                                  <Loader2 className="animate-spin text-orange-400" size={32} />
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-600">Carregando...</p>
                                </div>
                              ) : (
                                <>
                                  <Users size={32} className="opacity-20 mb-3" />
                                  <p className="text-[10px] font-black uppercase tracking-widest">Nenhum aluno encontrado</p>
                                </>
                              )}
                            </div>
                          )}

                          {/* Footer Stats */}
                          {!loadingAlunos && alunos.length > 0 && (
                            <div className="bg-slate-50 border-t border-slate-100 p-4 px-6 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                              <div className="flex gap-6">
                                <span className="flex items-center gap-2 text-green-600">
                                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                                  Pagos: {alunos.filter(a => a.material.pago).length}
                                </span>
                                <span className="flex items-center gap-2 text-orange-600">
                                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                                  Pendentes: {alunos.filter(a => a.material.comprou && !a.material.pago).length}
                                </span>
                              </div>
                              <span className="text-slate-400">Total: {alunos.length} Alunos</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {viewMode === 'auditoria' && turmas.length === 0 && !loadingTurmas && (
                <div className="py-32 flex flex-col items-center justify-center text-center opacity-40">
                  <School size={64} className="text-slate-300 stroke-1 mb-4" />
                  <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">Nenhuma turma carregada</p>
                  <p className="text-[10px] font-bold text-slate-300 mt-2">Selecione uma unidade e clique em carregar</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal de Seleção de Disciplinas para Exportação */}
      {
        exportModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setExportModalData(null)}>
            <div className="bg-white dark:bg-slate-950 rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10 dark:border-slate-800/50" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 dark:from-black dark:to-indigo-950 p-6 text-white relative overflow-hidden flex-shrink-0 transition-colors">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <h3 className="font-black text-xl uppercase tracking-tight leading-tight flex items-center gap-2">
                      <FileSpreadsheet size={24} /> Exportar Notas
                    </h3>
                    <p className="text-indigo-200 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mt-1">
                      Selecione as disciplinas que deseja incluir
                    </p>
                  </div>
                  <button onClick={() => setExportModalData(null)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                    <XCircle size={20} className="text-white" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1 transition-colors">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-800 transition-colors">
                  <span className="text-[10px] font-black tracking-widest uppercase text-slate-500 dark:text-slate-600">
                    {exportModalData.uniqueDisciplines.length} Disciplinas Encontradas
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedExportDisciplines(new Set(exportModalData.uniqueDisciplines))}
                      className="text-[9px] font-bold tracking-widest uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1.5 rounded-md border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                    >
                      Todas
                    </button>
                    <button
                      onClick={() => setSelectedExportDisciplines(new Set())}
                      className="text-[9px] font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Nenhuma
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {exportModalData.uniqueDisciplines.map(disc => {
                    const isChecked = selectedExportDisciplines.has(disc);
                    return (
                      <label key={disc} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedExportDisciplines(prev => {
                              const newSet = new Set(prev);
                              if (isChecked) newSet.delete(disc);
                              else newSet.add(disc);
                              return newSet;
                            });
                          }}
                          className="w-5 h-5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 dark:bg-slate-800 shadow-sm"
                        />
                        <span className={`text-sm font-bold uppercase tracking-tight transition-colors ${isChecked ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-600 dark:text-slate-400'}`}>{disc}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-3 flex-shrink-0 transition-colors">
                <button
                  onClick={() => setExportModalData(null)}
                  className="px-5 py-3 rounded-xl text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmExportSelection}
                  disabled={selectedExportDisciplines.size === 0}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-md shadow-indigo-900/20 hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                >
                  <FileSpreadsheet size={16} /> Baixar Planilha
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default App;
