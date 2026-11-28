// ESLint для статического сайта без сборщика: все файлы подключаются тегами <script>
// в общую глобальную область. Функции браузера объявлены как readonly-глобалы,
// а объявления самого проекта — как writable, чтобы не было ложных no-redeclare.

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  Event: 'readonly'
};

// имена, объявленные в data.js, model.js, players.js, history.js, config.js, db-remote.js
// и читаемые из других файлов — это глобальные переменные страницы
const projectGlobals = [
  'DB', 'DEFAULT_TEAMS', 'FNL_TEAMS', 'PLAYER_RATINGS', 'POS_BASE', 'POS_BASE_FNL',
  'TEAM_BASE', 'TEAM_BASE_FNL', 'idxOf', 'divOf', 'shortName', 'lambdas', 'matchProbs',
  'poissonArr', 'applySquad', 'adaptFactor', 'applyLeagueShift', 'decayAdapt', 'dynXg',
  'USE_SQUAD', 'USE_DYNAMIC', 'SIM_TICK_MS', 'SIM_MINUTES', 'simDiv', 'simNewState',
  'simBuildSchedule', 'simFinalizeRound', 'simPoissonGoals', 'simPickScorer', 'simEmptyRow',
  'relegBuildMatch', 'parseLineup', 'HISTORY', 'PREDICTIONS', 'LINKED_TO_ACCOUNT',
  'matchKey', 'normName', 'factOutcome', 'matchOutcome', 'isDuplicate', 'saveHistory',
  'savePredictions', 'queueCloudPush', 'pushDirtyToCloud', 'addHistoryMatch', 'clearHistory',
  'addPrediction', 'clearPredictions', 'evaluatePredictions', 'importHistoryCSV',
  'validationMetrics', 'calibrateParams', 'linkAccountOnSignIn', 'unlinkAccount',
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'REMOTE', 'remoteConfigured', 'remoteUserEmail',
  'remoteHeaders', 'remoteSignIn', 'remoteSignUp', 'remoteSignOut', 'remoteIsAdmin',
  'remoteLoadMatches', 'remoteAddMatch', 'remoteAddMatches', 'remoteDeleteMatch',
  'remoteMergeMatches', 'remoteSignedIn', 'remotePredKey', 'remoteLoadMyHistory',
  'remoteReplaceMyHistory', 'remoteLoadMyPredictions', 'remoteReplaceMyPredictions',
  'remoteAuthFetch', 'remoteRefreshSession', 'refreshAdminRole', 'renderAccount',
  'remoteLoadFixtures'
];

// Объявления проекта становятся глобалами, поэтому no-redeclare по ним отключён:
// множество повторных объявлений реально проверяется в браузере при загрузке,
// и такой случай (дубль LINKED_TO_ACCOUNT) уже ловился вручную.
export default [
  {
    files: ['*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: browserGlobals
    },
    rules: {
      'no-undef': ['error', { typeof: true }],
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-const-assign': 'error'
    }
  },
  {
    files: ['*.js'],
    languageOptions: {
      globals: Object.fromEntries(projectGlobals.map(name => [name, 'writable']))
    }
  },
  {
    files: ['scripts/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        TextDecoder: 'readonly'
      }
    },
    rules: { 'no-undef': 'error' }
  },
  {
    ignores: ['.pi-workflow/**', 'node_modules/**', 'supabase/**']
  }
];
