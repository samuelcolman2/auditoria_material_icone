import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Search, Calendar, User, CheckCircle, Loader2, AlertCircle, Play, GraduationCap, Users, LayoutList, ChevronDown, School, Building2, BookCheck, XCircle, DollarSign, Filter, RefreshCw, FileSpreadsheet } from 'lucide-react';

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

  // Configuração das unidades
  const UNIDADES_CONFIG = {
    unidade_1: { nome: 'Unidade 1 - Ícone Taquara 1', codigo: import.meta.env.VITE_UNIDADE_1_CODIGO, token: import.meta.env.VITE_UNIDADE_1_TOKEN },
    unidade_2: { nome: 'Unidade 2 - Ícone Taquara 2', codigo: import.meta.env.VITE_UNIDADE_2_CODIGO, token: import.meta.env.VITE_UNIDADE_2_TOKEN },
    unidade_3: { nome: 'Unidade 3 - Ícone Taquara 3', codigo: import.meta.env.VITE_UNIDADE_3_CODIGO, token: import.meta.env.VITE_UNIDADE_3_TOKEN },
    unidade_4: { nome: 'Unidade 4 - Ícone Taquara 4', codigo: import.meta.env.VITE_UNIDADE_4_CODIGO, token: import.meta.env.VITE_UNIDADE_4_TOKEN },
    unidade_5: { nome: 'Unidade 5 - Ícone Taquara 5', codigo: import.meta.env.VITE_UNIDADE_5_CODIGO, token: import.meta.env.VITE_UNIDADE_5_TOKEN },
    unidade_6: { nome: 'Unidade 6 - Ícone Taquara 6', codigo: import.meta.env.VITE_UNIDADE_6_CODIGO, token: import.meta.env.VITE_UNIDADE_6_TOKEN }
  };

  // Função genérica de Request
  const callSponteXhr = (method, params) => {
    return new Promise((resolve, reject) => {
      const config = UNIDADES_CONFIG[selectedUnidade];
      const xhr = new XMLHttpRequest();
      const url = `https://api.sponteeducacional.net.br/WSAPIEdu.asmx/${method}?nCodigoCliente=${config.codigo}&sToken=${config.token}&sParametrosBusca=${params}`;

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
        responsavel: 'Consultar Secretaria', // GetAlunos padrão não traz nome do responsável direto
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

  const alunosExibidos = filtroCompradores
    ? alunos.filter(a => a.material.comprou)
    : alunos;

  return (
    <div className="min-h-screen bg-[#f3f4f6] p-4 md:p-8 font-sans text-slate-900 antialiased selection:bg-orange-100">

      {/* MODAL DE DETALHES */}
      {selectedAlunoDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedAlunoDetails(null)}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-900 p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${selectedAlunoDetails.material?.comprou ? 'bg-green-500 text-white shadow-lg shadow-green-900/20' : 'bg-slate-700 text-slate-400'}`}>
                    {selectedAlunoDetails.nome.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-black text-lg uppercase tracking-tight leading-tight">{selectedAlunoDetails.nome}</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Detalhes do Aluno</p>
                  </div>
                </div>
                <button onClick={() => setSelectedAlunoDetails(null)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                  <XCircle size={20} className="text-white" />
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
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><User size={10} /> Matrícula</p>
                      <p className="font-bold text-slate-700 text-sm">{selectedAlunoDetails.matricula}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Calendar size={10} /> Nascimento</p>
                      <p className="font-bold text-slate-700 text-sm">{selectedAlunoDetails.dataNascimento}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-orange-100 transition-colors group">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                        <User size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">CPF</p>
                        <p className="font-bold text-slate-700 font-mono text-sm">{selectedAlunoDetails.cpf}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-blue-100 transition-colors group">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <div className="scale-75"><User size={20} /></div>
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Email</p>
                        <p className="font-bold text-slate-700 text-sm truncate w-full">{selectedAlunoDetails.email}</p>
                      </div>
                    </div>

                    {selectedAlunoDetails.responsavel && (
                      <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                          <Users size={18} />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Responsável</p>
                          <p className="font-bold text-slate-700 text-sm">{selectedAlunoDetails.responsavel}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        {/* ... Header existente mantido ... */}
        <div className="bg-slate-900 rounded-[2rem] shadow-2xl relative overflow-hidden group">
          {/* Efeito Glass decorativo */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-white/10 transition-colors duration-700"></div>

          <div className="p-8 md:p-12 text-white relative z-10">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
              <div className="flex items-center gap-6">
                <div className="p-5 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 shadow-inner">
                  <GraduationCap size={40} className="text-orange-400" />
                </div>
                <div>
                  <h1 className="text-3xl font-black uppercase tracking-tight leading-none mb-2">Auditoria Material 2026</h1>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">
                      Verificação Financeira Individual (Pente-Fino)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/80 p-1.5 pl-5 rounded-2xl flex flex-col gap-1 backdrop-blur-sm border border-white/5 min-w-[300px] shadow-xl">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mt-2">
                  <Building2 size={10} /> Unidade Selecionada
                </label>
                <div className="relative group/select">
                  <select
                    className="w-full bg-transparent text-white font-bold text-sm uppercase appearance-none outline-none py-3 pr-8 cursor-pointer group-hover/select:text-orange-400 transition-colors"
                    value={selectedUnidade}
                    onChange={(e) => {
                      setSelectedUnidade(e.target.value);
                      setTurmas([]);
                      setSelectedTurmaId(null);
                    }}
                  >
                    {Object.entries(UNIDADES_CONFIG).map(([key, config]) => (
                      <option key={key} value={key} className="bg-slate-900 text-white">{config.nome}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover/select:text-orange-500 transition-colors" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white py-4 px-8 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse"></div>
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Sistema Conectado e Pronto</span>
            </div>
            <button
              onClick={fetchTurmas}
              disabled={loadingTurmas}
              className="w-full md:w-auto bg-orange-600 hover:bg-orange-500 text-white px-8 py-4 rounded-xl font-black transition-all flex items-center justify-center gap-3 shadow-lg shadow-orange-600/20 hover:shadow-orange-600/40 hover:-translate-y-0.5 active:translate-y-0 uppercase text-[11px] tracking-widest disabled:opacity-50 disabled:pointer-events-none"
            >
              {loadingTurmas ? <Loader2 className="animate-spin" size={16} /> : <><Play size={16} fill="currentColor" /> Carregar Turmas 2026</>}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-600 p-6 rounded-2xl flex items-center gap-4 shadow-sm animate-in slide-in-from-top-4">
            <AlertCircle className="shrink-0" size={24} />
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        {/* Lista de Turmas */}
        <div className="space-y-4 pb-20">
          {turmas.map((turma) => (
            <div key={turma.id} className={`bg-white rounded-[2rem] shadow-sm border transaction-all duration-300 overflow-hidden ${selectedTurmaId === turma.id ? 'ring-2 ring-orange-500 border-transparent shadow-xl shadow-orange-100' : 'border-slate-200 hover:border-orange-200 hover:shadow-md'}`}>
              <button
                onClick={() => fetchAlunosEMateriais(turma.id)}
                className="w-full text-left p-6 md:p-8 flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${selectedTurmaId === turma.id ? 'bg-orange-600 text-white shadow-lg shadow-orange-300' : 'bg-slate-100 text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-500'}`}>
                    <LayoutList size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tight text-xl group-hover:text-orange-600 transition-colors">
                      {turma.nome} <span className="text-slate-300 font-medium ml-2">- 2026</span>
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 group-hover:border-orange-200 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                        {turma.sigla}
                      </span>
                      <span className="text-[10px] font-black text-white bg-orange-500 px-2.5 py-1 rounded-md uppercase tracking-widest shadow-sm shadow-orange-200">
                        {turma.vagasOcupadas} Alunos
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleDownloadReport(turma, e)}
                    disabled={downloadingTurmaId === turma.id}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border ${downloadingTurmaId === turma.id ? 'bg-orange-100 border-orange-200 text-orange-600 animate-pulse cursor-wait' : 'bg-white border-slate-200 text-slate-400 hover:border-green-300 hover:text-green-600 hover:bg-green-50 hover:shadow-sm'}`}
                    title="Baixar Planilha da Turma"
                  >
                    {downloadingTurmaId === turma.id ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                  </button>

                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${selectedTurmaId === turma.id ? 'bg-orange-100/50 rotate-180' : 'bg-slate-50 group-hover:bg-orange-50'}`}>
                    <ChevronDown className={`transition-colors ${selectedTurmaId === turma.id ? 'text-orange-600' : 'text-slate-400 group-hover:text-orange-500'}`} />
                  </div>
                </div>
              </button>

              {selectedTurmaId === turma.id && (
                <div className="border-t border-slate-100 bg-slate-50/50 animate-in slide-in-from-top-2 duration-300">

                  {/* Barra de Progresso da Turma */}
                  {loadingAlunos && (
                    <div className="p-8 pb-0">
                      <div className="bg-white rounded-2xl p-6 border border-orange-100 shadow-sm flex items-center gap-5">
                        <div className="p-3 bg-orange-50 rounded-xl relative">
                          <Loader2 className="animate-spin text-orange-500" size={24} />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                            <span className="text-orange-600">Cruzando Dados Financeiros</span>
                            <span>{Math.round((progressAluno.current / Math.max(progressAluno.total, 1)) * 100)}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Users size={14} /> Lista de Alunos
                      </h4>
                      <button
                        onClick={() => setFiltroCompradores(!filtroCompradores)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${filtroCompradores ? 'bg-slate-800 text-white shadow-slate-800/20 ring-2 ring-slate-800 ring-offset-2 ring-offset-slate-50' : 'bg-white border border-slate-200 text-slate-500 hover:bg-white hover:text-orange-600 hover:border-orange-200'}`}
                      >
                        <Filter size={12} />
                        {filtroCompradores ? 'Mostrando: Apenas Compradores' : 'Filtrar Compradores'}
                      </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      {alunosExibidos.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {alunosExibidos.map((aluno) => (
                            <div key={aluno.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-sm transition-colors ${aluno.material.comprou
                                  ? 'bg-green-100 text-green-700 shadow-green-100'
                                  : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:shadow-sm group-hover:text-slate-500'
                                  }`}>
                                  {aluno.nome.charAt(0)}
                                </div>
                                <div>
                                  <p className={`font-bold text-sm uppercase tracking-tight ${aluno.material.comprou ? 'text-slate-800' : 'text-slate-500'}`}>{aluno.nome}</p>
                                  <p className="font-mono text-[10px] text-slate-400">ID: <span className="font-bold">{aluno.id}</span></p>
                                </div>
                              </div>

                              <div className="flex items-center gap-6">
                                {/* Status Material */}
                                {aluno.material.loading ? (
                                  <div className="w-24 h-6 bg-slate-100 rounded animate-pulse" />
                                ) : (
                                  <div className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest border flex items-center gap-1.5 min-w-[140px] justify-center ${aluno.material.comprou
                                    ? 'bg-blue-50 border-blue-100 text-blue-600'
                                    : 'bg-slate-50 border-slate-100 text-slate-300'
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
                                    <div className="w-16 h-4 bg-slate-100 rounded animate-pulse ml-auto" />
                                  ) : aluno.material.comprou ? (
                                    aluno.material.pago ? (
                                      <div className="inline-flex items-center gap-1.5 text-green-600 font-black text-[10px] uppercase tracking-widest bg-green-50 px-3 py-1.5 rounded-full ring-1 ring-inset ring-green-600/20">
                                        <CheckCircle size={12} /> Pago
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center gap-1.5 text-orange-600 font-black text-[10px] uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded-full ring-1 ring-inset ring-orange-600/20 animate-pulse">
                                        <DollarSign size={12} /> Pendente
                                      </div>
                                    )
                                  ) : (
                                    <span className="text-slate-200 font-bold text-xl">-</span>
                                  )}
                                </div>

                                {/* Botão Mais Opções */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); fetchDetalhesAluno(aluno); }}
                                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-orange-500 transition-colors"
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
                        <div className="p-16 text-center text-slate-400 flex flex-col items-center">
                          {loadingAlunos ? (
                            <div className="flex flex-col items-center gap-3">
                              <Loader2 className="animate-spin text-orange-400" size={32} />
                              <p className="text-[10px] font-black uppercase tracking-widest">Carregando...</p>
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

          {turmas.length === 0 && !loadingTurmas && (
            <div className="py-32 flex flex-col items-center justify-center text-center opacity-40">
              <School size={64} className="text-slate-300 stroke-1 mb-4" />
              <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">Nenhuma turma carregada</p>
              <p className="text-[10px] font-bold text-slate-300 mt-2">Selecione uma unidade e clique em carregar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
