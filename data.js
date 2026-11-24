/* ================== НАЧАЛЬНЫЕ ДАННЫЕ РПЛ ==================
   xG для топ-5 — реальная статистика сезона (Спортс/Understat),
   остальное — оценка по итогам сезона. Составы и тактика — типовые
   стартовые схемы 2026/27, при желании правятся в «Базе команд». */
const DEFAULT_TEAMS = [
  {name:'Зенит',            color:'#1e5aa8', coach:'Семак',       formation:'4-3-3',   tactic:'высокий прессинг, владение, вертикальные атаки',
   lineup:'Вр: Москвичёв\nЗащ: Дуглас Сантос, Нино, Алип, Дивеев\nОпорник: Барриос\nПЗ: Карпукас, Вендел\nАтака: Глушенков, Луис Энрике, Педро\nНап: Соболев',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/Zenit_St_Peterburg_logo.svg?width=64', xgf:1.72, xga:0.92, mod:1},

  {name:'Спартак',          color:'#d7141a', coach:'Слишкович',   formation:'4-2-3-1', tactic:'владение через центр, интенсивный отбор',
   lineup:'Вр: Максименко\nЗащ: Денисов, Бабич, Литвинов, Ву\nПЗ: Зобнин, Умяров\nАтака: Маркиньос, Барко, Фернандеш\nНап: Даку',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Spartak_Moscow_Logo.svg?width=64', xgf:1.62, xga:1.08, mod:1},

  {name:'ЦСКА',             color:'#b30b1f', coach:'Игдисамов',   formation:'4-2-3-1', tactic:'структурированное владение',
   lineup:'Вр: Тороп\nЗащ: Рейс, Жоао Виктор, Лукин, Круговой\nПЗ: Кисляк, Козлов\nАтака: Обляков, Попович, Данилов\nНап: Мусаев',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_CSKA_Moscow_Logo.svg?width=64', xgf:1.50, xga:1.12, mod:1},
  
  {name:'Краснодар',        color:'#1b5e3b', coach:'Мусаев',      formation:'4-2-3-1', tactic:'тотальное владение, короткий пас',
      lineup:'Вр: Агкацев\nЗащ: Тормена, Вахания, Оласа, Пальцев\nОП: Черников, Кривцов\nАП: Уткин, Кристиан, Батчи\nНап: Кордоба',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Krasnodar_Logo.svg?width=64', xgf:1.78, xga:0.98, mod:1},
  {name:'Динамо',           color:'#1f4e9c', coach:'Личка',       formation:'4-2-3-1', tactic:'прессинг в среднем блоке',
   lineup:'Вр: Лунёв\nЗащ: Касерес, Фернандес, Рубенс, Рикардо\nПЗ: Глебов, Фомин\nАтака: Бителло, Миранчук, Гладышев\nНап: Тюкавин',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Dynamo_Moscow_Logo.svg?width=64', xgf:1.70, xga:1.18, mod:1},
  {name:'Локомотив',        color:'#222222', coach:'Галактионов', formation:'4-2-3-1', tactic:'вертикальный футбол',
   lineup:'Вр: Митрюшкин\nЗащ: Фассон, Монтес, Сильянов, Морозов\nПЗ: Бабкин, Титков\nАтака: Мостовой, Бакаев, Пиняев\nНап: Комличенко',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Lokomotiv_Moscow_Logo.svg?width=64', xgf:1.58, xga:1.12, mod:1},
  {name:'Ростов',           color:'#c8102e', coach:'Альба',       formation:'4-2-3-1', tactic:'средний блок, переходы через фланги',
   lineup:'Вр: Петров\nЗащ: Сако, Чистяков, Хлусевич, Лангович\nПЗ: Миронов, Комаров\nАтака: Олусегун, Кучаев, Сулейманов\nНап: Роналдо',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/Rostov.svg?width=64', xgf:1.35, xga:1.42, mod:1},
  {name:'Крылья Советов',   color:'#2b6cb0', coach:'Булатов',     formation:'4-2-3-1', tactic:'компактная оборона, быстрые переходы',
   lineup:'Вр: Кокарев\nЗащ: Печенин, Чернов, Горшков, Божин\nПЗ: Костанца, Баньяц\nАтака: Макаров, Столбов, Фернандес\nНап: Салтыков',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Krylia_Sovetov_Logo.svg?width=64', xgf:1.20, xga:1.38, mod:1},
  {name:'Ахмат',            color:'#0f7b3c', coach:'Черчесов',    formation:'4-2-3-1', tactic:'организованная оборона, контратаки',
   lineup:'Вр: Мицаев\nЗащ: Адамов, Цаке, Богосавац, Н\'Донг\nОП: Ибишев, Сидибе\nАтака: Щетинин, Исмаэл, Самородов\nНап: Конате',
  logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Akhmat_Grozny_Logo.svg?width=64', xgf:1.15, xga:1.28, mod:1},
  
   {name:'Рубин',            color:'#8b1a1a', coach:'Артига',      formation:'4-2-3-1', tactic:'средний блок, прямые передачи',
   lineup:'Вр: Ставер\nЗащ: Тесленко, Вуячич, Рожков, Самошников\nОП: Иву, Безруков\nАтака: Грипши, Ходжа, Видяев\nНап: Шабанхаджай',
   logo:'https://storage.yandexcloud.net/roz-wiki/thumb/FC_Rubin_Logo.svg/200px-FC_Rubin_Logo.svg.png', xgf:1.32, xga:1.28, mod:1},
    
  {name:'Балтика',          color:'#e05c00', coach:'Талалаев',    formation:'4-2-3-1', tactic:'прессинг в среднем блоке, стандарты',
   lineup:'Вр: Латышонок\nЗащ: Варатынов, Гассама, Бевеев, Муйоколо\nПЗ: Мурид, Шильцов\nАтака: Мендель, Максим Петров, Голенков\nНап: Хиль',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Baltika_Logo_2022.svg?width=64', xgf:1.34, xga:1.18, mod:1},
  {name:'Оренбург',         color:'#2f7d32', coach:'Ахметзянов',  formation:'4-2-3-1', tactic:'компактный блок, вторые мячи',
   lineup:'Вр: Овсянников\nЗащ: Хотулев, Сивис, Ценов, Касимов\nПЗ: Болотов, Пуэбла\nАтака: Рыбчинский, Куль, Томпсон\nНап: Гузина',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Orenburg_Logo.svg?width=64', xgf:1.05, xga:1.52, mod:1},
  {name:'Акрон',            color:'#6a1b9a', coach:'Искаков',     formation:'4-2-3-1', tactic:'низкий блок, контратаки',
   lineup:'Вр: Гудиев\nЗащ: Бардыбахин, Неделчару, Эшковал, Бокоев\nПЗ: Бистрович, Лончар\nАтака: Марадишвили, Хосонов, Пестряков\nНап: Тедич',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Akron_Logo_2023.svg?width=64', xgf:1.08, xga:1.52, mod:1},
  {name:'Родина',           color:'#0f2b5b', coach:'Альба',       formation:'4-2-3-1', tactic:'атакующее владение, высокий прессинг',
   lineup:'Вр: Волков\nЗащ: Силва, Мачадо, Бекао, Мещанинов\nОП: Егорычев\nПЗ: Посо, Фищенко\nАтака: Максименко, Мусаев, Онугха\nНап: Мансилья',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Rodina_Logo.svg?width=64', xgf:1.28, xga:1.35, mod:1},
  {name:'Факел',            color:'#0a58a3', coach:'Василенко',   formation:'4-2-3-1', tactic:'компактная оборона, быстрые переходы',
   lineup:'Вр: Фролкин\nЗащ: Габараев, Клейтон, Бардачёв, Тодорович\nОП: Якимов\nПЗ: Ковалёв, Магомедов\nАтака: Турищев, Нетфуллин, Пуси\nНап: Кокшаров',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/Fakel_Voronezh_logo.svg?width=64', xgf:1.18, xga:1.30, mod:1},
  {name:'Динамо Махачкала', color:'#e8b32a', coach:'Евсеев',      formation:'4-2-3-1', tactic:'низкий блок, длинные передачи',
   lineup:'Вр: Магомедов\nЗащ: Аларкон, Алибеков, Махамаджонов, Сундуков\nПЗ: Апшацев, Кузяев\nАтака: Зинович, Лесовой, Глушков\nНап: Агаларов',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Dynamo_Makhachkala_Logo.svg?width=64', xgf:1.05, xga:1.55, mod:1}
];
/* ================== ФНЛ ==================
   Первая лига сезон 2026/27 — 18 участников (Родина и Факел в РПЛ; выбыли Сокол, Чайка,
   Черноморец; вошли Велес, Ленинградец, Нижний Новгород/Пари НН, Сочи, Текстильщик).
   xG — заметно ниже РПЛ. Составы — реальные по сезону 26/27. */
const FNL_TEAMS = [
  {name:'Урал',            color:'#0057a8', coach:'Аверьянов',   formation:'4-2-3-1', tactic:'структурированные атаки, средний блок',
   lineup:'Вр: Селихов\nЗащ: Стежко, Прищепа, Тихий, Малькевич\nОП: Сунгатулин\nПЗ: Ишков, Байрамян\nАтака: Карапузов, Сатучин\nНап: Секулич',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Ural_Logo.svg?width=64', xgf:1.30, xga:1.05, mod:1},
  {name:'Арсенал Тула',    color:'#e30613', coach:'Гунько',      formation:'4-2-3-1', tactic:'прямой футбол, борьба',
   lineup:'Вр: Мелихов\nЗащ: Пенчиков, Гоцук, Исаенко, Кармаев\nОП: Ефремов\nПЗ: Раздорских, Глушков\nАтака: Богданов, Мелекесцев\nНап: Жамалетдинов',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Arsenal_Tula_Logo.svg?width=64', xgf:1.28, xga:1.05, mod:1},
  {name:'Ротор',           color:'#0057b8', coach:'Парфёнов',    formation:'4-2-3-1', tactic:'контратаки через фланги',
   lineup:'Вр: Сугробов\nЗащ: Хитяев, Юдинцев, Данилкин, Покидышев\nОП: Трошечкин\nПЗ: Цараев, Симонян\nАтака: Клещенко, Ревазов\nНап: Эльдарушев',
   logo:'https://en.wikipedia.org/wiki/Special:FilePath/FC_Rotor_Volgograd_logo.png?width=64', xgf:1.25, xga:1.00, mod:1},
  {name:'Нижний Новгород', color:'#5b2d8e', coach:'Гаранин',     formation:'4-2-3-1', tactic:'низкий блок, контратаки',
   lineup:'Вр: Имамов\nЗащ: Гудков, Карич, Каккоева, Коледин\nОП: Калинский\nПЗ: Ермаков, Пополитов\nАтака: Сарвели, Соколов\nНап: Грулёв',
   logo: 'https://storage.yandexcloud.net/roz-wiki/thumb/FC_Pari_NN_Logo_2023.svg.png/430px-FC_Pari_NN_Logo_2023.svg.png',
   xgf:1.15, xga:1.20, mod:1},
  {name:'Сочи',             color:'#0a7ea4', coach:'Осинькин',    formation:'4-2-3-1', tactic:'низкий блок, компактность',
   lineup:'Вр: Митров\nЗащ: Солдатенков, Стоич, Кожемякин, Безчаснюк\nОП: Макарчук\nПЗ: Шубин, Галкин\nАтака: Корольков, Мелёшин\nНап: Фёдоров',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Sochi_Logo.svg?width=64', xgf:1.15, xga:1.25, mod:1},
  {name:'Шинник',          color:'#101c3f', coach:'Булойчик',    formation:'4-2-3-1', tactic:'компактный средний блок, вторые мячи',
   lineup:'Вр: Янович\nЗащ: Чистяков, Карпов, Котин, Чёрный\nОП: Голубев\nПЗ: Валиахметов, Шмаков\nАтака: Ланин, Гонгапшев\nНап: Самойлов',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Shinnik_Logo.svg?width=64', xgf:1.10, xga:1.00, mod:1},
  {name:'Торпедо',         color:'#111111', coach:'Кононов',     formation:'4-2-3-1', tactic:'позиционные атаки, розыгрыш через центр',
   lineup:'Вр: Солдатенко\nЗащ: Бородин, Корнюшин, Бозов, Шевченко\nОП: Берковский\nПЗ: Юшин, Погосов\nАтака: Чурич, Галоян\nНап: Окоронкво',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Torpedo_Moscow_Logo_2023.svg?width=64', xgf:1.15, xga:1.10, mod:1},
  {name:'КАМАЗ',           color:'#0055a5', coach:'Хазов',       formation:'4-4-2',   tactic:'прямые передачи, стандарты',
   lineup:'Вр: Замерец\nЗащ: Мануйлов, Бурко, Ратников, Аюкин\nПЗ: Семёнов, Султонов\nПЗ: Защепкин, Акбашев\nНап: Уридия, Воронин',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_KAMAZ_Logo.svg?width=64', xgf:1.18, xga:1.02, mod:1},
  {name:'Спартак Кострома',color:'#c8102e', coach:'Таранухин',   formation:'4-2-3-1', tactic:'вертикальный футбол через атаку',
   lineup:'Вр: Шамов\nЗащ: Бугарин, Бугриев, Жилмостных, Маляров\nОП: Каптилович\nПЗ: Камилов, Немченко\nАтака: Караев, Рубцов\nНап: Калмыков',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Spartak_Kostroma_Logo_2022.svg?width=64', xgf:1.18, xga:1.05, mod:1},
  {name:'Челябинск',       color:'#1f5fa8', coach:'Пилипчук',    formation:'4-4-2',   tactic:'средний блок, переходы через фланги',
   lineup:'Вр: Ломаев\nЗащ: Гатин, Кочиев, Лысцов, Лыстцов\nПЗ: Гаджимурадов, Кертанов\nПЗ: Левин, Мирошниченко\nНап: Урванцев, Качорри',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Chelyabinsk_Logo.svg?width=64', xgf:1.12, xga:1.10, mod:1},
  {name:'Текстильщик',     color:'#2f4f4f', coach:'Талалаев',    formation:'4-4-2',   tactic:'прямой футбол, борьба',
   lineup:'Вр: Волков\nЗащ: Гапечкин, Гузиев, Крутовских, Иванников\nПЗ: Першин, Никитин\nПЗ: Симонов, Ищенко\nНап: Джебов, Помалюк',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/Эмблема_ФК_Текстильщик_Иваново_2008.svg?width=64', xgf:1.10, xga:1.15, mod:1},
  {name:'Уфа',             color:'#00695c', coach:'Тетрадзе',    formation:'4-2-3-1', tactic:'низкий блок, контратаки',
   lineup:'Вр: Беленов\nЗащ: Агапов, Гилязетдинов, Кутин, Черов\nОП: Тарба\nПЗ: Липовой, Исаев\nАтака: Агеян, Якуев\nНап: Гонгадзе',
   logo:'https://commons.wikimedia.org/wiki/Special:FilePath/FC_Ufa_logo.svg?width=64', xgf:1.00, xga:1.12, mod:1},
  {name:'Енисей',          color:'#1b4f9c', coach:'Ташуев',      formation:'4-2-3-1', tactic:'высокая физика, борьба на втором этаже',
   lineup:'Вр: Опарин\nЗащ: Масловский, Цес, Богатырев, Гюрджан\nОП: Кокоев\nПЗ: Канаплин, Иванов\nАтака: Чуканов, Шершов\nНап: Окладников',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Yenisey_Logo.svg?width=64', xgf:1.02, xga:1.05, mod:1},
  {name:'Ленинградец',     color:'#003087', coach:'Евсеев',      formation:'4-2-3-1', tactic:'компактность, переходы',
   lineup:'Вр: Смирнов\nЗащ: Кудрявцев, Грибакин, Исаев, Ботака\nОП: Морозов\nПЗ: Родин, Школик\nАтака: Бачинский, Яковлев\nНап: Першин',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Leningradets_Logo.svg?width=64', xgf:1.08, xga:1.06, mod:1},
  {name:'Нефтехимик',      color:'#0d47a1', coach:'Новиков',     formation:'4-2-3-1', tactic:'сбалансированный футбол, средний блок',
   lineup:'Вр: Исмагилов\nЗащ: Мусалов, Печенкин, Кахидзе, Платонов\nОП: Васильев\nПЗ: Шарифуллин, Тешкин\nАтака: Ситдиков, Сухомлинов\nНап: Машуков',
   logo:'https://en.wikipedia.org/wiki/Special:FilePath/Neftekhimik_Nizhnekamsk_logo.png?width=64', xgf:1.06, xga:1.08, mod:1},
  {name:'Велес',           color:'#0a3d62', coach:'Беззубов',    formation:'4-2-3-1', tactic:'позиционное владение, средний блок',
   lineup:'Вр: Купцов\nЗащ: Калинин, Магаль, Скворцов, Магомедов\nОП: Осипов\nПЗ: Кучугура, Завезён\nАтака: Тарасенко, Игнатов\nНап: Гираев',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_Veles_Logo.svg?width=64', xgf:1.15, xga:1.22, mod:1},
  {name:'Волга Ульяновск', color:'#1565c0', coach:'Белов',       formation:'4-4-2',   tactic:'компактность, борьба, стандарты',
   lineup:'Вр: Шакеров\nЗащ: Ибрагимов, Костин, Степанов, Дзиов\nПЗ: Саплинов, Фольмер\nПЗ: Никитин, Шагиахметов\nНап: Багателия, Хашкулов',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/Volga_Ulyanovsk_Logo.svg?width=64', xgf:1.02, xga:1.20, mod:1},
  {name:'СКА-Хабаровск',   color:'#b71c3c', coach:'Семёнов',     formation:'4-2-3-1', tactic:'вертикальный футбол, стандарты',
   lineup:'Вр: Штепа\nЗащ: Жиров, Савичев, Гребёнкин, Чирков\nОП: Багиев\nПЗ: Блиев, Горелишвили\nАтака: Моцпан, Маркитесов\nНап: Максимов',
   logo:'https://ru.wikipedia.org/wiki/Special:FilePath/FC_SKA-Khabarovsk_Logo.svg?width=64', xgf:1.00, xga:1.18, mod:1}
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