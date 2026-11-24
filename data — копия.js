/* ================== НАЧАЛЬНЫЕ ДАННЫЕ РПЛ ==================
   xG для топ-5 — реальная статистика сезона (Спортс/Understat),
   остальное — оценка по итогам сезона. Составы и тактика — типовые
   стартовые схемы 2025/26, при желании правятся в «Базе команд». */
const DEFAULT_TEAMS = [
  {name:'Зенит',            color:'#1e5aa8', coach:'Семак',       formation:'4-2-3-1', tactic:'высокий прессинг, вертикальные атаки',
   lineup:'Вр: Латышонок\nЗащ: Дуглас Сантос, Эракович, Нино, Вега\nПЗ: Барриос, Вендел\nАтака: Мантуан, Луис Энрике, Педро\nНап: Кассьерра',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/Zenit_St_Peterburg_logo.svg?width=64', xgf:1.64, xga:0.85, mod:1},

  {name:'Спартак',          color:'#d7141a', coach:'Карседо',     formation:'4-2-3-1', tactic:'владение через центр, интенсивный отбор',
   lineup:'Вр: Максименко\nЗащ: Денисов, Джику, Бабич, Ву\nПЗ: Зобнин, Умяров\nАтака: Мартинс, Барко, Жедсон\nНап: Угальде',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Spartak_Moscow_Logo.svg?width=64', xgf:1.55, xga:1.05, mod:1},

  {name:'ЦСКА',             color:'#b30b1f', coach:'Игдисамов',   formation:'4-2-3-1', tactic:'структурированное владение',
   lineup:'Вр: Акинфеев\nЗащ: Матеус Рейс, Круговой, Жоао Виктор, Мойзес\nПЗ: Баринов, Обляков\nАтака: Гайич, Кисляк, Глебов\nНап: Гонду',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_CSKA_Moscow_Logo.svg?width=64', xgf:1.45, xga:1.15, mod:1},

  {name:'Краснодар',        color:'#1b5e3b', coach:'Мусаев',      formation:'4-2-3-1', tactic:'тотальное владение, короткий пас',
      lineup:'Вр: Агкацев\nЗащ: Тормена, Коста, Оласа, Петров\nОП: Сперцян, Батчи\nАП: Черников, Аугусто, Са\nНап: Кордоба',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Krasnodar_Logo.svg?width=64', xgf:1.80, xga:0.95, mod:1},
  {name:'Динамо',           color:'#1f4e9c', coach:'Гусев',       formation:'4-2-3-1', tactic:'прессинг в среднем блоке',
   lineup:'Вр: Лунёв\nЗащ: Касерес, Фернандес, Осипенко, Скопинцев\nПЗ: Фомин, Глебов\nАтака: Бителло, Нгамалё, Гладышев\nНап: Сергеев',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Dynamo_Moscow_Logo.svg?width=64', xgf:1.73, xga:1.20, mod:1},
  {name:'Локомотив',        color:'#222222', coach:'Галактионов', formation:'4-2-3-1', tactic:'вертикальный футбол',
   lineup:'Вр: Митрюшкин\nЗащ: Самошников, Погостнов, Ньямси, Сильянов\nПЗ: Баринов, Батраков\nАтака: Годяев, Раков, Пиняев\nНап: Воробьёв',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Lokomotiv_Moscow_Logo.svg?width=64', xgf:1.59, xga:1.10, mod:1},
  {name:'Ростов',           color:'#c8102e', coach:'Альба',       formation:'4-2-3-1', tactic:'средний блок, переходы через фланги',
   lineup:'Вр: Ятимов\nЗащ: Игнатов, Мелехин, Вахания, Чернов\nПЗ: Кучаев, Щетинин\nАтака: Байрамян, Шанталий\nНап: Комличенко',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/Rostov.svg?width=64', xgf:1.30, xga:1.45, mod:1},
  {name:'Крылья Советов',   color:'#2b6cb0', coach:'Булатов',     formation:'4-2-3-1', tactic:'компактная оборона, быстрые переходы',
   lineup:'Вр: Песьяков\nЗащ: Рассказов, Ороз, Божин, Печенин\nПЗ: Бабкин, Лепский\nАтака: Костанца, Баньяц, Рахманович\nНап: Игнатенко',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Krylia_Sovetov_Logo.svg?width=64', xgf:1.15, xga:1.40, mod:1},
  {name:'Ахмат',            color:'#0f7b3c', coach:'Черчесов',    formation:'4-2-3-1', tactic:'организованная оборона, контратаки',
   lineup:'Вр: Шелия\nЗащ: Богосавац, Шатара, Гандри, Ибишев\nПЗ: Исмаэл, Келиану\nАтака: Касинтура, Талал, Самородов\nНап: Конате',
  logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Akhmat_Grozny_Logo.svg?width=64', xgf:1.10, xga:1.30, mod:1},

   {name:'Рубин',            color:'#8b1a1a', coach:'Артига',      formation:'4-4-2',   tactic:'средний блок, прямые передачи',
   lineup:'Вр: Нигматуллин\nЗащ: Тесленко, Мальдонадо, Вуячич, Грицаенко\nПЗ: Юкич, Иву\nАтака: Ходжа, Йочич, Кабутов\nНап: Шабанхаджай',
   logo:'https://storage.yandexcloud.net/roz-wiki/thumb/FC_Rubin_Logo.svg/200px-FC_Rubin_Logo.svg.png', xgf:1.30, xga:1.30, mod:1},

    {name:'Пари НН',          color:'#5b2d8e', coach:'Гаранин',     formation:'4-2-3-1', tactic:'низкий блок, контратаки',
   lineup:'Вр: Медведев\nЗащ: Карапузов, Александров, Шнапцев, Карич\nПЗ: Майга, Кастильо\nАтака: Вешнер Тичич, Лесовой, Грулёв\nНап: Боселли',
   logo: 'https://storage.yandexcloud.net/roz-wiki/thumb/FC_Pari_NN_Logo_2023.svg.png/430px-FC_Pari_NN_Logo_2023.svg.png?20250725115039',
   xgf:0.95, xga:1.70, mod:1},
  {name:'Сочи',             color:'#0a7ea4', coach:'Осинькин',    formation:'4-2-3-1', tactic:'низкий блок, компактность',
   lineup:'Вр: Дюпин\nЗащ: Магаль, Солдатенков, Марсело, Заика\nПЗ: Сааведра, Васильев\nАтака: Зиньковский, Ежов, Игнатов\nНап: Ильин',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Sochi_Logo.svg?width=64', xgf:0.90, xga:1.75, mod:1},
  {name:'Балтика',          color:'#e05c00', coach:'Талалаев',    formation:'4-2-3-1', tactic:'прессинг в среднем блоке, стандарты',
   lineup:'Вр: Бориско\nЗащ: Бевеев, Варатынов, Гассама, Андраде\nПЗ: Мендель, Петров\nАтака: Титков, Пряхин, Саусь\nНап: Хиль',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Baltika_Logo_2022.svg?width=64', xgf:1.35, xga:1.15, mod:1},
  {name:'Оренбург',         color:'#2f7d32', coach:'Ахметзянов',  formation:'4-4-2',   tactic:'компактный блок, вторые мячи',
   lineup:'Вр: Овсянников\nЗащ: Малых, Прохин, Сидоров, Сыщенко\nПЗ: Башич, Рыбчинский\nАтака: Михайлов, Савельев, Гюрлюк\nНап: Мансилья',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Orenburg_Logo.svg?width=64', xgf:1.00, xga:1.55, mod:1},
  {name:'Акрон',            color:'#6a1b9a', coach:'Искаков',     formation:'4-2-3-1', tactic:'низкий блок, контратаки',
   lineup:'Вр: Гудиев\nЗащ: Роча, Лончар, Бокоев, Фернандес\nПЗ: Бистрович, Неделчару\nАтака: Эсковаль, Пестряков, Хосонов\nНап: Дзюба',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Akron_Logo_2023.svg?width=64', xgf:1.05, xga:1.55, mod:1},
  {name:'Динамо Махачкала', color:'#e8b32a', coach:'Евсеев',      formation:'4-4-2',   tactic:'низкий блок, длинные передачи',
   lineup:'Вр: Волк\nЗащ: Пальцев, Табидзе, Шумахов, Кагермазов\nПЗ: Джапо, Мрезиг\nАтака: Зинович, Глушков, Магомедов\nНап: Агаларов',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Dynamo_Makhachkala_Logo.svg?width=64', xgf:1.00, xga:1.60, mod:1}
];
/* ================== ФНЛ ==================
   xG — оценка уровня Первой лиги (заметно ниже РПЛ).
   Тренеры и составы — заготовки, правятся в «Базе команд». */
const FNL_TEAMS = [
{name:'Родина',          color:'#0f2b5b', coach:'Диас',        formation:'4-2-3-1', tactic:'атакующий владеющий футбол, высокий прессинг', logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Rodina_Logo.svg?width=64', xgf:1.71, xga:0.82, mod:1},
  {name:'Факел',           color:'#0a58a3', coach:'Василенко',   formation:'4-2-3-1', tactic:'компактная оборона, быстрые переходы',  logo:'https://ru.wikipedia.org/wiki/Special:FilePath/Fakel_Voronezh_logo.svg?width=64', xgf:1.29, xga:0.65, mod:1},
  {name:'Урал',            color:'#0057a8', coach:'Ромащенко',   formation:'4-2-3-1', tactic:'структурированные атаки, средний блок',  logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Ural_Logo.svg?width=64', xgf:1.50, xga:0.91, mod:1},
  {name:'Ротор',           color:'#0057b8', coach:'Парфёнов',    formation:'4-2-3-1', tactic:'лучшая оборона лиги, контратаки через фланги', logo:'https://en.wikipedia.org/wiki/Special:FilePath/FC_Rotor_Volgograd_logo.png?width=64', xgf:1.38, xga:0.76, mod:1},
  {name:'КАМАЗ',           color:'#0055a5', coach:'Хазов',       formation:'4-4-2',   tactic:'прямые передачи, стандарты', logo:'https://en.wikipedia.org/wiki/Special:FilePath/FC_KAMAZ_Naberezhnye_Chelny_logo.svg?width=64', xgf:1.35, xga:1.00, mod:1},
  {name:'Енисей',          color:'#1b4f9c', coach:'Ташуев',      formation:'4-4-2',   tactic:'высокая физика, борьба на втором этаже', logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Yenisey_Logo.svg?width=64', xgf:1.09, xga:1.03, mod:1},
  {name:'Спартак Кострома',color:'#c8102e', coach:'Таранухин',   formation:'4-2-3-1', tactic:'вертикальный футбол через атаку', logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Spartak_Kostroma_Logo_2022.svg?width=64', xgf:1.35, xga:1.21, mod:1},
  {name:'Шинник',          color:'#101c3f', coach:'Булойчик',    formation:'4-4-2',   tactic:'компактный средний блок, вторые мячи', logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Shinnik_Logo.svg?width=64', xgf:1.00, xga:0.82, mod:1},
  {name:'Торпедо',         color:'#111111', coach:'Кононов',     formation:'4-2-3-1', tactic:'позиционные атаки, розыгрыш через центр', logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Torpedo_Moscow_Logo_2023.svg?width=64', xgf:1.09, xga:1.15, mod:1},
  {name:'Челябинск',       color:'#1f5fa8', coach:'Пилипчук',    formation:'4-4-2',   tactic:'средний блок, переходы через фланги', logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Chelyabinsk_Logo.svg?width=64', xgf:1.24, xga:1.18, mod:1},
  {name:'Нефтехимик',      color:'#0d47a1', coach:'Новиков',     formation:'4-2-3-1', tactic:'сбалансированный футбол, средний блок', logo:'https://en.wikipedia.org/wiki/Special:FilePath/Neftekhimik_Nizhnekamsk_logo.png?width=64', xgf:1.18, xga:1.21, mod:1},
  {name:'СКА-Хабаровск',   color:'#b71c3c', coach:'Семёнов',     formation:'4-2-3-1', tactic:'вертикальный футбол, стандарты', logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_SKA-Khabarovsk_Logo.svg?width=64', xgf:1.09, xga:1.32, mod:1},
  {name:'Арсенал Тула',    color:'#e30613', coach:'Гунько',      formation:'4-4-2',   tactic:'прямой футбол, борьба', logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Arsenal_Tula_Logo.svg?width=64', xgf:1.24, xga:1.29, mod:1},
  {name:'Волга Ульяновск', color:'#1565c0', coach:'Белов',       formation:'4-4-2',   tactic:'компактность, борьба, стандарты', logo:'https://ru.wikipedia.org/wiki/Special:FilePath/Volga_Ulyanovsk_Logo.svg?width=64', xgf:1.03, xga:1.41, mod:1},
  {name:'Уфа',             color:'#00695c', coach:'Тетрадзе',    formation:'4-2-3-1', tactic:'низкий блок, контратаки', logo:'https://commons.wikimedia.org/wiki/Special:FilePath/FC_Ufa_logo.svg?width=64', xgf:0.94, xga:1.18, mod:1},
  {name:'Черноморец',      color:'#0a5fa8', coach:'Попов',       formation:'4-2-3-1', tactic:'средний блок, переходы', logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Chernomorets_Novorossiysk_Logo.svg?width=64', xgf:1.09, xga:1.44, mod:1},
  {name:'Сокол',           color:'#1565c0', coach:'Харлачёв',    formation:'4-4-2',   tactic:'низкий блок, борьба', logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Sokol_Saratov_Logo.svg?width=64', xgf:0.47, xga:1.29, mod:1},
  {name:'Чайка',           color:'#f9a825', coach:'Комбаров',    formation:'4-4-2',   tactic:'низкий блок, стандарты', logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Chayka_Peschanokopskoye_Logo.png?width=64', xgf:0.88, xga:2.24, mod:1}
];
// дивизионы: РПЛ — по умолчанию, ФНЛ — из нового массива
DEFAULT_TEAMS.forEach(t => t.div = 'rpl');
FNL_TEAMS.forEach(t => t.div = 'fnl');
DEFAULT_TEAMS.push(...FNL_TEAMS);

/* ================== АДАПТАЦИЯ И РАЗРЫВ ЛИГ ================== */
// множитель адаптации: новичок РПЛ первые сезоны играет слабее своих xG
function adaptFactor(t){
  const a = Math.max(0, Math.min(3, t.adapt || 0));
  if(!a) return {atk: 1, def: 1};
  return {atk: 1 - 0.08 * a, def: 1 + 0.06 * a};
}
// пересчёт xG при смене дивизиона: уровни лиг различаются.
// ФНЛ→РПЛ: атака срезается на 30%, оборона ослабляется на 25%.
// РПЛ→ФНЛ — те же коэффициенты в обратную сторону: вылетевший снова становится силой.
const LEAGUE_SHIFT = {atk: 0.70, def: 1.25};
function applyLeagueShift(team, dir){
  const ka = dir === 'up' ? LEAGUE_SHIFT.atk : 1 / LEAGUE_SHIFT.atk;
  const kd = dir === 'up' ? LEAGUE_SHIFT.def : 1 / LEAGUE_SHIFT.def;
  team.xgf = +(team.xgf * ka).toFixed(3);
  team.xga = +(team.xga * kd).toFixed(3);
}
// новый сезон — адаптация у всех команд продвигается на год
function decayAdapt(){
  DB.teams.forEach(t => { if(t.adapt > 0) t.adapt--; });
}

/* ================== ДИВИЗИОНЫ ================== */
// дивизион команды и список индексов команд дивизиона
const divOf = t => t.div || 'rpl';
function idxOf(div){ return DB.teams.map((t,i)=>i).filter(i => divOf(DB.teams[i]) === div); }