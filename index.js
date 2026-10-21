// 由用户提供的更新版压缩页面还原；恢复命名和结构，保留原运行规则。
/**
 * 错误提示音。保留附件内嵌音频，避免新增音频文件依赖。
 */
const beep = new Audio(
  "data:audio/mpeg;base64,//NExAASObKIDUBAAiAx///y7vegoDcPz2FAaAsDwaCgFgeGIieiJX////7v//CECgoKUWDcBQBQPKLBuDcXsTwfB8uf4IOWf+XB/BN4IHPDH//4kDCgAAAADYNtp65AuRxux////+f/80LEEhkL0uJfgWgCNutR/shrUFcFxJF0TIMxzGcIom0oG5KoqcupPp0767qWks1SFoU/5Jf1ia5qcUutFT1Mqz6l22qf1db3H4s0v/iyEht/9x0//9P//+gXv//6j1UCMjAliFTd1pL/80DECRVDRpR1wJgDk0lOizIJoGM0ATEFQjKk8TSC3QTdDfXv+jbV9mugnQSuccmwMDARiFnG5uboIv/dl6711f+r9LUzLDA4yKLf/VW3////a7OYiPxkWALSHAEJAupdSaBskbF0fP/zQsQPF2tKtH4DTv7UutToqL4TUOapkqI7is0PoropLQPl0ySoaadBNX/2UtklJGJgCvCfGZ5JSbK/nLf3ZKofZ1RWf/as0RWS3+6mTlY5THY1Pv//0mjYKhxyD04F4P////R61tNTqP/zQMQNFtNGjFVBaAKjqdSTJvYepKDyrRZzIvF1KpFlomD9l3dWtkfWjXalTZUtMwrQdpJMcWvq+/7LZ1JPX2U61spLdlJLOMMCasYos/qdBM1o7////9TrRWeqAI+lkkUXgAGl//////NCxAwXmmqAXYGIAKH1IGJg6BxqkoiAd8unYzQWHB6yi+YkBpJJGa3nFPWgz1t0VLnHHyUQHEfZcTUTx0mRzgIwTmSOtFFai9Z1GSlJGzpmVaaSl62sfZv/8vHkXfK1AWgBfIhCzCGY//NAxAkOoNnphcEYAkOIT5+L4x+q9VS4zFszdCgIFBVQd/VKnRKdg1/UDSg6vkYKwVljysS///9R5QdgqsFVTEFNRTMuOTkuM1VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=",
);
const queryElement = (selector) =>
  selector ? document.querySelector(selector) : null;
const setDomText = (element, text) =>
  element ? (element.textContent = String(text)) : null;
const setDomStyle = (element, property, value) =>
  element ? (element.style[property] = value) : null;
const bindEvent = (element, eventType, handler) =>
  element.addEventListener(eventType, handler);
const setStorage = (key, value) =>
  localStorage.setItem(
    key,
    typeof value == "object" ? JSON.stringify(value) : value,
  );
const formatTime = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const formatPercentage = (value, total) =>
  total ? ((value / total) * 100).toFixed(1) + "%" : "100%";
const formatSpeed = (characters, seconds) =>
  seconds ? Math.round((characters / seconds) * 60) : "0";
let dictionaryCatalog = {};

const partsOfSpeech = {
  "n.": "名",
  "adj.": "形容",
  "v.": "动",
  "adv.": "副",
  "pron.": "代",
  "prep.": "介",
  "conj.": "连",
  "art.": "冠",
  "aux.": "助动",
  "num.": "数",
  "pl.": "复数",
  "abbr.": "缩写",
  "vt.": "及物动词",
};
/**
 * 持久化设置。键名沿用线上版本，以兼容原来的 localStorage 数据。
 * 注意：附件的布尔默认值表达式存在问题，详见 docs/RESTORATION.md；本次保留行为。
 */
const config = {
  unit_isShuffled: localStorage.getItem("unit_isShuffled") === "true" ?? true,
  display_hideLastWord:
    localStorage.getItem("display_hideLastWord") === "true" ?? false,
  display_hideParaphrase:
    localStorage.getItem("display_hideParaphrase") === "true" ?? false,
  capitalize_words:
    localStorage.getItem("capitalize_words") === "true" ?? false,
  enable_animations:
    localStorage.getItem("enable_animations") === "true" ?? false,
  unit_loopCount: Number(localStorage.getItem("unit_loopCount") ?? "1"),
  voice_enableParaphrase:
    localStorage.getItem("voice_enableParaphrase") === "true" ?? true,
  voice_type: localStorage.getItem("voice_type") ?? "Xiaoxiao",
  voice_loop: Number(localStorage.getItem("voice_loop") ?? "2"),
  voice_rate: Number(localStorage.getItem("voice_rate") ?? "2.0"),
  dict_current: localStorage.getItem("dict_current") ?? "basic",
  dict_progress: JSON.parse(
    localStorage.getItem("dict_progress") ?? '{"basic":1,"cet4":1}',
  ),
  darkMode: localStorage.getItem("darkMode") === "true" ?? false,
  knownWords: JSON.parse(localStorage.getItem("knownWords") ?? "[]"),
  unKnownWords: JSON.parse(
    localStorage.getItem("unKnownWords") ?? '{"basic":[],"cet4":[]}',
  ),
  practiceRecords: JSON.parse(localStorage.getItem("practiceRecords") ?? "{}"),
};
/**
 * 设置代理：属性赋值时同步 localStorage 和 data-bind 控件。
 * 修改嵌套数组或对象不会触发这里，需要显式调用 setStorage。
 */
const settings = new Proxy(config, {
  set: (target, property, value) => {
    target[property] = value;
    setStorage(property, value);
    document
      .querySelectorAll(`[data-bind="${property}"]`)
      .forEach((element) => {
        if (element.tagName === "INPUT") {
          if (element.type === "checkbox") {
            element.checked = value;
          } else {
            element.value = value;
          }
        } else {
          if (element.tagName === "SELECT") {
            element.value = value;
          } else {
            element.textContent = value;
          }
        }
      });
    return true;
  },
});
/**
 * 练习流程状态。附件每轮 20 词；页面帮助文案仍写 25 词。
 */
const gameState = {
  isDone: true,
  isHidden: false,
  isReview: false,
  timer: null,
  wordsPerRound: 20,
};
/**
 * 当前词典、练习队列、单词元素和预加载音频。
 * correctWords 保存隐藏复习中每个词的累计答对次数，并非连续正确次数。
 */
const wordState = {
  dict: {},
  selectedWords: [],
  wordElements: null,
  currentWord: "",
  currWordEl: null,
  wordIndex: 0,
  currentSound: null,
  nextSound: null,
  correctWords: {},
};
/**
 * 统计口径沿用附件：correct 是正确字符数，done 是完成单词数，typed 是当前词已输入字符数。
 */
const stats = {
  typed: 0,
  correct: 0,
  errors: "",
  done: 0,
  failed: 0,
  time: 0,
  typos: 0,
};
/**
 * 集中保存页面元素引用，选择器与 index.html 对应。
 */
const dom = {
  darkMode: queryElement(".dark-mode-toggle"),
  dictProgress: queryElement(".learning-progress"),
  diffMenu: queryElement(".difficulty-dropdown"),
  levelNum: queryElement(".level-display"),
  hideToggle: queryElement(".hide-word-toggle"),
  helpBtn: queryElement(".help-button"),
  reviewToggle: queryElement(".review-mode-toggle"),
  restartBtn: queryElement(".restart-button"),
  statisticsBtn: queryElement(".statistics-button"),
  errText: queryElement(".error-text"),
  wordList: queryElement(".word-slider"),
  paraphrase: queryElement(".paraphrase"),
  levelVal: queryElement(".level-text"),
  speedVal: queryElement(".speed-text"),
  correctVal: queryElement(".correct-text"),
  errWordVal: queryElement(".error-word-text"),
  rateVal: queryElement(".correctrate-text"),
  timeVal: queryElement(".time-text"),
  startHint: queryElement(".start-prompt"),
  setupToggle: queryElement(".difficulty-toggle"),
  progress: queryElement(".progress-bar"),
  helpModal: queryElement(".help-overlay"),
  helpClose: queryElement(".help-close"),
  dictLabel: queryElement(".current-dict-name"),
  dictSelector: queryElement(".dict-selector"),
  dictDropdown: queryElement(".dictionary-dropdown"),
  dictOptions: queryElement(".dictionary-option"),
  soundToggle: queryElement(".sound-toggle"),
  soundMenu: queryElement(".sound-dropdown"),
  unitLoopSlider: queryElement(".word-loop-slider"),
  unitLoopValue: queryElement(".word-loop-value"),
  unitIsShuffled: queryElement(".shuffled-words-toggle"),
  soundLoopSlider: queryElement(".sound-loop-slider"),
  soundLoopValue: queryElement(".sound-loop-value"),
  voiceSelect: queryElement(".voice-select"),
  rateSlider: queryElement(".rate-slider"),
  rateValue: queryElement(".rate-value"),
  lastWordHidden: queryElement(".last-word-hidden"),
  displayHideParaphrase: queryElement(".paraphrase-hidden"),
  capitalizeWords: queryElement(".capitalize-words"),
  enableAnimations: queryElement(".enable-animations"),
  voiceEnableParaphrase: queryElement(".paraphrase-voice-toggle"),
  calendarOverlay: queryElement(".calendar-overlay"),
  calendarClose: queryElement(".calendar-close"),
  fireworksCanvas: queryElement(".fireworks"),
  calendarsContainer: queryElement("#calendarsContainer"),
};
const ttsMessage = new SpeechSynthesisUtterance();
const audioCache = new Map();
/**
 * 有道单词发音缓存与浏览器中文释义朗读。
 * 播放结束、取消与并发问题属于原逻辑，详见还原说明。
 */
const audio = {
  create: (word) => {
    if (audioCache.has(word)) {
      return audioCache.get(word);
    }
    const sound = new Audio(
      "https://dict.youdao.com/dictvoice?type=0&audio=" + word,
    );
    sound.load();
    audioCache.set(word, sound);
    return sound;
  },
  playAudio: async (sound, repeatCount = 2) => {
    for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex++) {
      await sound.play();
      await new Promise((resolve) => (sound.onended = resolve));
      sound.currentTime = 0;
    }
  },
  stop: (sound) => {
    if (sound) {
      sound.pause();
      sound.currentTime = 0;
    }
    speechSynthesis.cancel();
  },
  speak: (text) => {
    const cleanText = text
      .replace(/[a-z]+\./g, "")
      .replace(/&/g, "")
      .split(/[;,]/)
      .filter((item, index, items) => items.indexOf(item) === index)
      .join(";");
    ttsMessage.text = cleanText;
    ttsMessage.voice = speechSynthesis
      .getVoices()
      .find((voice) => voice.name.includes(settings.voice_type));
    ttsMessage.rate = settings.voice_rate;
    speechSynthesis.speak(ttsMessage);
    speechSynthesis.pause();
  },
  playWordAndMeaning: async (sound, meaning) => {
    if (settings.voice_enableParaphrase) {
      audio.speak(meaning);
    }
    await audio.playAudio(sound, settings.voice_loop);
    if (settings.voice_enableParaphrase) {
      speechSynthesis.resume();
    }
  },
};
/**
 * 加载仓库已有的 JSON 词典；大写转换仍按附件在加载词典时执行。
 */
async function switchDictionary(dictionaryType) {
  if (gameState.isReview) {
    toggleReviewMode();
  }
  document
    .querySelectorAll(".dictionary-option")
    .forEach((option) => option.classList.remove("active"));
  settings.dict_current = dictionaryType;
  if (!settings.unKnownWords[dictionaryType]) {
    settings.unKnownWords = { ...settings.unKnownWords, [dictionaryType]: [] };
  }
  if (!settings.dict_progress[dictionaryType]) {
    settings.dict_progress = { ...settings.dict_progress, [dictionaryType]: 1 };
  }
  queryElement(
    `.dictionary-option[data-type="${dictionaryType}"]`,
  ).classList.add("active");
  setDomText(dom.dictLabel, dictionaryCatalog[dictionaryType].name);
  try {
    const response = await fetch(dictionaryCatalog[dictionaryType].url);
    wordState.dict = await response.json();
    if (settings.capitalize_words) {
      const uppercaseDictionary = {};
      for (const word in wordState.dict) {
        if (wordState.dict.hasOwnProperty(word)) {
          uppercaseDictionary[word.toUpperCase()] = wordState.dict[word];
        }
      }
      wordState.dict = uppercaseDictionary;
    }
    const currentLevel = settings.dict_progress[dictionaryType] || 1;
    const maxLevel = Math.ceil(
      Object.keys(wordState.dict).length / gameState.wordsPerRound,
    );
    dom.dictProgress.max = maxLevel;
    dom.dictProgress.value = currentLevel;
    setDomText(dom.levelNum, currentLevel);
    setDomText(dom.levelVal, currentLevel);
    if (dom.startHint.style.display === "none") {
      startPractice();
    }
  } catch (error) {
    setDomText(dom.errText, "加载词典失败");
  }
}
/**
 * 按当前进度截取词典，应用重复次数、错词复习和乱序规则。
 * 特殊隐藏模式会插入上一个单词的模糊副本，顺序保持与附件一致。
 */
function initializeWords(level) {
  const dictionaryType = settings.dict_current;
  let selectedWords;
  let wordBank = gameState.isReview
    ? settings.unKnownWords[dictionaryType]
    : Object.keys(wordState.dict);
  if (gameState.isReview) {
    selectedWords = wordBank.flatMap((word) =>
      Array(settings.unit_loopCount).fill(word),
    );
  } else {
    const startIndex = (level - 1) * gameState.wordsPerRound;
    selectedWords = wordBank.slice(
      startIndex,
      startIndex + gameState.wordsPerRound,
    );
    if (settings.display_hideLastWord && settings.unit_loopCount >= 3) {
      const visibleRepeats = settings.unit_loopCount - 1;
      let practiceWords = [];
      let previousWord = "";
      for (let wordIndex = 0; wordIndex < selectedWords.length; wordIndex++) {
        const word = selectedWords[wordIndex];
        for (let repeatIndex = 0; repeatIndex < visibleRepeats; repeatIndex++) {
          practiceWords.push(word);
        }
        if (wordIndex > 0) {
          practiceWords.push(previousWord);
        }
        previousWord = word;
      }
      wordState.selectedWords = practiceWords;
      setupWordList(
        buildWordListHTML(selectedWords, true, settings.unit_loopCount),
        practiceWords[0],
        practiceWords[1],
      );
      return;
    }
    selectedWords = selectedWords.flatMap((word) =>
      Array(settings.unit_loopCount).fill(word),
    );
  }
  if (settings.unit_isShuffled) {
    for (let index = selectedWords.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [selectedWords[index], selectedWords[randomIndex]] = [
        selectedWords[randomIndex],
        selectedWords[index],
      ];
    }
  }
  wordState.selectedWords = selectedWords;
  setupWordList(
    buildWordListHTML(selectedWords),
    selectedWords[0],
    selectedWords[1],
  );
}
/**
 * 将练习词序列转换为滑动列表；特殊隐藏规则与 initializeWords 配套。
 */
function buildWordListHTML(words, hidePreviousWord = false, repeatCount = 1) {
  let html = "";
  if (hidePreviousWord && repeatCount >= 3) {
    let previousWord = "";
    for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
      const word = words[wordIndex];
      for (let repeatIndex = 0; repeatIndex < repeatCount - 1; repeatIndex++) {
        html += `<div class="word" data-word="${word}">${word}</div>`;
      }
      if (wordIndex > 0) {
        html += `<div class="word hidden-text" data-word="${previousWord}">${previousWord}</div>`;
      }
      previousWord = word;
    }
  } else {
    words.forEach((word) => {
      html += `<div class="word" data-word="${word}">${word}</div>`;
    });
  }
  return html;
}
/**
 * 更新单词列表，并预加载当前词和下一词的音频。
 */
function setupWordList(html, currentWord, nextWord) {
  dom.wordList.innerHTML = html;
  dom.wordList.querySelector(".word").classList.add("active");
  wordState.wordElements = dom.wordList.querySelectorAll(".word");
  dom.wordList.style.transform = "translateX(266px)";
  if (gameState.isHidden) {
    wordState.wordElements.forEach((element) =>
      element.classList.add("hidden-text"),
    );
  }
  wordState.currentWord = currentWord;
  wordState.currentSound = audio.create(currentWord);
  wordState.nextSound = nextWord ? audio.create(nextWord) : null;
}
/**
 * 重置本轮状态和界面，生成词序列，然后开始计时。
 */
function startPractice() {
  audio.stop(wordState.currentSound);
  clearInterval(gameState.timer);
  gameState.isDone = false;
  Object.assign(stats, {
    time: 0,
    correct: 0,
    typed: 0,
    done: 0,
    failed: 0,
    errors: "",
  });
  wordState.selectedWords = [];
  wordState.wordIndex = 0;
  const level = gameState.isReview
    ? 0
    : settings.dict_progress[settings.dict_current];
  dom.dictProgress.value = level;
  initializeWords(level);
  setDomText(dom.levelNum, gameState.isReview ? "正在复习模式" : level);
  setDomText(dom.levelVal, level);
  setDomText(dom.timeVal, "00:00");
  setDomText(dom.speedVal, "0");
  setDomText(dom.correctVal, "0");
  setDomText(dom.errWordVal, "0");
  setDomText(dom.rateVal, "100%");
  setDomText(dom.errText, "");
  setDomStyle(dom.progress, "width", "0%");
  dom.dictProgress.style.display = gameState.isReview ? "none" : "block";
  dom.startHint.style.display = "none";
  updateWord();
  gameState.timer = setInterval(updateTimer, 1000);
}
/**
 * 每秒更新用时和每分钟正确字符数。
 */
function updateTimer() {
  if (!gameState.isDone) {
    stats.time++;
    setDomText(dom.timeVal, formatTime(stats.time));
    setDomText(dom.speedVal, formatSpeed(stats.correct, stats.time));
  }
}
/**
 * 显示当前单词与词性释义，并切换音频。
 */
function updateWord() {
  const index = wordState.wordIndex;
  const offset = 266 * -index + 266;
  const word = wordState.selectedWords[index];
  const meaning = wordState.dict[word];
  const wordChanged = index === 0 || word !== wordState.currentWord;
  if (wordChanged) audio.stop(wordState.currentSound);
  stats.typed = stats.typos = 0;
  wordState.currentWord = word;
  dom.wordList.style.transform = `translateX(${offset}px)`;
  wordState.currWordEl = wordState.wordElements[index];
  dom.paraphrase.innerHTML = highlightPartsOfSpeech(meaning);
  if (index > 0) {
    wordState.wordElements[index - 1].classList.remove("active");
    wordState.wordElements[index].classList.add("active");
  }
  if (wordChanged) {
    wordState.currentSound = audio.create(word);
    audio.playWordAndMeaning(wordState.currentSound, meaning);
  }
}
/**
 * 把释义中的词性缩写替换为标签，保留附件的正则匹配规则。
 */
function highlightPartsOfSpeech(text) {
  if (!text) {
    return "";
  }
  const pattern = new RegExp(`(${Object.keys(partsOfSpeech).join("|")})`, "g");
  return text
    .replace(/&/g, "")
    .replace(
      pattern,
      (match) =>
        `<span class="part-speech" title="${match}">${partsOfSpeech[match] || match}</span>`,
    );
}
/**
 * 按字符校验输入；当前词累计错 5 次后自动跳过。
 */
function checkTyping(key) {
  if (gameState.isDone) {
    return;
  }
  const currentWord = wordState.currentWord;
  const expectedCharacter = currentWord.charAt(stats.typed).toUpperCase();
  if (expectedCharacter === key) {
    stats.correct++;
    stats.typed++;
    setDomText(dom.errText, "");
    const html = stats.typed
      ? `${currentWord.substring(0, stats.typed)}</span>${currentWord.substring(stats.typed)}`
      : currentWord;
    wordState.currWordEl.innerHTML =
      '<span class="typed">' + html.replace(" ", "&nbsp;");
    if (stats.typed === currentWord.length) {
      stats.done++;
      // 保留附件规则：隐藏复习中累计答对超过 3 次才移出错词库。
      if (gameState.isReview && gameState.isHidden) {
        wordState.correctWords[currentWord] =
          (wordState.correctWords[currentWord] || 0) + 1;
      }
      if (
        gameState.isReview &&
        gameState.isHidden &&
        wordState.correctWords[currentWord] > 3
      ) {
        const dictionaryType = settings.dict_current;
        settings.unKnownWords[dictionaryType] = settings.unKnownWords[
          dictionaryType
        ].filter((word) => word !== currentWord);
        setStorage("unKnownWords", settings.unKnownWords);
        setDomText(dom.errText, "已掌握单词：" + currentWord);
        setTimeout(() => {
          setDomText(dom.errText, "");
          nextWord();
        }, 1000);
        return;
      }
      nextWord();
      if (settings.enable_animations) {
        showFireworks(config.darkMode, 2);
      }
    }
  } else {
    stats.errors += expectedCharacter;
    stats.typos++;
    setDomText(dom.errText, "按键错误: " + key);
    beep.play();
    if (stats.typos > 4) {
      skipWord();
      stats.failed++;
    }
  }
  updateStats();
}
/**
 * 刷新正确率、单词计数和本轮进度条。
 */
function updateStats() {
  const totalCharacters = stats.correct + stats.errors.length;
  setDomText(dom.speedVal, formatSpeed(stats.correct, stats.time));
  setDomText(dom.correctVal, stats.done);
  setDomText(dom.errWordVal, stats.failed);
  setDomText(dom.rateVal, formatPercentage(stats.correct, totalCharacters));
  setDomStyle(
    dom.progress,
    "width",
    ((stats.done + stats.failed) / wordState.selectedWords.length) * 100 + "%",
  );
}
/**
 * 推进到下一词；最后一词结束后记录本轮。
 */
function nextWord() {
  if (wordState.wordIndex + 1 === wordState.selectedWords.length) {
    if (gameState.isReview && settings.unKnownWords.basic.length === 0) {
      setDomText(dom.errText, "恭喜！所有未掌握单词已完成练习！");
      gameState.isReview = false;
      dom.reviewToggle.textContent = "🎯";
    }
    return completePractice();
  }
  wordState.wordIndex++;
  updateWord();
}
/**
 * 保留附件行为：若已是最后一词，直接结束，不再加入错词库。
 */
function skipWord() {
  if (wordState.wordIndex + 1 >= wordState.selectedWords.length) {
    return completePractice();
  }
  const skippedWord = wordState.selectedWords[wordState.wordIndex];
  const dictionaryType = settings.dict_current;
  if (!settings.unKnownWords[dictionaryType].includes(skippedWord)) {
    settings.unKnownWords[dictionaryType].push(skippedWord);
    setStorage("unKnownWords", settings.unKnownWords);
  }
  setDomText(dom.errText, `单词 ${skippedWord} 已标记为未掌握`);
  wordState.wordIndex++;
  updateWord();
}
/**
 * 返回上一词，并按附件递减完成计数。
 */
function goBackWord() {
  const index = wordState.wordIndex;
  if (index != 0) {
    wordState.wordIndex--;
    wordState.wordElements[index - 1].classList.add("active");
    wordState.wordElements[index].classList.remove("active");
    stats.done--;
    updateWord();
  }
}
/**
 * 记录统计，并在两秒后开始下一进度。
 */
function completePractice() {
  audio.stop(wordState.currentSound);
  gameState.isDone = true;
  clearInterval(gameState.timer);
  practiceCalendar.recordPractice();
  setDomText(dom.errText, "练习完成！");
  setDomStyle(dom.errText, "color", "var(--primary-color)");
  setDomStyle(dom.progress, "width", "100%");
  setTimeout(() => {
    setDomStyle(dom.errText, "color", "var(--error-color)");
    changeProgress(1);
  }, 2000);
}
/**
 * 近六个月练习日历，读取和写入 practiceRecords。日期键沿用本地日期 YYYY-M-D。
 */
const practiceCalendar = {
  init() {
    renderCalendar(dom.calendarsContainer, settings.practiceRecords);
  },
  _calculatePracticeStats(records) {
    const totals = {
      totalDuration: 0,
      totalWords: 0,
      totalCorrect: 0,
      avgAccuracy: 0,
      avgSpeed: 0,
    };
    if (!records || records.length === 0) {
      return {
        totalDuration: 0,
        totalWords: 0,
        totalCorrect: 0,
        avgAccuracy: 0,
        avgSpeed: 0,
        count: 0,
      };
    }
    records.forEach((record) => {
      totals.totalDuration += record.duration || 0;
      totals.totalWords += record.totalWords || 0;
      totals.totalCorrect += record.correctWords || 0;
      totals.avgAccuracy += record.accuracy || 0;
      totals.avgSpeed += record.typingSpeed || 0;
    });
    const count = records.length;
    if (count > 0) {
      totals.avgAccuracy = ((totals.avgAccuracy / count) * 100).toFixed(1);
      totals.avgSpeed = Math.round(totals.avgSpeed / count);
    } else {
      totals.avgAccuracy = 0;
      totals.avgSpeed = 0;
    }
    totals.count = count;
    return totals;
  },
  recordPractice() {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    if (!(dom && stats && wordState && gameState && settings && setStorage)) {
      console.error("Dependencies not fully available for recording practice.");
      return;
    }
    if (!settings.practiceRecords) {
      settings.practiceRecords = {};
    }
    if (!settings.practiceRecords[dateKey]) {
      settings.practiceRecords[dateKey] = {
        records: [],
        stats: undefined,
      };
    }
    const record = {
      timestamp: Date.now(),
      duration: stats.time || 0,
      dictionary: settings.dict_current,
      level: settings.dict_progress
        ? settings.dict_progress[settings.dict_current]
        : undefined,
      totalWords: wordState.selectedWords ? wordState.selectedWords.length : 0,
      correctWords: stats.done || 0,
      failedWords: stats.failed || 0,
      accuracy:
        undefined !== stats.correct &&
        undefined !== stats.errors &&
        stats.correct + stats.errors.length > 0
          ? stats.correct / (stats.correct + stats.errors.length)
          : 0,
      isHidden: gameState.isHidden,
      wordRepeat: settings.unit_loopCount,
      typingSpeed:
        undefined !== stats.correct && stats.time > 0
          ? (stats.correct / stats.time) * 60
          : 0,
      errorRate:
        undefined !== stats.errors &&
        undefined !== stats.typed &&
        stats.typed > 0
          ? stats.errors.length / stats.typed
          : 0,
      isReviewMode: gameState.isReview,
      hideLastWord: settings.display_hideLastWord,
      shuffled: settings.unit_isShuffled,
    };
    try {
      settings.practiceRecords[dateKey].records.push(record);
      settings.practiceRecords[dateKey].stats = this._calculatePracticeStats(
        settings.practiceRecords[dateKey].records,
      );
      setStorage("practiceRecords", settings.practiceRecords);
    } catch (error) {
      console.error("Failed to record practice:", error);
      if (
        settings.practiceRecords[dateKey] &&
        settings.practiceRecords[dateKey].records.length > 0
      ) {
        settings.practiceRecords[dateKey].records.pop();
        settings.practiceRecords[dateKey].stats = this._calculatePracticeStats(
          settings.practiceRecords[dateKey].records,
        );
      }
    }
  },
};
/**
 * 完成单词时的烟花粒子动画。参数分别为深色主题和烟花数量。
 */
const fireworks = { particles: [], frame: null };
function showFireworks(isDarkMode, burstCount = 3) {
  const canvas = dom.fireworksCanvas;
  const context = canvas?.getContext("2d");
  if (!context) return;
  const width = window.innerWidth, height = window.innerHeight;
  const pixelRatio = window.devicePixelRatio || 1;
  if (canvas.width !== width * pixelRatio || canvas.height !== height * pixelRatio) {
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    context.scale(pixelRatio, pixelRatio);
  }
  canvas.style.zIndex = -1;
  const random = (min, max) => min + Math.random() * (max - min);
  for (let burst = 0; burst < burstCount; burst++) {
    const x = width * random(0.3, 0.7) + random(-50, 50);
    const y = height * random(0.2, 0.4) + random(-50, 50);
    const hue = Math.floor(random(0, 361));
    for (let index = 0; index < 300; index++) {
      fireworks.particles.push({
        x, y, angle: random(0, Math.PI * 2), velocity: random(2, 16),
        size: random(2, 5), hue: (hue + Math.floor(random(0, 81)) + 320) % 360,
        brightness: Math.floor(isDarkMode ? random(60, 101) : random(20, 51)),
        alpha: random(0.4, 1),
      });
    }
  }
  if (fireworks.frame !== null) return;
  function animate() {
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = "rgba(0, 0, 0, 0.2)";
    context.fillRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);
    context.globalCompositeOperation = "lighter";
    fireworks.particles = fireworks.particles.filter(particle => {
      particle.x += Math.cos(particle.angle) * particle.velocity;
      particle.y += Math.sin(particle.angle) * particle.velocity + 1;
      particle.velocity *= 0.92;
      particle.alpha -= 0.015;
      if (particle.alpha <= 0.015 || particle.velocity <= 0.1) return false;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size / 2, 0, Math.PI * 2);
      context.fillStyle = `hsla(${particle.hue}, 100%, ${particle.brightness}%, ${particle.alpha})`;
      context.fill();
      return true;
    });
    fireworks.frame = fireworks.particles.length ? requestAnimationFrame(animate) : null;
    if (fireworks.frame === null) context.clearRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);
  }
  fireworks.frame = requestAnimationFrame(animate);
}
/**
 * 按钮事件回调依赖 this 指向按钮；保留普通函数以维持调用语义。
 */
function toggleDarkMode() {
  settings.darkMode = !settings.darkMode;
  document.body.classList.toggle("dark-mode", settings.darkMode);
  dom.darkMode.textContent = settings.darkMode ? "☀️" : "🌙";
  this.blur();
}
/**
 * 调整当前词典的进度，并重新开始。
 */
function changeProgress(change = 0) {
  const newLevel = Math.min(
    Math.max(Number(dom.dictProgress.value) + change, 1),
    Number(dom.dictProgress.max),
  );
  settings.dict_progress = {
    ...settings.dict_progress,
    [settings.dict_current]: newLevel,
  };
  dom.diffMenu.classList.remove("visible");
  startPractice();
}
/**
 * 切换听音拼写模式，同时关闭交错隐藏和多次重复。
 */
function toggleHideWord() {
  if (gameState.isDone) {
    startPractice();
  }
  gameState.isHidden = !gameState.isHidden;
  dom.hideToggle.textContent = gameState.isHidden ? "👀" : "🙈";
  settings.display_hideLastWord = false;
  settings.unit_loopCount = 1;
  wordState.wordElements.forEach((element) =>
    element.classList.toggle("hidden-text", gameState.isHidden),
  );
}
/**
 * 复习当前词典的错词。保留附件 this.blur() 的调用方式。
 */
function toggleReviewMode() {
  const dictionaryType = settings.dict_current;
  if (
    !settings.unKnownWords[dictionaryType] ||
    settings.unKnownWords[dictionaryType].length === 0
  ) {
    setDomText(
      dom.errText,
      `当前字典(${dictionaryType})没有未掌握的单词,请继续练习`,
    );
    dom.reviewToggle.textContent = "🎯";
    return;
  }
  this.blur();
  gameState.isReview = !gameState.isReview;
  dom.reviewToggle.textContent = gameState.isReview ? "📚" : "🎯";
  dom.dictProgress.style.display = gameState.isReview ? "none" : "block";
  startPractice();
}
/**
 * 清空当前词典的错词记录。
 */
function clearUnknownWords() {
  const dictionaryType = settings.dict_current;
  settings.unKnownWords[dictionaryType] = [];
  setStorage("unKnownWords", settings.unKnownWords);
  setDomText(dom.errText, `已清除当前字典(${dictionaryType})未掌握单词`);
}
/**
 * 把当前词记入已掌握列表，并移除本轮队列里的同词副本。
 */
function markWordKnown() {
  if (gameState.isDone) {
    return;
  }
  const currentWord = wordState.currentWord;
  const oldIndex = wordState.wordIndex;
  settings.knownWords.push(currentWord);
  setStorage("knownWords", settings.knownWords);
  setDomText(dom.errText, "已掌握单词：" + currentWord);
  audio.stop(wordState.currentSound);
  const removedBeforeIndex = wordState.selectedWords
    .slice(0, oldIndex)
    .filter((word) => word === currentWord).length;
  wordState.selectedWords = wordState.selectedWords.filter(
    (word) => word !== currentWord,
  );
  wordState.wordIndex = Math.max(0, oldIndex - removedBeforeIndex);
  if (wordState.wordIndex >= wordState.selectedWords.length) {
    return completePractice();
  }
  dom.wordList
    .querySelectorAll(`.word[data-word="${currentWord}"]`)
    .forEach((element) => element.remove());
  wordState.wordElements = dom.wordList.querySelectorAll(".word");
  updateWord();
}
/**
 * 从设置填充 data-bind 控件，并绑定输入值的持久化事件。
 */
function bindConfigToDOM() {
  document.querySelectorAll("[data-bind]").forEach((element) => {
    const property = element.getAttribute("data-bind");
    const value = config[property];
    if (element.tagName === "INPUT") {
      if (element.type === "checkbox") {
        element.checked = value;
      } else {
        if (element.type === "range") {
          element.value = value;
          element.addEventListener("input", function () {
            settings[property] = parseFloat(this.value);
          });
        } else {
          element.value = value;
          element.addEventListener("input", function () {
            settings[property] = this.value;
          });
        }
      }
    } else {
      if (element.tagName === "SELECT") {
        element.value = value;
        element.addEventListener("change", function () {
          settings[property] = this.value;
        });
      } else {
        element.textContent = value;
      }
    }
  });
}
/**
 * 集中绑定点击与设置变更事件。
 */
function setupEventListeners() {
  const eventHandlers = {
    click: {
      darkMode: toggleDarkMode,
      reviewToggle: toggleReviewMode,
      hideToggle: toggleHideWord,
      restartBtn: startPractice,
      startHint: startPractice,
      helpBtn: () => (dom.helpModal.style.display = "flex"),
      helpClose: () => (dom.helpModal.style.display = "none"),
      setupToggle: (event) => {
        event.stopPropagation();
        dom.diffMenu.classList.toggle("visible");
        dom.soundMenu.classList.remove("visible");
        dom.dictDropdown.classList.remove("visible");
      },
      soundToggle: (event) => {
        event.stopPropagation();
        dom.soundMenu.classList.toggle("visible");
        dom.diffMenu.classList.remove("visible");
        dom.dictDropdown.classList.remove("visible");
      },
      dictSelector: (event) => {
        event.stopPropagation();
        dom.dictDropdown.classList.toggle("visible");
        dom.diffMenu.classList.remove("visible");
        dom.soundMenu.classList.remove("visible");
      },
      statisticsBtn: () => {
        practiceCalendar.init();
        dom.calendarOverlay.showModal();
      },
    },
    change: {
      unitLoopSlider: function () {
        const repeatCount = Number(this.value);
        settings.unit_loopCount = repeatCount;
        if (repeatCount < 3 && settings.display_hideLastWord) {
          settings.display_hideLastWord = false;
        }
        startPractice();
      },
      soundLoopSlider: function () {
        settings.voice_loop = Number(this.value);
        dom.soundLoopValue.textContent = this.value;
      },
      rateSlider: function () {
        const rate = Number(this.value);
        settings.voice_rate = rate;
        ttsMessage.rate = rate;
      },
      voiceEnableParaphrase: function () {
        settings.voice_enableParaphrase = this.checked;
      },
      voiceSelect: function () {
        settings.voice_type = this.value;
      },
      unitIsShuffled: function () {
        settings.unit_isShuffled = this.checked;
        if (this.checked && settings.display_hideLastWord) {
          settings.display_hideLastWord = false;
        }
        startPractice();
      },
      displayHideParaphrase: function () {
        settings.display_hideParaphrase = this.checked;
        dom.paraphrase.classList.toggle("hidden-text", this.checked);
      },
      capitalizeWords: function () {
        settings.capitalize_words = this.checked;
        startPractice();
      },
      enableAnimations: function () {
        settings.enable_animations = this.checked;
      },
      lastWordHidden: function () {
        settings.display_hideLastWord = this.checked;
        if (this.checked) {
          settings.unit_isShuffled = false;
          if (settings.unit_loopCount < 3) {
            settings.unit_loopCount = 3;
          }
        }
        startPractice();
      },
      dictProgress: () => changeProgress(0),
    },
  };
  Object.entries(eventHandlers).forEach(([eventType, handlers]) => {
    Object.entries(handlers).forEach(([elementKey, handler]) => {
      if (dom[elementKey]) {
        bindEvent(dom[elementKey], eventType, handler);
      }
    });
  });
  bindEvent(dom.wordList, "click", (event) => {
    if (event.target.dataset.word) {
      audio.create(event.target.dataset.word).play();
    }
  });
  bindEvent(dom.dictDropdown, "click", (event) => {
    const option = event.target.closest(".dictionary-option");
    if (!option) return;
    event.stopPropagation();
    switchDictionary(option.dataset.type);
    dom.dictDropdown.classList.remove("visible");
  });
  document.querySelectorAll(".calendar-close").forEach((button) => {
    bindEvent(button, "click", () => dom.calendarOverlay.close());
  });
  bindEvent(dom.calendarsContainer, "click", (event) => {
    const day = event.target.closest("[data-date]");
    if (day) queryElement("#day-summary").textContent = day.title;
  });
  bindEvent(document, "click", (event) => {
    if (!event.target.closest(".dict-selector")) {
      dom.dictDropdown.classList.remove("visible");
    }
    if (!event.target.closest(".controls")) {
      dom.diffMenu.classList.remove("visible");
      dom.soundMenu.classList.remove("visible");
    }
  });
  bindEvent(dom.restartBtn, "click", () => {
    if (gameState.isDone) {
      practiceCalendar.recordPractice();
    }
  });
}
/**
 * 沿用附件 keyCode 快捷键；帮助中的 Shift+Esc 尚无对应实现。
 */
function setupKeyboardShortcuts() {
  const keyHandlers = {
    13: () => setDomText(dom.errText, wordState.currentWord),
    220: () => wordState.currentSound.play(),
    27: toggleHideWord,
    35: clearUnknownWords,
    39: () => gameState.isHidden && skipWord(),
    37: goBackWord,
    38: () => changeProgress(1),
    40: () => changeProgress(-1),
    192: markWordKnown,
  };
  bindEvent(document, "keydown", (event) => {
    if (dom.calendarOverlay.open) return;
    const { keyCode } = event;
    if (keyHandlers[keyCode]) {
      keyHandlers[keyCode]();
    } else {
      if ((keyCode >= 65 && keyCode <= 90) || keyCode === 32) {
        checkTyping(String.fromCharCode(keyCode));
      } else {
        if (keyCode === 222) {
          checkTyping("'");
        }
      }
    }
  });
}
/**
 * 加载所选词典，并恢复主题和语音设置。
 */
async function initializeApp() {
  document.body.classList.toggle("dark-mode", settings.darkMode);
  dom.darkMode.textContent = settings.darkMode ? "☀️" : "🌙";
  ttsMessage.lang = "zh-CN";
  ttsMessage.rate = settings.voice_rate;
  try {
    const response = await fetch("dictionaries.json");
    const catalog = await response.json();
    dictionaryCatalog = Object.fromEntries(
      catalog.map((entry) => [entry.id, entry]),
    );
    const options = catalog.map((entry) => {
      const option = document.createElement("div");
      option.className = "dictionary-option";
      option.dataset.type = entry.id;
      const heading = document.createElement("h1");
      heading.textContent = entry.name;
      const count = document.createElement("p");
      count.textContent = `${entry.count}词`;
      option.append(heading, count);
      return option;
    });
    dom.dictDropdown.replaceChildren(...options);
    await switchDictionary(
      dictionaryCatalog[settings.dict_current]
        ? settings.dict_current
        : catalog[0].id,
    );
  } catch (error) {
    setDomText(dom.errText, "加载词库目录失败");
  }
}

bindConfigToDOM();
setupEventListeners();
setupKeyboardShortcuts();
initializeApp();
