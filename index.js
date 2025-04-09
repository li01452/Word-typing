const beep = new Audio("data:audio/mpeg;base64,//NAxAASObKIDUBAAiAx///y7vegoDcPz2FAaAsDwaCgFgeGIieiJX////7v//CECgoKUWDcBQBQPKLBuDcXsTwfB8uf4IOWf+XB/BN4IHPDH//4kDCgAAAADYNtp65AuRxux////+f/80LEEhkL0uJfgWgCNutR/shrUFcFxJF0TIMxzGcIom0oG5KoqcupPp0767qWks1SFoU/5Jf1ia5qcUutFT1Mqz6l22qf1db3H4s0v/iyEht/9x0//9P//+gXv//6j1UCMjAliFTd1pL/80DECRVDRpR1wJgDk0lOizIJoGM0ATEFQjKk8TSC3QTdDfXv+jbV9mugnQSuccmwMDARiFnG5uboIv/dl6711f+r9LUzLDA4yKLf/VW3////a7OYiPxkWALSHAEJAupdSaBskbF0fP/zQsQPF2tKtH4DTv7UutToqL4TUOapkqI7is0PoropLQPl0ySoaadBNX/2UtklJGJgCvCfGZ5JSbK/nLf3ZKofZ1RWf/as0RWS3+6mTlY5THY1Pv//0mjYKhxyD04F4P////R61tNTqP/zQMQNFtNGjFVBaAKjqdSTJvYepKDyrRZzIvF1KpFlomD9l3dWtkfWjXalTZUtMwrQdpJMcWvq+/7LZ1JPX2U61spLdlJLOMMCasYos/qdBM1o7////9TrRWeqAI+lkkUXgAGl//////NCxAwXmmqAXYGIAKH1IGJg6BxqkoiAd8unYzQWHB6yi+YkBpJJGa3nFPWgz1t0VLnHHyUQHEfZcTUTx0mRzgIwTmSOtFFai9Z1GSlJGzpmVaaSl62sfZv/8vHkXfK1AWgBfIhCzCGY//NAxAkOoNnphcEYAkOIT5+L4x+q9VS4zFszdCgIFBVQd/VKnRKdg1/UDSg6vkYKwVljysS///9R5QdgqsFVTEFNRTMuOTkuM1VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=");
const $ = (selector) => document.querySelector(selector);
const setDomText = (el, text) => el.textContent = text;
const setDomStyle = (el, property, value) => el.style[property] = value;
const bindEvent = (el, event, handler) => el.addEventListener(event, handler);

// Audio Management
const ttsMsg = new SpeechSynthesisUtterance(); // 创建语音合成实例
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

    // 使用文本语音合成朗读释义
    speak: (text) => {
        // 处理释义文本：移除词性标记和特殊符号，分割并去重
        const cleanText = text.replace(/[a-z]+\./g, '') // 删除词性标记如 'n.' 'v.' 等
            .replace(/&/g, '') // 删除 & 符号
            .split(/[;,]/) // 按分号和逗号分割
            .filter((item, index, array) => array.indexOf(item) === index) // 去除重复项
            .join(';'); // 用分号重新连接

        ttsMsg.text = cleanText;
        ttsMsg.voice = speechSynthesis.getVoices().find(voice => voice.name.includes(voiceSet.voice));
        speechSynthesis.speak(ttsMsg);
        speechSynthesis.pause();
    },

    playWordAndMeaning: async (sound, meaning) => {
        // 如果启用了释义朗读，先设置好释义
        if (voiceSet.paraphrase) audio.speak(meaning);

        // 播放单词音频
        await audio.playAudio(sound, voiceSet.loop);

        // 恢复TTS播放
        if (voiceSet.paraphrase) speechSynthesis.resume();
    }
};

// 本地存储管理
const storage = {
    get: (key, defaultValue) => localStorage.getItem(key) || defaultValue,
    set: (key, value) => localStorage.setItem(key, value),
    getBool: (key) => localStorage.getItem(key) === 'true',
};

// 格式化工具函数
const format = {
    time: (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
    percentage: (value, total) => total ? `${((value / total) * 100).toFixed(1)}%` : '100%',
    speed: (chars, seconds) => seconds ? Math.round(chars / seconds * 60) : '0',
};

// 练习状态
const game = {
    isDone: false,      // 是否完成练习
    isHidden: false,    // 是否隐藏单词
    isReview: false,    // 是否复习模式
    timer: null,        // 计时器ID
    wordsPerRound: 25,  // 每轮单词数
    isDark: storage.getBool('darkMode'), // 是否暗黑模式
};

// 语音设置
const voiceSet = {
    loop: Number(storage.get('voiceLoop', '2')),               // 单词发音重复次数
    voice: storage.get('voiceType', 'Xiaoxiao'),               // 发音人
    rate: Number(storage.get('voiceRate', '2.0')),             // 语速
    paraphrase: storage.getBool('paraphraseVoice') ?? true     // 是否朗读释义
};

// 练习统计数据
const stats = {
    typed: 0,         // 已输入字符数
    correct: 0,       // 正确字符数
    errors: '',       // 错误记录
    done: 0,          // 完成单词数
    failed: 0,        // 错误单词数
    time: 0,          // 用时(秒)
    typos: 0,         // 当前单词错误数
};


// 词性缩写及其对应的中文名称
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

// 单词相关状态和配置
const word = {
    dict: {},                     // 词典数据
    selectedWords: [],            // 选中待练习的单词列表
    wordElements: null,           // 单词DOM元素集合
    currentWord: '',              // 当前单词
    currWordEl: null,             // 当前单词DOM元素
    wordIndex: 0,                 // 当前单词索引
    currentSound: null,           // 当前单词音频
    nextSound: null,              // 下一个单词音频
    correctWords: {},             // 已掌握单词
    isShuffled: storage.getBool('wordShuffled') ?? true,    // 是否打乱单词顺序
    loopCount: Number(storage.get('wordLoopCount', '1')),   // 单词循环次数
    currentDict: storage.get('currentDict', 'basic'),       // 当前词典
    dictProgress: JSON.parse(storage.get('dictProgress', '{"basic":1,"cet4":1}')), // 词典进度
    knownWords: JSON.parse(storage.get('knownWords', '[]')),        // 已掌握单词列表
    unknownWords: JSON.parse(storage.get('skippedWords', '[]'))     // 未掌握单词改为数组
};


// DOM 元素引用
const dom = {
    darkMode: $('.dark-mode-toggle'),           // 暗黑模式切换按钮
    diffSlider: $('.difficulty-slider'),        // 难度进度滑块
    diffMenu: $('.difficulty-dropdown'),        // 难度调整下拉菜单
    levelNum: $('.level-display'),              // 当前进度显示
    hideToggle: $('.hide-word-toggle'),         // 隐藏单词切换按钮
    helpBtn: $('.help-button'),                 // 帮助按钮
    reviewToggle: $('.review-mode-toggle'),     // 未掌握单词练习模式切换按钮
    repeatToggle: $('.repeat-mode-toggle'),     // 重复模式切换按钮
    restartBtn: $('.restart-button'),           // 重新开始按钮
    errText: $('.error-text'),                  // 错误提示文本
    wordList: $('#slider'),                     // 单词列表容器
    paraphrase: $('.paraphrase'),               // 单词释义显示区域
    levelVal: $('.level-text'),                 // 进度显示文本
    speedVal: $('.speed-text'),                 // 速度显示文本
    correctVal: $('.correct-text'),             // 正确单词数显示文本
    errWordVal: $('.error-word-text'),          // 错误单词数显示文本
    rateVal: $('.correctrate-text'),            // 正确率显示文本
    timeVal: $('.time-text'),                   // 用时显示文本
    startHint: $('.start-prompt'),              // 开始练习提示
    setupToggle: $('.difficulty-toggle'),       // 设置按钮
    progress: $('.progress-bar'),               // 进度条
    helpModal: $('.help-overlay'),              // 帮助窗口
    helpClose: $('.help-close'),                // 帮助窗口关闭按钮
    dictLabel: $('.current-dict-name'),         // 当前词典名称显示
    soundToggle: $('.sound-toggle'),            // 声音设置按钮
    soundMenu: $('.sound-dropdown'),            // 声音设置下拉菜单
    wordLoopSlider: $('#word-Loop-Slider'),     // 练习时单词重复次数滑块
    wordLoopValue: $('#word-Loop-Value'),       // 练习时单词重复次数显示
    wordShuffled: $('#shuffled-words-Toggle'),  // 单词打乱按钮
    soundLoopSlider: $('#sound-Loop-Slider'),   // 单词发音次数滑块
    soundLoopValue: $('#sound-Loop-Value'),     // 单词发音次数显示
    voiceSelect: $('#voice-Select'),            // 释义发音人选择
    rateSlider: $('#rate-Slider'),              // 释义发音语速滑块
    rateValue: $('#rate-Value'),                // 释义发音语速显示
    paraphraseVoice: $('#paraphrase-Voice-Toggle')  // 释义发音开关
};

// 初始化单词列表
function initializeWords(level) {
    // 根据模式选择单词库和处理逻辑
    let wordBank = game.isReview ? word.unknownWords : Object.keys(word.dict);
    let selectedWords;

    if (game.isReview) {
        selectedWords = wordBank.flatMap(singleWord => Array(word.loopCount).fill(singleWord));
    } else {
        // 正常模式：从对应级别选取单词，并与knownWords去重
        const start = (level - 1) * game.wordsPerRound;
        selectedWords = wordBank
            .filter(w => !word.knownWords.includes(w)) // 去掉已掌握的单词
            .slice(start, start + game.wordsPerRound);
        // 根据配置的循环次数复制单词
        selectedWords = selectedWords.flatMap(singleWord => Array(word.loopCount).fill(singleWord));
    }

    // 根据设置决定是否打乱单词顺序
    if (word.isShuffled) {
        const shuffled = [...selectedWords];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        word.selectedWords = shuffled;
    } else {
        word.selectedWords = selectedWords;
    }

    word.currentWord = word.selectedWords[0];

    // 生成单词DOM元素
    const generateWordElements = () => {
        let html = `<div class="word active" data-word="${word.currentWord}">${word.currentWord}</div>`;
        for (let i = 1; i < word.selectedWords.length; i++) {
            html += `<div class="word" data-word="${word.selectedWords[i]}">${word.selectedWords[i]}</div>`;
        }
        return html;
    };

    dom.wordList.innerHTML = generateWordElements();
    word.wordElements = dom.wordList.querySelectorAll('.word');
    dom.wordList.style.transform = 'translateX(266px)';

    word.currentSound = audio.create(word.currentWord);
    word.nextSound = word.selectedWords[1] ? audio.create(word.selectedWords[1]) : null;
}

// 初始化练习
function init() {
    clearInterval(game.timer); // 清除计时器
    game.isDone = false;       // 重置完成状态
    // 重置统计数据
    Object.assign(stats, {
        time: 0,
        correct: 0,
        typed: 0,
        done: 0,
        failed: 0,
        errors: ''
    });

    // 重置单词状态
    word.selectedWords = [];
    word.wordIndex = 0;

    // 读取当前字典的进度
    const level = game.isReview ? 0 : word.dictProgress[word.currentDict];
    dom.diffSlider.value = level;

    // 初始化单词列表
    initializeWords(level);

    // 更新UI显示
    setDomText(dom.levelNum, game.isReview ? "复习中" : level);
    setDomText(dom.levelVal, level);
    setDomText(dom.timeVal, '00:00');
    setDomText(dom.speedVal, '0');
    setDomText(dom.correctVal, '0');
    setDomText(dom.errWordVal, '0');
    setDomText(dom.rateVal, '100%');
    setDomText(dom.errText, '');
    setDomStyle(dom.progress, 'width', '0%');
    dom.startHint.style.display = 'none';

    // 更新单词显示并开始练习
    updateWord();
    audio.playAudio(word.currentSound, voiceSet.loop);
    game.timer = setInterval(updateTimer, 1000);

    word.wordElements.forEach(el => el.classList.toggle('hidden-text', game.isHidden));
}

// 切换词典
async function switchDictionary(type) {
    // 如果当前是练习模式，先切换回正常模式
    if (game.isReview) reviewWords();

    // 更新UI激活状态
    document.querySelectorAll('.dictionary-option').forEach(el => {
        el.classList.remove('active')
    });

    word.currentDict = type;
    storage.set('currentDict', type);
    $(`.dictionary-option[data-type="${type}"]`).classList.add('active');

    // 更新词典名称显示
    const dictNames = {
        'basic': '基础英语词汇1000',
        'cet4': '英语四级词库'
    };
    setDomText(dom.dictLabel, dictNames[type]);

    try {
        // 加载词典数据
        const response = await fetch(`${type}.json`);
        const data = await response.json();
        word.dict = data;

        // 更新进度滑块
        const currentLevel = word.dictProgress[type] || 1;
        const maxLevel = Math.floor(Object.keys(data).length / game.wordsPerRound);
        dom.diffSlider.max = maxLevel;
        dom.diffSlider.value = currentLevel;
        setDomText(dom.levelNum, currentLevel);
        setDomText(dom.levelVal, currentLevel);

        // 如果已开始练习，重新初始化
        if (dom.startHint.style.display == 'none') init();
    } catch (error) {
        setDomText(dom.errText, '加载词典失败');
    }
}

// 更新计时器
function updateTimer() {
    if (!game.isDone) {
        stats.time++;
        setDomText(dom.timeVal, format.time(stats.time));
        setDomText(dom.speedVal, format.speed(stats.correct, stats.time));
    }
}

// 更新单词显示
function updateWord() {
    const i = word.wordIndex;
    const offset = -i * 266 + 266; // 计算偏移量 (单词宽度 = 266px)

    word.currentWord = word.selectedWords[i];
    const paraphrase = word.dict[word.currentWord]; // 获取释义

    // 重置统计
    stats.typed = 0; // 重置已输入字符数
    stats.typos = 0; // 重置错误计数

    // 更新UI
    dom.wordList.style.transform = `translateX(${offset}px)`; // 设置偏移量
    word.currWordEl = word.wordElements[word.wordIndex];
    dom.paraphrase.innerHTML = highlightPartsOfSpeech(paraphrase); // 显示释义

    if (i > 0) {
        // 切换活动类
        word.wordElements[i - 1].classList.remove('active');
        word.wordElements[i].classList.add('active');

        // 更新音频
        word.currentSound = word.nextSound;

        // 预加载下一个单词音频（如果存在）
        if (i + 1 < word.selectedWords.length) {
            word.nextSound = audio.create(word.selectedWords[i + 1]);
        }
    }

    // 播放单词和释义
    audio.playWordAndMeaning(word.currentSound, paraphrase);
}

// 高亮单词中的词性
function highlightPartsOfSpeech(text) {
    if (!text) return '';

    // 创建正则表达式模式，匹配所有词性缩写
    const escapedKeys = Object.keys(partsOfSpeech).map(
        key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const pattern = new RegExp(`(${escapedKeys.join('|')})`, 'g');

    // 替换匹配到的词性缩写为带有样式的span
    return text.replace(/&/g, '').replace(pattern, match => {
        const fullName = partsOfSpeech[match] || match;
        return `<span class="part-speech" title="${match}">${fullName}</span>`;
    });
}

// 进入下一个单词
function nextWord() {
    // 停止当前单词的音频播放
    audio.stop(word.currentSound);
    // 检查是否已完成所有单词
    if (word.wordIndex + 1 >= word.selectedWords.length) {
        if (game.isReview && Object.keys(word.unknownWords).length === 0) {
            setDomText(dom.errText, '恭喜！所有未掌握单词已完成练习！');
            game.isReview = false;
            dom.reviewToggle.textContent = '🎯';
        }
        return unitComplete(); // 处理练习完成
    }

    word.wordIndex++; // 增加当前单词索引
    updateWord(); // 更新单词显示
}

// 跳过当前单词
function skipWord() {
    audio.stop(word.currentSound);

    if (word.wordIndex + 1 >= word.selectedWords.length) {
        return unitComplete();
    }

    // 保存跳过的单词到数组
    const skippedWord = word.selectedWords[word.wordIndex];
    if (!word.unknownWords.includes(skippedWord)) {
        word.unknownWords.push(skippedWord);
        storage.set('skippedWords', JSON.stringify(word.unknownWords));
    }
    setDomText(dom.errText, `单词 ${skippedWord} 已标记为未掌握`);

    word.wordIndex++;
    updateWord();
}

// 返回上一个单词
function goBackWord() {
    if (word.wordIndex <= 0) return;

    // 更新索引和DOM状态
    let i = word.wordIndex;
    word.wordIndex--;
    word.wordElements[i - 1].classList.add('active');
    word.wordElements[i].classList.remove('active');

    stats.done--; // 减少已完成单词数
    updateWord(); // 更新单词显示
}

// 单元完成
function unitComplete() {
    game.isDone = true;
    clearInterval(game.timer);

    // 更新UI提示
    setDomText(dom.errText, '练习完成！');
    setDomStyle(dom.errText, 'color', 'var(--primary-color)');
    setDomStyle(dom.progress, 'width', '100%');

    // 恢复错误提示颜色并更新进度
    setTimeout(() => {
        setDomStyle(dom.errText, 'color', 'var(--error-color)');
        updateDifficulty(1); // 更新进度级别
    }, 2000);
}

// 处理打字输入
function checkTyping(key) {
    if (game.isDone) return;
    const current = word.currentWord;
    const expected = current.charAt(stats.typed).toUpperCase();

    if (expected === key) {
        stats.correct++;
        stats.typed++;

        if (key === ' ') stats.typed = stats.typed + 5; // 处理空格输入
        setDomText(dom.errText, '');

        const html = stats.typed ?
            `<span class="typed">${current.substring(0, stats.typed)}</span>${current.substring(stats.typed)}` :
            current;
        const encodeSpaces = html.replace(" ", "&nbsp;");
        word.currWordEl.innerHTML = encodeSpaces

        if (stats.typed === current.length) {
            stats.done++;

            if (game.isReview && game.isHidden) {
                word.correctWords[current] = (word.correctWords[current] || 0) + 1;

                if (word.correctWords[current] > 3) {
                    word.skippedWords = word.skippedWords.filter(w => w !== current);
                    storage.set('skippedWords', JSON.stringify(word.skippedWords));

                    setDomText(dom.errText, `已掌握单词：${current}`);
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
        stats.errors += expected;
        stats.typos++;
        setDomText(dom.errText, `按键错误: ${key}`);

        beep.play();

        if (stats.typos > 4) {
            setDomText(dom.errText, `错误次数过多，标记为未掌握单词：${current}`);
            skipWord();
            stats.failed++;
        }
    }

    updateStats();
}


// 处理打字输入
function checkTyping(key) {
    if (game.isDone) return;
    const current = word.currentWord;
    const expected = current.charAt(stats.typed).toUpperCase();

    if (expected === key) {
        stats.correct++;
        stats.typed++;
        setDomText(dom.errText, '');
        const html = stats.typed ? `<span class="typed">${current.substring(0, stats.typed)}</span>${current.substring(stats.typed)}` : current;
        word.currWordEl.innerHTML = '<span class="typed">' + html.replace(/ /g, '&nbsp;'); // 替换空格为 &nbsp;

        if (stats.typed === current.length) {
            stats.done++;

            if (game.isReview && game.isHidden) {
                word.correctWords[current] = (word.correctWords[current] || 0) + 1;

                if (word.correctWords[current] > 3) {
                    word.unknownWords = word.unknownWords.filter(w => w !== current);
                    storage.set('skippedWords', JSON.stringify(word.unknownWords));

                    setDomText(dom.errText, `已掌握单词：${current}`);
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
        stats.errors += expected;
        stats.typos++;
        setDomText(dom.errText, `按键错误: ${key}`);

        beep.play();

        if (stats.typos > 4) {
            setDomText(dom.errText, `错误次数过多，标记为未掌握单词：${current}`);
            skipWord();
            stats.failed++;
        }
    }

    updateStats();
}

// 更新统计信息
function updateStats() {
    const total = stats.correct + stats.errors.length;

    // 更新UI显示
    setDomText(dom.speedVal, format.speed(stats.correct, stats.time));
    setDomText(dom.correctVal, stats.done);
    setDomText(dom.errWordVal, stats.failed);
    setDomText(dom.rateVal, format.percentage(stats.correct, total));

    // 更新进度条
    const progressPercentage = `${((stats.done + stats.failed) / word.selectedWords.length) * 100}%`;
    setDomStyle(dom.progress, 'width', progressPercentage);
}

// 切换暗黑模式
function toggleDarkMode() {
    game.isDark = !game.isDark;
    document.body.classList.toggle('dark-mode', game.isDark);
    dom.darkMode.textContent = game.isDark ? '☀️' : '🌙';
    storage.set('darkMode', game.isDark);
    this.blur();
}

// 更新进度级别
function updateDifficulty(change = 0) {
    let newLevel = Number(dom.diffSlider.value) + change;
    newLevel = Math.min(Math.max(newLevel, 1), Number(dom.diffSlider.max));

    // 保存进度
    word.dictProgress[word.currentDict] = newLevel;
    storage.set('dictProgress', JSON.stringify(word.dictProgress));

    // 关闭菜单并重新初始化
    dom.diffMenu.classList.remove('visible');
    init();
}

// 切换隐藏单词模式
function toggleHideWord() {
    game.isHidden = !game.isHidden;
    dom.hideToggle.textContent = game.isHidden ? '👀' : '🙈';

    // 根据隐藏状态切换类
    dom.wordLoopSlider.value = 1;
    updateWordCount();
    word.wordElements.forEach(el => el.classList.toggle('hidden-text', game.isHidden));
}

// 切换复习单词模式
function reviewWords() {
    // skippedWords 已改为数组，无需从对象中取特定字典的值
    if (word.unknownWords.length === 0) {
        setDomText(dom.errText, `当前字典(${word.currentDict})没有未掌握的单词,请继续练习`);
        dom.reviewToggle.textContent = '🎯';
        return;
    }
    this.blur();
    game.isReview = !game.isReview;
    dom.reviewToggle.textContent = game.isReview ? '📚' : '🎯';

    dom.diffSlider.style.display = game.isReview ? 'none' : 'block';
    init();
    
}

// 清除未掌握单词
function clearSkippedWords() {
    word.unknownWords = [];
    storage.set('skippedWords', JSON.stringify(word.unknownWords));
    setDomText(dom.errText, `已清除当前字典(${word.currentDict})未掌握单词`);
}

// 标记为已掌握单词
function knownWord() {
    if (game.isDone) return;
    audio.stop(word.currentSound);

    // 添加到已掌握单词列表
    word.knownWords.push(word.currentWord);
    storage.set('knownWords', JSON.stringify(word.knownWords));
    setDomText(dom.errText, `已掌握单词：${word.currentWord}`);

    // 从单词列表中移除当前单词的所有实例
    const currentWord = word.currentWord;
    const oldIndex = word.wordIndex; // Store the old index

    // 计算在oldIndex之前出现了多少个currentWord实例
    const removedCount = word.selectedWords.slice(0, oldIndex).filter(w => w === currentWord).length;

    word.selectedWords = word.selectedWords.filter(w => w !== currentWord);
    //根据之前删除的单词数调整索引
    word.wordIndex = Math.max(0, oldIndex - removedCount);

    // 如果已经是最后一个单词
    if (word.wordIndex >= word.selectedWords.length) {
        unitComplete();
        return;
    }

    // 更新 DOM
    dom.wordList.querySelectorAll(`.word[data-word="${currentWord}"]`).forEach(el => el.remove());
    word.wordElements = dom.wordList.querySelectorAll('.word');

    word.wordElements.forEach(el => el.classList.remove('active'));
    if (word.wordElements[word.wordIndex]) word.wordElements[word.wordIndex].classList.add('active');

    // 更新音频
    word.currentSound = word.nextSound;
    word.nextSound = word.wordIndex + 1 < word.selectedWords.length ?
        audio.create(word.selectedWords[word.wordIndex + 1]) : null;

    this.blur();
    // 更新显示
    updateWord();
}

function updateWordCount() {
    word.loopCount = Number(dom.wordLoopSlider.value);
    storage.set('wordLoopCount', word.loopCount);
    dom.wordLoopValue.textContent = word.loopCount;
    init();
}
// 设置初始化
function initSettings() {
    // 加载字典
    switchDictionary(word.currentDict);

    // 设置深色模式
    if (game.isDark) {
        document.body.classList.add('dark-mode');
        dom.darkMode.innerHTML = '☀️';
    }

    // 设置事件监听器
    bindEvent(dom.darkMode, 'click', toggleDarkMode);               // 切换深色模式
    bindEvent(dom.reviewToggle, 'click', reviewWords);              // 切换复习模式
    bindEvent(dom.hideToggle, 'click', toggleHideWord);             // 切换隐藏单词模式
    bindEvent(dom.restartBtn, 'click', init);                       // 重新开始练习
    bindEvent(dom.startHint, 'click', init);                        // 开始练习
    bindEvent(dom.diffSlider, 'change', () => updateDifficulty(0)); // 更新难度级别
    bindEvent(dom.helpBtn, 'click', () => dom.helpModal.style.display = 'flex');                // 显示帮助窗口
    bindEvent(dom.helpClose, 'click', () => dom.helpModal.style.display = 'none');              // 关闭帮助窗口
    bindEvent(dom.diffSlider, 'input', () => setDomText(dom.levelNum, dom.diffSlider.value));   // 更新难度级别显示
    bindEvent(dom.setupToggle, 'click', () => dom.diffMenu.classList.toggle('visible'));         // 切换难度菜单
    bindEvent(dom.soundToggle, 'click', () => dom.soundMenu.classList.toggle('visible'));       // 切换声音设置菜单
    bindEvent(dom.voiceSelect, 'change', () => storage.set('voiceType', voiceSet.voice));       // 更新声音类型
    bindEvent(dom.wordList, 'click', (event) => { if (event.target.dataset.word) audio.create(event.target.dataset.word).play() });// 播放单词音频
    bindEvent(dom.wordLoopSlider, 'input', () => {// 更新单词循环次数
        word.loopCount = Number(dom.wordLoopSlider.value);
        storage.set('wordLoopCount', word.loopCount);
        dom.wordLoopValue.textContent = word.loopCount;
        init();
    });
    bindEvent(dom.soundLoopSlider, 'input', () => {// 更新声音循环次数
        voiceSet.loop = Number(dom.soundLoopSlider.value);
        voiceSet.voice = dom.voiceSelect.value;
        storage.set('voiceLoop', voiceSet.loop);
        dom.soundLoopValue.textContent = voiceSet.loop;
    });

    bindEvent(dom.rateSlider, 'input', () => {// 更新语速
        voiceSet.rate = Number(dom.rateSlider.value);
        storage.set('voiceRate', voiceSet.rate);
        dom.rateValue.textContent = voiceSet.rate.toFixed(1);
        ttsMsg.rate = voiceSet.rate;
    });
    bindEvent(dom.paraphraseVoice, 'change', () => {// 更新释义语音设置
        voiceSet.paraphrase = dom.paraphraseVoice.checked;
        storage.set('paraphraseVoice', voiceSet.paraphrase);
    });
    bindEvent(dom.wordShuffled, 'change', () => {// 更新单词打乱设置
        word.isShuffled = dom.wordShuffled.checked;
        storage.set('wordShuffled', word.isShuffled);
        init();
    });
    bindEvent(document, 'click', (e) => {// 点击其他地方关闭菜单
        if (!e.target.closest('.controls')) {
            dom.diffMenu.classList.remove('visible');
            dom.soundMenu.classList.remove('visible');
            this.blur();
        }
    });
    bindEvent(document, 'keydown', (event) => {
        const { keyCode } = event;
        if (keyCode === 13) setDomText(dom.errText, word.currentWord); // Enter键显示单词
        else if (keyCode === 220) word.currentSound.play();// 播放单词音频
        else if (keyCode === 27) toggleHideWord();// Esc键切换隐藏单词
        else if (keyCode === 35) clearSkippedWords();// End键清除未掌握单词
        else if (keyCode === 39 && game.isHidden) skipWord();// 右箭头键跳过单词
        else if (keyCode === 37 && game.isHidden) goBackWord();// 左箭头键返回上一个单词
        else if (keyCode === 38) updateDifficulty(1);// 上箭头键增加难度
        else if (keyCode === 40) updateDifficulty(-1);// 下箭头键降低难度
        else if (keyCode === 9) knownWord();// tab键标记为已掌握
        else if ((keyCode >= 65 && keyCode <= 90 || keyCode == 32)) checkTyping(String.fromCharCode(keyCode));// 处理字母和空格输入
        else if (keyCode == 222) checkTyping("'"); // 处理单引号输入
    });
    dom.soundLoopSlider.value = voiceSet.loop;
    dom.voiceSelect.value = voiceSet.voice;
    dom.rateSlider.value = voiceSet.rate;
    dom.paraphraseVoice.checked = voiceSet.paraphrase;
    dom.wordShuffled.checked = word.isShuffled;
    dom.soundLoopValue.textContent = voiceSet.loop;
    ttsMsg.lang = 'zh-CN';
}
initSettings();
