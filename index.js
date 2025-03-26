const beep = new Audio("data:audio/mpeg;base64,//NAxAASObKIDUBAAiAx///y7vegoDcPz2FAaAsDwaCgFgeGIieiJX////7v//CECgoKUWDcBQBQPKLBuDcXsTwfB8uf4IOWf+XB/BN4IHPDH//4kDCgAAAADYNtp65AuRxux////+f/80LEEhkL0uJfgWgCNutR/shrUFcFxJF0TIMxzGcIom0oG5KoqcupPp0767qWks1SFoU/5Jf1ia5qcUutFT1Mqz6l22qf1db3H4s0v/iyEht/9x0//9P//+gXv//6j1UCMjAliFTd1pL/80DECRVDRpR1wJgDk0lOizIJoGM0ATEFQjKk8TSC3QTdDfXv+jbV9mugnQSuccmwMDARiFnG5uboIv/dl6711f+r9LUzLDA4yKLf/VW3////a7OYiPxkWALSHAEJAupdSaBskbF0fP/zQsQPF2tKtH4DTv7UutToqL4TUOapkqI7is0PoropLQPl0ySoaadBNX/2UtklJGJgCvCfGZ5JSbK/nLf3ZKofZ1RWf/as0RWS3+6mTlY5THY1Pv//0mjYKhxyD04F4P////R61tNTqP/zQMQNFtNGjFVBaAKjqdSTJvYepKDyrRZzIvF1KpFlomD9l3dWtkfWjXalTZUtMwrQdpJMcWvq+/7LZ1JPX2U61spLdlJLOMMCasYos/qdBM1o7////9TrRWeqAI+lkkUXgAGl//////NCxAwXmmqAXYGIAKH1IGJg6BxqkoiAd8unYzQWHB6yi+YkBpJJGa3nFPWgz1t0VLnHHyUQHEfZcTUTx0mRzgIwTmSOtFFai9Z1GSlJGzpmVaaSl62sfZv/8vHkXfK1AWgBfIhCzCGY//NAxAkOoNnphcEYAkOIT5+L4x+q9VS4zFszdCgIFBVQd/VKnRKdg1/UDSg6vkYKwVljysS///9R5QdgqsFVTEFNRTMuOTkuM1VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=");
const $ = (s) => document.querySelector(s);
const setDomText = (el, text) => el.innerHTML = text;
const setDomStyle = (el, property, value) => el.style[property] = value;
const audioCache = new Map();
const audio = {
    create: (word) => {
        if (audioCache.has(word)) return audioCache.get(word);
        const audio = new Audio(`https://dict.youdao.com/dictvoice?type=0&audio=${word}`);
        audio.load();
        audioCache.set(word, audio);
        return audio;
    },
    play: async (sound) => {
        await sound.play();
        return new Promise(resolve => sound.onended = resolve);
    },
    playTwice: async (sound) => {
        for (let i = 0; i < 2; i++) {
            await sound.play();
            await new Promise(r => sound.onended = r);
            sound.currentTime = 0;
        }
    }
};
const storage = {
    get: (key, defaultValue) => localStorage.getItem(key) || defaultValue,
    set: (key, value) => localStorage.setItem(key, value),
    getBool: (key) => localStorage.getItem(key) === 'true',
    saveToList: (listName, item, type) => {
        const lists = JSON.parse(storage.get(listName, '{}'));
        if (!lists[type]) lists[type] = [];
        if (!lists[type].includes(item)) {
            lists[type].push(item);
            storage.set(listName, JSON.stringify(lists));
        }
    }
};
const format = {
    time: (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
    percentage: (value, total) => total ? `${((value / total) * 100).toFixed(1)}%` : '100%',
    speed: (chars, seconds) => seconds ? Math.round(chars / seconds * 60) : '0',
};

const word = {
    dict: {},                    // 词典
    currentDict: storage.get('currentDict', 'basic'),// 当前词典
    dictProgress: JSON.parse(storage.get('dictProgress', '{"basic":1,"cet4":1}')),// 词典进度
    selectedWords: [],           // 选中待练习的单词列表
    wordElements: null,          // 单词DOM元素集合
    currentWord: '',             // 当前单词
    currentWordElement: null,    // 当前单词DOM元素
    wordIndex: 0,               // 当前单词索引
    currentSound: null,          // 当前单词音频
    nextSound: null,             // 下一个单词音频
    skippedWords: {},            // 未掌握单词
    correctWords: {},            // 已掌握单词
};

const game = {
    isDone: false,     // 是否完成练习
    isHidden: false,   // 是否隐藏单词
    isDark: storage.getBool('darkMode'),// 是否暗黑模式
    isReview: false,   // 是否复习模式
    timer: null,       // 计时器ID
    wordsPerRound: 25  // 每轮单词数
};

const stats = {
    typed: 0,        // 已输入字符数
    correct: 0,      // 正确字符数
    errors: '',      // 错误记录
    done: 0,         // 完成单词数
    failed: 0,       // 错误单词数
    time: 0,         // 用时(秒)
    typos: 0,        // 当前单词错误数
};

const dom = {
    darkMode: $('.dark-mode-toggle'),
    diffSlider: $('.difficulty-slider'),
    diffMenu: $('.difficulty-dropdown'),
    levelNum: $('.level-display'),
    hideToggle: $('.hide-word-toggle'),
    helpBtn: $('.help-button'),
    skipToggle: $('.skip-mode-toggle'),
    repeatToggle: $('.repeat-mode-toggle'),
    restartBtn: $('.restart-button'),
    errText: $('.error-text'),
    wordList: $('#slider'),
    paraphrase: $('.paraphrase'),
    levelVal: $('.level-text'),
    speedVal: $('.speed-text'),
    correctVal: $('.correct-text'),
    errWordVal: $('.error-word-text'),
    rateVal: $('.correctrate-text'),
    timeVal: $('.time-text'),
    startHint: $('.start-prompt'),
    diffToggle: $('.difficulty-toggle'),
    progress: $('.progress-bar'),
    helpModal: $('.help-overlay'),
    helpClose: $('.help-close'),
    dictLabel: $('.current-dict-name')
};

if (game.isDark) {
    document.body.classList.add('dark-mode');
    dom.darkMode.innerHTML = '☀️';
}


// 初始化单词列表
function initializeWords(level) {
    // 根据模式选择单词库和处理逻辑
    let wordBank = game.isReview ? word.skippedWords : Object.keys(word.dict);
    let selectedWords;
    if (game.isReview) {
        // 跳过模式:每个单词重复3次并打乱
        selectedWords = Array(3).fill(wordBank).flat();
    } else {
        // 正常模式:从对应级别选取单词
        const start = (level - 1) * game.wordsPerRound;
        selectedWords = wordBank.slice(start, start + game.wordsPerRound);
    }
    // 打乱单词顺序(Fisher-Yates shuffle)
    const shuffled = [...selectedWords];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // 选择指定数量的单词
    word.selectedWords = shuffled.slice(0, Math.min(game.wordsPerRound, shuffled.length));
    word.currentWord = word.selectedWords[0];
    // 生成待练习单词 DOM 并初始化音频
    let html = `<div class="word active" data-word="${word.currentWord}">${word.currentWord}</div>`;
    for (let i = 1; i < word.selectedWords.length; i++) {
        html += `<div class="word" data-word="${word.selectedWords[i]}">${word.selectedWords[i]}</div>`;
    }
    dom.wordList.innerHTML = html;
    word.wordElements = dom.wordList.querySelectorAll('.word');
    dom.wordList.style.transform = 'translateX(266px)';
    // 创建音频对象
    [word.currentSound, word.nextSound] = [audio.create(word.currentWord), audio.create(word.selectedWords[1])];
}
// 初始化练习
function init() {
    clearInterval(game.timer); // 清除计时器
    const wasHidden = game.isHidden; // 保存隐藏状态
    Object.assign(game, {
        isDone: false,
        isHidden: wasHidden
    });
    Object.assign(stats, {
        time: 0,
        correct: 0,
        typed: 0,
        done: 0,
        failed: 0,
        errors: ''
    });
    Object.assign(word, {
        selectedWords: [],
        wordIndex: 0
    });
    const level = game.isReview ? 0 : word.dictProgress[word.currentDict]; // 读取当前字典的进度
    dom.diffSlider.value = level;
    initializeWords(level);
    setDomText(dom.levelNum, level);
    setDomText(dom.levelVal, level);
    if (game.isReview) setDomText(dom.levelNum, "复习中");
    setDomText(dom.timeVal, '00:00');
    setDomText(dom.speedVal, '0');
    setDomText(dom.correctVal, '0');
    setDomText(dom.errWordVal, '0');
    setDomText(dom.rateVal, '100%');
    setDomText(dom.errText, '');
    setDomStyle(dom.progress, 'width', '0%');
    dom.startHint.style.display = 'none';
    updateWord();
    audio.playTwice(word.currentSound);
    game.timer = setInterval(updateTimer, 1000);
}
switchDictionary(word.currentDict);

// 切换词典
async function switchDictionary(type) {
    // 如果当前是练习模式，先切换回正常模式
    if (game.isReview) toggleSkipWordsMode();

    // 激活状态
    document.querySelectorAll('.dictionary-option').forEach(el => { el.classList.remove('active') });
    word.currentDict = type;

    storage.set('currentDict', type);
    $(`.dictionary-option[data-type="${type}"]`).classList.add('active');

    // 更新词典名称显示
    const dictNames = {
        'basic': '基础英语词汇900',
        'cet4': '英语四级词库'
    };
    setDomText(dom.dictLabel, dictNames[type]);

    try {
        const response = await fetch(`${type}.json`);
        const data = await response.json();
        word.dict = data;
        // 从 word.dictProgress 中读取当前字典的进度
        const currentLevel = word.dictProgress[type] || 1;
        // 更新进度滑块的最大值和当前值
        const maxLevel = Math.floor(Object.keys(data).length / game.wordsPerRound);
        dom.diffSlider.max = maxLevel;
        dom.diffSlider.value = currentLevel;
        setDomText(dom.levelNum, currentLevel);
        setDomText(dom.levelVal, currentLevel);

        if (dom.startHint.style.display == 'none') init()
    } catch (error) {
        console.error('Error loading dictionary:', error);
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
    const offset = -i * 266 + 266; // wordWidth = 266 计算偏移量
    word.currentWord = word.selectedWords[i];
    stats.typed = 0; // 重置已输入字符数
    stats.failed = 0; // 重置错误单词数
    stats.typos = 0; // 重置错误计数
    dom.wordList.style.transform = `translateX(${offset}px)`; // 设置偏移量
    word.currentWordElement = word.wordElements[word.wordIndex];
    setDomText(dom.paraphrase, highlightPartsOfSpeech(word.dict[word.currentWord])); // 显示释义
    if (i > 0) { // 切换活动类
        word.wordElements[i - 1].classList.remove('active');
        word.wordElements[i].classList.add('active');
        word.currentSound = word.nextSound; // 更新当前音频
        word.nextSound = audio.create(word.selectedWords[i + 1]); // 创建下一个单词音频
        audio.playTwice(word.currentSound); // 播放当前单词音频两次
    }
}
// 高亮单词中的词性
function highlightPartsOfSpeech(text) {
    if (!text) return '';
    // 所有词性缩写及其完整形式
    const partsOfSpeech = {
        'n\.': '名',
        'adj\.': '形容',
        'v\.': '动',
        'adv\.': '副',
        'pron\.': '代',
        'prep\.': '介',
        'conj\.': '连',
        'art\.': '冠',
        'aux\.v\.': '助动',
        'num\.': '数',
        'pl\.': '复数',
        'abbr\.': '缩写',
        'vt\.': '及物动词',
        '&': '和'
    };
    // 创建正则表达式模式，匹配所有词性缩写
    const escapedKeys = Object.keys(partsOfSpeech).map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(
        `(${escapedKeys.join('|')})`,
        'g'
    );
    // 替换匹配到的词性缩写为带有样式的span
    return text.replace(pattern, match => {
        // 获取完整的词性名称，如果没有则使用缩写本身
        const fullName = partsOfSpeech[match] || match;
        return `<span class="part-speech" title="${match}">${fullName}</span>`;
    });
}

// 进入下一个单词
function nextWord() {
    if (word.wordIndex + 1 >= word.selectedWords.length) {
        if (game.isReview && word.skippedWords.length === 0) {
            setDomText(dom.errText, '恭喜！所有未掌握单词已完成练习！');
            game.isReview = false;
            dom.skipToggle.textContent = '🎯';
        }
        return unitComplete(); // 处理打字完成
    }
    word.wordIndex++; // 增加当前单词索引
    updateWord(); // 更新单词显示
}
// 跳过当前单词
function skipWord() {
    if (word.wordIndex + 1 >= word.selectedWords.length) return unitComplete(); // 处理打字完成
    const skippedWord = word.selectedWords[word.wordIndex];
    storage.saveToList('skippedWords', skippedWord, word.currentDict); // 保存到未掌握单词列表
    word.wordIndex++; // 增加当前单词索引
    updateWord(); // 更新单词显示
}
// 返回上一个单词
function goBackWord() {
    if (word.wordIndex <= 0) return;
    let i = word.wordIndex;
    word.wordIndex--; // 减少当前单词索引
    word.wordElements[i - 1].classList.add('active');// 切换活动类
    word.wordElements[i].classList.remove('active');
    stats.done-- // 减少已完成单词数
    updateWord(); // 更新单词显示
}
// 单元完成
function unitComplete() {
    game.isDone = true;
    clearInterval(game.timer);
    setDomText(dom.errText, '练习完成！');
    setDomStyle(dom.errText, 'color', 'var(--primary-color)');
    setDomStyle(dom.progress, 'width', '100%');
    setTimeout(() => {
        setDomStyle(dom.errText, 'color', 'var(--error-color)');
        updateDifficulty(1); // 更新进度级别
    }, 2000);
}
// 处理打字输入
function checkTyping(key) {
    if (game.isDone) return;
    const current = word.currentWord; // 获取当前单词
    const expected = current.charAt(stats.typed).toUpperCase(); // 获取当前期望字符
    if (expected === key) {
        stats.correct++; // 增加正确字符数
        stats.typed++; // 增加已输入字符数
        setDomText(dom.errText, ''); // 清空错误提示
        word.currentWordElement.innerHTML = stats.typed ? `<span class="typed">${current.substring(0, stats.typed)}</span>${current.substring(stats.typed)}` : current// 高亮已经输入的字母
        if (stats.typed === current.length) {
            stats.done++; // 增加已完成单词数
            if (game.isReview && game.isHidden) {
                word.correctWords[current] = (word.correctWords[current] || 0) + 1; // 增加正确输入次数
                if (word.correctWords[current] > 3) {
                    word.skippedWords = word.skippedWords.filter(word => word !== current); // 从未掌握单词列表中移除
                    storage.set('skippedWords', JSON.stringify(word.skippedWords)); // 更新存储
                    setDomText(dom.errText, `已掌握单词：${current}`); // 显示提示
                    setTimeout(() => {
                        setDomText(dom.errText, ''); // 清空提示
                        nextWord(); // 进入下一个单词
                    }, 1000);
                    return;
                }
            }
            nextWord(); // 进入下一个单词
        }
    } else {
        stats.errors += expected; // 增加错误字符串
        stats.typos++; // 增加错误计数
        setDomText(dom.errText, `按键错误: ${key}`);
        beep.play(); // 播放错误提示音
        if (stats.typos > 4) {
            setDomText(dom.errText, `错误次数过多，标记为未掌握单词：` + current);
            skipWord(); // 跳过当前单词
            stats.failed++; // 增加错误单词数
        }
    }
    updateStats(); // 更新统计信息
}
// 更新统计信息
function updateStats() {
    const total = stats.correct + stats.errors.length;
    setDomText(dom.speedVal, format.speed(stats.correct, stats.time));
    setDomText(dom.correctVal, stats.done);
    setDomText(dom.errWordVal, stats.failed);
    setDomText(dom.rateVal, format.percentage(stats.correct, total));
    const progress = `${((stats.done + stats.failed) / game.wordsPerRound) * 100}%`;
    setDomStyle(dom.progress, 'width', progress);
}
// 切换暗黑模式
function toggleDarkMode() {
    game.isDark = !game.isDark;
    document.body.classList.toggle('dark-mode', game.isDark);
    dom.darkMode.textContent = game.isDark ? '☀️' : '🌙';
    storage.set('darkMode', game.isDark);
}
// 更新进度级别
function updateDifficulty(change = 0) {
    word.dictProgress[word.currentDict] = Number(dom.diffSlider.value) + change;
    storage.set('dictProgress', JSON.stringify(word.dictProgress));
    dom.diffMenu.classList.remove('visible');
    init();
}
// 切换隐藏单词模式
function toggleHideWord() {
    game.isHidden = !game.isHidden;
    dom.hideToggle.textContent = game.isHidden ? '👀' : '🙈';
    word.wordElements.forEach(el => el.classList.toggle('hidden-text', game.isHidden)); // 根据隐藏状态切换类
}
// 切换未掌握单词模式 
function toggleSkipWordsMode() {
    const allSkippedWords = JSON.parse(storage.get('skippedWords', '{}'));
    word.skippedWords = allSkippedWords[word.currentDict] || [];
    if (word.skippedWords.length === 0) {
        setDomText(dom.errText, `当前字典(${word.currentDict})没有未掌握的单词,请继续练习`);
        dom.skipToggle.textContent = '🎯';
        return;
    }
    game.isReview = !game.isReview;
    dom.skipToggle.textContent = game.isReview ? '📚' : '🎯';
    //复习时隐藏进度选择器
    dom.diffSlider.style.display = game.isReview ? 'none' : 'block';
    init();
}
// 清除未掌握单词
function clearSkippedWords() {
    const allSkippedWords = JSON.parse(storage.get('skippedWords', '{}'));
    allSkippedWords[word.currentDict] = [];
    storage.set('skippedWords', JSON.stringify(allSkippedWords));
    word.skippedWords = [];
    setDomText(dom.errText, `已清除当前字典(${word.currentDict})未掌握单词`);
}
document.addEventListener('keydown', (event) => {
    const { keyCode } = event;
    if (keyCode === 13) setDomText(dom.errText, word.currentWord); // 按回车键显示当前单词
    else if (keyCode === 220) word.currentSound.play(); // 按\键播放当前单词音频
    else if (keyCode === 27) toggleHideWord(); // 按ESC键切换隐藏/显示单词模式
    else if (keyCode === 35) clearSkippedWords(); // 按End键清除跳过的单词
    else if (keyCode === 39 && game.isHidden) skipWord(); // 在隐藏模式下按右箭头跳过当前单词
    else if (keyCode === 37 && game.isHidden) goBackWord(); // 在隐藏模式下按左箭头返回上一个单词
    else if (keyCode === 38) updateDifficulty(1); // 按上箭头键增加进度
    else if (keyCode === 40) updateDifficulty(-1); // 按下箭头键减少进度 
    else if (keyCode >= 65 && keyCode <= 90) checkTyping(String.fromCharCode(keyCode)); // 处理A-Z字母键的输入
});
dom.darkMode.addEventListener('click', toggleDarkMode); // 切换暗黑模式
dom.skipToggle.addEventListener('click', toggleSkipWordsMode); // 切换未掌握单词练习模式
dom.helpBtn.addEventListener('click', () => dom.helpModal.style.display = 'flex'); // 显示帮助窗口
dom.helpClose.addEventListener('click', () => dom.helpModal.style.display = 'none'); // 关闭帮助窗口
dom.diffSlider.addEventListener('input', () => setDomText(dom.levelNum, dom.diffSlider.value)); // 更新进度显示
dom.diffSlider.addEventListener('change', () => updateDifficulty(0)); // 更新进度级别
dom.hideToggle.addEventListener('click', toggleHideWord); // 切换隐藏单词模式
dom.restartBtn.addEventListener('click', init); // 重新开始练习
dom.startHint.addEventListener('click', init); // 开始练习
dom.diffToggle.addEventListener('click', () => dom.diffMenu.classList.toggle('visible')); // 显示/隐藏进度调整菜单
document.addEventListener('click', (e) => { if (!e.target.closest('.difficulty-dropdown, .difficulty-toggle')) dom.diffMenu.classList.remove('visible') }); // 点击其他地方关闭进度菜单
dom.wordList.addEventListener('click', (event) => { if (event.target.dataset.word) audio.create(event.target.dataset.word).play() }); // 点击单词播放音频