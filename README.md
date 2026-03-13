# 📚 Sistema de Auditoria e Boletim — Ícone COC

Aplicação web interna desenvolvida para gestão das unidades da escola **Ícone COC**.  
Permite duas funcionalidades principais: **Auditoria de Material Didático** e **Visualização de Boletim dos Alunos**, com integração direta à API Sponte.

---

## 🗂️ Estrutura do Projeto

```
subir_alunos_coc/
├── src/
│   ├── App.jsx          # Componente principal — toda a lógica e UI
│   ├── main.jsx         # Entry point do React
│   ├── index.css        # Estilos globais
│   └── App.css          # Estilos do componente raiz
├── public/              # Assets estáticos
├── .env                 # Variáveis de ambiente (credenciais das unidades)
├── package.json         # Dependências e scripts
├── vite.config.js       # Configuração do Vite
├── tailwind.config.js   # Configuração do Tailwind
├── sponte.wsdl          # Arquivo de referência da API Sponte (não usado em produção)
└── README.md            # Esta documentação OFICIAL do projeto
```

---

## ⚙️ Configuração de Ambiente

Copie o arquivo `.env` e preencha com os dados de cada unidade:

```env
VITE_UNIDADE_1_CODIGO=18935
VITE_UNIDADE_1_TOKEN=xxx
VITE_UNIDADE_2_CODIGO=70293
VITE_UNIDADE_2_TOKEN=xxx
VITE_UNIDADE_3_CODIGO=19240
VITE_UNIDADE_3_TOKEN=xxx
VITE_UNIDADE_4_CODIGO=73807
VITE_UNIDADE_4_TOKEN=xxx
VITE_UNIDADE_5_CODIGO=488368
VITE_UNIDADE_5_TOKEN=xxx
VITE_UNIDADE_6_CODIGO=488369
VITE_UNIDADE_6_TOKEN=xxx
```

> ⚠️ **NUNCA commitar o `.env` no Git.** Ele está no `.gitignore`.

---

## 🚀 Como rodar localmente

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (acessa em http://localhost:5173)
npm run dev

# Gerar build de produção
npm run build
```

---

## 🔌 Integração com a API Sponte

Todos os dados são buscados diretamente da [API REST Sponte](https://api.sponteeducacional.net.br/).

### Chamada Principal: `callSponteForUnit`
Localizada em `App.jsx`, esta constante centraliza todas as requisições de rede:
- **unidadeKey:** Identifica qual unidade (token/código no `.env`) usar.
- **method:** O endpoint do Sponte (ex: `GetAlunos`).
- **params:** Parâmetros da query formatados.

### Fluxo de Recuperação de Dados
1. **Dados Cadastrais:** Requisição `GetAlunos` com `alunoid` para obter CPF, Nascimento, Matrícula e Email.
2. **Histórico:** `GetMatriculas` para identificar anos/turmas anteriores.
3. **Extração de Notas:** `GetNotaParcial` percorre cada `wsNotaParcial` para capturar médias e sub-notas (VAD, VAO, VAF).

### Endpoints utilizados

| Método | Uso |
|--------|-----|
| `GetTurmas2` | Lista turmas de 2026 da unidade selecionada |
| `GetIntegrantesTurmas` | Lista alunos de uma turma específica |
| `GetMatriculas` | Busca histórico de matrículas por aluno (para detectar anos anteriores) |
| `GetFinanceiro` | Verifica se o aluno pagou o material didático |
| `GetAlunos` | Busca dados detalhados do aluno (para exportação e pesquisa) |
| `UpdateAlunos3` | Atualiza dados cadastrais (E-mail e Celular) no Sponte |
| `GetNotaParcial` | Busca notas parciais e médias por aluno/turma/ano |

### Parâmetros importantes do `GetNotaParcial`

```
GET /WSAPIEdu.asmx/GetNotaParcial
  ?nCodigoCliente={codigo}
  &sToken={token}
  &nAlunoID={alunoId}
  &nTurmaID={turmaId}   # ID da turma (informe 0 para aulas livres)
  &nCursoID={cursoId}   # ID do curso (informe 0 para turmas regulares)
  &sParametrosBusca=
```

> ⚠️ **Importante:** A API não aceita `nTurmaID` e `nCursoID` ao mesmo tempo. Use um ou outro.

---

## 🧩 Funcionalidades

### 1. 🔍 Modo Auditoria de Material Didático

- Selecione a **unidade** e a **turma** para carregar os alunos.
- O sistema verifica automaticamente via `GetFinanceiro` se cada aluno pagou o material didático para 2026.
- Alunos com material **pago** aparecem com um badge verde ✅.
- Alunos com material **não pago** aparecem com badge vermelho ❌.
- Filtro para exibir **apenas compradores** (toggle).
- Botão **"Baixar Lista"** por turma: gera planilha Excel (`.xlsx`) com:
  - Nome Completo
  - Nome de Usuário (`iMatricula`)
  - Data de Nascimento
  - CPF
  - E-mail
  - Turma
  - Matrícula
  - Senha Temporária (`Icone@Matricula`)

---

### 2. 📋 Modo Visualização de Boletim

- Selecione a **unidade**, escolha uma **turma** e os alunos serão carregados.
- O sistema busca matrículas anteriores de cada aluno via `GetMatriculas`.
- Alunos com histórico em anos anteriores recebem o badge **"VETERANO (anos)"**.
- Filtro para exibir **apenas veteranos** (toggle).
- Botão **"VER NOTAS"** abre o modal de boletim do aluno.

#### Modal de Boletim

- **Seletor de Ano Letivo:** abas para navegar entre anos (ex: Ano 2025, Ano 2024).
- **Filtro de Período:** botões para filtrar por trimestre/bimestre (ex: 1º Trimestre, 2º Trimestre).
- **Seleção de Disciplinas:** caixas de seleção por disciplina, com botão "Selecionar Visíveis".
- **Notas exibidas:**  
  - Média Final do período (ex: `54`)
  - Notas parciais por avaliação (ex: `VAD: 20`, `VAO: 16`, `VAF: 18`)
- **Exportar para Excel:** botão "Baixar X Selecionadas" gera planilha `.xlsx` com:
  - Ano Letivo
  - Período
  - Disciplina
  - Média Final
  - Colunas individuais para cada nota parcial (VAD, VAO, VAF, etc.)

---

### 3. 🌐 Pesquisa Global de Alunos (Modo Notas)

- **Pesquisa Global Turbinada**: O mesmo campo de busca aceita **Nome, E-mail ou Matrícula**.
- **Detecção Inteligente**: Se o termo contiver "@", busca por e-mail; se contiver apenas números, busca por matrícula.
- **Resultados Unificados**: Junta alunos encontrados em diferentes unidades e por diferentes critérios (Nome/Email/Matrícula) em uma lista limpa e sem repetições.
- **Histórico Unificado:** Ao selecionar um aluno, o sistema abre um modal exclusivo que:
  - Busca matrículas em **todas** as unidades onde o aluno já estudou.
  - Consolida notas de diferentes anos e unidades em uma única visualização.
  - Permite filtrar por Ano e Trimestre/Bimestre.
  - Exibe a unidade e a turma de cada registro histórico.
- **Edição de Dados (Direto no Sponte)**: Implementação de botões de edição (lápis) nos campos de **E-mail** e **Celular**.
  - As alterações são persistidas em tempo real no banco de dados do Sponte via API.
- **Botões de Cópia Direta:** Implementados nos campos Nome (header), Matrícula, Nascimento e CPF.
  - **Feedback:** Ícone de "check" verde por 2 segundos após a cópia.
- **Visualização de Turma Atual:** Substituição do campo "Responsável" pela "Turma Atual" do aluno (com lógica de priorização para o ano letivo corrente).
  - **Identificação Inteligente:** Para alunos inativos, o sistema percorre o histórico em todas as unidades para encontrar a última turma registrada.
- **Visualização de Notas Parciais:** Badges laranja exibem o detalhamento (VAD, VAO, VAF) logo abaixo da média de cada disciplina.
- **Menu de Configurações & Alunos Salvos:** A lista de alunos salvos foi movida para um menu de configurações (ícone de engrenagem) no topo superior direito. O menu permite ver, limpar e exportar os alunos salvos, otimizando o espaço da tela principal e removendo a barra lateral fixa.
- **Indicador de Status (Ativo/Inativo):** Exibição clara da situação do aluno (Ativo em verde, Inativo em vermelho) nos resultados de busca e detalhes.

---

## 📦 Dependências Principais

| Pacote | Versão | Uso |
|--------|--------|-----|
| `react` | 19.x | Framework de UI |
| `react-dom` | 19.x | Renderização DOM |
| `lucide-react` | 0.563.x | Ícones |
| `xlsx` | 0.18.x | Geração de planilhas Excel |
| `vite` | 7.x | Bundler e dev server |
| `tailwindcss` | 4.x | Framework de estilos |

---

## 🏗️ Arquitetura e Fluxo de Dados

```
Usuario
  │
  ├─ Seleciona Unidade → carrega Credenciais do .env
  │
  ├─ Seleciona Turma → GetTurmas2 → lista turmas 2026
  │
  └─ Modo Selecionado
       │
       ├─ AUDITORIA
       │    └─ GetIntegrantesTurmas → lista alunos
       │         └─ GetFinanceiro (por aluno, lotes de 5)
       │              └─ verifica parcelas com keyword match
       │
       └─ BOLETIM
            └─ GetIntegrantesTurmas → lista alunos
                 └─ GetMatriculas (por aluno, lotes de 5)
                      └─ extrai todos os TurmaIDs por ano
                           └─ [botão "VER NOTAS"]
                                └─ GetNotaParcial (todos TurmaIDs do ano)
                                     └─ mescla resultados por disciplina
                                          └─ exibe por ano/período/nota
```

---

## 🔄 Arquitetura para Futura Migração (Outros ERPs)

A aplicação foi estruturada para facilitar a troca do Sponte por outro sistema no futuro:

1. **Adapter de API:** Criar uma nova função de rede (ex: `callOtherSystem`) no lugar da `callSponteForUnit`.
2. **Normalização de Dados:** O front-end espera que os dados de notas cheguem normalizados através do parser (`parseExtrato`) no seguinte formato:
   ```javascript
   { disciplina: "NOME", nome: "PERÍODO", notaFinal: "VALOR", subNotas: [{ nome: "TIPO", nota: "VALOR" }] }
   ```
3. **Configuração Multi-Unidade:** Basta expandir a `UNIDADES_CONFIG` no topo para suportar diferentes terminais da nova API.

---

## ⚠️ Comportamentos Conhecidos

### Notas não encontradas (`"Matrículas anteriores encontradas, mas sem notas no sistema"`)

Esse aviso aparece quando o aluno possui matrículas em anos anteriores registrados no Sponte, mas **as notas parciais não foram lançadas pelos professores** para aquela turma naquele período.

**Isso é comum em:**
- Turmas de Educação Infantil (Pré I, Pré II) — frequentemente sem nota numérica.
- Turmas cujo lançamento de notas ainda não foi concluído pela escola.

### Aluno com badge VETERANO mas sem notas

O badge "VETERANO" aparece sempre que `GetMatriculas` retorna pelo menos uma matrícula anterior a 2026. Não garante que existam notas para aquele período.

### Múltiplas turmas no mesmo ano
Caso um aluno tenha mudado de turma em 2025 (ex: transferência interna), o sistema consulta **todas** as TurmaIDs daquele ano e mescla os resultados, garantindo que nenhuma nota fique de fora.

---

## 🛠️ Correções Críticas e Melhorias Técnicas

### 1. Deteção Resiliente da Turma Atual (Problema 2026)
Havia um erro onde alunos ativos em 2026 apareciam como "Sem matrícula" ou com turmas de 2025.
- **Solução**: Implementada a função `extractYear` que busca o ano letivo no `AnoLetivo`, nas datas de início e até no **Nome da Turma** via Regex.
- **Resiliência**: Para alunos **Ativos**, o sistema agora sempre exibe a matrícula mais recente como "Atual" (fallback), garantindo que a informação visual esteja sempre presente.

---

---

## 📅 Histórico de Desenvolvimento

| Data | Funcionalidade |
|------|---------------|
| 2026-03 | Criação inicial do projeto — Auditoria de Material Didático com exportação XLSX |
| 2026-03 | Adição do Modo Boletim com integração à API `GetNotaParcial` |
| 2026-03 | Implementação do seletor de anos anteriores via `GetMatriculas` |
| 2026-03 | Filtros de período (Trimestre/Bimestre) no modal de boletim |
| 2026-03 | Seleção de disciplinas e exportação personalizada para Excel |
| 2026-03 | Abas de Ano Letivo no modal de boletim |
| 2026-03 | Correção: coleta de todos os TurmaIDs por ano (múltiplas matrículas no mesmo ano) |
| 2026-03 | Melhoria: mensagem informativa quando notas existem no histórico mas não no Sponte |
| 2026-03 | Implementação da **Pesquisa Global de Alunos** em todas as unidades com autocomplete |
| 2026-03 | Adição de botões de cópia com feedback visual (Check verde) |
| 2026-03 | Implementação da visualização detalhada de **Notas Parciais (VAD/VAO/VAF)** |
| 2026-03 | Padronização Visual Laranja e Consolidação da Documentação Técnica |
| 2026-03 | Refatoração: **Menu de Configurações** no topo direito com Alunos Salvos (Sidebar removida) |
| 2026-03 | Adição de **Indicador de Status Ativo/Inativo** textual e colorido na busca global |
| 2026-03 | Atualização do Modal: Substituição de 'Responsável' por **'Turma Atual'** |
| 2026-03 | Melhoria: Busca exaustiva de matrícula em todas as unidades para alunos inativos |
| 2026-03 | **Correção Crítica**: Lógica resiliente de detecção de ano (fix erro Turma Atual 2026) |
| 2026-03 | **Feature**: Pesquisa Global expandida para E-mail e Matrícula |
| 2026-03 | **Feature**: Edição de E-mail e Celular com persistência direta no Sponte |

---

## 👨‍💻 Contato

Desenvolvido para uso interno das unidades **Ícone COC — Taquara**.
