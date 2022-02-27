document.addEventListener('DOMContentLoaded', init, false);


let mode;
let notFound;
let wordGuess;
let infoBlock;
let diff = '';
let infoButton;
let globlSuggestedWord;

async function scrapeLetters() {
    let hintLetters = [], greyLetters = []
    let rows = document.getElementsByTagName('game-app')[0].shadowRoot.querySelectorAll('game-row');
    let i;
    for(let row of rows) {
        let tiles = row.shadowRoot.querySelectorAll('game-tile');
        i = 0;
        for(let tile of tiles) {
            let char = tile.getAttribute("letter");
            if(char == null)
                continue;
            let status = tile.getAttribute("evaluation");
            if(status === "correct") {
                char = 'G' + char + i;
                if(!hintLetters.includes(char))
                    hintLetters.push(char);
            } else if(status === 'present') {
                char = 'Y' + char + i;
                if(!hintLetters.includes(char))
                    hintLetters.push(char);
            } else {
                if(!greyLetters.includes(char))
                    greyLetters.push(char);
            }
            i++;
        }
    }
    return "{\"hints\":" + JSON.stringify(hintLetters) + ',\"greys\":' + JSON.stringify(greyLetters) + "}";
}

async function fillLetters(word) {
    let rows = document.getElementsByTagName('game-app')[0].shadowRoot.querySelectorAll('game-row');
    for(let row of rows) {
        if(row.getAttribute("letters") === '' || row.getAttribute("letters") === null) {
            let tiles = row.shadowRoot.querySelectorAll('game-tile');
            let i = 0;
            for(let tile of tiles) {
                tile.setAttribute("letter", word[i].toLowerCase());
                i++;
            }
            return;
        }
    }
}

function autofill() {
    let tabId;
    doInCurrentTab(function (tab) {
        tabId = tab.id;
        if (globlSuggestedWord !== null) {
            chrome.scripting.executeScript({
                target: {tabId: tabId},
                func: fillLetters,
                args: [globlSuggestedWord]
            }, () => {
            });
        }
    });
}

function info() {
    if(infoButton.innerText === 'Info') {
        chrome.storage.sync.set({'state': 'info'});
        infoButton.innerText = 'Back';
        mode.style.display = 'none';
        notFound.style.display = 'none';
        wordGuess.style.display = 'none';
        infoBlock.style.display = 'block';
    } else {
        infoButton.innerText = 'Info';
        mode.style.display = 'block';
        notFound.style.display = 'none';
        wordGuess.style.display = 'none';
        infoBlock.style.display = 'none';
    }
}


function changeWord(word) {
    let letterBoxes = document.getElementsByClassName("word");
    let i = 0;
    for(let char of word) {
        letterBoxes[i].innerHTML = char.toUpperCase();
        i++;
    }
}

function doInCurrentTab(tabCallback) {
    chrome.tabs.query(
        { currentWindow: true, active: true },
        function (tabArray) { tabCallback(tabArray[0]); }
    );
}

// Function that handles suggesting each word
function suggestWord() {
    let input = '';
    let tabId;
    doInCurrentTab(function (tab) {
        tabId = tab.id;
        chrome.scripting.executeScript({target: {tabId: tabId},func: scrapeLetters}, (results) => {
            if(!chrome.runtime.lastError) {
                for(let result of results) {
                    input = result.result;
                    alert(input)
                    $.ajax({
                        type: "POST",
                        url: "./py/main.py",
                        data: {param: input},
                        success: function (response) {
                            globlSuggestedWord = response;
                            chrome.storage.sync.set({'word': response});
                            changeWord(response);
                        }
                    });
                }
            }
        });
    });
}


function normal() {
    chrome.storage.sync.set({'state': 'guess'});
    mode.style.display = 'none';
    notFound.style.display = 'none';
    wordGuess.style.display = 'block';
}

function init() {
    mode = document.getElementById("modeContainer");
    notFound = document.getElementById("notFound");
    wordGuess = document.getElementById("wordGuess");
    mainTitle = document.getElementById("name");
    infoBlock = document.getElementById("creditContainer");

    let startButton = document.getElementById("startButton");
    infoButton = document.getElementById("info");
    let goButton = document.getElementById("goToWordle");
    let nextButton = document.getElementById("next");
    //autoButton = document.getElementById("autofill");

    doInCurrentTab(function (tab) {
        chrome.storage.sync.get(['state','word','tabInfo'], function (data) {
            //Update popupElement1 and popupElement2 with loaded data
            let state = data.state;
            let word = data.word;
            let tabI = data.tabInfo;
            if(tabI === tab.id.toString()) {
                if (state === 'main' || state === null || state === '') {
                    mode.style.display = 'none';
                    notFound.style.display = 'none';
                    wordGuess.style.display = 'none';
                    infoBlock.style.display = 'none';
                    chrome.storage.sync.set({'state': 'main'});
                } else if (state === 'mode') {
                    mainTitle.classList.remove("anim");
                    infoButton.style.display = 'block';
                    mode.style.display = 'block';
                    notFound.style.display = 'none';
                    infoBlock.style.display = 'none';
                    wordGuess.style.display = 'none';
                } else if(state === 'guess') {
                    mainTitle.classList.remove("anim");
                    infoButton.style.display = 'block';
                    mode.style.display = 'none';
                    notFound.style.display = 'none';
                    infoBlock.style.display = 'none';
                    wordGuess.style.display = 'block';
                    globlSuggestedWord = word;
                    changeWord(word);
                } else if(state === 'notFound') {
                    mainTitle.classList.remove("anim");
                    infoButton.style.display = 'block';
                    mode.style.display = 'none';
                    notFound.style.display = 'block';
                    wordGuess.style.display = 'none';
                    infoBlock.style.display = 'none';
                } else if(state === 'info') {
                    mainTitle.classList.remove("anim");
                    infoButton.style.display = 'block';
                    infoButton.innerText = 'Back';
                    mode.style.display = 'none';
                    notFound.style.display = 'none';
                    wordGuess.style.display = 'none';
                    infoBlock.style.display = 'block';
                }
            } else {
                chrome.storage.sync.set({'state': 'main'});
            }
            chrome.storage.sync.set({'tabInfo': tab.id.toString()});
        });
    });

    startButton.onclick = normal;
    goButton.onclick = function () {chrome.tabs.update({url: "https://www.nytimes.com/games/wordle/index.html"});}
    nextButton.onclick = suggestWord;
    infoButton.onclick = info;
    //autoButton.onclick = autofill;

    let title = document.getElementById("name");

    title.addEventListener("animationend", function() {
        infoButton.style.display = 'block';
        chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
            let url = tabs[0].url;
            if (url === "https://www.nytimes.com/games/wordle/index.html") {
                chrome.storage.sync.set({'state': 'mode'});
                mode.style.display = 'block';
                notFound.style.display = 'none';
                infoBlock.style.display = 'none';
                wordGuess.style.display = 'none';
            } else {
                chrome.storage.sync.set({'state': 'notFound'});
                mode.style.display = 'none';
                notFound.style.display = 'block';
                infoBlock.style.display = 'none';
                wordGuess.style.display = 'none';
            }
        });
    });
}