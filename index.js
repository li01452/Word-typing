const beep = new Audio("data:audio/mpeg;base64,//NExAASObKIDUBAAiAx///y7vegoDcPz2FAaAsDwaCgFgeGIieiJX////7v//CECgoKUWDcBQBQPKLBuDcXsTwfB8uf4IOWf+XB/BN4IHPDH//4kDCgAAAADYNtp65AuRxux////+f/80LEEhkL0uJfgWgCNutR/shrUFcFxJF0TIMxzGcIom0oG5KoqcupPp0767qWks1SFoU/5Jf1ia5qcUutFT1Mqz6l22qf1db3H4s0v/iyEht/9x0//9P//+gXv//6j1UCMjAliFTd1pL/80DECRVDRpR1wJgDk0lOizIJoGM0ATEFQjKk8TSC3QTdDfXv+jbV9mugnQSuccmwMDARiFnG5uboIv/dl6711f+r9LUzLDA4yKLf/VW3////a7OYiPxkWALSHAEJAupdSaBskbF0fP/zQsQPF2tKtH4DTv7UutToqL4TUOapkqI7is0PoropLQPl0ySoaadBNX/2UtklJGJgCvCfGZ5JSbK/nLf3ZKofZ1RWf/as0RWS3+6mTlY5THY1Pv//0mjYKhxyD04F4P////R61tNTqP/zQMQNFtNGjFVBaAKjqdSTJvYepKDyrRZzIvF1KpFlomD9l3dWtkfWjXalTZUtMwrQdpJMcWvq+/7LZ1JPX2U61spLdlJLOMMCasYos/qdBM1o7////9TrRWeqAI+lkkUXgAGl//////NCxAwXmmqAXYGIAKH1IGJg6BxqkoiAd8unYzQWHB6yi+YkBpJJGa3nFPWgz1t0VLnHHyUQHEfZcTUTx0mRzgIwTmSOtFFai9Z1GSlJGzpmVaaSl62sfZv/8vHkXfK1AWgBfIhCzCGY//NAxAkOoNnphcEYAkOIT5+L4x+q9VS4zFszdCgIFBVQd/VKnRKdg1/UDSg6vkYKwVljysS///9R5QdgqsFVTEFNRTMuOTkuM1VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=");
const $ = (selector) => document.querySelector(selector);
const setDomText = (el, text) => el.textContent = text;
const setDomStyle = (el, property, value) => el.style[property] = value;
const bindEvent = (el, event, handler) => el.addEventListener(event, handler);
const setStorage = (key, value) => localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
const format = {
    time: (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
    percentage: (value, total) => total ? `${((value / total) * 100).toFixed(1)}%` : '100%',
    speed: (chars, seconds) => seconds ? Math.round(chars / seconds * 60) : '0'
};

//词性映射表
const partsOfSpeech = {
    'n.': '名',
    'adj.': '形容',
    'v.': '动',
    'adv.': '副',
    'pron.': '代',
    'prep.': '介',
    'conj.': '连',
    'art.': '冠',
    'aux.': '助动',
    'num.': '数',
    'pl.': '复数',
    'abbr.': '缩写',
    'vt.': '及物动词'
};

// ======== 配置和状态变量定义 ========
// 全局配置对象
const config = {
    unit_isShuffled: localStorage.getItem('unit_isShuffled') === 'true' ?? true,
    display_hideLastWord: localStorage.getItem('display_hideLastWord') === 'true' ?? false,
    display_hideParaphrase: localStorage.getItem('display_hideParaphrase') === 'true' ?? false,
    unit_loopCount: Number(localStorage.getItem('unit_loopCount') ?? '1'),
    voice_enableParaphrase: localStorage.getItem('voice_enableParaphrase') === 'true' ?? true,
    voice_type: localStorage.getItem('voice_type') ?? 'Xiaoxiao',
    voice_loop: Number(localStorage.getItem('voice_loop') ?? '2'),
    voice_rate: Number(localStorage.getItem('voice_rate') ?? '2.0'),
    dict_current: localStorage.getItem('dict_current') ?? 'basic',
    dict_progress: JSON.parse(localStorage.getItem('dict_progress') ?? '{"basic":1,"cet4":1}'),
    darkMode: localStorage.getItem('darkMode') === 'true' ?? false,
    knownWords: JSON.parse(localStorage.getItem('knownWords') ?? '[]'),
    unKnownWords: JSON.parse(localStorage.getItem('unKnownWords') ?? '[]')
};

// 配置代理，实现双向绑定
const proxy = new Proxy(config, {
    set(target, property, value) {
        target[property] = value;
        setStorage(property, value);

        // 更新所有绑定了该属性的DOM元素
        document.querySelectorAll(`[data-bind="${property}"]`).forEach(element => {
            if (element.tagName === 'INPUT') {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else {
                    element.value = value;
                }
            } else if (element.tagName === 'SELECT') {
                element.value = value;
            } else {
                // 对于其他元素(如 span, p 等)，更新其文本内容
                element.textContent = value;
            }
        });

        return true;
    }
});

// 游戏状态管理
const gameState = {
    isDone: true,      // 练习完成标志
    isHidden: false,    // 隐藏单词标志
    isReview: false,    // 复习模式标志
    timer: null,        // 计时器
    wordsPerRound: 25   // 每轮单词数
};

// 单词状态管理
const wordState = {
    dict: {},                     // 词典数据
    selectedWords: [],            // 当前练习单词列表
    wordElements: null,           // 单词DOM元素集合
    currentWord: '',              // 当前单词
    currWordEl: null,             // 当前单词DOM元素
    wordIndex: 0,                 // 当前单词索引
    currentSound: null,           // 当前单词音频
    nextSound: null,              // 下一单词音频
    correctWords: {}              // 已掌握单词
};

// 练习统计数据
const stats = {
    typed: 0,         // 已输入字符数
    correct: 0,       // 正确字符数
    errors: '',       // 错误记录
    done: 0,          // 完成单词数
    failed: 0,        // 错误单词数
    time: 0,          // 用时(秒)
    typos: 0         // 当前单词错误数
};

// ======== DOM 元素引用 ========
const dom = {
    darkMode: $('.dark-mode-toggle'),
    dictProgress: $('.learning-progress'),
    diffMenu: $('.difficulty-dropdown'),
    levelNum: $('.level-display'),
    hideToggle: $('.hide-word-toggle'),
    helpBtn: $('.help-button'),
    reviewToggle: $('.review-mode-toggle'),
    restartBtn: $('.restart-button'),
    errText: $('.error-text'),
    wordList: $('.word-slider'),
    paraphrase: $('.paraphrase'),
    levelVal: $('.level-text'),
    speedVal: $('.speed-text'),
    correctVal: $('.correct-text'),
    errWordVal: $('.error-word-text'),
    rateVal: $('.correctrate-text'),
    timeVal: $('.time-text'),
    startHint: $('.start-prompt'),
    setupToggle: $('.difficulty-toggle'),
    progress: $('.progress-bar'),
    helpModal: $('.help-overlay'),
    helpClose: $('.help-close'),
    dictLabel: $('.current-dict-name'),
    dictSelector: $('.dict-selector'),
    dictDropdown: $('.dictionary-dropdown'),
    dictOptions: $('.dictionary-option'),
    soundToggle: $('.sound-toggle'),
    soundMenu: $('.sound-dropdown'),
    unitLoopSlider: $('.word-loop-slider'),
    unitLoopValue: $('.word-loop-value'),
    unitIsShuffled: $('.shuffled-words-toggle'),
    soundLoopSlider: $('.sound-loop-slider'),
    soundLoopValue: $('.sound-loop-value'),
    voiceSelect: $('.voice-select'),
    rateSlider: $('.rate-slider'),
    rateValue: $('.rate-value'),
    lastWordHidden: $('.last-word-hidden'),
    displayHideParaphrase: $('.paraphrase-hidden'),
    voiceEnableParaphrase: $('.paraphrase-voice-toggle')
};

// ======== 音频管理 ========
const ttsMsg = new SpeechSynthesisUtterance();
const audioCache = new Map();
const audio = {
    create: (word) => {
        if (audioCache.has(word)) return audioCache.get(word);
        const audioElement = new Audio(`https://dict.youdao.com/dictvoice?type=0&audio=${word}`);
        audioElement.load();
        audioCache.set(word, audioElement);
        return audioElement;
    },
    playAudio: async (sound, times = 2) => {
        for (let i = 0; i < times; i++) {
            await sound.play();
            await new Promise(resolve => sound.onended = resolve);
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
        const cleanText = text.replace(/[a-z]+\./g, '')
            .replace(/&/g, '')
            .split(/[;,]/)
            .filter((item, index, array) => array.indexOf(item) === index)
            .join(';');
        ttsMsg.text = cleanText;
        ttsMsg.voice = speechSynthesis.getVoices().find(voice => voice.name.includes(proxy.voice_type));
        ttsMsg.rate = proxy.voice_rate;
        speechSynthesis.speak(ttsMsg);
        speechSynthesis.pause();
    },
    playWordAndMeaning: async (sound, meaning) => {
        if (proxy.voice_enableParaphrase) audio.speak(meaning);
        await audio.playAudio(sound, proxy.voice_loop);
        if (proxy.voice_enableParaphrase) speechSynthesis.resume();
    }
};

// 初始化单词列表
function initializeWords(level) {
    // 根据模式选择单词源
    const wordBank = gameState.isReview ? proxy.unKnownWords : Object.keys(wordState.dict);
    let selectedWords;
    let html = '';
    // 确定单词列表
    if (gameState.isReview) {
        selectedWords = wordBank.flatMap(word => Array(proxy.unit_loopCount).fill(word));
    } else {
        const start = (level - 1) * gameState.wordsPerRound;
        selectedWords = wordBank.slice(start, start + gameState.wordsPerRound);
        // 最后一个单词隐藏模式的特殊处理
        if (proxy.display_hideLastWord && proxy.unit_loopCount >= 3) {
            const repeatCount = proxy.unit_loopCount - 1;
            let selectedWords2 = [];
            let previousWord = '';
            for (let i = 0; i < selectedWords.length; i++) {
                const word = selectedWords[i];
                // 添加当前单词的重复
                for (let j = 0; j < repeatCount; j++) {
                    html += `<div class="word" data-word="${word}">${word}</div>`;
                    selectedWords2.push(word);
                }
                // 添加下一个单词（模糊显示）
                if (i > 0) {
                    html += `<div class="word hidden-text" data-word="${previousWord}">${previousWord}</div>`;
                    selectedWords2.push(previousWord);
                }
                previousWord = word;
            }
            // 更新DOM和状态
            wordState.selectedWords = selectedWords2;
            setupWordList(html, selectedWords2[0], selectedWords2[1]);
            return;
        } else {
            // 原来的处理逻辑：将每个单词重复指定次数
            selectedWords = selectedWords.flatMap(word => Array(proxy.unit_loopCount).fill(word));
        }
    }

    // 随机打乱单词顺序
    if (proxy.unit_isShuffled) {
        for (let i = selectedWords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [selectedWords[i], selectedWords[j]] = [selectedWords[j], selectedWords[i]];
        }
    }

    // 保存单词列表并设置当前单词
    wordState.selectedWords = selectedWords;

    // 生成HTML并更新DOM
    for (let i = 0; i < selectedWords.length; i++) {
        html += `<div class="word" data-word="${selectedWords[i]}">${selectedWords[i]}</div>`;
    }

    // 更新DOM和状态
    setupWordList(html, selectedWords[0], selectedWords[1]);
}

// 设置单词列表DOM和音频
function setupWordList(html, currentWord, nextWord) {
    dom.wordList.innerHTML = html;
    dom.wordList.querySelector('.word').classList.add('active');
    wordState.wordElements = dom.wordList.querySelectorAll('.word');
    dom.wordList.style.transform = 'translateX(266px)';
    if (gameState.isHidden) {
        wordState.wordElements.forEach(el => el.classList.add('hidden-text'));
    }
    // 保存当前单词并预加载音频
    wordState.currentWord = currentWord;
    wordState.currentSound = audio.create(currentWord);
    wordState.nextSound = nextWord ? audio.create(nextWord) : null;
}

// 初始化练习
function init() {
    // 重置状态
    clearInterval(gameState.timer);
    gameState.isDone = false;
    Object.assign(stats, { time: 0, correct: 0, typed: 0, done: 0, failed: 0, errors: '' });
    wordState.selectedWords = [];
    wordState.wordIndex = 0;
    const level = gameState.isReview ? 0 : proxy.dict_progress[proxy.dict_current];
    dom.dictProgress.value = level;
    initializeWords(level);
    // 更新UI显示
    setDomText(dom.levelNum, gameState.isReview ? "复习中" : level);
    setDomText(dom.levelVal, level);
    setDomText(dom.timeVal, '00:00');
    setDomText(dom.speedVal, '0');
    setDomText(dom.correctVal, '0');
    setDomText(dom.errWordVal, '0');
    setDomText(dom.rateVal, '100%');
    setDomText(dom.errText, '');
    setDomStyle(dom.progress, 'width', '0%');
    dom.dictProgress.style.display = gameState.isReview ? 'none' : 'block';
    dom.startHint.style.display = 'none';
    updateWord();
    audio.playAudio(wordState.currentSound, proxy.voice_loop);
    gameState.timer = setInterval(updateTimer, 1000);
}

// 切换词典
async function switchDictionary(type) {
    // 如果当前是练习模式，先切换回正常模式
    if (gameState.isReview) reviewWords();
    document.querySelectorAll('.dictionary-option').forEach(el => el.classList.remove('active'));
    proxy.dict_current = type;
    $(`.dictionary-option[data-type="${type}"]`).classList.add('active');
    const dictNames = { basic: '基础英语词汇1000', cet4: '英语四级词库' };
    setDomText(dom.dictLabel, dictNames[type]);
    try {
        const response = await fetch(`${type}.json`);
        wordState.dict = await response.json();
        // 更新进度滑块
        const currentLevel = proxy.dict_progress[type] || 1;
        const maxLevel = Math.floor(Object.keys(wordState.dict).length / gameState.wordsPerRound);
        dom.dictProgress.max = maxLevel;
        dom.dictProgress.value = currentLevel;
        setDomText(dom.levelNum, currentLevel);
        setDomText(dom.levelVal, currentLevel);
        // 如果已开始练习，重新初始化
        if (dom.startHint.style.display === 'none') init();
    } catch (error) {
        setDomText(dom.errText, '加载词典失败');
    }
}
// 更新计时器
function updateTimer() {
    if (!gameState.isDone) {
        stats.time++;
        setDomText(dom.timeVal, format.time(stats.time));
        setDomText(dom.speedVal, format.speed(stats.correct, stats.time));
    }
}
// 更新单词显示
function updateWord() {
    const i = wordState.wordIndex;
    const offset = -i * 266 + 266;// 计算偏移量 (单词宽度 = 266px)
    const word = wordState.selectedWords[i];
    const paraphrase = wordState.dict[word];
    stats.typed = stats.typos = 0; // 重置统计
    wordState.currentWord = word;
    // 更新UI
    dom.wordList.style.transform = `translateX(${offset}px)`;
    wordState.currWordEl = wordState.wordElements[i];
    dom.paraphrase.innerHTML = highlightPartsOfSpeech(paraphrase);
    // 切换活动类
    if (i > 0) {
        wordState.wordElements[i - 1].classList.remove('active');
        wordState.wordElements[i].classList.add('active');
        // 更新音频
        wordState.currentSound = wordState.nextSound;
        if (i + 1 < wordState.selectedWords.length) wordState.nextSound = audio.create(wordState.selectedWords[i + 1]);
    }
    audio.playWordAndMeaning(wordState.currentSound, paraphrase);
}
// 高亮词性
function highlightPartsOfSpeech(text) {
    if (!text) return '';
    const pattern = new RegExp(`(${Object.keys(partsOfSpeech).join('|')})`, 'g');
    return text.replace(/&/g, '').replace(pattern, match =>
        `<span class="part-speech" title="${match}">${partsOfSpeech[match] || match}</span>`
    );
}
// 进入下一个单词
function nextWord() {
    audio.stop(wordState.currentSound);
    if (wordState.wordIndex + 1 === wordState.selectedWords.length) {
        if (gameState.isReview && proxy.unKnownWords.length === 0) {
            setDomText(dom.errText, '恭喜！所有未掌握单词已完成练习！');
            gameState.isReview = false;
            dom.reviewToggle.textContent = '🎯';
        }
        return unitComplete();
    }
    wordState.wordIndex++;
    updateWord();
}
// 跳过当前单词
function skipWord() {
    audio.stop(wordState.currentSound);
    if (wordState.wordIndex + 1 >= wordState.selectedWords.length) {
        return unitComplete();
    }
    const skippedWord = wordState.selectedWords[wordState.wordIndex];
    // 添加到未掌握单词列表
    if (!proxy.unKnownWords.includes(skippedWord)) {
        proxy.unKnownWords.push(skippedWord)
        setStorage('unKnownWords', proxy.unKnownWords);
    }
    setDomText(dom.errText, `单词 ${skippedWord} 已标记为未掌握`);
    wordState.wordIndex++;
    updateWord();
}
// 返回上一个单词
function goBackWord() {
    const i = wordState.wordIndex;
    if (i == 0) return;
    wordState.wordIndex--;
    wordState.wordElements[i - 1].classList.add('active');
    wordState.wordElements[i].classList.remove('active');
    stats.done--;
    updateWord();
}
// 单元完成
function unitComplete() {
    gameState.isDone = true;
    clearInterval(gameState.timer);
    setDomText(dom.errText, '练习完成！');
    setDomStyle(dom.errText, 'color', 'var(--primary-color)');
    setDomStyle(dom.progress, 'width', '100%');
    setTimeout(() => {
        setDomStyle(dom.errText, 'color', 'var(--error-color)');
        updateDifficulty(1);
    }, 2000);
}
// 处理打字输入
function checkTyping(key) {
    if (gameState.isDone) return;
    const currentWord = wordState.currentWord;
    const expectedChar = currentWord.charAt(stats.typed).toUpperCase();
    if (expectedChar === key) {
        stats.correct++;
        stats.typed++;
        setDomText(dom.errText, '');
        const html = stats.typed ?
            `${currentWord.substring(0, stats.typed)}</span>${currentWord.substring(stats.typed)}` :
            currentWord;
        wordState.currWordEl.innerHTML = '<span class="typed">' + html.replace(/ /g, '&nbsp;');
        if (stats.typed === currentWord.length) {
            stats.done++;
            if (gameState.isReview && gameState.isHidden) {
                wordState.correctWords[currentWord] = (wordState.correctWords[currentWord] || 0) + 1;
                if (wordState.correctWords[currentWord] > 3) {
                    proxy.unKnownWords = proxy.unKnownWords.filter(w => w !== currentWord);
                    setDomText(dom.errText, `已掌握单词：${currentWord}`);
                    setTimeout(() => {
                        setDomText(dom.errText, '');
                        nextWord();
                    }, 1000);
                    return;
                }
            }
            nextWord();
        }
    } else {
        stats.errors += expectedChar;
        stats.typos++;
        setDomText(dom.errText, `按键错误: ${key}`);
        beep.play();
        if (stats.typos > 4) {
            skipWord();
            stats.failed++;
        }
    }
    updateStats();
}
// 更新统计信息
function updateStats() {
    const total = stats.correct + stats.errors.length;
    setDomText(dom.speedVal, format.speed(stats.correct, stats.time));
    setDomText(dom.correctVal, stats.done);
    setDomText(dom.errWordVal, stats.failed);
    setDomText(dom.rateVal, format.percentage(stats.correct, total));
    setDomStyle(dom.progress, 'width', `${((stats.done + stats.failed) / wordState.selectedWords.length) * 100}%`);
}
// 切换暗黑模式
function toggleDarkMode() {
    proxy.darkMode = !proxy.darkMode;
    document.body.classList.toggle('dark-mode', proxy.darkMode);
    dom.darkMode.textContent = proxy.darkMode ? '☀️' : '🌙';
    this.blur();
}
// 更新进度级别
function updateDifficulty(change = 0) {
    const newLevel = Math.min(Math.max(Number(dom.dictProgress.value) + change, 1), Number(dom.dictProgress.max));
    // 更新 dict_progress 中当前等级的进度
    proxy.dict_progress = { ...proxy.dict_progress, [proxy.dict_current]: newLevel };
    dom.diffMenu.classList.remove('visible');
    init();
}
// 切换隐藏单词模式
function toggleHideWord() {
    if (gameState.isDone) init();
    gameState.isHidden = !gameState.isHidden;
    dom.hideToggle.textContent = gameState.isHidden ? '👀' : '🙈';
    proxy.display_hideLastWord = false;
    proxy.unit_loopCount = 1;
    wordState.wordElements.forEach(el => el.classList.toggle('hidden-text', gameState.isHidden));
}
// 切换复习单词模式
function reviewWords() {
    if (proxy.unKnownWords.length === 0) {
        setDomText(dom.errText, `当前字典(${proxy.dict_current})没有未掌握的单词,请继续练习`);
        dom.reviewToggle.textContent = '🎯';
        return;
    }
    this.blur();
    gameState.isReview = !gameState.isReview;
    dom.reviewToggle.textContent = gameState.isReview ? '📚' : '🎯';
    dom.dictProgress.style.display = gameState.isReview ? 'none' : 'block';
    init();
}
// 清除未掌握单词
function clearUnKnownWords() {
    proxy.unKnownWords = [];
    setDomText(dom.errText, `已清除当前字典(${proxy.dict_current})未掌握单词`);
}
// 标记为已掌握单词
function knownWord() {
    if (gameState.isDone) return;
    const currentWord = wordState.currentWord;
    const oldIndex = wordState.wordIndex;
    // 添加到已掌握单词列表
    proxy.knownWords.push(currentWord);
    setStorage('knownWords', proxy.knownWords);
    setDomText(dom.errText, `已掌握单词：${currentWord}`);

    audio.stop(wordState.currentSound);
    // 计算在oldIndex之前出现了多少个currentWord实例
    const removedCount = wordState.selectedWords.slice(0, oldIndex).filter(w => w === currentWord).length;
    wordState.selectedWords = wordState.selectedWords.filter(w => w !== currentWord);
    //根据之前删除的单词数调整索引
    wordState.wordIndex = Math.max(0, oldIndex - removedCount);
    // 如果已经是最后一个单词
    if (wordState.wordIndex >= wordState.selectedWords.length) return unitComplete();
    // 更新 DOM
    dom.wordList.querySelectorAll(`.word[data-word="${currentWord}"]`).forEach(el => el.remove());
    wordState.wordElements = dom.wordList.querySelectorAll('.word');

    updateWord();
}

// 绑定配置到DOM元素
function bindConfigToDOM() {
    // 绑定DOM元素
    const bindElements = document.querySelectorAll('[data-bind]');
    bindElements.forEach(element => {
        const property = element.getAttribute('data-bind');
        // 直接从 config 访问属性值，因为 config 已经被 proxy 初始化了
        const value = config[property];

        if (element.tagName === 'INPUT') {
            if (element.type === 'checkbox') {
                element.checked = value;
            } else if (element.type === 'range') {
                element.value = value;
                // 绑定 input 事件触发 proxy.set
                element.addEventListener('input', function () {
                    proxy[property] = parseFloat(this.value);
                });
            } else {
                element.value = value;
                // 绑定 input 事件触发 proxy.set
                element.addEventListener('input', function () {
                    proxy[property] = this.value;
                });
            }
        } else if (element.tagName === 'SELECT') {
            element.value = value;
            // 绑定 change 事件触发 proxy.set
            element.addEventListener('change', function () {
                proxy[property] = this.value;
            });
        } else {
            // 对于其他元素(如 span, p 等)，更新其文本内容
            element.textContent = value;
        }
        // 对于非 input/select 元素，其值变化由 proxy.set 处理，不需要在这里绑定事件
    });
}
// 设置事件监听器
function setupEventListeners() {
    // 按事件类型(click/change/input)组织不同的处理函数
    const eventHandlers = {
        // 点击事件处理器
        'click': {
            'darkMode': toggleDarkMode,           // 切换暗黑模式
            'reviewToggle': reviewWords,          // 切换复习模式
            'hideToggle': toggleHideWord,         // 切换隐藏单词
            'restartBtn': init,                   // 重新开始练习
            'startHint': init,                    // 开始提示点击
            'helpBtn': () => dom.helpModal.style.display = 'flex',    // 显示帮助模态框
            'helpClose': () => dom.helpModal.style.display = 'none',  // 关闭帮助模态框
            'setupToggle': (e) => {               // 设置菜单切换
                e.stopPropagation();
                dom.diffMenu.classList.toggle('visible');
                dom.soundMenu.classList.remove('visible');
                dom.dictDropdown.classList.remove('visible');
            },
            'soundToggle': (e) => {              // 声音设置菜单切换
                e.stopPropagation();
                dom.soundMenu.classList.toggle('visible');
                dom.diffMenu.classList.remove('visible');
                dom.dictDropdown.classList.remove('visible');
            },
            'dictSelector': (e) => {             // 字典选择器菜单切换
                e.stopPropagation();
                dom.dictDropdown.classList.toggle('visible');
                dom.diffMenu.classList.remove('visible');
                dom.soundMenu.classList.remove('visible');
            }
        },
        // 值改变事件处理器
        'change': {
            'unitLoopSlider': function () {      // 单元循环次数滑块
                const value = Number(this.value);
                proxy.unit_loopCount = value;
                if (value < 3 && proxy.display_hideLastWord) {
                    proxy.display_hideLastWord = false;
                }
                init();
            },
            'soundLoopSlider': function () {     // 声音循环次数滑块
                proxy.voice_loop = Number(this.value);
                dom.soundLoopValue.textContent = this.value;
            },
            'rateSlider': function () {          // 语速调节滑块
                const value = Number(this.value);
                proxy.voice_rate = value;
                ttsMsg.rate = value;
            },
            'voiceEnableParaphrase': function () {  // 启用释义语音开关
                proxy.voice_enableParaphrase = this.checked;
            },
            'voiceSelect': function () {         // 语音类型选择
                proxy.voice_type = this.value;
            },
            'unitIsShuffled': function () {      // 单词随机排序开关
                proxy.unit_isShuffled = this.checked;
                if (this.checked && proxy.display_hideLastWord) {
                    proxy.display_hideLastWord = false;
                }
                init();
            },
            'displayHideParaphrase': function () {  // 隐藏释义开关
                proxy.display_hideParaphrase = this.checked;
                dom.paraphrase.classList.toggle('hidden-text', this.checked);
            },
            'lastWordHidden': function () {      // 隐藏上一个单词开关
                proxy.display_hideLastWord = this.checked;
                if (this.checked) {
                    proxy.unit_isShuffled = false;
                    if (proxy.unit_loopCount < 3) proxy.unit_loopCount = 3;
                }
                init();
            },
            'dictProgress': () => updateDifficulty(0)   // 更新字典进度条
        }
    };

    // 遍历事件类型和对应的处理器，将它们绑定到相应的DOM元素上
    Object.entries(eventHandlers).forEach(([eventType, handlers]) => {
        Object.entries(handlers).forEach(([elementKey, handler]) => {
            if (dom[elementKey]) {
                bindEvent(dom[elementKey], eventType, handler);
            }
        });
    });

    // 单词播放事件：点击单词时播放对应的音频
    bindEvent(dom.wordList, 'click', (event) => {
        if (event.target.dataset.word) audio.create(event.target.dataset.word).play()
    });

    // 字典选项点击事件：切换不同的字典
    document.querySelectorAll('.dictionary-option').forEach(option => {
        bindEvent(option, 'click', (e) => {
            e.stopPropagation();
            switchDictionary(option.dataset.type);
            dom.dictDropdown.classList.remove('visible');
        });
    });

    // 全局点击事件：点击空白处关闭下拉菜单
    bindEvent(document, 'click', (e) => {
        if (!e.target.closest('.dict-selector')) {
            dom.dictDropdown.classList.remove('visible');
        }
        if (!e.target.closest('.controls')) {
            dom.diffMenu.classList.remove('visible');
            dom.soundMenu.classList.remove('visible');
        }
    });
}
// 设置键盘快捷键
function setupKeyboardShortcuts() {
    const keyHandlers = {
        13: () => setDomText(dom.errText, wordState.currentWord),   // Enter: 显示当前单词
        220: () => wordState.currentSound.play(),                   // \: 播放单词音频
        27: toggleHideWord,                                         // Esc: 切换隐藏单词
        35: clearUnKnownWords,                                      // End: 清除未掌握单词
        39: () => gameState.isHidden && skipWord(),                 // →: 跳过当前单词(仅在隐藏模式)
        37: goBackWord,                                             // ←: 返回上一个单词
        38: () => updateDifficulty(1),                              // ↑: 增加难度
        40: () => updateDifficulty(-1),                             // ↓: 降低难度
        192: knownWord                                              // `: 标记为已掌握
    };

    // 绑定键盘事件处理
    bindEvent(document, 'keydown', (event) => {
        const { keyCode } = event;
        if (keyHandlers[keyCode]) {
            keyHandlers[keyCode]();
        } else if ((keyCode >= 65 && keyCode <= 90) || keyCode === 32) {  // 字母键(A-Z)和空格键
            checkTyping(String.fromCharCode(keyCode));
        } else if (keyCode === 222) {  // 单引号键
            checkTyping("'");
        }
    });
}
// 初始化其他设置
function initOtherSettings() {
    // 初始化字典和主题
    switchDictionary(proxy.dict_current);
    document.body.classList.toggle('dark-mode', proxy.darkMode);
    dom.darkMode.textContent = proxy.darkMode ? '☀️' : '🌙';

    // 初始化语音设置
    ttsMsg.lang = 'zh-CN';
    ttsMsg.rate = proxy.voice_rate;
}
bindConfigToDOM();
setupEventListeners();
setupKeyboardShortcuts();
initOtherSettings();
